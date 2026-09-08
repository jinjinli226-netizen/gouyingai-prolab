import type {
    UniversalCompiledEntity,
    UniversalDirectorPromptPlan,
    UniversalDirectorPromptSegment,
    UniversalRemakeTemplate,
} from "./types";

const REQUIRED_PROMPT_SECTIONS = [
    /Duration\s*:/i,
    /Aspect ratio\s*:/i,
    /Style\s*:/i,
    /VISUAL REFERENCES/i,
    /SCENE/i,
    /SHOT BREAKDOWN|TIME-CODED CONTINUOUS ACTION/i,
    /NEGATIVE CONSTRAINTS/i,
];

export function createUniversalDirectorPromptRequest(template: UniversalRemakeTemplate): string {
    const context = {
        durationSeconds: template.durationSeconds,
        aspectRatio: template.aspectRatio,
        entities: template.entityManifest.map((entity) => ({
            placeholderId: entity.placeholderId,
            targetIdentity: entity.identityFacts,
            kind: entity.kind,
            behavioralRole: entity.behavioralRole,
            physicalInstanceCount: entity.physicalInstanceCount,
            replacement: Boolean(entity.replacementEntityId),
        })),
        segments: template.segmentPlan.segments.map((segment) => ({
            index: segment.index,
            range: [segment.sourceStartSeconds, segment.sourceEndSeconds],
            entityPlaceholderIds: relevantEntitiesForSegment(template, segment.index).map((entity) => entity.placeholderId),
            continuityIn: segment.continuityIn,
            continuityOut: segment.continuityOut,
            units: template.timelineUnits
                .filter((unit) => segment.timelineUnitIds.includes(unit.id))
                .map((unit) => ({
                    id: unit.id,
                    range: [unit.sourceStartSeconds, unit.sourceEndSeconds],
                    direction: unit.direction,
                    structuralInvariants: unit.structuralInvariants,
                    eventFacts: unit.eventFacts,
                    boundaryAfter: unit.boundaryAfter,
                })),
        })),
    };
    return [
        "You are the final director-prompt compiler for one-shot AI video generation.",
        "Translate the verified source event graph and the already-bound replacement identities into one continuous generation prompt per segment.",
        "The result must read like a concrete production prompt written for the video model, not like an analysis report, database record, schema, or checklist.",
        "Each promptTemplate must use this production grammar in this exact order: Duration, Aspect ratio, Style, VISUAL REFERENCES, SCENE, SHOT BREAKDOWN, NEGATIVE CONSTRAINTS.",
        "Use natural Simplified Chinese role names inside the finished prompt. Do not expose @placeholder IDs except inside identity tokens such as {{identity:@actor}}.",
        "For every entity used by that segment, choose a short natural role label in roleLabels and place its exact {{identity:<placeholderId>}} token once in that segment's VISUAL REFERENCES. Do not include entities or scenes that only appear in another segment.",
        "Write SHOT BREAKDOWN with local segment timecodes beginning at 0 seconds and continuously ending at this segment's own duration, using lines like 0-2.5s——.... Never use the source video's absolute time inside a generated segment.",
        "Write a dense time-coded sequence. Every interval must specify visible pose/orientation, relative layout, object visibility, continuous path, contact/release, camera behavior, physical response, and sound only when established by the supplied evidence.",
        "Preserve all critical fact IDs and structural invariants. coveredFactIds must list every critical fact represented by that segment prompt.",
        "When replacement affordances make the literal source ending impossible, write one explicit target terminal state that is physically coherent for the bound target objects. Never say 'functional equivalent', 'closest result', 'adapt as needed', or leave the video model to decide the ending.",
        "The explicit target terminal state may adapt only the outcome after the verified path/contact. It must not change timing, pose, orientation, appearance origin, path topology, participant count, contact order, camera continuity, rhythm, or causality.",
        "Front-load single-take/camera rules, physical instance counts, delayed appearance constraints, and the decisive action. Do not output capability coverage, confidence values, evidence IDs, source aliases, model IDs, schema language, or explanatory prose.",
        "不要输出能力覆盖、置信度、证据编号、数据库字段解释或分析过程。不要照抄原对象名称；使用已绑定的目标身份和自然角色名。",
        "Return JSON only with exact English property names:",
        JSON.stringify({
            segments: [{
                index: 0,
                roleLabels: { "@placeholder": "自然角色名" },
                promptTemplate: "Duration: ...\\nAspect ratio: ...\\nStyle: ...\\n\\nVISUAL REFERENCES\\n...\\n\\nSCENE\\n...\\n\\nSHOT BREAKDOWN\\n...\\n\\nNEGATIVE CONSTRAINTS\\n...",
                coveredFactIds: ["critical-fact-id"],
                targetTerminalState: "明确、可见、可执行的最终画面状态",
            }],
        }, null, 2),
        "SOURCE EVENT GRAPH AND TARGET BINDINGS:",
        JSON.stringify(context),
    ].join("\n\n");
}

