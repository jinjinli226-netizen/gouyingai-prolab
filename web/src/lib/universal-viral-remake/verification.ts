import { parseJsonObject, validateUniversalSourceReconstruction } from "./reconstruction";
import { UNIVERSAL_CAPABILITY_REGISTRY } from "./capabilities";
import type {
    UniversalReconstructionInput,
    UniversalRemakeUnderstandingPort,
    UniversalSourceReconstruction,
} from "./types";

type VerificationEnvelope = {
    status: "verified" | "repaired" | "rejected";
    confidence: number;
    issues: string[];
    reconstruction?: UniversalSourceReconstruction;
};

export function createUniversalVerificationPrompt(input: UniversalReconstructionInput, reconstruction: UniversalSourceReconstruction): string {
    const outputContract = {
        status: "verified | repaired | rejected",
        confidence: 0.95,
        issues: ["Evidence-grounded issue, or an empty array when no issue exists"],
        reconstruction: null,
    };
    return [
        "Independently verify the proposed source-video reconstruction against the same supplied evidence.",
        "Check full timeline coverage, timing, entity identity versus behavior, and every visual, temporal, narrative or audible relationship the reconstruction claims. Do not reward a plausible but unsupported story.",
        "Check the evidence-specific structural invariants in every unit. They must be the smallest evidence-backed set that distinguishes the observed unit from a materially different video, with critical versus supporting importance calibrated correctly.",
        `Audit the capability coverage ledger against every registered family: ${UNIVERSAL_CAPABILITY_REGISTRY.map((item) => item.family).join(", ")}. Every registered family must appear exactly once in every unit.`,
        "Validate observed, not-observed, not-applicable, and uncertain independently. Do not require any family to be observed: a static frame, dialogue-led video, montage, physical process, or any other source must keep only its actual evidence-backed content.",
        "For observed physical events, actively check whether decisive orientation, source region, destination region, path, contact, and release facts were omitted. These are questions to inspect, not actions to invent. Repair omissions only when the evidence shows them.",
        "Audit exact silhouette, proportions, anatomy, surface material, articulation and viewing orientation. Reject a reconstruction that substitutes a generic category stereotype for an unusual observed body or object.",
        "For every appearing object, verify whether the evidence shows hidden-existing, newly generated, deformed-from-source, or separated-from-source origin. Audit topological continuity, including whether it remains attached during extension or travel and the exact detachment or release moment.",
        "Audit multi-view identity evidence against physical instance count. Multiple reference views of one object must not become multiple physical instances unless the source evidence explicitly shows multiple instances.",
        "Reject an observed coverage entry without matching timestamped facts, a silent missing family, a critical uncertain family, or a fact that contradicts direction, structural invariants, continuity, or the source evidence.",
        "Verify that source identity nouns appear only in entity sourceAliases. behavioralRole, direction, structuralInvariants, eventFacts and continuity facts must use placeholders so a later replacement cannot accidentally preserve both the old and new object.",
        "When native video evidence exists, prioritize its continuous motion and audio over storyboard inference. A sparse timestamped storyboard is the expected fallback evidence format only when native video is unavailable; sampling gaps alone are not grounds for invention or rejection.",
        "Return one JSON object using the exact English property names and nesting shown below. Do not wrap it inside verification, result, data, markdown, commentary, or a code fence.",
        "Keep property names, enum values, IDs and placeholders in English, but write all human-readable descriptive values in Simplified Chinese, including issues and every descriptive field inside a repaired reconstruction.",
        "Choose exactly one status value. Set reconstruction to null for verified or rejected. For repaired, replace null with the complete corrected Proposed reconstruction object, preserving its exact schema.",
        `Required output contract: ${JSON.stringify(outputContract)}`,
        "Use repaired only when every issue can be corrected from existing evidence. Include the complete corrected reconstruction. Reject when evidence is insufficient or contradictions remain.",
        `Source metadata: ${JSON.stringify({ sourceVideoId: input.sourceVideoId, durationSeconds: input.durationSeconds, aspectRatio: input.aspectRatio })}`,
        `Evidence: ${JSON.stringify(input.evidence)}`,
        `Proposed reconstruction: ${JSON.stringify(reconstruction)}`,
    ].join("\n");
}

