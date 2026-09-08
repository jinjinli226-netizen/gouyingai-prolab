import { FileVideo2, Languages, Ratio, Timer } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { ViralVideoAnalysis } from "@/lib/canvas/viral-video-remake-workflow";
import { useThemeStore } from "@/stores/use-theme-store";

export function ViralVideoRequirementsNodeContent({ analysis, brief, onBriefChange, disabled = false }: { analysis?: ViralVideoAnalysis; brief: string; onBriefChange: (value: string) => void; disabled?: boolean }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return <section className="border-b p-5" style={{ borderColor: theme.node.stroke }}>
        <div className="flex cursor-grab items-center gap-3 active:cursor-grabbing"><FileVideo2 className="size-5" /><div><h3 className="text-sm font-semibold">参考视频与复刻要求</h3><p className="text-[11px]" style={{ color: theme.node.muted }}>默认完整复刻原片结构；描述可留空，AI 自动识别商品、人物和场景。</p></div></div>
        <div className="mt-4 grid grid-cols-[1fr_110px_90px_90px] gap-2" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <textarea value={brief} disabled={disabled} onChange={(event) => onBriefChange(event.target.value)} placeholder="可选：只写你想改变的内容；留空即按原片完整复刻" className="h-16 resize-none rounded-xl border bg-transparent px-3 py-2 text-xs outline-none" style={{ borderColor: theme.node.stroke }} />
            <Fact icon={Timer} label="目标时长" value={analysis ? `${analysis.durationSeconds.toFixed(2)}s` : "跟随原片"} />
            <Fact icon={Ratio} label="画幅" value={analysis?.aspectRatio || "自动"} />
            <Fact icon={Languages} label="语言" value="跟随原片" />
        </div>
    </section>;
}

function Fact({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) { const theme = canvasThemes[useThemeStore((state) => state.theme)]; return <div className="rounded-xl border px-3 py-2" style={{ borderColor: theme.node.stroke }}><div className="flex items-center gap-1 text-[10px]" style={{ color: theme.node.muted }}><Icon className="size-3" />{label}</div><b className="mt-2 block text-xs">{value}</b></div>; }
