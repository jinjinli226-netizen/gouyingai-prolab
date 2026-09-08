import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent as ReactChangeEvent, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bot, Home, ImageIcon, Images, List, Menu, Music2, Plus, Redo2, Settings2, Trash2, Undo2, Upload, Video } from "lucide-react";
import { saveAs } from "file-saver";

import { requestEdit, requestGeneration, requestImageQuestion, type AiTextContentPart } from "@/services/api/image";
import { requestAudioGeneration, storeGeneratedAudio } from "@/services/api/audio";
import { requestVideoGeneration, storeGeneratedVideo } from "@/services/api/video";
import { resolveCanvasArtifactUrl, uploadCanvasArtifact } from "@/services/api/canvas-artifacts";
import { canvasJobReference, createCanvasJob, listCanvasJobs, resolveCanvasJobModelBinding, retryCanvasJob } from "@/services/api/canvas-jobs";
import { cancelViralBatch, createViralBatch, listViralBatches, pauseViralBatch, resumeViralBatch, retryFailedViralBatch } from "@/services/api/viral-batches";
import { isGatewayConfigured } from "@/services/gateway-admin";
import { defaultConfig, gatewayModelCatalogEntries, gatewayModelCatalogEntry, modelOptionName, normalizeRequestedModelOption, type AiConfig, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { imageToDataUrl, resolveImageUrl, uploadImage, type UploadedImage } from "@/services/image-storage";
import { mediaToDataUrl, resolveMediaUrl, uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { nanoid } from "nanoid";
import { getDataUrlByteSize, readImageMeta } from "@/lib/image-utils";
import { captureVideoFrame } from "@/lib/video-frame";
import { isOmniV2VModel, isOmniVideoModel } from "@/lib/omni-video";
import { isSeedanceVideoConfig } from "@/lib/seedance-video";
import { canvasThemes, type CanvasBackgroundMode } from "@/lib/canvas-theme";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { useAssetStore } from "@/stores/use-asset-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { cropDataUrl, splitDataUrl, upscaleDataUrl } from "@/lib/canvas/canvas-image-data";
import { fitNodeSize, nodeSizeFromRatio } from "@/lib/canvas/canvas-node-size";
import { App, Button, Dropdown, Modal } from "antd";
import { NODE_DEFAULT_SIZE, getNodeSpec } from "@/constant/canvas";
import { ActiveConnectionPath, ConnectionPath } from "@/components/canvas/canvas-connections";
import { CanvasConfigComposer } from "@/components/canvas/canvas-config-composer";
import { CanvasConfigNodePanel } from "@/components/canvas/canvas-config-node-panel";
import { ViralVideoAnalysisNodeContent } from "@/components/canvas/viral-video-analysis-node-content";
import { ViralVideoReplacementLibraryNodeContent } from "@/components/canvas/viral-video-replacement-library-node-content";
import { ViralVideoBatchNodeContent } from "@/components/canvas/viral-video-batch-node-content";
import { ViralVideoResultsNodeContent } from "@/components/canvas/viral-video-results-node-content";
import { ViralVideoTemplateNodeContent } from "@/components/canvas/viral-video-template-node-content";
import { CANVAS_AGENT_PANEL_MOTION_MS, CanvasAssistantPanel } from "@/components/canvas/canvas-assistant-panel";
import { CanvasNodeContextMenu } from "@/components/canvas/canvas-context-menu";
import { CanvasNodeAngleDialog, type CanvasImageAngleParams } from "@/components/canvas/canvas-node-angle-dialog";
import { CanvasNodeCropDialog, type CanvasImageCropRect } from "@/components/canvas/canvas-node-crop-dialog";
import { CanvasNodeMaskEditDialog, type CanvasImageMaskEditPayload } from "@/components/canvas/canvas-node-mask-edit-dialog";
import { CanvasNodeSplitDialog, type CanvasImageSplitParams } from "@/components/canvas/canvas-node-split-dialog";
import { CanvasNodeUpscaleDialog, type CanvasImageUpscaleParams } from "@/components/canvas/canvas-node-upscale-dialog";
import { buildNodeGenerationContext, buildNodeGenerationInputs, buildNodeResponseMessages, hydrateNodeGenerationContext, type NodeGenerationInput } from "@/components/canvas/canvas-node-generation";
import { CanvasNodeHoverToolbar, CanvasNodeInfoModal } from "@/components/canvas/canvas-node-hover-toolbar";
import { InfiniteCanvas } from "@/components/canvas/infinite-canvas";
import { Minimap } from "@/components/canvas/canvas-mini-map";
import { CanvasNode } from "@/components/canvas/canvas-node";
import { CanvasNodePromptPanel, type CanvasNodeGenerationMode } from "@/components/canvas/canvas-node-prompt-panel";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { EcommerceCanvasBar } from "@/components/canvas/ecommerce-canvas-bar";
import { ProjectPosterCanvasBar } from "@/components/canvas/project-poster-canvas-bar";
import { JewelryProductCanvasBar } from "@/components/canvas/jewelry-product-canvas-bar";
import { ViralVideoRemakeCanvasBar } from "@/components/canvas/viral-video-remake-canvas-bar";
import { UniversalRemakeCanvasBar } from "@/components/canvas/universal-remake-canvas-bar";
import { UniversalRemakeAnalysisContent } from "@/components/canvas/universal-remake-analysis-content";
import { UniversalRemakeBindingsContent } from "@/components/canvas/universal-remake-bindings-content";
import { UniversalRemakeTemplateContent } from "@/components/canvas/universal-remake-template-content";
import { UniversalRemakeRunContent } from "@/components/canvas/universal-remake-run-content";
import { UniversalRemakeResultsContent } from "@/components/canvas/universal-remake-results-content";
import { AssetPickerModal, type InsertAssetPayload } from "@/components/canvas/asset-picker-modal";
import { CanvasZoomControls } from "@/components/canvas/canvas-zoom-controls";
import { CanvasLocalAgentPanel, type ExternalCanvasRunCancel, type ExternalCanvasRunStart } from "@/components/canvas/canvas-local-agent-panel";
import { useCanvasAgentStore } from "@/stores/canvas/use-canvas-agent-store";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useViralBatchStore } from "@/stores/canvas/use-viral-batch-store";
import { applyCanvasAgentOps, type CanvasAgentOp, type CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { prepareExternalCanvasRun, resolveExternalRunOutput } from "@/lib/canvas/canvas-external-runs";
import { buildCanvasResourceReferences, buildNodeMentionReferences } from "@/lib/canvas/canvas-resource-references";
import { selectVisibleCanvasConnections } from "@/lib/canvas/canvas-visual-semantics";
import { reconcileCanvasJobs, resetInterruptedCanvasGeneration } from "@/lib/canvas/canvas-job-reconciliation";
import { resolveCanvasImageContent } from "@/lib/canvas/canvas-image-hydration";
import { reversePromptPreset, reversePromptReferenceLabel } from "@/lib/canvas/canvas-reverse-prompt";
import {
    buildEcommerceCharacterReferencePrompt,
    buildEcommerceStoryPlannerPrompt,
    buildEcommerceVideoPlannerPrompt,
    buildEcommerceVideoPrompt,
    formatEcommerceStoryPlan,
    formatEcommerceVideoPlan,
    getEcommerceOutputCount,
    getEcommerceWorkflowDefinition,
    getEcommerceStoryEpisodeCount,
    getEcommerceStoryTaskDetails,
    parseEcommerceStoryPlan,
    parseEcommerceVideoPlan,
    type EcommerceStoryPlan,
    type EcommerceVideoPlan,
} from "@/lib/canvas/ecommerce-workflows";
import {
    buildProjectPosterGenerationPrompt,
    buildProjectPosterPlannerPrompt,
    formatProjectPosterPlannerRecord,
    formatProjectPosterVisualPromptRecord,
    getProjectPosterCreativeDirection,
    parseProjectPosterPlan,
    type ProjectPosterPlan,
} from "@/lib/canvas/project-poster-workflows";
import { buildJewelryProductPrompt, jewelryProductImageOptions } from "@/lib/canvas/jewelry-product-workflows";
import { resolveAutoDlH3CanvasVideoConfig } from "@/lib/canvas/autodl-h3-video-routing";
import {
    buildViralVideoAnalysisPrompt,
    buildViralVideoAnalysisFrameTimes,
    buildViralVideoAnalysisRepairPrompt,
    buildViralVideoRemakeActivation,
    buildViralVideoRemakeProject,
    buildViralVideoPromptPlannerPrompt,
    formatViralVideoPromptPlan,
    findViralVideoAnalysisQualityIssues,
    parseViralVideoAnalysis,
    parseViralVideoPromptPlan,
    viralVideoAnalysisStages,
    type ViralVideoAnalysis,
    type ViralVideoPromptPlan,
} from "@/lib/canvas/viral-video-remake-workflow";
import { buildViralVideoMasterPrompt, buildViralVideoSingleGenerations, viralVideoModelMaxDurationSeconds } from "@/lib/canvas/viral-video-generation";
import { planViralDurationExecution } from "@/lib/canvas/viral-video-duration";
import { createViralBatchRecipe, normalizeViralCandidateCount, type ViralRemakeTemplate } from "@/lib/canvas/viral-video-domain";
import { compileViralCandidateManifests } from "@/lib/canvas/viral-video-batch-compiler";
import { createViralBatchIdempotencyKey, estimateViralBatchCost } from "@/lib/canvas/viral-video-cost";
import { createViralWorkflowMachine, transitionViralWorkflow, type ViralWorkflowEvent } from "@/lib/canvas/viral-video-state-machine";
import {
    applyViralVideoUploadRecognition,
    buildViralVideoUploadRecognitionPrompt,
    describeViralVideoUploadFingerprint,
    markViralVideoUploadRecognitionFailed,
    parseViralVideoUploadRecognition,
    viralObjectKindLabel,
} from "@/lib/canvas/viral-video-upload-recognition";
import { hydrateViralVideoShotFrames } from "@/lib/canvas/viral-video-analysis-node";
import { buildViralRemakeTemplate, buildViralVideoTemplateNode, VIRAL_VIDEO_TEMPLATE_NODE_SIZE } from "@/lib/canvas/viral-video-template";
import { attachUniversalRemakeReference, buildUniversalRemakeBetaProject } from "@/lib/universal-viral-remake/canvas-adapter";
import { buildUniversalSourceAnchorTimes, createUniversalStoryboard } from "@/lib/universal-viral-remake/storyboard";
import {
    compileUniversalRemakeCandidates,
    compileVerifiedUniversalRemake,
    createUniversalDirectorPromptRepairRequest,
    createUniversalDirectorPromptRequest,
    parseUniversalDirectorPromptPlan,
    remapUniversalExplicitBindings,
    reconstructUniversalSource,
    summarizeUniversalRemakeBatch,
    verifyUniversalSourceReconstruction,
    withUniversalSourceVisualAnchors,
    type UniversalReplacementEntity,
} from "@/lib/universal-viral-remake";
import { cancelUniversalRemakeRun, createUniversalRemakeRun, getUniversalRemakeRun, listUniversalRemakeRuns, pauseUniversalRemakeRun, resumeUniversalRemakeRun, retryUniversalRemakeComposition, type UniversalRemakeRun } from "@/services/api/universal-remake-runs";
import {
    addViralVideoReplacementAssets,
    buildViralVideoReplacementManifest,
    confirmViralVideoReplacementElement,
    createManualViralVideoReplacementElement,
    listViralVideoReplacementAssets,
    mergeViralVideoReplacementLibrary,
    refreshViralVideoReplacementBindings,
} from "@/lib/canvas/viral-video-replacement-library";
import {
    CanvasNodeType,
    type CanvasAssistantImage,
    type CanvasAssistantSession,
    type CanvasConnection,
    type CanvasImageGenerationType,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type CanvasWorkflowState,
    type ConnectionHandle,
    type ContextMenuState,
    type Position,
    type SelectionBox,
    type ViralVideoReplacementAsset,
    type ViralVideoReplacementLibrary,
    type ViralVideoShotFrame,
    type ViewportTransform,
} from "@/types/canvas";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio } from "@/types/media";

type CanvasClipboard = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
};

type PendingConnectionCreate = {
    connection: ConnectionHandle;
    position: Position;
};

type ConnectionDropTarget = {
    nodeId: string | null;
    isNearNode: boolean;
};

type CanvasHistoryEntry = Pick<CanvasClipboard, "nodes" | "connections"> & {
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
};

type CanvasGenerationRequest = {
    targetNodeId: string;
    originNodeId: string;
    runningNodeId: string;
    controller: AbortController;
};

type ViralVideoAnalysisRun = {
    token: string;
    requestId: string;
    projectId: string;
    sourceNodeId: string;
    sourceContent: string;
    sourceStorageKey?: string;
    fallbackPhase: "idle" | "requirements_ready";
    controller: AbortController;
    stageTimer: ReturnType<typeof setInterval> | null;
    committed: boolean;
};

type ViralVideoPromptRun = {
    token: string;
    projectId: string;
    sourceVideoNodeId: string;
    sourceContent: string;
    sourceStorageKey?: string;
    replacementNodeId: string;
    replacementSnapshotJson: string;
    analysisNodeId: string;
    analysisJson: string;
    replacementBrief: string;
    planCount: number;
    controllers: Map<string, AbortController>;
    committed: boolean;
};

type ViralVideoGenerationRun = {
    token: string;
    projectId: string;
    sourceVideoNodeId: string;
    sourceContent: string;
    sourceStorageKey?: string;
    replacementNodeId: string;
    replacementSnapshotJson: string;
    promptNodeIdsJson: string;
    promptSnapshotJson: string;
    planIdsJson: string;
    outputNodeIds: string[];
    controllers: Map<string, AbortController>;
};

type ViralVideoLaunch = Omit<ViralVideoGenerationRun, "token" | "outputNodeIds" | "controllers"> & {
    token: string;
};

const VIDEO_NODE_MAX_WIDTH = 420;
const VIDEO_NODE_MAX_HEIGHT = 420;
const CONNECTION_HANDLE_HIT_RADIUS = 40;
const CONNECTION_NODE_HIT_PADDING = 32;
const NODE_STATUS_IDLE = "idle" as const;
const NODE_STATUS_LOADING = "loading" as const;
const NODE_STATUS_SUCCESS = "success" as const;
const NODE_STATUS_ERROR = "error" as const;

function matchesViralAnalysisSource(node: CanvasNodeData | undefined, run: ViralVideoAnalysisRun) {
    return node?.id === run.sourceNodeId && node.metadata?.content === run.sourceContent && (node.metadata?.storageKey || "") === (run.sourceStorageKey || "");
}

function matchesViralPromptNode(node: CanvasNodeData | undefined, content: string, storageKey?: string) {
    return (node?.metadata?.content || "") === content && (node?.metadata?.storageKey || "") === (storageKey || "");
}

function viralVideoReplacementSnapshot(node: CanvasNodeData | undefined) {
    return JSON.stringify(node?.metadata?.viralVideoReplacementLibrary || { collapsed: false, elements: [] });
}

function createCanvasNode(type: CanvasNodeType, position: Position, metadata?: CanvasNodeMetadata): CanvasNodeData {
    const spec = getNodeSpec(type);
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
        id,
        type,
        title: spec.title,
        position: {
            x: position.x - spec.width / 2,
            y: position.y - spec.height / 2,
        },
        width: spec.width,
        height: spec.height,
        metadata: { ...spec.metadata, ...metadata },
    };
}

export default function CanvasPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <CanvasRefreshShell />;

    return <InfiniteCanvasPage />;
}

function CanvasRefreshShell() {
    return (
        <main className="relative h-full min-h-0 overflow-hidden bg-background text-foreground">
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                }}
            />

            <div className="absolute bottom-5 left-1/2 z-50 flex h-14 -translate-x-1/2 items-center gap-1 rounded-xl border px-2 shadow-lg backdrop-blur" style={{ background: "var(--background)", borderColor: "var(--border)" }} aria-hidden="true">
                {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="size-8 rounded-md bg-current opacity-10" />
                ))}
            </div>

            <div className="absolute bottom-24 left-6 z-50 h-40 w-[240px] rounded-lg border shadow-2xl backdrop-blur-sm" style={{ background: "var(--background)", borderColor: "var(--border)" }} aria-hidden="true">
                <div className="absolute left-7 top-7 h-5 w-12 rounded-sm bg-current opacity-10" />
                <div className="absolute left-28 top-16 h-6 w-16 rounded-sm bg-current opacity-10" />
                <div className="absolute bottom-7 left-16 h-8 w-20 rounded-sm bg-current opacity-10" />
                <div className="absolute inset-5 rounded border border-current opacity-15" />
            </div>

            <div className="absolute bottom-5 left-5 z-50 flex h-14 w-[260px] items-center gap-2 rounded-xl border px-2 shadow-lg backdrop-blur" style={{ background: "var(--background)", borderColor: "var(--border)" }} aria-hidden="true">
                <div className="size-8 rounded-md bg-current opacity-10" />
                <div className="size-8 rounded-md bg-current opacity-10" />
                <div className="h-1 flex-1 rounded-full bg-current opacity-10" />
                <div className="h-4 w-10 rounded bg-current opacity-10" />
                <div className="size-8 rounded-md bg-current opacity-10" />
            </div>
        </main>
    );
}

function ConnectionCreateMenu({
    pending,
    onCreate,
    onClose,
}: {
    pending: PendingConnectionCreate;
    onCreate: (type: CanvasNodeType.Image | CanvasNodeType.Text | CanvasNodeType.Config | CanvasNodeType.Video | CanvasNodeType.Audio) => void;
    onClose: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return (
        <div
            className="absolute z-[120] w-[300px] rounded-[18px] border p-3 shadow-2xl backdrop-blur"
            data-connection-create-menu
            style={{ left: pending.position.x, top: pending.position.y, background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-medium" style={{ color: theme.node.muted }}>
                    引用该节点生成
                </span>
                <button type="button" className="grid size-7 place-items-center rounded-lg text-base opacity-55 transition hover:bg-white/10 hover:opacity-100" onClick={onClose} aria-label="关闭">
                    ×
                </button>
            </div>
            <div className="grid gap-1">
                <ConnectionCreateOption theme={theme} icon={<List className="size-5" />} title="文本生成" description="脚本、广告词、品牌文案" onClick={() => onCreate(CanvasNodeType.Text)} />
                <ConnectionCreateOption theme={theme} icon={<ImageIcon className="size-5" />} title="图片生成" onClick={() => onCreate(CanvasNodeType.Image)} />
                <ConnectionCreateOption theme={theme} icon={<Video className="size-5" />} title="视频生成" onClick={() => onCreate(CanvasNodeType.Video)} />
                <ConnectionCreateOption theme={theme} icon={<Music2 className="size-5" />} title="音频参考" onClick={() => onCreate(CanvasNodeType.Audio)} />
                <ConnectionCreateOption theme={theme} icon={<Settings2 className="size-5" />} title="配置节点" description="模型、尺寸、数量和输入顺序" onClick={() => onCreate(CanvasNodeType.Config)} />
            </div>
        </div>
    );
}

function ConnectionCreateOption({ theme, icon, title, description, onClick }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; icon: React.ReactNode; title: string; description?: string; onClick?: () => void }) {
    return (
        <button
            type="button"
            className="flex h-16 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-left transition"
            style={{ color: theme.node.text }}
            onClick={onClick}
            onMouseEnter={(event) => (event.currentTarget.style.background = theme.node.fill)}
            onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
        >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: theme.node.fill, color: theme.node.muted }}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-base font-semibold leading-5">{title}</span>
                {description ? (
                    <span className="mt-1 block truncate text-sm" style={{ color: theme.node.muted }}>
                        {description}
                    </span>
                ) : null}
            </span>
        </button>
    );
}

