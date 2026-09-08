import type {
    UniversalFidelityContract,
    UniversalFidelityEvaluation,
    UniversalFidelityFact,
    UniversalRunCandidateManifest,
} from "./types.js";

type RawFactResult = { factId: string; status: "matched" | "missing" | "contradicted" | "uncertain"; issue: string };

const validStatuses = new Set<RawFactResult["status"]>(["matched", "missing", "contradicted", "uncertain"]);

export function createUniversalFidelityPrompt(
    contract: UniversalFidelityContract,
    candidate: UniversalRunCandidateManifest,
    threshold: number,
): string {
    const facts = collectUniversalFidelityFacts(contract, candidate);
    return [
        "你是通用视频复刻的独立视觉验收器。必须逐条核对已验证事实，不得按常见营销套路脑补或把提示词当成成片证据。",
        "第 1 个参考素材是原片完整视频；第 2 个参考素材是待验收成片；第 3 个及后续参考素材是带时间信息的原片故事板与关键帧。",
        "连续动作、路径、接触、释放、声音和因果关系优先比较两段完整视频；故事板与关键帧用于复核实体、构图、朝向和状态。",
        "对每个 factId 只判断待验收成片是否可见地满足该事实。matched 表示有清晰证据；missing 表示未出现；contradicted 表示出现相反证据；uncertain 表示素材不足以确认。",
        "必须为下面每个 factId 恰好返回一项。不得新增 factId，不得改写事实，不得输出修复后的故事或提示词。",
        `系统门槛为 ${normalizeThreshold(threshold)} 分；最终分数与通过状态由程序按事实重要性确定，模型不需要输出总分。`,
        `候选实体绑定：${JSON.stringify(candidate.entityManifest ?? [])}`,
        `母版时间线：${JSON.stringify(contract.timelineUnits)}`,
        `待核对事实：${JSON.stringify(facts)}`,
        '只返回 JSON 对象：{"factResults":[{"factId":"...","status":"matched|missing|contradicted|uncertain","issue":"未通过时用简体中文简述可见偏差，通过时为空字符串"}]}。不要代码围栏或其他文字。',
    ].join("\n");
}

export function parseUniversalFidelityEvaluation(
    raw: string | Record<string, unknown>,
    contract: UniversalFidelityContract,
    candidate: UniversalRunCandidateManifest,
    threshold: number,
): UniversalFidelityEvaluation {
    const facts = collectUniversalFidelityFacts(contract, candidate);
    const expected = new Map(facts.map((fact) => [fact.id, fact]));
    const value = typeof raw === "string" ? parseJsonObject(raw) : raw;
    const results = new Map<string, RawFactResult>();
    for (const item of Array.isArray(value.factResults) ? value.factResults : []) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const result = item as Record<string, unknown>;
        const factId = typeof result.factId === "string" ? result.factId : "";
        const status = typeof result.status === "string" ? result.status as RawFactResult["status"] : "uncertain";
        if (!expected.has(factId) || results.has(factId) || !validStatuses.has(status)) continue;
        results.set(factId, { factId, status, issue: typeof result.issue === "string" ? result.issue.trim() : "" });
    }

    const factResults = facts.map((fact) => {
        const result = results.get(fact.id);
        return { ...fact, status: result?.status ?? "uncertain", issue: result?.issue ?? `评估模型未返回事实 ${fact.id}` };
    });
    const totalWeight = factResults.reduce((total, fact) => total + factWeight(fact), 0);
    const matchedWeight = factResults.reduce((total, fact) => total + (fact.status === "matched" ? factWeight(fact) : 0), 0);
    const score = totalWeight ? Math.round((matchedWeight / totalWeight) * 1000) / 10 : 0;
    const matchedFactIds = factResults.filter((fact) => fact.status === "matched").map((fact) => fact.id);
    const missingFactIds = factResults.filter((fact) => fact.status !== "matched").map((fact) => fact.id);
    const normalizedThreshold = normalizeThreshold(threshold);
    const criticalFailure = factResults.some((fact) => fact.importance === "critical" && fact.status !== "matched");
    const issues = factResults.filter((fact) => fact.status !== "matched").map((fact) =>
        fact.issue || `${fact.id} 未通过视觉核对（${fact.status}）`);
    return {
        passed: !criticalFailure && score >= normalizedThreshold,
        score,
        threshold: normalizedThreshold,
        matchedFactIds,
        missingFactIds,
        issues,
        factResults,
    };
}

