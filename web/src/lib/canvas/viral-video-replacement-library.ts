import type { ViralVideoAnalysis } from "./viral-video-remake-workflow";
import type { ViralObjectFingerprint } from "./viral-video-domain";
import { bindViralVideoReplacementObjects } from "./viral-video-object-binding";
import type { ViralVideoReplacementAsset, ViralVideoReplacementElement, ViralVideoReplacementLibrary } from "@/types/canvas";

type ReplacementCandidate = NonNullable<ViralVideoAnalysis["replacementElements"]>[number] & { fingerprint?: ViralObjectFingerprint };

export type ViralVideoReplacementReference = {
    element: ViralVideoReplacementElement;
    asset: ViralVideoReplacementAsset;
    referenceIndex: number;
};

export function buildViralVideoReplacementLibrary(analysis?: ViralVideoAnalysis): ViralVideoReplacementLibrary {
    return {
        collapsed: false,
        elements: analysis ? replacementCandidates(analysis).map(candidateToElement) : [],
    };
}

export function mergeViralVideoReplacementLibrary(library: ViralVideoReplacementLibrary, analysis: ViralVideoAnalysis): ViralVideoReplacementLibrary {
    const existingById = new Map(library.elements.map((element) => [element.id, element]));
    const existingByName = new Map(library.elements.map((element) => [normalizeName(element.name), element]));
    const detected = replacementCandidates(analysis).map((candidate) => {
        const previous = existingById.get(candidate.id) || existingByName.get(normalizeName(candidate.name));
        return {
            ...candidateToElement(candidate),
            assets: previous?.assets || [],
        };
    });
    const detectedIds = new Set(detected.map((element) => element.id));
    const detectedNames = new Set(detected.map((element) => normalizeName(element.name)));
    const manual = library.elements.filter((element) => element.source === "manual" && !detectedIds.has(element.id) && !detectedNames.has(normalizeName(element.name)));
    return { ...library, elements: [...detected, ...manual] };
}

export function addViralVideoReplacementAssets(library: ViralVideoReplacementLibrary, elementId: string, assets: ViralVideoReplacementAsset[]): ViralVideoReplacementLibrary {
    if (!assets.length) return library;
    return {
        ...library,
        elements: library.elements.map((element) =>
            element.id === elementId
                ? {
                      ...element,
                      assets: [...element.assets, ...assets.filter((asset) => !element.assets.some((existing) => existing.id === asset.id))],
                  }
                : element,
        ),
    };
}

export function confirmViralVideoReplacementElement(
    library: ViralVideoReplacementLibrary,
    elementId: string,
    affectedEventIds: string[] = [],
): ViralVideoReplacementLibrary {
    return {
        ...library,
        elements: library.elements.map((element) => {
            if (element.id !== elementId || !element.fingerprint || !element.assets.length) return element;
            const replacementFingerprint =
                element.replacementFingerprint ||
                element.assets.find((asset) => asset.fingerprint)?.fingerprint || {
                    ...element.fingerprint,
                    id: `upload-${element.id}`,
                    origin: "uploaded-reference" as const,
                    name: element.assets[0].name.replace(/\.[^.]+$/, "") || `${element.name}替换素材`,
                    shotIndexes: [],
                    referenceAssetIds: element.assets.map((asset) => asset.id),
                    representativeFrameIds: [],
                    confidence: 1,
                };
            return {
                ...element,
                replacementFingerprint,
                assets: element.assets.map((asset) => ({
                    ...asset,
                    recognitionStatus: "recognized" as const,
                    recognitionError: undefined,
                    fingerprint: replacementFingerprint,
                })),
                binding: {
                    schemaVersion: element.fingerprint.schemaVersion,
                    id: `binding-${element.fingerprint.id}`,
                    sourceObjectId: element.fingerprint.id,
                    replacementObjectId: replacementFingerprint.id,
                    affectedEventIds: [...affectedEventIds],
                    mode: "user-confirmed",
                    status: "bound",
                    confidence: 1,
                    reason: "用户已在来源对象下明确上传并确认此替换对象",
                },
            };
        }),
    };
}

export function listViralVideoReplacementAssets(library?: ViralVideoReplacementLibrary): ViralVideoReplacementReference[] {
    let referenceIndex = 0;
    return (library?.elements || []).flatMap((element) => element.assets.map((asset) => ({ element, asset, referenceIndex: ++referenceIndex })));
}

export function buildViralVideoReplacementManifest(library?: ViralVideoReplacementLibrary): string {
    return (library?.elements || [])
        .filter((element) => element.assets.length)
        .map((element) => {
            const references = listViralVideoReplacementAssets(library).filter((item) => item.element.id === element.id);
            const first = references[0]?.referenceIndex;
            const last = references.at(-1)?.referenceIndex;
            const range = first === last ? `${first}` : `${first}–${last}`;
            const binding = element.binding ? `；绑定来源对象 ${element.binding.sourceObjectId}，覆盖事件 ${element.binding.affectedEventIds.join("、") || "待分析"}` : "";
            const fingerprint = element.replacementFingerprint;
            const recognized = fingerprint ? `；识别为${fingerprint.kind}/${fingerprint.role}：${describeFingerprint(fingerprint)}` : "";
            if (fingerprint && element.binding?.status === "bound") {
                const affectedCount = element.binding.affectedEventIds.length;
                const lockState = element.binding.mode === "user-confirmed"
                    ? `用户已确认并锁定全片 ${affectedCount} 个事件`
                    : `已自动锁定全片 ${affectedCount} 个事件`;
                return `参考图 ${range}：原片${element.category || "元素"}「${element.name}」 → 替换为「${fingerprint.name}」；${lockState}；替换素材可见事实：${describeFingerprint(fingerprint)}`;
            }
            return `参考图 ${range}：${element.category || "元素"}「${element.name}」；${element.description || "按原片中的叙事功能完成替换"}${recognized}${binding}`;
        })
        .join("\n");
}