function InfiniteCanvasPage() {
    const { message, modal } = App.useApp();
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectId = params.id || "";
    const localAgentConnected = useCanvasAgentStore((state) => state.connected);
    const localAgentActivity = useCanvasAgentStore((state) => state.activity);
    const localAgentEnabled = useCanvasAgentStore((state) => state.enabled);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetRef = useRef<{
        nodeId?: string;
        position?: Position;
        imageOnly?: boolean;
        videoOnly?: boolean;
        viralReplacement?: { nodeId: string; elementId: string };
    } | null>(null);
    const clipboardRef = useRef<CanvasClipboard | null>(null);
    const historyRef = useRef<{ past: CanvasHistoryEntry[]; future: CanvasHistoryEntry[] }>({ past: [], future: [] });
    const lastHistoryRef = useRef<CanvasHistoryEntry | null>(null);
    const historyCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingHistoryRef = useRef(false);
    const historyPausedRef = useRef(false);
    const didInitialCenterRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const nodeDraggingRef = useRef(false);
    const dragRef = useRef<{
        isDraggingNode: boolean;
        hasMoved: boolean;
        startX: number;
        startY: number;
        initialSelectedNodes: { id: string; x: number; y: number }[];
    }>({
        isDraggingNode: false,
        hasMoved: false,
        startX: 0,
        startY: 0,
        initialSelectedNodes: [],
    });

    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const cleanupAssetImages = useAssetStore((state) => state.cleanupImages);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const createProject = useCanvasStore((state) => state.createProject);
    const importProject = useCanvasStore((state) => state.importProject);
    const openProject = useCanvasStore((state) => state.openProject);
    const updateProject = useCanvasStore((state) => state.updateProject);
    const renameProject = useCanvasStore((state) => state.renameProject);
    const deleteProjects = useCanvasStore((state) => state.deleteProjects);
    const currentProject = useCanvasStore((state) => state.projects.find((project) => project.id === projectId));
    const viralBatches = useViralBatchStore((state) => state.batches);
    const upsertViralBatch = useViralBatchStore((state) => state.upsertBatch);
    const replaceCanvasViralBatches = useViralBatchStore((state) => state.replaceCanvasBatches);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
    const [connections, setConnections] = useState<CanvasConnection[]>([]);
    const [chatSessions, setChatSessions] = useState<CanvasAssistantSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, k: 1 });
    const [size, setSize] = useState({ width: 1200, height: 720 });
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [connectingParams, setConnectingParams] = useState<ConnectionHandle | null>(null);
    const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<string | null>(null);
    const [pendingConnectionCreate, setPendingConnectionCreate] = useState<PendingConnectionCreate | null>(null);
    const [mouseWorld, setMouseWorld] = useState<Position>({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
    const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
    const [backgroundMode, setBackgroundMode] = useState<CanvasBackgroundMode>("lines");
    const [showImageInfo, setShowImageInfo] = useState(false);
    const [showAllConnections, setShowAllConnections] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [projectLoaded, setProjectLoaded] = useState(false);
    const [toolbarNodeId, setToolbarNodeId] = useState<string | null>(null);
    const [nodeImageSettingsOpen, setNodeImageSettingsOpen] = useState(false);
    const [dialogNodeId, setDialogNodeId] = useState<string | null>(null);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editRequestNonce, setEditRequestNonce] = useState(0);
    const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
    const [cropNodeId, setCropNodeId] = useState<string | null>(null);
    const [maskEditNodeId, setMaskEditNodeId] = useState<string | null>(null);
    const [splitNodeId, setSplitNodeId] = useState<string | null>(null);
    const [upscaleNodeId, setUpscaleNodeId] = useState<string | null>(null);
    const [superResolveNodeId, setSuperResolveNodeId] = useState<string | null>(null);
    const [angleNodeId, setAngleNodeId] = useState<string | null>(null);
    const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
    const [assistantCollapsed, setAssistantCollapsed] = useState(true);
    const [assistantMounted, setAssistantMounted] = useState(false);
    const [assistantClosing, setAssistantClosing] = useState(false);
    const [agentUndoSnapshot, setAgentUndoSnapshot] = useState<CanvasAgentSnapshot | null>(null);
    const codexAutoConnect = ["new", "recent", "choose"].includes(searchParams.get("mode") || "");
    const codexCompactAgent = codexAutoConnect && searchParams.has("agentUrl");
    const [titleEditing, setTitleEditing] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [collapsingBatchIds, setCollapsingBatchIds] = useState<Set<string>>(new Set());
    const [openingBatchIds, setOpeningBatchIds] = useState<Set<string>>(new Set());
    const [isNodeDragging, setIsNodeDragging] = useState(false);
    const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
    const [ecommerceBatch, setEcommerceBatch] = useState({ running: false, completed: 0, total: 0 });
    const [posterBatch, setPosterBatch] = useState({ running: false, completed: 0, total: 0 });
    const [jewelryBatch, setJewelryBatch] = useState({ running: false, completed: 0, total: 0 });
    const [viralRemakeBatch, setViralRemakeBatch] = useState({ running: false, stageLabel: "", completed: 0, total: 0 });
    const [universalRemakeBusy, setUniversalRemakeBusy] = useState(false);
    const [universalRemakeRun, setUniversalRemakeRun] = useState<UniversalRemakeRun | undefined>();

    const nodesRef = useRef(nodes);
    const connectionsRef = useRef(connections);
    const selectedNodeIdsRef = useRef(selectedNodeIds);
    const viewportRef = useRef(viewport);
    const generateNodeRef = useRef<((nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => Promise<void>) | null>(null);
    const connectingParamsRef = useRef(connectingParams);
    const connectionTargetNodeIdRef = useRef(connectionTargetNodeId);
    const selectionBoxRef = useRef(selectionBox);
    const agentCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingConnectionCreateRef = useRef(pendingConnectionCreate);
    const generationRequestsRef = useRef(new Map<string, CanvasGenerationRequest>());
    const viralAnalysisStageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const viralAnalysisRunRef = useRef<ViralVideoAnalysisRun | null>(null);
    const viralPromptRunRef = useRef<ViralVideoPromptRun | null>(null);
    const viralVideoRunRef = useRef<ViralVideoGenerationRun | null>(null);
    const viralVideoLaunchRef = useRef<ViralVideoLaunch | null>(null);
    const viralAutoGenerateAfterPlanningRef = useRef<string | null>(null);
    const activeProjectIdRef = useRef(projectId);
    const loadedProjectIdRef = useRef<string | null>(null);
    const projectLoadTokenRef = useRef(0);
    const canvasMountedRef = useRef(false);
    const externalRunStartedRef = useRef("");
    const stalledUniversalValidationRetryRef = useRef("");

    const createHistoryEntry = useCallback(
        (): CanvasHistoryEntry => ({
            nodes: nodesRef.current,
            connections: connectionsRef.current,
            chatSessions,
            activeChatId,
            backgroundMode,
            showImageInfo,
        }),
        [activeChatId, backgroundMode, chatSessions, showImageInfo],
    );

    const cleanupCanvasFiles = useCallback(
        (extra?: unknown) => {
            cleanupAssetImages({ extra, history: historyRef.current, lastHistory: lastHistoryRef.current });
        },
        [cleanupAssetImages],
    );

    const startGenerationRequest = useCallback((targetNodeId: string, originNodeId: string, runningId = originNodeId, controller = new AbortController()) => {
        const previous = generationRequestsRef.current.get(targetNodeId);
        if (previous?.controller !== controller) previous?.controller.abort();
        generationRequestsRef.current.set(targetNodeId, { targetNodeId, originNodeId, runningNodeId: runningId, controller });
        return controller;
    }, []);

    const finishGenerationRequest = useCallback((targetNodeId: string, controller: AbortController) => {
        const request = generationRequestsRef.current.get(targetNodeId);
        if (request?.controller === controller) generationRequestsRef.current.delete(targetNodeId);
    }, []);

    const clearViralAnalysisRunTimer = useCallback((run: ViralVideoAnalysisRun) => {
        if (!run.stageTimer) return;
        clearInterval(run.stageTimer);
        if (viralAnalysisStageTimerRef.current === run.stageTimer) viralAnalysisStageTimerRef.current = null;
        run.stageTimer = null;
    }, []);

    const restoreViralAnalysisRunPhase = useCallback(
        (run: ViralVideoAnalysisRun) => {
            const project = useCanvasStore.getState().projects.find((item) => item.id === run.projectId);
            const workflow = project?.workflow;
            if (!project || !workflow || workflow.kind !== "viral-video-remake" || workflow.phase !== "recognizing" || workflow.sourceVideoNodeId !== run.sourceNodeId) return;
            const sourceNode = (activeProjectIdRef.current === run.projectId ? nodesRef.current : project.nodes).find((node) => node.id === run.sourceNodeId);
            if (!matchesViralAnalysisSource(sourceNode, run)) return;
            updateProject(run.projectId, { workflow: { ...workflow, phase: run.fallbackPhase } });
        },
        [updateProject],
    );

    const invalidateViralAnalysisRun = useCallback(() => {
        const run = viralAnalysisRunRef.current;
        if (!run) return;
        restoreViralAnalysisRunPhase(run);
        if (viralAnalysisRunRef.current?.token === run.token) viralAnalysisRunRef.current = null;
        clearViralAnalysisRunTimer(run);
        run.controller.abort();
        finishGenerationRequest(run.requestId, run.controller);
        if (canvasMountedRef.current && activeProjectIdRef.current === run.projectId) setViralRemakeBatch((state) => ({ ...state, running: false }));
    }, [clearViralAnalysisRunTimer, finishGenerationRequest, restoreViralAnalysisRunPhase]);

    const isViralAnalysisRunCurrent = useCallback((run: ViralVideoAnalysisRun) => {
        if (!canvasMountedRef.current || activeProjectIdRef.current !== run.projectId || viralAnalysisRunRef.current?.token !== run.token) return false;
        const project = useCanvasStore.getState().projects.find((item) => item.id === run.projectId);
        const workflow = project?.workflow;
        if (!workflow || workflow.kind !== "viral-video-remake" || workflow.phase !== "recognizing" || workflow.sourceVideoNodeId !== run.sourceNodeId) return false;
        return matchesViralAnalysisSource(nodesRef.current.find((node) => node.id === run.sourceNodeId), run);
    }, []);

    const restoreViralPromptRunPhase = useCallback(
        (run: ViralVideoPromptRun) => {
            const project = useCanvasStore.getState().projects.find((item) => item.id === run.projectId);
            const workflow = project?.workflow;
            if (!project || !workflow || workflow.kind !== "viral-video-remake" || workflow.phase !== "templating" || workflow.analysisNodeId !== run.analysisNodeId) return;
            updateProject(run.projectId, { workflow: { ...workflow, phase: "requirements_ready" } });
        },
        [updateProject],
    );

    const invalidateViralPromptRun = useCallback(() => {
        const run = viralPromptRunRef.current;
        if (!run) return;
        restoreViralPromptRunPhase(run);
        if (viralPromptRunRef.current?.token === run.token) viralPromptRunRef.current = null;
        run.controllers.forEach((controller, requestId) => {
            controller.abort();
            finishGenerationRequest(requestId, controller);
        });
        run.controllers.clear();
        if (canvasMountedRef.current && activeProjectIdRef.current === run.projectId) setViralRemakeBatch((state) => ({ ...state, running: false }));
    }, [finishGenerationRequest, restoreViralPromptRunPhase]);

    const isViralPromptRunCurrent = useCallback((run: ViralVideoPromptRun) => {
        if (!canvasMountedRef.current || activeProjectIdRef.current !== run.projectId || viralPromptRunRef.current?.token !== run.token) return false;
        const project = useCanvasStore.getState().projects.find((item) => item.id === run.projectId);
        const workflow = project?.workflow;
        if (
            !workflow ||
            workflow.kind !== "viral-video-remake" ||
            workflow.phase !== "templating" ||
            workflow.sourceVideoNodeId !== run.sourceVideoNodeId ||
            workflow.replacementNodeId !== run.replacementNodeId ||
            workflow.analysisNodeId !== run.analysisNodeId ||
            workflow.replacementBrief !== run.replacementBrief
        )
            return false;
        const sourceNode = nodesRef.current.find((node) => node.id === run.sourceVideoNodeId);
        const replacementNode = nodesRef.current.find((node) => node.id === run.replacementNodeId);
        const analysisNode = nodesRef.current.find((node) => node.id === run.analysisNodeId);
        return (
            matchesViralPromptNode(sourceNode, run.sourceContent, run.sourceStorageKey) &&
            viralVideoReplacementSnapshot(replacementNode) === run.replacementSnapshotJson &&
            JSON.stringify(analysisNode?.metadata?.viralVideoAnalysis) === run.analysisJson
        );
    }, []);

    const markViralVideoRunInterrupted = useCallback(
        (run: ViralVideoGenerationRun, errorDetails: string) => {
            const project = useCanvasStore.getState().projects.find((item) => item.id === run.projectId);
            const workflow = project?.workflow;
            if (!project || !workflow || workflow.kind !== "viral-video-remake") return;
            const currentNodes = activeProjectIdRef.current === run.projectId ? nodesRef.current : project.nodes;
            const outputIds = new Set(run.outputNodeIds);
            const nextNodes = currentNodes.map((node) =>
                outputIds.has(node.id) && node.metadata?.status === NODE_STATUS_LOADING
                    ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } }
                    : node,
            );
            const remainingOutputNodeIds = run.outputNodeIds.filter((outputNodeId) => nextNodes.some((node) => node.id === outputNodeId && node.type === CanvasNodeType.Video && node.metadata?.viralVideoRunToken === run.token));
            const ownsCurrentBatch =
                JSON.stringify(workflow.promptNodeIds || []) === run.promptNodeIdsJson &&
                JSON.stringify(workflow.outputNodeIds || []) === JSON.stringify(run.outputNodeIds);
            const nextWorkflow = ownsCurrentBatch && workflow.phase === "running"
                ? { ...workflow, phase: "template_ready" as const, outputNodeIds: remainingOutputNodeIds.length ? remainingOutputNodeIds : undefined }
                : workflow;
            if (canvasMountedRef.current && activeProjectIdRef.current === run.projectId) {
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
            }
            updateProject(run.projectId, { nodes: nextNodes, workflow: nextWorkflow });
        },
        [updateProject],
    );

    const invalidateViralVideoRun = useCallback(
        (errorDetails = "视频生成已取消：上游内容或项目已变化，请重新生成。") => {
            const launch = viralVideoLaunchRef.current;
            if (launch) viralVideoLaunchRef.current = null;
            const run = viralVideoRunRef.current;
            if (!run) {
                if (launch && canvasMountedRef.current && activeProjectIdRef.current === launch.projectId) setViralRemakeBatch((state) => ({ ...state, running: false }));
                return;
            }
            viralVideoRunRef.current = null;
            run.controllers.forEach((controller, requestId) => {
                controller.abort();
                finishGenerationRequest(requestId, controller);
            });
            run.controllers.clear();
            markViralVideoRunInterrupted(run, errorDetails);
            if (canvasMountedRef.current && activeProjectIdRef.current === run.projectId) setViralRemakeBatch((state) => ({ ...state, running: false }));
        },
        [finishGenerationRequest, markViralVideoRunInterrupted],
    );

    const isViralVideoLaunchCurrent = useCallback((launch: ViralVideoLaunch) => {
        if (!canvasMountedRef.current || activeProjectIdRef.current !== launch.projectId || viralVideoLaunchRef.current?.token !== launch.token || viralVideoRunRef.current) return false;
        const project = useCanvasStore.getState().projects.find((item) => item.id === launch.projectId);
        const workflow = project?.workflow;
        if (
            !workflow ||
            workflow.kind !== "viral-video-remake" ||
            workflow.phase !== "template_ready" ||
            workflow.sourceVideoNodeId !== launch.sourceVideoNodeId ||
            workflow.replacementNodeId !== launch.replacementNodeId ||
            JSON.stringify(workflow.promptNodeIds || []) !== launch.promptNodeIdsJson
        )
            return false;
        const sourceNode = nodesRef.current.find((node) => node.id === launch.sourceVideoNodeId);
        const replacementNode = nodesRef.current.find((node) => node.id === launch.replacementNodeId);
        const plans = collectActiveViralVideoPlans(workflow, nodesRef.current);
        return (
            matchesViralPromptNode(sourceNode, launch.sourceContent, launch.sourceStorageKey) &&
            viralVideoReplacementSnapshot(replacementNode) === launch.replacementSnapshotJson &&
            !plans.error &&
            JSON.stringify(plans.plans.map((plan) => plan.planId)) === launch.planIdsJson &&
            buildViralVideoPromptSnapshot(workflow, nodesRef.current) === launch.promptSnapshotJson
        );
    }, []);

    const isViralVideoRunCurrent = useCallback((run: ViralVideoGenerationRun) => {
        if (!canvasMountedRef.current || activeProjectIdRef.current !== run.projectId || viralVideoRunRef.current?.token !== run.token) return false;
        const project = useCanvasStore.getState().projects.find((item) => item.id === run.projectId);
        const workflow = project?.workflow;
        if (
            !workflow ||
            workflow.kind !== "viral-video-remake" ||
            !["running", "partially_completed"].includes(workflow.phase) ||
            workflow.sourceVideoNodeId !== run.sourceVideoNodeId ||
            workflow.replacementNodeId !== run.replacementNodeId ||
            JSON.stringify(workflow.promptNodeIds || []) !== run.promptNodeIdsJson ||
            JSON.stringify(workflow.outputNodeIds || []) !== JSON.stringify(run.outputNodeIds)
        )
            return false;
        const sourceNode = nodesRef.current.find((node) => node.id === run.sourceVideoNodeId);
        const replacementNode = nodesRef.current.find((node) => node.id === run.replacementNodeId);
        const plans = collectActiveViralVideoPlans(workflow, nodesRef.current);
        const ownsAllOutputs = run.outputNodeIds.every((outputNodeId) => {
            const outputNode = nodesRef.current.find((node) => node.id === outputNodeId);
            return outputNode?.type === CanvasNodeType.Video && outputNode.metadata?.viralVideoRunToken === run.token;
        });
        return (
            ownsAllOutputs &&
            matchesViralPromptNode(sourceNode, run.sourceContent, run.sourceStorageKey) &&
            viralVideoReplacementSnapshot(replacementNode) === run.replacementSnapshotJson &&
            !plans.error &&
            JSON.stringify(plans.plans.map((plan) => plan.planId)) === run.planIdsJson &&
            buildViralVideoPromptSnapshot(workflow, nodesRef.current) === run.promptSnapshotJson
        );
    }, []);

    const stopGenerationByRunningId = useCallback((runningId: string) => {
        const affectedNodeIds = new Set<string>();
        generationRequestsRef.current.forEach((request) => {
            if (request.runningNodeId !== runningId) return;
            request.controller.abort();
            generationRequestsRef.current.delete(request.targetNodeId);
            affectedNodeIds.add(request.targetNodeId);
            affectedNodeIds.add(request.originNodeId);
        });
        setRunningNodeId((current) => (current === runningId ? null : current));
        if (!affectedNodeIds.size) return;
        setNodes((prev) => prev.map((node) => (affectedNodeIds.has(node.id) && node.metadata?.status === NODE_STATUS_LOADING ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_IDLE, errorDetails: undefined } } : node)));
    }, []);

    const confirmStopGeneration = useCallback(
        (nodeId: string) => {
            modal.confirm({
                title: "停止生成？",
                content: "当前生成请求会被中断，已经生成完成的内容会保留。",
                okText: "停止",
                cancelText: "继续生成",
                okButtonProps: { danger: true },
                onOk: () => stopGenerationByRunningId(nodeId),
            });
        },
        [modal, stopGenerationByRunningId],
    );

    useEffect(() => {
        if (!hydrated) return;
        const loadToken = ++projectLoadTokenRef.current;
        loadedProjectIdRef.current = null;
        const invalidateLoad = () => {
            if (projectLoadTokenRef.current === loadToken) projectLoadTokenRef.current += 1;
            if (loadedProjectIdRef.current === projectId) loadedProjectIdRef.current = null;
        };
        const isCurrentLoad = () => projectLoadTokenRef.current === loadToken && activeProjectIdRef.current === projectId;
        if (viralAnalysisRunRef.current && viralAnalysisRunRef.current.projectId !== projectId) invalidateViralAnalysisRun();
        if (viralPromptRunRef.current && viralPromptRunRef.current.projectId !== projectId) invalidateViralPromptRun();
        if (viralVideoLaunchRef.current && viralVideoLaunchRef.current.projectId !== projectId) invalidateViralVideoRun();
        if (viralVideoRunRef.current && viralVideoRunRef.current.projectId !== projectId) invalidateViralVideoRun();
        setProjectLoaded(false);
        const project = openProject(projectId);
        if (!project) {
            navigate("/canvas", { replace: true });
            return invalidateLoad;
        }

        const restore = async () => {
            const simplifiedProject = simplifyEcommerceStorySkeleton(project.nodes, project.connections, project.workflow);
            const compactedViralProject = { ...simplifiedProject, workflow: project.workflow, changed: false };
            const restoredNodes = await hydrateCanvasImages(resetInterruptedCanvasGeneration(compactedViralProject.nodes), projectId);
            if (!isCurrentLoad()) return;
            const restoredWorkflow = normalizeInterruptedViralWorkflow(compactedViralProject.workflow, restoredNodes);
            const restoredSessions = await hydrateAssistantImages(project.chatSessions || []);
            if (!isCurrentLoad()) return;
            setNodes(restoredNodes);
            setConnections(compactedViralProject.connections);
            setChatSessions(restoredSessions);
            setActiveChatId(project.activeChatId || null);
            setBackgroundMode(project.backgroundMode);
            setShowImageInfo(project.showImageInfo || false);
            setViewport(project.viewport);
            setEcommerceBatch({ running: false, completed: 0, total: 0 });
            setPosterBatch({ running: false, completed: 0, total: 0 });
            setViralRemakeBatch({ running: false, stageLabel: "", completed: 0, total: 0 });
            historyRef.current = { past: [], future: [] };
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
            lastHistoryRef.current = {
                nodes: restoredNodes,
                connections: compactedViralProject.connections,
                chatSessions: restoredSessions,
                activeChatId: project.activeChatId || null,
                backgroundMode: project.backgroundMode,
                showImageInfo: project.showImageInfo || false,
            };
            setHistoryState({ canUndo: false, canRedo: false });
            loadedProjectIdRef.current = projectId;
            if (compactedViralProject.changed || restoredWorkflow !== project.workflow) {
                updateProject(projectId, { nodes: restoredNodes, connections: compactedViralProject.connections, workflow: restoredWorkflow });
            }
            setProjectLoaded(true);
        };
        void restore();
        return invalidateLoad;
    }, [hydrated, invalidateViralAnalysisRun, invalidateViralPromptRun, invalidateViralVideoRun, navigate, openProject, projectId]);

    useEffect(() => {
        if (!projectLoaded || loadedProjectIdRef.current !== projectId || !isGatewayConfigured) return;
        let disposed = false;
        let refreshing = false;
        const refreshCanvasJobs = async () => {
            if (disposed || refreshing) return;
            refreshing = true;
            try {
                const jobs = await listCanvasJobs({ canvasId: projectId });
                if (!disposed && loadedProjectIdRef.current === projectId) {
                    setNodes((current) => reconcileCanvasJobs(projectId, current, jobs));
                    const project = useCanvasStore.getState().projects.find((item) => item.id === projectId);
                    const workflow = project?.workflow;
                    if (workflow?.kind === "viral-video-remake" && workflow.phase === "running") {
                        const outputJobs = (workflow.outputNodeIds || []).flatMap((nodeId) => {
                            const job = jobs.find((item) => item.targetNodeId === nodeId);
                            return job ? [job] : [];
                        });
                        const completed = outputJobs.filter((job) => ["succeeded", "failed", "cancelled"].includes(job.status)).length;
                        setViralRemakeBatch({ running: false, stageLabel: completed === outputJobs.length && outputJobs.length ? "后台复刻视频已完成" : "后台生成中", completed, total: outputJobs.length });
                        if (outputJobs.length && completed === outputJobs.length) updateProject(projectId, { workflow: { ...workflow, phase: "completed" } });
                    }
                }
            } catch {
                // Gateway may be temporarily offline; the next focus/online/poll event retries.
            } finally {
                refreshing = false;
            }
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") void refreshCanvasJobs();
        };
        void refreshCanvasJobs();
        const timer = window.setInterval(() => void refreshCanvasJobs(), 2_500);
        window.addEventListener("focus", refreshCanvasJobs);
        window.addEventListener("online", refreshCanvasJobs);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            disposed = true;
            window.clearInterval(timer);
            window.removeEventListener("focus", refreshCanvasJobs);
            window.removeEventListener("online", refreshCanvasJobs);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [projectId, projectLoaded]);

    useEffect(() => {
        if (!projectLoaded || loadedProjectIdRef.current !== projectId || !["new", "recent", "choose"].includes(searchParams.get("mode") || "")) return;
        if (!searchParams.has("agentUrl")) openAgent();
    }, [projectId, projectLoaded, searchParams]);

    useEffect(() => {
        if (!projectLoaded || loadedProjectIdRef.current !== projectId || applyingHistoryRef.current || historyPausedRef.current) return;
        const next = createHistoryEntry();
        const previous = lastHistoryRef.current;
        if (
            previous?.nodes === next.nodes &&
            previous.connections === next.connections &&
            previous.chatSessions === next.chatSessions &&
            previous.activeChatId === next.activeChatId &&
            previous.backgroundMode === next.backgroundMode &&
            previous.showImageInfo === next.showImageInfo
        )
            return;

        if (historyCommitTimerRef.current) clearTimeout(historyCommitTimerRef.current);
        historyCommitTimerRef.current = setTimeout(() => {
            if (loadedProjectIdRef.current !== projectId) {
                historyCommitTimerRef.current = null;
                return;
            }
            const current = createHistoryEntry();
            const last = lastHistoryRef.current;
            if (!last) return;
            historyRef.current.past = [...historyRef.current.past.slice(-49), last];
            historyRef.current.future = [];
            setHistoryState({ canUndo: true, canRedo: false });
            lastHistoryRef.current = current;
            historyCommitTimerRef.current = null;
        }, 180);

        return () => {
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
        };
    }, [activeChatId, backgroundMode, chatSessions, connections, createHistoryEntry, nodes, projectId, projectLoaded, showImageInfo]);

    useEffect(() => {
        canvasMountedRef.current = true;
        return () => {
            canvasMountedRef.current = false;
            invalidateViralAnalysisRun();
            invalidateViralPromptRun();
            invalidateViralVideoRun();
            if (agentCloseTimerRef.current) clearTimeout(agentCloseTimerRef.current);
            if (viralAnalysisStageTimerRef.current) {
                clearInterval(viralAnalysisStageTimerRef.current);
                viralAnalysisStageTimerRef.current = null;
            }
        };
    }, [invalidateViralAnalysisRun, invalidateViralPromptRun, invalidateViralVideoRun]);

    useEffect(() => {
        const run = viralPromptRunRef.current;
        if (run && !isViralPromptRunCurrent(run)) invalidateViralPromptRun();
    }, [currentProject?.workflow, invalidateViralPromptRun, isViralPromptRunCurrent, nodes]);

    useEffect(() => {
        const launch = viralVideoLaunchRef.current;
        if (launch && !isViralVideoLaunchCurrent(launch)) invalidateViralVideoRun();
    }, [currentProject?.workflow, invalidateViralVideoRun, isViralVideoLaunchCurrent, nodes]);

    useEffect(() => {
        const run = viralVideoRunRef.current;
        if (run && !isViralVideoRunCurrent(run)) invalidateViralVideoRun();
    }, [currentProject?.workflow, invalidateViralVideoRun, isViralVideoRunCurrent, nodes]);

    useEffect(() => {
        if (!projectLoaded || loadedProjectIdRef.current !== projectId || historyPausedRef.current) return;
        updateProject(projectId, { nodes, connections, chatSessions, activeChatId, backgroundMode, showImageInfo });
    }, [activeChatId, backgroundMode, chatSessions, connections, nodes, projectId, projectLoaded, showImageInfo, updateProject]);

    useEffect(() => {
        if (!dialogNodeId) setNodeImageSettingsOpen(false);
    }, [dialogNodeId]);

    useEffect(() => {
        if (!projectLoaded || loadedProjectIdRef.current !== projectId) return;
        if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = setTimeout(() => {
            if (loadedProjectIdRef.current !== projectId) {
                viewportSaveTimerRef.current = null;
                return;
            }
            updateProject(projectId, { viewport: viewportRef.current });
            viewportSaveTimerRef.current = null;
        }, 500);
        return () => {
            if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        };
    }, [projectId, projectLoaded, updateProject, viewport]);

    useLayoutEffect(() => {
        activeProjectIdRef.current = projectId;
        nodesRef.current = nodes;
        connectionsRef.current = connections;
        selectedNodeIdsRef.current = selectedNodeIds;
        viewportRef.current = viewport;
        connectingParamsRef.current = connectingParams;
        connectionTargetNodeIdRef.current = connectionTargetNodeId;
        pendingConnectionCreateRef.current = pendingConnectionCreate;
    }, [projectId, nodes, connections, selectedNodeIds, viewport, connectingParams, connectionTargetNodeId, pendingConnectionCreate]);

    useLayoutEffect(() => {
        selectionBoxRef.current = selectionBox;
    }, [selectionBox]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateSize = () => {
            const rect = el.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
            if (!didInitialCenterRef.current) {
                didInitialCenterRef.current = true;
                setViewport({ x: rect.width / 2, y: rect.height / 2, k: 1 });
            }
        };

        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(el);
        return () => resizeObserver.disconnect();
    }, []);

    const screenToCanvas = useCallback((clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const currentViewport = viewportRef.current;
        const localX = clientX - (rect?.left || 0);
        const localY = clientY - (rect?.top || 0);

        return {
            x: (localX - currentViewport.x) / currentViewport.k,
            y: (localY - currentViewport.y) / currentViewport.k,
        };
    }, []);

    const getCanvasCenter = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        return screenToCanvas((rect?.left || 0) + (rect?.width || size.width) / 2, (rect?.top || 0) + (rect?.height || size.height) / 2);
    }, [screenToCanvas, size.height, size.width]);

    const setConnecting = useCallback((next: ConnectionHandle | null) => {
        connectingParamsRef.current = next;
        setConnectingParams(next);
        if (!next) {
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
        }
    }, []);

    const keepNodeToolbar = useCallback(
        (nodeId: string) => {
            if (nodeDraggingRef.current || nodeImageSettingsOpen || !selectedNodeIdsRef.current.has(nodeId)) return;
            setToolbarNodeId(nodeId);
        },
        [nodeImageSettingsOpen],
    );

    const hideNodeToolbar = useCallback(() => {}, []);

    const connectNodes = useCallback(
        (current: ConnectionHandle, targetNodeId: string) => {
            if (current.nodeId === targetNodeId) return;

            const connection = normalizeConnection(current.nodeId, targetNodeId, nodesRef.current, current.handleType);
            if (!connection) {
                message.warning("配置节点之间不能连接");
                return;
            }
            const { fromNodeId, toNodeId } = connection;
            const exists = connectionsRef.current.some((conn) => conn.fromNodeId === fromNodeId && conn.toNodeId === toNodeId);
            if (!exists) {
                setConnections((prev) => [...prev, { id: `conn-${Date.now()}`, fromNodeId, toNodeId }]);
            }
            setContextMenu(null);
        },
        [message],
    );

    const createConnectedNode = useCallback(
        (type: CanvasNodeType.Image | CanvasNodeType.Text | CanvasNodeType.Config | CanvasNodeType.Video | CanvasNodeType.Audio, pending: PendingConnectionCreate) => {
            const sourceNode = nodesRef.current.find((item) => item.id === pending.connection.nodeId);
            const reusedModel = type !== CanvasNodeType.Config && sourceNode?.type === type ? sourceNode.metadata?.model : undefined;
            const metadata =
                type === CanvasNodeType.Config ? { model: effectiveConfig.imageModel, size: effectiveConfig.size, count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count) } : reusedModel ? { model: reusedModel } : undefined;
            const newNode = createCanvasNode(type, pending.position, metadata);
            const connection = normalizeConnection(pending.connection.nodeId, newNode.id, [...nodesRef.current, newNode], pending.connection.handleType);
            if (!connection) {
                message.warning("配置节点之间不能连接");
                return;
            }
            setNodes((prev) => [...prev, newNode]);
            setConnections((prev) => [...prev, { id: nanoid(), ...connection }]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            if (type !== CanvasNodeType.Text && type !== CanvasNodeType.Audio) setDialogNodeId(newNode.id);
            setPendingConnectionCreate(null);
            setConnecting(null);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message, setConnecting],
    );

    const cancelPendingConnectionCreate = useCallback(() => {
        setPendingConnectionCreate(null);
        setConnecting(null);
    }, [setConnecting]);

    const getConnectionDropTarget = useCallback(
        (clientX: number, clientY: number, current: ConnectionHandle): ConnectionDropTarget => {
            const world = screenToCanvas(clientX, clientY);
            const scale = Math.max(viewportRef.current.k, 0.05);
            const padding = CONNECTION_NODE_HIT_PADDING / scale;
            const handleRadius = CONNECTION_HANDLE_HIT_RADIUS / scale;
            let isNearNode = false;
            let bestNodeId: string | null = null;
            let bestPriority = Number.POSITIVE_INFINITY;

            [...nodesRef.current]
                .filter((node) => !isHiddenBatchChild(node, nodesRef.current))
                .reverse()
                .forEach((node) => {
                    const anchor = getConnectionTargetAnchor(node, current);
                    const dx = world.x - anchor.x;
                    const dy = world.y - anchor.y;
                    const hitsHandle = dx * dx + dy * dy <= handleRadius * handleRadius;
                    const hitsInside = world.x >= node.position.x && world.x <= node.position.x + node.width && world.y >= node.position.y && world.y <= node.position.y + node.height;
                    const hitsExpanded = world.x >= node.position.x - padding && world.x <= node.position.x + node.width + padding && world.y >= node.position.y - padding && world.y <= node.position.y + node.height + padding;

                    if (!hitsHandle && !hitsInside && !hitsExpanded) return;
                    isNearNode = true;
                    if (node.id === current.nodeId || !normalizeConnection(current.nodeId, node.id, nodesRef.current, current.handleType)) return;

                    const priority = hitsInside ? 0 : hitsHandle ? 1 : 2;
                    if (priority < bestPriority) {
                        bestNodeId = node.id;
                        bestPriority = priority;
                    }
                });

            return { nodeId: bestNodeId, isNearNode };
        },
        [screenToCanvas],
    );

    const visibleNodes = useMemo(() => {
        const padding = 280;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || size.width;
        const height = rect?.height || size.height;
        const viewLeft = -viewport.x / viewport.k - padding;
        const viewTop = -viewport.y / viewport.k - padding;
        const viewRight = viewLeft + width / viewport.k + padding * 2;
        const viewBottom = viewTop + height / viewport.k + padding * 2;

        return nodes.filter((node) => !isHiddenBatchChild(node, nodes, collapsingBatchIds) && node.position.x + node.width > viewLeft && node.position.x < viewRight && node.position.y + node.height > viewTop && node.position.y < viewBottom);
    }, [collapsingBatchIds, nodes, size.height, size.width, viewport.k, viewport.x, viewport.y]);

    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const toolbarNode = toolbarNodeId ? nodeById.get(toolbarNodeId) || null : null;
    const infoNode = infoNodeId ? nodeById.get(infoNodeId) || null : null;
    const cropNode = cropNodeId ? nodeById.get(cropNodeId) || null : null;
    const maskEditNode = maskEditNodeId ? nodeById.get(maskEditNodeId) || null : null;
    const splitNode = splitNodeId ? nodeById.get(splitNodeId) || null : null;
    const upscaleNode = upscaleNodeId ? nodeById.get(upscaleNodeId) || null : null;
    const superResolveNode = superResolveNodeId ? nodeById.get(superResolveNodeId) || null : null;
    const angleNode = angleNodeId ? nodeById.get(angleNodeId) || null : null;
    const previewNode = previewNodeId ? nodeById.get(previewNodeId) || null : null;
    const hasMultipleSelectedNodes = selectedNodeIds.size > 1;
    const activeNodeId = hasMultipleSelectedNodes ? null : hoveredNodeId || (selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null);
    const batchChildCountById = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.metadata?.isBatchRoot) map.set(node.id, node.metadata.batchChildIds?.length || 0);
        });
        return map;
    }, [nodes]);
    const groupChildCountById = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach((node) => {
            const groupId = node.metadata?.groupId;
            if (groupId) map.set(groupId, (map.get(groupId) || 0) + 1);
        });
        return map;
    }, [nodes]);
    const batchMotionById = useMemo(() => {
        const map = new Map<string, { x: number; y: number; index: number }>();
        nodes.forEach((node) => {
            const rootId = node.metadata?.batchRootId;
            if (!rootId) return;
            const root = nodeById.get(rootId);
            const index = root?.metadata?.batchChildIds?.indexOf(node.id) ?? 0;
            const stackX = root ? root.position.x + 34 + index * 14 : node.position.x;
            const stackY = root ? root.position.y + 14 + index * 8 : node.position.y;
            map.set(node.id, { x: stackX - node.position.x, y: stackY - node.position.y, index: Math.max(index, 0) });
        });
        return map;
    }, [nodeById, nodes]);
    const relatedHighlight = useMemo(() => {
        const nodeIds = new Set<string>();
        const connectionIds = new Set<string>();

        if (!activeNodeId) return { nodeIds, connectionIds };

        nodeIds.add(activeNodeId);
        connections.forEach((connection) => {
            if (connection.fromNodeId !== activeNodeId && connection.toNodeId !== activeNodeId) return;
            connectionIds.add(connection.id);
            nodeIds.add(connection.fromNodeId);
            nodeIds.add(connection.toNodeId);
        });

        return { nodeIds, connectionIds };
    }, [activeNodeId, connections]);
    const displayConnections = useMemo(
        () => selectVisibleCanvasConnections(connections, nodes, selectedNodeIds, showAllConnections),
        [connections, nodes, selectedNodeIds, showAllConnections],
    );

    const configInputsById = useMemo(() => {
        const map = new Map<string, NodeGenerationInput[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Config) return;
            map.set(node.id, buildNodeGenerationInputs(node.id, nodes, connections));
        });
        return map;
    }, [connections, nodes]);
    const resourceContextNodeId = dialogNodeId || activeNodeId;
    const canvasResourceReferences = useMemo(() => buildCanvasResourceReferences(nodes, connections, resourceContextNodeId), [connections, nodes, resourceContextNodeId]);
    const resourceReferenceByNodeId = useMemo(() => new Map(canvasResourceReferences.map((reference) => [reference.nodeId, reference])), [canvasResourceReferences]);
    const mentionReferencesByNodeId = useMemo(() => {
        const map = new Map<string, ReturnType<typeof buildNodeMentionReferences>>();
        nodes.forEach((node) => map.set(node.id, buildNodeMentionReferences(node, nodes, connections)));
        return map;
    }, [connections, nodes]);
    const agentSnapshot = useMemo<CanvasAgentSnapshot>(
        () => ({ projectId, title: currentProject?.title || "未命名画布", nodes, connections, selectedNodeIds: Array.from(selectedNodeIds), viewport }),
        [connections, currentProject?.title, nodes, projectId, selectedNodeIds, viewport],
    );
    const applyAgentOps = useCallback(
        (ops?: CanvasAgentOp[]) => {
            const safeOps = Array.isArray(ops) ? ops.filter((op) => op?.type) : [];
            const before = { projectId, title: currentProject?.title || "未命名画布", nodes: nodesRef.current, connections: connectionsRef.current, selectedNodeIds: Array.from(selectedNodeIdsRef.current), viewport: viewportRef.current };
            const generationOps = safeOps.filter((op): op is Extract<CanvasAgentOp, { type: "run_generation" }> => op.type === "run_generation" && Boolean(op.nodeId));
            const next = applyCanvasAgentOps(
                before,
                safeOps.filter((op) => op.type !== "run_generation"),
            );
            nodesRef.current = next.nodes;
            connectionsRef.current = next.connections;
            selectedNodeIdsRef.current = new Set(next.selectedNodeIds);
            viewportRef.current = next.viewport;
            setAgentUndoSnapshot(before);
            setNodes(next.nodes);
            setConnections(next.connections);
            setSelectedNodeIds(new Set(next.selectedNodeIds));
            setSelectedConnectionId(null);
            setViewport(next.viewport);
            setContextMenu(null);
            if (generationOps.length) {
                queueMicrotask(() =>
                    generationOps.forEach((op) => {
                        const target = nodesRef.current.find((node) => node.id === op.nodeId);
                        const prompt = op.prompt?.trim() ? op.prompt : (target?.metadata?.composerContent ?? target?.metadata?.prompt ?? "");
                        void generateNodeRef.current?.(op.nodeId, op.mode || target?.metadata?.generationMode || "image", prompt);
                    }),
                );
            }
            return { ...next, projectId, title: currentProject?.title || "未命名画布" };
        },
        [currentProject?.title, projectId],
    );
    const undoAgentOps = useCallback(() => {
        if (!agentUndoSnapshot) return null;
        nodesRef.current = agentUndoSnapshot.nodes;
        connectionsRef.current = agentUndoSnapshot.connections;
        selectedNodeIdsRef.current = new Set(agentUndoSnapshot.selectedNodeIds);
        viewportRef.current = agentUndoSnapshot.viewport;
        setNodes(agentUndoSnapshot.nodes);
        setConnections(agentUndoSnapshot.connections);
        setSelectedNodeIds(new Set(agentUndoSnapshot.selectedNodeIds));
        setSelectedConnectionId(null);
        setViewport(agentUndoSnapshot.viewport);
        setContextMenu(null);
        setAgentUndoSnapshot(null);
        return { ...agentUndoSnapshot, projectId, title: currentProject?.title || "未命名画布" };
    }, [agentUndoSnapshot, currentProject?.title, projectId]);
    const createNode = useCallback(
        (type: CanvasNodeType, position?: Position) => {
            const targetPosition = position || getCanvasCenter();
            const configMetadata =
                type === CanvasNodeType.Config
                    ? {
                          model: effectiveConfig.imageModel,
                          size: effectiveConfig.size,
                          count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                      }
                    : undefined;
            const newNode = createCanvasNode(type, targetPosition, configMetadata);

            setNodes((prev) => [...prev, newNode]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            if (type !== CanvasNodeType.Text && type !== CanvasNodeType.Audio && type !== CanvasNodeType.Group) setDialogNodeId(newNode.id);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, getCanvasCenter],
    );

    const deleteNodes = useCallback(
        (ids: Set<string>) => {
            if (!ids.size) return;
            const allIds = new Set(ids);
            nodesRef.current.forEach((node) => {
                if (ids.has(node.id)) node.metadata?.batchChildIds?.forEach((childId) => allIds.add(childId));
            });
            setNodes((prev) => {
                const next = prev.filter((node) => !allIds.has(node.id));
                return next.map((node) => {
                    const groupId = node.metadata?.groupId;
                    if (groupId && allIds.has(groupId)) return { ...node, metadata: { ...node.metadata, groupId: undefined } };
                    const childIds = node.metadata?.batchChildIds?.filter((childId) => !allIds.has(childId));
                    if (!node.metadata?.isBatchRoot || childIds?.length === node.metadata.batchChildIds?.length) return node;
                    const primaryImageId = childIds?.includes(node.metadata.primaryImageId || "") ? node.metadata.primaryImageId : childIds?.[0];
                    const primaryNode = next.find((item) => item.id === primaryImageId);
                    return {
                        ...node,
                        metadata: {
                            ...node.metadata,
                            batchChildIds: childIds,
                            primaryImageId,
                            content: primaryNode?.metadata?.content || node.metadata.content,
                            naturalWidth: primaryNode?.metadata?.naturalWidth || node.metadata.naturalWidth,
                            naturalHeight: primaryNode?.metadata?.naturalHeight || node.metadata.naturalHeight,
                        },
                    };
                });
            });
            setConnections((prev) => prev.filter((conn) => !allIds.has(conn.fromNodeId) && !allIds.has(conn.toNodeId)));
            setSelectedNodeIds(new Set());
            setSelectedConnectionId(null);
            setHoveredNodeId((current) => (current && allIds.has(current) ? null : current));
            setToolbarNodeId((current) => (current && allIds.has(current) ? null : current));
            setDialogNodeId((current) => (current && allIds.has(current) ? null : current));
            setEditingNodeId((current) => (current && allIds.has(current) ? null : current));
            setInfoNodeId((current) => (current && allIds.has(current) ? null : current));
            setCropNodeId((current) => (current && allIds.has(current) ? null : current));
            setMaskEditNodeId((current) => (current && allIds.has(current) ? null : current));
            setAngleNodeId((current) => (current && allIds.has(current) ? null : current));
            setPreviewNodeId((current) => (current && allIds.has(current) ? null : current));
            setRunningNodeId((current) => (current && allIds.has(current) ? null : current));
            setContextMenu((current) => (current?.type === "node" && allIds.has(current.nodeId) ? null : current));
            cleanupCanvasFiles({ projectId, nodes: nodesRef.current.filter((node) => !allIds.has(node.id)), chatSessions });
        },
        [chatSessions, cleanupCanvasFiles, projectId],
    );

    const deleteConnection = useCallback((connectionId: string) => {
        setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
        setSelectedConnectionId((current) => (current === connectionId ? null : current));
        setContextMenu((current) => (current?.type === "connection" && current.connectionId === connectionId ? null : current));
    }, []);

    const deselectCanvas = useCallback(() => {
        cancelPendingConnectionCreate();
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setContextMenu(null);
        setSelectionBox(null);
        setHoveredNodeId(null);
        setToolbarNodeId(null);
        setDialogNodeId(null);
        setEditingNodeId(null);
    }, [cancelPendingConnectionCreate]);

    const clearCanvas = useCallback(() => {
        setNodes([]);
        setConnections([]);
        setInfoNodeId(null);
        setCropNodeId(null);
        setMaskEditNodeId(null);
        setAngleNodeId(null);
        setPreviewNodeId(null);
        setRunningNodeId(null);
        deselectCanvas();
        setClearConfirmOpen(false);
        cleanupCanvasFiles({ projectId, nodes: [], chatSessions: [] });
    }, [cleanupCanvasFiles, deselectCanvas, projectId]);

    const duplicateNode = useCallback((nodeId: string) => {
        const source = nodesRef.current.find((node) => node.id === nodeId);
        if (!source) return;

        const id = `${source.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const next: CanvasNodeData = {
            ...source,
            id,
            title: `${source.title} Copy`,
            position: { x: source.position.x + 36, y: source.position.y + 36 },
        };

        setNodes((prev) => [...prev, next]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        if (next.type !== CanvasNodeType.Group) setDialogNodeId(id);
    }, []);

    const copySelectedNodes = useCallback(() => {
        const selectedIds = selectedNodeIdsRef.current;
        if (!selectedIds.size) return;

        const copiedNodes = nodesRef.current
            .filter((node) => selectedIds.has(node.id))
            .map((node) => ({
                ...node,
                position: { ...node.position },
                metadata: node.metadata ? { ...node.metadata } : undefined,
            }));

        if (!copiedNodes.length) return;

        clipboardRef.current = {
            nodes: copiedNodes,
            connections: connectionsRef.current.filter((connection) => selectedIds.has(connection.fromNodeId) && selectedIds.has(connection.toNodeId)).map((connection) => ({ ...connection })),
        };
    }, []);

    const pasteCopiedNodes = useCallback(() => {
        const clipboard = clipboardRef.current;
        if (!clipboard?.nodes.length) return false;

        const center = getCanvasCenter();
        const bounds = clipboard.nodes.reduce(
            (acc, node) => ({
                left: Math.min(acc.left, node.position.x),
                top: Math.min(acc.top, node.position.y),
                right: Math.max(acc.right, node.position.x + node.width),
                bottom: Math.max(acc.bottom, node.position.y + node.height),
            }),
            { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
        );
        const dx = center.x - (bounds.left + bounds.right) / 2;
        const dy = center.y - (bounds.top + bounds.bottom) / 2;
        const idMap = new Map<string, string>();
        const nextNodes = clipboard.nodes.map((node, index) => {
            const id = `${node.type}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
            idMap.set(node.id, id);
            return {
                ...node,
                id,
                title: node.title.endsWith(" Copy") ? node.title : `${node.title} Copy`,
                position: {
                    x: node.position.x + dx,
                    y: node.position.y + dy,
                },
                metadata: node.metadata ? { ...node.metadata } : undefined,
            };
        });

        const pastedNodes = nextNodes.map((node) => {
            const groupId = node.metadata?.groupId;
            if (!groupId) return node;
            return { ...node, metadata: { ...node.metadata, groupId: idMap.get(groupId) } };
        });

        const nextConnections = clipboard.connections.flatMap((connection, index) => {
            const fromNodeId = idMap.get(connection.fromNodeId);
            const toNodeId = idMap.get(connection.toNodeId);
            if (!fromNodeId || !toNodeId) return [];
            return [
                {
                    ...connection,
                    id: `conn-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
                    fromNodeId,
                    toNodeId,
                },
            ];
        });

        setNodes((prev) => [...prev, ...pastedNodes]);
        setConnections((prev) => [...prev, ...nextConnections]);
        setSelectedNodeIds(new Set(pastedNodes.map((node) => node.id)));
        setSelectedConnectionId(null);
        setContextMenu(null);
        setDialogNodeId(pastedNodes[0]?.type === CanvasNodeType.Group ? null : pastedNodes[0]?.id || null);
        return true;
    }, [getCanvasCenter]);

    const resetViewport = useCallback(() => {
        setViewport({ x: size.width / 2, y: size.height / 2, k: 1 });
        setContextMenu(null);
    }, [size.height, size.width]);

    const setZoomScale = useCallback(
        (scale: number) => {
            const nextScale = Math.min(Math.max(scale, 0.05), 5);
            setViewport((prev) => ({
                x: size.width / 2 - ((size.width / 2 - prev.x) / prev.k) * nextScale,
                y: size.height / 2 - ((size.height / 2 - prev.y) / prev.k) * nextScale,
                k: nextScale,
            }));
            setContextMenu(null);
        },
        [size.height, size.width],
    );

    const applyHistory = useCallback((entry: CanvasHistoryEntry) => {
        if (historyCommitTimerRef.current) {
            clearTimeout(historyCommitTimerRef.current);
            historyCommitTimerRef.current = null;
        }
        applyingHistoryRef.current = true;
        setNodes(entry.nodes);
        setConnections(entry.connections);
        setChatSessions(entry.chatSessions);
        setActiveChatId(entry.activeChatId);
        setBackgroundMode(entry.backgroundMode);
        setShowImageInfo(entry.showImageInfo);
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setContextMenu(null);
        setTimeout(() => {
            lastHistoryRef.current = entry;
            applyingHistoryRef.current = false;
            setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 });
        });
    }, []);

    const undoCanvas = useCallback(() => {
        const previous = historyRef.current.past.pop();
        const current = lastHistoryRef.current;
        if (!previous || !current) return;
        historyRef.current.future.push(current);
        applyHistory(previous);
    }, [applyHistory]);

    const redoCanvas = useCallback(() => {
        const next = historyRef.current.future.pop();
        const current = lastHistoryRef.current;
        if (!next || !current) return;
        historyRef.current.past.push(current);
        applyHistory(next);
    }, [applyHistory]);

    const createAndOpenProject = useCallback(() => {
        const id = createProject(`Pro Canvas ${useCanvasStore.getState().projects.length + 1}`);
        navigate(`/canvas/${id}`);
    }, [createProject, navigate]);

    const deleteCurrentProject = useCallback(() => {
        deleteProjects([projectId]);
        cleanupAssetImages();
        navigate("/canvas");
    }, [cleanupAssetImages, deleteProjects, navigate, projectId]);

    const handleCanvasMouseDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            setContextMenu(null);
            if (pendingConnectionCreateRef.current) cancelPendingConnectionCreate();
            if (event.button !== 0) return;

            if (!event.ctrlKey && !event.metaKey) {
                setSelectionBox(null);
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                return;
            }

            const world = screenToCanvas(event.clientX, event.clientY);
            const nextSelectionBox = {
                startWorldX: world.x,
                startWorldY: world.y,
                currentWorldX: world.x,
                currentWorldY: world.y,
                additive: event.shiftKey,
                initialSelectedNodeIds: event.shiftKey ? Array.from(selectedNodeIdsRef.current) : [],
            };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            if (!event.shiftKey) {
                setSelectedNodeIds(new Set());
            }

            setSelectedConnectionId(null);
        },
        [cancelPendingConnectionCreate, screenToCanvas],
    );

    const handleNodeMouseDown = useCallback((event: ReactMouseEvent, nodeId: string) => {
        event.stopPropagation();
        setContextMenu(null);
        setHoveredNodeId(null);
        setToolbarNodeId(null);
        setSelectedConnectionId(null);

        const currentSelected = selectedNodeIdsRef.current;
        const currentNodes = nodesRef.current;
        const nextSelected = new Set(currentSelected);

        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            if (nextSelected.has(nodeId)) {
                nextSelected.delete(nodeId);
            } else {
                nextSelected.add(nodeId);
            }
        } else if (!nextSelected.has(nodeId)) {
            nextSelected.clear();
            nextSelected.add(nodeId);
        }

        setSelectedNodeIds(nextSelected);
        setToolbarNodeId(nextSelected.size === 1 && nextSelected.has(nodeId) ? nodeId : null);
        const dragIds = new Set(nextSelected);
        currentNodes.forEach((node) => {
            if (!nextSelected.has(node.id)) return;
            node.metadata?.batchChildIds?.forEach((childId) => dragIds.add(childId));
            if (node.type === CanvasNodeType.Group) {
                currentNodes.forEach((child) => {
                    if (child.metadata?.groupId === node.id) dragIds.add(child.id);
                });
            }
        });
        dragRef.current = {
            isDraggingNode: true,
            hasMoved: false,
            startX: event.clientX,
            startY: event.clientY,
            initialSelectedNodes: currentNodes.filter((node) => dragIds.has(node.id)).map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
        };
        historyPausedRef.current = true;
        nodeDraggingRef.current = true;
        setIsNodeDragging(true);
    }, []);

    const finishNodeDrag = useCallback((clientX?: number, clientY?: number) => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (!dragRef.current.isDraggingNode) return;

        const wasClick = !dragRef.current.hasMoved && dragRef.current.initialSelectedNodes.length === 1;
        const clickedNodeId = dragRef.current.initialSelectedNodes[0]?.id;
        const currentViewport = viewportRef.current;
        const dx = clientX == null ? 0 : (clientX - dragRef.current.startX) / currentViewport.k;
        const dy = clientY == null ? 0 : (clientY - dragRef.current.startY) / currentViewport.k;
        const initialPositions = dragRef.current.initialSelectedNodes;

        historyPausedRef.current = false;
        nodeDraggingRef.current = false;
        setIsNodeDragging(false);
        setDropTargetGroupId(null);
        if (dragRef.current.hasMoved && clientX != null && clientY != null) {
            const movedIds = new Set(initialPositions.map((item) => item.id));
            setNodes((prev) => {
                const moved = prev.map((node) => {
                    const initial = initialPositions.find((item) => item.id === node.id);
                    return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                });
                const targetGroup = findGroupDropTarget(movedIds, moved);
                if (targetGroup) return snapNodesIntoGroup(movedIds, moved, targetGroup);
                return moved.map((node) => {
                    if (!movedIds.has(node.id) || node.type === CanvasNodeType.Group) return node;
                    const groupId = findContainingGroupId(node, moved);
                    if (node.metadata?.groupId === groupId) return node;
                    return { ...node, metadata: { ...node.metadata, groupId } };
                });
            });
        }

        dragRef.current.isDraggingNode = false;
        dragRef.current.hasMoved = false;
        dragRef.current.initialSelectedNodes = [];
        if (wasClick && clickedNodeId) {
            const clickedNode = nodesRef.current.find((node) => node.id === clickedNodeId);
            if (clickedNode?.type === CanvasNodeType.Text) {
                setDialogNodeId((current) => (current === clickedNodeId ? current : null));
            } else if (clickedNode?.type !== CanvasNodeType.Group) {
                setDialogNodeId(clickedNodeId);
            }
        }
    }, []);

    const handleGlobalMouseMove = useCallback(
        (event: MouseEvent) => {
            const currentViewport = viewportRef.current;

            if (dragRef.current.isDraggingNode) {
                const dx = (event.clientX - dragRef.current.startX) / currentViewport.k;
                const dy = (event.clientY - dragRef.current.startY) / currentViewport.k;
                const initialPositions = dragRef.current.initialSelectedNodes;
                if (Math.abs(event.clientX - dragRef.current.startX) > 3 || Math.abs(event.clientY - dragRef.current.startY) > 3) {
                    dragRef.current.hasMoved = true;
                }

                const movedIds = new Set(initialPositions.map((item) => item.id));
                const previewNodes = nodesRef.current.map((node) => {
                    const initial = initialPositions.find((item) => item.id === node.id);
                    return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                });
                setDropTargetGroupId(findGroupDropTarget(movedIds, previewNodes)?.id || null);

                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    setNodes((prev) =>
                        prev.map((node) => {
                            const initial = initialPositions.find((item) => item.id === node.id);
                            return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                        }),
                    );
                    rafRef.current = null;
                });
                return;
            }

            if (connectingParamsRef.current && !pendingConnectionCreateRef.current) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, connectingParamsRef.current);
                connectionTargetNodeIdRef.current = dropTarget.nodeId;
                setConnectionTargetNodeId(dropTarget.nodeId);
                setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            }
        },
        [finishNodeDrag, getConnectionDropTarget, screenToCanvas],
    );

    const handleGlobalPointerMove = useCallback(
        (event: PointerEvent) => {
            const currentSelection = selectionBoxRef.current;
            if (!currentSelection) return;

            if (event.buttons === 0) {
                selectionBoxRef.current = null;
                setSelectionBox(null);
                return;
            }

            const world = screenToCanvas(event.clientX, event.clientY);
            const rectX = Math.min(currentSelection.startWorldX, world.x);
            const rectY = Math.min(currentSelection.startWorldY, world.y);
            const rectW = Math.abs(world.x - currentSelection.startWorldX);
            const rectH = Math.abs(world.y - currentSelection.startWorldY);
            const nextSelected = new Set<string>(currentSelection.additive ? currentSelection.initialSelectedNodeIds : []);

            nodesRef.current
                .filter((node) => !isHiddenBatchChild(node, nodesRef.current))
                .forEach((node) => {
                    const intersects = rectX < node.position.x + node.width && rectX + rectW > node.position.x && rectY < node.position.y + node.height && rectY + rectH > node.position.y;

                    if (intersects) nextSelected.add(node.id);
                });

            const nextSelectionBox = { ...currentSelection, currentWorldX: world.x, currentWorldY: world.y };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            setSelectedNodeIds(nextSelected);
        },
        [screenToCanvas],
    );

    const handleGlobalMouseUp = useCallback(
        (event: MouseEvent) => {
            finishNodeDrag(event.clientX, event.clientY);

            selectionBoxRef.current = null;
            setSelectionBox(null);

            if (pendingConnectionCreateRef.current) return;

            const currentConnection = connectingParamsRef.current;
            if (currentConnection) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, currentConnection);
                if (dropTarget.nodeId) {
                    connectNodes(currentConnection, dropTarget.nodeId);
                    setConnecting(null);
                } else if (dropTarget.isNearNode) {
                    setConnecting(null);
                } else {
                    setMouseWorld(screenToCanvas(event.clientX, event.clientY));
                    setPendingConnectionCreate({ connection: currentConnection, position: screenToCanvas(event.clientX, event.clientY) });
                }
            }
        },
        [connectNodes, finishNodeDrag, getConnectionDropTarget, screenToCanvas, setConnecting],
    );

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => finishNodeDrag(event.clientX, event.clientY);
        const cancelNodeDrag = () => finishNodeDrag();
        window.addEventListener("mousemove", handleGlobalMouseMove);
        window.addEventListener("mouseup", handleGlobalMouseUp);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", cancelNodeDrag);
        window.addEventListener("blur", cancelNodeDrag);
        window.addEventListener("pointermove", handleGlobalPointerMove);
        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", cancelNodeDrag);
            window.removeEventListener("blur", cancelNodeDrag);
            window.removeEventListener("pointermove", handleGlobalPointerMove);
        };
    }, [finishNodeDrag, handleGlobalMouseMove, handleGlobalMouseUp, handleGlobalPointerMove]);

    const createImageFileNode = useCallback(async (file: File, position: Position) => {
        const image = await uploadImage(file);
        const size = fitNodeSize(image.width, image.height);
        const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newNode: CanvasNodeData = {
            id,
            type: CanvasNodeType.Image,
            title: file.name,
            position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
            width: size.width,
            height: size.height,
            metadata: imageMetadata(image),
        };

        setNodes((prev) => [...prev, newNode]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);
    }, []);

    const createVideoFileNode = useCallback(async (file: File, position: Position) => {
        const video = await uploadMediaFile(file, "video");
        const size = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
        const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setNodes((prev) => [
            ...prev,
            {
                id,
                type: CanvasNodeType.Video,
                title: file.name,
                position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
                width: size.width,
                height: size.height,
                metadata: videoMetadata(video),
            },
        ]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);
    }, []);

    const createAudioFileNode = useCallback(async (file: File, position: Position) => {
        const audio = await uploadMediaFile(file, "audio");
        const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
        const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setNodes((prev) => [
            ...prev,
            {
                id,
                type: CanvasNodeType.Audio,
                title: file.name,
                position: { x: position.x - spec.width / 2, y: position.y - spec.height / 2 },
                width: spec.width,
                height: spec.height,
                metadata: audioMetadata(audio),
            },
        ]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
    }, []);

    const createTextNodeFromClipboard = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return false;

            const node = {
                ...createCanvasNode(CanvasNodeType.Text, getCanvasCenter(), { content: trimmed, status: NODE_STATUS_SUCCESS }),
                title: trimmed.slice(0, 32) || "剪切板文本",
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
            setContextMenu(null);
            setDialogNodeId(node.id);
            return true;
        },
        [getCanvasCenter],
    );

    const pasteSystemClipboard = useCallback(async () => {
        if (!navigator.clipboard) return;

        const items = await navigator.clipboard.read();
        const imageItem = items.find((item) => item.types.some((type) => type.startsWith("image/")));
        if (imageItem) {
            const imageType = imageItem.types.find((type) => type.startsWith("image/"));
            if (!imageType) return;
            const blob = await imageItem.getType(imageType);
            const file = new File([blob], "clipboard-image.png", { type: imageType });
            void createImageFileNode(file, getCanvasCenter());
            message.success("已从剪切板添加图片");
            return;
        }

        const text = await navigator.clipboard.readText();
        if (createTextNodeFromClipboard(text)) message.success("已从剪切板添加文本");
    }, [createImageFileNode, createTextNodeFromClipboard, getCanvasCenter, message]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || target?.closest("[contenteditable='true'],[data-canvas-no-zoom]")) return;

            const key = event.key.toLowerCase();
            const isModifierShortcut = event.metaKey || event.ctrlKey;

            if (isModifierShortcut && !event.altKey && key === "z") {
                event.preventDefault();
                if (event.shiftKey) redoCanvas();
                else undoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "y") {
                event.preventDefault();
                redoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "a") {
                event.preventDefault();
                setSelectedNodeIds(new Set(nodesRef.current.map((node) => node.id)));
                setSelectedConnectionId(null);
                setContextMenu(null);
                setSelectionBox(null);
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "c") {
                event.preventDefault();
                copySelectedNodes();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "v") {
                event.preventDefault();
                if (!pasteCopiedNodes()) void pasteSystemClipboard();
                return;
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                if (selectedNodeIdsRef.current.size) {
                    deleteNodes(new Set(selectedNodeIdsRef.current));
                } else if (selectedConnectionId) {
                    deleteConnection(selectedConnectionId);
                }
            }

            if (event.key === "Escape") {
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                setContextMenu(null);
                setSelectionBox(null);
                setConnecting(null);
                setHoveredNodeId(null);
                setToolbarNodeId(null);
                setDialogNodeId(null);
                setEditingNodeId(null);
                setInfoNodeId(null);
                setCropNodeId(null);
                setMaskEditNodeId(null);
                setPendingConnectionCreate(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [copySelectedNodes, deleteConnection, deleteNodes, pasteCopiedNodes, pasteSystemClipboard, redoCanvas, selectedConnectionId, setConnecting, undoCanvas]);

    const handleConnectStart = useCallback(
        (event: ReactMouseEvent, nodeId: string, handleType: "source" | "target") => {
            event.stopPropagation();
            setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            setConnecting({ nodeId, handleType });
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
            setSelectedConnectionId(null);
        },
        [screenToCanvas, setConnecting],
    );

    const handleNodeResize = useCallback((nodeId: string, width: number, height: number, position?: Position) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, width, height, position: position || node.position } : node)));
    }, []);

    const toggleNodeFreeResize = useCallback((nodeId: string) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                const freeResize = !node.metadata?.freeResize;
                if (freeResize || node.type !== CanvasNodeType.Image) return { ...node, metadata: { ...node.metadata, freeResize } };
                const ratio = (node.metadata?.naturalWidth || node.width) / (node.metadata?.naturalHeight || node.height || 1);
                const height = node.width / ratio;
                return { ...node, height, position: { x: node.position.x, y: node.position.y + node.height / 2 - height / 2 }, metadata: { ...node.metadata, freeResize } };
            }),
        );
    }, []);

    const handleNodeContentChange = useCallback((nodeId: string, content: string) => {
        setNodes((prev) => {
            const target = prev.find((node) => node.id === nodeId);
            const promptRole = target?.metadata?.viralVideoPromptRole;
            if (!target || !promptRole) return prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, content } } : node));
            if (promptRole === "template") {
                const plan = target.metadata?.viralVideoPromptPlan;
                if (!plan) return prev;
                const viralVideoPromptPlan = { ...plan, masterPrompt: content };
                return prev.map((node) =>
                    node.id === nodeId
                        ? {
                              ...node,
                              metadata: {
                                  ...node.metadata,
                                  content: formatViralVideoPromptPlan(viralVideoPromptPlan, node.metadata?.viralVideoPlannerPrompt || ""),
                                  prompt: content,
                                  viralVideoPromptPlan,
                              },
                          }
                        : node,
                );
            }
            return prev;
        });
    }, []);

    const handleNodeTitleChange = useCallback((nodeId: string, title: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, title } : node)));
    }, []);

    const toggleBatchExpanded = useCallback((nodeId: string) => {
        const isExpanded = Boolean(nodesRef.current.find((node) => node.id === nodeId)?.metadata?.imageBatchExpanded);
        if (isExpanded) {
            setCollapsingBatchIds((prev) => new Set(prev).add(nodeId));
            window.setTimeout(() => {
                setCollapsingBatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 320);
        } else {
            setOpeningBatchIds((prev) => new Set(prev).add(nodeId));
            window.setTimeout(() => {
                setOpeningBatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 260);
        }
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                return { ...node, metadata: { ...node.metadata, imageBatchExpanded: !node.metadata?.imageBatchExpanded } };
            }),
        );
    }, []);

    const setBatchPrimary = useCallback((child: CanvasNodeData) => {
        const rootId = child.metadata?.batchRootId;
        if (!rootId || !child.metadata?.content) return;
        setNodes((prev) =>
            prev.map((node) =>
                node.id === rootId
                    ? {
                          ...node,
                          width: child.width,
                          height: child.height,
                          metadata: {
                              ...node.metadata,
                              content: child.metadata?.content,
                              primaryImageId: child.id,
                              naturalWidth: child.metadata?.naturalWidth,
                              naturalHeight: child.metadata?.naturalHeight,
                              freeResize: child.metadata?.freeResize,
                          },
                      }
                    : node,
            ),
        );
    }, []);

    const openTextEditor = useCallback((node: CanvasNodeData) => {
        if (node.type !== CanvasNodeType.Text) return;
        if (node.metadata?.viralVideoAnalysis) return;
        setSelectedNodeIds(new Set([node.id]));
        setSelectedConnectionId(null);
        setDialogNodeId(node.id);
        setEditingNodeId(node.id);
        setEditRequestNonce((value) => value + 1);
    }, []);

    const handleNodePromptChange = useCallback((nodeId: string, prompt: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt } } : node)));
    }, []);

    const handleConfigNodeChange = useCallback((nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? applyNodeConfigPatch(node, patch) : node)));
    }, []);

    const downloadNodeImage = useCallback((node: CanvasNodeData) => {
        if ((node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Audio) || !node.metadata?.content) return;
        saveAs(node.metadata.content, `canvas-${node.type}-${node.id}.${node.type === CanvasNodeType.Video ? "mp4" : node.type === CanvasNodeType.Audio ? audioExtension(node.metadata.mimeType) : imageExtension(node.metadata.content)}`);
    }, []);

    const saveNodeAsset = useCallback(
        async (node: CanvasNodeData) => {
            if (node.type === CanvasNodeType.Text) {
                const content = node.metadata?.content?.trim();
                if (!content) return message.error("没有可保存的文本");
                addAsset({ kind: "text", title: node.metadata?.prompt?.slice(0, 24) || "画布文本", coverUrl: "", tags: [], source: "Canvas", data: { content }, metadata: { source: "canvas", nodeId: node.id } });
                message.success("已加入我的素材");
                return;
            }
            if (node.type === CanvasNodeType.Video) {
                if (!node.metadata?.content) return message.error("没有可保存的视频");
                addAsset({
                    kind: "video",
                    title: node.metadata?.prompt?.slice(0, 24) || "画布视频",
                    coverUrl: "",
                    tags: [],
                    source: "Canvas",
                    data: { url: node.metadata.content, storageKey: node.metadata.storageKey, width: node.width, height: node.height, bytes: node.metadata.bytes || 0, mimeType: node.metadata.mimeType || "video/mp4" },
                    metadata: { source: "canvas", nodeId: node.id, prompt: node.metadata?.prompt },
                });
                message.success("已加入我的素材");
                return;
            }
            if (!node.metadata?.content) return message.error("没有可保存的图片");
            const dataUrl = node.metadata.storageKey ? "" : node.metadata.content;
            addAsset({
                kind: "image",
                title: node.metadata?.prompt?.slice(0, 24) || "画布图片",
                coverUrl: node.metadata.content,
                tags: [],
                source: "Canvas",
                data: {
                    dataUrl,
                    storageKey: node.metadata.storageKey,
                    width: node.metadata.naturalWidth || node.width,
                    height: node.metadata.naturalHeight || node.height,
                    bytes: node.metadata.bytes || getDataUrlByteSize(dataUrl),
                    mimeType: node.metadata.mimeType || "image/png",
                },
                metadata: { source: "canvas", nodeId: node.id, prompt: node.metadata?.prompt },
            });
            message.success("已加入我的素材");
        },
        [addAsset, message],
    );

    const createImageReversePromptNodes = useCallback(
        (node: CanvasNodeData) => {
            if ((node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video) || !node.metadata?.content) {
                message.warning(`${node.type === CanvasNodeType.Video ? "视频" : "图片"}节点为空，无法反推提示词`);
                return;
            }

            const reversePrompt = reversePromptPreset(node.type);
            const referenceLabel = reversePromptReferenceLabel(node.type);
            const gap = 96;
            const textSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
            const configSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Config];
            const centerY = node.position.y + node.height / 2;
            const textNode = {
                ...createCanvasNode(CanvasNodeType.Text, { x: node.position.x + node.width + gap + textSpec.width / 2, y: centerY }, { content: reversePrompt, prompt: reversePrompt, status: NODE_STATUS_SUCCESS, fontSize: 14 }),
                title: "反推提示词",
            };
            const configNode = {
                ...createCanvasNode(
                    CanvasNodeType.Config,
                    { x: textNode.position.x + textNode.width + gap + configSpec.width / 2, y: centerY },
                    {
                        generationMode: "text",
                        model: effectiveConfig.textModel || defaultConfig.textModel,
                        count: 1,
                        composerContent: `${referenceLabel}：@[node:${node.id}]\n任务说明：@[node:${textNode.id}]`,
                    },
                ),
                title: "反推提示词配置",
            };

            setNodes((prev) => [...prev, textNode, configNode]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: configNode.id }, { id: nanoid(), fromNodeId: textNode.id, toNodeId: configNode.id }]);
            setSelectedNodeIds(new Set([configNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(configNode.id);
            setContextMenu(null);
        },
        [effectiveConfig.model, effectiveConfig.textModel, message],
    );

    const cropImageNode = useCallback(async (node: CanvasNodeData, crop: CanvasImageCropRect) => {
        if (!node.metadata?.content) return;
        const cropped = await cropDataUrl(node.metadata.content, crop);
        const image = await uploadImage(cropped);
        const width = Math.min(node.width, Math.max(220, image.width));
        const childId = nanoid();
        const child: CanvasNodeData = {
            id: childId,
            type: CanvasNodeType.Image,
            title: "Cropped Image",
            position: { x: node.position.x + node.width + 96, y: node.position.y },
            width,
            height: width * (image.height / image.width),
            metadata: {
                ...imageMetadata(image),
                prompt: node.metadata?.prompt,
            },
        };
        setNodes((prev) => [...prev, child]);
        setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
        setSelectedNodeIds(new Set([childId]));
        setDialogNodeId(childId);
        setCropNodeId(null);
    }, []);

    const splitImageNode = useCallback(
        async (node: CanvasNodeData, params: CanvasImageSplitParams) => {
            if (!node.metadata?.content) return;
            setSplitNodeId(null);
            const pieces = await splitDataUrl(node.metadata.content, params);
            const gap = 16;
            const cellWidth = node.width / params.columns;
            const cellHeight = node.height / params.rows;
            const startX = node.position.x + node.width + 96;
            const startY = node.position.y;
            const childNodes = await Promise.all(
                pieces.map(async (piece) => {
                    const image = await uploadImage(piece.dataUrl);
                    const id = nanoid();
                    return {
                        id,
                        type: CanvasNodeType.Image,
                        title: `${node.title || "图片"} ${piece.row + 1}-${piece.column + 1}`,
                        position: { x: startX + piece.column * (cellWidth + gap), y: startY + piece.row * (cellHeight + gap) },
                        width: cellWidth,
                        height: cellHeight,
                        metadata: {
                            ...imageMetadata(image),
                            prompt: node.metadata?.prompt,
                        },
                    } satisfies CanvasNodeData;
                }),
            );
            setNodes((prev) => [...prev, ...childNodes]);
            setConnections((prev) => [...prev, ...childNodes.map((child) => ({ id: nanoid(), fromNodeId: node.id, toNodeId: child.id }))]);
            setSelectedNodeIds(new Set(childNodes.map((child) => child.id)));
            setSelectedConnectionId(null);
            setDialogNodeId(null);
            message.success(`已切分为 ${childNodes.length} 个子节点`);
        },
        [message],
    );

    const maskEditImageNode = useCallback(
        async (node: CanvasNodeData, payload: CanvasImageMaskEditPayload) => {
            if (!node.metadata?.content) return;
            const generationConfig = { ...buildGenerationConfig(effectiveConfig, node, "image"), count: "1", size: node.metadata?.size || "auto" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }
            const userPrompt = payload.prompt.trim();
            const prompt = `只修改蒙版透明区域，其他区域保持不变。${userPrompt}`;
            const childId = nanoid();
            const source = { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey };
            const generationMetadata = buildImageGenerationMetadata("edit", generationConfig, 1, [source]);
            setMaskEditNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [
                ...prev,
                {
                    id: childId,
                    type: CanvasNodeType.Image,
                    title: userPrompt.slice(0, 32) || "局部编辑结果",
                    position: { x: node.position.x + node.width + 96, y: node.position.y },
                    width: node.width,
                    height: node.height,
                    metadata: { prompt, status: NODE_STATUS_LOADING, ...generationMetadata },
                },
            ]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setSelectedConnectionId(null);
            setDialogNodeId(childId);
            const controller = startGenerationRequest(childId, node.id, childId);
            try {
                const image = await requestEdit(generationConfig, prompt, [source], { id: `${node.id}-mask`, name: "mask.png", type: "image/png", dataUrl: payload.maskDataUrl }, { signal: controller.signal }).then((items) => items[0]);
                const uploaded = await uploadImage(image.dataUrl);
                const size = fitNodeSize(uploaded.width, uploaded.height, node.width, node.height);
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, width: size.width, height: size.height, metadata: { ...item.metadata, ...imageMetadata(uploaded), prompt, ...generationMetadata } } : item)));
            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : "局部修改失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                finishGenerationRequest(childId, controller);
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, finishGenerationRequest, isAiConfigReady, message, openConfigDialog, startGenerationRequest],
    );

    const upscaleImageNode = useCallback(async (node: CanvasNodeData, params: CanvasImageUpscaleParams) => {
        if (!node.metadata?.content) return;
        setUpscaleNodeId(null);
        const upscaled = await upscaleDataUrl(node.metadata.content, params);
        const image = await uploadImage(upscaled);
        const size = fitNodeSize(image.width, image.height);
        const childId = nanoid();
        const child: CanvasNodeData = {
            id: childId,
            type: CanvasNodeType.Image,
            title: "Upscaled Image",
            position: { x: node.position.x + node.width + 96, y: node.position.y },
            width: size.width,
            height: size.height,
            metadata: {
                ...imageMetadata(image),
                prompt: node.metadata?.prompt,
            },
        };
        setNodes((prev) => [...prev, child]);
        setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
        setSelectedNodeIds(new Set([childId]));
        setDialogNodeId(childId);
    }, []);

    const generateAngleNode = useCallback(
        async (node: CanvasNodeData, params: CanvasImageAngleParams) => {
            if (!node.metadata?.content) return;
            const generationConfig = { ...buildGenerationConfig(effectiveConfig, node, "image"), count: "1" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }
            const childId = nanoid();
            const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
            const title = buildAngleLabel(params);
            const prompt = buildAnglePrompt(params);
            const generationMetadata = buildImageGenerationMetadata("edit", generationConfig, 1, [
                { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey },
            ]);
            setAngleNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [
                ...prev,
                {
                    id: childId,
                    type: CanvasNodeType.Image,
                    title,
                    position: { x: node.position.x + node.width + 96, y: node.position.y },
                    width: imageConfig.width,
                    height: imageConfig.height,
                    metadata: { prompt, status: NODE_STATUS_LOADING, ...generationMetadata },
                },
            ]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setDialogNodeId(childId);
            const controller = startGenerationRequest(childId, node.id, childId);
            try {
                const image = await requestEdit(
                    generationConfig,
                    prompt,
                    [{ id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey }],
                    undefined,
                    { signal: controller.signal },
                ).then((items) => items[0]);
                const uploaded = await uploadImage(image.dataUrl);
                const size = fitNodeSize(uploaded.width, uploaded.height, imageConfig.width, imageConfig.height);
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, width: size.width, height: size.height, metadata: { ...item.metadata, ...imageMetadata(uploaded), prompt, ...generationMetadata } } : item)));
            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                finishGenerationRequest(childId, controller);
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, finishGenerationRequest, openConfigDialog, startGenerationRequest],
    );

    const handleFontSizeChange = useCallback((nodeId: string, fontSize: number) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, fontSize } } : node)));
    }, []);

    const handleUploadRequest = useCallback((nodeId?: string, position?: Position) => {
        uploadTargetRef.current = { nodeId, position };
        if (imageInputRef.current) {
            imageInputRef.current.accept = "image/*,video/*,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav";
            imageInputRef.current.multiple = false;
        }
        imageInputRef.current?.click();
    }, []);

    const handleProductUploadRequest = useCallback((nodeId: string) => {
        uploadTargetRef.current = { nodeId, imageOnly: true };
        if (imageInputRef.current) {
            imageInputRef.current.accept = "image/*";
            imageInputRef.current.multiple = false;
        }
        imageInputRef.current?.click();
    }, []);

    const handleViralReplacementUploadRequest = useCallback((nodeId: string, elementId: string) => {
        uploadTargetRef.current = { viralReplacement: { nodeId, elementId }, imageOnly: true };
        if (imageInputRef.current) {
            imageInputRef.current.accept = "image/*";
            imageInputRef.current.multiple = true;
        }
        imageInputRef.current?.click();
    }, []);

    const handleVideoUploadRequest = useCallback((nodeId: string) => {
        uploadTargetRef.current = { nodeId, videoOnly: true };
        if (imageInputRef.current) {
            imageInputRef.current.accept = "video/*";
            imageInputRef.current.multiple = false;
        }
        imageInputRef.current?.click();
    }, []);

    const resetViralWorkflowAfterUpload = useCallback(
        (nodeId: string) => {
            const workflow = currentProject?.workflow;
            if (workflow?.kind === "universal-viral-remake-beta") {
                if (nodeId === workflow.referenceNodeId) {
                    setUniversalRemakeRun(undefined);
                    updateProject(projectId, {
                        workflow: {
                            ...workflow, phase: "idle", reconstruction: undefined, template: undefined, summary: undefined,
                            variableSlots: [], activeRunId: undefined, error: undefined,
                        },
                    });
                }
                return;
            }
            if (!workflow || workflow.kind !== "viral-video-remake") return;
            viralAutoGenerateAfterPlanningRef.current = null;
            if (nodeId === workflow.sourceVideoNodeId) {
                invalidateViralVideoRun();
                invalidateViralPromptRun();
                invalidateViralAnalysisRun();
                updateProject(projectId, {
                    workflow: {
                        ...applyViralWorkflowEvents(workflow, [{ type: "REFERENCE_CHANGED" }]),
                        phase: "idle",
                        analysisNodeId: undefined,
                        promptNodeIds: undefined,
                        masterPromptNodeId: undefined,
                        outputNodeIds: undefined,
                    },
                });
            } else if (nodeId === workflow.replacementNodeId && workflow.analysisNodeId) {
                invalidateViralVideoRun();
                invalidateViralPromptRun();
                updateProject(projectId, {
                    workflow: {
                        ...applyViralWorkflowEvents(workflow, [{ type: "UPLOAD_CHANGED" }]),
                        phase: "requirements_ready",
                        promptNodeIds: undefined,
                        masterPromptNodeId: undefined,
                        outputNodeIds: undefined,
                    },
                });
            }
        },
        [currentProject?.workflow, invalidateViralAnalysisRun, invalidateViralPromptRun, invalidateViralVideoRun, projectId, updateProject],
    );

    const handleImageInputChange = useCallback(
        async (event: ReactChangeEvent<HTMLInputElement>) => {
            const files = [...(event.target.files || [])];
            const file = files[0];
            const target = uploadTargetRef.current;
            if (!file) return;
            if (target?.viralReplacement) {
                const invalid = files.find((item) => !item.type.startsWith("image/"));
                if (invalid) {
                    message.warning("替换元素只支持图片素材");
                    uploadTargetRef.current = null;
                    event.target.value = "";
                    return;
                }
                const replacementNode = nodesRef.current.find((node) => node.id === target.viralReplacement?.nodeId);
                const replacementElement = replacementNode?.metadata?.viralVideoReplacementLibrary?.elements.find((element) => element.id === target.viralReplacement?.elementId);
                if (!replacementElement) {
                    message.error("替换对象已失效，请重新选择");
                    uploadTargetRef.current = null;
                    event.target.value = "";
                    return;
                }
                const uploaded = await Promise.all(files.map((item) => uploadImage(item)));
                const assets: ViralVideoReplacementAsset[] = uploaded.map((image, index) => ({
                    id: nanoid(),
                    name: files[index].name,
                    content: image.url,
                    storageKey: image.storageKey,
                    mimeType: image.mimeType,
                    naturalWidth: image.width,
                    naturalHeight: image.height,
                    bytes: image.bytes,
                    recognitionStatus: "recognizing",
                }));
                resetViralWorkflowAfterUpload(target.viralReplacement.nodeId);
                setNodes((current) =>
                    current.map((node) => {
                        if (node.id !== target.viralReplacement?.nodeId) return node;
                        const library = node.metadata?.viralVideoReplacementLibrary || { collapsed: false, elements: [] };
                        return {
                            ...node,
                            metadata: {
                                ...node.metadata,
                                viralVideoReplacementLibrary: addViralVideoReplacementAssets(library, target.viralReplacement.elementId, assets),
                            },
                        };
                    }),
                );
                setSelectedNodeIds(new Set([target.viralReplacement.nodeId]));
                setSelectedConnectionId(null);
                let recognizedAssets: ViralVideoReplacementAsset[];
                let recognizedFingerprint: ViralVideoReplacementAsset["fingerprint"];
                try {
                    const prompt = buildViralVideoUploadRecognitionPrompt(assets.length, replacementElement);
                    if (!prompt) throw new Error("没有可识别的上传素材");
                    const recognitionConfig = buildGenerationConfig(effectiveConfig, undefined, "text");
                    if (!isAiConfigReady(recognitionConfig, recognitionConfig.model)) throw new Error("未配置支持图片理解的文本模型");
                    const content: AiTextContentPart[] = [{ type: "text", text: prompt }];
                    for (let index = 0; index < assets.length; index += 1) {
                        const dataUrl = await imageToDataUrl({ dataUrl: assets[index].content, storageKey: assets[index].storageKey });
                        content.push(
                            { type: "text", text: `参考图 ${index + 1}/${assets.length}｜${assets[index].name}` },
                            { type: "image_url", image_url: { url: dataUrl } },
                        );
                    }
                    const response = await requestImageQuestion(recognitionConfig, [{ role: "user", content }], () => undefined);
                    const recognition = parseViralVideoUploadRecognition(response, assets, `upload-${target.viralReplacement.elementId}`);
                    recognizedAssets = applyViralVideoUploadRecognition(assets, recognition);
                    recognizedFingerprint = recognition.fingerprint;
                    if (recognition.status === "recognized") message.success(`已识别替换素材：${recognition.fingerprint.name}`);
                    else message.warning(`替换素材需要确认：${recognition.issues.join("；")}`);
                } catch (error) {
                    const details = error instanceof Error ? error.message : "素材识别失败";
                    recognizedAssets = markViralVideoUploadRecognitionFailed(assets, details);
                    message.warning(`素材已保留，自动识别待确认：${details}`);
                }
                const recognizedById = new Map(recognizedAssets.map((asset) => [asset.id, asset]));
                setNodes((current) =>
                    current.map((node) => {
                        if (node.id !== target.viralReplacement?.nodeId) return node;
                        const library = node.metadata?.viralVideoReplacementLibrary || { collapsed: false, elements: [] };
                        const updatedLibrary: ViralVideoReplacementLibrary = {
                            ...library,
                            elements: library.elements.map((element) => {
                                if (element.id !== target.viralReplacement?.elementId) return element;
                                return {
                                    ...element,
                                    name: element.source === "manual" && recognizedFingerprint ? recognizedFingerprint.name : element.name,
                                    category: element.source === "manual" && recognizedFingerprint ? viralObjectKindLabel(recognizedFingerprint.kind) : element.category,
                                    description: element.source === "manual" && recognizedFingerprint ? describeViralVideoUploadFingerprint(recognizedFingerprint) : element.description,
                                    replacementFingerprint: recognizedFingerprint || element.replacementFingerprint,
                                    assets: element.assets.map((asset) => recognizedById.get(asset.id) || asset),
                                };
                            }),
                        };
                        const workflow = useCanvasStore.getState().projects.find((project) => project.id === projectId)?.workflow;
                        const analysis = workflow?.kind === "viral-video-remake" ? current.find((item) => item.id === workflow.analysisNodeId)?.metadata?.viralVideoAnalysis : undefined;
                        const boundLibrary = analysis ? refreshViralVideoReplacementBindings(updatedLibrary, analysis) : updatedLibrary;
                        return {
                            ...node,
                            metadata: {
                                ...node.metadata,
                                viralVideoReplacementLibrary: boundLibrary,
                            },
                        };
                    }),
                );
                uploadTargetRef.current = null;
                event.target.value = "";
                event.target.multiple = false;
                return;
            }
            if (target?.videoOnly && !file.type.startsWith("video/")) {
                message.warning("该素材位只支持视频");
                uploadTargetRef.current = null;
                event.target.value = "";
                return;
            }
            if (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !isAudioFile(file)) return;
            if (target?.imageOnly && !file.type.startsWith("image/")) {
                message.warning("该素材位只支持图片");
                uploadTargetRef.current = null;
                event.target.value = "";
                return;
            }

            if (target?.nodeId) {
                if (isAudioFile(file)) {
                    const audio = await uploadMediaFile(file, "audio");
                    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
                    resetViralWorkflowAfterUpload(target.nodeId);
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === target.nodeId
                                ? {
                                      ...node,
                                      type: CanvasNodeType.Audio,
                                      title: file.name,
                                      position: { x: node.position.x + node.width / 2 - spec.width / 2, y: node.position.y + node.height / 2 - spec.height / 2 },
                                      width: spec.width,
                                      height: spec.height,
                                      metadata: { ...node.metadata, ...audioMetadata(audio), errorDetails: undefined },
                                  }
                                : node,
                        ),
                    );
                    setSelectedNodeIds(new Set([target.nodeId]));
                    setSelectedConnectionId(null);
                    uploadTargetRef.current = null;
                    event.target.value = "";
                    return;
                }
                if (file.type.startsWith("video/")) {
                    const video = await uploadMediaFile(file, "video");
                    const nextSize = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                    resetViralWorkflowAfterUpload(target.nodeId);
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === target.nodeId
                                ? {
                                      ...node,
                                      type: CanvasNodeType.Video,
                                      title: file.name,
                                      position: { x: node.position.x + node.width / 2 - nextSize.width / 2, y: node.position.y + node.height / 2 - nextSize.height / 2 },
                                      width: nextSize.width,
                                      height: nextSize.height,
                                      metadata: { ...node.metadata, ...videoMetadata(video), errorDetails: undefined },
                                  }
                                : node,
                        ),
                    );
                    setSelectedNodeIds(new Set([target.nodeId]));
                    setSelectedConnectionId(null);
                    setDialogNodeId(target.nodeId);
                    uploadTargetRef.current = null;
                    event.target.value = "";
                    return;
                }
                const image = await uploadImage(file);
                const size = fitNodeSize(image.width, image.height);
                resetViralWorkflowAfterUpload(target.nodeId);
                setNodes((prev) =>
                    prev.map((node) =>
                        node.id === target.nodeId
                            ? {
                                  ...node,
                                  type: CanvasNodeType.Image,
                                  title: file.name,
                                  width: size.width,
                                  height: size.height,
                                  metadata: {
                                      ...node.metadata,
                                      ...imageMetadata(image),
                                      errorDetails: undefined,
                                      freeResize: false,
                                      isBatchRoot: undefined,
                                      batchRootId: undefined,
                                      batchChildIds: undefined,
                                      batchUsesReferenceImages: undefined,
                                      generationType: undefined,
                                      model: undefined,
                                      size: undefined,
                                      quality: undefined,
                                      count: undefined,
                                      references: undefined,
                                      primaryImageId: undefined,
                                      imageBatchExpanded: undefined,
                                  },
                              }
                            : node,
                    ),
                );
                setSelectedNodeIds(new Set([target.nodeId]));
                setSelectedConnectionId(null);
                setDialogNodeId(target.nodeId);
            } else {
                const position = target?.position || screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
                void (isAudioFile(file) ? createAudioFileNode(file, position) : file.type.startsWith("video/") ? createVideoFileNode(file, position) : createImageFileNode(file, position));
            }

            uploadTargetRef.current = null;
            event.target.value = "";
            event.target.multiple = false;
        },
        [createAudioFileNode, createImageFileNode, createVideoFileNode, message, resetViralWorkflowAfterUpload, screenToCanvas, size.height, size.width],
    );

    const analyzeViralVideo = async () => {
        const workflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
        if (!workflow || workflow.kind !== "viral-video-remake") return;
        if (viralRemakeBatch.running && !viralVideoLaunchRef.current && !viralVideoRunRef.current) return;
        if (viralVideoLaunchRef.current || viralVideoRunRef.current) invalidateViralVideoRun();
        const sourceNode = nodesRef.current.find((node) => node.id === workflow.sourceVideoNodeId);
        if (!sourceNode?.metadata?.content || sourceNode.type !== CanvasNodeType.Video || (sourceNode.metadata.mimeType && !sourceNode.metadata.mimeType.startsWith("video/"))) {
            message.warning("请先上传爆款参考视频");
            handleVideoUploadRequest(workflow.sourceVideoNodeId);
            return;
        }
        const analysisModel = selectNativeViralVideoAnalysisModel(effectiveConfig);
        const generationConfig = buildGenerationConfig({ ...effectiveConfig, textModel: analysisModel }, undefined, "text");
        if (!isAiConfigReady(generationConfig, generationConfig.model)) {
            message.warning("AI 拉片分析需要先配置文本模型");
            openConfigDialog(true);
            return;
        }

        const durationMs = sourceNode.metadata.durationMs;
        const sourceDurationSeconds = typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : undefined;
        viralAutoGenerateAfterPlanningRef.current = null;
        invalidateViralVideoRun();
        invalidateViralPromptRun();
        invalidateViralAnalysisRun();
        const requestId = `viral-analysis-request-${projectId}-${nanoid()}`;
        const controller = new AbortController();
        const run: ViralVideoAnalysisRun = {
            token: nanoid(),
            requestId,
            projectId,
            sourceNodeId: sourceNode.id,
            sourceContent: sourceNode.metadata.content,
            sourceStorageKey: sourceNode.metadata.storageKey,
            fallbackPhase: workflow.analysisNodeId ? "requirements_ready" : "idle",
            controller,
            stageTimer: null,
            committed: false,
        };
        viralAnalysisRunRef.current = run;
        startGenerationRequest(requestId, sourceNode.id, sourceNode.id, controller);
        setViralRemakeBatch({ running: true, stageLabel: viralVideoAnalysisStages[0], completed: 0, total: 2 });
        updateProject(run.projectId, { workflow: applyViralWorkflowEvents(workflow, [{ type: "START_RECOGNITION" }]) });

        try {
            const frameVideoUrl = (await resolveMediaUrl(sourceNode.metadata.storageKey, sourceNode.metadata.content)) || sourceNode.metadata.content;
            if (!isViralAnalysisRunCurrent(run)) return;
            if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
            if (!frameVideoUrl) throw new Error("参考视频读取失败：未能读取本地视频");

            let stageIndex = 0;
            run.stageTimer = setInterval(() => {
                if (!isViralAnalysisRunCurrent(run) || run.controller.signal.aborted) return;
                stageIndex = (stageIndex + 1) % viralVideoAnalysisStages.length;
                setViralRemakeBatch((state) => (state.running ? { ...state, stageLabel: viralVideoAnalysisStages[stageIndex] } : state));
            }, 4_000);
            viralAnalysisStageTimerRef.current = run.stageTimer;
            let requestPrompt = buildViralVideoAnalysisPrompt(sourceDurationSeconds);
            let requestContent: AiTextContentPart[];
            if (supportsNativeViralVideoInput(generationConfig)) {
                let videoDataUrl = "";
                try {
                    videoDataUrl = await mediaToDataUrl({ url: sourceNode.metadata.content, storageKey: sourceNode.metadata.storageKey, mimeType: sourceNode.metadata.mimeType });
                } catch (error) {
                    throw new Error(error instanceof Error ? `参考视频读取失败：${error.message}` : "参考视频读取失败");
                }
                if (!videoDataUrl || !videoDataUrl.startsWith("data:")) throw new Error("参考视频读取失败：未能获得可发送的视频 Data URI");
                requestContent = [{ type: "text", text: requestPrompt }, { type: "video_url", video_url: { url: videoDataUrl } }];
            } else {
                if (!sourceDurationSeconds) throw new Error("参考视频缺少可靠时长，无法抽帧分析，请重新上传视频");
                const sampledFrames: Array<{ timeSeconds: number; dataUrl: string }> = [];
                for (const timeSeconds of buildViralVideoAnalysisFrameTimes(sourceDurationSeconds)) {
                    if (!isViralAnalysisRunCurrent(run)) return;
                    if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
                    try {
                        const frameBlob = await captureVideoFrame(frameVideoUrl, timeSeconds);
                        const objectUrl = URL.createObjectURL(frameBlob);
                        try {
                            sampledFrames.push({ timeSeconds, dataUrl: await imageToDataUrl({ dataUrl: objectUrl }) });
                        } finally {
                            URL.revokeObjectURL(objectUrl);
                        }
                    } catch {
                        // 个别时间点解码失败时继续使用其余采样帧。
                    }
                }
                if (!sampledFrames.length) throw new Error("参考视频抽帧失败，未能获得可分析画面");
                requestPrompt = buildViralVideoAnalysisPrompt(sourceDurationSeconds, sampledFrames.map((frame) => frame.timeSeconds));
                requestContent = [{ type: "text", text: requestPrompt }];
                sampledFrames.forEach((frame, index) => {
                    requestContent.push(
                        { type: "text", text: `采样帧 ${index + 1}/${sampledFrames.length}｜原视频时间 ${frame.timeSeconds.toFixed(3)} 秒` },
                        { type: "image_url", image_url: { url: frame.dataUrl } },
                    );
                });
            }
            let analysisResponse = await requestImageQuestion(
                generationConfig,
                [{ role: "user", content: requestContent }],
                () => undefined,
                { signal: run.controller.signal },
            );
            if (!isViralAnalysisRunCurrent(run)) return;
            if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
            clearViralAnalysisRunTimer(run);
            let analysis: ViralVideoAnalysis;
            try {
                analysis = parseViralVideoAnalysis(analysisResponse, sourceDurationSeconds);
            } catch (error) {
                const details = error instanceof Error ? error.message : "返回结构无效";
                throw new Error(`模型 ${modelOptionName(generationConfig.model)} 未返回可用镜头结构。请确认该文本模型支持图片理解并能输出严格 JSON；${details}`);
            }
            let qualityIssues = findViralVideoAnalysisQualityIssues(analysis);
            if (qualityIssues.length) {
                setViralRemakeBatch((state) => ({ ...state, stageLabel: "正在细化动作节拍" }));
                const repairPrompt = buildViralVideoAnalysisRepairPrompt(analysisResponse, qualityIssues);
                analysisResponse = await requestImageQuestion(
                    generationConfig,
                    [{ role: "user", content: [...requestContent, { type: "text", text: repairPrompt }] }],
                    () => undefined,
                    { signal: run.controller.signal },
                );
                if (!isViralAnalysisRunCurrent(run)) return;
                if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
                try {
                    analysis = parseViralVideoAnalysis(analysisResponse, sourceDurationSeconds);
                } catch (error) {
                    const details = error instanceof Error ? error.message : "返回结构无效";
                    throw new Error(`动作节拍细化结果结构无效：${details}`);
                }
                qualityIssues = findViralVideoAnalysisQualityIssues(analysis);
                if (qualityIssues.length) throw new Error(`动作节拍细化仍未通过质量门禁：${qualityIssues.join("；")}`);
                requestPrompt += `\n\n## 条件细化提示词\n${repairPrompt}`;
            }
            setViralRemakeBatch((state) => ({ ...state, stageLabel: viralVideoAnalysisStages[viralVideoAnalysisStages.length - 1], completed: 1 }));

            if (!Array.isArray(analysis.shots) || analysis.shots.length < 1) {
                throw new Error("拉片返回缺少镜头结构，请重新分析");
            }

            const shotFrames: ViralVideoShotFrame[] = [];
            for (const shot of analysis.shots) {
                if (!isViralAnalysisRunCurrent(run)) return;
                if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");

                const shotIndex: number = Number.isInteger(shot.index) ? shot.index : shotFrames.length + 1;
                const shotTime =
                    Number.isFinite(shot.startSeconds) && Number.isFinite(shot.durationSeconds)
                        ? shot.startSeconds + shot.durationSeconds / 2
                        : Number.isFinite(shot.startSeconds)
                          ? shot.startSeconds
                          : Number.isFinite(shot.endSeconds)
                            ? shot.endSeconds
                            : 0;
                try {
                    const frameBlob = await captureVideoFrame(frameVideoUrl, Math.max(0, shotTime));
                    if (!isViralAnalysisRunCurrent(run)) return;
                    if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
                    const frame = await uploadImage(frameBlob);
                    if (!isViralAnalysisRunCurrent(run)) return;
                    if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
                    shotFrames.push({
                        shotIndex,
                        content: frame.url,
                        storageKey: frame.storageKey,
                        naturalWidth: frame.width,
                        naturalHeight: frame.height,
                        mimeType: frame.mimeType,
                    });
                } catch {
                    if (!isViralAnalysisRunCurrent(run)) return;
                    if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
                    shotFrames.push({ shotIndex });
                }
            }

            const analysisX = sourceNode.position.x + sourceNode.width + 120;
            if (!isViralAnalysisRunCurrent(run)) return;
            if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");

            if (!isViralAnalysisRunCurrent(run)) return;
            if (run.controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
            const nextNodes = nodesRef.current.map((node) => {
                    if (node.id !== workflow.replacementNodeId) return node;
                    const currentLibrary = node.metadata?.viralVideoReplacementLibrary || { collapsed: false, elements: [] };
                    return {
                        ...node,
                        title: "复刻素材与对象识别",
                        position: { x: analysisX, y: sourceNode.position.y },
                        width: 1320,
                        height: 820,
                        metadata: {
                            ...node.metadata,
                            viralVideoAnalysis: analysis,
                            viralVideoShotFrames: shotFrames,
                            viralVideoPlannerPrompt: requestPrompt,
                            viralVideoReplacementLibrary: mergeViralVideoReplacementLibrary(currentLibrary, analysis),
                        },
                    };
                });
            const nextConnections = [...connectionsRef.current.filter((connection) => connection.toNodeId !== workflow.replacementNodeId), { id: nanoid(), fromNodeId: sourceNode.id, toNodeId: workflow.replacementNodeId }];
            nodesRef.current = nextNodes;
            connectionsRef.current = nextConnections;
            setNodes(nextNodes);
            setConnections(nextConnections);
            setSelectedNodeIds(new Set([workflow.replacementNodeId]));
            setSelectedConnectionId(null);
            updateProject(run.projectId, {
                nodes: nextNodes,
                connections: nextConnections,
                workflow: {
                    ...applyViralWorkflowEvents(workflow, [{ type: "RECOGNITION_SUCCEEDED" }]),
                    analysisNodeId: workflow.replacementNodeId,
                    phase: "requirements_ready",
                    promptNodeIds: undefined,
                    masterPromptNodeId: undefined,
                    outputNodeIds: undefined,
                },
            });
            run.committed = true;
            setViralRemakeBatch({ running: false, stageLabel: viralVideoAnalysisStages[viralVideoAnalysisStages.length - 1], completed: 2, total: 2 });
            message.success(`拉片分析完成：${analysis.mustKeepEvents.length} 个必保事件，${analysis.objects.length} 个稳定对象`);
        } catch (error) {
            if (!isViralAnalysisRunCurrent(run)) return;
            const errorDetails = error instanceof Error ? error.message : "AI 拉片分析失败";
            if (isGenerationCanceled(error)) message.warning(errorDetails);
            else message.error(`AI 拉片分析失败：${errorDetails}`);
        } finally {
            const isLatestRun = viralAnalysisRunRef.current?.token === run.token;
            clearViralAnalysisRunTimer(run);
            if (!run.committed && isLatestRun) {
                restoreViralAnalysisRunPhase(run);
                run.controller.abort();
            }
            finishGenerationRequest(run.requestId, run.controller);
            if (viralAnalysisRunRef.current?.token === run.token) viralAnalysisRunRef.current = null;
            if (canvasMountedRef.current && activeProjectIdRef.current === run.projectId && isLatestRun) setViralRemakeBatch((state) => ({ ...state, running: false }));
        }
    };

    const activateViralVideoRemake = () => {
        const existingWorkflow = currentProject?.workflow;
        if (existingWorkflow?.kind === "viral-video-remake") {
            const sourceNode = nodesRef.current.find((node) => node.id === existingWorkflow.sourceVideoNodeId);
            if (sourceNode?.type === CanvasNodeType.Video && sourceNode.metadata?.content) void analyzeViralVideo();
            else handleVideoUploadRequest(existingWorkflow.sourceVideoNodeId);
            return;
        }
        if (existingWorkflow) {
            const nextProjectId = importProject(buildViralVideoRemakeProject());
            navigate(`/canvas/${nextProjectId}`);
            return;
        }

        const sourceNode = nodesRef.current.find(
            (node) => selectedNodeIdsRef.current.has(node.id) && node.type === CanvasNodeType.Video && Boolean(node.metadata?.content),
        );
        if (!sourceNode) {
            const nextProjectId = importProject(buildViralVideoRemakeProject());
            navigate(`/canvas/${nextProjectId}`);
            return;
        }

        try {
            const activation = buildViralVideoRemakeActivation(nodesRef.current, sourceNode.id);
            invalidateViralVideoRun();
            invalidateViralPromptRun();
            invalidateViralAnalysisRun();
            nodesRef.current = activation.nodes;
            setNodes(activation.nodes);
            setSelectedNodeIds(new Set([sourceNode.id, activation.workflow.replacementNodeId]));
            setSelectedConnectionId(null);
            updateProject(projectId, { nodes: activation.nodes, workflow: activation.workflow });
            queueMicrotask(() => void analyzeViralVideo());
        } catch (error) {
            message.error(error instanceof Error ? error.message : "无法启动爆款复刻");
        }
    };

    const activateUniversalRemake = () => {
        const existingWorkflow = currentProject?.workflow;
        if (existingWorkflow?.kind === "universal-viral-remake-beta") {
            setSelectedNodeIds(new Set([existingWorkflow.referenceNodeId, existingWorkflow.bindingsNodeId, existingWorkflow.templateNodeId, existingWorkflow.runNodeId, existingWorkflow.resultsNodeId]));
            return;
        }
        const selectedSource = nodesRef.current.find((node) => selectedNodeIdsRef.current.has(node.id) && node.type === CanvasNodeType.Video && Boolean(node.metadata?.content));
        const base = buildUniversalRemakeBetaProject();
        const prepared = selectedSource ? attachUniversalRemakeReference(base, selectedSource) : base;
        if (existingWorkflow || nodesRef.current.length) {
            const nextProjectId = importProject(prepared);
            navigate(`/canvas/${nextProjectId}`);
            return;
        }
        nodesRef.current = prepared.nodes;
        connectionsRef.current = prepared.connections;
        setNodes(prepared.nodes);
        setConnections(prepared.connections);
        setViewport(prepared.viewport);
        setSelectedNodeIds(new Set([prepared.workflow.referenceNodeId]));
        updateProject(projectId, { nodes: prepared.nodes, connections: prepared.connections, workflow: prepared.workflow, viewport: prepared.viewport });
    };

    const patchUniversalWorkflow = (patch: Partial<Extract<CanvasWorkflowState, { kind: "universal-viral-remake-beta" }>>) => {
        const project = useCanvasStore.getState().projects.find((item) => item.id === projectId);
        if (project?.workflow?.kind !== "universal-viral-remake-beta") return;
        updateProject(projectId, { workflow: { ...project.workflow, ...patch } });
    };

    const analyzeUniversalRemake = async () => {
        const workflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
        if (workflow?.kind !== "universal-viral-remake-beta" || universalRemakeBusy) return;
        const sourceNode = nodesRef.current.find((node) => node.id === workflow.referenceNodeId);
        const videoUrl = sourceNode?.metadata?.content;
        if (!videoUrl) return void handleVideoUploadRequest(workflow.referenceNodeId);
        const understandingModel = selectNativeViralVideoAnalysisModel(effectiveConfig);
        const textConfig = buildGenerationConfig({ ...effectiveConfig, textModel: understandingModel }, undefined, "text");
        if (!isAiConfigReady(textConfig, textConfig.model)) {
            openConfigDialog(true);
            return;
        }
        setUniversalRemakeBusy(true);
        patchUniversalWorkflow({ phase: "analyzing", error: undefined, template: undefined, summary: undefined, activeRunId: undefined });
        try {
            const durationSeconds = sourceNode.metadata?.durationMs ? sourceNode.metadata.durationMs / 1000 : await readVideoDuration(videoUrl);
            const storyboard = await createUniversalStoryboard(videoUrl, durationSeconds);
            const storyboardBlob = await (await fetch(storyboard.dataUrl)).blob();
            const storyboardFile = new File([storyboardBlob], "source-storyboard.jpg", { type: storyboardBlob.type || "image/jpeg" });
            const storyboardArtifact = await uploadCanvasArtifact(projectId, storyboardFile, storyboardFile.name);
            let nativeVideoDataUrl: string | undefined;
            if (supportsNativeViralVideoInput(textConfig)) {
                nativeVideoDataUrl = await mediaToDataUrl({
                    url: videoUrl,
                    storageKey: sourceNode.metadata?.storageKey,
                    mimeType: sourceNode.metadata?.mimeType || "video/mp4",
                });
                if (!nativeVideoDataUrl?.startsWith("data:video/")) throw new Error("原生视频拉片失败：未能获得可发送的视频 Data URI");
            }
            const evidence = [
                ...(nativeVideoDataUrl ? [{
                    id: "native-video-1", atSeconds: 0, kind: "video" as const, artifactId: sourceNode.metadata?.storageKey,
                    description: `完整原生参考视频，连续时长 ${durationSeconds.toFixed(3)} 秒；用于确认姿态变化、动作路径、接触、释放、声音和镜头连续性。`,
                }] : []),
                {
                    id: "storyboard-1", atSeconds: 0, kind: "frame" as const, artifactId: storyboardArtifact.uri,
                    description: `一张按时间顺序排列的全局故事板，共 ${storyboard.times.length} 帧，时间点为 ${storyboard.times.map((time) => time.toFixed(2)).join("、")} 秒；用于复核实体、构图与关键状态。`,
                },
            ];
            const source = { sourceVideoId: sourceNode.metadata?.storageKey || sourceNode.id, durationSeconds, aspectRatio: sourceNode.width < sourceNode.height ? "9:16" : sourceNode.width === sourceNode.height ? "1:1" : "16:9", evidence };
            const understandingPort = {
                understandVideo: async (request: { prompt: string }) => {
                    const content: AiTextContentPart[] = [{ type: "text", text: request.prompt }];
                    if (nativeVideoDataUrl) content.push({ type: "video_url", video_url: { url: nativeVideoDataUrl } });
                    content.push(
                        { type: "text", text: "以下故事板只用于时间点和静态构图复核；动作结论优先依据完整原生视频。" },
                        { type: "image_url", image_url: { url: storyboard.dataUrl } },
                    );
                    return requestImageQuestion(textConfig, [{ role: "user", content }], () => undefined);
                },
            };
            const initial = await reconstructUniversalSource(source, understandingPort);
            const reconstruction = await verifyUniversalSourceReconstruction(source, initial, understandingPort);
            const sourceAnchorTimes = buildUniversalSourceAnchorTimes(reconstruction);
            const sourceAnchorArtifactIds = await Promise.all(sourceAnchorTimes.map(async (time, index) => {
                const frame = await captureVideoFrame(videoUrl, time);
                const artifact = await uploadCanvasArtifact(projectId, frame, `source-anchor-${String(index + 1).padStart(2, "0")}-${time.toFixed(3)}s.jpg`);
                return artifact.uri;
            }));
            const explicitBindings = workflow.reconstruction
                ? remapUniversalExplicitBindings(workflow.reconstruction.entities, reconstruction.entities, workflow.explicitBindings)
                : [];
            patchUniversalWorkflow({ phase: "analyzed", reconstruction, explicitBindings, sourceReferenceAssetIds: [storyboardArtifact.uri, ...sourceAnchorArtifactIds], error: undefined });
            message.success(`通用拉片完成：${reconstruction.timelineUnits.length} 个语义单元，已通过独立复核`);
        } catch (error) {
            const details = error instanceof Error ? error.message : "通用拉片失败";
            patchUniversalWorkflow({ phase: "failed", error: details });
            message.error(details);
        } finally { setUniversalRemakeBusy(false); }
    };

    useEffect(() => {
        const workflow = currentProject?.workflow;
        if (!projectLoaded || universalRemakeBusy || workflow?.kind !== "universal-viral-remake-beta" || workflow.phase !== "failed" || !workflow.error) return;
        if (!/原片重建自动修复后仍不合格|原片重建的通用能力检查不完整/.test(workflow.error)) return;
        const retryKey = `${projectId}:${workflow.error}`;
        if (stalledUniversalValidationRetryRef.current === retryKey) return;
        stalledUniversalValidationRetryRef.current = retryKey;
        void analyzeUniversalRemake();
    }, [currentProject?.workflow, projectId, projectLoaded, universalRemakeBusy]);

    const addUniversalReplacementFiles = async (files: File[], preferredSourceEntityId?: string) => {
        const workflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
        if (workflow?.kind !== "universal-viral-remake-beta" || universalRemakeBusy) return;
        const preferredSourceEntity = preferredSourceEntityId ? workflow.reconstruction?.entities.find((entity) => entity.id === preferredSourceEntityId) : undefined;
        if (preferredSourceEntityId && !preferredSourceEntity) return void message.error("原片对象不存在，请重新拉片");
        const understandingModel = selectNativeViralVideoAnalysisModel(effectiveConfig);
        const textConfig = buildGenerationConfig({ ...effectiveConfig, textModel: understandingModel }, undefined, "text");
        setUniversalRemakeBusy(true);
        try {
            const uploaded = await Promise.all(files.map(async (file) => {
                const [image, artifact] = await Promise.all([uploadImage(file), uploadCanvasArtifact(projectId, file, file.name)]);
                return { file, image, artifact };
            }));
            let recognized: Array<{ kind: UniversalReplacementEntity["kind"]; identityFacts: string }> = [];
            if (isAiConfigReady(textConfig, textConfig.model)) {
                const content: AiTextContentPart[] = [{ type: "text", text: "Identify each uploaded replacement asset independently. Return only a JSON array in the same order. Each item: {kind:'product'|'person'|'scene'|'vehicle'|'wardrobe'|'animal'|'prop'|'other',identityFacts:string}. Describe stable visible identity, not desired actions. identityFacts 必须使用简体中文，kind 枚举保持英文。" }];
                for (const item of uploaded) content.push({ type: "image_url", image_url: { url: await imageToDataUrl({ dataUrl: item.image.url, storageKey: item.image.storageKey }) } });
                recognized = parseUniversalReplacementRecognition(await requestImageQuestion(textConfig, [{ role: "user", content }], () => undefined), uploaded.length);
            }
            const replacements: UniversalReplacementEntity[] = uploaded.map((item, index) => ({
                id: nanoid(), kind: preferredSourceEntity?.kind || recognized[index]?.kind || "other", identityFacts: recognized[index]?.identityFacts || item.file.name,
                referenceAssetIds: [item.artifact.uri], confidence: recognized[index] ? 0.9 : 0.5,
            }));
            const assets = uploaded.map((item, index) => ({ id: replacements[index].id, name: item.file.name, content: item.image.url, storageKey: item.image.storageKey, mimeType: item.image.mimeType }));
            const explicitBindings = preferredSourceEntity
                ? [...workflow.explicitBindings, ...replacements.map((replacement) => ({ sourceEntityId: preferredSourceEntity.id, replacementEntityId: replacement.id }))]
                : workflow.explicitBindings;
            patchUniversalWorkflow({
                phase: workflow.reconstruction ? "analyzed" : workflow.phase,
                replacements: [...workflow.replacements, ...replacements], replacementAssets: [...workflow.replacementAssets, ...assets],
                explicitBindings, template: undefined, summary: undefined, error: undefined,
            });
            message.success(preferredSourceEntity ? `已为 ${preferredSourceEntity.placeholderId} 绑定 ${files.length} 个替换素材` : `已识别并托管 ${files.length} 个替换素材`);
        } catch (error) { message.error(error instanceof Error ? error.message : "替换素材处理失败"); }
        finally { setUniversalRemakeBusy(false); }
    };

    const bindUniversalReplacement = (replacementEntityId: string, sourceEntityId: string) => {
        const workflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
        if (workflow?.kind !== "universal-viral-remake-beta") return;
        const sourceEntity = workflow.reconstruction?.entities.find((entity) => entity.id === sourceEntityId);
        if (!sourceEntity) return void message.error("原片对象不存在，请重新拉片");
        const explicitBindings = [...workflow.explicitBindings.filter((binding) => binding.replacementEntityId !== replacementEntityId), { sourceEntityId, replacementEntityId }];
        const replacements = workflow.replacements.map((replacement) => replacement.id === replacementEntityId ? { ...replacement, kind: sourceEntity.kind } : replacement);
        patchUniversalWorkflow({ explicitBindings, replacements, template: undefined, summary: undefined, phase: workflow.reconstruction ? "analyzed" : workflow.phase });
        message.success(`已确认替换 ${sourceEntity.placeholderId}`);
    };

    const compileUniversalTemplate = async () => {
        const workflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
        if (workflow?.kind !== "universal-viral-remake-beta" || !workflow.reconstruction || universalRemakeBusy) return;
        const planningModel = selectNativeViralVideoAnalysisModel(effectiveConfig);
        const textConfig = buildGenerationConfig({ ...effectiveConfig, textModel: planningModel }, undefined, "text");
        if (!isAiConfigReady(textConfig, textConfig.model)) {
            openConfigDialog(true);
            return;
        }
        setUniversalRemakeBusy(true);
        patchUniversalWorkflow({ phase: "analyzed", error: undefined });
        try {
            const grouped = new Map<string, UniversalReplacementEntity[]>();
            for (const binding of workflow.explicitBindings) {
                const replacement = workflow.replacements.find((item) => item.id === binding.replacementEntityId);
                if (replacement) grouped.set(binding.sourceEntityId, [...(grouped.get(binding.sourceEntityId) || []), replacement]);
            }
            const baseIds = new Set<string>();
            const explicitBindings = [...grouped.entries()].map(([sourceEntityId, replacements]) => {
                baseIds.add(replacements[0].id);
                return { sourceEntityId, replacementEntityId: replacements[0].id };
            });
            const unbound = workflow.replacements.filter((replacement) => !workflow.explicitBindings.some((binding) => binding.replacementEntityId === replacement.id));
            unbound.forEach((replacement) => baseIds.add(replacement.id));
            const replacements = workflow.replacements.filter((replacement) => baseIds.has(replacement.id));
            const variableSlots = [...grouped.entries()].flatMap(([sourceEntityId, options]) => {
                if (options.length < 2) return [];
                const source = workflow.reconstruction?.entities.find((entity) => entity.id === sourceEntityId);
                return source ? [{ id: `slot-${sourceEntityId}`, targetPlaceholderId: source.placeholderId, options: options.map((item) => ({ id: item.id, identityFacts: item.identityFacts, referenceAssetIds: item.referenceAssetIds })) }] : [];
            });
            const capabilities = { modelId: modelOptionName(effectiveConfig.videoModel) || effectiveConfig.videoModel || "video-model", maxDurationSeconds: workflow.maxSegmentDurationSeconds, supportsContinuationFrame: true, generatesAudio: effectiveConfig.videoGenerateAudio !== "false" };
            const preparation = compileVerifiedUniversalRemake({ reconstruction: workflow.reconstruction, replacements, explicitBindings, patches: [], recipe: { count: workflow.candidateCount, seed: Date.now(), variableSlots }, capabilities });
            if (preparation.status !== "ready") throw new Error(preparation.issues.join("；"));
            const prepared = {
                ...preparation,
                template: withUniversalSourceVisualAnchors(
                    preparation.template,
                    workflow.sourceReferenceAssetIds || [],
                    buildUniversalSourceAnchorTimes(workflow.reconstruction),
                ),
            };
            const content: AiTextContentPart[] = [{ type: "text", text: createUniversalDirectorPromptRequest(prepared.template) }];
            for (const replacement of replacements) {
                const asset = workflow.replacementAssets.find((item) => item.id === replacement.id);
                const sourceBinding = explicitBindings.find((binding) => binding.replacementEntityId === replacement.id);
                const sourceEntity = sourceBinding ? workflow.reconstruction.entities.find((entity) => entity.id === sourceBinding.sourceEntityId) : undefined;
                if (!asset || !sourceEntity) continue;
                const dataUrl = await imageToDataUrl({ dataUrl: asset.content, storageKey: asset.storageKey });
                content.push(
                    { type: "text", text: `目标视觉参考｜${sourceEntity.placeholderId}｜${replacement.identityFacts}` },
                    { type: "image_url", image_url: { url: dataUrl } },
                );
            }
            let directorResponse = "";
            let directorPromptPlan;
            let repairError: unknown;
            while (!directorPromptPlan) {
                directorResponse = await requestImageQuestion(textConfig, [{
                    role: "user",
                    content: repairError
                        ? [...content, { type: "text", text: createUniversalDirectorPromptRepairRequest(prepared.template, directorResponse, repairError) }]
                        : content,
                }], () => undefined);
                try {
                    directorPromptPlan = parseUniversalDirectorPromptPlan(directorResponse, prepared.template);
                } catch (validationError) {
                    repairError = validationError;
                }
            }
            const templateWithDirector = { ...prepared.template, directorPromptPlan };
            const candidates = compileUniversalRemakeCandidates(templateWithDirector, { count: workflow.candidateCount, seed: Date.now(), variableSlots }, capabilities);
            const template = {
                ...templateWithDirector,
                compiledPromptPreview: candidates[0]?.segments.map((segment) => segment.prompt).join("\n\n===== NEXT GENERATED SEGMENT =====\n\n") ?? "",
            };
            patchUniversalWorkflow({ phase: "template-ready", template, summary: summarizeUniversalRemakeBatch(candidates), variableSlots, error: undefined });
            message.success(`一键成片导演提示词已生成：${template.segmentPlan.segments.length} 个连续生成片段`);
        } catch (error) {
            const details = error instanceof Error ? error.message : "复刻母版编译失败";
            patchUniversalWorkflow({ phase: "analyzed", error: details });
            message.error(details);
        } finally { setUniversalRemakeBusy(false); }
    };

    const updateUniversalSettings = (patch: { candidateCount?: number; maxInFlight?: number; maxSegmentDurationSeconds?: number }) => {
        const workflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
        if (workflow?.kind !== "universal-viral-remake-beta") return;
        const next = {
            candidateCount: Math.max(1, Math.min(1000, Math.floor(patch.candidateCount ?? workflow.candidateCount))),
            maxInFlight: Math.max(1, Math.min(20, Math.floor(patch.maxInFlight ?? workflow.maxInFlight))),
            maxSegmentDurationSeconds: Math.max(1, Math.min(60, patch.maxSegmentDurationSeconds ?? workflow.maxSegmentDurationSeconds)),
        };
        let summary = workflow.summary;
        if (workflow.template && patch.candidateCount !== undefined) {
            const capabilities = { modelId: workflow.template.id, maxDurationSeconds: next.maxSegmentDurationSeconds, supportsContinuationFrame: true, generatesAudio: true };
            summary = summarizeUniversalRemakeBatch(compileUniversalRemakeCandidates(workflow.template, { count: next.candidateCount, seed: 1, variableSlots: workflow.variableSlots }, capabilities));
        }
        patchUniversalWorkflow({ ...next, summary });
    };

    const generateUniversalRemake = async () => {
        const workflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
        if (workflow?.kind !== "universal-viral-remake-beta" || !workflow.template || universalRemakeBusy) return;
        if (!isGatewayConfigured) return void message.error("后台批量生成需要先配置 Gateway");
        if (!workflow.template.directorPromptPlan) return void message.error("当前仍是旧版审计提示词，请重新生成复刻母版后再提交");
        const baseVideoConfig = buildGenerationConfig(effectiveConfig, undefined, "video");
        const videoModel = modelOptionName(baseVideoConfig.videoModel) || baseVideoConfig.videoModel;
        if (!videoModel) { openConfigDialog(true); return; }
        setUniversalRemakeBusy(true);
        patchUniversalWorkflow({ phase: "submitting", error: undefined });
        try {
            const recipe = { count: workflow.candidateCount, seed: Date.now(), variableSlots: workflow.variableSlots };
            const executionTemplate = withUniversalSourceVisualAnchors(
                workflow.template,
                workflow.sourceReferenceAssetIds || [],
                workflow.reconstruction ? buildUniversalSourceAnchorTimes(workflow.reconstruction) : [],
            );
            const baseCapabilities = { modelId: videoModel, maxDurationSeconds: workflow.maxSegmentDurationSeconds, supportsContinuationFrame: true, generatesAudio: effectiveConfig.videoGenerateAudio !== "false" };
            const provisionalCandidates = compileUniversalRemakeCandidates(executionTemplate, recipe, baseCapabilities);
            let maxSegmentDurationSeconds = 1;
            let maxReferenceImages = 0;
            for (const candidate of provisionalCandidates) {
                for (const segment of candidate.segments) {
                    maxSegmentDurationSeconds = Math.max(maxSegmentDurationSeconds, segment.durationSeconds);
                    maxReferenceImages = Math.max(maxReferenceImages, segment.referenceAssetIds.length);
                }
            }
            const routed = resolveAutoDlH3CanvasVideoConfig(baseVideoConfig, {
                imageCount: maxReferenceImages,
                audioCount: 0,
                videoCount: 0,
                duration: String(Math.ceil(maxSegmentDurationSeconds)),
                mode: "auto",
            }, gatewayModelCatalogEntries(baseVideoConfig.videoModels));
            const routedModelName = modelOptionName(routed.model);
            const binding = await resolveCanvasJobModelBinding(routedModelName, "video");
            const capabilities = { ...baseCapabilities, modelId: routedModelName };
            const candidates = routedModelName === videoModel ? provisionalCandidates : compileUniversalRemakeCandidates(executionTemplate, recipe, capabilities);
            if (routed.autoSelected) message.info(`已自动选择：${routed.displayName}`);
            const run = await createUniversalRemakeRun({
                canvasId: projectId, targetNodeId: workflow.resultsNodeId, generationRevision: 1,
                clientRequestId: `universal-remake:${projectId}:${executionTemplate.id}:${Date.now()}`, templateId: executionTemplate.id,
                modelId: binding.bindingId, channelId: binding.channelId, maxInFlight: workflow.maxInFlight, candidates,
            });
            setUniversalRemakeRun(run);
            patchUniversalWorkflow({ phase: "running", activeRunId: run.id });
            message.success(`已提交 ${candidates.length} 条完整成片；长视频分段将在后台自动合成`);
        } catch (error) {
            const details = error instanceof Error ? error.message : "通用复刻提交失败";
            patchUniversalWorkflow({ phase: "failed", error: details });
            message.error(details);
        } finally { setUniversalRemakeBusy(false); }
    };

    const generateViralVideoPrompts = async () => {
        const workflow = currentProject?.workflow;
        if (!workflow || workflow.kind !== "viral-video-remake") return;
        if (viralRemakeBatch.running && !viralVideoLaunchRef.current && !viralVideoRunRef.current) return;
        if (viralVideoLaunchRef.current || viralVideoRunRef.current) invalidateViralVideoRun();
        const sourceNode = nodesRef.current.find((node) => node.id === workflow.sourceVideoNodeId);
        const replacementNode = nodesRef.current.find((node) => node.id === workflow.replacementNodeId);
        const replacementLibrary = replacementNode?.metadata?.viralVideoReplacementLibrary || { collapsed: false, elements: [] };
        const replacementAssets = listViralVideoReplacementAssets(replacementLibrary);
        const analysisNode = nodesRef.current.find((node) => node.id === workflow.analysisNodeId);
        const storedAnalysis = analysisNode?.metadata?.viralVideoAnalysis;
        if (!workflow.analysisNodeId || !analysisNode || !storedAnalysis) {
            message.warning("请先完成拉片分析，再生成复刻方案");
            return;
        }
        if (!sourceNode?.metadata?.content) {
            message.warning("爆款参考视频已丢失，请重新上传并分析");
            return;
        }
        const durationMs = sourceNode.metadata.durationMs;
        const sourceDurationSeconds = typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : undefined;
        let analysis: ViralVideoAnalysis;
        try {
            analysis = parseViralVideoAnalysis(JSON.stringify(storedAnalysis), sourceDurationSeconds);
        } catch (error) {
            message.error(error instanceof Error ? `拉片结构无效：${error.message}` : "拉片结构无效，请重新分析");
            return;
        }
        const textGenerationConfig = buildGenerationConfig(effectiveConfig, undefined, "text");
        if (!isAiConfigReady(textGenerationConfig, textGenerationConfig.model)) {
            message.warning("生成复刻方案需要先配置文本模型");
            openConfigDialog(true);
            return;
        }
        const planCount = 1;
        const maxSegmentSeconds = getViralVideoMaxSegmentSeconds(buildGenerationConfig(effectiveConfig, undefined, "video"));
        const run: ViralVideoPromptRun = {
            token: nanoid(),
            projectId,
            sourceVideoNodeId: sourceNode.id,
            sourceContent: sourceNode.metadata.content,
            sourceStorageKey: sourceNode.metadata.storageKey,
            replacementNodeId: workflow.replacementNodeId,
            replacementSnapshotJson: viralVideoReplacementSnapshot(replacementNode),
            analysisNodeId: analysisNode.id,
            analysisJson: JSON.stringify(storedAnalysis),
            replacementBrief: workflow.replacementBrief,
            planCount,
            controllers: new Map(),
            committed: false,
        };
        invalidateViralVideoRun();
        invalidateViralPromptRun();
        viralPromptRunRef.current = run;
        setViralRemakeBatch({ running: true, stageLabel: "正在生成唯一复刻母版", completed: 0, total: planCount });
        updateProject(projectId, {
            workflow: {
                ...applyViralWorkflowEvents(workflow, [{ type: "START_TEMPLATING" }]),
                phase: "templating",
                promptNodeIds: undefined,
                masterPromptNodeId: undefined,
                outputNodeIds: undefined,
            },
        });

        try {
            const replacementImages = await Promise.all(
                replacementAssets.map(async ({ asset, element, referenceIndex }) => {
                    try {
                        const dataUrl = await imageToDataUrl({ dataUrl: asset.content, storageKey: asset.storageKey });
                        if (!dataUrl.startsWith("data:")) throw new Error("未能获得可发送的图片 Data URI");
                        return { asset, element, referenceIndex, dataUrl };
                    } catch (error) {
                        throw new Error(error instanceof Error ? `替换素材“${asset.name}”读取失败：${error.message}` : `替换素材“${asset.name}”读取失败`);
                    }
                }),
            );
            if (!isViralPromptRunCurrent(run)) return;

            const generationSeed = Date.now();
            const results: Array<{ variantIndex: number; plannerPrompt: string; plan: ViralVideoPromptPlan } | undefined> = Array(planCount);
            const failures: Array<{ variantIndex: number; error: string }> = [];
            let cursor = 0;
            let completed = 0;
            const plannerWorker = async () => {
                while (cursor < planCount && isViralPromptRunCurrent(run)) {
                    const variantIndex = cursor++;
                    const plannerPrompt = buildViralVideoPromptPlannerPrompt({
                        analysis,
                        replacementBrief: run.replacementBrief,
                        replacementAssetCount: replacementImages.length,
                        replacementManifest: buildViralVideoReplacementManifest(replacementLibrary),
                        maxSegmentSeconds,
                        variantIndex,
                        totalVariants: planCount,
                        generationSeed: generationSeed + variantIndex,
                    });
                    const requestId = `viral-prompt-request-${run.projectId}-${run.token}-${variantIndex}`;
                    const controller = new AbortController();
                    run.controllers.set(requestId, controller);
                    startGenerationRequest(requestId, run.analysisNodeId, run.analysisNodeId, controller);
                    try {
                        const content: AiTextContentPart[] = [{ type: "text", text: plannerPrompt }];
                        replacementImages.forEach(({ dataUrl, element, referenceIndex }) => {
                            content.push(
                                { type: "text", text: `参考图 ${referenceIndex}｜绑定对象：${element.category}「${element.name}」` },
                                { type: "image_url", image_url: { url: dataUrl } },
                            );
                        });
                        const plannerResponse = await requestImageQuestion(textGenerationConfig, [{ role: "user", content }], () => undefined, { signal: controller.signal });
                        if (!isViralPromptRunCurrent(run) || controller.signal.aborted) return;
                        results[variantIndex] = { variantIndex, plannerPrompt, plan: parseViralVideoPromptPlan(plannerResponse, analysis, maxSegmentSeconds) };
                    } catch (error) {
                        if (isViralPromptRunCurrent(run) && !isGenerationCanceled(error)) {
                            failures.push({ variantIndex, error: error instanceof Error ? error.message : "生成复刻方案失败" });
                        }
                    } finally {
                        finishGenerationRequest(requestId, controller);
                        run.controllers.delete(requestId);
                        if (isViralPromptRunCurrent(run)) {
                            completed += 1;
                            setViralRemakeBatch((state) => ({ ...state, completed }));
                        }
                    }
                }
            };
            await Promise.all(Array.from({ length: planCount }, () => plannerWorker()));
            if (!isViralPromptRunCurrent(run)) return;

            const successfulResults = results.filter((result): result is NonNullable<typeof result> => Boolean(result));
            if (!successfulResults.length) {
                const latestProject = useCanvasStore.getState().projects.find((item) => item.id === run.projectId);
                const latestWorkflow = latestProject?.workflow;
                if (latestWorkflow?.kind === "viral-video-remake") {
                    updateProject(run.projectId, { workflow: { ...latestWorkflow, phase: "requirements_ready", promptNodeIds: undefined, masterPromptNodeId: undefined, outputNodeIds: undefined } });
                }
                run.committed = true;
                const reason = failures[0]?.error || "文本模型未返回有效方案";
                setViralRemakeBatch({ running: false, stageLabel: reason, completed, total: planCount });
                message.error(`复刻方案生成失败：${reason}`);
                return;
            }

            const replacementNode = nodesRef.current.find((node) => node.id === run.replacementNodeId);
            const promptX = (replacementNode?.position.x || sourceNode.position.x + sourceNode.width + 120) + (replacementNode?.width || 1320) + 120;
            const promptNodes: CanvasNodeData[] = [];
            const promptConnections: CanvasConnection[] = [];
            const replacementManifest = buildViralVideoReplacementManifest(replacementLibrary);
            successfulResults.forEach(({ variantIndex, plannerPrompt, plan }, successPosition) => {
                const bindings = replacementLibrary.elements.flatMap((element) => (element.binding ? [element.binding] : []));
                const template = buildViralRemakeTemplate(analysis, bindings, plan);
                if (!template.coverage.passed) throw new Error(`复刻母版未覆盖全部关键事件：${template.coverage.issues.join("；")}`);
                const masterPrompt = buildViralVideoMasterPrompt(plan.masterPrompt, run.replacementBrief, replacementManifest);
                const templateNode = buildViralVideoTemplateNode({
                    id: nanoid(),
                    position: {
                        x: promptX,
                        y: sourceNode.position.y + successPosition * (VIRAL_VIDEO_TEMPLATE_NODE_SIZE.height + 120),
                    },
                    template,
                    plan,
                    masterPrompt,
                    plannerPrompt,
                });
                promptNodes.push(templateNode);
                promptConnections.push({ id: nanoid(), fromNodeId: analysisNode.id, toNodeId: templateNode.id });
                if (replacementImages.length && run.replacementNodeId !== analysisNode.id) promptConnections.push({ id: nanoid(), fromNodeId: run.replacementNodeId, toNodeId: templateNode.id });
                promptConnections.push({ id: nanoid(), fromNodeId: templateNode.id, toNodeId: workflow.batchNodeId });
                promptConnections.push({ id: nanoid(), fromNodeId: workflow.batchNodeId, toNodeId: workflow.resultsNodeId });
            });
            if (!isViralPromptRunCurrent(run)) return;
            const oldPromptNodeIds = new Set(nodesRef.current.filter((node) => Boolean(node.metadata?.viralVideoPromptRole)).map((node) => node.id));
            const nextNodes = [
                ...nodesRef.current.filter((node) => !oldPromptNodeIds.has(node.id)).map((node) => {
                    if (node.id === workflow.batchNodeId) return { ...node, position: { x: promptX + VIRAL_VIDEO_TEMPLATE_NODE_SIZE.width + 120, y: sourceNode.position.y } };
                    if (node.id === workflow.resultsNodeId) return { ...node, position: { x: promptX + VIRAL_VIDEO_TEMPLATE_NODE_SIZE.width + 860, y: sourceNode.position.y } };
                    return node;
                }),
                ...promptNodes,
            ];
            const nextConnections = [
                ...connectionsRef.current.filter((connection) => !oldPromptNodeIds.has(connection.fromNodeId) && !oldPromptNodeIds.has(connection.toNodeId)),
                ...promptConnections,
            ];
            nodesRef.current = nextNodes;
            connectionsRef.current = nextConnections;
            setNodes(nextNodes);
            setConnections(nextConnections);
            setSelectedNodeIds(new Set(promptNodes.map((node) => node.id)));
            setSelectedConnectionId(null);
            const latestProject = useCanvasStore.getState().projects.find((item) => item.id === run.projectId);
            const latestWorkflow = latestProject?.workflow;
            if (!latestWorkflow || latestWorkflow.kind !== "viral-video-remake") return;
            updateProject(run.projectId, {
                nodes: nextNodes,
                connections: nextConnections,
                workflow: {
                    ...applyViralWorkflowEvents(latestWorkflow, [{ type: "TEMPLATE_SUCCEEDED" }]),
                    phase: "template_ready",
                    promptNodeIds: promptNodes.map((node) => node.id),
                    masterPromptNodeId: promptNodes[0]?.id,
                    remakeTemplate: promptNodes[0]?.metadata?.viralVideoRemakeTemplate,
                    outputNodeIds: undefined,
                },
            });
            run.committed = true;
            setViralRemakeBatch({ running: false, stageLabel: "复刻母版已生成", completed, total: planCount });
            if (failures.length) {
                message.warning(`复刻母版已生成，另有 ${failures.length} 次策划失败：${failures[0].error}`);
            } else {
                message.success("已生成唯一可编辑复刻母版");
            }
        } catch (error) {
            if (!isViralPromptRunCurrent(run)) return;
            const errorDetails = error instanceof Error ? error.message : "复刻方案生成失败";
            restoreViralPromptRunPhase(run);
            run.committed = true;
            setViralRemakeBatch((state) => ({ ...state, running: false, stageLabel: errorDetails }));
            if (!isGenerationCanceled(error)) message.error(`复刻方案生成失败：${errorDetails}`);
        } finally {
            const isLatestRun = viralPromptRunRef.current?.token === run.token;
            run.controllers.forEach((controller, requestId) => {
                controller.abort();
                finishGenerationRequest(requestId, controller);
            });
            run.controllers.clear();
            if (!run.committed && isLatestRun) restoreViralPromptRunPhase(run);
            if (viralPromptRunRef.current?.token === run.token) viralPromptRunRef.current = null;
            if (canvasMountedRef.current && activeProjectIdRef.current === run.projectId && isLatestRun) setViralRemakeBatch((state) => ({ ...state, running: false }));
        }
    };

    const generateViralRemakeVideos = async () => {
        const workflow = currentProject?.workflow;
        if (!workflow || workflow.kind !== "viral-video-remake" || workflow.phase !== "template_ready" || viralRemakeBatch.running || viralVideoLaunchRef.current || viralVideoRunRef.current) return;
        const sourceNode = nodesRef.current.find((node) => node.id === workflow.sourceVideoNodeId);
        const replacementNode = nodesRef.current.find((node) => node.id === workflow.replacementNodeId);
        const replacementLibrary = replacementNode?.metadata?.viralVideoReplacementLibrary || { collapsed: false, elements: [] };
        const replacementAssets = listViralVideoReplacementAssets(replacementLibrary);
        if (!sourceNode?.metadata?.content) {
            message.warning("爆款参考视频已丢失，请重新上传并分析");
            return;
        }
        const activePlans = collectActiveViralVideoPlans(workflow, nodesRef.current);
        if (activePlans.error) {
            message.error(activePlans.error);
            return;
        }
        const totalTasks = normalizeViralCandidateCount(workflow.candidateCount);
        if (!totalTasks) {
            message.warning("当前没有可生成的完整成片方案，请重新生成复刻方案");
            return;
        }

        const baseGenerationConfig = buildGenerationConfig(effectiveConfig, undefined, "video");
        if (!isAiConfigReady(baseGenerationConfig, baseGenerationConfig.model)) {
            message.warning("请先配置视频模型");
            openConfigDialog(true);
            return;
        }
        const modelName = modelOptionName(baseGenerationConfig.videoModel || baseGenerationConfig.model);
        if (isOmniV2VModel(modelName)) {
            message.error("当前 Omni V2V 模型必须使用参考视频，不能用于替换素材驱动的爆款复刻，请切换普通视频模型");
            return;
        }
        const hardDurationLimit = getViralVideoMaxSegmentSeconds(baseGenerationConfig);
        const durationPlan = workflow.remakeTemplate
            ? planViralDurationExecution(workflow.remakeTemplate, { maxSeconds: hardDurationLimit, supportsContinuation: false })
            : null;
        if (durationPlan?.status === "blocked") {
            message.error(`无法完整生成：${durationPlan.reason}`);
            return;
        }
        const preparedTasks: Array<{
            plan: ActiveViralVideoPlan;
            finalPrompt: string;
            seconds: string;
            outputNodeId: string;
            generationConfig: AiConfig;
        }> = [];
        const generations = buildViralVideoSingleGenerations(
            activePlans.plans.map((plan) => ({
                title: plan.plan.title,
                originalityRules: plan.plan.originalityRules,
                productContinuity: plan.plan.productContinuity,
                elementPlan: plan.plan.elementPlan,
                continuityRules: plan.plan.continuityRules,
                masterPrompt: plan.masterPrompt,
                segments: plan.segments,
            })),
            hardDurationLimit,
            replacementAssets.length > 0,
            buildViralVideoReplacementManifest(replacementLibrary),
        );
        for (const [planIndex, plan] of activePlans.plans.entries()) {
            const generation = generations[planIndex];
            const seconds = chooseViralVideoSeconds(baseGenerationConfig, generation.durationSeconds);
            if (!seconds) {
                message.error(`复刻方案 ${plan.variantIndex + 1} 无法匹配 ${generation.durationSeconds} 秒的单条成片时长，请切换模型或重新生成方案`);
                return;
            }
            let taskConfig = { ...baseGenerationConfig, size: "9:16", videoSeconds: seconds };
            try {
                taskConfig = resolveAutoDlH3CanvasVideoConfig(taskConfig, {
                    imageCount: replacementAssets.length,
                    audioCount: 0,
                    videoCount: 0,
                    duration: seconds,
                    mode: "auto",
                }, gatewayModelCatalogEntries(taskConfig.videoModels)).config;
            } catch (error) {
                message.error(error instanceof Error ? error.message : "爆款复刻视频模型自动选择失败");
                return;
            }
            if (!isAiConfigReady(taskConfig, taskConfig.model)) {
                message.error("自动选择的视频模型当前不可用，请检查管理后台发布状态");
                return;
            }
            preparedTasks.push({ plan, finalPrompt: generation.prompt, seconds, outputNodeId: nanoid(), generationConfig: taskConfig });
        }

        const promptNodeIdsJson = JSON.stringify(workflow.promptNodeIds || []);
        const promptSnapshotJson = buildViralVideoPromptSnapshot(workflow, nodesRef.current);
        const planIdsJson = JSON.stringify(activePlans.plans.map((plan) => plan.planId));
        const launch: ViralVideoLaunch = {
            token: nanoid(),
            projectId,
            sourceVideoNodeId: workflow.sourceVideoNodeId,
            sourceContent: sourceNode.metadata.content,
            sourceStorageKey: sourceNode.metadata.storageKey,
            replacementNodeId: workflow.replacementNodeId,
            replacementSnapshotJson: viralVideoReplacementSnapshot(replacementNode),
            promptNodeIdsJson,
            promptSnapshotJson,
            planIdsJson,
        };
        viralVideoLaunchRef.current = launch;
        setViralRemakeBatch({ running: true, stageLabel: "正在准备替换素材与视频任务", completed: 0, total: totalTasks });
        let replacementReferences: ReferenceImage[] = [];
        try {
            replacementReferences = await Promise.all(
                replacementAssets.map(async ({ asset, element, referenceIndex }) => {
                    const dataUrl = await imageToDataUrl({ dataUrl: asset.content, storageKey: asset.storageKey });
                    if (!dataUrl.startsWith("data:")) throw new Error(`参考图 ${referenceIndex} 未能获得可发送的图片 Data URI`);
                    return {
                        id: asset.id,
                        name: `${referenceIndex}-${element.category}-${element.name}-${asset.name}`,
                        type: asset.mimeType || "image/png",
                        dataUrl,
                        storageKey: asset.storageKey,
                    };
                }),
            );
        } catch (error) {
            invalidateViralVideoRun();
            message.error(error instanceof Error ? `替换素材读取失败：${error.message}` : "替换素材读取失败，请重新上传后再试");
            return;
        }

        if (!isViralVideoLaunchCurrent(launch)) {
            if (viralVideoLaunchRef.current?.token === launch.token) invalidateViralVideoRun();
            return;
        }
        const latestProject = useCanvasStore.getState().projects.find((item) => item.id === projectId);
        const latestWorkflow = latestProject?.workflow;
        const latestSourceNode = nodesRef.current.find((node) => node.id === workflow.sourceVideoNodeId);
        const latestReplacementNode = nodesRef.current.find((node) => node.id === workflow.replacementNodeId);
        if (
            !latestWorkflow ||
            latestWorkflow.kind !== "viral-video-remake" ||
            JSON.stringify(latestWorkflow.promptNodeIds || []) !== promptNodeIdsJson ||
            buildViralVideoPromptSnapshot(latestWorkflow, nodesRef.current) !== promptSnapshotJson ||
            !matchesViralPromptNode(latestSourceNode, sourceNode.metadata.content, sourceNode.metadata.storageKey) ||
            viralVideoReplacementSnapshot(latestReplacementNode) !== launch.replacementSnapshotJson
        ) {
            invalidateViralVideoRun();
            return;
        }

        if (!isGatewayConfigured) {
            invalidateViralVideoRun();
            message.error("爆款复刻后台生成需要先配置 Gateway");
            return;
        }
        const replacementArtifacts = replacementReferences.length
            ? await uploadCanvasVideoReferences(projectId, { referenceImages: replacementReferences, referenceVideos: [], referenceAudios: [] })
            : { referenceImages: [], referenceVideos: [], referenceAudios: [] };
        const task = preparedTasks[0];
        const template = workflow.remakeTemplate || task.plan.masterNode.metadata?.viralVideoRemakeTemplate;
        if (!template?.coverage.passed) {
            invalidateViralVideoRun();
            message.error("复刻母版尚未通过 P0 事件覆盖门禁");
            return;
        }
        const taskModelName = modelOptionName(task.generationConfig.videoModel || task.generationConfig.model);
        const stableRecipeKey = createViralBatchIdempotencyKey({ templateId: template.id, candidateCount: totalTasks, modelId: taskModelName, draftRevision: 1 });
        const recipeSeed = Number.parseInt(stableRecipeKey.slice(-8), 16) || 1;
        const recipe = createViralBatchRecipe({
            id: `recipe-${template.id}`,
            candidateCount: totalTasks,
            seed: recipeSeed,
            fixedObjectIds: template.bindings.filter((item) => item.status === "bound").map((item) => item.sourceObjectId),
            variableSlots: buildDefaultViralVariableSlots(template),
        });
        const manifests = compileViralCandidateManifests(template, recipe).map((manifest) => ({ ...manifest, prompt: `${task.finalPrompt}\n\n【候选受控变化】\n${manifest.prompt}` }));
        const binding = await resolveCanvasJobModelBinding(taskModelName, "video");
        const cost = estimateViralBatchCost({ candidateCount: totalTasks, durationSeconds: Number(task.seconds), videoCentsPerSecond: 1, authorizationThresholdCents: 1000 });
        if (cost.requiresAuthorization) {
            const authorized = await confirmViralBatchCost(cost.totalCents);
            if (!authorized) {
                invalidateViralVideoRun();
                message.info("已取消批次提交，未产生视频生成费用");
                return;
            }
        }
        const clientRequestId = createViralBatchIdempotencyKey({ canvasId: projectId, templateId: template.id, recipeId: recipe.id, seed: recipe.seed, candidateCount: totalTasks, modelId: binding.bindingId, prompt: task.finalPrompt, replacementSnapshot: launch.replacementSnapshotJson, draftRevision: latestWorkflow.machine?.draftRevision || 1 });
        const batch = await createViralBatch({
            canvasId: projectId,
            targetNodeId: workflow.resultsNodeId,
            generationRevision: 1,
            clientRequestId,
            templateId: template.id,
            candidateCount: totalTasks,
            modelId: binding.bindingId,
            channelId: binding.channelId,
            maxInFlight: 2,
            costEstimateCents: cost.totalCents,
            authorizedCostCents: cost.requiresAuthorization ? cost.totalCents : undefined,
            input: {
                template,
                recipe,
                manifests,
                baseVideoInput: {
                    seconds: task.seconds,
                    resolution: task.generationConfig.vquality,
                    size: "9:16",
                    generateAudio: task.generationConfig.videoGenerateAudio,
                    watermark: task.generationConfig.videoWatermark,
                    referenceImages: replacementArtifacts.referenceImages,
                    referenceVideos: [],
                    referenceAudios: [],
                },
            },
        });
        upsertViralBatch(batch);
        const outputNodeIds = [workflow.resultsNodeId];
        const nextNodes = nodesRef.current.map((node) => {
            if (node.id === workflow.batchNodeId) return { ...node, metadata: { ...node.metadata, status: "success" as const, viralVideoBatchRecipe: recipe } };
            if (node.id === workflow.resultsNodeId) return { ...node, metadata: { ...node.metadata, status: "loading" as const, viralVideoResultsBatchId: batch.id } };
            return node;
        });
        const connectionKeys = new Set(connectionsRef.current.map((connection) => `${connection.fromNodeId}->${connection.toNodeId}`));
        const desiredConnections = [
            { fromNodeId: task.plan.masterNode.id, toNodeId: workflow.batchNodeId },
            { fromNodeId: workflow.batchNodeId, toNodeId: workflow.resultsNodeId },
        ];
        const nextConnections = [...connectionsRef.current, ...desiredConnections.filter((edge) => !connectionKeys.has(`${edge.fromNodeId}->${edge.toNodeId}`)).map((edge) => ({ id: nanoid(), ...edge }))];
        if (!isViralVideoLaunchCurrent(launch) || viralVideoRunRef.current) {
            if (viralVideoLaunchRef.current?.token === launch.token) invalidateViralVideoRun();
            return;
        }
        viralVideoLaunchRef.current = null;
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        setSelectedNodeIds(new Set(outputNodeIds));
        setSelectedConnectionId(null);
        updateProject(projectId, {
            nodes: nextNodes,
            connections: nextConnections,
            workflow: { ...applyViralWorkflowEvents(latestWorkflow, [{ type: "START_COMPILING" }, { type: "COMPILE_SUCCEEDED" }, { type: "SUBMITTED" }]), outputNodeIds, activeBatchId: batch.id, batchRecipe: recipe },
        });
        setViralRemakeBatch({ running: false, stageLabel: `已提交 ${totalTasks} 条完整候选到后台批次`, completed: 0, total: totalTasks });

    };

    const handleGenerateViralRemake = () => {
        const workflow = currentProject?.workflow;
        if (!workflow || workflow.kind !== "viral-video-remake" || viralRemakeBatch.running) return;
        if (workflow.phase === "requirements_ready") {
            viralAutoGenerateAfterPlanningRef.current = projectId;
            void generateViralVideoPrompts().finally(() => {
                const latestWorkflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
                if (latestWorkflow?.kind !== "viral-video-remake" || latestWorkflow.phase !== "template_ready") {
                    viralAutoGenerateAfterPlanningRef.current = null;
                }
            });
            return;
        }
        if (workflow.phase === "template_ready") {
            viralAutoGenerateAfterPlanningRef.current = null;
            void generateViralRemakeVideos();
        }
    };

    useEffect(() => {
        if (viralAutoGenerateAfterPlanningRef.current !== projectId || viralRemakeBatch.running) return;
        const workflow = currentProject?.workflow;
        if (!workflow || workflow.kind !== "viral-video-remake" || workflow.phase !== "template_ready") return;
        viralAutoGenerateAfterPlanningRef.current = null;
        void generateViralRemakeVideos();
    }, [currentProject, projectId, viralRemakeBatch.running]);

    useEffect(() => {
        const workflow = currentProject?.workflow;
        if (!workflow || workflow.kind !== "viral-video-remake") return;
        let disposed = false;
        const refresh = async () => {
            try {
                const batches = await listViralBatches(projectId);
                if (disposed) return;
                replaceCanvasViralBatches(projectId, batches);
                const active = workflow.activeBatchId ? batches.find((batch) => batch.id === workflow.activeBatchId) : undefined;
                if (active) {
                    const terminal = active.succeededCount + active.failedCount + active.cancelledCount;
                    setViralRemakeBatch({ running: ["queued", "running"].includes(active.status), stageLabel: `后台批次：${active.status}`, completed: terminal, total: active.candidateCount });
                    const latestWorkflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
                    if (latestWorkflow?.kind === "viral-video-remake") {
                        const event = active.status === "running" && latestWorkflow.phase === "paused" ? { type: "RESUMED" } as ViralWorkflowEvent : viralBatchStatusEvent(active.status, terminal > 0 && terminal < active.candidateCount);
                        if (event) {
                            const nextWorkflow = applyViralWorkflowEvents(latestWorkflow, [event]);
                            if (nextWorkflow.phase !== latestWorkflow.phase) updateProject(projectId, { workflow: nextWorkflow });
                        }
                    }
                }
            } catch {
                // Gateway 暂时离线时保留本地批次摘要，下一轮继续同步。
            }
        };
        void refresh();
        const timer = window.setInterval(() => void refresh(), 3_000);
        return () => { disposed = true; window.clearInterval(timer); };
    }, [currentProject?.workflow, projectId, replaceCanvasViralBatches]);

    const generateEcommerceVideos = async () => {
        const workflow = currentProject?.workflow;
        if (!workflow || workflow.kind !== "ecommerce-video" || ecommerceBatch.running) return;
        const productNode = nodesRef.current.find((node) => node.id === workflow.productNodeId);
        if (!productNode?.metadata?.content) {
            message.warning("请先上传商品图");
            handleUploadRequest(workflow.productNodeId);
            return;
        }
        const count = getEcommerceOutputCount(workflow);
        if (count > 100) {
            message.warning(`当前设置将生成 ${count} 条视频，请减少创意套数或连载集数，最多生成 100 条`);
            return;
        }
        const configNode = nodesRef.current.find((node) => node.id === workflow.configNodeId);
        const generationSourceNodeId = configNode?.id || workflow.productNodeId;
        const nodeGenerationConfig = buildGenerationConfig(effectiveConfig, configNode, "video");
        let generationConfig = { ...nodeGenerationConfig, videoSeconds: "15" };
        try {
            const routed = resolveAutoDlH3CanvasVideoConfig(generationConfig, {
                imageCount: workflow.category === "story" ? 2 : 1,
                audioCount: 0,
                videoCount: 0,
                duration: generationConfig.videoSeconds,
                mode: "auto",
            }, gatewayModelCatalogEntries(generationConfig.videoModels));
            generationConfig = routed.config;
            if (routed.autoSelected) message.info(`已自动选择：${routed.displayName}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "电商视频模型自动选择失败");
            return;
        }
        if (!isAiConfigReady(generationConfig, generationConfig.model)) {
            message.warning("请先配置视频模型");
            openConfigDialog(true);
            return;
        }

        const creativeCount = Math.max(1, Math.min(100, workflow.batchCount || 1));
        const characterGenerationSeed = Date.now();
        const storyPlans: EcommerceStoryPlan[] = [];
        const storyPlanNodes: CanvasNodeData[] = [];
        const characterReferences: ReferenceImage[] = [];
        const characterNodes: CanvasNodeData[] = [];
        const videoPlans: EcommerceVideoPlan[] = [];
        const videoPlanNodes: CanvasNodeData[] = [];
        if (workflow.category === "story") {
            const textGenerationConfig = buildGenerationConfig(effectiveConfig, undefined, "text");
            if (!isAiConfigReady(textGenerationConfig, textGenerationConfig.model)) {
                message.warning("AI 剧情策划需要先配置文本模型");
                openConfigDialog(true);
                return;
            }
            const imageGenerationConfig = { ...buildGenerationConfig(effectiveConfig, undefined, "image"), count: "1" };
            if (!isAiConfigReady(imageGenerationConfig, imageGenerationConfig.model)) {
                message.warning("自动生成原创角色需要先配置生图模型");
                openConfigDialog(true);
                return;
            }
            const productReference: ReferenceImage = {
                id: productNode.id,
                name: `${productNode.title || "product"}.png`,
                type: productNode.metadata.mimeType || "image/png",
                dataUrl: productNode.metadata.content,
                storageKey: productNode.metadata.storageKey,
            };
            let productDataUrl = "";
            try {
                productDataUrl = await imageToDataUrl(productReference);
            } catch (error) {
                message.error(error instanceof Error ? `商品图读取失败：${error.message}` : "商品图读取失败，请重新上传后再试");
                return;
            }
            setEcommerceBatch({ running: true, completed: 0, total: count + creativeCount * 2 });
            let characterCursor = 0;
            let preparationCompleted = 0;
            let preparationError: unknown = null;
            const preparationWorker = async () => {
                while (characterCursor < creativeCount && !preparationError) {
                    const creativeIndex = characterCursor++;
                    try {
                        const plannerPrompt = buildEcommerceStoryPlannerPrompt(workflow, creativeIndex, characterGenerationSeed);
                        const plannerResponse = await requestImageQuestion(textGenerationConfig, [{ role: "user", content: [{ type: "text", text: plannerPrompt }, { type: "image_url", image_url: { url: productDataUrl } }] }], () => undefined);
                        const storyPlan = parseEcommerceStoryPlan(plannerResponse, getEcommerceStoryEpisodeCount(workflow));
                        storyPlans[creativeIndex] = storyPlan;
                        const characterPrompt = buildEcommerceCharacterReferencePrompt(workflow, storyPlan, creativeIndex, characterGenerationSeed);
                        storyPlanNodes[creativeIndex] = {
                            id: nanoid(),
                            type: CanvasNodeType.Text,
                            title: `第 ${creativeIndex + 1} 套 AI 剧本 · ${storyPlan.title}`,
                            position: { x: 520, y: 560 + creativeIndex * 320 },
                            width: NODE_DEFAULT_SIZE[CanvasNodeType.Text].width,
                            height: NODE_DEFAULT_SIZE[CanvasNodeType.Text].height,
                            metadata: { content: formatEcommerceStoryPlan(storyPlan, characterPrompt), prompt: plannerPrompt, status: NODE_STATUS_SUCCESS, fontSize: 14 },
                        };
                        preparationCompleted += 1;
                        setEcommerceBatch((state) => ({ ...state, completed: preparationCompleted }));

                        const generated = await requestGeneration(imageGenerationConfig, characterPrompt).then((items) => items[0]);
                        if (!generated?.dataUrl) throw new Error("角色定妆图生成失败");
                        const uploaded = await uploadImage(generated.dataUrl);
                        characterReferences[creativeIndex] = {
                            id: `story-characters-${characterGenerationSeed}-${creativeIndex}`,
                            name: `story-characters-${creativeIndex + 1}.png`,
                            type: uploaded.mimeType || "image/png",
                            dataUrl: uploaded.url,
                            storageKey: uploaded.storageKey,
                        };
                        const nodeSize = fitNodeSize(uploaded.width, uploaded.height, 360, 240);
                        characterNodes[creativeIndex] = {
                            id: nanoid(),
                            type: CanvasNodeType.Image,
                            title: `第 ${creativeIndex + 1} 套原创角色卡`,
                            position: { x: 920, y: 560 + creativeIndex * 320 },
                            width: nodeSize.width,
                            height: nodeSize.height,
                            metadata: { ...imageMetadata(uploaded), prompt: characterPrompt },
                        };
                    } catch (error) {
                        preparationError = error;
                    } finally {
                        if (storyPlans[creativeIndex] && characterNodes[creativeIndex]) {
                            preparationCompleted += 1;
                            setEcommerceBatch((state) => ({ ...state, completed: preparationCompleted }));
                        }
                    }
                }
            };
            await Promise.all(Array.from({ length: Math.min(3, creativeCount) }, () => preparationWorker()));
            if (preparationError || storyPlans.length !== creativeCount || characterReferences.length !== creativeCount) {
                setEcommerceBatch({ running: false, completed: preparationCompleted, total: count + creativeCount * 2 });
                message.error(preparationError instanceof Error ? `AI 剧情准备失败：${preparationError.message}` : "AI 剧情准备失败，请检查文本与生图模型后重试");
                return;
            }
        } else {
            const nonStoryCategory = workflow.category;
            const textGenerationConfig = buildGenerationConfig(effectiveConfig, undefined, "text");
            if (!isAiConfigReady(textGenerationConfig, textGenerationConfig.model)) {
                message.warning(`${currentProject.title}需要先配置文本模型完成专属策划`);
                openConfigDialog(true);
                return;
            }
            const productReference: ReferenceImage = {
                id: productNode.id,
                name: `${productNode.title || "product"}.png`,
                type: productNode.metadata.mimeType || "image/png",
                dataUrl: productNode.metadata.content,
                storageKey: productNode.metadata.storageKey,
            };
            let productDataUrl = "";
            try {
                productDataUrl = await imageToDataUrl(productReference);
            } catch (error) {
                message.error(error instanceof Error ? `商品图读取失败：${error.message}` : "商品图读取失败，请重新上传后再试");
                return;
            }
            setEcommerceBatch({ running: true, completed: 0, total: count * 2 });
            let plannerCursor = 0;
            let plannerCompleted = 0;
            let plannerError: unknown = null;
            const plannerWorker = async () => {
                while (plannerCursor < count && !plannerError) {
                    const taskIndex = plannerCursor++;
                    try {
                        const plannerPrompt = buildEcommerceVideoPlannerPrompt(nonStoryCategory, taskIndex, count, characterGenerationSeed);
                        const plannerResponse = await requestImageQuestion(textGenerationConfig, [{ role: "user", content: [{ type: "text", text: plannerPrompt }, { type: "image_url", image_url: { url: productDataUrl } }] }], () => undefined);
                        const videoPlan = parseEcommerceVideoPlan(nonStoryCategory, plannerResponse);
                        videoPlans[taskIndex] = videoPlan;
                        videoPlanNodes[taskIndex] = {
                            id: nanoid(),
                            type: CanvasNodeType.Text,
                            title: `第 ${taskIndex + 1} 条 ${getEcommerceWorkflowDefinition(workflow.category).shortTitle}策划 · ${videoPlan.title}`,
                            position: { x: 520, y: 560 + taskIndex * 320 },
                            width: NODE_DEFAULT_SIZE[CanvasNodeType.Text].width,
                            height: NODE_DEFAULT_SIZE[CanvasNodeType.Text].height,
                            metadata: { content: formatEcommerceVideoPlan(videoPlan, plannerPrompt), prompt: plannerPrompt, status: NODE_STATUS_SUCCESS, fontSize: 14 },
                        };
                        plannerCompleted += 1;
                        setEcommerceBatch((state) => ({ ...state, completed: plannerCompleted }));
                    } catch (error) {
                        plannerError = error;
                    }
                }
            };
            await Promise.all(Array.from({ length: Math.min(3, count) }, () => plannerWorker()));
            if (plannerError || videoPlans.length !== count) {
                setEcommerceBatch({ running: false, completed: plannerCompleted, total: count * 2 });
                message.error(plannerError instanceof Error ? `${currentProject.title}策划失败：${plannerError.message}` : `${currentProject.title}策划失败，请检查文本模型后重试`);
                return;
            }
        }

        const existingVideoCount = nodesRef.current.filter((node) => node.type === CanvasNodeType.Video && node.id !== workflow.outputNodeId).length;
        const reusableOutput = nodesRef.current.find((node) => node.id === workflow.outputNodeId && !node.metadata?.content && node.metadata?.status !== NODE_STATUS_LOADING);
        const outputIds = Array.from({ length: count }, (_, index) => (index === 0 && reusableOutput ? reusableOutput.id : nanoid()));
        const outputNodes = outputIds.map((id, index): CanvasNodeData => {
            const itemIndex = existingVideoCount + index;
            const column = itemIndex % 3;
            const row = Math.floor(itemIndex / 3);
            const storyTask = workflow.category === "story" ? getEcommerceStoryTaskDetails(workflow, index) : null;
            const storyPlan = storyTask ? storyPlans[storyTask.creativeIndex] : undefined;
            const videoPlan = workflow.category === "story" ? undefined : videoPlans[index];
            const prompt = buildEcommerceVideoPrompt(workflow, index, count, characterGenerationSeed, storyPlan, videoPlan);
            const title = storyTask && storyTask.totalEpisodes > 1 ? `${currentProject.title} 第 ${storyTask.creativeIndex + 1} 套 · 第 ${storyTask.episodeIndex + 1} 集` : videoPlan ? `${currentProject.title} · ${videoPlan.title}` : `${currentProject.title} ${itemIndex + 1}`;
            return {
                id,
                type: CanvasNodeType.Video,
                title,
                position: { x: 1400 + column * 460, y: 160 + row * 320 },
                width: NODE_DEFAULT_SIZE[CanvasNodeType.Video].width,
                height: NODE_DEFAULT_SIZE[CanvasNodeType.Video].height,
                metadata: {
                    content: "",
                    prompt,
                    status: NODE_STATUS_LOADING,
                    model: generationConfig.model,
                    size: generationConfig.size || "9:16",
                    seconds: generationConfig.videoSeconds,
                    vquality: generationConfig.vquality,
                    generateAudio: generationConfig.videoGenerateAudio,
                    watermark: generationConfig.videoWatermark,
                    references: [productNode.metadata?.storageKey || productNode.metadata?.content || "", ...(storyTask ? [characterReferences[storyTask.creativeIndex].storageKey || characterReferences[storyTask.creativeIndex].dataUrl] : [])],
                },
            };
        });
        const outputById = new Map(outputNodes.map((node) => [node.id, node]));
        const nextNodes = [
            ...nodesRef.current.map((node) => outputById.get(node.id) || node),
            ...storyPlanNodes,
            ...characterNodes,
            ...videoPlanNodes,
            ...outputNodes.filter((node) => !nodesRef.current.some((current) => current.id === node.id)),
        ];
        const connectedIds = new Set(configNode ? connectionsRef.current.filter((connection) => connection.fromNodeId === configNode.id).map((connection) => connection.toNodeId) : []);
        const nextConnections = [
            ...connectionsRef.current,
            ...storyPlanNodes.map((node) => ({ id: nanoid(), fromNodeId: workflow.productNodeId, toNodeId: node.id })),
            ...videoPlanNodes.map((node) => ({ id: nanoid(), fromNodeId: workflow.productNodeId, toNodeId: node.id })),
            ...videoPlanNodes.map((node, index) => ({ id: nanoid(), fromNodeId: node.id, toNodeId: outputIds[index] })),
            ...characterNodes.map((node, creativeIndex) => ({ id: nanoid(), fromNodeId: storyPlanNodes[creativeIndex].id, toNodeId: node.id })),
            ...characterNodes.flatMap((node, creativeIndex) =>
                outputIds
                    .filter((_, taskIndex) => getEcommerceStoryTaskDetails(workflow, taskIndex).creativeIndex === creativeIndex)
                    .map((outputId) => ({ id: nanoid(), fromNodeId: node.id, toNodeId: outputId })),
            ),
            ...(configNode ? outputIds.filter((id) => !connectedIds.has(id)).map((id) => ({ id: nanoid(), fromNodeId: configNode.id, toNodeId: id })) : []),
        ];
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        setSelectedNodeIds(new Set(outputIds));
        setSelectedConnectionId(null);
        const preparationCount = workflow.category === "story" ? creativeCount * 2 : count;
        setEcommerceBatch({ running: true, completed: preparationCount, total: count + preparationCount });

        const reference: ReferenceImage = {
            id: productNode.id,
            name: `${productNode.title || "product"}.png`,
            type: productNode.metadata.mimeType || "image/png",
            dataUrl: productNode.metadata.content,
            storageKey: productNode.metadata.storageKey,
        };
        let cursor = 0;
        let successCount = 0;
        const worker = async () => {
            while (cursor < outputNodes.length) {
                const taskIndex = cursor++;
                const outputNode = outputNodes[taskIndex];
                const controller = startGenerationRequest(outputNode.id, generationSourceNodeId, generationSourceNodeId);
                try {
                    const storyTask = workflow.category === "story" ? getEcommerceStoryTaskDetails(workflow, taskIndex) : null;
                    const imageReferences = storyTask ? [reference, characterReferences[storyTask.creativeIndex]] : [reference];
                    const stored = await storeGeneratedVideo(await requestVideoGeneration(generationConfig, outputNode.metadata?.prompt || "", imageReferences, [], [], { signal: controller.signal }));
                    const videoSize = fitNodeSize(stored.width || outputNode.width, stored.height || outputNode.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                    setNodes((current) =>
                        current.map((node) =>
                            node.id === outputNode.id
                                ? {
                                      ...node,
                                      width: videoSize.width,
                                      height: videoSize.height,
                                      metadata: { ...node.metadata, ...videoMetadata(stored), status: NODE_STATUS_SUCCESS },
                                  }
                                : node,
                        ),
                    );
                    successCount += 1;
                } catch (error) {
                    if (!isGenerationCanceled(error)) {
                        const errorDetails = error instanceof Error ? error.message : "视频生成失败";
                        setNodes((current) => current.map((node) => (node.id === outputNode.id ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node)));
                    }
                } finally {
                    finishGenerationRequest(outputNode.id, controller);
                    setEcommerceBatch((state) => ({ ...state, completed: state.completed + 1 }));
                }
            }
        };

        await Promise.all(Array.from({ length: Math.min(3, count) }, () => worker()));
        setEcommerceBatch({ running: false, completed: count + preparationCount, total: count + preparationCount });
        if (successCount === count) message.success(`已生成 ${successCount} 个视频`);
        else if (successCount) message.warning(`已生成 ${successCount} 个视频，${count - successCount} 个失败`);
        else message.error("视频生成失败，请检查模型配置后重试");
    };

    const generateProjectPosters = async () => {
        const workflow = currentProject?.workflow;
        if (!workflow || workflow.kind !== "project-poster" || posterBatch.running) return;
        const referenceNode = nodesRef.current.find((node) => node.id === workflow.referenceNodeId);
        if (!workflow.projectBrief.trim()) {
            message.warning("请先填写项目介绍");
            return;
        }
        const textGenerationConfig = buildGenerationConfig(effectiveConfig, undefined, "text");
        if (!isAiConfigReady(textGenerationConfig, textGenerationConfig.model)) {
            message.warning("AI 海报策划需要先配置文本模型");
            openConfigDialog(true);
            return;
        }
        const imageGenerationConfig = { ...buildGenerationConfig(effectiveConfig, undefined, "image"), count: "1", size: workflow.ratio };
        if (!isAiConfigReady(imageGenerationConfig, imageGenerationConfig.model)) {
            message.warning("生成完整海报需要先配置生图模型");
            openConfigDialog(true);
            return;
        }

        const hasReferenceImage = Boolean(referenceNode?.metadata?.content);
        const reference: ReferenceImage | undefined =
            referenceNode?.metadata?.content
                ? {
                      id: referenceNode.id,
                      name: `${referenceNode.title || "project-visual"}.png`,
                      type: referenceNode.metadata.mimeType || "image/png",
                      dataUrl: referenceNode.metadata.content,
                      storageKey: referenceNode.metadata.storageKey,
                  }
                : undefined;
        let referenceDataUrl = "";
        if (reference) {
            try {
                referenceDataUrl = await imageToDataUrl(reference);
            } catch (error) {
                message.error(error instanceof Error ? `项目主视觉读取失败：${error.message}` : "项目主视觉读取失败，请重新上传后再试");
                return;
            }
            if (!referenceDataUrl) {
                message.error("项目主视觉读取失败，请重新上传后再试");
                return;
            }
        }

        const count = Math.max(1, Math.min(10, workflow.batchCount || 1));
        const generationSeed = Date.now();
        const existingPosterCount = nodesRef.current.filter((node) => node.type === CanvasNodeType.Image && node.id !== workflow.referenceNodeId).length;
        const plannerPrompts = Array.from({ length: count }, (_, index) => buildProjectPosterPlannerPrompt(workflow.projectBrief, workflow.ratio, index, generationSeed, hasReferenceImage));
        const planNodes = Array.from({ length: count }, (_, index): CanvasNodeData => {
            const direction = getProjectPosterCreativeDirection(index, generationSeed);
            const plannerPrompt = plannerPrompts[index];
            return {
                id: nanoid(),
                type: CanvasNodeType.Text,
                title: `海报 ${existingPosterCount + index + 1} · ${direction.label} · 策划提示词`,
                position: { x: 820, y: 180 + index * 680 },
                width: 440,
                height: 600,
                metadata: {
                    content: `# 完整 AI 策划提示词\n\n${plannerPrompt}\n\n---\n\nAI 正在根据以上提示词策划海报。`,
                    prompt: plannerPrompt,
                    status: NODE_STATUS_SUCCESS,
                    fontSize: 14,
                },
            };
        });
        const visualPromptNodes = Array.from({ length: count }, (_, index): CanvasNodeData => {
            const direction = getProjectPosterCreativeDirection(index, generationSeed);
            return {
                id: nanoid(),
                type: CanvasNodeType.Text,
                title: `海报 ${existingPosterCount + index + 1} · ${direction.label} · 成品海报提示词`,
                position: { x: 1340, y: 180 + index * 680 },
                width: 440,
                height: 600,
                metadata: {
                    content: "# 完整成品海报提示词\n\n等待 AI 根据项目内容完成自由策划。完成后，这里会显示实际提交给生图模型的完整提示词。",
                    status: NODE_STATUS_SUCCESS,
                    fontSize: 14,
                },
            };
        });
        const outputNodes = Array.from({ length: count }, (_, index): CanvasNodeData => ({
            id: nanoid(),
            type: CanvasNodeType.Image,
            title: `项目宣传海报 ${existingPosterCount + index + 1} · ${getProjectPosterCreativeDirection(index, generationSeed).label}`,
            position: { x: 1860, y: 180 + index * 680 },
            width: workflow.ratio === "9:16" ? 300 : workflow.ratio === "1:1" ? 420 : 360,
            height: workflow.ratio === "9:16" ? 534 : workflow.ratio === "1:1" ? 420 : 480,
            metadata: {
                content: "",
                placeholder: "等待 AI 策划",
                status: NODE_STATUS_IDLE,
                model: imageGenerationConfig.model,
                size: workflow.ratio,
                generationType: hasReferenceImage ? "edit" : "generation",
            },
        }));
        const nextNodes = [...nodesRef.current, ...planNodes, ...visualPromptNodes, ...outputNodes];
        const nextConnections = [
            ...connectionsRef.current,
            ...planNodes.map((node) => ({ id: nanoid(), fromNodeId: workflow.referenceNodeId, toNodeId: node.id })),
            ...visualPromptNodes.map((node, index) => ({ id: nanoid(), fromNodeId: planNodes[index].id, toNodeId: node.id })),
            ...outputNodes.map((node, index) => ({ id: nanoid(), fromNodeId: visualPromptNodes[index].id, toNodeId: node.id })),
        ];
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        setSelectedNodeIds(new Set(outputNodes.map((node) => node.id)));
        setSelectedConnectionId(null);
        setPosterBatch({ running: true, completed: 0, total: count * 2 });

        let cursor = 0;
        let successCount = 0;
        const worker = async () => {
            while (cursor < count) {
                const index = cursor++;
                const planNode = planNodes[index];
                const visualPromptNode = visualPromptNodes[index];
                const outputNode = outputNodes[index];
                const controller = startGenerationRequest(outputNode.id, workflow.referenceNodeId, workflow.referenceNodeId);
                let plan: ProjectPosterPlan | null = null;
                try {
                    const direction = getProjectPosterCreativeDirection(index, generationSeed);
                    const plannerPrompt = plannerPrompts[index];
                    const plannerResponse = await requestImageQuestion(
                        textGenerationConfig,
                        [
                            {
                                role: "user",
                                content: hasReferenceImage ? [{ type: "text", text: plannerPrompt }, { type: "image_url", image_url: { url: referenceDataUrl } }] : plannerPrompt,
                            },
                        ],
                        () => undefined,
                        { signal: controller.signal },
                    );
                    plan = parseProjectPosterPlan(plannerResponse);
                    const posterPrompt = buildProjectPosterGenerationPrompt(plan, workflow.ratio, hasReferenceImage);
                    setNodes((current) =>
                        current.map((node) =>
                            node.id === planNode.id
                                ? {
                                      ...node,
                                      title: `海报 ${existingPosterCount + index + 1} · ${direction.label} · 策划结果与提示词`,
                                      metadata: { ...node.metadata, content: formatProjectPosterPlannerRecord(plan!, plannerPrompt), prompt: plannerPrompt, status: NODE_STATUS_SUCCESS },
                                  }
                                : node.id === visualPromptNode.id
                                  ? {
                                        ...node,
                                        metadata: { ...node.metadata, content: formatProjectPosterVisualPromptRecord(posterPrompt), prompt: posterPrompt, status: NODE_STATUS_SUCCESS },
                                    }
                                  : node.id === outputNode.id
                                    ? { ...node, metadata: { ...node.metadata, placeholder: undefined, status: NODE_STATUS_LOADING } }
                                : node,
                        ),
                    );
                    setPosterBatch((state) => ({ ...state, completed: state.completed + 1 }));

                    const generated = await (reference
                        ? requestEdit(imageGenerationConfig, posterPrompt, [reference], undefined, { signal: controller.signal }).then((items) => items[0])
                        : requestGeneration(imageGenerationConfig, posterPrompt, { signal: controller.signal }).then((items) => items[0]));
                    if (!generated?.dataUrl) throw new Error("生图模型没有返回完整海报");
                    const uploaded = await uploadImage(generated.dataUrl);
                    const posterSize = fitNodeSize(uploaded.width, uploaded.height, 420, 600);
                    setNodes((current) =>
                        current.map((node) =>
                            node.id === outputNode.id
                                ? {
                                      ...node,
                                      width: posterSize.width,
                                      height: posterSize.height,
                                      metadata: {
                                          ...node.metadata,
                                          ...imageMetadata(uploaded),
                                          prompt: posterPrompt,
                                          model: imageGenerationConfig.model,
                                          size: workflow.ratio,
                                          references: reference ? [reference.storageKey || reference.dataUrl] : undefined,
                                      },
                                  }
                                : node,
                        ),
                    );
                    successCount += 1;
                } catch (error) {
                    if (!isGenerationCanceled(error)) {
                        const errorDetails = error instanceof Error ? error.message : "海报生成失败";
                        setNodes((current) =>
                            current.map((node) =>
                                node.id === outputNode.id
                                    ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } }
                                    : !plan && node.id === planNode.id
                                      ? {
                                            ...node,
                                            metadata: {
                                                ...node.metadata,
                                                content: `${node.metadata?.content || ""}\n\n---\n\n# 策划失败\n\n${errorDetails}`,
                                                status: NODE_STATUS_SUCCESS,
                                                errorDetails,
                                            },
                                        }
                                      : !plan && node.id === visualPromptNode.id
                                        ? {
                                              ...node,
                                              metadata: {
                                                  ...node.metadata,
                                                  content: `# 完整成品海报提示词\n\n策划阶段失败，因此尚未生成成品海报提示词。\n\n失败原因：${errorDetails}`,
                                                  status: NODE_STATUS_SUCCESS,
                                                  errorDetails,
                                              },
                                          }
                                      : node,
                            ),
                        );
                    }
                } finally {
                    finishGenerationRequest(outputNode.id, controller);
                    setPosterBatch((state) => ({ ...state, completed: state.completed + 1 }));
                }
            }
        };

        await Promise.all(Array.from({ length: Math.min(2, count) }, () => worker()));
        setPosterBatch({ running: false, completed: count * 2, total: count * 2 });
        if (successCount === count) message.success(`已生成 ${successCount} 张项目宣传海报`);
        else if (successCount) message.warning(`已生成 ${successCount} 张海报，${count - successCount} 张失败`);
        else message.error("海报生成失败，请检查文本与生图模型配置后重试");
    };

    const generateJewelryProductImages = async () => {
        const workflow = currentProject?.workflow;
        if (!workflow || workflow.kind !== "jewelry-product-images" || jewelryBatch.running) return;
        const productNode = nodesRef.current.find((node) => node.id === workflow.productNodeId);
        const heroTemplateNode = nodesRef.current.find((node) => node.id === workflow.heroTemplateNodeId);
        const wearingReferenceNode = nodesRef.current.find((node) => node.id === workflow.wearingReferenceNodeId);
        if (!productNode?.metadata?.content) {
            message.warning("请先上传戒指商品原图");
            return;
        }
        if (!workflow.outputTypes.length) {
            message.warning("请至少选择一种商品图类型");
            return;
        }
        const generationConfig = { ...buildGenerationConfig(effectiveConfig, undefined, "image"), count: "1", size: "1:1" };
        if (!isAiConfigReady(generationConfig, generationConfig.model)) {
            message.warning("生成珠宝商品图需要先在管理后台发布生图模型");
            openConfigDialog(true);
            return;
        }

        const referenceFromNode = (node: CanvasNodeData): ReferenceImage => ({
            id: node.id,
            name: `${node.title || "reference"}.png`,
            type: node.metadata?.mimeType || "image/png",
            dataUrl: node.metadata?.content || "",
            storageKey: node.metadata?.storageKey,
        });
        const productReference = referenceFromNode(productNode);
        const heroTemplateReference = heroTemplateNode?.metadata?.content ? referenceFromNode(heroTemplateNode) : undefined;
        const wearingReference = wearingReferenceNode?.metadata?.content ? referenceFromNode(wearingReferenceNode) : undefined;
        const copies = Math.max(1, Math.min(10, workflow.batchCount || 1));
        const tasks = workflow.outputTypes.flatMap((type) => Array.from({ length: copies }, (_, variantIndex) => ({ type, variantIndex })));
        const existingOutputCount = nodesRef.current.filter((node) => node.title.startsWith("珠宝商品图 · ")).length;
        const promptNodes: CanvasNodeData[] = tasks.map((task, index) => {
            const option = jewelryProductImageOptions.find((item) => item.value === task.type)!;
            const hasHero = task.type === "hero" && Boolean(heroTemplateReference);
            const hasWearing = (task.type === "wearing" || task.type === "gesture") && Boolean(wearingReference);
            const prompt = buildJewelryProductPrompt(task.type, task.variantIndex, hasHero, hasWearing);
            return {
                id: nanoid(),
                type: CanvasNodeType.Text,
                title: `${option.label} ${task.variantIndex + 1} · 完整提示词`,
                position: { x: 820, y: 160 + index * 500 },
                width: 480,
                height: 420,
                metadata: { content: `# ${option.label}完整提示词\n\n${prompt}`, prompt, status: NODE_STATUS_SUCCESS, fontSize: 14 },
            };
        });
        const outputNodes: CanvasNodeData[] = tasks.map((task, index) => {
            const option = jewelryProductImageOptions.find((item) => item.value === task.type)!;
            return {
                id: nanoid(),
                type: CanvasNodeType.Image,
                title: `珠宝商品图 · ${option.label} ${existingOutputCount + index + 1}`,
                position: { x: 1380, y: 160 + index * 500 },
                width: 420,
                height: 420,
                metadata: { content: "", placeholder: "等待生成", prompt: promptNodes[index].metadata?.prompt, status: NODE_STATUS_IDLE, model: generationConfig.model, size: "1:1", generationType: "edit" },
            };
        });
        const nextNodes = [...nodesRef.current, ...promptNodes, ...outputNodes];
        const nextConnections = [
            ...connectionsRef.current,
            ...promptNodes.map((node) => ({ id: nanoid(), fromNodeId: workflow.productNodeId, toNodeId: node.id })),
            ...outputNodes.map((node, index) => ({ id: nanoid(), fromNodeId: promptNodes[index].id, toNodeId: node.id })),
        ];
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        setSelectedNodeIds(new Set(outputNodes.map((node) => node.id)));
        setSelectedConnectionId(null);
        setJewelryBatch({ running: true, completed: 0, total: tasks.length });

        let cursor = 0;
        let successCount = 0;
        const worker = async () => {
            while (cursor < tasks.length) {
                const index = cursor++;
                const task = tasks[index];
                const outputNode = outputNodes[index];
                const prompt = promptNodes[index].metadata?.prompt || "";
                const references = [
                    productReference,
                    ...(task.type === "hero" && heroTemplateReference ? [heroTemplateReference] : []),
                    ...((task.type === "wearing" || task.type === "gesture") && wearingReference ? [wearingReference] : []),
                ];
                const controller = startGenerationRequest(outputNode.id, workflow.productNodeId, workflow.productNodeId);
                setNodes((current) => current.map((node) => (node.id === outputNode.id ? { ...node, metadata: { ...node.metadata, placeholder: undefined, status: NODE_STATUS_LOADING } } : node)));
                try {
                    const generated = await requestEdit(generationConfig, prompt, references, undefined, { signal: controller.signal }).then((items) => items[0]);
                    if (!generated?.dataUrl) throw new Error("生图模型没有返回商品图");
                    const uploaded = await uploadImage(generated.dataUrl);
                    const size = fitNodeSize(uploaded.width, uploaded.height, 480, 480);
                    setNodes((current) =>
                        current.map((node) =>
                            node.id === outputNode.id
                                ? { ...node, width: size.width, height: size.height, metadata: { ...node.metadata, ...imageMetadata(uploaded), prompt, model: generationConfig.model, size: "1:1", references: references.map((item) => item.storageKey || item.dataUrl) } }
                                : node,
                        ),
                    );
                    successCount += 1;
                } catch (error) {
                    if (!isGenerationCanceled(error)) {
                        const errorDetails = error instanceof Error ? error.message : "珠宝商品图生成失败";
                        setNodes((current) => current.map((node) => (node.id === outputNode.id ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node)));
                    }
                } finally {
                    finishGenerationRequest(outputNode.id, controller);
                    setJewelryBatch((state) => ({ ...state, completed: state.completed + 1 }));
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, () => worker()));
        setJewelryBatch({ running: false, completed: tasks.length, total: tasks.length });
        if (successCount === tasks.length) message.success(`已生成 ${successCount} 张珠宝商品图`);
        else if (successCount) message.warning(`已生成 ${successCount} 张商品图，${tasks.length - successCount} 张失败`);
        else message.error("珠宝商品图生成失败，请检查生图模型配置后重试");
    };

    const handleDrop = useCallback(
        (event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/") || item.type.startsWith("video/") || isAudioFile(item));
            if (!file) return;

            const pos = screenToCanvas(event.clientX, event.clientY);
            void (isAudioFile(file) ? createAudioFileNode(file, pos) : file.type.startsWith("video/") ? createVideoFileNode(file, pos) : createImageFileNode(file, pos));
        },
        [createAudioFileNode, createImageFileNode, createVideoFileNode, screenToCanvas],
    );

    const pasteAssistantImage = useCallback(
        (file: File) => {
            const position = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            void createImageFileNode(file, position);
            message.success("已从剪切板添加图片");
        },
        [createImageFileNode, message, screenToCanvas, size.height, size.width],
    );

    const handleAssistantSessionsChange = useCallback((sessions: CanvasAssistantSession[], activeId: string | null) => {
        setChatSessions(sessions);
        setActiveChatId(activeId);
    }, []);

    const startTitleEditing = useCallback(() => {
        setTitleDraft(currentProject?.title || "未命名画布");
        setTitleEditing(true);
    }, [currentProject?.title]);

    const finishTitleEditing = useCallback(() => {
        const nextTitle = titleDraft.trim();
        if (nextTitle) renameProject(projectId, nextTitle);
        setTitleEditing(false);
    }, [projectId, renameProject, titleDraft]);

    const preventCanvasContextMenu = useCallback((event: ReactMouseEvent) => {
        if ((event.target as HTMLElement).closest("[data-node-id]")) return;
        event.preventDefault();
        setContextMenu(null);
    }, []);

    const handleGenerateNode = useCallback(
        async (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => {
            const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
            let generationConfig = buildGenerationConfig(effectiveConfig, sourceNode, mode);
            const sourceTextContent = sourceNode?.type === CanvasNodeType.Text ? sourceNode.metadata?.content?.trim() || "" : "";
            const editingTextNode = mode === "text" && Boolean(sourceTextContent);
            const generationContext = await hydrateNodeGenerationContext(
                buildNodeGenerationContext(nodeId, nodesRef.current, connectionsRef.current, editingTextNode ? `请根据要求修改以下文本。\n\n原文：\n${sourceTextContent}\n\n修改要求：\n${prompt}` : prompt),
            );
            if (mode === "video") {
                try {
                    const routed = resolveAutoDlH3CanvasVideoConfig(generationConfig, {
                        imageCount: generationContext.imageCount,
                        audioCount: generationContext.audioCount,
                        videoCount: generationContext.videoCount,
                        duration: generationConfig.videoSeconds,
                        mode: generationConfig.videoInputMode,
                    }, gatewayModelCatalogEntries(generationConfig.videoModels));
                    generationConfig = routed.config;
                    if (routed.autoSelected) message.info(`已自动选择：${routed.displayName}`);
                } catch (error) {
                    message.error(error instanceof Error ? error.message : "MiniMax H3 工作流自动选择失败");
                    return;
                }
            }
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            setRunningNodeId(nodeId);
            const runController = startGenerationRequest(nodeId, nodeId, nodeId);
            const effectivePrompt = generationContext.prompt.trim();
            if (runController.signal.aborted) {
                finishGenerationRequest(nodeId, runController);
                setRunningNodeId(null);
                return;
            }
            const markSourceStatus = false;
            const statusPrompt = sourceNode?.type === CanvasNodeType.Config ? effectivePrompt : prompt;
            if (!effectivePrompt && (mode === "text" || mode === "audio")) {
                finishGenerationRequest(nodeId, runController);
                setRunningNodeId(null);
                return;
            }
            let pendingChildIds: string[] = [];
            if (markSourceStatus) setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt: statusPrompt, status: NODE_STATUS_LOADING, errorDetails: undefined } } : node)));

            try {
                if (mode === "image") {
                    const count = getGenerationCount(generationConfig.count);
                    const isConfigNode = sourceNode?.type === CanvasNodeType.Config;
                    const isImageNode = sourceNode?.type === CanvasNodeType.Image;
                    const isEmptyImageNode = isImageNode && !sourceNode?.metadata?.content;
                    const sourceReference =
                        isImageNode && sourceNode?.metadata?.content
                            ? [{ id: sourceNode.id, name: `${sourceNode.title || sourceNode.id}.png`, type: sourceNode.metadata.mimeType || "image/png", dataUrl: sourceNode.metadata.content, storageKey: sourceNode.metadata.storageKey }]
                            : [];
                    const referenceImages = sourceReference.length ? sourceReference : generationContext.referenceImages;
                    const generationType = referenceImages.length ? ("edit" as const) : ("generation" as const);
                    const generationMetadata = buildImageGenerationMetadata(generationType, generationConfig, count, referenceImages);
                    const parentConfig = NODE_DEFAULT_SIZE[isConfigNode ? CanvasNodeType.Config : isImageNode ? CanvasNodeType.Image : CanvasNodeType.Text];
                    const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
                    const parentPosition = sourceNode?.position || { x: 0, y: 0 };
                    const gap = 96;
                    const rowGap = 36;
                    const rootId = isEmptyImageNode ? nodeId : nanoid();
                    const childIds = count > 1 ? Array.from({ length: count }, () => nanoid()) : [];
                    const targetIds = count > 1 ? childIds : [rootId];
                    pendingChildIds = isEmptyImageNode ? childIds : [rootId, ...childIds];
                    const rootNode: CanvasNodeData = {
                        id: rootId,
                        type: CanvasNodeType.Image,
                        title: effectivePrompt.slice(0, 32) || "Generated Image",
                        position: {
                            x: isEmptyImageNode ? parentPosition.x : parentPosition.x + parentConfig.width + gap,
                            y: parentPosition.y + parentConfig.height / 2 - imageConfig.height / 2,
                        },
                        width: isEmptyImageNode ? sourceNode?.width || imageConfig.width : imageConfig.width,
                        height: isEmptyImageNode ? sourceNode?.height || imageConfig.height : imageConfig.height,
                        metadata: {
                            prompt: effectivePrompt,
                            status: NODE_STATUS_LOADING,
                            isBatchRoot: count > 1,
                            batchChildIds: count > 1 ? childIds : undefined,
                            batchUsesReferenceImages: referenceImages.length > 0,
                            ...generationMetadata,
                            imageBatchExpanded: count > 1 ? true : undefined,
                        },
                    };
                    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
                        id,
                        type: CanvasNodeType.Image,
                        title: effectivePrompt.slice(0, 32) || "Generated Image",
                        position: {
                            x: rootNode.position.x + rootNode.width + 120 + (index % 2) * (imageConfig.width + 36),
                            y: rootNode.position.y + Math.floor(index / 2) * (imageConfig.height + rowGap),
                        },
                        width: imageConfig.width,
                        height: imageConfig.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, batchRootId: count > 1 ? rootId : undefined, ...generationMetadata },
                    }));
                    const batchConnections = [...(isEmptyImageNode ? [] : [{ id: nanoid(), fromNodeId: nodeId, toNodeId: rootId }]), ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: rootId, toNodeId: childId }))];

                    if (!isGatewayConfigured) throw new Error("画布后台生成需要先配置 Gateway");
                    const [binding, uploadedReferences] = await Promise.all([
                        resolveCanvasJobModelBinding(modelOptionName(generationConfig.imageModel || generationConfig.model), "image"),
                        uploadCanvasVideoReferences(projectId, { referenceImages, referenceVideos: [], referenceAudios: [] }),
                    ]);
                    const jobs = await Promise.all(
                        targetIds.map((targetId) =>
                            createCanvasJob({
                                canvasId: projectId,
                                targetNodeId: targetId,
                                generationRevision: targetId === nodeId ? (sourceNode?.metadata?.generationRevision || 0) + 1 : 1,
                                clientRequestId: nanoid(),
                                kind: "image",
                                modelId: binding.bindingId,
                                channelId: binding.channelId,
                                input: {
                                    prompt: effectivePrompt,
                                    size: generationConfig.size,
                                    quality: generationConfig.quality,
                                    referenceImages: uploadedReferences.referenceImages,
                                },
                            }),
                        ),
                    );
                    const jobByTarget = new Map(jobs.map((job) => [job.targetNodeId, job]));
                    const rootJob = jobByTarget.get(rootId);
                    rootNode.metadata = { ...rootNode.metadata, ...(rootJob ? canvasJobReference(rootJob) : { status: NODE_STATUS_SUCCESS }) };
                    childNodes.forEach((child) => {
                        const job = jobByTarget.get(child.id);
                        if (job) child.metadata = { ...child.metadata, ...canvasJobReference(job) };
                    });

                    setNodes((prev) => [
                        ...prev.map((node) =>
                            node.id === nodeId
                                ? isConfigNode
                                    ? {
                                          ...node,
                                          metadata: { ...node.metadata, prompt: effectivePrompt, status: NODE_STATUS_SUCCESS, errorDetails: undefined },
                                      }
                                    : isEmptyImageNode
                                      ? {
                                            ...node,
                                            position: rootNode.position,
                                            width: rootNode.width,
                                            height: rootNode.height,
                                            title: rootNode.title,
                                            metadata: { ...node.metadata, ...rootNode.metadata, errorDetails: undefined },
                                        }
                                      : isImageNode
                                        ? {
                                              ...node,
                                              metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS, errorDetails: undefined },
                                          }
                                        : {
                                              ...node,
                                              type: CanvasNodeType.Text,
                                              title: prompt.slice(0, 32) || "Prompt",
                                              width: parentConfig.width,
                                              height: parentConfig.height,
                                              metadata: { ...node.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS, fontSize: 14, errorDetails: undefined },
                                          }
                                : node,
                        ),
                        ...(isEmptyImageNode ? [] : [rootNode]),
                        ...childNodes,
                    ]);
                    setConnections((prev) => [...prev, ...batchConnections]);
                    setSelectedNodeIds(new Set([nodeId]));
                    setSelectedConnectionId(null);
                    setDialogNodeId(nodeId);
                    return;
                }

                if (mode === "video") {
                    if (!isGatewayConfigured) throw new Error("画布后台生成需要先配置 Gateway");
                    const spec = nodeSizeFromRatio(generationConfig.size, NODE_DEFAULT_SIZE[CanvasNodeType.Video].width, NODE_DEFAULT_SIZE[CanvasNodeType.Video].height) || NODE_DEFAULT_SIZE[CanvasNodeType.Video];
                    const isEmptyVideoNode = sourceNode?.type === CanvasNodeType.Video && !sourceNode.metadata?.content;
                    const videoId = isEmptyVideoNode ? nodeId : nanoid();
                    const generationRevision = Math.max(0, isEmptyVideoNode ? sourceNode.metadata?.generationRevision || 0 : 0) + 1;
                    const clientRequestId = nanoid();
                    const modelName = modelOptionName(generationConfig.videoModel || generationConfig.model);
                    const [binding, artifacts] = await Promise.all([
                        resolveCanvasJobModelBinding(modelName, "video"),
                        uploadCanvasVideoReferences(projectId, generationContext),
                    ]);
                    const job = await createCanvasJob({
                        canvasId: projectId,
                        targetNodeId: videoId,
                        generationRevision,
                        clientRequestId,
                        kind: "video",
                        modelId: binding.bindingId,
                        channelId: binding.channelId,
                        input: {
                            prompt: effectivePrompt,
                            seconds: generationConfig.videoSeconds,
                            resolution: generationConfig.vquality,
                            size: generationConfig.size,
                            generateAudio: generationConfig.videoGenerateAudio,
                            watermark: generationConfig.videoWatermark,
                            referenceImages: artifacts.referenceImages,
                            referenceVideos: artifacts.referenceVideos,
                            referenceAudios: artifacts.referenceAudios,
                        },
                    });
                    const parent = sourceNode?.position || { x: 0, y: 0 };
                    const videoNode: CanvasNodeData = {
                        id: videoId,
                        type: CanvasNodeType.Video,
                        title: effectivePrompt.slice(0, 32) || "Generated Video",
                        position: isEmptyVideoNode ? sourceNode.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y },
                        width: isEmptyVideoNode ? sourceNode.width : spec.width,
                        height: isEmptyVideoNode ? sourceNode.height : spec.height,
                        metadata: {
                            prompt: effectivePrompt,
                            status: NODE_STATUS_LOADING,
                            model: generationConfig.model,
                            size: generationConfig.size,
                            seconds: generationConfig.videoSeconds,
                            vquality: generationConfig.vquality,
                            generateAudio: generationConfig.videoGenerateAudio,
                            watermark: generationConfig.videoWatermark,
                            references: generationReferenceUrls(generationContext),
                            ...canvasJobReference(job),
                        },
                    };
                    pendingChildIds = [videoId];
                    setNodes((prev) =>
                        isEmptyVideoNode
                            ? prev.map((node) => (node.id === nodeId ? { ...node, ...videoNode } : node))
                            : [...prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } } : node)), videoNode],
                    );
                    if (!isEmptyVideoNode) setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: videoId }]);
                    return;
                }

                if (mode === "audio") {
                    if (!isGatewayConfigured) throw new Error("画布后台生成需要先配置 Gateway");
                    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
                    const isEmptyAudioNode = sourceNode?.type === CanvasNodeType.Audio && !sourceNode.metadata?.content;
                    const audioId = isEmptyAudioNode ? nodeId : nanoid();
                    const binding = await resolveCanvasJobModelBinding(modelOptionName(generationConfig.audioModel || generationConfig.model), "audio");
                    const job = await createCanvasJob({
                        canvasId: projectId,
                        targetNodeId: audioId,
                        generationRevision: isEmptyAudioNode ? (sourceNode.metadata?.generationRevision || 0) + 1 : 1,
                        clientRequestId: nanoid(),
                        kind: "audio",
                        modelId: binding.bindingId,
                        channelId: binding.channelId,
                        input: {
                            prompt: effectivePrompt,
                            voice: generationConfig.audioVoice,
                            format: generationConfig.audioFormat,
                            speed: generationConfig.audioSpeed,
                            instructions: generationConfig.audioInstructions,
                        },
                    });
                    const parent = sourceNode?.position || { x: 0, y: 0 };
                    const audioNode: CanvasNodeData = {
                        id: audioId,
                        type: CanvasNodeType.Audio,
                        title: effectivePrompt.slice(0, 32) || "Generated Audio",
                        position: isEmptyAudioNode ? sourceNode.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y + ((sourceNode?.height || spec.height) - spec.height) / 2 },
                        width: isEmptyAudioNode ? sourceNode.width : spec.width,
                        height: isEmptyAudioNode ? sourceNode.height : spec.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, ...buildAudioGenerationMetadata(generationConfig), ...canvasJobReference(job) },
                    };
                    pendingChildIds = [audioId];
                    setNodes((prev) =>
                        isEmptyAudioNode
                            ? prev.map((node) => (node.id === nodeId ? { ...node, ...audioNode } : node))
                            : [...prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } } : node)), audioNode],
                    );
                    if (!isEmptyAudioNode) setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: audioId }]);
                    return;
                }

                if (!isGatewayConfigured) throw new Error("画布后台生成需要先配置 Gateway");
                const isConfigNode = sourceNode?.type === CanvasNodeType.Config;
                const textCount = isConfigNode ? getGenerationCount(generationConfig.count) : 1;
                const parentConfig = NODE_DEFAULT_SIZE[isConfigNode ? CanvasNodeType.Config : CanvasNodeType.Text];
                const textConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
                const parentPosition = sourceNode?.position || { x: 0, y: 0 };
                const childIds = isConfigNode || editingTextNode ? Array.from({ length: textCount }, () => nanoid()) : [];
                pendingChildIds = childIds;
                const textTargetIds = childIds.length ? childIds : [nodeId];
                const [binding, uploadedReferences] = await Promise.all([
                    resolveCanvasJobModelBinding(modelOptionName(generationConfig.textModel || generationConfig.model), "text"),
                    uploadCanvasVideoReferences(projectId, generationContext),
                ]);
                const jobs = await Promise.all(
                    textTargetIds.map((targetNodeId) =>
                        createCanvasJob({
                            canvasId: projectId,
                            targetNodeId,
                            generationRevision: targetNodeId === nodeId ? (sourceNode?.metadata?.generationRevision || 0) + 1 : 1,
                            clientRequestId: nanoid(),
                            kind: "text",
                            modelId: binding.bindingId,
                            channelId: binding.channelId,
                            input: {
                                prompt: effectivePrompt,
                                references: [...uploadedReferences.referenceImages, ...uploadedReferences.referenceVideos, ...uploadedReferences.referenceAudios],
                            },
                        }),
                    ),
                );
                const jobByTarget = new Map(jobs.map((job) => [job.targetNodeId, job]));
                if (isConfigNode || editingTextNode) {
                    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
                        id,
                        type: CanvasNodeType.Text,
                        title: effectivePrompt.slice(0, 32) || "Generated Text",
                        position: {
                            x: parentPosition.x + parentConfig.width + 96,
                            y: parentPosition.y + parentConfig.height / 2 - textConfig.height / 2 + (index - (textCount - 1) / 2) * (textConfig.height + 36),
                        },
                        width: textConfig.width,
                        height: textConfig.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, fontSize: 14, ...canvasJobReference(jobByTarget.get(id)!) },
                    }));
                    setNodes((prev) => [...prev.map((node) => (node.id === nodeId && isConfigNode ? { ...node, metadata: { ...node.metadata, prompt: effectivePrompt, status: NODE_STATUS_SUCCESS, errorDetails: undefined } } : node)), ...childNodes]);
                    setConnections((prev) => [...prev, ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: nodeId, toNodeId: childId }))]);
                } else {
                    const job = jobByTarget.get(nodeId)!;
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === nodeId
                                ? {
                                      ...node,
                                      type: CanvasNodeType.Text,
                                      title: prompt.slice(0, 32) || "Generated Text",
                                      metadata: { ...node.metadata, prompt: effectivePrompt, status: NODE_STATUS_LOADING, fontSize: node.metadata?.fontSize || 14, ...canvasJobReference(job) },
                                  }
                                : node,
                        ),
                    );
                }
            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) =>
                    prev.map((node) => (node.id === nodeId || pendingChildIds.includes(node.id) ? (node.id === nodeId && !markSourceStatus ? node : { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } }) : node)),
                );
            } finally {
                finishGenerationRequest(nodeId, runController);
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, finishGenerationRequest, isAiConfigReady, message, openConfigDialog, startGenerationRequest],
    );
    useEffect(() => {
        generateNodeRef.current = handleGenerateNode;
    }, [handleGenerateNode]);

    const prepareAgentExternalRun = useCallback(
        (event: ExternalCanvasRunStart) => {
            const source = useCanvasStore.getState().projects.find((item) => item.id === projectId);
            if (!source) throw new Error("母版画布不存在或尚未加载");
            const prepared = prepareExternalCanvasRun(source, event);
            const runCanvasId = importProject(prepared.project);
            return { runCanvasId };
        },
        [importProject, projectId],
    );

    const activateAgentExternalRun = useCallback(
        (event: ExternalCanvasRunStart & { runCanvasId: string }) => {
            navigate(`/canvas/${encodeURIComponent(event.runCanvasId)}?agentRunId=${encodeURIComponent(event.runId)}&agentAutoStart=1`);
        },
        [navigate],
    );

    const cancelAgentExternalRun = useCallback(
        (event: ExternalCanvasRunCancel) => {
            if (event.runCanvasId && event.runCanvasId !== activeProjectIdRef.current) return;
            generationRequestsRef.current.forEach((request) => request.controller.abort());
            generationRequestsRef.current.clear();
            invalidateViralAnalysisRun();
            invalidateViralPromptRun();
            invalidateViralVideoRun("独立画布运行已取消");
            setRunningNodeId(null);
            setNodes((current) => current.map((node) => node.metadata?.status === NODE_STATUS_LOADING ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails: "独立画布运行已取消" } } : node));
        },
        [invalidateViralAnalysisRun, invalidateViralPromptRun, invalidateViralVideoRun],
    );

    const resolveAgentExternalOutput = useCallback(async ({ nodeId }: { outputId: string; nodeId: string }) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        if (!node) throw new Error("运行产物节点不存在");
        const content = String(node.metadata?.content || "");
        const storageKey = String(node.metadata?.storageKey || "");
        const resolvedUrl = node.type === CanvasNodeType.Image
            ? await resolveImageUrl(storageKey, content)
            : node.type === CanvasNodeType.Video || node.type === CanvasNodeType.Audio
              ? await resolveMediaUrl(storageKey, content)
              : content;
        return resolveExternalRunOutput(node, resolvedUrl || "");
    }, []);

    useEffect(() => {
        const runId = searchParams.get("agentRunId") || "";
        if (!runId || searchParams.get("agentAutoStart") !== "1" || !projectLoaded || loadedProjectIdRef.current !== projectId || !generateNodeRef.current) return;
        const marker = `${projectId}:${runId}`;
        if (externalRunStartedRef.current === marker) return;
        const runners = nodesRef.current.filter((node) => {
            const metadata = (node.metadata || {}) as Record<string, unknown>;
            return metadata.runOnStart === true || String(metadata.contractRole || metadata.role || "").toLowerCase() === "runner";
        });
        if (!runners.length) return;
        externalRunStartedRef.current = marker;
        queueMicrotask(() => {
            runners.forEach((node) => {
                const rawMode = String(node.metadata?.generationMode || "image");
                const mode: CanvasNodeGenerationMode = rawMode === "text" || rawMode === "video" || rawMode === "audio" ? rawMode : "image";
                const prompt = String(node.metadata?.composerContent || node.metadata?.prompt || "");
                void generateNodeRef.current?.(node.id, mode, prompt);
            });
        });
    }, [projectId, projectLoaded, searchParams]);

    const handleRetryNode = useCallback(
        async (node: CanvasNodeData) => {
            const sourceNode = findRetrySourceNode(node.id, nodesRef.current, connectionsRef.current) || node;
            const batchRoot = node.metadata?.batchRootId ? nodesRef.current.find((item) => item.id === node.metadata?.batchRootId) : null;
            const savedImageMetadata = node.type === CanvasNodeType.Image ? { ...batchRoot?.metadata, ...node.metadata } : undefined;
            const hasSavedImageMetadata = Boolean(savedImageMetadata?.generationType);
            const generationConfig =
                hasSavedImageMetadata && savedImageMetadata
                    ? {
                          ...effectiveConfig,
                          model: savedImageMetadata.model || effectiveConfig.imageModel,
                          imageModel: savedImageMetadata.model || effectiveConfig.imageModel,
                          quality: savedImageMetadata.quality || effectiveConfig.quality,
                          size: savedImageMetadata.size || effectiveConfig.size,
                          count: "1",
                      }
                    : { ...buildGenerationConfig(effectiveConfig, sourceNode, node.type === CanvasNodeType.Text ? "text" : node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : "image"), count: "1" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            const context = hasSavedImageMetadata ? null : await hydrateNodeGenerationContext(buildNodeGenerationContext(sourceNode.id, nodesRef.current, connectionsRef.current, sourceNode.metadata?.prompt || node.metadata?.prompt || ""));
            const prompt = (savedImageMetadata?.prompt || context?.prompt || "").trim();
            if (!prompt) {
                message.warning("找不到提示词，无法重试");
                return;
            }
            const generationType = savedImageMetadata?.generationType;
            const useReferenceImages = generationType ? generationType === "edit" : Boolean(context?.referenceImages.length);
            const retryReferenceImages =
                hasSavedImageMetadata && savedImageMetadata ? await resolveMetadataReferences(savedImageMetadata) : useReferenceImages ? (context?.referenceImages.length ? context.referenceImages : sourceNodeReferenceImages(batchRoot || sourceNode)) : [];
            if (useReferenceImages && !retryReferenceImages) {
                message.error("参考图片已丢失，无法继续重试");
                setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: "参考图片已丢失，无法继续重试" } } : item)));
                return;
            }
            const retryImages = retryReferenceImages || [];

            if ([CanvasNodeType.Text, CanvasNodeType.Image, CanvasNodeType.Video, CanvasNodeType.Audio].includes(node.type) && node.metadata?.generationJobId) {
                const generationRevision = (node.metadata.generationRevision || 0) + 1;
                try {
                    const retried = await retryCanvasJob(node.metadata.generationJobId, { clientRequestId: nanoid(), generationRevision });
                    setNodes((prev) =>
                        prev.map((item) =>
                            item.id === node.id
                                ? {
                                      ...item,
                                      metadata: {
                                          ...item.metadata,
                                          ...canvasJobReference(retried),
                                          status: NODE_STATUS_LOADING,
                                          errorDetails: undefined,
                                      },
                                  }
                                : item,
                        ),
                    );
                } catch (error) {
                    message.error(error instanceof Error ? error.message : "后台视频任务重试失败");
                }
                return;
            }

            setRunningNodeId(node.id);
            setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_LOADING, errorDetails: undefined } } : item)));
            const controller = startGenerationRequest(node.id, sourceNode.id, node.id);

            try {
                if (node.type === CanvasNodeType.Text) {
                    if (!context) return;
                    let streamed = "";
                    const answer = await requestImageQuestion(
                        generationConfig,
                        buildNodeResponseMessages({ ...context, prompt }),
                        (text) => {
                            streamed = text;
                            setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, type: CanvasNodeType.Text, metadata: { ...item.metadata, content: text, status: NODE_STATUS_LOADING } } : item)));
                        },
                        { signal: controller.signal },
                    );
                    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, type: CanvasNodeType.Text, metadata: { ...item.metadata, content: answer || streamed, prompt, status: NODE_STATUS_SUCCESS } } : item)));
                    return;
                }
                if (node.type === CanvasNodeType.Video) {
                    const video = await storeGeneratedVideo(await requestVideoGeneration(generationConfig, prompt, retryImages, context?.referenceVideos || [], context?.referenceAudios || [], { signal: controller.signal }));
                    const videoSize = fitNodeSize(video.width || node.width, video.height || node.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                    setNodes((prev) =>
                        prev.map((item) =>
                            item.id === node.id
                                ? {
                                      ...item,
                                      width: videoSize.width,
                                      height: videoSize.height,
                                      position: { x: item.position.x + item.width / 2 - videoSize.width / 2, y: item.position.y + item.height / 2 - videoSize.height / 2 },
                                      metadata: {
                                          ...item.metadata,
                                          ...videoMetadata(video),
                                          prompt,
                                          model: generationConfig.model,
                                          size: generationConfig.size,
                                          seconds: generationConfig.videoSeconds,
                                          vquality: generationConfig.vquality,
                                          generateAudio: generationConfig.videoGenerateAudio,
                                          watermark: generationConfig.videoWatermark,
                                      },
                                  }
                                : item,
                        ),
                    );
                    return;
                }
                if (node.type === CanvasNodeType.Audio) {
                    const audio = await storeGeneratedAudio(await requestAudioGeneration(generationConfig, prompt, { signal: controller.signal }), generationConfig.audioFormat);
                    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, ...audioMetadata(audio), prompt, ...buildAudioGenerationMetadata(generationConfig) } } : item)));
                    return;
                }

                const image = useReferenceImages
                    ? await requestEdit(generationConfig, prompt, retryImages, undefined, { signal: controller.signal }).then((items) => items[0])
                    : await requestGeneration(generationConfig, prompt, { signal: controller.signal }).then((items) => items[0]);
                const uploadedImage = await uploadImage(image.dataUrl);
                const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
                const imageSize = fitNodeSize(uploadedImage.width, uploadedImage.height, imageConfig.width, imageConfig.height);
                const generationMetadata = savedImageMetadata?.generationType
                    ? { generationType: savedImageMetadata.generationType, model: generationConfig.model, size: generationConfig.size, quality: generationConfig.quality, count: savedImageMetadata.count || 1, references: savedImageMetadata.references }
                    : buildImageGenerationMetadata(useReferenceImages ? "edit" : "generation", generationConfig, 1, retryImages);
                setNodes((prev) =>
                    prev.map((item) =>
                        item.id === node.id
                            ? {
                                  ...item,
                                  type: CanvasNodeType.Image,
                                  width: imageSize.width,
                                  height: imageSize.height,
                                  metadata: { ...item.metadata, ...imageMetadata(uploadedImage), prompt, ...generationMetadata },
                              }
                            : item,
                    ),
                );
            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                finishGenerationRequest(node.id, controller);
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, finishGenerationRequest, isAiConfigReady, message, openConfigDialog, startGenerationRequest],
    );

    const generateImageFromTextNode = useCallback(
        (node: CanvasNodeData) => {
            const prompt = (node.metadata?.content || node.metadata?.prompt || "").trim();
            if (!prompt) {
                message.warning("文本节点为空，无法生图");
                return;
            }
            const sourceNode = nodesRef.current.find((item) => item.id === node.id);
            if (!sourceNode) return;
            const nodeSize = getNodeSpec(CanvasNodeType.Config);
            const configNode = createCanvasNode(
                CanvasNodeType.Config,
                {
                    x: sourceNode.position.x + sourceNode.width + 96 + nodeSize.width / 2,
                    y: sourceNode.position.y + sourceNode.height / 2,
                },
                {
                    prompt: "",
                    model: effectiveConfig.imageModel,
                    size: effectiveConfig.size,
                    count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                },
            );
            const connection = { id: nanoid(), fromNodeId: sourceNode.id, toNodeId: configNode.id };
            const nextNodes = nodesRef.current.map((item) => (item.id === sourceNode.id ? { ...item, metadata: { ...item.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS } } : item)).concat(configNode);
            const nextConnections = [...connectionsRef.current, connection];
            nodesRef.current = nextNodes;
            connectionsRef.current = nextConnections;
            setNodes(nextNodes);
            setConnections(nextConnections);
            setSelectedNodeIds(new Set([configNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(configNode.id);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message],
    );

    const insertAssistantImage = useCallback(
        async (image: CanvasAssistantImage) => {
            const storedImage = image.storageKey ? { url: image.dataUrl, storageKey: image.storageKey, width: 1, height: 1, bytes: 0, mimeType: "image/png" } : await uploadImage(image.dataUrl);
            const meta = storedImage.width === 1 && storedImage.height === 1 ? await readImageMeta(storedImage.url) : storedImage;
            const config = fitNodeSize(meta.width, meta.height);
            const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const node: CanvasNodeData = {
                id,
                type: CanvasNodeType.Image,
                title: image.prompt.slice(0, 32) || "Generated Image",
                position: { x: center.x - config.width / 2, y: center.y - config.height / 2 },
                width: config.width,
                height: config.height,
                metadata: { ...imageMetadata({ ...storedImage, width: meta.width, height: meta.height }), prompt: image.prompt },
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([id]));
            setSelectedConnectionId(null);
            setDialogNodeId(id);
        },
        [screenToCanvas, size.height, size.width],
    );

    const insertAssistantText = useCallback(
        (text: string) => {
            const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            const node = {
                ...createCanvasNode(CanvasNodeType.Text, center, { content: text, status: NODE_STATUS_SUCCESS }),
                title: text.slice(0, 32) || "Assistant Text",
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
        },
        [screenToCanvas, size.height, size.width],
    );

    const handleAssetInsert = useCallback(
        (payload: InsertAssetPayload) => {
            if (payload.kind === "text") {
                insertAssistantText(payload.content);
            } else if (payload.kind === "video") {
                const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Video];
                const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
                const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const nextSize = fitNodeSize(payload.width || spec.width, payload.height || spec.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                setNodes((prev) => [
                    ...prev,
                    {
                        id,
                        type: CanvasNodeType.Video,
                        title: payload.title,
                        position: { x: center.x - nextSize.width / 2, y: center.y - nextSize.height / 2 },
                        width: nextSize.width,
                        height: nextSize.height,
                        metadata: { content: payload.url, storageKey: payload.storageKey, status: NODE_STATUS_SUCCESS, naturalWidth: payload.width, naturalHeight: payload.height },
                    },
                ]);
                setSelectedNodeIds(new Set([id]));
            } else {
                insertAssistantImage({ id: `asset-${Date.now()}`, prompt: payload.title, dataUrl: payload.dataUrl, storageKey: payload.storageKey });
            }
            setAssetPickerOpen(false);
        },
        [insertAssistantImage, insertAssistantText, screenToCanvas, size.height, size.width],
    );

    const assistantOpen = assistantMounted && !assistantCollapsed;
    const openAgent = () => {
        if (agentCloseTimerRef.current) {
            clearTimeout(agentCloseTimerRef.current);
            agentCloseTimerRef.current = null;
        }
        setAssistantMounted(true);
        setAssistantClosing(false);
        setAssistantCollapsed(false);
    };
    const closeAgent = () => {
        if (!assistantMounted || assistantClosing) return;
        setAssistantCollapsed(true);
        setAssistantClosing(true);
        agentCloseTimerRef.current = setTimeout(() => {
            agentCloseTimerRef.current = null;
            setAssistantMounted(false);
            setAssistantClosing(false);
        }, CANVAS_AGENT_PANEL_MOTION_MS);
    };

    const handleViralVideoWorkflowChange = (patch: Partial<Extract<CanvasWorkflowState, { kind: "viral-video-remake" }>>) => {
        const project = useCanvasStore.getState().projects.find((item) => item.id === projectId);
        const workflow = project?.workflow;
        if (!workflow || workflow.kind !== "viral-video-remake") return;
        const replacementBrief = patch.replacementBrief === undefined ? workflow.replacementBrief : patch.replacementBrief;
        const candidateCount = patch.candidateCount === undefined ? workflow.candidateCount : normalizeViralCandidateCount(patch.candidateCount);
        const briefChanged = replacementBrief !== workflow.replacementBrief;
        const countChanged = candidateCount !== workflow.candidateCount;
        if (!briefChanged && !countChanged) return;
        if (!briefChanged) {
            const event: ViralWorkflowEvent = { type: workflow.machine?.phase === "ready_to_submit" || workflow.machine?.phase === "template_ready" ? "COUNT_CHANGED" : "EDIT_DRAFT" };
            updateProject(projectId, { workflow: { ...applyViralWorkflowEvents(workflow, [event]), candidateCount } });
            return;
        }
        invalidateViralVideoRun();
        invalidateViralPromptRun();
        const latestProject = useCanvasStore.getState().projects.find((item) => item.id === projectId);
        const latestWorkflow = latestProject?.workflow;
        if (!latestWorkflow || latestWorkflow.kind !== "viral-video-remake") return;
        const hasAnalysis = Boolean(latestWorkflow.analysisNodeId && nodesRef.current.some((node) => node.id === latestWorkflow.analysisNodeId && node.metadata?.viralVideoAnalysis));
        const invalidatedPromptNodeIds = new Set(nodesRef.current.filter((node) => Boolean(node.metadata?.viralVideoPromptRole)).map((node) => node.id));
        const nextNodes = nodesRef.current.filter((node) => !invalidatedPromptNodeIds.has(node.id));
        const nextConnections = connectionsRef.current.filter(
            (connection) => !invalidatedPromptNodeIds.has(connection.fromNodeId) && !invalidatedPromptNodeIds.has(connection.toNodeId),
        );
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        updateProject(projectId, {
            nodes: nextNodes,
            connections: nextConnections,
            workflow: {
                ...latestWorkflow,
                replacementBrief,
                candidateCount,
                phase: hasAnalysis ? "requirements_ready" : "idle",
                promptNodeIds: undefined,
                masterPromptNodeId: undefined,
                outputNodeIds: undefined,
            },
        });
    };

    const updateViralReplacementLibrary = (
        nodeId: string,
        updater: (library: ViralVideoReplacementLibrary) => ViralVideoReplacementLibrary,
        invalidatesPlan = true,
    ) => {
        if (invalidatesPlan) resetViralWorkflowAfterUpload(nodeId);
        const nextNodes = nodesRef.current.map((node) => {
            if (node.id !== nodeId) return node;
            const library = node.metadata?.viralVideoReplacementLibrary || { collapsed: false, elements: [] };
            const nextLibrary = updater(library);
            return {
                ...node,
                height: nextLibrary.collapsed ? 260 : node.metadata?.viralVideoAnalysis ? 820 : 560,
                metadata: { ...node.metadata, viralVideoReplacementLibrary: nextLibrary },
            };
        });
        nodesRef.current = nextNodes;
        setNodes(nextNodes);
        updateProject(projectId, { nodes: nextNodes });
    };

    useEffect(() => {
        const workflow = currentProject?.workflow;
        if (workflow?.kind !== "universal-viral-remake-beta" || !workflow.activeRunId) {
            setUniversalRemakeRun(undefined);
            return;
        }
        let cancelled = false;
        const refresh = async () => {
            try {
                let run = await getUniversalRemakeRun(workflow.activeRunId as string);
                const [latestRun] = await listUniversalRemakeRuns(projectId);
                if (latestRun && latestRun.id !== run.id && latestRun.updated_at > run.updated_at) {
                    run = latestRun;
                    const latestWorkflow = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
                    if (latestWorkflow?.kind === "universal-viral-remake-beta" && latestWorkflow.activeRunId !== latestRun.id) {
                        updateProject(projectId, { workflow: { ...latestWorkflow, activeRunId: latestRun.id } });
                    }
                }
                if (cancelled) return;
                setUniversalRemakeRun(run);
                const phase = run.status === "completed" ? "completed" : run.status === "failed" || run.status === "cancelled" ? "failed" : "running";
                const latest = useCanvasStore.getState().projects.find((item) => item.id === projectId)?.workflow;
                if (latest?.kind === "universal-viral-remake-beta" && latest.phase !== phase) updateProject(projectId, { workflow: { ...latest, phase } });
            } catch (error) {
                if (!cancelled) console.warn("[universal-remake] run refresh failed", error);
            }
        };
        void refresh();
        const timer = window.setInterval(() => void refresh(), 2_500);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [currentProject?.workflow, projectId, updateProject]);

    if (!projectLoaded || loadedProjectIdRef.current !== projectId) return <CanvasRefreshShell />;
    const ecommerceWorkflow = currentProject?.workflow?.kind === "ecommerce-video" ? currentProject.workflow : null;
    const projectPosterWorkflow = currentProject?.workflow?.kind === "project-poster" ? currentProject.workflow : null;
    const jewelryProductWorkflow = currentProject?.workflow?.kind === "jewelry-product-images" ? currentProject.workflow : null;
    const viralVideoRemakeWorkflow = currentProject?.workflow?.kind === "viral-video-remake" ? currentProject.workflow : null;
    const universalRemakeWorkflow = currentProject?.workflow?.kind === "universal-viral-remake-beta" ? currentProject.workflow : null;
    const activeViralBatch = viralVideoRemakeWorkflow?.activeBatchId ? viralBatches.find((batch) => batch.id === viralVideoRemakeWorkflow.activeBatchId) : undefined;
    const viralReplacementNode = viralVideoRemakeWorkflow ? nodes.find((node) => node.id === viralVideoRemakeWorkflow.replacementNodeId) : undefined;
    const viralReplacementAssetCount = listViralVideoReplacementAssets(viralReplacementNode?.metadata?.viralVideoReplacementLibrary).length;
    const viralVideoPlans: ReturnType<typeof collectActiveViralVideoPlans> = viralVideoRemakeWorkflow ? collectActiveViralVideoPlans(viralVideoRemakeWorkflow, nodes) : { plans: [] };
    const viralVideoTaskCount = viralVideoPlans.error ? 0 : viralVideoPlans.plans.length;

    return (
        <main className="flex h-full min-h-0 overflow-hidden" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <section className="relative min-w-0 flex-1 overflow-hidden">
                <CanvasTopBar
                    title={currentProject?.title || "未命名画布"}
                    titleDraft={titleDraft}
                    isTitleEditing={titleEditing}
                    onTitleDraftChange={setTitleDraft}
                    onStartTitleEditing={startTitleEditing}
                    onFinishTitleEditing={finishTitleEditing}
                    onCancelTitleEditing={() => setTitleEditing(false)}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    onHome={() => navigate("/")}
                    onProjects={() => navigate("/canvas")}
                    onCreateProject={createAndOpenProject}
                    onDeleteProject={deleteCurrentProject}
                    onImportImage={() => handleUploadRequest()}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    agentOpen={assistantOpen}
                    compactAgentStatus={{ connected: localAgentConnected, enabled: localAgentEnabled, activity: localAgentActivity }}
                    onToggleAgent={() => (assistantOpen ? closeAgent() : openAgent())}
                />

                {universalRemakeWorkflow ? (
                    <UniversalRemakeCanvasBar workflow={universalRemakeWorkflow} />
                ) : viralVideoRemakeWorkflow ? (
                    <ViralVideoRemakeCanvasBar
                        workflow={viralVideoRemakeWorkflow}
                        hasSourceVideo={Boolean(nodes.find((node) => node.id === viralVideoRemakeWorkflow.sourceVideoNodeId && node.type === CanvasNodeType.Video && node.metadata?.content))}
                        replacementAssetCount={viralReplacementAssetCount}
                        running={viralRemakeBatch.running}
                        stageLabel={viralRemakeBatch.stageLabel}
                        completed={viralRemakeBatch.completed}
                        total={viralRemakeBatch.total}
                        totalVideoTasks={viralVideoTaskCount}
                        onWorkflowChange={handleViralVideoWorkflowChange}
                        onUploadSource={() => handleVideoUploadRequest(viralVideoRemakeWorkflow.sourceVideoNodeId)}
                        onOpenReplacements={() => {
                            const node = nodesRef.current.find((item) => item.id === viralVideoRemakeWorkflow.replacementNodeId);
                            if (!node) return;
                            setSelectedNodeIds(new Set([node.id]));
                            setSelectedConnectionId(null);
                            setViewport((current) => ({
                                ...current,
                                x: size.width / 2 - (node.position.x + node.width / 2) * current.k,
                                y: size.height / 2 - (node.position.y + node.height / 2) * current.k,
                            }));
                        }}
                        onAnalyze={() => void analyzeViralVideo()}
                        onGeneratePrompts={() => void generateViralVideoPrompts()}
                        onGenerateRemake={handleGenerateViralRemake}
                    />
                ) : jewelryProductWorkflow ? (
                    <JewelryProductCanvasBar
                        workflow={jewelryProductWorkflow}
                        hasProductImage={Boolean(nodes.find((node) => node.id === jewelryProductWorkflow.productNodeId)?.metadata?.content)}
                        hasHeroTemplate={Boolean(nodes.find((node) => node.id === jewelryProductWorkflow.heroTemplateNodeId)?.metadata?.content)}
                        hasWearingReference={Boolean(nodes.find((node) => node.id === jewelryProductWorkflow.wearingReferenceNodeId)?.metadata?.content)}
                        running={jewelryBatch.running}
                        completed={jewelryBatch.completed}
                        total={jewelryBatch.total}
                        onWorkflowChange={(patch) => updateProject(projectId, { workflow: { ...jewelryProductWorkflow, ...patch } })}
                        onUpload={handleProductUploadRequest}
                        onGenerate={() => void generateJewelryProductImages()}
                    />
                ) : ecommerceWorkflow ? (
                    <EcommerceCanvasBar
                        workflow={ecommerceWorkflow}
                        hasProductImage={Boolean(nodes.find((node) => node.id === ecommerceWorkflow.productNodeId)?.metadata?.content)}
                        running={ecommerceBatch.running}
                        completed={ecommerceBatch.completed}
                        total={ecommerceBatch.total}
                        onWorkflowChange={(patch) => updateProject(projectId, { workflow: { ...ecommerceWorkflow, ...patch } })}
                        onUploadProduct={() => handleProductUploadRequest(ecommerceWorkflow.productNodeId)}
                        onGenerate={() => void generateEcommerceVideos()}
                    />
                ) : projectPosterWorkflow ? (
                    <ProjectPosterCanvasBar
                        workflow={projectPosterWorkflow}
                        hasReferenceImage={Boolean(nodes.find((node) => node.id === projectPosterWorkflow.referenceNodeId)?.metadata?.content)}
                        running={posterBatch.running}
                        completed={posterBatch.completed}
                        total={posterBatch.total}
                        onWorkflowChange={(patch) => updateProject(projectId, { workflow: { ...projectPosterWorkflow, ...patch } })}
                        onUploadReference={() => handleProductUploadRequest(projectPosterWorkflow.referenceNodeId)}
                        onGenerate={() => void generateProjectPosters()}
                    />
                ) : null}

                <InfiniteCanvas
                    containerRef={containerRef}
                    viewport={viewport}
                    backgroundMode={backgroundMode}
                    onViewportChange={(next) => {
                        setViewport(next);
                        setContextMenu(null);
                    }}
                    onCanvasMouseDown={handleCanvasMouseDown}
                    onCanvasDeselect={deselectCanvas}
                    onContextMenu={preventCanvasContextMenu}
                    onDrop={handleDrop}
                >
                    <svg className="absolute left-0 top-0 h-[10000px] w-[10000px] overflow-visible" style={{ pointerEvents: "none", transform: "translateZ(0)", zIndex: 0 }}>
                        {displayConnections
                            .filter(({ connection }) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                return Boolean(from && to && !isHiddenBatchConnectionEndpoint(from, nodes) && !isHiddenBatchConnectionEndpoint(to, nodes));
                            })
                            .map(({ connection, kind }) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                if (!from || !to) return null;

                                return (
                                    <ConnectionPath
                                        key={connection.id}
                                        connection={connection}
                                        from={from}
                                        to={to}
                                        kind={kind}
                                        active={selectedConnectionId === connection.id || relatedHighlight.connectionIds.has(connection.id)}
                                        onSelect={() => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                            setContextMenu(null);
                                        }}
                                        onContextMenu={(event) => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                            setContextMenu({ type: "connection", x: event.clientX, y: event.clientY, connectionId: connection.id });
                                        }}
                                    />
                                );
                            })}
                        {connectingParams ? <ActiveConnectionPath node={nodeById.get(connectingParams.nodeId)} handle={connectingParams} mouseWorld={mouseWorld} target={connectionTargetNodeId ? nodeById.get(connectionTargetNodeId) : undefined} /> : null}
                    </svg>

                    {visibleNodes.map((node) => (
                        <CanvasNode
                            key={node.id}
                            data={node}
                            scale={viewport.k}
                            isSelected={selectedNodeIds.has(node.id)}
                            isRelated={relatedHighlight.nodeIds.has(node.id)}
                            isFocusRelated={activeNodeId === node.id}
                            isConnectionTarget={connectionTargetNodeId === node.id}
                            isConnecting={Boolean(connectingParams)}
                            editRequestNonce={editingNodeId === node.id ? editRequestNonce : 0}
                            showPanel={dialogNodeId === node.id && !selectionBox}
                            batchCount={batchChildCountById.get(node.id) || 0}
                            groupChildCount={groupChildCountById.get(node.id) || 0}
                            isGroupDropTarget={dropTargetGroupId === node.id}
                            batchExpanded={Boolean(node.metadata?.imageBatchExpanded)}
                            batchClosing={Boolean(node.metadata?.batchRootId && collapsingBatchIds.has(node.metadata.batchRootId))}
                            batchOpening={openingBatchIds.has(node.id)}
                            batchRecovering={collapsingBatchIds.has(node.id)}
                            batchMotion={batchMotionById.get(node.id)}
                            showImageInfo={showImageInfo}
                            resourceLabel={resourceReferenceByNodeId.get(node.id)}
                            mentionReferences={mentionReferencesByNodeId.get(node.id) || []}
                            renderPanel={(panelNode) =>
                                panelNode.type === CanvasNodeType.Config ? (
                                    <CanvasConfigComposer
                                        value={panelNode.metadata?.composerContent ?? panelNode.metadata?.prompt ?? ""}
                                        inputs={configInputsById.get(panelNode.id) || []}
                                        onChange={(composerContent) => handleConfigNodeChange(panelNode.id, { composerContent })}
                                        onClose={() => setDialogNodeId(null)}
                                    />
                                ) : (
                                    <CanvasNodePromptPanel
                                        node={panelNode}
                                        isRunning={runningNodeId === panelNode.id}
                                        mentionReferences={mentionReferencesByNodeId.get(panelNode.id) || []}
                                        onPromptChange={handleNodePromptChange}
                                        onConfigChange={handleConfigNodeChange}
                                        onGenerate={handleGenerateNode}
                                        onStop={confirmStopGeneration}
                                        onImageSettingsOpenChange={(open) => {
                                            setNodeImageSettingsOpen(open);
                                            if (open) setToolbarNodeId(null);
                                        }}
                                    />
                                )
                            }
                            renderNodeContent={(contentNode) => {
                                const universalRole = contentNode.metadata?.universalRemakeCard?.role;
                                if (universalRole && universalRemakeWorkflow) {
                                    if (universalRole === "reference") return <UniversalRemakeAnalysisContent
                                        videoUrl={contentNode.metadata?.content}
                                        reconstruction={universalRemakeWorkflow.reconstruction}
                                        busy={universalRemakeBusy}
                                        error={universalRemakeWorkflow.error}
                                        onUpload={() => handleVideoUploadRequest(universalRemakeWorkflow.referenceNodeId)}
                                        onAnalyze={() => void analyzeUniversalRemake()}
                                        onContinue={() => void compileUniversalTemplate()}
                                    />;
                                    if (universalRole === "bindings") return <UniversalRemakeBindingsContent
                                        reconstruction={universalRemakeWorkflow.reconstruction}
                                        replacements={universalRemakeWorkflow.replacements}
                                        assets={universalRemakeWorkflow.replacementAssets}
                                        bindings={universalRemakeWorkflow.explicitBindings}
                                        busy={universalRemakeBusy}
                                        onFiles={(files, sourceEntityId) => void addUniversalReplacementFiles(files, sourceEntityId)}
                                        onBind={bindUniversalReplacement}
                                    />;
                                    if (universalRole === "template") return <UniversalRemakeTemplateContent
                                        reconstruction={universalRemakeWorkflow.reconstruction}
                                        template={universalRemakeWorkflow.template}
                                        busy={universalRemakeBusy}
                                        onCompile={compileUniversalTemplate}
                                    />;
                                    if (universalRole === "run") return <UniversalRemakeRunContent
                                        template={universalRemakeWorkflow.template}
                                        summary={universalRemakeWorkflow.summary}
                                        candidateCount={universalRemakeWorkflow.candidateCount}
                                        maxInFlight={universalRemakeWorkflow.maxInFlight}
                                        maxDuration={universalRemakeWorkflow.maxSegmentDurationSeconds}
                                        busy={universalRemakeBusy}
                                        onSettings={updateUniversalSettings}
                                        onGenerate={() => void generateUniversalRemake()}
                                    />;
                                    return <UniversalRemakeResultsContent
                                        run={universalRemakeRun}
                                        onPause={() => universalRemakeRun && void pauseUniversalRemakeRun(universalRemakeRun.id).then(setUniversalRemakeRun).catch((error) => message.error(error.message))}
                                        onResume={() => universalRemakeRun && void resumeUniversalRemakeRun(universalRemakeRun.id).then(setUniversalRemakeRun).catch((error) => message.error(error.message))}
                                        onCancel={() => universalRemakeRun && void cancelUniversalRemakeRun(universalRemakeRun.id).then(setUniversalRemakeRun).catch((error) => message.error(error.message))}
                                        onRetryComposition={(index) => universalRemakeRun && void retryUniversalRemakeComposition(universalRemakeRun.id, index).then(setUniversalRemakeRun).catch((error) => message.error(error.message))}
                                    />;
                                }
                                if (contentNode.metadata?.viralVideoReplacementLibrary) {
                                    const analysisNode = viralVideoRemakeWorkflow?.analysisNodeId
                                        ? nodes.find((node) => node.id === viralVideoRemakeWorkflow.analysisNodeId)
                                        : undefined;
                                    const isBusy = viralRemakeBatch.running || Boolean(viralAnalysisRunRef.current || viralPromptRunRef.current || viralVideoRunRef.current || viralVideoLaunchRef.current);
                                    return (
                                        <ViralVideoReplacementLibraryNodeContent
                                            library={contentNode.metadata.viralVideoReplacementLibrary}
                                            shotFrames={analysisNode?.metadata?.viralVideoShotFrames || []}
                                            analysis={analysisNode?.metadata?.viralVideoAnalysis}
                                            replacementBrief={viralVideoRemakeWorkflow?.replacementBrief || ""}
                                            onReplacementBriefChange={(value) => handleViralVideoWorkflowChange({ replacementBrief: value })}
                                            disabled={isBusy}
                                            onAddAssets={(elementId) => handleViralReplacementUploadRequest(contentNode.id, elementId)}
                                            onConfirmElement={(elementId) => {
                                                const affectedEventIds = (analysisNode?.metadata?.viralVideoAnalysis?.mustKeepEvents || [])
                                                    .filter((event) => event.involvedObjectIds.includes(elementId))
                                                    .map((event) => event.id);
                                                updateViralReplacementLibrary(contentNode.id, (library) => confirmViralVideoReplacementElement(library, elementId, affectedEventIds));
                                                message.success("已确认替换关系，后续母版将按该素材锁定全片");
                                            }}
                                            onAddElement={() =>
                                                updateViralReplacementLibrary(contentNode.id, (library) => {
                                                    const manualIndex = library.elements.filter((element) => element.source === "manual").length + 1;
                                                    return {
                                                        ...library,
                                                        elements: [
                                                            ...library.elements,
                                                            { ...createManualViralVideoReplacementElement(manualIndex), id: nanoid() },
                                                        ],
                                                    };
                                                })
                                            }
                                            onRemoveElement={(elementId) =>
                                                updateViralReplacementLibrary(contentNode.id, (library) => ({
                                                    ...library,
                                                    elements: library.elements.filter((element) => element.id !== elementId),
                                                }))
                                            }
                                            onRemoveAsset={(elementId, assetId) =>
                                                updateViralReplacementLibrary(contentNode.id, (library) => ({
                                                    ...library,
                                                    elements: library.elements.map((element) =>
                                                        element.id === elementId
                                                            ? { ...element, assets: element.assets.filter((asset) => asset.id !== assetId) }
                                                            : element,
                                                    ),
                                                }))
                                            }
                                            onRenameElement={(elementId, name) =>
                                                updateViralReplacementLibrary(contentNode.id, (library) => ({
                                                    ...library,
                                                    elements: library.elements.map((element) => (element.id === elementId ? { ...element, name } : element)),
                                                }))
                                            }
                                            onToggleCollapsed={() =>
                                                updateViralReplacementLibrary(contentNode.id, (library) => ({ ...library, collapsed: !library.collapsed }), false)
                                            }
                                        />
                                    );
                                }
                                if (contentNode.metadata?.viralVideoBatchRecipe) {
                                    const isBusy = viralRemakeBatch.running || Boolean(viralAnalysisRunRef.current || viralPromptRunRef.current || viralVideoRunRef.current || viralVideoLaunchRef.current);
                                    return <ViralVideoBatchNodeContent
                                        recipe={{ ...contentNode.metadata.viralVideoBatchRecipe, candidateCount: viralVideoRemakeWorkflow?.candidateCount || 1 }}
                                        cost={viralVideoRemakeWorkflow?.remakeTemplate ? estimateViralBatchCost({ candidateCount: viralVideoRemakeWorkflow.candidateCount, durationSeconds: viralVideoRemakeWorkflow.remakeTemplate.targetDurationSeconds, videoCentsPerSecond: 1, authorizationThresholdCents: 1000 }) : undefined}
                                        disabled={isBusy || viralVideoRemakeWorkflow?.phase !== "template_ready"}
                                        onCountChange={(candidateCount) => {
                                            handleViralVideoWorkflowChange({ candidateCount });
                                        }}
                                        onGenerate={handleGenerateViralRemake}
                                    />;
                                }
                                if (contentNode.id === viralVideoRemakeWorkflow?.resultsNodeId) {
                                    const apply = async (action: typeof pauseViralBatch) => {
                                        if (!activeViralBatch) return;
                                        try { upsertViralBatch(await action(activeViralBatch.id)); } catch (error) { message.error(error instanceof Error ? error.message : "批次操作失败"); }
                                    };
                                    return <ViralVideoResultsNodeContent
                                        batch={activeViralBatch}
                                        onPause={() => void apply(pauseViralBatch)}
                                        onResume={() => void apply(resumeViralBatch)}
                                        onCancel={() => void apply(cancelViralBatch)}
                                        onRetryFailed={() => void apply(retryFailedViralBatch)}
                                    />;
                                }
                                if (contentNode.metadata?.viralVideoAnalysis) {
                                    const isBusy = viralRemakeBatch.running || Boolean(viralAnalysisRunRef.current || viralPromptRunRef.current || viralVideoRunRef.current || viralVideoLaunchRef.current);
                                    return (
                                        <ViralVideoAnalysisNodeContent
                                            analysis={contentNode.metadata.viralVideoAnalysis}
                                            shotFrames={contentNode.metadata.viralVideoShotFrames || []}
                                            onNext={() => {
                                                if (isBusy) return;
                                                void generateViralVideoPrompts();
                                            }}
                                            disabled={isBusy}
                                        />
                                    );
                                }
                                if (contentNode.metadata?.viralVideoPromptRole === "template" && contentNode.metadata.viralVideoRemakeTemplate) {
                                    const isBusy = viralRemakeBatch.running || Boolean(viralAnalysisRunRef.current || viralPromptRunRef.current || viralVideoRunRef.current || viralVideoLaunchRef.current);
                                    return (
                                        <ViralVideoTemplateNodeContent
                                            template={contentNode.metadata.viralVideoRemakeTemplate}
                                            masterPrompt={contentNode.metadata.prompt || ""}
                                            onMasterPromptChange={(value) => handleNodeContentChange(contentNode.id, value)}
                                            disabled={isBusy}
                                        />
                                    );
                                }
                                return (
                                    <CanvasConfigNodePanel
                                        node={contentNode}
                                        isRunning={runningNodeId === contentNode.id}
                                        inputSummary={getInputSummary(configInputsById.get(contentNode.id) || [])}
                                        onConfigChange={handleConfigNodeChange}
                                        onComposerToggle={() => setDialogNodeId((current) => (current === contentNode.id ? null : contentNode.id))}
                                        onStop={confirmStopGeneration}
                                        onGenerate={(nodeId) => {
                                            const target = nodesRef.current.find((item) => item.id === nodeId);
                                            void handleGenerateNode(nodeId, target?.metadata?.generationMode || "image", target?.metadata?.composerContent ?? target?.metadata?.prompt ?? "");
                                        }}
                                    />
                                );
                            }}
                            onMouseDown={handleNodeMouseDown}
                            onHoverStart={(nodeId) => {
                                if (nodeDraggingRef.current) return;
                                setHoveredNodeId(nodeId);
                            }}
                            onHoverEnd={(nodeId) => {
                                setHoveredNodeId((current) => (current === nodeId ? null : current));
                            }}
                            onConnectStart={handleConnectStart}
                            onResize={handleNodeResize}
                            onContentChange={handleNodeContentChange}
                            onTitleChange={handleNodeTitleChange}
                            onToggleBatch={toggleBatchExpanded}
                            onSetBatchPrimary={setBatchPrimary}
                            onRetry={(node) => void handleRetryNode(node)}
                            onGenerateImage={generateImageFromTextNode}
                            onViewImage={(node) => setPreviewNodeId(node.id)}
                            onContextMenu={(event, id) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setContextMenu({ type: "node", x: event.clientX, y: event.clientY, nodeId: id });
                            }}
                        />
                    ))}

                    {selectionBox ? (
                        <div
                            className="pointer-events-none absolute z-[100] border"
                            style={{
                                left: Math.min(selectionBox.startWorldX, selectionBox.currentWorldX),
                                top: Math.min(selectionBox.startWorldY, selectionBox.currentWorldY),
                                width: Math.abs(selectionBox.currentWorldX - selectionBox.startWorldX),
                                height: Math.abs(selectionBox.currentWorldY - selectionBox.startWorldY),
                                borderColor: theme.canvas.selectionStroke,
                                background: theme.canvas.selectionFill,
                            }}
                        />
                    ) : null}
                    {pendingConnectionCreate ? <ConnectionCreateMenu pending={pendingConnectionCreate} onCreate={(type) => createConnectedNode(type, pendingConnectionCreate)} onClose={cancelPendingConnectionCreate} /> : null}
                </InfiniteCanvas>

                <CanvasNodeHoverToolbar
                    node={isNodeDragging || nodeImageSettingsOpen ? null : toolbarNode}
                    viewport={viewport}
                    onKeep={keepNodeToolbar}
                    onLeave={hideNodeToolbar}
                    onInfo={(node) => setInfoNodeId(node.id)}
                    onEditText={openTextEditor}
                    onDecreaseFont={(node) => handleFontSizeChange(node.id, Math.max(10, (node.metadata?.fontSize || 14) - 2))}
                    onIncreaseFont={(node) => handleFontSizeChange(node.id, Math.min(32, (node.metadata?.fontSize || 14) + 2))}
                    onToggleDialog={(node) => setDialogNodeId((current) => (current === node.id ? null : node.id))}
                    onGenerateImage={generateImageFromTextNode}
                    onUpload={(node) => handleUploadRequest(node.id)}
                    onDownload={downloadNodeImage}
                    onSaveAsset={(node) => void saveNodeAsset(node)}
                    onMaskEdit={(node) => setMaskEditNodeId(node.id)}
                    onCrop={(node) => setCropNodeId(node.id)}
                    onSplit={(node) => setSplitNodeId(node.id)}
                    onUpscale={(node) => setUpscaleNodeId(node.id)}
                    onSuperResolve={(node) => setSuperResolveNodeId(node.id)}
                    onAngle={(node) => setAngleNodeId(node.id)}
                    onViewImage={(node) => setPreviewNodeId(node.id)}
                    onReversePrompt={createImageReversePromptNodes}
                    onRetry={(node) => void handleRetryNode(node)}
                    onToggleFreeResize={(node) => toggleNodeFreeResize(node.id)}
                    onDelete={(node) => deleteNodes(new Set([node.id]))}
                />

                <CanvasToolbar
                    selectedCount={selectedNodeIds.size}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    backgroundMode={backgroundMode}
                    showImageInfo={showImageInfo}
                    showAllConnections={showAllConnections}
                    onAddImage={() => createNode(CanvasNodeType.Image)}
                    onAddVideo={() => createNode(CanvasNodeType.Video)}
                    onAddAudio={() => createNode(CanvasNodeType.Audio)}
                    onAddText={() => createNode(CanvasNodeType.Text)}
                    onAddConfig={() => createNode(CanvasNodeType.Config)}
                    onAddGroup={() => createNode(CanvasNodeType.Group)}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    onUpload={() => handleUploadRequest()}
                    onOpenViralVideoRemake={activateViralVideoRemake}
                    onOpenUniversalRemake={activateUniversalRemake}
                    onDelete={() => deleteNodes(new Set(selectedNodeIds))}
                    onClear={() => setClearConfirmOpen(true)}
                    onDeselect={deselectCanvas}
                    onBackgroundModeChange={setBackgroundMode}
                    onShowImageInfoChange={setShowImageInfo}
                    onShowAllConnectionsChange={setShowAllConnections}
                    onOpenMyAssets={() => {
                        setAssetPickerOpen(true);
                    }}
                />

                {isMiniMapOpen ? <Minimap nodes={nodes} viewport={viewport} viewportSize={size} onViewportChange={setViewport} /> : null}

                <CanvasZoomControls scale={viewport.k} onScaleChange={setZoomScale} onReset={resetViewport} isMiniMapOpen={isMiniMapOpen} onToggleMiniMap={() => setIsMiniMapOpen((value) => !value)} />

                {contextMenu ? (
                    <CanvasNodeContextMenu
                        menu={contextMenu}
                        onClose={() => setContextMenu(null)}
                        onDuplicate={() => {
                            if (contextMenu.type !== "node") return;
                            duplicateNode(contextMenu.nodeId);
                            setContextMenu(null);
                        }}
                        onDelete={() => {
                            if (contextMenu.type === "node") {
                                deleteNodes(new Set([contextMenu.nodeId]));
                            } else {
                                deleteConnection(contextMenu.connectionId);
                            }
                            setContextMenu(null);
                        }}
                    />
                ) : null}

                <input ref={imageInputRef} type="file" accept="image/*,video/*,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav" className="hidden" onChange={handleImageInputChange} />

                <CanvasNodeInfoModal node={infoNode} open={Boolean(infoNode)} onClose={() => setInfoNodeId(null)} />

                {cropNode?.metadata?.content ? <CanvasNodeCropDialog dataUrl={cropNode.metadata.content} open={Boolean(cropNode)} onClose={() => setCropNodeId(null)} onConfirm={(crop) => void cropImageNode(cropNode!, crop)} /> : null}

                {maskEditNode?.metadata?.content ? (
                    <CanvasNodeMaskEditDialog dataUrl={maskEditNode.metadata.content} open={Boolean(maskEditNode)} onClose={() => setMaskEditNodeId(null)} onConfirm={(payload) => void maskEditImageNode(maskEditNode!, payload)} />
                ) : null}

                {splitNode?.metadata?.content ? <CanvasNodeSplitDialog dataUrl={splitNode.metadata.content} open={Boolean(splitNode)} onClose={() => setSplitNodeId(null)} onConfirm={(params) => void splitImageNode(splitNode!, params)} /> : null}

                {upscaleNode?.metadata?.content ? (
                    <CanvasNodeUpscaleDialog dataUrl={upscaleNode.metadata.content} open={Boolean(upscaleNode)} onClose={() => setUpscaleNodeId(null)} onConfirm={(params) => void upscaleImageNode(upscaleNode!, params)} />
                ) : null}

                <Modal title="AI 超分" open={Boolean(superResolveNode?.metadata?.content)} centered footer={null} onCancel={() => setSuperResolveNodeId(null)}>
                    <div className="py-8 text-center text-base font-medium">暂未实现</div>
                </Modal>

                {angleNode?.metadata?.content ? <CanvasNodeAngleDialog dataUrl={angleNode.metadata.content} open={Boolean(angleNode)} onClose={() => setAngleNodeId(null)} onConfirm={(params) => void generateAngleNode(angleNode!, params)} /> : null}

                <Modal
                    title="图片详情"
                    open={Boolean(previewNode?.metadata?.content)}
                    centered
                    onCancel={() => setPreviewNodeId(null)}
                    footer={null}
                    width="auto"
                    styles={{ body: { padding: 0, display: "flex", justifyContent: "center", alignItems: "center", maxHeight: "80vh" } }}
                >
                    {previewNode?.metadata?.content ? <img src={previewNode.metadata.content} alt={previewNode.title || "图片"} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} /> : null}
                </Modal>

                <Modal
                    title="清空画布？"
                    open={clearConfirmOpen}
                    centered
                    onCancel={() => setClearConfirmOpen(false)}
                    footer={
                        <>
                            <Button onClick={() => setClearConfirmOpen(false)}>取消</Button>
                            <Button danger type="primary" onClick={clearCanvas}>
                                清空
                            </Button>
                        </>
                    }
                >
                    <p className="text-sm opacity-60">这会删除当前画布上的所有节点和连线。</p>
                </Modal>

                <AssetPickerModal open={assetPickerOpen} onInsert={handleAssetInsert} onClose={() => setAssetPickerOpen(false)} />
                {!assistantMounted && (codexCompactAgent || localAgentEnabled) ? <CanvasLocalAgentPanel headless snapshot={agentSnapshot} canUndoOps={Boolean(agentUndoSnapshot)} onApplyOps={applyAgentOps} onUndoOps={undoAgentOps} onPrepareExternalRun={prepareAgentExternalRun} onActivateExternalRun={activateAgentExternalRun} onCancelExternalRun={cancelAgentExternalRun} onResolveExternalOutput={resolveAgentExternalOutput} autoConnect={codexAutoConnect} /> : null}
            </section>
            {assistantMounted ? (
                <CanvasAssistantPanel
                    nodes={nodes}
                    selectedNodeIds={selectedNodeIds}
                    snapshot={agentSnapshot}
                    sessions={chatSessions}
                    activeSessionId={activeChatId}
                    onSelectNodeIds={setSelectedNodeIds}
                    onSessionsChange={handleAssistantSessionsChange}
                    onApplyOps={applyAgentOps}
                    canUndoOps={Boolean(agentUndoSnapshot)}
                    onUndoOps={undoAgentOps}
                    onPrepareExternalRun={prepareAgentExternalRun}
                    onActivateExternalRun={activateAgentExternalRun}
                    onCancelExternalRun={cancelAgentExternalRun}
                    onResolveExternalOutput={resolveAgentExternalOutput}
                    onPasteImage={pasteAssistantImage}
                    autoConnectLocal={codexAutoConnect}
                    closing={assistantClosing}
                    onCollapse={closeAgent}
                />
            ) : null}
        </main>
    );
}

