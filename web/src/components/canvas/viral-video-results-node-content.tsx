import { memo, useEffect, useState } from "react";
import { CirclePause, CirclePlay, Download, ExternalLink, RotateCcw, Square, Video } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { listViralBatchCandidates, type ViralBatch } from "@/services/api/viral-batches";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasJob, CanvasJobStatus } from "@/types/canvas-job";

type Props = { batch?: ViralBatch; onPause: () => void; onResume: () => void; onCancel: () => void; onRetryFailed: () => void };

export const ViralVideoResultsNodeContent = memo(function ViralVideoResultsNodeContent({ batch, onPause, onResume, onCancel, onRetryFailed }: Props) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [candidatePage, setCandidatePage] = useState<{ data: CanvasJob[]; total: number }>({ data: [], total: 0 });
    const [offset, setOffset] = useState(0);
    const [status, setStatus] = useState<CanvasJobStatus | "">("");
    useEffect(() => {
        if (!batch) { setCandidatePage({ data: [], total: 0 }); return; }
        let disposed = false;
        void listViralBatchCandidates(batch.id, { offset, limit: 4, status: status || undefined }).then((page) => {
            if (!disposed) setCandidatePage({ data: page.data, total: page.meta.total });
        }).catch(() => undefined);
        return () => { disposed = true; };
    }, [batch?.id, batch?.updatedAt, offset, status]);
    const completed = (batch?.succeededCount || 0) + (batch?.failedCount || 0) + (batch?.cancelledCount || 0);
    const percent = batch ? Math.round((completed / Math.max(1, batch.candidateCount)) * 100) : 0;
    return <div className="flex h-full flex-col overflow-hidden rounded-[inherit]" style={{ background: theme.node.panel }}>
        <header className="flex cursor-grab items-center gap-3 border-b px-5 py-4 active:cursor-grabbing" style={{ borderColor: theme.node.stroke }}><Video className="size-5" /><div><b>批次结果</b><p className="text-[11px]" style={{ color: theme.node.muted }}>{batch ? `${batch.candidateCount} 条完整候选 · ${batch.status}` : "尚未提交批次"}</p></div></header>
        <div className="grid grid-cols-4 gap-3 p-5 text-center"><Metric label="成功" value={batch?.succeededCount || 0} /><Metric label="运行" value={(batch?.queuedCount || 0) + (batch?.runningCount || 0)} /><Metric label="失败" value={batch?.failedCount || 0} /><Metric label="进度" value={`${percent}%`} /></div>
        <div className="mx-5 h-2 overflow-hidden rounded-full" style={{ background: theme.toolbar.activeBg }}><div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: theme.node.activeStroke }} /></div>
        <div className="mx-5 mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border" style={{ borderColor: theme.node.stroke }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-3 py-2 text-[10px]" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                <span>候选结果 {candidatePage.total ? `${offset + 1}-${Math.min(offset + 4, candidatePage.total)} / ${candidatePage.total}` : "0"}</span>
                <select value={status} onChange={(event) => { setStatus(event.target.value as CanvasJobStatus | ""); setOffset(0); }} className="rounded border bg-transparent px-2 py-1"><option value="">全部状态</option><option value="succeeded">成功</option><option value="running">运行</option><option value="failed">失败</option></select>
            </div>
            <div className="h-full divide-y overflow-y-auto text-[11px]">
                {candidatePage.data.map((candidate) => <CandidateRow key={candidate.id} candidate={candidate} />)}
                {!candidatePage.data.length ? <div className="px-3 py-5 text-center" style={{ color: theme.node.muted }}>候选将在后台按窗口逐步创建，不会铺满画布。</div> : null}
            </div>
            {candidatePage.total > 4 ? <div className="flex justify-end gap-2 border-t px-3 py-1.5" style={{ borderColor: theme.node.stroke }}><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 4))}>上一页</button><button disabled={offset + 4 >= candidatePage.total} onClick={() => setOffset(offset + 4)}>下一页</button></div> : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 border-t p-4" style={{ borderColor: theme.node.stroke }}>
            {batch?.status === "paused" ? <Action icon={CirclePlay} label="继续" onClick={onResume} /> : <Action icon={CirclePause} label="暂停" onClick={onPause} />}
            <Action icon={RotateCcw} label="重试失败项" onClick={onRetryFailed} disabled={!batch?.failedCount} />
            <Action icon={Square} label="取消" onClick={onCancel} disabled={!batch || ["completed", "cancelled"].includes(batch.status)} />
        </div>
    </div>;
});

function CandidateRow({ candidate }: { candidate: CanvasJob }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [previewFailed, setPreviewFailed] = useState(false);
    const result = candidate.result || {};
    const url = typeof result.url === "string" ? result.url : "";
    const quality = result.quality && typeof result.quality === "object" && !Array.isArray(result.quality) ? result.quality as Record<string, unknown> : null;
    const missingP0 = Array.isArray(quality?.missingP0EventIds) ? quality.missingP0EventIds.length : 0;
    return <article className="p-3">
        <div className="mb-2 flex items-center gap-2">
            <b className="tabular-nums">候选 #{(candidate.candidateIndex ?? 0) + 1}</b>
            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: theme.toolbar.activeBg, color: theme.node.muted }}>{candidate.status}</span>
            <span className="flex-1" />
            {missingP0 ? <b className="text-red-500">缺 P0</b> : null}
            {typeof quality?.totalScore === "number" ? <b>{quality.totalScore}分</b> : null}
        </div>
        {url ? <div className="flex min-w-0 gap-3">
            <div className="flex aspect-video w-56 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black">
                {!previewFailed
                    ? <video src={url} controls playsInline preload="metadata" className="size-full object-contain" onError={() => setPreviewFailed(true)} data-canvas-no-zoom />
                    : <div className="px-3 text-center text-[11px] text-red-400">预览加载失败<br />可尝试在新窗口打开</div>}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                <div style={{ color: theme.node.muted }}>成片已生成，可直接播放、打开或下载。</div>
                <div className="flex flex-wrap gap-2">
                    <a href={url} target="_blank" rel="noreferrer" title="打开成片" aria-label="打开成片" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5"><ExternalLink className="size-3.5" />打开</a>
                    <a href={url} download title="下载成片" aria-label="下载成片" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5"><Download className="size-3.5" />下载</a>
                </div>
            </div>
        </div> : candidate.status === "succeeded" ? <div className="rounded-md border border-red-500/30 px-3 py-4 text-center text-red-400">成片地址缺失，请重新加载批次结果。</div> : null}
    </article>;
}

function Metric({ label, value }: { label: string; value: number | string }) { const theme = canvasThemes[useThemeStore((state) => state.theme)]; return <div className="rounded-xl border p-3" style={{ borderColor: theme.node.stroke }}><b className="text-lg">{value}</b><div className="text-[10px]" style={{ color: theme.node.muted }}>{label}</div></div>; }
function Action({ icon: Icon, label, onClick, disabled = false }: { icon: typeof CirclePlay; label: string; onClick: () => void; disabled?: boolean }) { return <button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }} onMouseDown={(event) => event.stopPropagation()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs disabled:opacity-35"><Icon className="size-3.5" />{label}</button>; }
