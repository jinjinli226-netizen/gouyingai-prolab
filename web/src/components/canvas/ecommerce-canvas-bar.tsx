import { Button, InputNumber, Popover, Progress, Select, Tag } from "antd";
import { ImagePlus, SlidersHorizontal, Sparkles } from "lucide-react";

import {
    ecommerceProductPlacementOptions,
    ecommerceStoryModeOptions,
    ecommerceStoryPlayOptions,
    ecommerceStoryVisualStyleOptions,
    getEcommerceOutputCount,
    getEcommerceWorkflowDefinition,
} from "@/lib/canvas/ecommerce-workflows";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { EcommerceProductPlacement, EcommerceStoryMode, EcommerceStoryPlay, EcommerceStoryVisualStyle, EcommerceWorkflowState } from "@/types/canvas";

export function EcommerceCanvasBar({
    workflow,
    hasProductImage,
    running,
    completed,
    total,
    onWorkflowChange,
    onUploadProduct,
    onGenerate,
}: {
    workflow: EcommerceWorkflowState;
    hasProductImage: boolean;
    running: boolean;
    completed: number;
    total: number;
    onWorkflowChange: (patch: Partial<EcommerceWorkflowState>) => void;
    onUploadProduct: () => void;
    onGenerate: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const definition = getEcommerceWorkflowDefinition(workflow.category);
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const outputCount = getEcommerceOutputCount(workflow);
    const outputLimitExceeded = outputCount > 100;
    const isStory = workflow.category === "story";
    const storyMode = workflow.storyMode || "single";
    const storySettings = (
        <div className="grid w-72 gap-3">
            <label className="grid gap-1 text-sm">
                <span className="opacity-65">成片模式</span>
                <Select value={storyMode} options={ecommerceStoryModeOptions} disabled={running} onChange={(value: EcommerceStoryMode) => onWorkflowChange({ storyMode: value })} />
            </label>
            <label className="grid gap-1 text-sm">
                <span className="opacity-65">剧情玩法</span>
                <Select value={workflow.storyPlay || "auto"} options={ecommerceStoryPlayOptions} disabled={running} onChange={(value: EcommerceStoryPlay) => onWorkflowChange({ storyPlay: value })} />
            </label>
            <label className="grid gap-1 text-sm">
                <span className="opacity-65">画面风格</span>
                <Select value={workflow.storyVisualStyle || "live-action"} options={ecommerceStoryVisualStyleOptions} disabled={running} onChange={(value: EcommerceStoryVisualStyle) => onWorkflowChange({ storyVisualStyle: value })} />
            </label>
            <label className="grid gap-1 text-sm">
                <span className="opacity-65">商品植入</span>
                <Select value={workflow.productPlacement || "auto"} options={ecommerceProductPlacementOptions} disabled={running} onChange={(value: EcommerceProductPlacement) => onWorkflowChange({ productPlacement: value })} />
            </label>
            {storyMode === "series" ? (
                <label className="flex items-center justify-between gap-3 text-sm">
                    <span className="opacity-65">每套集数</span>
                    <InputNumber min={3} max={20} precision={0} value={workflow.seriesEpisodes || 5} disabled={running} onChange={(value) => onWorkflowChange({ seriesEpisodes: Math.max(3, Math.min(20, Number(value) || 5)) })} className="w-24" />
                </label>
            ) : null}
            <div className={`text-xs ${outputLimitExceeded ? "text-red-500" : "opacity-60"}`}>当前将生成 {outputCount} 条视频{outputLimitExceeded ? "，已超过 100 条上限" : ""}</div>
        </div>
    );

    return (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-50 w-[min(940px,calc(100%-32px))] -translate-x-1/2">
            <div className="pointer-events-auto flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 shadow-lg backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
                <Tag color="cyan" className="m-0 shrink-0">
                    {definition.shortTitle}
                </Tag>
                <Button icon={<ImagePlus className="size-4" />} onClick={onUploadProduct}>
                    {hasProductImage ? "更换商品图" : "上传商品图"}
                </Button>
                {isStory ? (
                    <Popover trigger="click" placement="bottom" content={storySettings}>
                        <Button icon={<SlidersHorizontal className="size-4" />}>剧情设置</Button>
                    </Popover>
                ) : null}
                <label className="flex shrink-0 items-center gap-2 text-sm">
                    <span className="opacity-65">{isStory ? "创意套数" : "生成数量"}</span>
                    <InputNumber min={1} max={100} precision={0} value={workflow.batchCount} disabled={running} onChange={(value) => onWorkflowChange({ batchCount: Math.max(1, Math.min(100, Number(value) || 1)) })} className="w-20" />
                </label>
                {isStory ? <span className={`shrink-0 text-xs ${outputLimitExceeded ? "text-red-500" : "opacity-60"}`}>预计 {outputCount} 条</span> : null}
                <Button type="primary" icon={<Sparkles className="size-4" />} disabled={!hasProductImage || running || outputLimitExceeded} loading={running} onClick={onGenerate}>
                    一键生成视频
                </Button>
                {running ? (
                    <div className="min-w-28 flex-1">
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