export function createUniversalDirectorPromptRepairRequest(
    template: UniversalRemakeTemplate,
    failedOutput: string,
    validationError: unknown,
): string {
    const issue = validationError instanceof Error ? validationError.message : String(validationError || "导演提示词结构无效");
    return [
        "Repair the rejected director-prompt plan once.",
        `Validation error: ${issue}`,
        `Rejected output: ${JSON.stringify(failedOutput)}`,
        "Return corrected complete JSON only. Do not explain, summarize, apologize, use markdown, or omit unchanged segments.",
        "Every promptTemplate must remain a directly executable one-shot video prompt in this exact order: Duration, Aspect ratio, Style, VISUAL REFERENCES, SCENE, SHOT BREAKDOWN, NEGATIVE CONSTRAINTS.",
        "Fix the exact validation error without weakening critical fact coverage, explicit terminal state, identity tokens, physical instance counts, continuity, timing, camera, or negative constraints.",
        createUniversalDirectorPromptRequest(template),
    ].join("\n\n");
}

export function parseUniversalDirectorPromptPlan(value: string | Record<string, unknown>, template: UniversalRemakeTemplate): UniversalDirectorPromptPlan {
    const parsed = typeof value === "string" ? parseJsonObject(value) : value;
    const envelope = isRecord(parsed.plan) ? parsed.plan : parsed;
    if (!Array.isArray(envelope.segments)) throw new Error("导演提示词缺少 segments");
    const expectedSegments = template.segmentPlan.segments;
    if (envelope.segments.length !== expectedSegments.length) throw new Error("导演提示词分段数量与生成计划不一致");
    const knownPlaceholders = new Set(template.entityManifest.map((entity) => entity.placeholderId));
    const seen = new Set<number>();
    const segments = envelope.segments.map((raw): UniversalDirectorPromptSegment => {
        if (!isRecord(raw)) throw new Error("导演提示词分段无效");
        const index = Number(raw.index);
        if (!Number.isInteger(index) || !expectedSegments.some((segment) => segment.index === index) || seen.has(index)) throw new Error("导演提示词分段 index 无效或重复");
        seen.add(index);
        let promptTemplate = text(raw.promptTemplate);
        if (!promptTemplate || promptTemplate.length > 6000) throw new Error("导演提示词为空或过长");
        for (const section of REQUIRED_PROMPT_SECTIONS) if (!section.test(promptTemplate)) throw new Error("导演提示词缺少标准成片章节");
        validatePromptTiming(promptTemplate, expectedSegments.find((segment) => segment.index === index)!, template.aspectRatio);
        if (/CAPABILITY COVERAGE|SOURCE-VERIFIED|UNIVERSAL VIRAL REMAKE|置信度|confidence\s*=|schema/i.test(promptTemplate)) {
            throw new Error("导演提示词混入了内部审计信息");
        }
        const withoutTokens = promptTemplate.replace(/\{\{identity:@[^}]+\}\}/g, "");
        if (/@[\p{L}\p{N}_-]+/u.test(withoutTokens)) throw new Error("导演提示词暴露了内部对象占位符");
        const roleLabels = isRecord(raw.roleLabels)
            ? Object.fromEntries(Object.entries(raw.roleLabels).map(([placeholderId, label]) => [placeholderId, text(label)]))
            : {};
        for (const { placeholderId } of relevantEntitiesForSegment(template, index)) {
            if (!roleLabels[placeholderId]) throw new Error(`导演提示词缺少 ${placeholderId} 的自然角色名`);
            if (!promptTemplate.includes(`{{identity:${placeholderId}}}`)) throw new Error(`导演提示词缺少 ${placeholderId} 的批量身份令牌`);
        }
        for (const placeholderId of Object.keys(roleLabels)) if (!knownPlaceholders.has(placeholderId)) throw new Error(`导演提示词引用了未知对象 ${placeholderId}`);
        const coveredFactIds = Array.isArray(raw.coveredFactIds) ? raw.coveredFactIds.map(text).filter(Boolean) : [];
        const expected = criticalFactIdsForSegment(template, index);
        const missing = expected.filter((factId) => !coveredFactIds.includes(factId));
        if (missing.length) throw new Error(`导演提示词未覆盖关键事实：${missing.join("、")}`);
        let targetTerminalState = text(raw.targetTerminalState);
        if (!targetTerminalState || /功能等价|最接近|自行|按需|适配即可|functional equivalent|closest result|as needed/i.test(targetTerminalState)) {
            throw new Error("导演提示词终止状态模糊，必须写成具体可见结果");
        }
        const locked = lockDirectorPromptToVerifiedSource(promptTemplate, template, index, roleLabels, targetTerminalState);
        promptTemplate = locked.promptTemplate;
        targetTerminalState = locked.targetTerminalState;
        promptTemplate = ensureTerminalStateInFinalTimedAction(promptTemplate, targetTerminalState);
        validatePromptTiming(promptTemplate, expectedSegments.find((segment) => segment.index === index)!, template.aspectRatio);
        return { index, roleLabels, promptTemplate, coveredFactIds: [...new Set(coveredFactIds)], targetTerminalState };
    }).sort((left, right) => left.index - right.index);
    return { segments };
}

