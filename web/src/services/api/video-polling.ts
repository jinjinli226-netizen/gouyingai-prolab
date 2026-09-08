export const VIDEO_GENERATION_TIMEOUT_MS = 50 * 60 * 1000;

export function videoGenerationPollAttempts(delayMs: number) {
    return Math.max(1, Math.ceil(VIDEO_GENERATION_TIMEOUT_MS / delayMs));
}
