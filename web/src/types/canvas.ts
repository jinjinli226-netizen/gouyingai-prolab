import type { ViralVideoAnalysis, ViralVideoPromptPlan } from "@/lib/canvas/viral-video-remake-workflow";
import type { ViralBatchRecipe, ViralObjectFingerprint, ViralRemakeTemplate, ViralReplacementBinding } from "@/lib/canvas/viral-video-domain";
import type { CanvasJobStatus } from "@/types/canvas-job";
import type { ViralWorkflowMachineState } from "@/lib/canvas/viral-video-state-machine";
import type {
    UniversalBatchSummary,
    UniversalEntityBinding,
    UniversalRemakeTemplate,
    UniversalReplacementEntity,
    UniversalSourceReconstruction,
    UniversalVariableSlot,
} from "@/lib/universal-viral-remake";

export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
    Group = "group",
}

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";
export type CanvasVisualStage = "inputs" | "white_model" | "direction" | "segment_1" | "segment_2" | "assembly";
export type CanvasVisualRole = "input" | "ai" | "review" | "asset" | "segment" | "output" | "guard";

export type EcommerceVideoCategory = "hard-ad" | "visual-seeding" | "story" | "pain-comparison" | "remix-explainer";
export type EcommerceStoryMode = "single" | "mini-series" | "series";
export type EcommerceStoryVisualStyle = "live-action" | "animated";
export type EcommerceStoryPlay = "auto" | "comeback" | "misunderstanding" | "workplace" | "family" | "mystery" | "comedy";
export type EcommerceProductPlacement = "auto" | "solution" | "gift" | "evidence" | "keepsake" | "conflict";

export type ViralVideoRemakePhase = "idle" | "recognizing" | "requirements_ready" | "templating" | "template_ready" | "compiling" | "ready_to_submit" | "running" | "partially_completed" | "completed" | "paused" | "failed";

export type ViralVideoReplacementAsset = {
    id: string;
    name: string;
    content: string;
    storageKey?: string;
    mimeType: string;
    naturalWidth?: number;
    naturalHeight?: number;
    bytes?: number;
    recognitionStatus?: "idle" | "recognizing" | "recognized" | "needs-confirmation" | "failed";
    recognitionError?: string;
    fingerprint?: ViralObjectFingerprint;
};

export type ViralVideoReplacementElement = {
    id: string;
    name: string;
    category: string;
    description: string;
    shotIndexes: number[];
    source: "detected" | "manual";
    assets: ViralVideoReplacementAsset[];
    fingerprint?: ViralObjectFingerprint;
    replacementFingerprint?: ViralObjectFingerprint;
    binding?: ViralReplacementBinding;
};

export type ViralVideoReplacementLibrary = {
    collapsed: boolean;
    elements: ViralVideoReplacementElement[];
};

export type ViralVideoRemakeWorkflowState = {
    kind: "viral-video-remake";
    sourceVideoNodeId: string;
    replacementNodeId: string;
    batchNodeId: string;
    resultsNodeId: string;
    replacementBrief: string;
    candidateCount: number;
    phase: ViralVideoRemakePhase;
    machine?: ViralWorkflowMachineState;
    batchRecipe?: ViralBatchRecipe;
    remakeTemplate?: ViralRemakeTemplate;
    analysisNodeId?: string;
    promptNodeIds?: string[];
    masterPromptNodeId?: string;
    outputNodeIds?: string[];
    activeBatchId?: string;
};

export type EcommerceWorkflowState = {
    kind: "ecommerce-video";
    category: EcommerceVideoCategory;
    productNodeId: string;
    configNodeId?: string;
    outputNodeId?: string;
    batchCount: number;
    storyMode?: EcommerceStoryMode;
    storyVisualStyle?: EcommerceStoryVisualStyle;
    storyPlay?: EcommerceStoryPlay;
    productPlacement?: EcommerceProductPlacement;
    seriesEpisodes?: number;
};

export type ProjectPosterRatio = "3:4" | "9:16" | "1:1";

