import { Button } from "antd";
import { ScanLine, Upload, Video } from "lucide-react";
import { UNIVERSAL_REMAKE_SCHEMA_VERSION, type UniversalSourceReconstruction } from "@/lib/universal-viral-remake";

export function UniversalRemakeAnalysisContent({ videoUrl, reconstruction, busy, error, onUpload, onAnalyze, onContinue }: {
    videoUrl?: string; reconstruction?: UniversalSourceReconstruction; busy: boolean; error?: string; onUpload: () => void; onAnalyze: () => void; onContinue?: () => void;
}) {
    const invariantDimensions = reconstruction
        ? [...new Set(reconstruction.timelineUnits.flatMap((unit) => (unit.structuralInvariants ?? []).map((invariant) => invariant.dimension)))]
        : [];
    const capabilityCoverage = reconstruction?.timelineUnits.flatMap((unit) => unit.capabilityCoverage ?? []) ?? [];
    const eventFacts = reconstruction?.timelineUnits.flatMap((unit) => unit.eventFacts ?? []).sort((left, right) => left.startSeconds - right.startSeconds) ?? [];
    const observedCoverage = capabilityCoverage.filter((item) => item.status === "observed").length;
    const unresolvedCritical = capabilityCoverage.filter((item) => item.status === "uncertain" && item.importance === "critical").length;
    const physicalInstanceCount = reconstruction?.entities.reduce((total, entity) => total + (entity.physicalInstanceCount || 0), 0) ?? 0;
    const isLegacyReconstruction = Boolean(reconstruction && reconstruction.schemaVersion !== UNIVERSAL_REMAKE_SCHEMA_VERSION);
    return <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
        {videoUrl ? <video className="max-h-64 w-full rounded-xl bg-black object-contain" src={videoUrl} controls /> : <div className="flex h-48 items-center justify-center rounded-xl border border-dashed opacity-60"><Video className="mr-2 size-5" />上传参考视频</div>}
        <div className="flex gap-2"><Button icon={<Upload className="size-4" />} onClick={onUpload}>更换视频</Button><Button type="primary" icon={<ScanLine className="size-4" />} loading={busy} disabled={!videoUrl} onClick={onAnalyze}>{busy ? "正在分析并自动修复" : "开始双重拉片"}</Button></div>
        {reconstruction ? <div className="rounded-lg border p-3">
            <div className={isLegacyReconstruction ? "font-semibold text-amber-500" : "font-semibold"}>{isLegacyReconstruction ? "旧版拉片结果，请重新拉片" : `已通过${reconstruction.verification.status === "repaired" ? "修复校验" : "独立校验"}`}</div>
            <div className="mt-1 opacity-70">{reconstruction.timelineUnits.length} 个语义时间单元 · {reconstruction.entities.length} 个稳定对象 · {reconstruction.durationSeconds.toFixed(2)} 秒</div>
            <div className="mt-1 text-xs opacity-70">物理实例 {physicalInstanceCount} 个 · 通用检查覆盖 {observedCoverage}/{capabilityCoverage.length} 项已观察 · 关键未决 {unresolvedCritical} 项</div>
            <div className="mt-2 text-xs opacity-70">本片自动识别的结构维度：{invariantDimensions.join("、") || "无"}</div>
            <details className="mt-3 rounded-md border p-2 text-xs">
                <summary className="cursor-pointer font-semibold">关键事件事实（{eventFacts.filter((fact) => fact.importance === "critical").length}）</summary>
                <div className="mt-2 space-y-2">
                    {eventFacts.map((fact) => <div key={fact.id} className="rounded bg-black/5 p-2 dark:bg-white/5">
                        <div className="font-medium">{fact.startSeconds.toFixed(3)}s–{fact.endSeconds.toFixed(3)}s · {fact.dimension}</div>
                        <div className="mt-1 opacity-75">{fact.predicate}</div>
                    </div>)}
                </div>
            </details>
        </div> : null}
        {error ? <div className="rounded-lg bg-red-500/10 p-3 text-red-500"><div>拉片暂时没有完成，系统已保留当前进度。</div>{reconstruction && onContinue ? <Button className="mt-2" size="small" loading={busy} onClick={onContinue}>继续生成母版</Button> : <Button className="mt-2" size="small" loading={busy} onClick={onAnalyze}>继续自动修复</Button>}</div> : null}
        <p className="text-xs opacity-55">系统会检查统一的信息能力目录，但只提取原片实际存在的事实；每项都会明确标记已观察、未观察、不适用或不确定。时间、动作、关系、镜头与声音均来自原片证据，不套固定剧情或动作模板。</p>
    </div>;
}
