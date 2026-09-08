import { VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION, type ViralQualityReport, type ViralSourceEvidence } from "./viral-video-domain";

export type ViralQualityInput = {
    candidateId: string;
    eventCoverage: number;
    timelineFidelity: number;
    identityConsistency: number;
    productFidelity: number;
    audioFidelity: number;
    visualFidelity: number;
    missingP0EventIds: string[];
    evidence: ViralSourceEvidence[];
};

const weights = { eventCoverage: 0.3, timelineFidelity: 0.2, identityConsistency: 0.15, productFidelity: 0.15, audioFidelity: 0.1, visualFidelity: 0.1 } as const;

export function scoreViralCandidateQuality(input: ViralQualityInput): ViralQualityReport {
    const scores = Object.fromEntries(Object.keys(weights).map((key) => [key, clampScore(input[key as keyof typeof weights])])) as Record<keyof typeof weights, number>;
    const weighted = Object.entries(weights).reduce((total, [key, weight]) => total + scores[key as keyof typeof weights] * weight, 0);
    const totalScore = round(input.missingP0EventIds.length ? Math.min(79, weighted) : weighted);
    const issues: string[] = [];
    if (input.missingP0EventIds.length) issues.push(`缺失 P0 必保事件：${input.missingP0EventIds.join("、")}；必须重生成对应时间段。`);
    if (scores.eventCoverage < 80) issues.push("关键事件覆盖不足：补齐缺失动作与起止状态。");
    if (scores.timelineFidelity < 80) issues.push("时间线偏移：按母版重新对齐动作峰值和转折点。");
    if (scores.identityConsistency < 80) issues.push("人物一致性不足：强化身份锚点、服装阶段和连续性约束。");
    if (scores.productFidelity < 80) issues.push("商品还原不足：加强外形、材质、标识与功能证据约束。");
    if (scores.audioFidelity < 75) issues.push("声音对应不足：重新对齐口播、字幕、音效与画面事件。");
    if (scores.visualFidelity < 75) issues.push("画面结构不足：修正构图、景别、运镜和光色。");
    const decision = input.missingP0EventIds.length || totalScore < 75 ? "retry" : totalScore < 85 ? "review" : "pass";
    return {
        schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
        id: `quality-${input.candidateId}`,
        candidateId: input.candidateId,
        totalScore,
        eventCoverageScore: scores.eventCoverage,
        timelineScore: scores.timelineFidelity,
        identityScore: scores.identityConsistency,
        productScore: scores.productFidelity,
        audioScore: scores.audioFidelity,
        visualScore: scores.visualFidelity,
        missingP0EventIds: [...input.missingP0EventIds],
        issues,
        evidence: [...input.evidence],
        decision,
    };
}

function clampScore(value: number) { return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)); }
function round(value: number) { return Math.round(value * 10) / 10; }