function CanvasTopBar({
    title,
    titleDraft,
    isTitleEditing,
    onTitleDraftChange,
    onStartTitleEditing,
    onFinishTitleEditing,
    onCancelTitleEditing,
    canUndo,
    canRedo,
    onHome,
    onProjects,
    onCreateProject,
    onDeleteProject,
    onImportImage,
    onUndo,
    onRedo,
    agentOpen,
    compactAgentStatus,
    onToggleAgent,
}: {
    title: string;
    titleDraft: string;
    isTitleEditing: boolean;
    onTitleDraftChange: (value: string) => void;
    onStartTitleEditing: () => void;
    onFinishTitleEditing: () => void;
    onCancelTitleEditing: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onHome: () => void;
    onProjects: () => void;
    onCreateProject: () => void;
    onDeleteProject: () => void;
    onImportImage: () => void;
    onUndo: () => void;
    onRedo: () => void;
    agentOpen: boolean;
    compactAgentStatus: { connected: boolean; enabled: boolean; activity: string };
    onToggleAgent: () => void;
}) {
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const titleRef = useRef<HTMLDivElement>(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    useEffect(() => {
        if (!isTitleEditing) return;
        const close = (event: PointerEvent) => {
            if (!titleRef.current?.contains(event.target as Node)) onFinishTitleEditing();
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [isTitleEditing, onFinishTitleEditing]);

    return (
        <>
            <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex h-16 items-center justify-between px-4">
                <div className="pointer-events-auto flex min-w-0 items-center gap-3">
                    <Dropdown
                        trigger={["click"]}
                        menu={{
                            items: [
                                { key: "home", icon: <Home className="size-4" />, label: "主页", onClick: onHome },
                                { key: "projects", icon: <Images className="size-4" />, label: "我的画布", onClick: onProjects },
                                { type: "divider" },
                                { key: "new", icon: <Plus className="size-4" />, label: "新建画布", onClick: onCreateProject },
                                { key: "delete", danger: true, icon: <Trash2 className="size-4" />, label: "删除当前画布", onClick: onDeleteProject },
                                { type: "divider" },
                                { key: "import", icon: <Upload className="size-4" />, label: "导入素材", onClick: onImportImage },
                                { type: "divider" },
                                { key: "undo", disabled: !canUndo, icon: <Undo2 className="size-4" />, label: <MenuLabel text="撤销" shortcut="⌘ Z" />, onClick: onUndo },
                                { key: "redo", disabled: !canRedo, icon: <Redo2 className="size-4" />, label: <MenuLabel text="重做" shortcut="⌘ ⇧ Z / ⌘ Y" />, onClick: onRedo },
                            ],
                        }}
                    >
                        <button type="button" className="grid size-9 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} aria-label="打开画布菜单">
                            <Menu className="size-5" />
                        </button>
                    </Dropdown>

                    <div ref={titleRef} className="flex min-w-0 items-center gap-2">
                        {isTitleEditing ? (
                            <input
                                autoFocus
                                value={titleDraft}
                                onChange={(event) => onTitleDraftChange(event.target.value)}
                                onBlur={onFinishTitleEditing}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") onFinishTitleEditing();
                                    if (event.key === "Escape") onCancelTitleEditing();
                                }}
                                className="max-w-[280px] bg-transparent p-0 text-left text-lg font-semibold tracking-normal outline-none"
                                style={{ color: theme.node.text }}
                            />
                        ) : (
                            <button
                                type="button"
                                className="max-w-[280px] truncate border-b border-dashed border-transparent text-left text-lg font-semibold tracking-normal transition hover:border-current"
                                onDoubleClick={onStartTitleEditing}
                                title="双击修改画布名称"
                            >
                                {title}
                            </button>
                        )}
                    </div>
                    <CompactAgentStatus status={compactAgentStatus} onClick={onToggleAgent} />
                </div>

                <div className="pointer-events-auto flex items-center gap-1.5">
                    <UserStatusActions variant="canvas" onOpenShortcuts={() => setShortcutsOpen(true)} />
                    <span className="h-6 w-px" style={{ background: theme.toolbar.border }} />
                    <Button
                        type="text"
                        className="!h-10 !rounded-xl !px-3 !font-medium"
                        style={{ background: agentOpen ? theme.toolbar.activeBg : theme.toolbar.panel, color: theme.node.text, boxShadow: "0 10px 30px rgba(28,25,23,.10)" }}
                        icon={<Bot className="size-4" />}
                        onClick={onToggleAgent}
                    >
                        Agent
                    </Button>
                </div>
            </div>
            <Modal title="快捷键" open={shortcutsOpen} onCancel={() => setShortcutsOpen(false)} footer={null} centered>
                <div className="space-y-2 border-t pt-4 text-sm" style={{ borderColor: theme.node.stroke }}>
                    <Shortcut keys={["拖动画布"]} value="平移视图" />
                    <Shortcut keys={["滚轮"]} value="缩放画布" />
                    <Shortcut keys={["缩放滑杆"]} value="精确调整缩放" />
                    <Shortcut keys={["Ctrl / Cmd", "拖动"]} value="框选多个节点" />
                    <Shortcut keys={["Shift / Ctrl / Cmd", "点击"]} value="追加选择节点" />
                    <Shortcut keys={["Ctrl / Cmd", "A"]} value="全选节点" />
                    <Shortcut keys={["Ctrl / Cmd", "C / V"]} value="复制 / 粘贴节点，或粘贴剪切板文本/图片" />
                    <Shortcut keys={["Ctrl / Cmd", "Z"]} value="撤销" />
                    <Shortcut keys={["Ctrl / Cmd", "Shift", "Z"]} value="重做" />
                    <Shortcut keys={["Ctrl / Cmd", "Y"]} value="重做" />
                    <Shortcut keys={["Delete / Backspace"]} value="删除选中" />
                    <Shortcut keys={["Esc"]} value="取消选择并关闭浮层" />
                    <Shortcut keys={["拖入图片/视频/音频"]} value="上传到画布" />
                </div>
            </Modal>
        </>
    );
}

function MenuLabel({ text, shortcut }: { text: string; shortcut: string }) {
    return (
        <span className="flex min-w-36 items-center justify-between gap-8">
            <span>{text}</span>
            <span className="text-xs opacity-45">{shortcut}</span>
        </span>
    );
}

function CompactAgentStatus({ status, onClick }: { status: { connected: boolean; enabled: boolean; activity: string }; onClick: () => void }) {
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const label = status.connected ? "Codex 已连接" : status.enabled ? `Codex ${status.activity || "连接中"}` : "Codex 未连接";
    const dotColor = status.connected ? "#22c55e" : status.enabled ? "#f59e0b" : theme.node.muted;
    return (
        <button type="button" className="flex h-8 items-center gap-1.5 text-xs transition hover:opacity-75" style={{ color: status.connected ? "#16a34a" : status.enabled ? "#d97706" : theme.node.muted }} onClick={onClick} title="打开本地 Codex 面板">
            <span className="size-2 rounded-full" style={{ background: dotColor }} />
            <span className="max-w-[140px] truncate">{label}</span>
        </button>
    );
}

function Shortcut({ keys, value }: { keys: string[]; value: string }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-6 rounded-lg px-1 py-1.5">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {keys.map((key, index) => (
                    <span key={`${key}-${index}`} className="flex items-center gap-1.5">
                        {index ? <span className="text-xs opacity-35">+</span> : null}
                        <kbd
                            className="min-w-9 rounded-md border px-2.5 py-1.5 text-center text-xs font-medium leading-none shadow-[inset_0_-1px_0_rgba(0,0,0,.08),0_1px_2px_rgba(0,0,0,.06)]"
                            style={{ borderColor: "rgba(120,113,108,.28)", background: "linear-gradient(#fff, rgba(245,245,244,.92))", color: "rgb(68,64,60)" }}
                        >
                            {key}
                        </kbd>
                    </span>
                ))}
            </span>
            <span className="text-right text-sm opacity-55">{value}</span>
        </div>
    );
}

