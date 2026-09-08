# GouYingAi 项目与系统接入说明

这份文档用于把当前 GouYingAi 交给其他系统、开发团队或 AI 编程工具继续接入。内容以当前源码为准，不以仍保留旧 ProLab 文案的历史 README 为准。

## 1. 项目定位

GouYingAi 是在 ProLab / Infinite Canvas 基础上定制的 AI 内容生产工作台，当前包含：

- 通用生图、图生图、视频、音频和文本生成。
- 无限画布、素材库、提示词库和本地 Codex 画布助手。
- AI 批量带货系统：AI 硬广、AI 视觉种草、AI 剧情带货、AI 痛点对比、AI 混剪解说。
- 国内项目宣传海报工作流。
- AI 珠宝商品图工作流。
- 管理后台统一维护 AI 渠道、API Key、模型能力、发布状态和排序。

项目的三个主要运行组件：

| 组件 | 默认地址 | 用途 |
| --- | --- | --- |
| Web 前端 | `http://localhost:3000` | 用户界面、独立画布项目和任务状态展示 |
| GouYingAi Gateway | `http://127.0.0.1:8788` | 模型路由、API Key、持久生成队列、Worker 和私有任务素材 |
| Canvas Agent | `http://127.0.0.1:17371` | 让 Codex / Claude Code 通过 MCP 读取和修改浏览器画布 |

当前开发机的局域网 Web 地址为 `http://192.168.31.135:3000`。局域网 IP 可能变化；Gateway 和 Canvas Agent 默认只监听 `127.0.0.1`，其他机器不能直接访问这两个端口。

## 2. 总体架构

```text
用户或外部系统
├─ 打开 Web 页面（3000）
│  ├─ 每个画布结构独立保存在当前浏览器 IndexedDB
│  └─ 上传任务素材并把生成任务提交到 GouYingAi Gateway（8788）
├─ 直接调用 Gateway REST API（8788）
│  └─ Gateway 持久排队，按固定模型/渠道绑定调用上游并保存状态与结果补丁
└─ 通过 MCP 连接 Canvas Agent（17371）
   └─ 浏览器确认后读取或修改当前画布
```

接入时必须区分两类数据：

- AI 渠道、API Key、模型目录：由 Gateway 和管理后台统一管理。
- 画布节点与布局：每个项目独立保存在浏览器 IndexedDB；可继续使用现有云同步。
- 生成任务与后台参考素材：由 Gateway 持久保存。刷新、切换画布或关闭浏览器不会取消已接受的任务。

## 3. 源码目录

| 目录 | 说明 |
| --- | --- |
| `web/` | Vite + React 19 前端 |
| `gateway/` | Node.js + Express 模型网关 |
| `canvas-agent/` | 本地 Canvas Agent 和 MCP 服务 |
| `supabase/supabase/migrations/` | 云端模式所需 Supabase 表结构 |
| `docs/` | 项目文档 |

运行要求：Node.js 20 或更高版本。

## 4. 本地启动

### 4.1 配置 Gateway

复制 `gateway/.env.example` 为 `gateway/.env`。本地模式最小配置：

```dotenv
PORT=8788
GATEWAY_LOCAL_MODE=1
GATEWAY_DATA_FILE=./data/local-store.json
GATEWAY_ENCRYPTION_KEY=<64位十六进制字符串>
GATEWAY_HOST=127.0.0.1
CANVAS_JOB_CONCURRENCY_GLOBAL=4
CANVAS_JOB_CONCURRENCY_IMAGE=2
CANVAS_JOB_CONCURRENCY_VIDEO=2
CANVAS_JOB_CHANNEL_LIMITS={"channel-id":1}
```

`GATEWAY_ENCRYPTION_KEY` 是 32 字节密钥的十六进制表示，用于加密渠道 API Key。不要把真实密钥提交到仓库，也不要在更换密钥后继续使用旧的加密数据文件。

前端可以连续提交任意数量的画布任务，以上 Gateway 配置只决定同时执行数，其余任务保持 `queued`。生产模式还必须设置逗号分隔的 `GATEWAY_ALLOWED_ORIGINS`；本地模式自动允许 loopback 来源。

生产模式必须提供 `SUPABASE_SERVICE_ROLE_KEY`，因为任务领取、租约心跳和私有对象存储只能由 Gateway Worker 写入。生产默认监听 `0.0.0.0` 以便容器/反向代理接入；本地默认只监听 `127.0.0.1`。

