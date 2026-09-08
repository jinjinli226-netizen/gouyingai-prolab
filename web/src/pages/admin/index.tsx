import { Alert, App, Button, Empty, Form, Input, Modal, Select, Space, Switch, Table, Tabs, Tag } from "antd";
import { LogOut, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { fetchGatewayCatalog, gatewayAdminApi, isGatewayConfigured, syncGatewayCatalog, type GatewayApiFormat, type GatewayChannel, type GatewayModel, type GatewayUsage } from "@/services/gateway-admin";
import { isSupabaseConfigured, supabase } from "@/services/supabase-client";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { adminDirectoryStatus } from "@/pages/admin/admin-directory-status";

type ChannelForm = { name: string; base_url: string; api_format: GatewayApiFormat; api_key: string; enabled: boolean };
type ModelForm = { channel_id: string; model_name: string; display_name: string; capability: GatewayModel["capability"]; api_format: GatewayApiFormat; published: boolean; sort_order: number; options: string };

const apiFormatOptions = [
    { label: "OpenAI 兼容", value: "openai" },
    { label: "Gemini 原生", value: "gemini" },
    { label: "AutoDL ComfyUI", value: "autodl_comfyui" },
] satisfies Array<{ label: string; value: GatewayApiFormat }>;

const autoDlOptionsHint = JSON.stringify(
    {
        canvasVideoRoute: {
            family: "minimax-h3-autodl",
            kind: "multi-reference",
            minDuration: 1,
            maxDuration: 10,
        },
        autodl: {
            workflowId: "minimax_h3_lightx2v_v5",
            requestTemplate: {
                duration: "{{duration}}",
                prompt: "{{prompt}}",
                ref_image_0: "{{referenceImage0}}",
                ref_image_1: "{{referenceImage1}}",
                ref_image_2: "{{referenceImage2}}",
                ref_image_3: "{{referenceImage3}}",
                ref_image_4: "{{referenceImage4}}",
                ref_image_5: "{{referenceImage5}}",
                ref_image_6: "{{referenceImage6}}",
                ref_image_7: "{{referenceImage7}}",
                ref_image_8: "{{referenceImage8}}",
                resolution: "{{resolution}}",
            },
            durationMap: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10 },
            resolutionMap: {
                "480p|horizontal": "480p横",
                "480p|vertical": "480p竖",
                "480p|square": "480p(1:1)",
                "720p|horizontal": "768p横",
                "720p|vertical": "768p竖",
                "720p|square": "768p(1:1)",
                "1080p|horizontal": "1080p横",
                "1080p|vertical": "1080p竖",
                "1080p|square": "1080p(1:1)",
            },
            minReferenceImages: 1,
            maxReferenceImages: 9,
            minReferenceAudios: 0,
            maxReferenceAudios: 0,
        },
        seconds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        resolutions: ["480p", "768p", "1080p"],
    },
    null,
    2,
);

const capabilityOptions = [
    { label: "图像", value: "image" },
    { label: "视频", value: "video" },
    { label: "文本", value: "text" },
    { label: "音频", value: "audio" },
];

