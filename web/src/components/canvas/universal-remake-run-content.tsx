import { Button, InputNumber } from "antd";
import { Play } from "lucide-react";
import type { ReactNode } from "react";
import type { UniversalBatchSummary, UniversalRemakeTemplate } from "@/lib/universal-viral-remake";

export function UniversalRemakeRunContent({ template, summary, candidateCount, maxInFlight, maxDuration, busy, onSettings, onGenerate }: {
    template?: UniversalRemakeTemplate; summary?: UniversalBatchSummary; candidateCount: number; maxInFlight: number; maxDuration: number; busy: boolean;
    onSettings: (patch: { candidateCount?: number; maxInFlight?: number; maxSegmentDurationSeconds?: number }) => void; onGenerate: () => void;
}) {
    return <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
        <Field label="完整成片数量（1–1000）"><InputNumber className="w-full" min={1} max={1000} value={candidateCount} onChange={(value) => onSettings({ candidateCount: Number(value) || 1 })} /></Field>
        <Field label="同时运行的候选"><InputNumber className="w-full" min={1} max={20} value={maxInFlight} onChange={(value) => onSettings({ maxInFlight: Number(value) || 1 })} /></Field>
        <Field label="当前模型单段上限（秒）"><InputNumber className="w-full" min={1} max={60} value={maxDuration} onChange={(value) => onSettings({ maxSegmentDurationSeconds: Number(value) || 15 })} /></Field>
        {summary ? <div className="rounded-lg border p-3 text-xs leading-6">预计生成调用：{summary.segmentCallCount}<br />预计合成调用：{summary.compositionCallCount}<br />预计生成总秒数：{summary.totalGeneratedSeconds.toFixed(2)}<br />按 1 分/秒估算：¥{(summary.totalGeneratedSeconds / 100).toFixed(2)}</div> : null}
        <Button type="primary" size="large" icon={<Play className="size-4" />} disabled={!template} loading={busy} onClick={onGenerate}>提交后台批量生成</Button>
        <p className="text-xs opacity-55">一个候选始终对应一条完整成片。长视频会内部拆为多个片段生成并自动合成，不会把分段冒充成多条结果。</p>
    </div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><div className="mb-1 text-xs opacity-60">{label}</div>{children}</label>; }
