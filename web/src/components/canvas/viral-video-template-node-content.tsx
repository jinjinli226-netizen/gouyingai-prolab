import { memo, type ChangeEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type UIEvent, type WheelEvent } from "react";
import { AudioLines, CheckCircle2, Film, ShieldCheck, UsersRound } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { ViralRemakeTemplate } from "@/lib/canvas/viral-video-domain";
import { useThemeStore } from "@/stores/use-theme-store";

type Props = {
    template: ViralRemakeTemplate;
    masterPrompt: string;
    onMasterPromptChange: (value: string) => void;
    disabled?: boolean;
};

export const ViralVideoTemplateNodeContent = memo(function ViralVideoTemplateNodeContent({ template, masterPrompt, onMasterPromptChange, disabled = false }: Props) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const stopCanvasEvent = (event: MouseEvent | KeyboardEvent | WheelEvent | PointerEvent | UIEvent<HTMLElement> | ChangeEvent<HTMLTextAreaElement>) => event.stopPropagation();
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[inherit]" onWheel={stopCanvasEvent} onKeyDown={stopCanvasEvent}>
            <header className="flex shrink-0 cursor-grab items-center justify-between gap-4 border-b px-5 py-4 active:cursor-grabbing" style={{ borderColor: theme.node.stroke }}>
                <div>
                    <div className="text-sm font-semibold">唯一复刻母版</div>
                    <div className="mt-1 text-[11px]" style={{ color: theme.node.muted }}>{template.events.length} 个事件 · {template.targetDurationSeconds.toFixed(2)} 秒 · {template.aspectRatio}</div>
                </div>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: template.coverage.passed ? theme.node.activeStroke : theme.node.muted }}>
                    <CheckCircle2 className="size-4" /> P0 {template.coverage.mappedP0Count}/{template.coverage.p0Count}
                </div>
            </header>
            <section className="grid shrink-0 grid-cols-3 border-b" style={{ borderColor: theme.node.stroke }}>
                <Summary icon={UsersRound} label="人物与对象" value={`${template.characterBible.characters.length} 位角色 · ${template.bindings.filter((item) => item.status === "bound").length} 个锁定替换`} />
                <Summary icon={ShieldCheck} label="连续性" value={template.continuityRules.join("；")} />
                <Summary icon={AudioLines} label="声音轨" value={`${template.audioPlan.voiceover.length} 段口播 · ${template.audioPlan.soundEffects.length} 个音效`} />
            </section>
            <section className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr]">
                <div className="min-h-0 border-r" style={{ borderColor: theme.node.stroke }}>
                    <div className="border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>事件时间轴（P0 不可删除）</div>
                    <div className="thin-scrollbar h-[calc(100%-40px)] overflow-y-auto" onMouseDown={stopCanvasEvent} onPointerDown={stopCanvasEvent}>
                        {template.events.map((event) => (
                            <div key={event.id} className="grid grid-cols-[72px_108px_1fr] gap-3 border-b px-4 py-3 text-[11px] leading-5" style={{ borderColor: theme.node.stroke }}>
                                <b>{event.priority}</b><span className="tabular-nums" style={{ color: theme.node.muted }}>{event.targetStartSeconds.toFixed(2)}–{event.targetEndSeconds.toFixed(2)}s</span><span>{event.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex min-h-0 flex-col">
                    <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs font-semibold" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}><Film className="size-3.5" />完整成片提示词（可编辑）</div>
                    <textarea value={masterPrompt} disabled={disabled} className="thin-scrollbar min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-xs leading-5 outline-none" style={{ color: theme.node.text }} onChange={(event) => onMasterPromptChange(event.target.value)} onMouseDown={stopCanvasEvent} onPointerDown={stopCanvasEvent} onWheel={stopCanvasEvent} />
                </div>
            </section>
        </div>
    );
});

function Summary({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    return <div className="min-w-0 border-r px-4 py-3 last:border-r-0" style={{ borderColor: theme.node.stroke }}><div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: theme.node.muted }}><Icon className="size-3.5" />{label}</div><div className="line-clamp-3 text-xs leading-5">{value || "未识别"}</div></div>;
}