export default function AdminPage() {
    const { message } = App.useApp();
    const accessToken = useUserStore((state) => state.accessToken);
    const user = useUserStore((state) => state.user);
    const setSession = useUserStore((state) => state.setSession);
    const applyServerModels = useConfigStore((state) => state.applyServerModels);
    const [loginEmail, setLoginEmail] = useState("");
    const [sendingLogin, setSendingLogin] = useState(false);
    const [channels, setChannels] = useState<GatewayChannel[]>([]);
    const [models, setModels] = useState<GatewayModel[]>([]);
    const [usage, setUsage] = useState<GatewayUsage[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [channelModalOpen, setChannelModalOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<GatewayChannel | null>(null);
    const [modelModalOpen, setModelModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<GatewayModel | null>(null);
    const [channelForm] = Form.useForm<ChannelForm>();
    const [modelForm] = Form.useForm<ModelForm>();
    const selectedModelChannelId = Form.useWatch("channel_id", modelForm);
    const selectedModelChannel = channels.find((channel) => channel.id === selectedModelChannelId);
    const directoryStatus = adminDirectoryStatus(channels.length, models.length, loadError);

    const load = useCallback(async () => {
        if (!isGatewayConfigured) return;
        setLoading(true);
        setLoadError("");
        try {
            const [channelData, modelData, usageData] = await Promise.all([gatewayAdminApi.listChannels(), gatewayAdminApi.listModels(), gatewayAdminApi.listUsage()]);
            setChannels(channelData);
            setModels(modelData);
            setUsage(usageData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "加载后台数据失败";
            setLoadError(errorMessage);
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [message]);

    const syncPublishedModels = useCallback(async () => {
        try {
            await syncGatewayCatalog(fetchGatewayCatalog, applyServerModels);
        } catch (error) {
            message.warning(error instanceof Error ? `后台已保存，但模型目录同步失败：${error.message}` : "后台已保存，但模型目录同步失败，请刷新页面");
        }
    }, [applyServerModels, message]);

    useEffect(() => {
        void load();
    }, [load]);

    const sendLoginLink = async () => {
        if (!supabase || !loginEmail.trim()) {
            message.warning("请输入邮箱");
            return;
        }
        setSendingLogin(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({ email: loginEmail.trim() });
            if (error) throw error;
            message.success("登录链接已发送，请查收邮箱并点击链接完成登录");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "发送登录链接失败");
        } finally {
            setSendingLogin(false);
        }
    };

    const signOut = async () => {
        await supabase?.auth.signOut();
        setSession(null, "");
    };

    if (!isGatewayConfigured) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-16">
                <Empty description="管理后台需要先配置网关：在 web/.env 设置 VITE_GATEWAY_URL（本地模式），或 VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY + VITE_GATEWAY_URL（云模式），并启动 gateway 服务" />
            </main>
        );
    }

    if (isSupabaseConfigured && (!accessToken || !user)) {
        return (
            <main className="mx-auto max-w-md px-6 py-20">
                <div className="rounded-2xl border border-stone-200 p-8 dark:border-stone-800">
                    <h1 className="flex items-center gap-2 text-xl font-semibold">
                        <ShieldCheck className="size-5 text-cyan-600" />
                        登录管理后台
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        {isSupabaseConfigured ? "输入邮箱，我们会发送登录链接。只有管理员账号可以访问后台。" : "尚未配置 Supabase，请先设置环境变量。"}
                    </p>
                    {isSupabaseConfigured ? (
                        <div className="mt-6 space-y-3">
                            <Input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="you@example.com" onPressEnter={() => void sendLoginLink()} />
                            <Button type="primary" block loading={sendingLogin} onClick={() => void sendLoginLink()}>
                                发送登录链接
                            </Button>
                        </div>
                    ) : null}
                </div>
            </main>
        );
    }

    const openCreateChannel = () => {
        setEditingChannel(null);
        channelForm.setFieldsValue({ name: "", base_url: "", api_format: "openai", api_key: "", enabled: true });
        setChannelModalOpen(true);
    };

    const openEditChannel = (channel: GatewayChannel) => {
        setEditingChannel(channel);
        channelForm.setFieldsValue({ name: channel.name, base_url: channel.base_url, api_format: channel.api_format, api_key: "", enabled: channel.enabled });
        setChannelModalOpen(true);
    };

    const saveChannel = async () => {
        const values = await channelForm.validateFields();
        try {
            if (editingChannel) await gatewayAdminApi.updateChannel(editingChannel.id, values);
            else await gatewayAdminApi.createChannel(values);
            message.success(editingChannel ? "渠道已更新" : "渠道已创建");
            setChannelModalOpen(false);
            await load();
            await syncPublishedModels();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存渠道失败");
        }
    };

    const deleteChannel = async (channel: GatewayChannel) => {
        try {
            await gatewayAdminApi.deleteChannel(channel.id);
            message.success("渠道已删除");
            await load();
            await syncPublishedModels();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "删除渠道失败");
        }
    };

    const openCreateModel = () => {
        setEditingModel(null);
        modelForm.setFieldsValue({ channel_id: channels[0]?.id, model_name: "", display_name: "", capability: "image", api_format: channels[0]?.api_format || "openai", published: true, sort_order: 0, options: "{}" });
        setModelModalOpen(true);
    };

    const openEditModel = (model: GatewayModel) => {
        setEditingModel(model);
        modelForm.setFieldsValue({
            channel_id: model.channel_id,
            model_name: model.model_name,
            display_name: model.display_name,
            capability: model.capability,
            api_format: model.api_format,
            published: model.published,
            sort_order: model.sort_order,
            options: JSON.stringify(model.options || {}, null, 2),
        });
        setModelModalOpen(true);
    };

    const saveModel = async () => {
        const values = await modelForm.validateFields();
        let options: Record<string, unknown> = {};
        try {
            options = JSON.parse(values.options || "{}");
        } catch {
            message.error("模型选项必须是合法 JSON");
            return;
        }
        try {
            const input = { ...values, options };
            if (editingModel) await gatewayAdminApi.updateModel(editingModel.id, input);
            else await gatewayAdminApi.createModel(input);
            message.success(editingModel ? "模型已更新" : "模型已创建");
            setModelModalOpen(false);
            await load();
            await syncPublishedModels();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存模型失败");
        }
    };

    const deleteModel = async (model: GatewayModel) => {
        try {
            await gatewayAdminApi.deleteModel(model.id);
            message.success("模型已删除");
            await load();
            await syncPublishedModels();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "删除模型失败");
        }
    };

    return (
        <main className="mx-auto max-w-7xl px-6 py-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <ShieldCheck className="size-6 text-cyan-600" />
                        GouYingAi 管理后台
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">在这里维护固定模型和渠道，普通用户登录后直接使用，无需自行配置。</p>
                </div>
                <Button icon={<RefreshCw className="size-4" />} onClick={() => void load()} loading={loading}>
                    刷新
                </Button>
                <Button icon={<LogOut className="size-4" />} onClick={() => void signOut()}>
                    退出登录
                </Button>
            </div>

            {directoryStatus.errorMessage ? (
                <Alert
                    className="mb-6"
                    type="error"
                    showIcon
                    message="Gateway 未启动"
                    description={directoryStatus.errorMessage}
                    action={<Button size="small" onClick={() => void load()} loading={loading}>重试</Button>}
                />
            ) : null}

            <Tabs
                items={[
                    {
                        key: "channels",
                        label: `渠道（${directoryStatus.channelCount}）`,
                        children: (
                            <Space direction="vertical" size="middle" className="w-full">
                                <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreateChannel}>
                                    新增渠道
                                </Button>
                                <Table<GatewayChannel>
                                    rowKey="id"
                                    loading={loading}
                                    dataSource={channels}
                                    pagination={false}
                                    columns={[
                                        { title: "名称", dataIndex: "name" },
                                        { title: "Base URL", dataIndex: "base_url" },
                                        { title: "格式", dataIndex: "api_format", render: (value) => <Tag>{value}</Tag> },
                                        { title: "Key", dataIndex: "key_ciphertext", render: (value) => <span className="font-mono text-xs">{value || "未设置"}</span> },
                                        { title: "状态", dataIndex: "enabled", render: (value) => (value ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>) },
                                        {
                                            title: "操作",
                                            render: (_, record) => (
                                                <Space>
                                                    <Button size="small" onClick={() => openEditChannel(record)}>
                                                        编辑
                                                    </Button>
                                                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => void deleteChannel(record)} />
                                                </Space>
                                            ),
                                        },
                                    ]}
                                />
                            </Space>
                        ),
                    },
                    {
                        key: "models",
                        label: `模型（${directoryStatus.modelCount}）`,
                        children: (
                            <Space direction="vertical" size="middle" className="w-full">
                                <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreateModel} disabled={Boolean(loadError) || !channels.length}>
                                    新增模型
                                </Button>
                                {!loadError && !channels.length ? <div className="text-sm text-stone-500">请先创建至少一个渠道，再添加模型。</div> : null}
                                <Table<GatewayModel>
                                    rowKey="id"
                                    loading={loading}
                                    dataSource={models}
                                    pagination={false}
                                    columns={[
                                        { title: "展示名", dataIndex: "display_name" },
                                        { title: "模型名", dataIndex: "model_name", render: (value) => <span className="font-mono text-xs">{value}</span> },
                                        { title: "渠道", dataIndex: ["gouyingai_channels", "name"], render: (_, record) => record.gouyingai_channels?.name || record.channel_id },
                                        { title: "能力", dataIndex: "capability", render: (value) => <Tag>{capabilityOptions.find((item) => item.value === value)?.label || value}</Tag> },
                                        { title: "排序", dataIndex: "sort_order", width: 80 },
                                        { title: "状态", dataIndex: "published", render: (value) => (value ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>) },
                                        {
                                            title: "操作",
                                            render: (_, record) => (
                                                <Space>
                                                    <Button size="small" onClick={() => openEditModel(record)}>
                                                        编辑
                                                    </Button>
                                                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => void deleteModel(record)} />
                                                </Space>
                                            ),
                                        },
                                    ]}
                                />
                            </Space>
                        ),
                    },
                    {
                        key: "usage",
                        label: "用量",
                        children: (
                            <Table<GatewayUsage>
                                rowKey="id"
                                loading={loading}
                                dataSource={usage}
                                pagination={{ pageSize: 20 }}
                                columns={[
                                    { title: "用户", dataIndex: "user_id", render: (value) => <span className="font-mono text-xs">{value}</span> },
                                    { title: "能力", dataIndex: "capability" },
                                    { title: "状态", dataIndex: "status", render: (value) => <Tag color={value.startsWith("2") ? "green" : "red"}>{value}</Tag> },
                                    { title: "Tokens", dataIndex: "tokens" },
                                    { title: "时间", dataIndex: "created_at", render: (value) => new Date(value).toLocaleString() },
                                ]}
                            />
                        ),
                    },
                ]}
            />

            <Modal title={editingChannel ? "编辑渠道" : "新增渠道"} open={channelModalOpen} onOk={() => void saveChannel()} onCancel={() => setChannelModalOpen(false)} destroyOnClose>
                <Form form={channelForm} layout="vertical" className="pt-2">
                    <Form.Item name="name" label="渠道名称" rules={[{ required: true, message: "请输入渠道名称" }]}>
                        <Input placeholder="例如：主 OpenAI 渠道" />
                    </Form.Item>
                    <Form.Item name="base_url" label="Base URL" rules={[{ required: true, message: "请输入 Base URL" }]}>
                        <Input placeholder="https://api.example.com" />
                    </Form.Item>
                    <Form.Item name="api_format" label="调用格式" rules={[{ required: true }]}>
                        <Select options={apiFormatOptions} />
                    </Form.Item>
                    <Form.Item name="api_key" label={editingChannel ? "API Key（留空则保持不变）" : "API Key"} rules={editingChannel ? [] : [{ required: true, message: "请输入 API Key" }]}>
                        <Input.Password placeholder="sk-..." autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item name="enabled" label="启用" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal title={editingModel ? "编辑模型" : "新增模型"} open={modelModalOpen} onOk={() => void saveModel()} onCancel={() => setModelModalOpen(false)} destroyOnClose>
                <Form form={modelForm} layout="vertical" className="pt-2">
                    <Form.Item name="channel_id" label="所属渠道" rules={[{ required: true, message: "请选择渠道" }]}>
                        <Select
                            options={channels.map((channel) => ({ label: `${channel.name}（${channel.base_url}）`, value: channel.id }))}
                            onChange={(channelId) => {
                                const channel = channels.find((item) => item.id === channelId);
                                if (channel) modelForm.setFieldValue("api_format", channel.api_format);
                            }}
                        />
                    </Form.Item>
                    <Form.Item name="display_name" label="展示名称" rules={[{ required: true, message: "请输入展示名称" }]}>
                        <Input placeholder="例如：Gemini 3 Flash" />
                    </Form.Item>
                    <Form.Item name="model_name" label="模型名（接口实际名称）" rules={[{ required: true, message: "请输入模型名" }]}>
                        <Input placeholder="例如：gemini-3-flash" />
                    </Form.Item>
                    <Form.Item name="capability" label="能力" rules={[{ required: true }]}>
                        <Select options={capabilityOptions} />
                    </Form.Item>
                    <Form.Item name="api_format" label="调用格式" rules={[{ required: true }]}>
                        <Select options={apiFormatOptions} />
                    </Form.Item>
                    <Form.Item name="sort_order" label="排序（越小越靠前）">
                        <Input type="number" />
                    </Form.Item>
                    <Form.Item
                        name="options"
                        label="模型选项（JSON）"
                        extra={selectedModelChannel?.api_format === "autodl_comfyui" ? `MiniMax H3 配置示例。canvasVideoRoute 负责画布自动选型，autodl 负责真实工作流参数；自动入口只配置 canvasVideoRoute，不配置 autodl：${autoDlOptionsHint}` : '可选：比例、时长、分辨率等限制，例如 {"seconds":[6,10]}'}
                    >
                        <Input.TextArea rows={4} />
                    </Form.Item>
                    <Form.Item name="published" label="发布" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </main>
    );
}
