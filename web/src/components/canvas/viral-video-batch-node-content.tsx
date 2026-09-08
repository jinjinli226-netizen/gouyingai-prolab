import { memo } from "react";
import { Coins, Factory, Layers3, Route } from "lucide-react";
import { InputNumber } from "antd";

import { canvasThemes } from "@/lib/canvas-theme";
import { normalizeViralCandidateCount, type ViralBatchRecipe } from "@/lib/canvas/viral-video-domain";
import type { ViralCostPreflight } from "@/lib/canvas/viral-video-cost";
import { useThemeStore } from "@/stores/use-theme-store";

type Props = { recipe: ViralBatchRecipe; cost?: ViralCostPreflight; disabled?: boolean; onCountChange: (count: number) => void; onGenerate: () => void };
export const ViralVideoBatchNodeContent = memo(function ViralVideoBatchNodeContent({ recipe, cost, disabled = false, onCountChange, onGenerate }: Props) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return <div className="flex h-full flex-col overflow-hidden rounded-[inherit]" style={{ background: theme.node.panel }}>
        <header className="flex cursor-grab items-center gap-3 border-b px-5 py-4 active:cursor-grabbing" style={{ borderColor: theme.node.stroke }}><Factory className="size-5" /><div><b>批量生产</b><p className="text-[11px]" style={{ color: theme.node.muted }}>一份母版编译 N 条完整视频；镜头节拍不会变成独立付费任务。</p></div></header>
        <div className="grid grid-cols-3 gap-3 p-5" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <label className="rounded-xl border p-3 text-xs" style={{ borderColor: theme.node.stroke }}><span className="flex items-center gap-1 text-[10px]" style={{ color: theme.node.muted }}><Layers3 className="size-3" />完整候选数</span><InputNumber min={1} max={1000} precision={0} value={recipe.candidateCount} disabled={disabled} onChange={(value) => onCountChange(normalizeViralCandidateCount(Number(value)))} className="mt-2 w-full" /></label>
            <Info icon={Route} label="执行方式" value="后台窗口队列" />
            <Info icon={Coins} label="预计费用" value={cost === undefined ? "生成前计算" : `¥${(cost.totalCents / 100).toFixed(2)}（单条 ¥${(cost.perCandidateCents / 100).toFixed(2)}）`} />
        </div>
        <div className="px-5 text-[11px]" style={{ color: theme.node.muted }}>固定对象 {recipe.fixedObjectIds.length} 个 · 可变槽位 {recipe.variableSlots.length} 个 · 默认不试跑、不自动扩产</div>
        {cost?.requiresAuthorization ? <div className="mx-5 mt-3 rounded-xl border p-3 text-[11px]" style={{ borderColor: theme.node.stroke }}>提交前会要求确认本批次最高费用 ¥{(cost.totalCents / 100).toFixed(2)}；不会自动扩产。</div> : null}
        <button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); onGenerate(); }} onMouseDown={(event) => event.stopPropagation()} className="m-5 mt-auto rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-40" style={{ background: theme.node.activeStroke }}>生成复刻视频</button>
    </div>;
});
function Info({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) { const theme = canvasThemes[useThemeStore((state) => state.theme)]; return <div className="rounded-xl border p-3" style={{ borderColor: theme.node.stroke }}><span className="flex items-center gap-1 text-[10px]" style={{ color: theme.node.muted }}><Icon className="size-3" />{label}</span><b className="mt-3 block text-xs">{value}</b></div>; }
