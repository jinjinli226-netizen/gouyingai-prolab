import { Badge } from "antd";
import type { UniversalRemakeBetaWorkflowState } from "@/types/canvas";

export function UniversalRemakeCanvasBar({ workflow }: { workflow: UniversalRemakeBetaWorkflowState }) {
    return <div className="absolute left-1/2 top-5 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-background/90 px-4 py-2 text-sm shadow-lg backdrop-blur"><b>通用复刻 Beta</b><Badge status={workflow.phase === "failed" ? "error" : workflow.phase === "completed" ? "success" : workflow.phase === "idle" ? "default" : "processing"} text={workflow.phase} /><span className="opacity-55">语义拉片 · 可选多对象替换 · 1–1000 完整成片 · 长视频自动合成</span></div>;
}