function imageExtension(dataUrl: string) {
    return dataUrl.match(/^data:image[/]([^;]+)/)?.[1] || dataUrl.match(/image[/]([^;]+)/)?.[1] || "png";
}

function audioExtension(mimeType?: string) {
    if (mimeType?.includes("wav")) return "wav";
    if (mimeType?.includes("opus")) return "opus";
    if (mimeType?.includes("aac")) return "aac";
    if (mimeType?.includes("flac")) return "flac";
    if (mimeType?.includes("pcm")) return "pcm";
    return "mp3";
}

function imageMetadata(image: UploadedImage): CanvasNodeMetadata {
    return { content: image.url, storageKey: image.storageKey, status: "success", naturalWidth: image.width, naturalHeight: image.height, bytes: image.bytes, mimeType: image.mimeType };
}

function videoMetadata(video: UploadedFile): CanvasNodeMetadata {
    return { content: video.url, storageKey: video.storageKey, status: "success", naturalWidth: video.width, naturalHeight: video.height, bytes: video.bytes, mimeType: video.mimeType || "video/mp4", durationMs: video.durationMs };
}

function audioMetadata(audio: UploadedFile): CanvasNodeMetadata {
    return { content: audio.url, storageKey: audio.storageKey, status: "success", bytes: audio.bytes, mimeType: audio.mimeType || "audio/mpeg", durationMs: audio.durationMs };
}

