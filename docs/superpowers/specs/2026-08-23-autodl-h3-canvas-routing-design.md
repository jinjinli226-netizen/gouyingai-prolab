# AutoDL MiniMax H3 画布自动路由设计

## 目标

把 AutoDL 当前公开的 7 个 MiniMax H3 视频工作流统一接入 GouYingAI。无限画布保留手动选择具体模型的能力，并新增一个由管理后台发布的“H3 自动选择”模型：当节点选择该模型时，前端根据已连接素材、工作模式和时长解析出唯一的具体工作流，再提交一次视频生成任务。

## 工作流范围

| 输入能力 | 1–10 秒 | 11–15 秒 |
| --- | --- | --- |
| 纯提示词 | `minimax_h3_lightx2v_no_pic` | `minimax_h3_lightx2v_no_pic` |
| 1–9 张普通参考图 | `minimax_h3_lightx2v_v5` | `minimax_h3_lightx2v_v5_15s` |
| 明确的首帧和尾帧 | `minimax_h3_lightx2v` | `minimax_h3_lightx2v` |
| 1–9 张图片和 1–3 段音频 | `minimax_h3_image_audio_to_video_v2` | `minimax_h3_image_audio_to_video_v2_15s` |
| 单人物图和单段音频口型同步 | `minimax_h3_image_audio_to_video` | `minimax_h3_image_audio_to_video` |

`indextts2-v1` 是音频生成工作流，不进入 H3 视频路由。

## 画布交互

- 视频模型列表增加 `MiniMax H3 自动选择`，并作为 AutoDL H3 推荐入口。
- 视频设置增加“素材方式”：`自动识别`、`首尾帧`、`口型同步`。
- `自动识别`：无素材走文生视频；只有图片走多图参考；图片和音频同时存在走多图多音频。
- `首尾帧`：必须恰好连接两张图片，按画布解析后的输入顺序作为首帧、尾帧。
- `口型同步`：必须恰好连接一张图片和一段音频。
- 连接参考视频时 H3 路由直接报错；素材缺失、数量超限、时长或分辨率不支持时在付费提交前报错。
- 自动解析成功后，输出视频节点保存具体模型名，不保存伪路由模型；用户可从节点信息中确认实际工作流。
- 用户手动选择具体 H3 工作流时不自动改绑，只按该模型自己的能力严格校验。

## 配置与路由元数据

管理后台仍是唯一模型来源。每个具体模型的 `options` 同时保存：

- `autodl.workflowId`、`requestTemplate`、时长/分辨率映射、图片/音频数量约束；
- `canvasVideoRoute.family = "minimax-h3-autodl"`；
- `canvasVideoRoute.kind`：`text`、`multi-reference`、`first-last`、`multi-reference-audio` 或 `lip-sync`；
- `canvasVideoRoute.minDuration` / `maxDuration`。

自动入口保存 `canvasVideoRoute.kind = "auto"`，不配置真实工作流。前端同步网关目录时保留 `options`，路由器仅在选择该入口时从同一目录查找严格匹配的具体模型。若目录缺失或出现同等优先级歧义，直接报错。

## 网关请求适配

统一 `/v1/videos` multipart 契约扩展如下：

- 图片继续使用 `reference_images`；
- 音频使用 `reference_audios`；
- `size` 与 `resolution_name` 一起决定 AutoDL 的横屏、竖屏或方形枚举；
- 首尾帧仍由两张图片传入，再由目标模型的模板映射为 `first_frame` / `last_frame`；
- 多图多音频模板映射为 `ref_image_0..8` / `ref_audio_0..2`；
- 口型同步模型允许空提示词，并把时长映射为 `audio_duration`。

网关继续使用原始 AutoDL Token 鉴权、内部 `gt-*` 任务号、异步轮询和短效结果代理。路由选择只发生在前端提交前；网关仍按收到的具体模型严格执行，不做回退。

## 失败边界

- 普通两张参考图不会被猜成首尾帧；必须显式选择“首尾帧”。
- 一张人物图加一段背景音乐不会被猜成口型同步；必须显式选择“口型同步”。
- 11–15 秒只选择带 15 秒能力的工作流；不会把多个短任务拼成一个视频。
- 不支持的 1080p、方形、素材数量或素材类型在请求 AutoDL 前失败。
- 每次点击生成只创建一个付费任务和一个输出视频节点。

