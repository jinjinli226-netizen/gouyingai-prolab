import { ArrowDown, ArrowRight, ArrowUpDown, Blocks, FileImage, Film, Headphones, MessageCircle, Play, Replace } from "lucide-react";
import { memo, useMemo, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type UIEvent, type WheelEvent } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { type ViralVideoAnalysis, type ViralVideoShot } from "@/lib/canvas/viral-video-remake-workflow";
import { type ViralVideoShotFrame } from "@/types/canvas";

type ViralVideoAnalysisNodeContentProps = {
    analysis: ViralVideoAnalysis;
    shotFrames: ViralVideoShotFrame[];
    onNext: () => void;
    disabled?: boolean;
};

type ViralVideoShotAnalysisRow = {
    shotIndex: number;
    parentShotIndex: number;
    frame: ViralVideoShotFrame | undefined;
    frameDescription: string;
    boundarySummary: string;
    narrativeScene: string;
    narrativeCharacters: string;
    narrativeDialogue: string;
    narrativePurpose: string;
    shotLanguage: string;
    visualEffect: string;
    sound: string;
    startLabel: string;
    endLabel: string;
    durationLabel: string;
};

const DEFAULT_PLACEHOLDER = "未识别";

function readValue(value: string | undefined | null): string {
    const text = typeof value === "string" ? value.trim() : "";
    return text || DEFAULT_PLACEHOLDER;
}

function formatSeconds(value: number | undefined): string {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_PLACEHOLDER;
    if (value < 0) return DEFAULT_PLACEHOLDER;
    return `${value.toFixed(2)}s`;
}

function frameFallbackText(shot: ViralVideoShot): string {
    const parts = [shot.scene, shot.characters, shot.action, shot.dialogue, shot.visibleText, shot.narrativePurpose]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean);
    return parts.join(" ｜ ") || DEFAULT_PLACEHOLDER;
}

function buildFrameDescription(shot: ViralVideoShot): string {
    const description = typeof shot.frameDescription === "string" ? shot.frameDescription.trim() : "";
    return description || frameFallbackText(shot);
}

function buildAnalysisSectionTitle(analysis: ViralVideoAnalysis) {
    return analysis.title || "未命名分析";
}

function buildAnalysisSummaryLine(analysis: ViralVideoAnalysis): string {
    return `时长：${formatSeconds(analysis.durationSeconds)}｜画幅：${readValue(analysis.aspectRatio)}｜钩子：${readValue(analysis.hook)}｜叙事结构：${readValue(analysis.narrativeStructure)}｜节奏：${readValue(analysis.editRhythm)}`;
}

function buildShotRows(analysis: ViralVideoAnalysis, shotFrames: ViralVideoShotFrame[]): ViralVideoShotAnalysisRow[] {
    const byIndex = new Map<number, ViralVideoShotFrame>();
    for (const shotFrame of shotFrames) {
        if (Number.isInteger(shotFrame.shotIndex)) byIndex.set(shotFrame.shotIndex, shotFrame);
    }

    return [...analysis.shots]
        .sort((left, right) => left.index - right.index)
        .map((shot, rowIndex) => {
            const frame = byIndex.get(shot.index);
            return {
                shotIndex: shot.index,
                parentShotIndex: shot.parentShotIndex,
                frame,
                frameDescription: buildFrameDescription(shot),
                boundarySummary: rowIndex === 0 || shot.boundaryType === "first" ? "视频起始" : readValue(shot.boundaryReason),
                narrativeScene: `场景：${readValue(shot.scene)}\n人物：${readValue(shot.characters)}\n对白：${readValue(shot.dialogue)}`,
                narrativeCharacters: `叙事：${readValue(shot.narrativePurpose)}`,
                narrativeDialogue: `可见字幕：${readValue(shot.visibleText)}`,
                narrativePurpose: `叙事目的：${readValue(shot.narrativePurpose)}`,
                shotLanguage: `景别：${readValue(shot.shotSize)}\n构图：${readValue(shot.composition)}\n机位：${readValue(shot.cameraAngle)}\n镜头与焦点：${readValue(shot.lensAndFocus)}\n运镜：${readValue(shot.cameraMovement)}`,
                visualEffect: `光影与色彩：${readValue(shot.lightingAndColor)}\n转场：${readValue(shot.transition)}`,
                sound: `音乐音效：${readValue(shot.musicAndSound)}\n对白：${readValue(shot.visibleText)}\n叙事功能：${readValue(shot.narrativePurpose)}`,
                startLabel: formatSeconds(shot.startSeconds),
                endLabel: formatSeconds(shot.endSeconds),
                durationLabel: formatSeconds(shot.durationSeconds),
            };
        });
}