function simplifyEcommerceStorySkeleton(nodes: CanvasNodeData[], connections: CanvasConnection[], workflow?: CanvasWorkflowState) {
    if (workflow?.kind !== "ecommerce-video") return { nodes, connections };
    const removedIds = new Set(
        nodes
            .filter(
                (node) =>
                    node.id === workflow.configNodeId ||
                    (node.id === workflow.outputNodeId && !node.metadata?.content) ||
                    (node.type === CanvasNodeType.Text && node.title.startsWith("AI ") && node.title.endsWith("创意要求") && node.metadata?.content === node.metadata?.prompt),
            )
            .map((node) => node.id),
    );
    if (!removedIds.size) return { nodes, connections };
    const remainingNodes = nodes.filter((node) => !removedIds.has(node.id));
    return {
        nodes: remainingNodes.length === 1 && remainingNodes[0].id === workflow.productNodeId ? [{ ...remainingNodes[0], position: { x: 600, y: 220 } }] : remainingNodes,
        connections: connections.filter((connection) => !removedIds.has(connection.fromNodeId) && !removedIds.has(connection.toNodeId)),
    };
}

function buildImageGenerationMetadata(type: CanvasImageGenerationType, config: AiConfig, count: number, references: ReferenceImage[]): CanvasNodeMetadata {
    return {
        generationType: type,
        model: config.model,
        size: config.size,
        quality: config.quality,
        count,
        references: references.map(referenceUrl).filter((url): url is string => Boolean(url)),
    };
}

