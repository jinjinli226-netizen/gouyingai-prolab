import type { UniversalFidelityContract, UniversalFidelityEvaluation, UniversalFidelityFact, UniversalRunCandidateManifest } from "./types.js";
export declare function createUniversalFidelityPrompt(contract: UniversalFidelityContract, candidate: UniversalRunCandidateManifest, threshold: number): string;
export declare function parseUniversalFidelityEvaluation(raw: string | Record<string, unknown>, contract: UniversalFidelityContract, candidate: UniversalRunCandidateManifest, threshold: number): UniversalFidelityEvaluation;
export declare function buildUniversalFidelityCorrection(report: UniversalFidelityEvaluation): string;
export declare function collectUniversalFidelityFacts(contract: UniversalFidelityContract, candidate: UniversalRunCandidateManifest): UniversalFidelityFact[];
