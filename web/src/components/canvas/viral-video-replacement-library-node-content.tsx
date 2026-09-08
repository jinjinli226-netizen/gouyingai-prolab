import { memo } from "react";
import { CheckCircle2, ChevronDown, ImagePlus, Layers3, Plus, Sparkles, Trash2, X } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ViralVideoReplacementLibrary, ViralVideoShotFrame } from "@/types/canvas";
import type { ViralVideoAnalysis } from "@/lib/canvas/viral-video-remake-workflow";
import { ViralVideoRequirementsNodeContent } from "./viral-video-requirements-node-content";

type ViralVideoReplacementLibraryNodeContentProps = {
    library: ViralVideoReplacementLibrary;
    shotFrames?: ViralVideoShotFrame[];
    disabled?: boolean;
    onAddAssets: (elementId: string) => void;
    onConfirmElement: (elementId: string) => void;
    onAddElement: () => void;
    onRemoveElement: (elementId: string) => void;
    onRemoveAsset: (elementId: string, assetId: string) => void;
    onRenameElement: (elementId: string, name: string) => void;
    onToggleCollapsed: () => void;
    analysis?: ViralVideoAnalysis;
    replacementBrief: string;
    onReplacementBriefChange: (value: string) => void;
};

function stopCanvasEvent(event: React.SyntheticEvent) {
    event.stopPropagation();
}