function buildAudioGenerationMetadata(config: AiConfig): CanvasNodeMetadata {
    return {
        model: config.model,
        audioVoice: config.audioVoice,
        audioFormat: config.audioFormat,
        audioSpeed: config.audioSpeed,
        audioInstructions: config.audioInstructions,
    };
}

function referenceUrl(image: ReferenceImage) {
    return image.storageKey || image.url || (!image.dataUrl.startsWith("data:") ? image.dataUrl : undefined);
}

function generationReferenceUrls(context: { referenceImages: ReferenceImage[]; referenceVideos: Array<{ storageKey?: string; url?: string }>; referenceAudios?: Array<{ storageKey?: string; url?: string }> }) {
    return [
        ...context.referenceImages.map(referenceUrl).filter((url): url is string => Boolean(url)),
        ...context.referenceVideos.map((video) => video.storageKey || video.url).filter((url): url is string => Boolean(url)),
        ...(context.referenceAudios || []).map((audio) => audio.storageKey || audio.url).filter((url): url is string => Boolean(url)),
    ];
}

async function uploadCanvasVideoReferences(
    projectId: string,
    context: {
        referenceImages: ReferenceImage[];
        referenceVideos: Array<{ id: string; name?: string; type?: string; url: string; storageKey?: string }>;
        referenceAudios: ReferenceAudio[];
    },
) {
    const referenceImages = await Promise.all(
        context.referenceImages.map(async (reference, index) => {
            const source = await imageToDataUrl(reference);
            const blob = await canvasReferenceBlob(source, reference.type || "image/png", `参考图 ${index + 1}`);
            return (await uploadCanvasArtifact(projectId, blob, reference.name || `reference-${index + 1}.png`)).uri;
        }),
    );
    const referenceVideos = await Promise.all(
        context.referenceVideos.map(async (reference, index) => {
            const source = await mediaToDataUrl({ url: reference.url, storageKey: reference.storageKey, mimeType: reference.type || "video/mp4" });
            const blob = await canvasReferenceBlob(source, reference.type || "video/mp4", `参考视频 ${index + 1}`);
            return (await uploadCanvasArtifact(projectId, blob, reference.name || `reference-video-${index + 1}.mp4`)).uri;
        }),
    );
    const referenceAudios = await Promise.all(
        context.referenceAudios.map(async (reference, index) => {
            const source = await mediaToDataUrl({ url: reference.url, storageKey: reference.storageKey, mimeType: reference.type || "audio/mpeg" });
            const blob = await canvasReferenceBlob(source, reference.type || "audio/mpeg", `参考音频 ${index + 1}`);
            return (await uploadCanvasArtifact(projectId, blob, reference.name || `reference-audio-${index + 1}`)).uri;
        }),
    );
    return { referenceImages, referenceVideos, referenceAudios };
}

