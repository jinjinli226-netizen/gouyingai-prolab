import { ArrowRight, Clapperboard, ImageIcon, MessageSquareText, Server, Share2, Sparkles, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button, Image, Tag } from "antd";
import { Link, useNavigate } from "react-router-dom";

import { navigationTools } from "@/constant/navigation-tools";
import { cn } from "@/lib/utils";
import { type Prompt } from "@/services/api/prompts";
import { useConfigStore } from "@/stores/use-config-store";

type HomeFeature = {
    icon: LucideIcon;
    title: string;
    desc: string;
    href: string;
};

const features: HomeFeature[] = [
    {
        icon: ImageIcon,
        title: "AI 绘图",
        desc: "聚合 OpenAI Images、Flux、Gemini、Grok、Hunyuan 等海外标准模型，统一在 GouYingAi 里调度。",
        href: "/image",
    },
    {
        icon: MessageSquareText,
        title: "画布助手",
        desc: "围绕选中节点和上游节点对话、生图，把结果直接插回画布，不打断创作链路。",
        href: "/canvas",
    },
    {
        icon: Clapperboard,
        title: "AI 视频",
        desc: "支持 OpenAI Video 和 Grok video chat 兼容协议，文生视频、图生视频统一入口。",
        href: "/video",
    },
    {
        icon: Server,
        title: "平台模型管理",
        desc: "渠道、API Key、模型发布和优先顺序统一在管理后台维护，前台自动使用已发布模型。",
        href: "/admin",
    },
    {
        icon: Sparkles,
        title: "模型图标与能力识别",
        desc: "模型列表自动显示 GPT、Claude、Gemini、Grok、Doubao 等图标，减少选择成本。",
        href: "/canvas",
    },
    {
        icon: Share2,
        title: "素材沉淀",
        desc: "把提示词、参考图、生成结果和画布结构沉淀在本地，下一次创作从已有经验开始。",
        href: "/assets",
    },
];

const stats = [
    { value: "40+", label: "兼容模型" },
    { value: "4", label: "标准协议" },
    { value: "100+", label: "模型图标" },
    { value: "0", label: "后端数据库" },
] as const;

export default function IndexPage() {
    const navigate = useNavigate();
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const [primaryTool] = navigationTools;
    const [promptShowcase, setPromptShowcase] = useState<Prompt[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);

    const openConfig = () => openConfigDialog(false);

    return (
        <main className="relative isolate h-full overflow-y-auto bg-background text-foreground">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:36px_36px] opacity-[0.38] [mask-image:radial-gradient(ellipse_at_top,black_0%,black_42%,transparent_78%)]" />

            <section className="relative px-6 pb-20 pt-20 lg:pb-28 lg:pt-28">
                <div className="mx-auto max-w-5xl text-center">
                    <h1 className="text-balance text-5xl font-semibold leading-none tracking-normal text-foreground md:text-[64px] lg:text-[72px]">GouYingAi</h1>

                    <p className="mx-auto mt-8 max-w-2xl text-balance text-lg leading-8 text-muted-foreground md:text-xl">
                        面向 AI 创作的无限画布工作台，把绘图、视频、对话助手、模型选择和素材沉淀放在一个干净、克制、专业的界面里。
                    </p>

                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        <Button type="primary" size="large" onClick={() => navigate(`/${primaryTool.slug}`)} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            开始使用
                        </Button>
                        <Button size="large" onClick={() => navigate("/canvas")}>
                            打开画布
                        </Button>
                    </div>
                </div>

                <section className="relative mx-auto mb-20 max-w-6xl border-t border-stone-200 pt-12 dark:border-stone-800">
                    <div className="mb-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                        <div />
                        <div className="max-w-2xl text-center">
                            <h2 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">沉淀每一次好结果</h2>
                            <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">收藏稳定出图的提示词、参考风格和结果图片，让下一次创作从已有经验开始。</p>
                        </div>
                        <Button type="link" onClick={() => navigate("/prompts")} className="justify-self-center md:justify-self-end" icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            查看提示词库
                        </Button>
                    </div>
                    <div className="grid auto-rows-[210px] gap-4 md:grid-cols-4">
                        {promptShowcase.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                className={cn(
                                    "group relative cursor-pointer overflow-hidden border border-stone-200 bg-stone-100 text-left dark:border-stone-800 dark:bg-stone-900",
                                    index === 0 && "md:col-span-2 md:row-span-2",
                                    index === 3 && "md:col-span-2",
                                )}
                            >
                                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-4 text-white">
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {item.tags.slice(0, 2).map((tag) => (
                                            <Tag key={tag} variant="filled" className="m-0 bg-white/15 text-[11px] text-white backdrop-blur">
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <h3 className="text-sm font-medium">{item.title}</h3>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{item.prompt}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </section>

            <section className="relative border-y border-border bg-background">
                <div className="mx-auto grid max-w-5xl grid-cols-2 md:grid-cols-4">
                    {stats.map((item, index) => (
                        <div key={item.label} className={`border-border px-6 py-8 text-center ${index > 0 ? "md:border-l" : ""} ${index % 2 === 1 ? "border-l" : ""} ${index >= 2 ? "border-t md:border-t-0" : ""}`}>
                            <div className="text-3xl font-semibold tracking-normal text-foreground md:text-4xl">{item.value}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="relative px-6 py-20 lg:py-28">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-12 max-w-2xl">
                        <div className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            <span className="h-px w-6 bg-muted-foreground" />
                            Features
                        </div>
                        <h2 className="text-3xl font-semibold tracking-normal text-foreground md:text-4xl">一个工作台，所有 AI 创作能力。</h2>
                        <p className="mt-3 text-base leading-7 text-muted-foreground">从绘图到视频，从模型选择到参数适配，统一的画布任务流让多模型协作像本地软件一样自然。</p>
                    </div>

                    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            const inner = (
                                <>
                                    <div className="mb-3 flex items-center gap-3">
                                        <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background transition-colors group-hover:border-foreground">
                                            <Icon className="size-4 text-foreground" />
                                        </div>
                                        <h3 className="text-base font-medium text-foreground">{feature.title}</h3>
                                    </div>
                                    <p className="text-sm leading-6 text-muted-foreground">{feature.desc}</p>
                                </>
                            );

                            return (
                                <Link key={feature.title} to={feature.href} className="group bg-background p-6 transition hover:bg-accent">
                                    {inner}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="relative px-6 pb-24">
                <div className="mx-auto max-w-5xl">
                    <div className="relative overflow-hidden rounded-lg border border-border bg-background px-8 py-14 text-center md:p-14">
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_70%)]" />

                        <h2 className="relative text-3xl font-semibold tracking-normal text-foreground md:text-4xl">准备好开始你的下一次创作？</h2>
                        <p className="relative mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground">渠道和模型只需在管理后台配置一次，所有创作工作流会自动使用已发布的模型。</p>
                        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
                            <Link to="/canvas" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition active:scale-[0.98]">
                                进入 GouYingAi
                                <ArrowRight className="size-4" />
                            </Link>
                            <Link to="/admin" className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium text-foreground transition hover:bg-accent">
                                <Server className="size-4" />
                                管理后台
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="relative border-t border-border bg-background">
                <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground md:flex-row">
                    <div>© {new Date().getFullYear()} GouYingAi · 无限画布创作工作台</div>
                    <div className="flex flex-wrap items-center justify-center gap-5">
                        <button type="button" onClick={openConfig} className="transition hover:text-foreground">
                            设置
                        </button>
                        <Link to="/prompts" className="transition hover:text-foreground">
                            提示词库
                        </Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}
