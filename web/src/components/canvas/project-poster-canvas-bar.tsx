import { Button, Input, InputNumber, Popover, Progress, Select, Tag } from "antd";
import { FilePenLine, ImagePlus, Sparkles } from "lucide-react";

import { projectPosterRatioOptions } from "@/lib/canvas/project-poster-workflows";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ProjectPosterRatio, ProjectPosterWorkflowState } from "@/types/canvas";

export function ProjectPosterCanvasBar({
    workflow,
    hasReferenceImage,
    running,
    completed,
    total,
    onWorkflowChange,
    onUploadReference,
    onGenerate,
}: {
    workflow: ProjectPosterWorkflowState;
    hasReferenceImage: boolean;
    running: boolean;
    completed: number;
    total: number;
    onWorkflowChange: (patch: Partial<ProjectPosterWorkflowState>) => void;
    onUploadReference: () => void;
    onGenerate: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const briefReady = Boolean(workflow.projectBrief.trim());
    const briefEditor = (
        <div className="grid w-96 gap-2">
            <div>
                <div className="text-sm font-medium">项目介绍</div>
                <div className="mt-1 text-xs opacity-60">写清项目是什么、面向谁、事实信息和希望传达的感觉；AI 自行决定是否需要文字以及如何构图。</div>
            </div>
            <Input.TextArea value={workflow.projectBrief} disabled={running} autoSize={{ minRows: 6, maxRows: 10 }} maxLength={1200} showCount placeholder="例如：这是一个面向设计团队的 AI 协作平台，支持……希望用于新品发布和客户介绍。" onChange={(event) => onWorkflowChange({ projectBrief: event.target.value })} />
        </div>
    );

    return (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-50 w-[min(1040px,calc(100%-32px))] -translate-x-1/2">
            <div className="pointer-events-auto flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 shadow-lg backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
                <Tag color="cyan" className="m-0 shrink-0">
                    项目海报
                </Tag>
                <Button icon={<ImagePlus className="size-4" />} onClick={onUploadReference} disabled={running}>
                    {hasReferenceImage ? "更换主视觉" : "上传主视觉（可选）"}
                </Button>
                <Popover trigger="click" placement="bottom" content={briefEditor}>
                    <Button icon={<FilePenLine className="size-4" />}>{briefReady ? "修改项目介绍" : "填写项目介绍"}</Button>
                </Popover>
                <Select value={workflow.ratio} options={projectPosterRatioOptions} disabled={running} className="w-36" onChange={(value: ProjectPosterRatio) => onWorkflowChange({ ratio: value })} />
                <label className="flex shrink-0 items-center gap-2 text-sm">
                    <span className="opacity-65">生成数量</span>
                    <InputNumber min={1} max={10} precision={0} value={workflow.batchCount} disabled={running} className="w-20" onChange={(value) => onWorkflowChange({ batchCount: Math.max(1, Math.min(10, Number(value) || 1)) })} />
                </label>
                <Button type="primary" icon={<Sparkles className="size-4" />} disabled={!briefReady || running} loading={running} onClick={onGenerate}>
                    一键生成海报
                </Button>
                {running ? (
                    <div className="min-w-24 flex-1">
                        <Progress percent={percent} size="small" showInfo={false} />
                        <div className="text-right text-xs opacity-60">
                            {completed}/{total}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