export function buildViralVideoAnalysisShotRows(analysis: ViralVideoAnalysis, shotFrames: ViralVideoShotFrame[] = []): ViralVideoShotAnalysisRow[] {
    return buildShotRows(analysis, shotFrames);
}

export const ViralVideoAnalysisNodeContent = memo(function ViralVideoAnalysisNodeContent({ analysis, shotFrames, onNext, disabled = false }: ViralVideoAnalysisNodeContentProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const rows = useMemo(() => buildViralVideoAnalysisShotRows(analysis, shotFrames), [analysis, shotFrames]);

    const preventCanvasEvent = (event: MouseEvent | KeyboardEvent | WheelEvent | PointerEvent | UIEvent<HTMLElement>) => {
        event.stopPropagation();
    };

    return (
        <div
            className="flex h-full min-h-0 min-w-[760px] flex-col overflow-hidden rounded-[inherit]"
            onWheel={preventCanvasEvent}
            onKeyDown={preventCanvasEvent}
        >
            <header className="shrink-0 cursor-grab border-b px-4 py-3 active:cursor-grabbing" style={{ borderColor: theme.node.stroke }}>
                <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: theme.node.text }}>
                        {buildAnalysisSectionTitle(analysis)}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: theme.node.placeholder }}>
                        {buildAnalysisSummaryLine(analysis)}
                    </div>
                </div>
            </header>

            <section className="min-h-0 flex-1 overflow-hidden">
                <div className="thin-scrollbar h-full min-h-0 flex-1 overflow-x-auto overflow-y-auto" onMouseDown={preventCanvasEvent} onPointerDown={preventCanvasEvent} onScroll={preventCanvasEvent}>
                    <div className="min-w-[1180px]">
                        <div className="grid gap-2 p-3 text-xs" style={{ color: theme.node.text }}>
                            <div className="rounded-xl border px-3 py-2 text-[11px]" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>节拍边界只表示可观察的动作或叙事状态变化；同一真实镜头内可以包含多个连续节拍。</div>
                            <div className="grid min-w-[1150px] grid-cols-[1.2fr_1.2fr_0.7fr_1.2fr_1fr_1.2fr] gap-2 rounded-xl p-2 text-[11px] font-semibold" style={{ background: theme.node.fill }}>
                                <span className="inline-flex items-center gap-1">
                                    <FileImage className="size-3" />
                                    代表帧与动作节拍
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Blocks className="size-3" />
                                    叙事要素
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Play className="size-3" />
                                    时间
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <ArrowRight className="size-3" />
                                    镜头语言
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <ArrowUpDown className="size-3" />
                                    影像处理
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <Headphones className="size-3" />
                                    声音
                                </span>
                            </div>

                            {rows.map((row) => (
                                <div key={`shot-${row.shotIndex}`} className="grid min-w-[1150px] grid-cols-[1.2fr_1.2fr_0.7fr_1.2fr_1fr_1.2fr] gap-2 rounded-xl p-2" style={{ background: theme.node.panel }}>
                                    <div className="rounded-lg border px-3 py-2" style={{ borderColor: theme.node.stroke }}>
                                        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]" style={{ color: theme.node.muted }}>
                                            <span className="font-semibold" style={{ color: theme.node.text }}>
                                                动作节拍 {row.shotIndex}
                                            </span>
                                            <span>
                                                真实镜头 {row.parentShotIndex} · {row.startLabel}–{row.endLabel}
                                            </span>
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="relative grid h-32 place-items-center overflow-hidden rounded border" style={{ borderColor: theme.node.stroke, background: `${theme.node.panel}` }}>
                                                <RepresentativeFrame content={row.frame?.content} shotIndex={row.shotIndex} />
                                            </div>
                                            <div className="line-clamp-3 text-[11px] leading-5" style={{ color: theme.node.text }} title={row.frameDescription}>
                                                {row.frameDescription}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border px-3 py-2 text-[11px] leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                                        <div className="mb-1 flex items-center gap-1 text-[11px] opacity-75">
                                            <Blocks className="size-3" />
                                            叙事
                                        </div>
                                        <div className="whitespace-pre-wrap">{row.narrativeScene}</div>
                                        <div className="mt-2 whitespace-pre-wrap">{row.narrativeCharacters}</div>
                                        <div className="mt-2 whitespace-pre-wrap">{row.narrativeDialogue}</div>
                                        <div className="mt-2 whitespace-pre-wrap">{row.narrativePurpose}</div>
                                    </div>
                                    <div className="rounded-lg border px-3 py-2 text-[11px] leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                                        <div className="mb-1 flex items-center gap-1 opacity-75">
                                            <ArrowDown className="size-3" />
                                            时间信息
                                        </div>
                                        <div className="whitespace-pre-wrap">开始：{row.startLabel}</div>
                                        <div className="whitespace-pre-wrap">结束：{row.endLabel}</div>
                                        <div className="whitespace-pre-wrap">时长：{row.durationLabel}</div>
                                    </div>
                                    <div className="rounded-lg border px-3 py-2 text-[11px] leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                                        <div className="mb-1 flex items-center gap-1 opacity-75">
                                            <MessageCircle className="size-3" />
                                            镜头语言
                                        </div>
                                        <div className="whitespace-pre-wrap">{row.shotLanguage}</div>
                                    </div>
                                    <div className="rounded-lg border px-3 py-2 text-[11px] leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                                        <div className="mb-1 flex items-center gap-1 opacity-75">
                                            <Replace className="size-3" />
                                            影像处理
                                        </div>
                                        <div className="whitespace-pre-wrap">{row.visualEffect}</div>
                                    </div>
                                    <div className="rounded-lg border px-3 py-2 text-[11px] leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                                        <div className="mb-1 flex items-center gap-1 opacity-75">
                                            <Film className="size-3" />
                                            声音
                                        </div>
                                        <div className="whitespace-pre-wrap">{row.sound}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <footer className="shrink-0 border-t px-4 py-3" style={{ borderColor: theme.node.stroke }}>
                <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-55"
                    style={{ background: `${theme.toolbar.panel}dd`, borderColor: theme.node.stroke, color: theme.node.text }}
                    onClick={() => void onNext()}
                    onMouseDown={preventCanvasEvent}
                    onPointerDown={preventCanvasEvent}
                    onWheel={preventCanvasEvent}
                    disabled={disabled}
                >
                    <ArrowDown className="size-3" />
                    下一步：替换元素
                </button>
            </footer>
        </div>
    );
});

function RepresentativeFrame({ content, shotIndex }: { content?: string; shotIndex: number }) {
    const [failed, setFailed] = useState(false);
    if (!content) return <span className="text-xs opacity-70">未提取代表帧</span>;
    if (failed) return <span className="text-xs opacity-70">代表帧加载失败</span>;
    return <img src={content} alt={`镜头 ${shotIndex} 代表帧`} className="h-full w-full rounded object-contain" data-canvas-no-zoom onError={() => setFailed(true)} />;
}
