import type { ViralVideoReplacementAsset } from "@/types/canvas";
import {
    VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
    type ViralObjectFingerprint,
    type ViralObjectKind,
    type ViralObjectRole,
} from "./viral-video-domain";

export type ViralVideoUploadRecognitionResult = {
    status: "recognized" | "needs-confirmation";
    fingerprint: ViralObjectFingerprint;
    viewpoints: Array<{ assetId: string; viewpoint: string }>;
    issues: string[];
};

const objectKinds = new Set<ViralObjectKind>(["product", "person", "scene", "vehicle", "wardrobe", "animal", "prop"]);
const objectRoles = new Set<ViralObjectRole>(["hero-product", "supporting-object", "character", "environment"]);

export function buildViralVideoUploadRecognitionPrompt(assetCount: number, expectedObject?: { name?: string; category?: string }): string | null {
    if (!Number.isFinite(assetCount) || assetCount < 1) return null;
    const schema = {
        sameObject: true,
        kind: "product",
        name: "",
        role: "hero-product",
        visualFacts: { colors: [], materials: [], shape: "", markings: [], packaging: "", distinctiveFeatures: [] },
        functionalFacts: [],
        viewpoints: [{ referenceIndex: 1, viewpoint: "" }],
        confidence: 0,
    };
    return [
        `你是商品与视觉对象识别器。消息中按顺序附带 ${Math.floor(assetCount)} 张用户上传参考图。只依据可见事实识别这些图片中的主体，不要求用户补充商品描述。`,
        expectedObject?.name || expectedObject?.category
            ? `用户将这些图片放在候选对象「${expectedObject.name || "未命名"}」下，原分类为「${expectedObject.category || "未分类"}」。这只是匹配线索；若图片明显不符，必须降低 confidence，不得迎合。`
            : "当前没有人工对象描述，请完全依据图片识别。",
        "判断这些图片是否为同一个人物、商品、场景或道具的不同角度。sameObject 只有在主体身份一致时才能为 true；多件不同对象同时出现或无法确认时为 false。",
        "kind 只能是 product、person、scene、vehicle、wardrobe、animal、prop；role 只能是 hero-product、supporting-object、character、environment。提取颜色、材质、形状、图案/文字、包装和显著特征；看不清的品牌、材质、功能或身份保持空值，禁止猜测。",
        "viewpoints 必须按 referenceIndex 覆盖每张图片一次。confidence 为 0 到 1。只返回严格 JSON，不要 Markdown 或解释：",
        JSON.stringify(schema),
    ].join("\n\n");
}