async function canvasReferenceBlob(source: string, mimeType: string, label: string) {
    let response: Response;
    try {
        response = await fetch(source);
    } catch {
        throw new Error(`${label}无法读取，不能提交后台任务`);
    }
    if (!response.ok) throw new Error(`${label}读取失败（${response.status}）`);
    const blob = await response.blob();
    return blob.type ? blob : new Blob([blob], { type: mimeType });
}

async function resolveMetadataReferences(metadata: CanvasNodeMetadata) {
    if (metadata.generationType !== "edit") return [];
    if (!metadata.references?.length) return null;
    const references = await Promise.all(
        metadata.references.map(async (url, index) => {
            const dataUrl = url.startsWith("image:") ? await resolveImageUrl(url, "") : url;
            return dataUrl ? { id: `${index}`, name: `reference-${index}.png`, type: "image/png", dataUrl, storageKey: url.startsWith("image:") ? url : undefined } : null;
        }),
    );
    return references.every(Boolean) ? (references as ReferenceImage[]) : null;
}

async function hydrateCanvasImages(nodes: CanvasNodeData[], canvasId: string) {
    return Promise.all(
        nodes.map(async (node) => {
            let restoredNode = node.metadata?.viralVideoShotFrames
                ? {
                      ...node,
                      metadata: {
                          ...node.metadata,
                          viralVideoShotFrames: await hydrateViralVideoShotFrames(node.metadata.viralVideoShotFrames, (storageKey) => resolveImageUrl(storageKey, "")),
                      },
                  }
                : node;
            if (restoredNode.metadata?.viralVideoReplacementLibrary) {
                restoredNode = {
                    ...restoredNode,
                    metadata: {
                        ...restoredNode.metadata,
                        viralVideoReplacementLibrary: {
                            ...restoredNode.metadata.viralVideoReplacementLibrary,
                            elements: await Promise.all(
                                restoredNode.metadata.viralVideoReplacementLibrary.elements.map(async (element) => ({
                                    ...element,
                                    assets: await Promise.all(
                                        element.assets.map(async (asset) => ({
                                            ...asset,
                                            content: asset.storageKey ? await resolveImageUrl(asset.storageKey, asset.content) : asset.content,
                                        })),
                                    ),
                                })),
                            ),
                        },
                    },
                };
            }
            const content = restoredNode.metadata?.content || "";
            if ((restoredNode.type === CanvasNodeType.Video || restoredNode.type === CanvasNodeType.Audio) && restoredNode.metadata?.storageKey)
                return { ...restoredNode, metadata: { ...restoredNode.metadata, content: await resolveMediaUrl(restoredNode.metadata.storageKey, content) } };
            if (restoredNode.type !== CanvasNodeType.Image || (!content && !restoredNode.metadata?.storageKey)) return restoredNode;
            if (restoredNode.metadata?.storageKey) {
                const restoredContent = await resolveCanvasImageContent(
                    { canvasId, storageKey: restoredNode.metadata.storageKey, content },
                    { resolveStoredImage: resolveImageUrl, resolveCanvasArtifact: resolveCanvasArtifactUrl },
                );
                return { ...restoredNode, metadata: { ...restoredNode.metadata, content: restoredContent } };
            }
            if (!content.startsWith("data:image/")) return restoredNode;
            return { ...restoredNode, metadata: { ...restoredNode.metadata, ...imageMetadata(await uploadImage(content)) } };
        }),
    );
}

