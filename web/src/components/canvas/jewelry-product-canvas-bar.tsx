import { Button, Checkbox, InputNumber, Popover, Progress, Tag } from "antd";
import { Images, Sparkles, Upload } from "lucide-react";

import { jewelryProductImageOptions } from "@/lib/canvas/jewelry-product-workflows";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { JewelryProductImageType, JewelryProductWorkflowState } from "@/types/canvas";

export function JewelryProductCanvasBar({
    workflow,
    hasProductImage,
    hasHeroTemplate,
    hasWearingReference,
    running,
    completed,
    total,
    onWorkflowChange,
    onUpload,
    onGenerate,
}: {
    workflow: JewelryProductWorkflowState;
    hasProductImage: boolean;
    hasHeroTemplate: boolean;
    hasWearingReference: boolean;
    running: boolean;
    completed: number;
    total: number;
    onWorkflowChange: (patch: Partial<JewelryProductWorkflowState>) => void;
    onUpload: (nodeId: string) => void;
    onGenerate: () => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const typeEditor = (
        <div className="w-[460px]">
            <div className="mb-3">
                <div className="text-sm font-medium">选择商品图类型</div>
                <div className="mt-1 text-xs opacity-60">每个类型使用独立提示词；三视图已拆成侧面、背面和立式侧面三张。</div>
            </div>
            <Checkbox.Group
                className="grid w-full grid-cols-2 gap-2"
                value={workflow.outputTypes}
                onChange={(values) => onWorkflowChange({ outputTypes: values.map(String) as JewelryProductImageType[] })}
            >
                {jewelryProductImageOptions.map((item) => (
                    <Checkbox key={item.value} value={item.value} className="rounded-md border border-border px-3 py-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="mt-0.5 block text-xs opacity-60">{item.description}</span>
                    </Checkbox>
                ))}
            </Checkbox.Group>
        </div>
    );
    return (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-50 w-[min(1280px,calc(100%-32px))] -translate-x-1/2">
            <div className="pointer-events-auto flex min-h-12 flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-lg backdrop-blur" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}>
                <Tag color="cyan" className="m-0 shrink-0">珠宝商品图</Tag>
                <Button icon={<Upload className="size-4" />} disabled={running} onClick={() => onUpload(workflow.productNodeId)}>
                    {hasProductImage ? "更换戒指原图" : "上传戒指原图"}
                </Button>
                <Button disabled={running} onClick={() => onUpload(workflow.heroTemplateNodeId)}>{hasHeroTemplate ? "更换首图模板" : "首图模板（可选）"}</Button>
                <Button disabled={running} onClick={() => onUpload(workflow.wearingReferenceNodeId)}>{hasWearingReference ? "更换佩戴参考" : "佩戴参考（可选）"}</Button>
                <Popover trigger="click" placement="bottom" content={typeEditor}>
                    <Button icon={<Images className="size-4" />}>已选 {workflow.outputTypes.length} 类</Button>
                </Popover>
                <label className="flex items-center gap-2 text-sm">
                    <span className="opacity-65">每类套数</span>
                    <InputNumber min={1} max={10} precision={0} value={workflow.batchCount} disabled={running} className="w-20" onChange={(value) => onWorkflowChange({ batchCount: Math.max(1, Math.min(10, Number(value) || 1)) })} />
                </label>
                <Button type="primary" icon={<Sparkles className="size-4" />} disabled={!hasProductImage || !workflow.outputTypes.length || running} loading={running} onClick={onGenerate}>一键生成商品图</Button>
                {running ? (
                    <div className="min-w-24 flex-1">
                        <Progress percent={percent} size="small" showInfo={false} />
                        <div className="text-right text-xs opacity-60">{completed}/{total}</div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
