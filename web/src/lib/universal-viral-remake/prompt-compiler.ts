import type {
    UniversalCompiledEntity,
    UniversalGenerationSegment,
    UniversalRemakeTemplate,
    UniversalVideoModelCapabilities,
} from "./types";
import { materializeUniversalDirectorPrompt } from "./director-prompt";

export function compileUniversalSegmentPrompt(
    template: UniversalRemakeTemplate,
    segment: UniversalGenerationSegment,
    entityManifest: UniversalCompiledEntity[],
    capabilities: UniversalVideoModelCapabilities,
): string {
    if (segment.durationSeconds > capabilities.maxDurationSeconds + 0.001) {
        throw new Error(`片段 ${segment.id} 超过模型 ${capabilities.modelId} 的最大时长`);
    }
    const scrub = createSourceAliasScrubber(entityManifest);
    const segmentUnits = template.timelineUnits.filter((unit) => segment.timelineUnitIds.includes(unit.id));
    const directorSegment = template.directorPromptPlan?.segments.find((item) => item.index === segment.index);
    if (directorSegment) return materializeUniversalDirectorPrompt(directorSegment, entityManifest);
    const directions = segmentUnits
        .map((unit) => [
            `${seconds(unit.sourceStartSeconds)}–${seconds(unit.sourceEndSeconds)}：${scrub(unit.direction)}`,
            "SOURCE-VERIFIED INVARIANTS:",
            formatStructuralInvariants(unit.structuralInvariants, scrub),
        ].join("\n"));
    if (!directions.length) throw new Error(`片段 ${segment.id} 没有对应的原片时间单元`);

    const entities = entityManifest.map((entity) => [
        `${entity.placeholderId} [${entity.kind}]`,
        `身份与外观：${entity.identityFacts}`,
        `物理实例数量：${entity.physicalInstanceCount}`,
        `绑定状态：${entity.replacementEntityId ? "REPLACED — 只允许当前替换身份" : "SOURCE-ONLY — 保持当前身份"}`,
    ].join("；")).join("\n");
    const referenceMap = createReferenceAssetMap(entityManifest);
    const replacementRules = entityManifest.filter((entity) => entity.replacementEntityId).map((entity) =>
        `- ${entity.placeholderId} 是完整替换，不是叠加：全片只能出现“${entity.identityFacts}”，不得保留、复制或重新生成原对象。`,
    );
    const affordanceRules = entityManifest.filter((entity) => entity.replacementEntityId).map((entity) =>
        `- ${entity.placeholderId} 的替换身份为“${entity.identityFacts}”；只有当原片终止状态对该替换对象无法按字面成立时，才可选择最接近的功能等价终止状态。`,
    );
    const eventFacts = segmentUnits.flatMap((unit) => unit.eventFacts ?? []).sort(compareEventFacts);
    if (!eventFacts.length) throw new Error(`片段 ${segment.id} 缺少已验证事件事实`);
    const initialStates = formatBoundaryStates(eventFacts, "beforeState", "片段开始时按首个已验证事实建立画面", scrub);
    const terminalStates = formatBoundaryStates(eventFacts, "afterState", "片段结束时保持最后一个已验证事实的结果", scrub, true);
    const negativeConstraints = deriveEvidenceNegativeConstraints(eventFacts, entityManifest, scrub);

    return [
        "UNIVERSAL VIRAL REMAKE — VERIFIED SOURCE SEGMENT",
        `MODEL: ${capabilities.modelId}`,
        `SOURCE RANGE: ${seconds(segment.sourceStartSeconds)}–${seconds(segment.sourceEndSeconds)}`,
        `DURATION: ${seconds(segment.durationSeconds)}`,
        `ASPECT RATIO: ${template.aspectRatio}`,
        "ENTITY MANIFEST:",
        entities || "无可替换对象，保持原片对象事实。",
        "REFERENCE ASSET MAP:",
        referenceMap.length ? referenceMap.join("\n") : "无参考图；仅按已验证母版执行。",
        "SOURCE-GROUNDED DIRECTION:",
        directions.join("\n"),
        "VERIFIED EVENT STATE MACHINE:",
        `INITIAL STATE: ${initialStates}`,
        formatEventFacts(eventFacts, scrub),
        `TERMINAL STATE: ${terminalStates}`,
        "PHYSICAL INSTANCE COUNT:",
        entityManifest.map((entity) => `${entity.placeholderId}=${entity.physicalInstanceCount}`).join("；") || "无可跟踪实体。",
        "CAPABILITY COVERAGE:",
        formatCapabilityCoverage(segmentUnits),
        "EVIDENCE-DERIVED NEGATIVE CONSTRAINTS:",
        negativeConstraints.join("\n"),
        `CONTINUITY IN: ${formatContinuity(segment.continuityIn, scrub)}`,
        `CONTINUITY OUT: ${formatContinuity(segment.continuityOut, scrub)}`,
        [
            "REPLACEMENT EXCLUSIVITY:",
            ...(replacementRules.length ? replacementRules : ["- 没有已绑定替换对象。"]),
            "- 每个占位符始终只代表一个物理对象；参考图只定义该占位符的外观，不得把它改作舞台、底座、背景或额外道具。",
            "- 画面不得同时出现同一占位符的原对象与替换对象，也不得把原对象留在接收位置后再覆盖替换对象。",
        ].join("\n"),
        [
            "CONSTRAINED AFFORDANCE ADAPTATION:",
            ...(affordanceRules.length ? affordanceRules : ["- 没有替换对象，不执行功能等价转译。"]),
            "- 只允许调整与替换对象物理功能冲突的终止状态；原片终止状态可以成立时必须原样保留。",
            "- 不得改变已验证的姿态、方向、路径、接触、释放、节奏和因果关系，不得用另一套更方便的动作替代原动作。",
            "- 功能等价结果必须发生在原片规定的参与者、时间、位置和接触之后，不得提前出现或额外增加步骤。",
        ].join("\n"),
        [
            "HARD FIDELITY RULES:",
            "只执行上述时间范围内已由原片证据确认的内容，不重新策划剧情或套用固定爆款公式。",
            "每条 critical 结构不变量和 critical 事件事实都必须成立；supporting 细节不得覆盖或改变 critical 事实。",
            "严格按 VERIFIED EVENT STATE MACHINE 的时间顺序执行，不得跳过、倒置、合并或改写微动作。",
            "不得凭空增加实体清单、结构不变量和事件事实未要求的参与者、事件、关系、状态变化、文字或声音。",
            "不得因为某个维度没有列出就自行补齐常见动作、运镜、口播、商品展示或营销节点。",
            "片段开始状态必须等于 CONTINUITY IN，片段结束状态必须精确交付 CONTINUITY OUT。",
        ].join("\n"),
    ].join("\n\n");
}