async function hydrateAssistantImages(sessions: CanvasAssistantSession[]) {
    const hydrateItem = async <T extends { dataUrl?: string; storageKey?: string }>(item: T) => {
        if (item.storageKey) return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        if (item.dataUrl?.startsWith("data:image/")) {
            const image = await uploadImage(item.dataUrl);
            return { ...item, dataUrl: image.url, storageKey: image.storageKey };
        }
        return item;
    };
    return Promise.all(
        sessions.map(async (session) => ({
            ...session,
            messages: await Promise.all(
                session.messages.map(async (message) => ({
                    ...message,
                    references: await Promise.all((message.references || []).map(hydrateItem)),
                })),
            ),
        })),
    );
}

function getGenerationCount(count: string) {
    return Math.max(1, Math.min(15, Math.floor(Math.abs(Number(count)) || 1)));
}

function applyNodeConfigPatch(node: CanvasNodeData, patch: Partial<CanvasNodeData["metadata"]>) {
    const safePatch = patch || {};
    const next = { ...node, metadata: { ...node.metadata, ...safePatch } };
    const spec = node.type === CanvasNodeType.Video ? NODE_DEFAULT_SIZE[CanvasNodeType.Video] : NODE_DEFAULT_SIZE[CanvasNodeType.Image];
    const size = typeof safePatch.size === "string" && !node.metadata?.content ? nodeSizeFromRatio(safePatch.size, spec.width, spec.height) : null;
    return size && (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) ? { ...next, ...size, position: { x: node.position.x + node.width / 2 - size.width / 2, y: node.position.y + node.height / 2 - size.height / 2 } } : next;
}

function findGroupDropTarget(movedIds: Set<string>, nodes: CanvasNodeData[]) {
    if (nodes.some((node) => movedIds.has(node.id) && node.type === CanvasNodeType.Group)) return null;
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!movingNodes.length) return null;
    return (
        [...nodes].reverse().find((group) => {
            if (group.type !== CanvasNodeType.Group || movedIds.has(group.id)) return false;
            return movingNodes.some((node) => {
                const centerX = node.position.x + node.width / 2;
                const centerY = node.position.y + node.height / 2;
                return centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height;
            });
        }) || null
    );
}

function snapNodesIntoGroup(movedIds: Set<string>, nodes: CanvasNodeData[], group: CanvasNodeData) {
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!movingNodes.length) return nodes;
    const pad = 24;
    const bounds = nodeBounds(movingNodes);
    const left = group.position.x + pad;
    const top = group.position.y + pad;
    const right = group.position.x + group.width - pad;
    const bottom = group.position.y + group.height - pad;
    const dx = bounds.right - bounds.left > right - left ? left - bounds.left : bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.bottom - bounds.top > bottom - top ? top - bounds.top : bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;
    return nodes.map((node) => {
        if (!movedIds.has(node.id) || node.type === CanvasNodeType.Group) return node;
        return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy }, metadata: { ...node.metadata, groupId: group.id } };
    });
}

function nodeBounds(nodes: CanvasNodeData[]) {
    return nodes.reduce(
        (acc, node) => ({
            left: Math.min(acc.left, node.position.x),
            top: Math.min(acc.top, node.position.y),
            right: Math.max(acc.right, node.position.x + node.width),
            bottom: Math.max(acc.bottom, node.position.y + node.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}

function findContainingGroupId(node: CanvasNodeData, nodes: CanvasNodeData[]) {
    const centerX = node.position.x + node.width / 2;
    const centerY = node.position.y + node.height / 2;
    return (
        [...nodes]
            .reverse()
            .find((group) => group.type === CanvasNodeType.Group && group.id !== node.id && centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height)?.id ||
        undefined
    );
}

function getConnectionTargetAnchor(node: CanvasNodeData, current: ConnectionHandle) {
    return {
        x: current.handleType === "source" ? node.position.x : node.position.x + node.width,
        y: node.position.y + node.height / 2,
    };
}

function normalizeConnection(firstNodeId: string, secondNodeId: string, nodes: CanvasNodeData[], firstHandleType: "source" | "target") {
    const first = nodes.find((node) => node.id === firstNodeId);
    const second = nodes.find((node) => node.id === secondNodeId);
    if (!first || !second || first.id === second.id) return null;
    if (first.type === CanvasNodeType.Group || second.type === CanvasNodeType.Group) return null;
    if (first.type === CanvasNodeType.Config && second.type === CanvasNodeType.Config) return null;
    if (second.type === CanvasNodeType.Config) return { fromNodeId: first.id, toNodeId: second.id };
    if (first.type === CanvasNodeType.Config && firstHandleType === "target") return { fromNodeId: second.id, toNodeId: first.id };
    if (first.type === CanvasNodeType.Config) return { fromNodeId: first.id, toNodeId: second.id };
    return { fromNodeId: first.id, toNodeId: second.id };
}

function getInputSummary(inputs: NodeGenerationInput[]) {
    return {
        textCount: inputs.filter((input) => input.type === "text").length,
        imageCount: inputs.filter((input) => input.type === "image").length,
        videoCount: inputs.filter((input) => input.type === "video").length,
        audioCount: inputs.filter((input) => input.type === "audio").length,
    };
}

function readVideoDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const timer = window.setTimeout(() => finish(new Error("读取参考视频时长超时")), 15_000);
        const finish = (error?: Error) => {
            window.clearTimeout(timer);
            video.onloadedmetadata = null;
            video.onerror = null;
            const duration = video.duration;
            video.removeAttribute("src");
            try { video.load(); } catch { /* cleanup only */ }
            if (error) reject(error);
            else if (Number.isFinite(duration) && duration > 0) resolve(duration);
            else reject(new Error("参考视频时长无效"));
        };
        video.preload = "metadata";
        video.crossOrigin = "anonymous";
        video.onloadedmetadata = () => finish();
        video.onerror = () => finish(new Error("无法读取参考视频"));
        video.src = url;
    });
}

function parseUniversalReplacementRecognition(value: string, count: number): Array<{ kind: UniversalReplacementEntity["kind"]; identityFacts: string }> {
    try {
        const parsed = JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
        if (!Array.isArray(parsed)) return [];
        const kinds = new Set(["product", "person", "scene", "vehicle", "wardrobe", "animal", "prop", "other"]);
        return parsed.slice(0, count).map((item) => ({
            kind: kinds.has(String(item?.kind)) ? item.kind as UniversalReplacementEntity["kind"] : "other",
            identityFacts: typeof item?.identityFacts === "string" && item.identityFacts.trim() ? item.identityFacts.trim() : "未命名替换对象",
        }));
    } catch { return []; }
}

function buildDefaultViralVariableSlots(template: ViralRemakeTemplate) {
    const fixed = new Set(template.bindings.filter((binding) => binding.status === "bound").map((binding) => binding.sourceObjectId));
    const labels: Partial<Record<ViralRemakeTemplate["objects"][number]["kind"], string>> = { person: "原创人物", scene: "原创场景", wardrobe: "原创造型", vehicle: "车辆细节", prop: "道具细节" };
    const seen = new Set<string>();
    return template.objects.flatMap((object) => {
        const label = labels[object.kind];
        if (!label || fixed.has(object.id) || seen.has(object.kind)) return [];
        seen.add(object.kind);
        return [{ id: object.kind, label, values: [`${label}方案 A`, `${label}方案 B`, `${label}方案 C`] }];
    });
}

function buildGenerationConfig(config: AiConfig, node: CanvasNodeData | undefined, mode: CanvasNodeGenerationMode): AiConfig {
    const defaultModel = mode === "image" ? config.imageModel : mode === "video" ? config.videoModel : mode === "audio" ? config.audioModel : config.textModel;
    const normalizedModel = normalizeRequestedModelOption(config, node?.metadata?.model, defaultModel);
    const capabilityKey = mode === "image" ? "imageModel" : mode === "video" ? "videoModel" : mode === "audio" ? "audioModel" : "textModel";
    return {
        ...config,
        model: normalizedModel,
        [capabilityKey]: normalizedModel,
        quality: node?.metadata?.quality || config.quality || defaultConfig.quality,
        size: node?.metadata?.size || config.size || defaultConfig.size,
        videoSeconds: node?.metadata?.seconds || config.videoSeconds || defaultConfig.videoSeconds,
        vquality: node?.metadata?.vquality || config.vquality || defaultConfig.vquality,
        videoGenerateAudio: node?.metadata?.generateAudio || config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: node?.metadata?.watermark || config.videoWatermark || defaultConfig.videoWatermark,
        videoInputMode: node?.metadata?.videoInputMode || config.videoInputMode || defaultConfig.videoInputMode,
        audioVoice: node?.metadata?.audioVoice || config.audioVoice || defaultConfig.audioVoice,
        audioFormat: node?.metadata?.audioFormat || config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node?.metadata?.audioSpeed || config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node?.metadata?.audioInstructions || config.audioInstructions || defaultConfig.audioInstructions,
        count: String(node?.metadata?.count || (mode === "image" ? config.canvasImageCount || config.count : config.count) || defaultConfig.count),
    };
}

function supportsNativeViralVideoInput(config: Pick<AiConfig, "apiFormat" | "model">) {
    return config.apiFormat === "gemini" || gatewayModelCatalogEntry(config.model)?.options.nativeVideoInput === true;
}

function selectNativeViralVideoAnalysisModel(config: Pick<AiConfig, "textModels" | "textModel">) {
    return config.textModels.find((model) => gatewayModelCatalogEntry(model)?.options.nativeVideoInput === true) || config.textModel;
}

type ActiveViralVideoPlan = {
    planId: string;
    variantIndex: number;
    masterNode: CanvasNodeData;
    masterPrompt: string;
    plan: ViralVideoPromptPlan;
    segments: Array<{
        segmentIndex: number;
        title: string;
        durationSeconds: number;
        shotIndexes: number[];
        shotPrompts: Array<{ index: number; prompt: string }>;
        prompt: string;
    }>;
};

function collectActiveViralVideoPlans(workflow: Extract<CanvasWorkflowState, { kind: "viral-video-remake" }>, nodes: CanvasNodeData[]): { plans: ActiveViralVideoPlan[]; error?: string } {
    const promptNodeIds = workflow.promptNodeIds || [];
    if (!promptNodeIds.length) return { plans: [], error: "当前没有可用的复刻方案，请重新生成方案" };
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const activeNodes = promptNodeIds.map((nodeId) => nodeById.get(nodeId));
    if (activeNodes.some((node) => !node)) return { plans: [], error: "当前复刻方案节点不完整，请重新生成方案" };

    const plans: ActiveViralVideoPlan[] = [];
    const planIds = new Set<string>();
    const variantIndexes = new Set<number>();
    const analysis = workflow.analysisNodeId ? nodeById.get(workflow.analysisNodeId)?.metadata?.viralVideoAnalysis : undefined;
    const analysisShotIndexes = analysis?.shots.map((shot) => shot.index) || [];
    for (const node of activeNodes as CanvasNodeData[]) {
        const planId = node.metadata?.viralVideoPlanId;
        const variantIndex = 0;
        const plan = node.metadata?.viralVideoPromptPlan;
        const masterPrompt = node.metadata?.prompt?.trim() || plan?.masterPrompt?.trim() || "";
        if (!planId || node.metadata?.viralVideoPromptRole !== "template" || !node.metadata.viralVideoRemakeTemplate || !plan) return { plans: [], error: "当前缺少完整复刻母版，请重新生成母版" };
        if (planIds.has(planId) || !Number.isInteger(variantIndex) || variantIndex < 0 || variantIndexes.has(variantIndex)) return { plans: [], error: "当前复刻方案编号无效，请重新生成方案" };
        if (!Array.isArray(plan.segments) || !plan.segments.length || !Array.isArray(plan.shotPrompts) || !plan.shotPrompts.length || !masterPrompt) {
            return { plans: [], error: `复刻方案 ${variantIndex + 1} 结构不完整，请重新生成方案` };
        }
        planIds.add(planId);
        variantIndexes.add(variantIndex);
        const expectedShotIndexes = plan.shotPrompts.map((shotPrompt) => shotPrompt.index);
        if (
            !expectedShotIndexes.length ||
            new Set(expectedShotIndexes).size !== expectedShotIndexes.length ||
            analysisShotIndexes.length !== expectedShotIndexes.length ||
            new Set(analysisShotIndexes).size !== analysisShotIndexes.length ||
            analysisShotIndexes.some((shotIndex) => !expectedShotIndexes.includes(shotIndex))
        )
            return { plans: [], error: `复刻方案 ${variantIndex + 1} 的动作节拍与拉片结果不一致，请重新生成方案` };
        const shotByIndex = new Map(plan.shotPrompts.map((shotPrompt) => [shotPrompt.index, shotPrompt.prompt.trim()]));
        if ([...shotByIndex.values()].some((prompt) => !prompt)) return { plans: [], error: `复刻方案 ${variantIndex + 1} 存在空的动作节拍提示词，请补全后重试` };
        const segments: ActiveViralVideoPlan["segments"] = [];
        for (const [segmentIndex, segment] of plan.segments.entries()) {
            const durationSeconds = Number(segment?.durationSeconds);
            const prompt = segment?.prompt?.trim() || "";
            if (!prompt || !segment?.title?.trim() || !Array.isArray(segment.shotIndexes) || !segment.shotIndexes.length || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
                return { plans: [], error: `复刻方案 ${variantIndex + 1} 的生成分段 ${segmentIndex + 1} 结构无效，请重新生成方案` };
            }
            const shotPrompts = segment.shotIndexes.map((shotIndex) => {
                const shotPrompt = shotByIndex.get(shotIndex);
                return shotPrompt ? { index: shotIndex, prompt: shotPrompt } : null;
            });
            if (shotPrompts.some((shotPrompt) => !shotPrompt)) return { plans: [], error: `复刻方案 ${variantIndex + 1} 的生成分段 ${segmentIndex + 1} 引用了不存在的动作节拍` };
            segments.push({ segmentIndex, title: segment.title.trim(), durationSeconds, shotIndexes: segment.shotIndexes, shotPrompts: shotPrompts as Array<{ index: number; prompt: string }>, prompt });
        }
        plans.push({ planId, variantIndex, masterNode: node, masterPrompt, plan: { ...plan, masterPrompt }, segments });
    }
    plans.sort((left, right) => left.variantIndex - right.variantIndex);
    return { plans };
}

function buildViralVideoPromptSnapshot(workflow: Extract<CanvasWorkflowState, { kind: "viral-video-remake" }>, nodes: CanvasNodeData[]) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return JSON.stringify(
        (workflow.promptNodeIds || []).map((nodeId) => {
            const node = nodeById.get(nodeId);
            return {
                id: nodeId,
                role: node?.metadata?.viralVideoPromptRole,
                planId: node?.metadata?.viralVideoPlanId,
                variantIndex: node?.metadata?.viralVideoVariantIndex,
                shotIndex: node?.metadata?.viralVideoShotIndex,
                segmentIndex: node?.metadata?.viralVideoSegmentIndex,
                prompt: node?.metadata?.prompt,
                plan: node?.metadata?.viralVideoPromptRole === "template" ? node.metadata.viralVideoPromptPlan : undefined,
            };
        }),
    );
}

function chooseViralVideoSeconds(config: AiConfig, durationSeconds: number) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return "";
    const hardLimit = getViralVideoMaxSegmentSeconds(config);
    if (durationSeconds > hardLimit + 0.000001) return "";
    if (isOmniVideoModel(modelOptionName(config.videoModel || config.model))) return "10";
    const minimum = isSeedanceVideoConfig(config) ? 4 : 1;
    const seconds = Math.max(minimum, Math.ceil(durationSeconds - 0.000001));
    return seconds <= hardLimit ? String(seconds) : "";
}

function getViralVideoMaxSegmentSeconds(config: AiConfig) {
    const modelName = modelOptionName(config.videoModel || config.model);
    return isOmniVideoModel(modelName) ? 10 : viralVideoModelMaxDurationSeconds(modelName);
}

function normalizeInterruptedViralWorkflow(workflow: CanvasWorkflowState | undefined, nodes: CanvasNodeData[]) {
    if (!workflow || workflow.kind !== "viral-video-remake" || !["recognizing", "templating", "compiling", "running"].includes(workflow.phase)) return workflow;
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const analysisNode = workflow.analysisNodeId ? nodeById.get(workflow.analysisNodeId) : undefined;
    const hasAnalysis = Boolean(analysisNode?.metadata?.viralVideoAnalysis);
    const promptNodeIds = workflow.promptNodeIds || [];
    const activePromptIds = new Set(promptNodeIds);
    const schemeNode = workflow.masterPromptNodeId ? nodeById.get(workflow.masterPromptNodeId) : nodes.find((node) => activePromptIds.has(node.id) && node.metadata?.viralVideoPromptRole === "template");
    const hasActivePlan =
        promptNodeIds.length > 0 &&
        promptNodeIds.every((nodeId) => nodeById.has(nodeId)) &&
        Boolean(schemeNode && activePromptIds.has(schemeNode.id) && schemeNode.metadata?.viralVideoPromptRole === "template" && schemeNode.metadata?.prompt?.trim());
    const durableOutputIds = workflow.outputNodeIds || [];
    const hasDurableOutputs = durableOutputIds.length > 0 && durableOutputIds.every((nodeId) => Boolean(nodeById.get(nodeId)?.metadata?.generationJobId));
    const phase: typeof workflow.phase = workflow.phase === "running" && hasDurableOutputs ? "running" : hasActivePlan ? "template_ready" : hasAnalysis ? "requirements_ready" : "idle";
    return { ...workflow, phase };
}

function isGenerationCanceled(error: unknown) {
    return error instanceof Error && (error.message === "请求已取消" || error.name === "AbortError");
}

function applyViralWorkflowEvents(
    workflow: Extract<CanvasWorkflowState, { kind: "viral-video-remake" }>,
    events: ViralWorkflowEvent[],
) {
    let machine = workflow.machine || { ...createViralWorkflowMachine(), phase: workflow.phase };
    for (const event of events) {
        try { machine = transitionViralWorkflow(machine, event); }
        catch { machine = { ...machine, phase: workflow.phase }; }
    }
    return { ...workflow, phase: machine.phase, machine };
}

function viralBatchStatusEvent(status: string, partial: boolean): ViralWorkflowEvent | null {
    if (status === "paused") return { type: "PAUSED" };
    if (status === "completed") return { type: "COMPLETED" };
    if (status === "failed" || status === "cancelled") return { type: "FAILED" };
    if (partial) return { type: "PARTIAL" };
    return null;
}

function confirmViralBatchCost(totalCents: number) {
    return new Promise<boolean>((resolve) => {
        Modal.confirm({
            title: "确认爆款复刻批次费用",
            content: `本批次最高预计费用 ¥${(totalCents / 100).toFixed(2)}。确认后只提交当前确定数量，不会自动扩产。`,
            okText: "确认并提交",
            cancelText: "取消",
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
        });
    });
}

function findRetrySourceNode(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const queue = connections.filter((connection) => connection.toNodeId === nodeId).map((connection) => connection.fromNodeId);
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((item) => item.id === id);
        if (node?.type === CanvasNodeType.Config) return node;
        connections.filter((connection) => connection.toNodeId === id).forEach((connection) => queue.push(connection.fromNodeId));
    }
    return null;
}

function sourceNodeReferenceImages(node: CanvasNodeData | null) {
    if (!node || node.type !== CanvasNodeType.Image || !node.metadata?.content) return [];
    return [
        {
            id: node.id,
            name: `${node.title || node.id}.png`,
            type: node.metadata.mimeType || "image/png",
            dataUrl: node.metadata.content,
            storageKey: node.metadata.storageKey,
        },
    ];
}

function isAudioFile(file: File) {
    return file.type.startsWith("audio/") || /\.(mp3|wav)$/i.test(file.name);
}

function isHiddenBatchChild(node: CanvasNodeData, nodes: CanvasNodeData[], collapsingBatchIds?: Set<string>) {
    const rootId = node.metadata?.batchRootId;
    if (!rootId) return false;
    const root = nodes.find((item) => item.id === rootId);
    if (root && collapsingBatchIds?.has(rootId)) return false;
    return Boolean(root && !root.metadata?.imageBatchExpanded);
}

function isHiddenBatchConnectionEndpoint(node: CanvasNodeData, nodes: CanvasNodeData[]) {
    const rootId = node.metadata?.batchRootId;
    if (!rootId) return false;
    const root = nodes.find((item) => item.id === rootId);
    return Boolean(root && !root.metadata?.imageBatchExpanded);
}

function buildAngleLabel(params: CanvasImageAngleParams) {
    const horizontal = params.horizontalAngle === 0 ? "正面视角" : params.horizontalAngle > 0 ? `向右旋转 ${params.horizontalAngle} 度` : `向左旋转 ${Math.abs(params.horizontalAngle)} 度`;
    const pitch = params.pitchAngle === 0 ? "水平视角" : params.pitchAngle > 0 ? `俯视 ${params.pitchAngle} 度` : `仰视 ${Math.abs(params.pitchAngle)} 度`;
    return `AI 多角度：${horizontal}，${pitch}，镜头距离 ${params.cameraDistance.toFixed(1)}，${params.wideAngle ? "广角" : "标准"}镜头`;
}

function buildAnglePrompt(params: CanvasImageAngleParams) {
    return `基于参考图重新生成同一主体的新视角，保持主体、颜色、材质和画面风格一致，不要只做透视变形。${buildAngleLabel(params)}。`;
}
