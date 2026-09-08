import { AppConfigPanel } from "@/components/layout/app-config-modal";

export default function ConfigPage() {
    return (
        <main className="h-full overflow-y-auto bg-background">
            <div className="mx-auto max-w-6xl px-6 py-6">
                <div className="mb-5">
                    <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">用户偏好</h1>
                    <p className="mt-1 text-sm text-stone-500">生成、同步与 Codex 连接偏好；渠道和模型统一由管理后台维护。</p>
                </div>
                <AppConfigPanel />
            </div>
        </main>
    );
}