const EVENT_FAMILY_PRIORITY = [
    "relation-contact",
    "motion-path",
    "pose-deformation",
    "spatial-geometry",
    "state-transition",
    "entity-identity",
    "temporal-boundary",
    "camera-edit",
    "scene-treatment",
    "text-audio",
] as const;

function compareEventFacts(left: UniversalRemakeTemplate["timelineUnits"][number]["eventFacts"][number], right: UniversalRemakeTemplate["timelineUnits"][number]["eventFacts"][number]): number {
    return left.startSeconds - right.startSeconds
        || Number(right.importance === "critical") - Number(left.importance === "critical")
        || EVENT_FAMILY_PRIORITY.indexOf(left.family) - EVENT_FAMILY_PRIORITY.indexOf(right.family)
        || left.endSeconds - right.endSeconds;
}

function formatEventFacts(
    facts: UniversalRemakeTemplate["timelineUnits"][number]["eventFacts"],
    scrub: (value: string) => string,
): string {
    return facts.map((fact, index) => {
        const roles = fact.participantRoles.length
            ? fact.participantRoles.map((participant) => `${participant.placeholderId}=${scrub(participant.role)}`).join("，")
            : "全局";
        const transition = [
            fact.beforeState?.trim() ? `初态=${scrub(fact.beforeState)}` : "",
            fact.afterState?.trim() ? `终态=${scrub(fact.afterState)}` : "",
        ].filter(Boolean).join("；");
        return `${index + 1}. ${seconds(fact.startSeconds)}–${seconds(fact.endSeconds)} [${fact.importance.toUpperCase()}][${fact.family}][${scrub(fact.dimension)}] ${scrub(fact.predicate)}；角色=${roles}${transition ? `；${transition}` : ""}；置信度=${fact.confidence.toFixed(2)}`;
    }).join("\n");
}

function formatBoundaryStates(
    facts: UniversalRemakeTemplate["timelineUnits"][number]["eventFacts"],
    key: "beforeState" | "afterState",
    fallback: string,
    scrub: (value: string) => string,
    fromEnd = false,
): string {
    const boundary = fromEnd
        ? Math.max(...facts.map((fact) => fact.endSeconds))
        : Math.min(...facts.map((fact) => fact.startSeconds));
    const states = facts
        .filter((fact) => Math.abs((fromEnd ? fact.endSeconds : fact.startSeconds) - boundary) <= 0.001)
        .map((fact) => fact[key]?.trim())
        .filter((value): value is string => Boolean(value));
    return states.length ? [...new Set(states.map(scrub))].join("；") : fallback;
}

