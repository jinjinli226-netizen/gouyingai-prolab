import { Button } from "antd";
import { ShieldCheck } from "lucide-react";
import type { UniversalRemakeTemplate, UniversalSourceReconstruction } from "@/lib/universal-viral-remake";

export function UniversalRemakeTemplateContent({ reconstruction, template, busy, onCompile }: { reconstruction?: UniversalSourceReconstruction; template?: UniversalRemakeTemplate; busy: boolean; onCompile: () => void }) {
    return <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
        <Button type="primary" icon={<ShieldCheck className="size-4" />} loading={busy} disabled={!reconstruction} onClick={onCompile}>校验绑定并生成唯一母版</Button>
        {template ? <><div className="grid grid-cols-2 gap-2"><Metric label="语义单元" value={template.timelineUnits.length} /><Metric label="生成片段" value={template.segmentPlan.segments.length} /><Metric label="目标时长" value={`${template.durationSeconds.toFixed(2)}s`} /><Metric label="保真门禁" value={template.fidelity.passed ? "通过" : "失败"} /></div><div className="rounded-lg border p-3 text-xs"><div className="font-semibold">允许变化</div>{template.fidelity.allowedChanges.map((item, index) => <div key={index} className="mt-1 opacity-70">• {item.summary}</div>)}</div><details className="rounded-lg border p-3 text-xs"><summary className="cursor-pointer font-semibold">完整反推生成提示词</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words opacity-75">{template.compiledPromptPreview || "尚未形成可执行提示词"}</pre></details></> : <div className="rounded-lg border border-dashed p-4 opacity-55">母版只锁定原片证据实际识别出的关键结构不变量；未在原片中出现的动作、镜头、声音或营销维度不会被强制加入。替换身份与明确局部改动属于允许变化。</div>}
    </div>;
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border p-3"><div className="text-xs opacity-55">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
