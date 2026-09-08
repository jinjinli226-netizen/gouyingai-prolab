import { App, Button } from "antd";
import { ArrowRight, Layers3, ScanLine, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { buildViralVideoRemakeProject } from "@/lib/canvas/viral-video-remake-workflow";
import { buildUniversalRemakeBetaProject } from "@/lib/universal-viral-remake/canvas-adapter";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

export default function EcommercePage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const hydrated = useCanvasStore((state) => state.hydrated);
    const importProject = useCanvasStore((state) => state.importProject);

    const openViralVideoRemakeWorkflow = () => {
        if (!hydrated) {
            message.info("画布数据正在加载，请稍候");
            return;
        }
        const id = importProject(buildViralVideoRemakeProject());
        navigate(`/canvas/${id}`);
    };

    const openUniversalRemakeWorkflow = () => {
        if (!hydrated) {
            message.info("画布数据正在加载，请稍候");
            return;
        }
        const id = importProject(buildUniversalRemakeBetaProject());
        navigate(`/canvas/${id}`);
    };

    return (
        <main className="h-full overflow-y-auto bg-stone-50 px-5 py-8 text-stone-950 dark:bg-stone-950 dark:text-stone-100 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-6xl">
                <div className="flex items-start gap-4 border-b border-stone-200 pb-7 dark:border-stone-800">
                    <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-cyan-600 text-white">
                        <ShoppingBag className="size-5" />
                    </div>
                    <div>
                        <p className="mb-1 text-sm font-medium text-cyan-700 dark:text-cyan-400">爆款视频智能拆解与复刻</p>
                        <h1 className="text-3xl font-semibold">AI批量带货系统</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500 dark:text-stone-400">上传一条参考视频进行 AI 拉片，替换人物与商品后生成一条结构完整的新带货视频。</p>
                    </div>
                </div>

                <section className="mt-8">
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-medium uppercase text-cyan-700 dark:text-cyan-400">Viral remake</p>
                            <h2 className="mt-1 text-xl font-semibold">爆款复刻工作流</h2>
                        </div>
                        <span className="text-xs text-stone-400">选择适合你的复刻流程</span>
                    </div>
                    <div className="grid gap-4">
                    <article className="group grid gap-5 rounded-lg border border-cyan-200 bg-white p-6 hover:bg-cyan-50/40 dark:border-cyan-900 dark:bg-stone-900 dark:hover:bg-cyan-950/20 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center">
                        <div className="grid size-14 place-items-center rounded-lg border border-cyan-200 text-cyan-700 dark:border-cyan-800 dark:text-cyan-400">
                            <Layers3 className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold">通用复刻</h3>
                                <span className="rounded bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">Beta</span>
                            </div>
                            <p className="mt-1.5 text-sm leading-6 text-stone-500 dark:text-stone-400">双重语义拉片、可选多对象替换、1–1000 条完整成片批量生成；长视频会按语义边界分段并自动合成。</p>
                        </div>
                        <Button type="primary" icon={<ArrowRight className="size-4" />} disabled={!hydrated} onClick={openUniversalRemakeWorkflow}>
                            进入通用复刻 Beta
                        </Button>
                    </article>
                    <article className="group grid gap-5 rounded-lg border border-stone-200 bg-white p-6 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800/40 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center">
                        <div className="grid size-14 place-items-center rounded-lg border border-stone-200 text-cyan-700 dark:border-stone-700 dark:text-cyan-400">
                            <ScanLine className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold">爆款复刻</h3>
                            <p className="mt-1.5 text-sm leading-6 text-stone-500 dark:text-stone-400">上传参考视频，AI 在一个只读拉片节点中完成时间轴、叙事、镜头语言、影像和声音分析，再生成原创换角与商品替换方案。</p>
                        </div>
                        <Button type="primary" icon={<ArrowRight className="size-4" />} disabled={!hydrated} onClick={openViralVideoRemakeWorkflow}>
                            进入复刻工作流
                        </Button>
                    </article>
                    </div>
                </section>
            </div>
        </main>
    );
}