function formatCapabilityCoverage(units: UniversalRemakeTemplate["timelineUnits"]): string {
    return units.map((unit) => `${unit.id}：${unit.capabilityCoverage.map((coverage) => `${coverage.family}=${coverage.status}`).join("；")}`).join("\n");
}

function deriveEvidenceNegativeConstraints(
    facts: UniversalRemakeTemplate["timelineUnits"][number]["eventFacts"],
    entities: UniversalCompiledEntity[],
    scrub: (value: string) => string,
): string[] {
    const constraints = entities.map((entity) => `- ${entity.placeholderId} 必须始终保持 ${entity.physicalInstanceCount} 个物理实例；不得复制或增加物理实例。`);
    for (const fact of facts.filter((item) => item.importance === "critical")) {
        const text = scrub(`${fact.dimension} ${fact.predicate} ${fact.beforeState ?? ""} ${fact.afterState ?? ""}`);
        const subject = fact.participantRoles[0]?.placeholderId ?? "主体";
        if (/背对镜头/.test(text)) constraints.push(`- ${subject} 必须保持原片规定的背对镜头关系；不得把背对镜头改成正对镜头或侧面对镜头。`);
        if (fact.family === "motion-path") constraints.push(`- 不得改变“${scrub(fact.dimension)}”中的出现位置、路径方向、运动连续性或终点。`);
        if (fact.family === "relation-contact") constraints.push(`- 不得跳过、提前或颠倒“${scrub(fact.dimension)}”中的接触、释放、分离或附着顺序。`);
        if (/尚未出现|不可见/.test(text)) constraints.push(`- 对应对象在其已验证出现时刻之前不得提前可见。`);
    }
    return [...new Set(constraints)];
}

function seconds(value: number): string {
    return `${value.toFixed(3)}s`;
}

function formatContinuity(value: UniversalGenerationSegment["continuityIn"], scrub: (value: string) => string): string {
    if (!value?.facts?.length) return "没有需要跨片段锁定的连续性事实。";
    return value.facts.map((fact) => {
        const participants = fact.participantPlaceholderIds.length ? fact.participantPlaceholderIds.join(" + ") : "全局";
        return `${scrub(fact.dimension)}=${scrub(fact.description)}（参与者=${participants}）`;
    }).join("；");
}

function formatStructuralInvariants(
    value: UniversalRemakeTemplate["timelineUnits"][number]["structuralInvariants"] | undefined,
    scrub: (value: string) => string,
): string {
    if (!value?.length) return "缺少结构不变量；禁止提交生成。";
    return value.map((invariant) => {
        const participants = invariant.participantPlaceholderIds.length ? invariant.participantPlaceholderIds.join(" + ") : "全局";
        return `- [${invariant.importance.toUpperCase()}] ${scrub(invariant.dimension)}：${scrub(invariant.description)}；参与者=${participants}；置信度=${invariant.confidence.toFixed(2)}`;
    }).join("\n");
}

function createSourceAliasScrubber(entities: UniversalCompiledEntity[]): (value: string) => string {
    const replacements = entities
        .filter((entity) => entity.replacementEntityId)
        .flatMap((entity) => (entity.sourceAliases ?? []).map((alias) => ({ alias: alias.trim(), placeholderId: entity.placeholderId })))
        .filter((item) => item.alias)
        .sort((left, right) => right.alias.length - left.alias.length);
    return (value) => replacements.reduce((result, item) => result.replace(new RegExp(escapeRegExp(item.alias), "gi"), item.placeholderId), value);
}

function createReferenceAssetMap(entities: UniversalCompiledEntity[]): string[] {
    const assets = new Map<string, { index: number; placeholders: string[] }>();
    for (const entity of entities) {
        for (const assetId of entity.referenceAssetIds) {
            const current = assets.get(assetId);
            if (current) {
                if (!current.placeholders.includes(entity.placeholderId)) current.placeholders.push(entity.placeholderId);
                continue;
            }
            assets.set(assetId, { index: assets.size + 1, placeholders: [entity.placeholderId] });
        }
    }
    return [...assets.values()].map((asset) => `REFERENCE IMAGE ${asset.index} = ${asset.placeholders.join(" + ")}；只定义对应占位符的身份与外观。`);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