export const ViralVideoReplacementLibraryNodeContent = memo(function ViralVideoReplacementLibraryNodeContent({
    library,
    shotFrames = [],
    disabled = false,
    onAddAssets,
    onConfirmElement,
    onAddElement,
    onRemoveElement,
    onRemoveAsset,
    onRenameElement,
    onToggleCollapsed,
    analysis,
    replacementBrief,
    onReplacementBriefChange,
}: ViralVideoReplacementLibraryNodeContentProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const assetCount = library.elements.reduce((total, element) => total + element.assets.length, 0);
    const frameByShot = new Map(shotFrames.map((frame) => [frame.shotIndex, frame]));

    return (
        <div className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-[inherit]" style={{ background: theme.node.panel, color: theme.node.text }}>
            <ViralVideoRequirementsNodeContent analysis={analysis} brief={replacementBrief} onBriefChange={onReplacementBriefChange} disabled={disabled} />
            <header className="flex h-[78px] shrink-0 cursor-grab items-center gap-4 border-b px-6 active:cursor-grabbing" style={{ borderColor: theme.node.stroke }}>
                <span className="grid size-10 place-items-center rounded-2xl" style={{ background: theme.toolbar.activeBg, color: theme.node.activeStroke }}>
                    <Layers3 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold">复刻素材与对象识别（可选）</h3>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: theme.toolbar.activeBg, color: theme.node.muted }}>
                            {assetCount ? `${assetCount} 张素材` : "纯AI复刻"}
                        </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: theme.node.muted }}>
                        不上传任何素材也可以直接生成；上传后只替换绑定对象，其余结构继续按原片复刻。
                    </p>
                </div>
                <button
                    type="button"
                    className="grid size-9 place-items-center rounded-xl transition hover:scale-[1.03]"
                    style={{ background: theme.toolbar.activeBg, color: theme.node.muted }}
                    aria-label={library.collapsed ? "展开替换元素" : "收起替换元素"}
                    onClick={onToggleCollapsed}
                    onMouseDown={stopCanvasEvent}
                    onPointerDown={stopCanvasEvent}
                    disabled={disabled}
                >
                    <ChevronDown className={`size-4 transition-transform ${library.collapsed ? "-rotate-90" : ""}`} />
                </button>
            </header>

            {!library.collapsed ? (
                <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-5" onMouseDown={stopCanvasEvent} onPointerDown={stopCanvasEvent} onWheel={stopCanvasEvent}>
                    {analysis ? (
                        <details className="mb-4 rounded-2xl border p-4" style={{ borderColor: theme.node.stroke, background: theme.node.fill }} open>
                            <summary className="cursor-pointer text-xs font-semibold">原片关键事件与代表帧 · P0 {analysis.mustKeepEvents.filter((event) => event.priority === "P0").length} 个</summary>
                            <p className="mt-2 text-[10px]" style={{ color: theme.node.muted }}>节拍边界只在事件层解释一次；它表示动作、对象状态或叙事功能发生了可观察变化。</p>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {analysis.mustKeepEvents.map((event) => {
                                    const frame = frameByShot.get(event.parentShotIndex);
                                    return <div key={event.id} className="flex gap-2 rounded-xl border p-2" style={{ borderColor: theme.node.stroke }}>
                                        <div className="grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: theme.canvas.background }}>{frame?.content ? <img src={frame.content} alt={event.description} className="h-full w-full object-cover" /> : <span className="text-[9px] opacity-50">无代表帧</span>}</div>
                                        <div className="min-w-0"><b className="text-[10px]">{event.priority} · {event.function}</b><div className="text-[9px] tabular-nums" style={{ color: theme.node.muted }}>{event.sourceStartSeconds.toFixed(2)}–{event.sourceEndSeconds.toFixed(2)}s</div><p className="mt-1 line-clamp-2 text-[10px]">{event.description}</p></div>
                                    </div>;
                                })}
                            </div>
                        </details>
                    ) : null}
                    {library.elements.length ? (
                        <div className="grid grid-cols-2 gap-4">
                            {library.elements.map((element) => {
                                const sourceFrame = element.shotIndexes.map((shotIndex) => frameByShot.get(shotIndex)).find((frame) => frame?.content);
                                return (
                                    <article key={element.id} className="overflow-hidden rounded-2xl border" style={{ borderColor: theme.node.stroke, background: theme.node.fill }}>
                                        <div className="flex gap-3 p-3.5">
                                            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: theme.node.stroke, background: theme.canvas.background }}>
                                                {sourceFrame?.content ? <img src={sourceFrame.content} alt={element.name} className="h-full w-full object-cover" draggable={false} /> : <Sparkles className="m-auto mt-7 size-5 opacity-25" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start gap-2">
                                                    <input
                                                        className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none"
                                                        value={element.name}
                                                        aria-label="替换元素名称"
                                                        disabled={disabled}
                                                        onChange={(event) => onRenameElement(element.id, event.target.value)}
                                                        onMouseDown={stopCanvasEvent}
                                                        onPointerDown={stopCanvasEvent}
                                                    />
                                                    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px]" style={{ background: theme.toolbar.activeBg, color: theme.node.muted }}>
                                                        {element.category}
                                                    </span>
                                                    {element.source === "manual" ? (
                                                        <button
                                                            type="button"
                                                            className="shrink-0 opacity-45 transition hover:opacity-100"
                                                            aria-label="删除替换元素"
                                                            disabled={disabled}
                                                            onClick={() => onRemoveElement(element.id)}
                                                            onMouseDown={stopCanvasEvent}
                                                            onPointerDown={stopCanvasEvent}
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </button>
                                                    ) : null}
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-[11px] leading-4" style={{ color: theme.node.muted }}>
                                                    {element.description}
                                                </p>
                                                <p className="mt-1 text-[10px]" style={{ color: theme.node.placeholder }}>
                                                    {element.shotIndexes.length ? `出现于动作节拍 ${element.shotIndexes.join("、")}` : "由AI自动匹配原片对象"}
                                                </p>
                                                {element.replacementFingerprint ? (
                                                    <p className="mt-1 line-clamp-1 text-[10px] font-medium" style={{ color: theme.node.activeStroke }}>
                                                        替换素材：{element.replacementFingerprint.name}
                                                    </p>
                                                ) : null}
                                                {element.binding ? (
                                                    <p className="mt-1 line-clamp-1 text-[10px] font-medium" style={{ color: element.binding.status === "bound" ? theme.node.activeStroke : theme.node.muted }}>
                                                        {element.binding.status === "bound" ? `已锁定全片 ${element.binding.affectedEventIds.length} 个事件` : "绑定待确认"}
                                                    </p>
                                                ) : null}
                                                {element.fingerprint && element.assets.length && (element.binding?.status !== "bound" || element.assets.some((asset) => asset.recognitionStatus === "needs-confirmation" || asset.recognitionStatus === "failed")) ? (
                                                    <button
                                                        type="button"
                                                        className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition hover:scale-[1.02]"
                                                        style={{ background: theme.toolbar.activeBg, color: theme.node.activeStroke }}
                                                        disabled={disabled}
                                                        onClick={() => onConfirmElement(element.id)}
                                                        onMouseDown={stopCanvasEvent}
                                                        onPointerDown={stopCanvasEvent}
                                                    >
                                                        <CheckCircle2 className="size-3.5" />
                                                        确认用于替换
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="flex min-h-24 flex-wrap items-center gap-2 border-t p-3" style={{ borderColor: theme.node.stroke }}>
                                            {element.assets.map((asset) => (
                                                <div key={asset.id} className="group relative size-20 overflow-hidden rounded-xl border" style={{ borderColor: theme.node.stroke, background: theme.canvas.background }} title={asset.name}>
                                                    <img src={asset.content} alt={asset.name} draggable={false} className="h-full w-full object-cover" />
                                                    {asset.recognitionStatus ? (
                                                        <span
                                                            className="absolute inset-x-1 bottom-1 truncate rounded-md px-1 py-0.5 text-center text-[9px] font-medium"
                                                            style={{ background: theme.toolbar.panel, color: asset.recognitionStatus === "needs-confirmation" || asset.recognitionStatus === "failed" ? theme.node.activeStroke : theme.node.text }}
                                                            title={asset.recognitionError}
                                                        >
                                                            {asset.recognitionStatus === "recognizing"
                                                                ? "识别中"
                                                                : asset.recognitionStatus === "recognized"
                                                                    ? "已识别"
                                                                    : "待确认"}
                                                        </span>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        className="absolute right-1 top-1 grid size-5 place-items-center rounded-full opacity-0 shadow-sm transition group-hover:opacity-100"
                                                        style={{ background: theme.toolbar.panel, color: theme.node.text }}
                                                        aria-label={`移除${asset.name}`}
                                                        disabled={disabled}
                                                        onClick={() => onRemoveAsset(element.id, asset.id)}
                                                        onMouseDown={stopCanvasEvent}
                                                        onPointerDown={stopCanvasEvent}
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[10px] transition hover:scale-[1.02]"
                                                style={{ borderColor: theme.node.muted, color: theme.node.muted }}
                                                disabled={disabled}
                                                onClick={() => onAddAssets(element.id)}
                                                onMouseDown={stopCanvasEvent}
                                                onPointerDown={stopCanvasEvent}
                                            >
                                                <ImagePlus className="size-4" />
                                                添加参考图
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed text-center" style={{ borderColor: theme.node.stroke, background: theme.node.fill }}>
                            <div className="max-w-md px-8">
                                <Sparkles className="mx-auto size-8 opacity-25" />
                                <p className="mt-3 text-sm font-medium">完成拉片后，AI会自动列出人物、场景、商品和关键物品</p>
                                <p className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>
                                    你可以完全跳过，也可以先添加一个自定义替换对象并批量上传多角度参考图。
                                </p>
                            </div>
                        </div>
                    )}
                    <button
                        type="button"
                        className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition hover:scale-[1.01]"
                        style={{ borderColor: theme.node.stroke, background: theme.node.fill, color: theme.node.text }}
                        disabled={disabled}
                        onClick={onAddElement}
                        onMouseDown={stopCanvasEvent}
                        onPointerDown={stopCanvasEvent}
                    >
                        <Plus className="size-4" />
                        添加其他替换元素
                    </button>
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center gap-2 text-xs" style={{ color: theme.node.muted }}>
                    <ImagePlus className="size-4" />
                    已收起，当前绑定 {assetCount} 张参考图
                </div>
            )}
        </div>
    );
});