function lockDirectorPromptToVerifiedSource(
    draftedPrompt: string,
    template: UniversalRemakeTemplate,
    segmentIndex: number,
    roleLabels: Record<string, string>,
    draftedTerminalState: string,
): { promptTemplate: string; targetTerminalState: string } {
    const segment = template.segmentPlan.segments.find((item) => item.index === segmentIndex);
    if (!segment) throw new Error("导演提示词引用了不存在的生成片段");
    const units = template.timelineUnits
        .filter((unit) => segment.timelineUnitIds.includes(unit.id))
        .sort((left, right) => left.sourceStartSeconds - right.sourceStartSeconds);
    if (!units.length) throw new Error("导演提示词对应片段缺少已验证时间单元");
    const sceneHeader = /^\s*SCENE\s*$/im.exec(draftedPrompt);
    if (sceneHeader?.index === undefined) throw new Error("导演提示词缺少 SCENE 章节");
    const actionHeading = /^\s*(SHOT BREAKDOWN|TIME-CODED CONTINUOUS ACTION)\s*$/im.exec(draftedPrompt)?.[1] || "SHOT BREAKDOWN";
    const render = createRoleRenderer(roleLabels);
    const segmentEntities = relevantEntitiesForSegment(template, segmentIndex);
    const allFacts = units.flatMap((unit) => unit.eventFacts)
        .filter((fact) => fact.startSeconds < segment.sourceEndSeconds - 0.001 && fact.endSeconds > segment.sourceStartSeconds + 0.001);
    const startStates = [
        ...segment.continuityIn.facts.map((fact) => fact.description),
        ...allFacts
            .filter((fact) => Math.abs(fact.startSeconds - segment.sourceStartSeconds) <= 0.01)
            .map((fact) => fact.beforeState)
            .filter((value): value is string => Boolean(value?.trim())),
    ].map(render).filter(Boolean);
    const earliestFactStart = Math.min(...allFacts.map((fact) => fact.startSeconds));
    const earliestBeforeStates = Number.isFinite(earliestFactStart)
        ? allFacts.filter((fact) => Math.abs(fact.startSeconds - earliestFactStart) <= 0.01)
            .map((fact) => fact.beforeState)
            .filter((value): value is string => Boolean(value?.trim()))
            .map(render)
        : [];
    const openingStates = [...new Set(startStates.length ? startStates : earliestBeforeStates)];
    const sceneRoles = segmentEntities
        .filter((entity) => entity.kind === "scene")
        .map((entity) => roleLabels[entity.placeholderId])
        .filter(Boolean);
    const style = draftedPrompt.match(/^\s*Style\s*:\s*[^\r\n]+/im)?.[0]?.trim() || "Style: 严格复刻原片视觉风格";
    const prefix = [
        `Duration: ${formatLocalSeconds(segment.durationSeconds)}s`,
        `Aspect ratio: ${template.aspectRatio}`,
        style,
        "",
        "VISUAL REFERENCES",
        ...segmentEntities.map((entity) => `${roleLabels[entity.placeholderId]}: {{identity:${entity.placeholderId}}}`),
    ].join("\n");
    const scene = [
        sceneRoles.length ? `场景保持为${sceneRoles.join("、")}。` : "场景严格沿用已验证原片关系。",
        openingStates.length ? `开场可见状态：${openingStates.join("；")}。` : "开场只建立本段首个已验证可见状态，不得提前显示后续事件结果。",
        `物理实例数量固定：${segmentEntities.map((entity) => `${roleLabels[entity.placeholderId]} ${entity.physicalInstanceCount} 个`).join("；")}。`,
    ].join("");
    const boundaries = [...new Set([
        segment.sourceStartSeconds,
        segment.sourceEndSeconds,
        ...units.flatMap((unit) => [unit.sourceStartSeconds, unit.sourceEndSeconds]),
        ...allFacts.flatMap((fact) => [fact.startSeconds, fact.endSeconds]),
    ].map((value) => Math.max(segment.sourceStartSeconds, Math.min(segment.sourceEndSeconds, value))))].sort((left, right) => left - right);
    const actionLines = boundaries.slice(0, -1).map((intervalStart, intervalIndex) => {
        const intervalEnd = boundaries[intervalIndex + 1];
        const activeFacts = allFacts.filter((fact) => fact.startSeconds < intervalEnd - 0.001 && fact.endSeconds > intervalStart + 0.001);
        const facts = [...activeFacts].sort((left, right) => left.startSeconds - right.startSeconds).flatMap((fact) => {
            const states = [
                fact.beforeState && Math.abs(fact.startSeconds - intervalStart) <= 0.01 ? `起始状态：${render(fact.beforeState)}` : "",
                fact.afterState && Math.abs(fact.endSeconds - intervalEnd) <= 0.01 ? `结束状态：${render(fact.afterState)}` : "",
            ].filter(Boolean);
            return [`${render(fact.predicate)}${states.length ? `（${states.join("；")}）` : ""}`];
        });
        const details = facts.length ? [...new Set(facts)] : [describeUncoveredInterval(allFacts, intervalStart, intervalEnd, render)];
        const localStart = intervalStart - segment.sourceStartSeconds;
        const localEnd = intervalEnd - segment.sourceStartSeconds;
        return `${formatLocalSeconds(localStart)}-${formatLocalSeconds(localEnd)}s——${details.join("；")}。`;
    });
    const criticalFacts = units.flatMap((unit) => unit.eventFacts.filter((fact) => fact.importance === "critical"));
    const criticalInvariants = units.flatMap((unit) => unit.structuralInvariants.filter((invariant) => invariant.importance === "critical"));
    const negativeConstraints = [
        ...criticalFacts.map((fact) => `- 不得改变动作主体、方向、来源、连续路径、接触顺序或终点：${render(fact.predicate)}。`),
        ...criticalInvariants.map((invariant) => `- 不得违背${render(invariant.dimension)}：${render(invariant.description)}。`),
        ...segmentEntities.map((entity) => `- ${roleLabels[entity.placeholderId]} 始终保持 ${entity.physicalInstanceCount} 个物理实例，不得复制、融合或凭空增加。`),
        "- 禁止把上述连续事件改写成更方便的另一套动作；禁止省略中间状态、反转因果或提前显示尚未出现的对象。",
    ];
    const sourceOnly = template.entityManifest.every((entity) => !entity.replacementEntityId);
    const sourceTerminalState = deriveVerifiedTerminalState(template, segmentIndex, roleLabels);
    const targetTerminalState = sourceOnly && sourceTerminalState ? sourceTerminalState : draftedTerminalState;
    const promptTemplate = [
        prefix,
        "",
        "SCENE",
        scene,
        "",
        actionHeading,
        ...actionLines,
        "",
        "NEGATIVE CONSTRAINTS",
        ...[...new Set(negativeConstraints)],
    ].join("\n");
    return { promptTemplate, targetTerminalState };
}

