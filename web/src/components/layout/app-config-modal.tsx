import { App, Button, Form, Input, Modal, Progress, Select, Switch, Tabs } from "antd";
import { Cloud, KeyRound, Link2, RefreshCw, ShieldCheck, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { syncAppDataToWebdav, type AppSyncDomainKey, type AppSyncProgressEvent } from "@/services/app-sync";
import { testWebdavConnection, WEBDAV_MANIFEST_FILE_NAME } from "@/services/webdav-sync";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { CANVAS_AGENT_STORAGE_KEYS, useCanvasAgentStore } from "@/stores/canvas/use-canvas-agent-store";
import { useConfigStore, type ConfigTabKey } from "@/stores/use-config-store";

type WebdavDomainProgress = {
    label: string;
    stage: string;
    current?: number;
    total?: number;
    status?: "active" | "success" | "exception";
};

const webdavDomainKeys: AppSyncDomainKey[] = ["canvas", "assets", "image-workbench", "video-workbench"];
const webdavDomainLabels: Record<AppSyncDomainKey, string> = {
    canvas: "画布",
    assets: "我的素材",
    "image-workbench": "生图工作台",
    "video-workbench": "视频创作台",
};
const codexSetupSteps = [
    { title: "安装 Codex 插件", text: "先在 Codex App 安装 Infinite Canvas 插件，插件会注册 MCP 并尝试启动本地 Canvas Agent。" },
    { title: "连接本地 Agent", text: "在本页填入 Local URL 和 Connect token 后点击连接。" },
    { title: "手动启动备用", text: "如果插件没有自动启动本地服务，在终端运行下面命令。", command: "npx -y @basketikun/canvas-agent" },
];

function createWebdavDomainProgress(): Record<AppSyncDomainKey, WebdavDomainProgress> {
    return webdavDomainKeys.reduce(
        (progress, key) => ({
            ...progress,
            [key]: { label: webdavDomainLabels[key], stage: "等待同步" },
        }),
        {} as Record<AppSyncDomainKey, WebdavDomainProgress>,
    );
}

export function AppConfigPanel({ showDoneButton = false, initialTab = "preferences" }: { showDoneButton?: boolean; initialTab?: ConfigTabKey }) {
    const { message } = App.useApp();
    const [activeTab, setActiveTab] = useState<ConfigTabKey>(initialTab);
    const [testingWebdav, setTestingWebdav] = useState(false);
    const [syncingWebdav, setSyncingWebdav] = useState(false);
    const [webdavSyncStatus, setWebdavSyncStatus] = useState("");
    const [webdavDomainProgress, setWebdavDomainProgress] = useState(createWebdavDomainProgress);
    const config = useConfigStore((state) => state.config);
    const webdav = useConfigStore((state) => state.webdav);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const updateWebdavConfig = useConfigStore((state) => state.updateWebdavConfig);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const agentUrl = useCanvasAgentStore((state) => state.url);
    const agentToken = useCanvasAgentStore((state) => state.token);
    const agentConnected = useCanvasAgentStore((state) => state.connected);
    const agentEnabled = useCanvasAgentStore((state) => state.enabled);
    const agentActivity = useCanvasAgentStore((state) => state.activity);
    const agentConnectError = useCanvasAgentStore((state) => state.connectError);
    const agentConfirmTools = useCanvasAgentStore((state) => state.confirmTools);
    const setAgentState = useCanvasAgentStore((state) => state.setAgentState);
    const connectAgent = useCanvasAgentStore((state) => state.connectAgent);
    const disconnectAgent = useCanvasAgentStore((state) => state.disconnectAgent);
    const webdavReady = Boolean(webdav.url.trim());
    useEffect(() => setActiveTab(initialTab), [initialTab]);

    const finishConfig = () => {
        setConfigDialogOpen(false);
        message.success(shouldPromptContinue ? "偏好已保存，请继续刚才的请求" : "偏好已保存");
        clearPromptContinue();
    };

    const testWebdav = async () => {
        if (!webdavReady) {
            message.error("请先填写 WebDAV 地址");
            return;
        }
        setTestingWebdav(true);
        try {
            await testWebdavConnection(webdav);
            message.success("WebDAV 连接可用");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "WebDAV 连接测试失败");
        } finally {
            setTestingWebdav(false);
        }
    };

    const updateWebdavProgress = (event: AppSyncProgressEvent) => {
        setWebdavSyncStatus(event.stage);
        if (!event.domain) return;
        setWebdavDomainProgress((current) => ({
            ...current,
            [event.domain as AppSyncDomainKey]: {
                label: event.label || webdavDomainLabels[event.domain as AppSyncDomainKey],
                stage: event.stage,
                current: event.current,
                total: event.total,
                status: event.status,
            },
        }));
    };

    const syncWebdav = async () => {
        if (!webdavReady) {
            message.error("请先填写 WebDAV 地址");
            return;
        }
        setSyncingWebdav(true);
        setWebdavDomainProgress(createWebdavDomainProgress());
        setWebdavSyncStatus("准备同步");
        try {
            const result = await syncAppDataToWebdav(webdav, updateWebdavProgress);
            updateWebdavConfig("lastSyncedAt", result.syncedAt);
            message.success(`同步完成：${result.projects} 个画布，${result.assets} 个素材，${result.imageLogs + result.videoLogs} 条记录，本次上传 ${result.uploadedFiles} 个文件 ${formatBytes(result.uploadedBytes)}`);
        } catch (error) {
            setWebdavSyncStatus(error instanceof Error ? error.message : "WebDAV 同步失败");
            message.error(error instanceof Error ? error.message : "WebDAV 同步失败");
        } finally {
            setSyncingWebdav(false);
        }
    };

    const updateAgentConfig = (patch: { url?: string; token?: string }) => {
        setAgentState({ ...patch, connectError: "" });
        if (patch.url !== undefined) localStorage.setItem(CANVAS_AGENT_STORAGE_KEYS.url, patch.url.trim().replace(/\/$/, ""));
        if (patch.token !== undefined) localStorage.setItem(CANVAS_AGENT_STORAGE_KEYS.token, patch.token);
    };

    const toggleAgentConnection = () => (agentEnabled ? disconnectAgent({ connectError: "" }) : connectAgent());

    return (
        <>
            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as ConfigTabKey)}
                items={[
                    {
                        key: "preferences",
                        label: "生成偏好",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                                    <div>
                                        <div className="text-sm font-semibold">渠道与模型由管理后台统一维护</div>
                                        <div className="mt-1 text-xs text-muted-foreground">前台会自动使用后台已启用的模型，并按后台排序选择默认模型。</div>
                                    </div>
                                    <Button href="/admin">打开管理后台</Button>
                                </section>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Form.Item label="画布默认生图张数" extra="新建画布生图和配置节点默认使用，单个节点仍可单独覆盖。" className="mb-4">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={15}
                                            value={config.canvasImageCount}
                                            onChange={(event) => updateConfig("canvasImageCount", event.target.value)}
                                            onBlur={(event) => updateConfig("canvasImageCount", normalizeImageCount(event.target.value))}
                                        />
                                    </Form.Item>
                                    <Form.Item label="默认音频声音" className="mb-4">
                                        <Select value={config.audioVoice} options={audioVoiceOptions} onChange={(value) => updateConfig("audioVoice", value)} />
                                    </Form.Item>
                                    <Form.Item label="默认音频格式" className="mb-4">
                                        <Select value={config.audioFormat} options={audioFormatOptions} onChange={(value) => updateConfig("audioFormat", value)} />
                                    </Form.Item>
                                    <Form.Item label="默认音频语速" className="mb-4">
                                        <Input
                                            type="number"
                                            min={0.25}
                                            max={4}
                                            step={0.05}
                                            value={config.audioSpeed}
                                            onChange={(event) => updateConfig("audioSpeed", event.target.value)}
                                            onBlur={(event) => updateConfig("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item label="默认音频指令" className="mb-4">
                                    <Input.TextArea rows={2} value={config.audioInstructions} placeholder="例如：自然、温暖、适合旁白。" onChange={(event) => updateConfig("audioInstructions", event.target.value)} />
                                </Form.Item>
                                <Form.Item label="系统提示词" className="mb-0">
                                    <Input.TextArea rows={4} value={config.systemPrompt} placeholder="例如：你是一位擅长电影感写实摄影的视觉导演。" onChange={(event) => updateConfig("systemPrompt", event.target.value)} />
                                </Form.Item>
                            </Form>
                        ),
                    },
                    {
                        key: "webdav",
                        label: "WebDAV",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-lg border border-border p-3">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Cloud className="size-4" />
                                                WebDAV 同步
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">同步画布、我的素材、生成记录和本地媒体文件，不包含 AI API Key；浏览器会直接连接 WebDAV 服务。</div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">{webdav.lastSyncedAt ? `上次同步 ${formatWebdavTime(webdav.lastSyncedAt)}` : "尚未同步"}</div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Form.Item label="WebDAV 地址" className="mb-4">
                                            <Input value={webdav.url} placeholder="https://nas.example.com/webdav" onChange={(event) => updateWebdavConfig("url", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label="远程目录" extra={`会在该目录下分业务目录保存，每个目录包含 ${WEBDAV_MANIFEST_FILE_NAME} 和 files/`} className="mb-4">
                                            <Input value={webdav.directory} placeholder="gouyingai" onChange={(event) => updateWebdavConfig("directory", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label="用户名" className="mb-0">
                                            <Input value={webdav.username} autoComplete="username" onChange={(event) => updateWebdavConfig("username", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label="密码 / 应用密码" className="mb-0">
                                            <Input.Password value={webdav.password} autoComplete="current-password" onChange={(event) => updateWebdavConfig("password", event.target.value)} />
                                        </Form.Item>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <Button icon={<Wifi className="size-4" />} disabled={!webdavReady || syncingWebdav} loading={testingWebdav} onClick={() => void testWebdav()}>
                                            测试连接
                                        </Button>
                                        <Button type="primary" icon={<RefreshCw className="size-4" />} disabled={!webdavReady || testingWebdav} loading={syncingWebdav} onClick={() => void syncWebdav()}>
                                            {syncingWebdav ? "同步中" : "立即同步"}
                                        </Button>
                                        {webdavSyncStatus ? <span className="text-xs text-muted-foreground">{webdavSyncStatus}</span> : null}
                                    </div>
                                    {syncingWebdav || webdavSyncStatus ? <WebdavProgressGrid progress={webdavDomainProgress} /> : null}
                                </section>
                            </Form>
                        ),
                    },
                    {
                        key: "codex",
                        label: "Codex",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Link2 className="size-4" />
                                                连接本地 Codex
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">用于画布 Agent 连接本机 Codex 插件启动的 Canvas Agent。</div>
                                        </div>
                                        <div className={agentConnectError ? "text-xs text-red-600" : "text-xs text-stone-500"}>{agentConnectError ? "连接失败" : agentConnected ? agentActivity || "已连接" : agentEnabled ? "连接中" : "未连接"}</div>
                                    </div>
                                    <div className="mb-4 grid gap-2 md:grid-cols-3">
                                        {codexSetupSteps.map((step, index) => (
                                            <div key={step.title} className="rounded-md border border-stone-200 p-3 dark:border-stone-800">
                                                <div className="text-xs font-semibold text-stone-500">步骤 {index + 1}</div>
                                                <div className="mt-1 text-sm font-medium">{step.title}</div>
                                                <div className="mt-1 text-xs leading-5 text-stone-500">{step.text}</div>
                                                {step.command ? <code className="mt-2 block overflow-x-auto rounded bg-stone-100 px-2 py-1.5 text-[11px] text-stone-700 dark:bg-stone-900 dark:text-stone-200">{step.command}</code> : null}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Form.Item label="Local URL" className="mb-4">
                                            <Input prefix={<Link2 className="mr-1 size-4 text-stone-400" />} value={agentUrl} placeholder="http://127.0.0.1:17371" onChange={(event) => updateAgentConfig({ url: event.target.value })} />
                                        </Form.Item>
                                        <Form.Item label="Connect token" className="mb-4">
                                            <Input.Password prefix={<KeyRound className="mr-1 size-4 text-stone-400" />} value={agentToken} placeholder="自动发现，或手动填入 Connect token" onChange={(event) => updateAgentConfig({ token: event.target.value })} />
                                        </Form.Item>
                                    </div>
                                    {agentConnectError ? <div className="mb-3 rounded-md border border-red-200 px-3 py-2 text-xs text-red-600 dark:border-red-900/60">{agentConnectError}</div> : null}
                                    <div className="mb-3 flex justify-end">
                                        <Button type={agentEnabled ? "default" : "primary"} icon={<Wifi className="size-4" />} onClick={toggleAgentConnection}>
                                            {agentConnected ? "断开" : agentEnabled ? "取消连接" : "连接"}
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <ShieldCheck className="size-4 text-stone-500" />
                                            <div>
                                                <div className="text-sm font-medium">执行画布操作前确认</div>
                                                <div className="mt-0.5 text-xs text-stone-500">关闭后，本地 Codex 可直接执行画布工具调用。不再需要人工确认</div>
                                            </div>
                                        </div>
                                        <Switch checked={agentConfirmTools} onChange={(confirmTools) => setAgentState({ confirmTools })} />
                                    </div>
                                </section>
                            </Form>
                        ),
                    },
                ]}
            />
            {showDoneButton ? (
                <div className="mt-4 flex justify-end">
                    <Button type="primary" onClick={finishConfig}>
                        完成
                    </Button>
                </div>
            ) : null}
        </>
    );
}

export function AppConfigModal() {
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const configTab = useConfigStore((state) => state.configTab);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    return (
        <Modal
            title={
                <div>
                    <div className="text-lg font-semibold">用户偏好</div>
                    <div className="mt-1 text-xs font-normal text-stone-500">生成、同步与 Codex 连接偏好</div>
                </div>
            }
            open={isConfigOpen}
            width={980}
            centered
            onCancel={() => setConfigDialogOpen(false)}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 12 } }}
            footer={null}
        >
            <AppConfigPanel showDoneButton initialTab={configTab} />
        </Modal>
    );
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(15, Math.floor(Math.abs(Number(value)) || 3))));
}

function formatWebdavTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WebdavProgressGrid({ progress }: { progress: Record<AppSyncDomainKey, WebdavDomainProgress> }) {
    return (
        <div className="mt-3 grid gap-2">
            {webdavDomainKeys.map((key) => {
                const item = progress[key];
                const count = item.total ? `${item.current || 0}/${item.total}` : "";
                return (
                    <div key={key} className="rounded-md border border-border px-3 py-2">
                        <div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-xs">
                            <span className="shrink-0 font-medium text-foreground">{item.label}</span>
                            <span className="min-w-0 truncate text-right text-muted-foreground">
                                {item.stage}
                                {count ? ` · ${count}` : ""}
                            </span>
                        </div>
                        <Progress percent={getWebdavProgressPercent(item)} size="small" status={getWebdavProgressStatus(item)} showInfo={false} />
                    </div>
                );
            })}
        </div>
    );
}

function getWebdavProgressPercent(item: WebdavDomainProgress) {
    if (item.status === "success") return 100;
    if (item.total) return Math.min(100, Math.round(((item.current || 0) / item.total) * 100));
    if (item.status === "exception") return 100;
    if (item.stage === "等待同步") return 0;
    if (item.stage === "读取远端清单") return 12;
    if (item.stage === "读取本地数据") return 24;
    if (item.stage === "下载缺失媒体") return 36;
    if (item.stage === "写入本地合并结果") return 58;
    if (item.stage === "上传新增媒体") return 66;
    if (item.stage === "媒体已齐全" || item.stage === "媒体无需上传") return 74;
    if (item.stage.startsWith("上传清单")) return 90;
    return item.status === "active" ? 30 : 0;
}

function getWebdavProgressStatus(item: WebdavDomainProgress): "normal" | "active" | "success" | "exception" {
    if (item.status === "success" || item.status === "exception") return item.status;
    return item.status === "active" ? "active" : "normal";
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
