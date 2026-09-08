import { Button, InputNumber, Popover, Progress, Tag } from "antd";
import { Layers3, ScanLine, SlidersHorizontal, Sparkles, Video } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { getViralVideoRemakePrimaryAction } from "@/lib/canvas/viral-video-remake-workflow";
import { normalizeViralCandidateCount } from "@/lib/canvas/viral-video-domain";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ViralVideoRemakeWorkflowState } from "@/types/canvas";

export function ViralVideoRemakeCanvasBar({
    workflow,
    hasSourceVideo,
    replacementAssetCount,
    running,
    stageLabel,
    completed,
    total,
    totalVideoTasks,
    onWorkflowChange,
    onUploadSource,
    onOpenReplacements,
    onAnalyze,
    onGeneratePrompts,
    onGenerateRemake,
}: {
    workflow: ViralVideoRemakeWorkflowState;
    hasSourceVideo: boolean;
    replacementAssetCount: number;
    running: boolean;
    stageLabel: string;
    completed: number;
    total: number;
    totalVideoTasks: number;
    onWorkflowChange: (patch: Partial<ViralVideoRemakeWorkflowState>) => void;
    onUploadSource: () => void;
    onOpenReplacements: () => void;
    onAnalyze: () => void;
    onGeneratePrompts: () => void;
    onGenerateRemake: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const isBusy = running;
    const effectivePhase = !running && workflow.phase === "recognizing"
        ? "idle"
        : !running && workflow.phase === "templating"
            ? "requirements_ready"
            : !running && ["compiling", "running"].includes(workflow.phase)
                ? "template_ready"
                : workflow.phase;
    const hasAnalysis = !["idle", "recognizing"].includes(effectivePhase);
    const hasPlan = ["template_ready", "compiling", "ready_to_submit", "running", "partially_completed", "completed", "paused", "failed"].includes(effectivePhase);
    const videoLimitExceeded = totalVideoTasks > 100;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const settings = (
        <div className="grid w-72 gap-3">
            <label className="flex items-center justify-between gap-3 text-sm">
                <span className="opacity-65">完整候选视频数</span>
                <InputNumber min={1} max={1000} precision={0} value={workflow.candidateCount} disabled={isBusy} onChange={(value) => onWorkflowChange({ candidateCount: normalizeViralCandidateCount(Number(value)) })} className="w-24" />
            </label>
        </div>
    );
    const primaryActionKind = getViralVideoRemakePrimaryAction(effectivePhase);
    const primaryAction = primaryActionKind === "analyze"
        ? { label: "开始拉片分析", icon: <ScanLine className="size-4" />, disabled: !hasSourceVideo || isBusy, onClick: onAnalyze }
        : primaryActionKind === "plan-and-generate"
            ? { label: "一键生成复刻视频", icon: <Sparkles className="size-4" />, disabled: !hasAnalysis || isBusy || videoLimitExceeded, onClick: onGenerateRemake }
            : { label: "一键生成复刻视频", icon: <Video className="size-4" />, disabled: !hasPlan || isBusy || videoLimitExceeded, onClick: onGenerateRemake };

    return (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-50 w-[min(1080px,calc(100%-32px))] -translate-x-1/2">
            <div className="pointer-events-auto flex min-h-12 items-center gap-2 overflow-x-auto rounded-lg border px-3 py-2 shadow-lg backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
                <Tag color="cyan" className="m-0 shrink-0">爆款复刻</Tag>
                <Button className="shrink-0" icon={<Video className="size-4" />} disabled={isBusy} onClick={onUploadSource}>{hasSourceVideo ? "更换参考视频" : "上传参考视频"}</Button>
                <Button className="shrink-0" icon={<Layers3 className="size-4" />} disabled={isBusy} onClick={onOpenReplacements}>替换元素（可选）{replacementAssetCount ? ` · ${replacementAssetCount}` : ""}</Button>
                <Popover trigger="click" placement="bottom" content={settings}>
                    <Button className="shrink-0" icon={<SlidersHorizontal className="size-4" />} disabled={isBusy}>复刻设置</Button>
                </Popover>
                <Button className="shrink-0" type="primary" icon={primaryAction.icon} disabled={primaryAction.disabled} loading={isBusy} onClick={primaryAction.onClick}>
                    {primaryAction.label}
                </Button>
                {effectivePhase !== "idle" && effectivePhase !== "recognizing" ? <Button className="shrink-0" disabled={isBusy || !hasSourceVideo} onClick={onAnalyze}>重新分析</Button> : null}
                {hasAnalysis && effectivePhase !== "requirements_ready" && effectivePhase !== "templating" ? <Button className="shrink-0" disabled={isBusy} onClick={onGeneratePrompts}>重新生成复刻模板</Button> : null}
                {videoLimitExceeded ? <span className="shrink-0 text-xs text-red-500">预计 {totalVideoTasks} 个视频任务，超过 100 条上限</span> : null}
                {isBusy ? (
                    <div className="flex min-w-56 shrink-0 flex-1 items-center gap-2 text-xs opacity-70">
                        <span className="truncate">{stageLabel}</span>
                        <div className="min-w-20 flex-1">
                            <Progress percent={percent} size="small" showInfo={false} />
                        </div>
                        <span className="shrink-0 tabular-nums">{total > 0 ? `${completed}/${total}` : "等待工作项"}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