function relevantEntitiesForSegment(template: UniversalRemakeTemplate, segmentIndex: number): UniversalCompiledEntity[] {
    const segment = template.segmentPlan.segments.find((item) => item.index === segmentIndex);
    if (!segment) return [];
    const units = template.timelineUnits.filter((unit) => segment.timelineUnitIds.includes(unit.id));
    const placeholders = new Set([
        ...units.flatMap((unit) => unit.placeholderIds),
        ...units.flatMap((unit) => unit.eventFacts.flatMap((fact) => fact.participantRoles.map((participant) => participant.placeholderId))),
        ...units.flatMap((unit) => unit.structuralInvariants.flatMap((invariant) => invariant.participantPlaceholderIds)),
        ...segment.continuityIn.facts.flatMap((fact) => fact.participantPlaceholderIds),
        ...segment.continuityOut.facts.flatMap((fact) => fact.participantPlaceholderIds),
    ]);
    const relevant = template.entityManifest.filter((entity) => placeholders.has(entity.placeholderId));
    return relevant.length ? relevant : template.entityManifest;
}

function describeUncoveredInterval(
    facts: UniversalRemakeTemplate["timelineUnits"][number]["eventFacts"],
    intervalStart: number,
    intervalEnd: number,
    render: (value: string) => string,
): string {
    const previousEnd = Math.max(...facts.filter((fact) => fact.endSeconds <= intervalStart + 0.01).map((fact) => fact.endSeconds));
    const nextStart = Math.min(...facts.filter((fact) => fact.startSeconds >= intervalEnd - 0.01).map((fact) => fact.startSeconds));
    const states = [
        ...(Number.isFinite(previousEnd) ? facts.filter((fact) => Math.abs(fact.endSeconds - previousEnd) <= 0.01).map((fact) => fact.afterState) : []),
        ...(Number.isFinite(nextStart) ? facts.filter((fact) => Math.abs(fact.startSeconds - nextStart) <= 0.01).map((fact) => fact.beforeState) : []),
    ].filter((value): value is string => Boolean(value?.trim())).map(render);
    const visibleState = [...new Set(states)].join("；") || "上一已验证可见状态";
    return `保持事件发生前状态：${visibleState}；本区间只做连续铺垫，不得提前执行后续事件`;
}

