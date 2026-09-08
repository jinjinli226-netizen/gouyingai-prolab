export type ViralCostInput = {
    candidateCount: number;
    durationSeconds: number;
    videoCentsPerSecond: number;
    imageCountPerCandidate?: number;
    imageCents?: number;
    textCentsPerCandidate?: number;
    authorizationThresholdCents?: number;
};

export type ViralCostPreflight = {
    perCandidateCents: number;
    totalCents: number;
    requiresAuthorization: boolean;
    authorizationThresholdCents: number;
};

export function estimateViralBatchCost(input: ViralCostInput): ViralCostPreflight {
    const perCandidateCents = roundMoney(
        positive(input.durationSeconds) * positive(input.videoCentsPerSecond)
        + Math.floor(positive(input.imageCountPerCandidate || 0)) * positive(input.imageCents || 0)
        + positive(input.textCentsPerCandidate || 0),
    );
    const totalCents = roundMoney(perCandidateCents * Math.max(1, Math.min(1000, Math.floor(positive(input.candidateCount) || 1))));
    const authorizationThresholdCents = roundMoney(positive(input.authorizationThresholdCents ?? 1000));
    return { perCandidateCents, totalCents, requiresAuthorization: totalCents > authorizationThresholdCents, authorizationThresholdCents };
}

export function createViralBatchIdempotencyKey(input: Record<string, string | number | boolean | null | undefined>): string {
    const canonical = Object.keys(input).sort().map((key) => `${key}=${String(input[key] ?? "")}`).join("&");
    let hash = 2166136261;
    for (let index = 0; index < canonical.length; index += 1) { hash ^= canonical.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return `viral-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function positive(value: number) { return Number.isFinite(value) ? Math.max(0, value) : 0; }
function roundMoney(value: number) { return Math.round(value * 100) / 100; }