export type ProjectPosterWorkflowState = {
    kind: "project-poster";
    referenceNodeId: string;
    projectBrief: string;
    ratio: ProjectPosterRatio;
    batchCount: number;
};

export type JewelryProductImageType = "hero" | "side" | "back" | "upright" | "handheld" | "box" | "wearing" | "gesture" | "sketch";

export type JewelryProductWorkflowState = {
    kind: "jewelry-product-images";
    productNodeId: string;
    heroTemplateNodeId: string;
    wearingReferenceNodeId: string;
    outputTypes: JewelryProductImageType[];
    batchCount: number;
};

export type UniversalRemakeCardRole = "reference" | "bindings" | "template" | "run" | "results";

export type UniversalRemakeReplacementAsset = {
    id: string;
    name: string;
    content: string;
    storageKey?: string;
    mimeType: string;
};

export type UniversalRemakeBetaWorkflowState = {
    kind: "universal-viral-remake-beta";
    phase: "idle" | "analyzing" | "analyzed" | "template-ready" | "submitting" | "running" | "completed" | "failed";
    referenceNodeId: string;
    bindingsNodeId: string;
    templateNodeId: string;
    runNodeId: string;
    resultsNodeId: string;
    candidateCount: number;
    maxInFlight: number;
    maxSegmentDurationSeconds: number;
    sourceReferenceAssetIds: string[];
    reconstruction?: UniversalSourceReconstruction;
    replacements: UniversalReplacementEntity[];
    replacementAssets: UniversalRemakeReplacementAsset[];
    explicitBindings: Array<{ sourceEntityId: string; replacementEntityId: string }>;
    variableSlots: UniversalVariableSlot[];
    template?: UniversalRemakeTemplate;
    summary?: UniversalBatchSummary;
    activeRunId?: string;
    error?: string;
};

export type CanvasWorkflowState = EcommerceWorkflowState | ProjectPosterWorkflowState | JewelryProductWorkflowState | ViralVideoRemakeWorkflowState | UniversalRemakeBetaWorkflowState;

export type CanvasNodeMetadata = {
    content?: string;
    placeholder?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    generationJobId?: string;
    generationRevision?: number;
    generationStatus?: CanvasJobStatus;
    errorDetails?: string;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    size?: string;
    quality?: string;
    count?: number;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    videoInputMode?: "auto" | "first-last" | "lip-sync";
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    isBatchRoot?: boolean;
    batchRootId?: string;
    batchChildIds?: string[];
    batchUsesReferenceImages?: boolean;
    primaryImageId?: string;
    imageBatchExpanded?: boolean;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
    groupId?: string;
    visualStage?: CanvasVisualStage;
    visualRole?: CanvasVisualRole;
    primaryFlowNextIds?: string[];
    viralVideoAnalysis?: ViralVideoAnalysis;
    viralVideoPromptPlan?: ViralVideoPromptPlan;
    viralVideoPlannerPrompt?: string;
    viralVideoPromptRole?: "template";
    viralVideoPlanId?: string;
    viralVideoVariantIndex?: number;
    viralVideoShotIndex?: number;
    viralVideoSegmentIndex?: number;
    viralVideoRunToken?: string;
    viralVideoOutputPlanId?: string;
    viralVideoShotFrames?: ViralVideoShotFrame[];
    viralVideoReplacementLibrary?: ViralVideoReplacementLibrary;
    viralVideoRemakeTemplate?: ViralRemakeTemplate;
    viralVideoBatchRecipe?: ViralBatchRecipe;
    viralVideoResultsBatchId?: string;
    universalRemakeCard?: { role: UniversalRemakeCardRole };
};

export type ViralVideoShotFrame = {
    shotIndex: number;
    content?: string;
    storageKey?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    mimeType?: string;
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeType;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeType;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    mimeType?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool" | "error";
    title?: string;
    text: string;
    meta?: string;
    detail?: unknown;
    references?: CanvasAssistantReference[];
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState =
    | {
          type: "node";
          x: number;
          y: number;
          nodeId: string;
      }
    | {
          type: "connection";
          x: number;
          y: number;
          connectionId: string;
      };