function deriveVerifiedTerminalState(
    template: UniversalRemakeTemplate,
    segmentIndex: number,
    roleLabels: Record<string, string>,
): string {
    const segment = template.segmentPlan.segments.find((item) => item.index === segmentIndex);
    if (!segment) return "";
    const render = createRoleRenderer(roleLabels);
    const units = template.timelineUnits.filter((unit) => segment.timelineUnitIds.includes(unit.id));
    const terminalFacts = units
        .flatMap((unit) => unit.eventFacts)
        .filter((fact) => Math.abs(fact.endSeconds - segment.sourceEndSeconds) <= 0.01)
        .map((fact) => fact.afterState)
        .filter((value): value is string => Boolean(value?.trim()));
    const states = [...segment.continuityOut.facts.map((fact) => fact.description), ...terminalFacts].map(render).filter(Boolean);
    return [...new Set(states)].join("；");
}

function createRoleRenderer(roleLabels: Record<string, string>): (value: string) => string {
    const entries = Object.entries(roleLabels).sort(([left], [right]) => right.length - left.length);
    return (value) => entries.reduce((result, [placeholderId, label]) => result.replaceAll(placeholderId, label), value.trim());
}

function formatLocalSeconds(value: number): string {
    return Number(value.toFixed(3)).toString();
}