可使用以下任一方式生成密钥：

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

```bash
openssl rand -hex 32
```

启动 Gateway：

```bash
cd gateway
npm install
npm run dev
```

健康检查：

```bash
curl http://127.0.0.1:8788/health
```

本地模式正常返回：

```json
{"ok":true,"mode":"local"}
```

### 4.2 配置 Web

复制 `web/.env.example` 为 `web/.env`，本地模式至少配置：

```dotenv
VITE_GATEWAY_URL=http://127.0.0.1:8788
```

启动 Web：

```bash
cd web
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

### 4.3 停止

在启动 Web、Gateway 或 Canvas Agent 的终端中按 `Ctrl+C`。不要同时启动默认 `docker-compose.yml`，因为它拉取的是上游 ProLab 镜像，会和本地 GouYingAi 抢占 `3000` 端口。

## 5. 管理后台配置

打开：

```text
http://localhost:3000/admin
```

配置顺序：

1. 新增渠道，填写渠道名称、调用格式、Base URL、API Key，并启用渠道。
2. 给渠道新增或拉取模型。
3. 为每个模型指定唯一能力：`image`、`video`、`text` 或 `audio`。
4. 设置展示名称、发布状态和排序。
5. 前端刷新后自动从 Gateway 读取已启用、已发布的模型。

渠道结构：

```ts
type Channel = {
  id: string;
  name: string;
  base_url: string;
  api_format: "openai" | "gemini" | "autodl_comfyui";
  key_ciphertext: string;
  enabled: boolean;
};
```

模型结构：

```ts
type Model = {
  id: string;
  channel_id: string;
  model_name: string;
  display_name: string;
  capability: "image" | "video" | "text" | "audio";
  api_format: "openai" | "gemini" | "autodl_comfyui";
  published: boolean;
  sort_order: number;
  options: Record<string, unknown>;
};
```

重要规则：

- 一个公开的 `model_name` 只能对应一个已发布模型。同名模型出现多次时，Gateway 会把该名称排除，避免路由歧义。
- 模型能力必须和请求头完全一致，禁止跨能力调用或自动回退。
- 渠道被禁用、模型未发布或模型名失效时直接报错。
- OpenAI/Gemini 上游 Base URL 若不以 `/v1`、`/api/v3` 或 `/api/plan/v3` 结尾，Gateway 会自动补 `/v1`；`autodl_comfyui` 使用工作流专用路径，不做 OpenAI `/v1` 补全。
- API Key 只在 Gateway 中加密保存；目录接口和前端不会得到真实 Key。

## 6. 外部系统接入方式

### 6.1 方式 A：调用 Gateway REST API

这是生成图片、视频、文本和音频的推荐方式。外部系统只需要知道 Gateway 地址和公开模型名，不需要持有各上游渠道的 API Key。

本地模式不要求客户端登录，但仅应在同一台受信任电脑上使用。云端模式的 `/v1/models`、`/v1/*` 和管理接口都需要：

```http
Authorization: Bearer <Supabase access token>
```

所有生成请求还必须带能力声明：

```http
X-GouYingAi-Capability: image|video|text|audio
```

HTTP Header 不区分大小写。下面统一使用小写 `x-gouyingai-capability`。

#### 查询公开模型

```bash
curl "http://127.0.0.1:8788/v1/models?capability=image"
```

返回结构：

```json
{
  "data": [
    {
      "id": "gpt-image-2",
      "modelName": "gpt-image-2",
      "displayName": "GPT Image 2",
      "capability": "image",
      "options": {},
      "channelName": "渠道名称",
      "channelBaseUrl": "https://provider.example.com/v1"
    }
  ]
}
```

`capability` 可选值为 `image`、`video`、`text`、`audio`。不传时返回全部公开模型。

#### 文本生成

```bash
curl -X POST "http://127.0.0.1:8788/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "x-gouyingai-capability: text" \
  -d '{
    "model": "gemini-3.6-flash",
    "messages": [
      {"role": "user", "content": "为这个商品写一条15秒英文带货脚本"}
    ]
  }'
```

#### 文生图

```bash
curl -X POST "http://127.0.0.1:8788/v1/images/generations" \
  -H "Content-Type: application/json" \
  -H "x-gouyingai-capability: image" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "A premium ecommerce product photo on a clean studio background",
    "n": 1,
    "size": "1024x1024"
  }'
```

#### 图生图 / 图片编辑

单张参考图使用字段 `image`，多张参考图使用重复的 `image[]` 字段：

```bash
curl -X POST "http://127.0.0.1:8788/v1/images/edits" \
  -H "x-gouyingai-capability: image" \
  -F "model=gpt-image-2" \
  -F "prompt=Keep the product structure unchanged and replace only the background" \
  -F "image=@product.png" \
  -F "n=1"
```

模型被声明为 `image` 只代表路由能力正确，不代表上游一定实现 `/v1/images/edits`。需要图生图的模型必须由上游实际支持该端点和 multipart 字段。

#### 音频生成

```bash
curl -X POST "http://127.0.0.1:8788/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "x-gouyingai-capability: audio" \
  -d '{
    "model": "your-tts-model",
    "input": "This is a product introduction.",
    "voice": "alloy",
    "response_format": "mp3",
    "speed": 1
  }' \
  --output speech.mp3
```

#### 视频生成与轮询

标准 OpenAI Video 兼容入口：

```bash
curl -X POST "http://127.0.0.1:8788/v1/videos" \
  -H "Content-Type: application/json" \
  -H "x-gouyingai-capability: video" \
  -d '{
    "model": "your-video-model",
    "prompt": "A 15-second vertical ecommerce video"
  }'
```

当前 Gateway 的标准异步视频契约期望上游创建响应包含 `task_id`。Gateway 会将其替换成 `gt-...` 的内部任务 ID，外部系统必须保存并使用返回的 ID：

```bash
curl "http://127.0.0.1:8788/v1/videos/<返回的task_id>"
curl "http://127.0.0.1:8788/v1/videos/<返回的task_id>/content" --output result.mp4
```

部分 Seedance / New-API 渠道使用 `/v1/video/generations`，部分供应商使用 `/api/v3` 或 `/api/plan/v3`。这些差异由前端适配器处理；外部系统若绕过前端，需要按所选供应商协议提交参数，Gateway 只负责鉴权替换、严格路由和原样转发，不会统一所有供应商的请求体或响应体。

##### AutoDL ComfyUI 视频工作流

AutoDL 作为独立的 `autodl_comfyui` 渠道格式接入。浏览器仍提交统一的 `/v1/videos` multipart 请求，Gateway 根据模型 `options.autodl` 转换成对应工作流的 JSON Request Body，再调用：

```text
POST <base_url>/comfyui_workflow/<workflowId>
GET  <base_url>/comfyui_workflow/result/<upstream_task_id>
```

渠道 Base URL 为 `https://autodl.art/api/v1/comfyui`。AutoDL Token 只在管理后台录入并由 Gateway 加密保存；上游鉴权使用 AutoDL 要求的原始 `Authorization` 值，不能放进前端环境变量、模型 `options` 或源码。

画布公开 1 个自动入口和 7 个真实工作流模型。自动入口只负责在浏览器端读取节点素材并选出真实模型，绝不会直接提交到 AutoDL：

| 画布输入 | 1–10 秒 | 11–15 秒 | 说明 |
| --- | --- | --- | --- |
| 只有提示词 | `minimax_h3_lightx2v_no_pic` | 同左 | 文生视频 |
| 1–9 张图片 | `minimax_h3_lightx2v_v5` | `minimax_h3_lightx2v_v5_15s` | 普通两图仍按多图参考处理 |
| 明确选择首尾帧，恰好两图 | `minimax_h3_lightx2v` | 同左 | 不根据“两张图”自动猜测 |
| 1–9 张图片 + 1–3 段音频 | `minimax_h3_image_audio_to_video_v2` | `minimax_h3_image_audio_to_video_v2_15s` | 默认的图音频工作流 |
| 明确选择口型同步，一图一音频 | `minimax_h3_image_audio_to_video` | 同左 | 不根据“一图一音频”自动猜测 |

参考视频节点不属于这些 H3 工作流，提交前会直接拒绝。所有路由严格依赖管理后台发布的 `options.canvasVideoRoute`，没有匹配项、重复配置、素材数量超限、时长或分辨率不支持时都会在产生付费任务前报错，不会降级或回退到其他模型。

真实工作流模型配置示意：

```json
{
  "canvasVideoRoute": {
    "family": "minimax-h3-autodl",
    "kind": "multi-reference",
    "minDuration": 1,
    "maxDuration": 10
  },
  "autodl": {
    "workflowId": "minimax_h3_lightx2v_v5",
    "requestTemplate": {
      "duration": "{{duration}}",
      "prompt": "{{prompt}}",
      "ref_image_0": "{{referenceImage0}}",
      "ref_image_1": "{{referenceImage1}}",
      "ref_image_2": "{{referenceImage2}}",
      "ref_image_3": "{{referenceImage3}}",
      "ref_image_4": "{{referenceImage4}}",
      "ref_image_5": "{{referenceImage5}}",
      "ref_image_6": "{{referenceImage6}}",
      "ref_image_7": "{{referenceImage7}}",
      "ref_image_8": "{{referenceImage8}}",
      "resolution": "{{resolution}}"
    },
    "durationMap": { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10 },
    "resolutionMap": {
      "480p|horizontal": "480p横",
      "480p|vertical": "480p竖",
      "480p|square": "480p(1:1)",
      "720p|horizontal": "768p横",
      "720p|vertical": "768p竖",
      "720p|square": "768p(1:1)",
      "1080p|horizontal": "1080p横",
      "1080p|vertical": "1080p竖",
      "1080p|square": "1080p(1:1)"
    },
    "minReferenceImages": 1,
    "maxReferenceImages": 9,
    "minReferenceAudios": 0,
    "maxReferenceAudios": 0
  }
}
```

`requestTemplate` 可使用 `{{referenceImage0}}` 至 `{{referenceImage8}}`、`{{referenceAudio0}}` 至 `{{referenceAudio2}}`、`{{prompt}}`、`{{duration}}` 和 `{{resolution}}`。未提供的可选媒体字段会被省略。`resolutionMap` 支持 `horizontal`、`vertical`、`square` 三种画布方向，不依赖固定像素尺寸。`seed` 默认不发送，由上游随机生成，避免固定种子造成重复结果。

自动入口公开名为 `minimax-h3-autodl-auto`，只配置 `canvasVideoRoute.kind = "auto"`；真实请求保存并显示路由后的具体模型名。无需参考图时使用 `minimax-h3-autodl-no-pic`，并把图片、音频上下限都设为 `0`。带音频工作流通过统一 multipart 字段 `reference_audios` 接收 URL 或 Base64，Gateway 再转换为各工作流要求的 `ref_audio_*` 字段。

Gateway 把 AutoDL 状态转换为现有视频状态，并只向客户端返回内部 `gt-*` 任务号。`SUCCESS` 后不直接依赖有效期较短的结果 URL：客户端请求 `/v1/videos/<gt-id>/content`，Gateway 重新查询结果并代理视频字节，现有素材存储随后立即保存。成功但没有视频资源会作为失败返回，页面刷新或 Gateway 重启后仍可使用持久化任务映射继续查询。

### 6.2 方式 B：通过 Canvas Agent / MCP 操作画布

如果其他系统需要创建节点、读取选择、导出画布或搭建提示词流程，应接 Canvas Agent，而不是直接读取浏览器 IndexedDB。

启动发布版 Agent：

```bash
npx -y @proapi-hub/canvas-agent
```

当前 npm 包名仍保留上游兼容名称 `@proapi-hub/canvas-agent`，不是接错项目。启动后会输出本机 URL 和连接 token。在画布的 Agent 设置中填写这两个值。

注册为 Codex MCP：

```bash
codex mcp add prolab -- npx -y @proapi-hub/canvas-agent mcp
```

仓库源码运行方式：

```bash
cd canvas-agent
npm install
npm run build
node dist/index.js
```

可用 MCP 工具：

| 工具 | 作用 |
| --- | --- |
| `canvas_get_state` | 获取当前画布状态 |
| `canvas_get_selection` | 获取当前选中节点 |
| `canvas_export_snapshot` | 导出画布快照 |
| `canvas_apply_ops` | 批量新增、更新、删除节点或连线 |
| `canvas_create_text_node` | 创建文本节点 |
| `canvas_create_image_prompt_flow` | 创建生图提示词流程 |

写操作最终仍需网页端确认。Agent 默认只监听 `127.0.0.1`，并会绑定第一个使用正确 token 连接的网页 Origin。

### 6.3 方式 C：页面跳转或嵌入

可以直接打开具体工作台：

| 路由 | 页面 |
| --- | --- |
| `/` | 首页 |
| `/image` | 生图工作台 |
| `/video` | 视频创作台 |
| `/ecommerce` | AI 批量带货系统和项目宣传海报入口 |
| `/jewelry` | AI 珠宝商品图 |
| `/assets` | 我的素材 |
| `/prompts` | 提示词库 |
| `/canvas` | 画布列表 |
| `/canvas/:id` | 指定画布 |
| `/config` | 生成偏好、WebDAV、Codex 配置 |
| `/admin` | 渠道和模型管理后台 |

旧 `/poster` 会跳转到 `/ecommerce`。

页面嵌入只解决 UI 入口，不等于服务端数据集成。若嵌入页面运行在另一台设备，页面中的 `127.0.0.1:8788` 指向的是那台设备自己，必须把 `VITE_GATEWAY_URL` 改成可达且受保护的 Gateway 地址。

## 7. 画布后台任务 API

浏览器先通过 `POST /v1/canvas-artifacts` 上传参考素材，再通过 `POST /v1/canvas-jobs` 创建持久任务。任务输入必须包含 `canvasId`、目标 `nodeId`、递增的 `generationRevision`、幂等 `clientRequestId`、能力类型和固定的模型/渠道绑定。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/v1/canvas-jobs` | 创建或按 `clientRequestId` 返回同一任务 |
| `GET` | `/v1/canvas-jobs?canvasId=...` | 查询一个画布的任务 |
| `GET` | `/v1/canvas-jobs/:id` | 查询单个任务 |
| `POST` | `/v1/canvas-jobs/:id/cancel` | 取消排队或请求停止运行中任务 |
| `POST` | `/v1/canvas-jobs/:id/retry` | 以新修订号重新提交 |

任务状态依次为 `queued → leased → submitting/running → succeeded/failed`，取消使用 `cancel_requested/cancelled`。节点结果补丁同时携带 `canvasId/nodeId/jobId/generationRevision`，客户端全部匹配才写入。

调度相关环境变量包括 `CANVAS_JOB_CONCURRENCY_GLOBAL`、各能力的 `CANVAS_JOB_CONCURRENCY_*`、JSON 格式的 `CANVAS_JOB_CHANNEL_LIMITS`、租约、心跳、轮询和领取批量配置。前端不实施并发限制。

## 8. Gateway 管理 API

本地模式的管理 API 默认无登录校验，因此只能在回环地址使用。云端模式要求 Supabase 登录，并且用户 ID 必须存在于 `gouyingai_admins`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/channels` | 渠道列表，API Key 只返回掩码 |
| `POST` | `/admin/channels` | 新建渠道 |
| `PATCH` | `/admin/channels/:id` | 更新渠道 |
| `DELETE` | `/admin/channels/:id` | 删除渠道及其模型 |
| `GET` | `/admin/models` | 模型列表 |
| `POST` | `/admin/models` | 新建模型 |
| `PATCH` | `/admin/models/:id` | 更新模型 |
| `DELETE` | `/admin/models/:id` | 删除模型 |
| `GET` | `/admin/usage?limit=200` | 最近使用记录，最大 500 条 |

新建渠道请求：

```json
{
  "name": "供应商渠道",
  "base_url": "https://provider.example.com/v1",
  "api_format": "openai",
  "api_key": "<真实API Key>",
  "enabled": true
}
```

新建模型请求：

```json
{
  "channel_id": "<渠道ID>",
  "model_name": "gpt-image-2",
  "display_name": "GPT Image 2",
  "capability": "image",
  "api_format": "openai",
  "published": true,
  "sort_order": 0,
  "options": {}
}
```

普通成功响应通常是 `{"data": ...}`，删除响应为 `{"ok": true}`，Gateway 自身错误为 `{"error": "错误说明"}`。生成接口的成功响应通常按上游协议原样返回。

## 9. 错误处理

| HTTP 状态 | 常见原因 |
| --- | --- |
| `400` | 请求体缺少 `model` / `model_name`，或缺少有效能力请求头 |
| `401` | 云端模式未登录或 access token 无效 |
| `403` | 用户不是 GouYingAi 管理员 |
| `404` | 模型未发布、不存在，或视频任务不存在 |
| `409` | 模型声明能力和请求能力不一致 |
| `502` | 渠道被禁用、渠道不可用或上游连接失败 |

外部系统不应在这些错误后自动换成另一个模型或另一种能力。应把明确错误展示给调用方，修正管理后台配置后重试。

## 10. 数据保存和迁移边界

浏览器本地使用 `localForage` / IndexedDB，数据库名为 `gouyingai`：

| 数据 | storeName / key |
| --- | --- |
| 画布项目 JSON | `app_state` / `gouyingai:canvas_store` |
| 我的素材 JSON | `app_state` / `gouyingai:asset_store` |
| 图片 Blob | `image_files` |
| 视频、音频等 Blob | `media_files` |

节点 JSON 中的 `blob:` URL 只能在当前浏览器会话使用，长期引用依赖 `storageKey`。其他系统不能把 `blob:` URL 当成可远程访问的文件地址。

当前可行的交换方式：

- 使用画布导出 / 导入。
- 使用 WebDAV 同步画布、素材和生成记录。
- 使用 Canvas Agent 导出快照或执行节点操作。
- 若需要真正的多用户服务端项目库，需要另行实现后端存储 API；当前 Gateway 不提供通用画布 CRUD REST 接口。

WebDAV 不同步 AI API Key。

## 11. 云端 Gateway 模式

删除或关闭 `GATEWAY_LOCAL_MODE=1`，并配置：

```dotenv
PORT=8788
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
GATEWAY_ENCRYPTION_KEY=<64位十六进制字符串>
```

Web 配置：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_GATEWAY_URL=https://your-gateway.example.com
```

`VITE_*` 是前端构建时变量；生产地址变化后需要重新构建前端，不能只修改已经生成的静态文件旁边的 `.env`。

数据库迁移文件：

- `supabase/supabase/migrations/0001_gouyingai_cloud_sync.sql`
- `supabase/supabase/migrations/0002_gouyingai_model_gateway.sql`

第二个迁移会建立 `gouyingai_admins`、`gouyingai_channels`、`gouyingai_models`、`gouyingai_usage` 和 `gouyingai_gateway_tasks`。首次管理员需要由有权限的数据库操作者写入 `gouyingai_admins`。

注意：源码中的云端表结构不代表前端画布已经自动改为云存储。当前画布数据边界仍以第 9 节为准。

## 12. Docker 注意事项

仓库内有两套 Compose 文件：

- `docker-compose.yml` 使用 `ghcr.io/proapi-hub/prolab:latest`，这是上游 ProLab 镜像，不包含当前本地 GouYingAi 定制源码。
- `docker-compose.local.yml` 从当前目录的 `Dockerfile` 构建本地镜像，才适合验证定制前端。

本地定制版使用：

```bash
docker compose -f docker-compose.local.yml up -d --build
```

当前 Docker 静态资源路径和完整生产部署仍需人工验证，不应把本地 Compose 直接视为已完成生产验收的部署方案。Gateway 也需要单独部署和保护。

## 13. 安全要求

- 永远不要把 `SUPABASE_SERVICE_ROLE_KEY`、真实渠道 API Key 或 `GATEWAY_ENCRYPTION_KEY` 放到前端环境变量。
- 本地模式的 `/admin/*` 没有身份验证；不要直接把 `8788` 暴露到局域网或公网。
- 远程接入优先使用云端模式；至少也要在 Gateway 前放置带 TLS、鉴权和访问控制的反向代理。
- Canvas Agent token 只发给受信任页面，不公开转发 `17371`。
- 外部系统记录请求日志时不要保存渠道 API Key、Supabase service role key 或完整用户敏感素材。
- API Key 密文依赖同一份 `GATEWAY_ENCRYPTION_KEY`；备份本地数据时应分开、安全地备份该密钥。

## 14. 交接验收清单

交给另一个系统后，按以下顺序检查：

1. `GET /health` 返回正常。
2. `GET /v1/models` 能看到已发布模型。
3. 每个公开 `model_name` 全局唯一，且能力分类正确。
4. 文本、图片、视频、音频请求都带正确的 `x-gouyingai-capability`。
5. 上游确实支持所调用端点，尤其是 `/images/edits` 和异步 `/videos`。
6. 视频系统保存 Gateway 返回的任务 ID，不使用上游原始任务 ID。
7. 远程部署时，浏览器和外部系统都能访问 `VITE_GATEWAY_URL`，且管理 API 已受保护。
8. 不把浏览器 `blob:` URL 或 IndexedDB key 当成公网素材 URL。
9. 需要自动化画布时使用 Canvas Agent / MCP，并处理网页确认流程。
10. 需要跨设备项目库时，先设计独立后端存储，不假设 Gateway 已提供画布 CRUD。

## 15. 授权和来源

本项目保留上游 AGPL-3.0 授权及相关来源声明。对外部署、修改和分发时，应继续遵守仓库 `LICENSE`、`CLA.md` 和上游版权要求。