export function parseViralVideoUploadRecognition(content: string, assets: ViralVideoReplacementAsset[], fingerprintId: string): ViralVideoUploadRecognitionResult {
    if (!assets.length) throw new Error("上传素材不能为空");
    const record = parseJsonRecord(content);
    const kind = requiredString(record.kind, "kind") as ViralObjectKind;
    if (!objectKinds.has(kind)) throw new Error("kind 无效");
    const role = requiredString(record.role, "role") as ViralObjectRole;
    if (!objectRoles.has(role)) throw new Error("role 无效");
    const confidence = boundedNumber(record.confidence, 0, 1, "confidence");
    const visualFacts = requireRecord(record.visualFacts, "visualFacts");
    const rawViewpoints = Array.isArray(record.viewpoints) ? record.viewpoints : [];
    const viewpoints = rawViewpoints.map((item, index) => {
        const viewpoint = requireRecord(item, `viewpoints[${index}]`);
        const referenceIndex = boundedNumber(viewpoint.referenceIndex, 1, assets.length, `viewpoints[${index}].referenceIndex`);
        return { assetId: assets[referenceIndex - 1].id, viewpoint: stringValue(viewpoint.viewpoint, `viewpoints[${index}].viewpoint`) };
    });
    const coveredAssets = new Set(viewpoints.map((item) => item.assetId));
    assets.forEach((asset) => {
        if (!coveredAssets.has(asset.id)) viewpoints.push({ assetId: asset.id, viewpoint: "" });
    });
    const issues: string[] = [];
    if (record.sameObject !== true) issues.push("多张参考图无法确认属于同一对象");
    if (confidence < 0.75) issues.push("素材识别置信度不足，需要确认");
    const fingerprint: ViralObjectFingerprint = {
        schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
        id: fingerprintId.trim() || `uploaded-${assets[0].id}`,
        origin: "uploaded-reference",
        kind,
        name: requiredString(record.name, "name"),
        role,
        visualFacts: {
            colors: stringArray(visualFacts.colors, "visualFacts.colors"),
            materials: stringArray(visualFacts.materials, "visualFacts.materials"),
            shape: stringValue(visualFacts.shape, "visualFacts.shape"),
            markings: stringArray(visualFacts.markings, "visualFacts.markings"),
            packaging: stringValue(visualFacts.packaging, "visualFacts.packaging"),
            distinctiveFeatures: stringArray(visualFacts.distinctiveFeatures, "visualFacts.distinctiveFeatures"),
        },
        functionalFacts: stringArray(record.functionalFacts, "functionalFacts"),
        shotIndexes: [],
        referenceAssetIds: assets.map((asset) => asset.id),
        representativeFrameIds: [],
        confidence,
    };
    return { status: issues.length ? "needs-confirmation" : "recognized", fingerprint, viewpoints, issues };
}

export function applyViralVideoUploadRecognition(assets: ViralVideoReplacementAsset[], result: ViralVideoUploadRecognitionResult): ViralVideoReplacementAsset[] {
    const recognitionError = result.issues.length ? result.issues.join("；") : undefined;
    return assets.map((asset) => ({
        ...asset,
        recognitionStatus: result.status,
        recognitionError,
        fingerprint: { ...result.fingerprint, referenceAssetIds: [...result.fingerprint.referenceAssetIds] },
    }));
}

export function markViralVideoUploadRecognitionFailed(assets: ViralVideoReplacementAsset[], error: string): ViralVideoReplacementAsset[] {
    const recognitionError = error.trim() || "素材识别失败";
    return assets.map((asset) => ({ ...asset, recognitionStatus: "needs-confirmation", recognitionError }));
}

export function describeViralVideoUploadFingerprint(fingerprint: ViralObjectFingerprint): string {
    return [
        ...fingerprint.visualFacts.colors,
        ...fingerprint.visualFacts.materials,
        fingerprint.visualFacts.shape,
        ...fingerprint.visualFacts.markings,
        ...fingerprint.visualFacts.distinctiveFeatures,
        ...fingerprint.functionalFacts,
    ].filter(Boolean).join("；") || `已识别${fingerprint.name}`;
}

export function viralObjectKindLabel(kind: ViralObjectKind): string {
    return { product: "商品", person: "人物", scene: "场景", vehicle: "车辆", wardrobe: "造型", animal: "动物", prop: "物品" }[kind];
}

function parseJsonRecord(content: string): Record<string, unknown> {
    const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("素材识别没有返回有效 JSON");
    let value: unknown;
    try {
        value = JSON.parse(trimmed.slice(start, end + 1));
    } catch {
        throw new Error("素材识别 JSON 无法解析");
    }
    return requireRecord(value, "素材识别结果");
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} 格式不正确`);
    return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
    const result = stringValue(value, field);
    if (!result) throw new Error(`${field} 不能为空`);
    return result;
}

function stringValue(value: unknown, field: string): string {
    if (typeof value !== "string") throw new Error(`${field} 必须是字符串`);
    return value.trim();
}

function stringArray(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${field} 必须是字符串数组`);
    return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function boundedNumber(value: unknown, min: number, max: number, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${field} 必须在 ${min} 到 ${max} 之间`);
    return value;
}
