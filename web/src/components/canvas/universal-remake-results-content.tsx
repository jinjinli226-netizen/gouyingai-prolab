import { Button } from "antd";
import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useState } from "react";
import type { UniversalRemakeRun } from "@/services/api/universal-remake-runs";
import { resolveCanvasArtifactUrl } from "@/services/api/canvas-artifacts";

export function UniversalRemakeResultsContent({ run, onPause, onResume, onCancel, onRetryComposition }: { run?: UniversalRemakeRun; onPause: () => void; onResume: () => void; onCancel: () => void; onRetryComposition: (index: number) => void }) {
    const [urls, setUrls] = useState<Record<string, string>>({});
    useEffect(() => {
        if (!run) return;
        let cancelled = false;
        void Promise.all(run.candidates.flatMap((candidate) => candidate.output_artifact_uri ? [resolveCanvasArtifactUrl(run.canvas_id, candidate.output_artifact_uri).then((url) => [candidate.output_artifact_uri as string, url] as const)] : []))
            .then((entries) => { if (!cancelled) setUrls(Object.fromEntries(entries)); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [run]);
    if (!run) return <div className="p-4 text-sm opacity-55">提交后，这里按“完整成片”展示结果。长视频分段只作为内部子任务。</div>;
    return <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm"><div className="grid grid-cols-3 gap-2"><Metric label="生成完成" value={run.succeeded_count} /><Metric label="生成失败" value={run.failed_count} /><Metric label="运行状态" value={run.status} /></div><div className="flex flex-wrap gap-2"><Button icon={<Pause className="size-4" />} onClick={onPause}>暂停</Button><Button icon={<Play className="size-4" />} onClick={onResume}>继续</Button><Button danger icon={<Square className="size-4" />} onClick={onCancel}>取消</Button></div>{run.candidates.map((candidate) => {
        const fidelityStatus = candidate.fidelity_status ?? "not-evaluated";
        const fidelityLabel = candidate.status !== "succeeded" ? null
            : fidelityStatus === "passed" ? "复刻校验通过"
                : fidelityStatus === "failed" ? "生成完成，复刻未通过"
                    : fidelityStatus === "pending" ? "生成完成，正在复刻校验"
                        : "生成完成，复刻待校验";
        return <div key={candidate.index} className="rounded-lg border p-3"><div className="flex items-center justify-between"><b>成片 #{candidate.index + 1}</b><span className="text-xs opacity-60">{candidate.status}</span></div>{fidelityLabel ? <div className={`mt-2 rounded px-2 py-1 text-xs ${fidelityStatus === "passed" ? "bg-emerald-500/10 text-emerald-500" : fidelityStatus === "failed" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>{fidelityLabel}</div> : null}{candidate.output_artifact_uri ? <>{urls[candidate.output_artifact_uri] ? <video className="mt-2 max-h-64 w-full rounded-lg bg-black" src={urls[candidate.output_artifact_uri]} controls /> : <div className="mt-2 text-xs text-emerald-500">完整成片已托管，正在刷新播放地址…</div>}</> : null}{candidate.fidelity_issues?.length ? <div className="mt-2 text-xs text-red-500">{candidate.fidelity_issues.map((issue) => <div key={issue}>• {issue}</div>)}</div> : null}{candidate.error ? <div className="mt-2 text-xs text-red-500">{candidate.error}</div> : null}{candidate.status === "failed" && candidate.failure_stage === "composition" ? <Button className="mt-2" size="small" icon={<RotateCcw className="size-3" />} onClick={() => onRetryComposition(candidate.index)}>只重试合成</Button> : null}</div>;
    })}</div>;
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border p-2 text-center"><div className="text-xs opacity-55">{label}</div><b>{value}</b></div>; }
