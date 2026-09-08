export type ViralWorkflowPhase =
    | "idle" | "recognizing" | "requirements_ready" | "templating" | "template_ready"
    | "compiling" | "ready_to_submit" | "running" | "partially_completed" | "completed" | "paused" | "failed";

export type ViralWorkflowMachineState = {
    phase: ViralWorkflowPhase;
    draftRevision: number;
    submittedRevision: number | null;
    sourceRevision: number;
    recognitionRevision: number;
    bindingRevision: number;
    templateRevision: number;
    recipeRevision: number;
    manifestRevision: number;
    preflightRevision: number;
};

export type ViralWorkflowEvent = { type:
    | "START_RECOGNITION" | "RECOGNITION_SUCCEEDED" | "START_TEMPLATING" | "TEMPLATE_SUCCEEDED"
    | "START_COMPILING" | "COMPILE_SUCCEEDED" | "SUBMITTED" | "PARTIAL" | "COMPLETED"
    | "PAUSED" | "RESUMED" | "FAILED" | "REFERENCE_CHANGED" | "UPLOAD_CHANGED" | "COUNT_CHANGED" | "EDIT_DRAFT"
};

export function createViralWorkflowMachine(): ViralWorkflowMachineState {
    return { phase: "idle", draftRevision: 1, submittedRevision: null, sourceRevision: 0, recognitionRevision: 0, bindingRevision: 0, templateRevision: 0, recipeRevision: 0, manifestRevision: 0, preflightRevision: 0 };
}

export function transitionViralWorkflow(state: ViralWorkflowMachineState, event: ViralWorkflowEvent): ViralWorkflowMachineState {
    if (event.type === "REFERENCE_CHANGED") return { ...state, phase: "idle", draftRevision: state.draftRevision + 1, sourceRevision: state.sourceRevision + 1, recognitionRevision: 0, bindingRevision: 0, templateRevision: 0, recipeRevision: 0, manifestRevision: 0, preflightRevision: 0 };
    if (event.type === "UPLOAD_CHANGED") return { ...state, phase: "requirements_ready", draftRevision: state.draftRevision + 1, bindingRevision: 0, templateRevision: 0, recipeRevision: 0, manifestRevision: 0, preflightRevision: 0 };
    if (event.type === "COUNT_CHANGED") return { ...state, phase: "template_ready", draftRevision: state.draftRevision + 1, manifestRevision: 0, preflightRevision: 0 };
    if (event.type === "EDIT_DRAFT") return { ...state, draftRevision: state.draftRevision + 1 };

    const legal: Partial<Record<ViralWorkflowPhase, Partial<Record<ViralWorkflowEvent["type"], ViralWorkflowPhase>>>> = {
        idle: { START_RECOGNITION: "recognizing" },
        recognizing: { RECOGNITION_SUCCEEDED: "requirements_ready", FAILED: "failed" },
        requirements_ready: { START_TEMPLATING: "templating" },
        templating: { TEMPLATE_SUCCEEDED: "template_ready", FAILED: "failed" },
        template_ready: { START_COMPILING: "compiling" },
        compiling: { COMPILE_SUCCEEDED: "ready_to_submit", FAILED: "failed" },
        ready_to_submit: { SUBMITTED: "running" },
        running: { PARTIAL: "partially_completed", COMPLETED: "completed", PAUSED: "paused", FAILED: "failed" },
        partially_completed: { PARTIAL: "partially_completed", COMPLETED: "completed", PAUSED: "paused", FAILED: "failed" },
        paused: { RESUMED: "running", FAILED: "failed" },
        failed: { START_COMPILING: "compiling" },
    };
    const nextPhase = legal[state.phase]?.[event.type];
    if (!nextPhase) throw new Error(`非法状态转换：${state.phase} + ${event.type}`);
    const next = { ...state, phase: nextPhase };
    if (event.type === "RECOGNITION_SUCCEEDED") return { ...next, recognitionRevision: state.sourceRevision || 1, bindingRevision: state.sourceRevision || 1 };
    if (event.type === "TEMPLATE_SUCCEEDED") return { ...next, templateRevision: state.draftRevision, recipeRevision: state.draftRevision };
    if (event.type === "COMPILE_SUCCEEDED") return { ...next, manifestRevision: state.draftRevision, preflightRevision: state.draftRevision };
    if (event.type === "SUBMITTED") return { ...next, submittedRevision: state.draftRevision };
    return next;
}