export function buildUniversalFidelityCorrection(report: UniversalFidelityEvaluation): string {
    const failed = report.factResults.filter((fact) => fact.status !== "matched");
    if (!failed.length) return "";
    return [
        "自动忠实度纠错附录（事实锁定）：",
        "以下条目全部来自已验证母版。只能强化这些原有事实，不得新增、删除、反转或改写其他动作、身份、时序、路径、接触关系与终态。若与其他描述冲突，以原始分秒时间线和本附录中的已验证事实为准。",
        ...failed.map((fact) => `- ${factTime(fact)}${fact.description}`),
    ].join("\n");
}

export function collectUniversalFidelityFacts(contract: UniversalFidelityContract, candidate: UniversalRunCandidateManifest): UniversalFidelityFact[] {
    const facts: UniversalFidelityFact[] = [];
    for (const unit of contract.timelineUnits) {
        for (const invariant of unit.structuralInvariants) facts.push({
            id: invariant.id,
            kind: "structural-invariant",
            importance: invariant.importance,
            description: `${invariant.dimension}：${invariant.description}`,
            timelineUnitId: unit.id,
            startSeconds: unit.sourceStartSeconds,
            endSeconds: unit.sourceEndSeconds,
        });
        for (const event of unit.eventFacts) facts.push({
            id: event.id,
            kind: "event-fact",
            importance: event.importance,
            description: `${event.dimension}：${event.predicate}`,
            timelineUnitId: unit.id,
            startSeconds: event.startSeconds,
            endSeconds: event.endSeconds,
        });
        for (const [index, continuity] of unit.startContinuity.facts.entries()) facts.push({
            id: `continuity:${unit.id}:start:${index}`,
            kind: "start-continuity",
            importance: "supporting",
            description: `${continuity.dimension}：${continuity.description}`,
            timelineUnitId: unit.id,
            startSeconds: unit.sourceStartSeconds,
            endSeconds: unit.sourceStartSeconds,
        });
        for (const [index, continuity] of unit.endContinuity.facts.entries()) facts.push({
            id: `continuity:${unit.id}:end:${index}`,
            kind: "end-continuity",
            importance: unit === contract.timelineUnits.at(-1) ? "critical" : "supporting",
            description: `${continuity.dimension}：${continuity.description}`,
            timelineUnitId: unit.id,
            startSeconds: unit.sourceEndSeconds,
            endSeconds: unit.sourceEndSeconds,
        });
    }
    for (const entity of candidate.entityManifest ?? []) facts.push({
        id: `entity:${entity.placeholderId}`,
        kind: "entity",
        importance: "critical",
        description: `${entity.placeholderId} 的可见身份为“${entity.identityFacts}”，物理实例数量为 ${entity.physicalInstanceCount}`,
    });
    const unique = new Map<string, UniversalFidelityFact>();
    for (const fact of facts) if (fact.id && !unique.has(fact.id)) unique.set(fact.id, fact);
    return [...unique.values()];
}

function parseJsonObject(raw: string): Record<string, unknown> {
    const normalized = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("视觉忠实度评估没有返回 JSON 对象");
    const parsed = JSON.parse(normalized.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("视觉忠实度评估返回格式无效");
    return parsed as Record<string, unknown>;
}

function normalizeThreshold(value: number) {
    return Math.max(1, Math.min(100, Number.isFinite(value) ? value : 85));
}

function factWeight(fact: Pick<UniversalFidelityFact, "importance">) {
    return fact.importance === "critical" ? 2 : 1;
}

function factTime(fact: UniversalFidelityFact) {
    if (!Number.isFinite(fact.startSeconds) || !Number.isFinite(fact.endSeconds)) return "";
    return `[${Number(fact.startSeconds).toFixed(2)}–${Number(fact.endSeconds).toFixed(2)} 秒] `;
}
