import { Button, Select } from "antd";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Images } from "lucide-react";
import type { UniversalReplacementEntity, UniversalSourceEntity, UniversalSourceReconstruction } from "@/lib/universal-viral-remake";
import { resolveImageUrl } from "@/services/image-storage";
import type { UniversalRemakeReplacementAsset } from "@/types/canvas";

export function UniversalRemakeBindingsContent({ reconstruction, replacements, assets, bindings, busy, onFiles, onBind }: {
    reconstruction?: UniversalSourceReconstruction; replacements: UniversalReplacementEntity[]; assets: UniversalRemakeReplacementAsset[];
    bindings: Array<{ sourceEntityId: string; replacementEntityId: string }>; busy: boolean; onFiles: (files: File[], sourceEntityId?: string) => void; onBind: (replacementId: string, sourceEntityId: string) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const pendingSourceEntityIdRef = useRef<string | undefined>(undefined);
    const openFilePicker = (sourceEntityId?: string) => {
        pendingSourceEntityIdRef.current = sourceEntityId;
        if (inputRef.current) inputRef.current.value = "";
        inputRef.current?.click();
    };
    const input = (event: ChangeEvent<HTMLInputElement>) => {
        const files = [...(event.target.files || [])];
        if (files.length) onFiles(files, pendingSourceEntityIdRef.current);
        pendingSourceEntityIdRef.current = undefined;
        event.target.value = "";
    };
    return <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
        <input ref={inputRef} className="hidden" type="file" accept="image/*" multiple onChange={input} />
        <div className="rounded-lg border border-dashed p-3 text-xs leading-5 opacity-70">
            <div><b>第 1 步：</b>上传你想换进去的人物、商品、场景或道具图片，可一次上传多张。</div>
            <div><b>第 2 步：</b>在每张替换图下选择“它要替换原片中的哪个对象”。确认后只换身份与外观，原片动作和时间结构保持不变。</div>
        </div>
        <Button block icon={<Images className="size-4" />} loading={busy} onClick={() => openFilePicker()}>批量上传后再选择对象（可选）</Button>
        {!reconstruction ? <div className="rounded-lg border border-dashed p-4 opacity-55">请先完成拉片；完成后这里会列出原片人物、商品、场景、道具等可替换对象。</div> : <>
            <div className="text-xs font-semibold opacity-70">原片识别对象</div>
            {reconstruction.entities.map((entity) => {
                const replacementCount = bindings.filter((binding) => binding.sourceEntityId === entity.id).length;
                return <div key={entity.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="font-semibold">{entity.placeholderId} · {kindLabel(entity.kind)}</div><div className="mt-1 text-xs opacity-60">{entity.identityFacts}</div></div><Button size="small" icon={<Images className="size-3.5" />} loading={busy} onClick={() => openFilePicker(entity.id)}>{replacementCount ? "添加变体" : "上传替换图"}</Button></div>
                    {replacementCount ? <div className="mt-2 text-xs text-emerald-500">已绑定 {replacementCount} 个替换素材</div> : <div className="mt-2 text-xs opacity-45">不上传则保留原片对象</div>}
                </div>;
            })}
        </>}
        {replacements.length ? <div className="pt-1 text-xs font-semibold opacity-70">你的替换图片</div> : null}
        {replacements.map((replacement) => {
            const asset = assets.find((item) => item.id === replacement.id);
            const binding = bindings.find((item) => item.replacementEntityId === replacement.id);
            const target = reconstruction?.entities.find((entity) => entity.id === binding?.sourceEntityId);
            const options = sourceOptions(reconstruction?.entities || [], replacement);
            return <div key={replacement.id} className="rounded-lg border p-3">
                <div className="flex gap-3">
                    {asset ? <ReplacementPreview asset={asset} /> : null}
                    <div className="min-w-0 flex-1"><div className="font-semibold">替换素材 · {kindLabel(replacement.kind)}</div><div className="mt-1 line-clamp-3 text-xs opacity-60">{replacement.identityFacts}</div></div>
                </div>
                <Select
                    className="mt-3 w-full"
                    placeholder="请选择要替换的原片对象"
                    value={binding?.sourceEntityId}
                    options={options}
                    disabled={!reconstruction?.entities.length}
                    popupRender={(menu) => (
                        <div onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                            {menu}
                        </div>
                    )}
                    onChange={(sourceId) => onBind(replacement.id, sourceId)}
                />
                <div className={`mt-2 text-xs ${target ? "text-emerald-500" : "opacity-55"}`}>{target ? `已绑定：这张图将替换 ${target.placeholderId} · ${kindLabel(target.kind)}` : "尚未绑定；请选择一个原片对象"}</div>
            </div>;
        })}
        {assets.length ? <div className="text-xs opacity-60">已托管 {assets.length} 张替换参考图；不上传或不绑定时，对应对象继续使用原片身份。</div> : null}
    </div>;
}

function ReplacementPreview({ asset }: { asset: UniversalRemakeReplacementAsset }) {
    const [src, setSrc] = useState(asset.content);
    useEffect(() => { let active = true; void resolveImageUrl(asset.storageKey, asset.content).then((url) => { if (active) setSrc(url); }); return () => { active = false; }; }, [asset.content, asset.storageKey]);
    return <img src={src} alt={asset.name} className="size-20 shrink-0 rounded-lg border object-cover" />;
}

function sourceOptions(entities: UniversalSourceEntity[], replacement: UniversalReplacementEntity) {
    return [...entities]
        .sort((left, right) => Number(right.kind === replacement.kind) - Number(left.kind === replacement.kind))
        .map((entity) => ({
            value: entity.id,
            label: `${entity.kind === replacement.kind ? "推荐 · " : ""}${entity.placeholderId} · ${kindLabel(entity.kind)} · ${entity.identityFacts}`,
        }));
}

function kindLabel(kind: UniversalSourceEntity["kind"]) {
    return ({ product: "商品", person: "人物", scene: "场景", vehicle: "交通工具", wardrobe: "服装", animal: "动物", prop: "道具", other: "其他对象" } as const)[kind];
}
