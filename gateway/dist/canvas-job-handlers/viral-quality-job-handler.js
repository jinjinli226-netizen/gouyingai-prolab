const weights = { eventCoverage: 0.3, timelineFidelity: 0.2, identityConsistency: 0.15, productFidelity: 0.15, audioFidelity: 0.1, visualFidelity: 0.1 };
export function createViralQualityJobHandler() {
    return async ({ job }) => {
        if (job.kind !== "viral-quality")
            throw new Error(`任务 ${job.id} 不是复刻质量任务`);
        const metrics = record(job.input.metrics, "metrics");
        const scores = Object.fromEntries(Object.keys(weights).map((key) => [key, score(metrics[key], key)]));
        const missingP0EventIds = stringArray(job.input.missingP0EventIds);
        const weighted = Object.entries(weights).reduce((total, [key, weight]) => total + scores[key] * weight, 0);
        const totalScore = round(missingP0EventIds.length ? Math.min(79, weighted) : weighted);
        const issues = missingP0EventIds.length ? [`缺失 P0 必保事件：${missingP0EventIds.join("、")}`] : [];
        if (scores.productFidelity < 80)
            issues.push("商品还原不足");
        if (scores.identityConsistency < 80)
            issues.push("人物一致性不足");
        const quality = {
            candidateId: typeof job.input.candidateId === "string" ? job.input.candidateId : `candidate-${job.candidate_index ?? 0}`,
            totalScore,
            eventCoverageScore: scores.eventCoverage,
            timelineScore: scores.timelineFidelity,
            identityScore: scores.identityConsistency,
            productScore: scores.productFidelity,
            audioScore: scores.audioFidelity,
            visualScore: scores.visualFidelity,
            missingP0EventIds,
            issues,
            evidence: Array.isArray(job.input.evidence) ? job.input.evidence : [],
            decision: missingP0EventIds.length || totalScore < 75 ? "retry" : totalScore < 85 ? "review" : "pass",
        };
        return { result: { quality }, result_patch: null };
    };
}
function record(value, field) { if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${field} 必须是对象`); return value; }
function score(value, field) { const number = Number(value); if (!Number.isFinite(number))
    throw new Error(`${field} 必须是分数`); return Math.max(0, Math.min(100, number)); }
function stringArray(value) { return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []; }
function round(value) { return Math.round(value * 10) / 10; }
//# sourceMappingURL=viral-quality-job-handler.js.map