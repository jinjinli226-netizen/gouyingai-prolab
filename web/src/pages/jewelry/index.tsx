import { App, Button, Tag } from "antd";
import { ArrowRight, Check, Diamond, Images, Layers3, ScanSearch } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { buildJewelryProductWorkflowProject, jewelryProductImageOptions } from "@/lib/canvas/jewelry-product-workflows";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

const highlights = [
    { icon: ScanSearch, title: "商品一致性优先", description: "主石、镶爪、配石、戒托、戒臂和金属颜色均以商品原图为唯一事实来源。" },
    { icon: Layers3, title: "九类独立提示词", description: "不是同一模板换标题；每类都有专门的镜头、构图、材质和禁止项。" },
    { icon: Images, title: "可选参考替换", description: "可上传首图背景模板和佩戴姿势参考，只迁移背景或手势，不继承旧戒指。" },
];

export default function JewelryPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const hydrated = useCanvasStore((state) => state.hydrated);
    const importProject = useCanvasStore((state) => state.importProject);
    const openWorkflow = () => {
        if (!hydrated) {
            message.info("画布数据正在加载，请稍候");
            return;
        }
        navigate(`/canvas/${importProject(buildJewelryProductWorkflowProject())}`);
    };
    return (
        <main className="min-h-full bg-stone-50 px-5 py-8 text-stone-950 dark:bg-stone-950 dark:text-stone-100 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-6xl">
                <header className="grid gap-8 border-b border-stone-200 pb-9 dark:border-stone-800 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
                    <div>
                        <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-cyan-600 text-white"><Diamond className="size-6" /></div>
                        <Tag color="cyan" className="mb-3">独立图片工作流</Tag>
                        <h1 className="text-4xl font-semibold tracking-tight">AI 珠宝商品图</h1>
                        <p className="mt-4 max-w-3xl text-base leading-7 text-stone-500 dark:text-stone-400">上传一张真实戒指商品图，按需批量生成 Etsy 商品首图、三视图、展示图、佩戴图与设计稿。所有结果进入专用画布，完整提示词可见，也可单张修改和重试。</p>
                    </div>
                    <Button type="primary" size="large" icon={<ArrowRight className="size-4" />} iconPlacement="end" disabled={!hydrated} onClick={openWorkflow}>新建珠宝商品图画布</Button>
                </header>

                <section className="mt-8 grid gap-3 md:grid-cols-3">
                    {highlights.map((item) => (
                        <article key={item.title} className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
                            <item.icon className="size-5 text-cyan-700 dark:text-cyan-400" />
                            <h2 className="mt-4 font-semibold">{item.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">{item.description}</p>
                        </article>
                    ))}
                </section>

                <section className="mt-10">
                    <div className="mb-4">
                        <p className="text-xs font-medium uppercase text-cyan-700 dark:text-cyan-400">Outputs</p>
                        <h2 className="mt-1 text-xl font-semibold">默认可生成 9 类商品图</h2>
                    </div>
                    <div className="grid overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 sm:grid-cols-2 lg:grid-cols-3">
                        {jewelryProductImageOptions.map((item) => (
                            <div key={item.value} className="flex gap-3 border-b border-r border-stone-200 p-4 dark:border-stone-800">
                                <Check className="mt-0.5 size-4 shrink-0 text-cyan-600" />
                                <div><div className="text-sm font-medium">{item.label}</div><div className="mt-1 text-xs leading-5 text-stone-500">{item.description}</div></div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