export function refreshViralVideoReplacementBindings(library: ViralVideoReplacementLibrary, analysis: ViralVideoAnalysis): ViralVideoReplacementLibrary {
    const replacementObjects = library.elements.flatMap((element) => (element.replacementFingerprint ? [element.replacementFingerprint] : []));
    const explicitBindings = library.elements.flatMap((element) =>
        element.fingerprint && element.replacementFingerprint
            ? [{ sourceObjectId: element.fingerprint.id, replacementObjectId: element.replacementFingerprint.id }]
            : [],
    );
    const bindings = bindViralVideoReplacementObjects(analysis.objects || [], replacementObjects, analysis.mustKeepEvents || [], explicitBindings);
    const bindingBySourceId = new Map(bindings.map((binding) => [binding.sourceObjectId, binding]));
    return {
        ...library,
        elements: library.elements.map((element) => ({
            ...element,
            binding: element.fingerprint ? bindingBySourceId.get(element.fingerprint.id) : element.binding,
        })),
    };
}

export function createManualViralVideoReplacementElement(index: number): ViralVideoReplacementElement {
    return {
        id: `manual-${index}`,
        name: `其他替换元素 ${index}`,
        category: "其他",
        description: "上传后自动识别主体；无法确认时保留素材并提示确认",
        shotIndexes: [],
        source: "manual",
        assets: [],
    };
}

function replacementCandidates(analysis: ViralVideoAnalysis): ReplacementCandidate[] {
    if (analysis.objects?.length) {
        return analysis.objects.map((fingerprint) => ({
            id: fingerprint.id,
            name: fingerprint.name,
            category: categoryFromObjectKind(fingerprint.kind),
            description: describeFingerprint(fingerprint),
            shotIndexes: [...fingerprint.shotIndexes],
            fingerprint,
        }));
    }
    if (analysis.replacementElements?.length) return dedupeCandidates(analysis.replacementElements);
    const candidates = new Map<string, ReplacementCandidate>();
    analysis.shots.forEach((shot) => {
        shot.replaceableElements
            .split(/[、，,；;\n/]+/)
            .map((name) => name.trim())
            .filter(Boolean)
            .forEach((name) => {
                const key = normalizeName(name);
                const current = candidates.get(key);
                if (current) {
                    if (!current.shotIndexes.includes(shot.index)) current.shotIndexes.push(shot.index);
                    return;
                }
                candidates.set(key, {
                    id: `detected-${candidates.size + 1}`,
                    name,
                    category: inferCategory(name),
                    description: `原片镜头中的${name}`,
                    shotIndexes: [shot.index],
                });
            });
    });
    return [...candidates.values()];
}

function dedupeCandidates(candidates: ReplacementCandidate[]): ReplacementCandidate[] {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
        const key = normalizeName(candidate.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function candidateToElement(candidate: ReplacementCandidate): ViralVideoReplacementElement {
    return {
        id: candidate.id,
        name: candidate.name,
        category: candidate.category || inferCategory(candidate.name),
        description: candidate.description,
        shotIndexes: [...candidate.shotIndexes],
        source: "detected",
        assets: [],
        fingerprint: candidate.fingerprint,
    };
}

function categoryFromObjectKind(kind: ViralObjectFingerprint["kind"]): string {
    return { product: "商品", person: "人物", scene: "场景", vehicle: "车辆", wardrobe: "造型", animal: "动物", prop: "物品" }[kind];
}

function describeFingerprint(fingerprint: ViralObjectFingerprint): string {
    const facts = [
        ...fingerprint.visualFacts.colors,
        ...fingerprint.visualFacts.materials,
        fingerprint.visualFacts.shape,
        ...fingerprint.visualFacts.distinctiveFeatures,
        ...fingerprint.functionalFacts,
    ].filter(Boolean);
    return facts.length ? facts.join("；") : `原片中的${fingerprint.name}`;
}

function normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, "").toLowerCase();
}

function inferCategory(name: string): string {
    if (/人物|男人|女人|男子|女子|男孩|女孩|儿童|老人|主角|路人|群众|角色/.test(name)) return "人物";
    if (/场景|道路|街|房|室|店|厨房|卧室|户外|室内|背景|建筑/.test(name)) return "场景";
    if (/车|货车|汽车|摩托|自行车|轮椅|船|飞机/.test(name)) return "车辆";
    if (/衣|服装|鞋|帽|发型|妆/.test(name)) return "造型";
    if (/商品|产品|包装|食物|饮料|手机|容器|道具|物品/.test(name)) return "物品";
    if (/动物|狗|猫|鸟|宠物/.test(name)) return "动物";
    return "其他";
}
