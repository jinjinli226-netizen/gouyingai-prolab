import {
    VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
    normalizeViralCandidateCount,
    type ViralBatchRecipe,
    type ViralCandidateManifest,
    type ViralMustKeepEvent,
    type ViralRemakeTemplate,
    type ViralReplacementBinding,
} from "./viral-video-domain";

type CompilerTemplate = Pick<ViralRemakeTemplate, "id" | "bindings" | "events" | "continuityRules">;
type CompilerRecipe = Pick<ViralBatchRecipe, "id" | "candidateCount" | "seed" | "fixedObjectIds" | "variableSlots">;

export function compileViralCandidateManifests(template: CompilerTemplate, recipe: CompilerRecipe): ViralCandidateManifest[] {
    const count = normalizeViralCandidateCount(recipe.candidateCount);
    const slots = recipe.variableSlots.filter((slot) => slot.values.length > 0);
    const fixedIds = new Set(recipe.fixedObjectIds);
    const fixedBindings = template.bindings.filter((binding) => binding.status === "bound" && (!fixedIds.size || fixedIds.has(binding.sourceObjectId)));
    return Array.from({ length: count }, (_, index) => {
        const slotSelections = selectCombination(slots, index);
        const seed = Math.floor(recipe.seed) + index;
        return {
            schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
            id: `${template.id}-candidate-${String(index + 1).padStart(4, "0")}`,
            index,
            templateId: template.id,
            seed,
            slotSelections,
            fixedBindings: fixedBindings.map(cloneBinding),
            prompt: compileCandidatePrompt(template, slotSelections, fixedBindings, seed),
            status: "compiled",
        };
    });
}

function selectCombination(slots: CompilerRecipe["variableSlots"], index: number): Record<string, string> {
    let stride = 1;
    const selections: Record<string, string> = {};
    slots.forEach((slot) => {
        const valueIndex = Math.floor(index / stride) % slot.values.length;
        selections[slot.id] = slot.values[valueIndex];
        stride *= slot.values.length;
    });
    return selections;
}

function compileCandidatePrompt(
    template: CompilerTemplate,
    selections: Record<string, string>,
    bindings: ViralReplacementBinding[],
    seed: number,
): string {
    const events = template.events.map(formatImmutableEvent).join("\n");
    const bindingLines = bindings.map((binding) => `${binding.sourceObjectId}→${binding.replacementObjectId}`).join("；") || "无替换绑定";
    const variables = Object.entries(selections).map(([slotId, value]) => `${slotId}=${value}`).join("；") || "使用母版默认元素";
    return [
        `执行完整复刻母版 ${template.id}，候选种子 ${seed}。`,
        `不可变关键事件：\n${events}`,
        `不可变对象绑定：${bindingLines}`,
        `本候选允许变化的元素：${variables}`,
        `全片连续性：${template.continuityRules.join("；")}`,
        "所有 P0 事件必须按原顺序完整出现一次；只允许改变明确列出的变量，不得改变镜头功能、因果链、商品身份或已锁定对象。",
    ].join("\n\n");
}

function formatImmutableEvent(event: Pick<ViralMustKeepEvent, "id" | "priority" | "description">): string {
    return `${event.priority} ${event.id}：${event.description}`;
}

function cloneBinding(binding: ViralReplacementBinding): ViralReplacementBinding {
    return { ...binding, affectedEventIds: [...(binding.affectedEventIds || [])] };
}