export function materializeUniversalDirectorPrompt(segment: UniversalDirectorPromptSegment, entities: UniversalCompiledEntity[]): string {
    let prompt = segment.promptTemplate;
    for (const entity of entities) prompt = prompt.replaceAll(`{{identity:${entity.placeholderId}}}`, entity.identityFacts.trim());
    if (/\{\{identity:/.test(prompt) || /@[\p{L}\p{N}_-]+/u.test(prompt)) throw new Error("导演提示词仍含未解析的内部对象令牌");
    return prompt.trim();
}

function criticalFactIdsForSegment(template: UniversalRemakeTemplate, segmentIndex: number): string[] {
    const segment = template.segmentPlan.segments.find((item) => item.index === segmentIndex);
    if (!segment) return [];
    return template.timelineUnits
        .filter((unit) => segment.timelineUnitIds.includes(unit.id))
        .flatMap((unit) => unit.eventFacts)
        .filter((fact) => fact.importance === "critical")
        .map((fact) => fact.id);
}

function validatePromptTiming(prompt: string, segment: UniversalRemakeTemplate["segmentPlan"]["segments"][number], aspectRatio: string): void {
    const duration = Number(prompt.match(/Duration\s*:\s*(\d+(?:\.\d+)?)/i)?.[1]);
    if (!Number.isFinite(duration) || Math.abs(duration - segment.durationSeconds) > 0.05) throw new Error("导演提示词时长与当前生成片段不一致");
    const ratio = prompt.match(/Aspect ratio\s*:\s*([^\r\n]+)/i)?.[1]?.trim().replace(/\s/g, "");
    if (ratio !== aspectRatio.replace(/\s/g, "")) throw new Error("导演提示词画幅与复刻母版不一致");
    const ranges = [...prompt.matchAll(/^\s*(\d+(?:\.\d+)?)\s*(?:s|秒)?\s*(?:-|–|—|至|~)\s*(\d+(?:\.\d+)?)\s*(?:s|秒)\s*(?:——|—|-|:|：)/gim)]
        .map((match) => ({ start: Number(match[1]), end: Number(match[2]) }));
    if (!ranges.length || Math.abs(ranges[0].start) > 0.05) throw new Error("导演提示词的本段时间轴必须从 0 秒开始");
    for (let index = 0; index < ranges.length; index += 1) {
        const range = ranges[index];
        if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start) throw new Error("导演提示词包含无效时间区间");
        if (index > 0 && Math.abs(ranges[index - 1].end - range.start) > 0.05) throw new Error("导演提示词的本段时间轴存在空洞或重叠");
    }
    if (Math.abs(ranges.at(-1)!.end - segment.durationSeconds) > 0.05) throw new Error("导演提示词的本段时间轴没有连续覆盖到片段结尾");
}

function ensureTerminalStateInFinalTimedAction(prompt: string, terminalState: string): string {
    if (prompt.includes(terminalState)) return prompt;
    const lines = prompt.split("\n");
    const negativeIndex = lines.findIndex((line) => /NEGATIVE CONSTRAINTS/i.test(line));
    for (let index = (negativeIndex < 0 ? lines.length : negativeIndex) - 1; index >= 0; index -= 1) {
        if (!/^\s*\d+(?:\.\d+)?\s*(?:s|秒)?\s*(?:-|–|—|至|~)\s*\d+(?:\.\d+)?\s*(?:s|秒)/i.test(lines[index])) continue;
        lines[index] = `${lines[index]}；最终可见状态：${terminalState}`;
        return lines.join("\n");
    }
    throw new Error("导演提示词缺少可写入终止状态的最后时间段");
}

function parseJsonObject(value: string): Record<string, unknown> {
    const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("导演提示词模型未返回 JSON 对象");
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (!isRecord(parsed)) throw new Error("导演提示词 JSON 无效");
    return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}