export async function verifyUniversalSourceReconstruction(
    input: UniversalReconstructionInput,
    reconstruction: UniversalSourceReconstruction,
    port: UniversalRemakeUnderstandingPort,
): Promise<UniversalSourceReconstruction> {
    let prompt = createUniversalVerificationPrompt(input, reconstruction);
    while (true) {
        const raw = await port.understandVideo({
            phase: "verify",
            prompt,
            sourceVideoId: input.sourceVideoId,
            evidence: input.evidence,
            reconstruction,
        });
        let envelope: VerificationEnvelope;
        try {
            envelope = validateEnvelope(unwrapVerification(parseJsonObject(raw)));
        } catch (error) {
            envelope = {
                status: "rejected",
                confidence: 0,
                issues: [error instanceof Error ? error.message : "二次校验返回格式无效"],
            };
        }
        if (envelope.status === "rejected") {
            prompt = createUniversalVerificationRepairPrompt(input, reconstruction, envelope);
            continue;
        }
        let selected = reconstruction;
        if (envelope.status === "repaired") {
            try {
                selected = validateUniversalSourceReconstruction(envelope.reconstruction as unknown as Record<string, unknown>, input);
            } catch (error) {
                prompt = createUniversalVerificationRepairPrompt(input, reconstruction, {
                    status: "rejected",
                    confidence: 0,
                    issues: [error instanceof Error ? error.message : "修复后的重建结果格式无效"],
                });
                continue;
            }
        }
        return {
            ...selected,
            verification: {
                status: envelope.status,
                confidence: envelope.confidence,
                issues: [...envelope.issues],
                repaired: envelope.status === "repaired",
            },
        };
    }
}

function createUniversalVerificationRepairPrompt(
    input: UniversalReconstructionInput,
    reconstruction: UniversalSourceReconstruction,
    rejected: VerificationEnvelope,
): string {
    return [
        "Continue the evidence-calibration repair of the proposed reconstruction until it can pass independent verification.",
        "A sparse timestamped storyboard is the expected evidence format only when native video is unavailable, so sampling gaps alone must not cause rejection; when native video exists, repair against its continuous evidence first.",
        "Repair every correctable issue conservatively: remove unsupported claims, widen exact timing to evidence-supported intervals, describe only observable relationships or changes, and lower confidence where evidence is sparse.",
        "Re-select the minimum evidence-specific structural invariants and event facts for each unit. Their dimension names must come from this source rather than a fixed checklist. Complete the capability coverage ledger without converting the registry into required content. Replace source identity nouns outside sourceAliases with their placeholders.",
        "Do not invent hidden actions. Reject only when no coherent, continuously ordered, evidence-grounded timeline can be produced at all.",
        "Return status repaired with the complete corrected reconstruction whenever those conservative edits resolve the issues.",
        `Previous rejection issues: ${JSON.stringify(rejected.issues)}`,
        createUniversalVerificationPrompt(input, reconstruction),
    ].join("\n");
}

function unwrapVerification(value: Record<string, unknown>): Record<string, unknown> {
    const nested = value.verification;
    if (nested && !Array.isArray(nested) && typeof nested === "object") return nested as Record<string, unknown>;
    return value;
}

function validateEnvelope(value: Record<string, unknown>): VerificationEnvelope {
    if (!value || !["verified", "repaired", "rejected"].includes(String(value.status))) throw new Error("二次校验返回了无效状态");
    const confidence = Number(value.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("二次校验置信度无效");
    if (!Array.isArray(value.issues) || value.issues.some((issue) => typeof issue !== "string")) throw new Error("二次校验问题列表无效");
    if (value.status === "repaired" && (!value.reconstruction || typeof value.reconstruction !== "object" || Array.isArray(value.reconstruction))) {
        throw new Error("二次校验声称已修复，但没有返回完整重建结果");
    }
    return value as unknown as VerificationEnvelope;
}
