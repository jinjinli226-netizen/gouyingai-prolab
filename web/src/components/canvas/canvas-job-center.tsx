import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, Popover, Spin, Tooltip } from "antd";
import { ListChecks, RefreshCw, RotateCcw, Square, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { isGatewayConfigured } from "@/services/gateway-admin";
import { useCanvasJobStore } from "@/stores/canvas/use-canvas-job-store";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import type { CanvasJobStatus } from "@/types/canvas-job";

const statusLabels: Record<CanvasJobStatus, string> = {
    queued: "排队",
    leased: "准备中",
    submitting: "提交中",
    running: "生成中",
    succeeded: "已完成",
    failed: "失败",
    cancel_requested: "取消中",
    cancelled: "已取消",
};

export function CanvasJobCenter() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const jobs = useCanvasJobStore((state) => state.jobs);
    const loading = useCanvasJobStore((state) => state.loading);
    const error = useCanvasJobStore((state) => state.error);
    const refresh = useCanvasJobStore((state) => state.refresh);
    const cancel = useCanvasJobStore((state) => state.cancel);
    const retry = useCanvasJobStore((state) => state.retry);
    const projects = useCanvasStore((state) => state.projects);
    const projectTitles = useMemo(() => new Map(projects.map((project) => [project.id, project.title])), [projects]);
    const activeCount = jobs.filter((job) => ["queued", "leased", "submitting", "running", "cancel_requested"].includes(job.status)).length;

    useEffect(() => {
        if (!isGatewayConfigured) return;
        const update = () => void refresh();
        update();
        const timer = window.setInterval(update, 3_000);
        window.addEventListener("focus", update);
        window.addEventListener("online", update);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", update);
            window.removeEventListener("online", update);
        };
    }, [refresh]);

    if (!isGatewayConfigured) return null;
    const content = (
        <div className="w-[360px] max-w-[calc(100vw-32px)]">
            <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">画布任务</div>
                <Button type="text" size="small" icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={() => void refresh()} />
            </div>
            {error ? <div className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                {!jobs.length && loading ? <div className="py-8 text-center"><Spin /></div> : null}
                {!jobs.length && !loading ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无后台任务" /> : null}
                {jobs.slice(0, 50).map((job) => (
                    <div key={job.id} className="rounded-lg border border-stone-200 p-2.5 dark:border-stone-700">
                        <button type="button" className="block w-full text-left" onClick={() => { setOpen(false); navigate(`/canvas/${encodeURIComponent(job.canvasId)}`); }}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium">{projectTitles.get(job.canvasId) || `画布 ${job.canvasId.slice(0, 8)}`}</span>
                                <span className={job.status === "failed" ? "text-xs text-red-500" : job.status === "succeeded" ? "text-xs text-emerald-600" : "text-xs text-cyan-600"}>{statusLabels[job.status]}</span>
                            </div>
                            <div className="mt-1 truncate text-xs text-stone-500">{job.kind} · 节点 {job.targetNodeId.slice(0, 8)}</div>
                        </button>
                        <div className="mt-2 flex justify-end gap-1">
                            {["queued", "leased", "submitting", "running"].includes(job.status) ? <Tooltip title="取消任务"><Button type="text" size="small" icon={<Square className="size-3" />} onClick={() => void cancel(job.id)} /></Tooltip> : null}
                            {["failed", "cancelled"].includes(job.status) ? <Tooltip title="重新提交"><Button type="text" size="small" icon={<RotateCcw className="size-3" />} onClick={() => void retry(job)} /></Tooltip> : null}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="fixed bottom-5 right-5 z-50">
            <Popover content={content} trigger="click" placement="topRight" open={open} onOpenChange={setOpen}>
                <Badge count={activeCount} overflowCount={99}>
                    <Button type="primary" shape="circle" size="large" icon={open ? <X className="size-5" /> : <ListChecks className="size-5" />} aria-label="画布任务中心" />
                </Badge>
            </Popover>
        </div>
    );
}
