# AutoDL ComfyUI 视频适配器设计

日期：2026-08-21

## 目标

为 GouYingAI 的现有视频生成链路增加 AutoDL ComfyUI 渠道。首个工作流为 MiniMax H3 多图参考生视频 `minimax_h3_lightx2v_v5`，优先服务爆款复刻中的人物、商品和场景一致性；适配层同时支持后续通过配置增加文生视频、首尾帧、图生视频加音频等工作流。

## 已确认选择

- 采用网关原生适配器，不在浏览器中直连 AutoDL。
- 管理后台把 AutoDL ComfyUI 作为独立调用格式；Token 沿用现有渠道加密存储，不进入前端源码、日志或仓库。
- 首个接入工作流是 `minimax_h3_lightx2v_v5`。
- 前端继续使用统一的视频任务提交和查询接口，不让画布理解 AutoDL 的任务协议。
- AutoDL 返回的结果地址有效期短，成功后必须立即通过网关读取并保存，不能只把临时 URL 留在节点中。

## 总体结构

```text
无限画布 / 视频创作台
        │ POST /v1/videos
        ▼
GouYingAI Gateway
        │ 读取渠道格式、模型 options 和 workflow_id
        │ 转换提示词、参考图、时长、分辨率
        ▼
AutoDL ComfyUI 提交任务
        │ task_id
        ▼
Gateway 任务表
        │ GET /v1/videos/:local_task_id
        ▼
AutoDL ComfyUI 查询任务
        │ SUCCESS + 临时 results URL
        ▼
Gateway 内容代理 / 前端素材库即时落盘
```

## 渠道与模型配置

渠道新增调用格式 `autodl_comfyui`：

- `base_url`: `https://autodl.art/api/v1/comfyui`
- `api_key`: AutoDL ComfyUI Token，由网关加密保存
- 请求鉴权使用 AutoDL 要求的原始 `Authorization` 值，不自动添加 `Bearer `

模型仍使用现有模型目录，每个 AutoDL 工作流注册成一个视频模型。工作流差异放入 `options.autodl`，避免把特定 H3 参数写死在通用网关代码中：

```json
{
  "autodl": {
    "workflowId": "minimax_h3_lightx2v_v5",
    "requestTemplate": {
      "duration": "{{duration}}",
      "prompt": "{{prompt}}",
      "ref_image_0": "{{referenceImage0}}",
      "ref_image_1": "{{referenceImage1}}",
      "resolution": "{{resolution}}"
    },
    "minReferenceImages": 1,
    "maxReferenceImages": 9
  },
  "seconds": [],
  "resolutions": []
}
```

`requestTemplate` 已按工作流“在线调用 API”确认：参考图使用 `ref_image_0` 至 `ref_image_8`，未提供的可选字段自动省略。精确占位符替换保留数组、数字和布尔值类型，不能全部转成字符串。

## 请求转换

1. 前端继续提交统一字段：模型、提示词、时长、尺寸/分辨率和参考图片。
2. Gateway 根据模型找到 AutoDL 工作流 ID 和请求模板。
3. Gateway 对输入做前置校验：提示词非空、参考图数量限制、时长和分辨率属于模型允许值。
4. Gateway 用实际输入解析模板，生成 AutoDL JSON Request Body。
5. 提交地址为 `/comfyui_workflow/{workflow_id}`，解析 `data.task_id`。
6. 对浏览器上传的参考图，必须按工作流真实输入契约转换为 URL、Base64 或文件引用；在未确认真实 Request Body 前不猜测图片字段和编码方式。

## 任务轮询与统一状态

Gateway 为上游任务创建自己的 `gt-*` 本地任务 ID，并记录渠道、模型、上游 task ID 和适配器类型。查询时调用 `/comfyui_workflow/result/{task_id}`，统一映射：

- `QUEUED` → `queued`
- `RUNNING` → `in_progress`
- `SUCCESS` → `completed`
- `FAILED` → `failed`

当状态成功但 `results` 中没有可识别的视频资源时，返回明确错误“任务成功但没有返回视频文件”，不能把空结果视为成功。

## 结果保存与找回

- Gateway 从 `results` 中识别视频 URL 和 MIME 类型，并提供现有 `/v1/videos/:id/content` 内容代理。
- 内容代理从 AutoDL 临时地址读取视频并流式返回，浏览器随后使用现有 `storeGeneratedVideo` 保存到素材存储。
- 任务记录保存上游 task ID、最终结果元数据和最后状态。页面刷新后仍可继续查询，不依赖单次内存状态。
- AutoDL 查询成功后，前端第一次拿到结果就立即落盘；若落盘失败，节点显示真实错误并保留“重新下载/重试”入口。
- 不在控制台、错误消息或任务元数据中记录 Token。

## 爆款复刻中的使用方式

- 默认仍只生成一条最终视频；多图工作流不改变“一个创意只付费生成一次”的规则。
- 参考图按明确角色传入：商品图为必选商品参考，人物定妆图和场景图为可选参考。
- 原爆款视频只用于拉片分析，不作为视频生成参考直接发送，避免照搬原人物和版权风险。
- 最终提示词继续包含人物替换、商品结构/标签稳定、禁止漂浮变形等约束；多图负责提供视觉锚点，提示词负责动作和叙事约束。

## 管理后台

- 渠道调用格式增加“AutoDL ComfyUI”。
- 模型配置提供工作流 ID、Request Body 模板、允许时长、允许分辨率、最大参考图数量。
- 保存配置前校验模板必须包含 `{{prompt}}`，多图模型必须包含 `{{referenceImages}}`。
- 管理后台只显示脱敏 Token，编辑时留空保持原值。

## 错误处理

- 提交失败：展示 AutoDL 返回的 `msg/message`，同时脱敏可能出现的凭据。
- 查询失败：区分临时网络错误和任务最终失败；临时错误可继续轮询，最终失败停止计费任务节点。
- 超时：保留本地和上游 task ID，允许稍后继续查询，而不是重新提交付费任务。
- 结果 URL 过期：如果本地已保存则继续使用本地文件；未保存则提示通过原 task ID 尝试恢复，不自动重新生成。
- 用户取消：停止前端轮询，但保留 task ID；不假设 AutoDL 支持取消接口。

## 验证标准

1. Token 不出现在前端构建产物和浏览器模型配置中。
2. `minimax_h3_lightx2v_v5` 能提交任务并取得本地 `gt-*` ID。
3. QUEUED/RUNNING/SUCCESS/FAILED 状态均正确映射。
4. 多张参考图按真实 API 契约提交，数量或格式不合法时在付费提交前拦截。
5. SUCCESS 后视频能够通过网关内容代理立即保存，刷新页面后仍可播放。
6. 同一创意默认只创建一个付费视频任务。
7. 页面中断或网络断开后可凭本地任务 ID 继续查询，不重复付费。
8. 现有 OpenAI、Omni 和 Seedance 视频渠道行为不受影响。

## 实现前唯一待补资料

需要从 `minimax_h3_lightx2v_v5` 的“在线调用 API / API”页复制完整 Request Body，确认参考图片字段名、图片值类型、时长和分辨率枚举。当前截图只确认了 workflow ID 和任务端点，不能安全推断多图参数。
