/**
 * 前端注册表
 *
 * Provider 和 ModelType 的元数据，供前端使用。
 * 注意：修改模型配置时需同步更新 server/services/providers/modelTypes.ts
 */

import type { ImageModelType, VideoModelType, ChatModelType, ModelCategory } from './types'

// ============================================================================
// 类型定义
// ============================================================================

export interface ProviderMeta {
  apiFormat: string
  label: string
  category: ModelCategory
  isAsync: boolean
  supportedModelTypes: (ImageModelType | VideoModelType | ChatModelType)[]
}

export interface ModelCapabilities {
  referenceImage?: boolean
  negativePrompt?: boolean
  size?: boolean
  quality?: boolean
  style?: boolean
  aspectRatio?: boolean
  seed?: boolean
  guidance?: boolean
  watermark?: boolean
  background?: boolean
  outputFormat?: boolean
  outputCompression?: boolean
  moderation?: boolean
  inputFidelity?: boolean
  /**
   * 批量生成上限（前端「生成数量」按钮组的最大值）。
   * 未配置 = 仅单图。前端会把 N 拆成 N 个独立任务并发分发，
   * 因此每个上游请求仍是 n=1，避免双重计费。
   */
  sampleCount?: number
  duration?: boolean
  orientation?: boolean
  enhancePrompt?: boolean
  enableUpsample?: boolean
}

export interface ModelTypeMeta {
  type: ImageModelType | VideoModelType | ChatModelType
  label: string
  category: ModelCategory
  icon?: string
  cardDisplay?: {
    label: string
    color: string
  }
  defaults: {
    modelName: string
    estimatedTime: number
  }
  capabilities?: ModelCapabilities
}

/** 所有 Provider 元数据 */
export const PROVIDER_REGISTRY: ProviderMeta[] = [
  {
    apiFormat: 'dalle',
    label: 'DALL-E API',
    category: 'image',
    isAsync: false,
    supportedModelTypes: ['dalle', 'flux', 'doubao', 'gpt-image', 'z-image', 'agnes-image'],
  },
  {
    apiFormat: 'gemini',
    label: 'Gemini API',
    category: 'image',
    isAsync: false,
    supportedModelTypes: ['gemini'],
  },
  {
    apiFormat: 'openai-chat',
    label: 'OpenAI Chat',
    category: 'image',
    isAsync: false,
    supportedModelTypes: ['gpt4o-image', 'sora-image', 'grok-image', 'qwen-image', 'gemini', 'riverflow'],
  },
  {
    apiFormat: 'mj-proxy',
    label: 'MJ-Proxy',
    category: 'image',
    isAsync: true,
    supportedModelTypes: ['midjourney'],
  },
  {
    apiFormat: 'koukoutu',
    label: '抠抠图 API',
    category: 'image',
    isAsync: true,
    supportedModelTypes: ['koukoutu'],
  },
  {
    apiFormat: 'video-unified',
    label: '视频统一格式',
    category: 'video',
    isAsync: true,
    supportedModelTypes: ['jimeng-video', 'veo', 'sora', 'grok-video'],
  },
  {
    apiFormat: 'openai-video',
    label: 'OpenAI Video',
    category: 'video',
    isAsync: true,
    supportedModelTypes: ['sora', 'veo', 'kling', 'grok-video', 'agnes-video'],
  },
  {
    apiFormat: 'grok-video-chat',
    label: 'Grok Video (Chat)',
    category: 'video',
    isAsync: false,
    supportedModelTypes: ['grok-video'],
  },
  // 对话模型 Provider
  {
    apiFormat: 'openai-response',
    label: 'OpenAI Response',
    category: 'chat',
    isAsync: false,
    supportedModelTypes: ['gpt', 'claude', 'deepseek', 'qwen-chat', 'grok', 'llama', 'moonshot', 'glm', 'doubao-chat', 'minimax', 'hunyuan', 'mixtral', 'phi', 'gemini-chat'],
  },
  {
    apiFormat: 'openai-chat',
    label: 'OpenAI Chat',
    category: 'chat',
    isAsync: false,
    supportedModelTypes: ['gpt', 'claude', 'deepseek', 'qwen-chat', 'grok', 'llama', 'moonshot', 'glm', 'doubao-chat', 'minimax', 'hunyuan', 'mixtral', 'phi', 'gemini-chat'],
  },
  {
    apiFormat: 'claude',
    label: 'Claude API',
    category: 'chat',
    isAsync: false,
    supportedModelTypes: ['gpt', 'claude', 'deepseek', 'qwen-chat', 'grok', 'llama', 'moonshot', 'glm', 'doubao-chat', 'minimax', 'hunyuan', 'mixtral', 'phi', 'gemini-chat'],
  },
  {
    apiFormat: 'gemini',
    label: 'Gemini API',
    category: 'chat',
    isAsync: false,
    supportedModelTypes: ['gpt', 'claude', 'deepseek', 'qwen-chat', 'grok', 'llama', 'moonshot', 'glm', 'doubao-chat', 'minimax', 'hunyuan', 'mixtral', 'phi', 'gemini-chat'],
  },
]

// ============================================================================
// ModelType 元数据
// ============================================================================

/** 图片模型注册表 */
export const IMAGE_MODEL_REGISTRY: ModelTypeMeta[] = [
  {
    type: 'midjourney',
    label: 'Midjourney',
    category: 'image',
    icon: 'i-heroicons-sparkles',
    cardDisplay: { label: 'MJ', color: 'bg-purple-500/80' },
    defaults: { modelName: 'midjourney', estimatedTime: 60 },
    capabilities: { referenceImage: true },
  },
  {
    // Gemini 系：nano-banana / nano-banana-2 / nano-banana-pro / google-imagen-4
    type: 'gemini',
    label: 'Gemini 绘图',
    category: 'image',
    icon: 'i-heroicons-cpu-chip',
    cardDisplay: { label: 'Gemini', color: 'bg-blue-500/80' },
    defaults: { modelName: 'nano-banana-pro', estimatedTime: 15 },
    // 官方支持：aspect_ratio + 1K/2K/4K（size）；nano-banana-pro 含 upscale 到 2K/4K
    // Imagen 4 额外支持：seed（0-4294967295）
    capabilities: { referenceImage: true, size: true, quality: true, aspectRatio: true, seed: true, sampleCount: 4 },
  },
  {
    // Flux 2 系：flux-2-pro / flux-2-max
    type: 'flux',
    label: 'Flux',
    category: 'image',
    icon: 'i-heroicons-bolt',
    cardDisplay: { label: 'Flux', color: 'bg-orange-500/80' },
    defaults: { modelName: 'flux-2-pro', estimatedTime: 20 },
    // 官方支持：width/height (16 倍数，OpenAI 兼容代理用 size) + seed + output_format + 多参考图（最多 8 张）
    // 不支持：aspect_ratio（通过 size 表达比例） / quality / negative_prompt
    capabilities: { referenceImage: true, size: true, seed: true, outputFormat: true, sampleCount: 4 },
  },
  {
    type: 'dalle',
    label: 'DALL-E',
    category: 'image',
    icon: 'i-heroicons-photo',
    cardDisplay: { label: 'DALL-E', color: 'bg-green-500/80' },
    defaults: { modelName: 'dall-e-3', estimatedTime: 15 },
    capabilities: { size: true, quality: true, style: true },
  },
  {
    // 字节跳动 Seedream 系：byte-plus-seedream-4 / 4-5 / 5-lite + 旧 doubao-seedream-*
    type: 'doubao',
    label: '豆包绘图',
    category: 'image',
    icon: 'i-heroicons-fire',
    cardDisplay: { label: '豆包', color: 'bg-cyan-500/80' },
    defaults: { modelName: 'byte-plus-seedream-4', estimatedTime: 15 },
    // 官方支持：8 档 aspect_ratio (含 21:9) + 1K/2K/4K + standard/high quality + seed + negative_prompt + 多参考图（最多 10 张）
    capabilities: { referenceImage: true, negativePrompt: true, size: true, aspectRatio: true, quality: true, seed: true, watermark: true, sampleCount: 4 },
  },
  {
    type: 'gpt4o-image',
    label: 'GPT-4o 绘图',
    category: 'image',
    icon: 'i-heroicons-chat-bubble-left-right',
    cardDisplay: { label: 'GPT-4o', color: 'bg-emerald-500/80' },
    defaults: { modelName: 'gpt-4o', estimatedTime: 30 },
    capabilities: { referenceImage: true, size: true, quality: true, background: true },
  },
  {
    type: 'gpt-image',
    label: 'GPT Image',
    category: 'image',
    icon: 'i-heroicons-photo',
    cardDisplay: { label: 'GPT', color: 'bg-lime-500/80' },
    defaults: { modelName: 'gpt-image-1.5-all', estimatedTime: 30 },
    capabilities: {
      referenceImage: true,
      size: true,
      aspectRatio: true,
      quality: true,
      background: true,
      outputFormat: true,
      outputCompression: true,
      moderation: true,
      inputFidelity: true,
      sampleCount: 4,
    },
  },
  {
    type: 'sora-image',
    label: 'Sora 绘图',
    category: 'image',
    icon: 'i-heroicons-film',
    cardDisplay: { label: 'Sora', color: 'bg-amber-500/80' },
    defaults: { modelName: 'sora_image', estimatedTime: 30 },
    capabilities: { referenceImage: true },
  },
  {
    // xAI Grok Imagine：grok-imagine
    type: 'grok-image',
    label: 'Grok 绘图',
    category: 'image',
    icon: 'i-heroicons-rocket-launch',
    cardDisplay: { label: 'Grok', color: 'bg-red-500/80' },
    defaults: { modelName: 'grok-imagine', estimatedTime: 30 },
    // 官方支持：14 档 aspect_ratio + 1k/2k 分辨率（用 quality 字段控制）+ 多参考图（最多 3 张）
    // 注意：Grok 不支持 size，只支持 aspect_ratio
    capabilities: { referenceImage: true, aspectRatio: true, quality: true, sampleCount: 4 },
  },
  {
    // 通义 / Wan 系：qwen-image-2 / -pro / -plus + wan2-7-image / -pro
    type: 'qwen-image',
    label: '通义万相',
    category: 'image',
    icon: 'i-heroicons-cloud',
    cardDisplay: { label: '通义', color: 'bg-violet-500/80' },
    defaults: { modelName: 'qwen-image-2', estimatedTime: 30 },
    // 官方支持：自由 WxH (16 倍数) + 1K/2K + watermark 开关 + negative_prompt + 多参考图（最多 3 张）
    capabilities: { referenceImage: true, negativePrompt: true, size: true, aspectRatio: true, watermark: true, sampleCount: 4 },
  },
  {
    type: 'z-image',
    label: 'Z-Image',
    category: 'image',
    icon: 'i-heroicons-cube',
    cardDisplay: { label: 'Z-Image', color: 'bg-indigo-500/80' },
    defaults: { modelName: 'z-image-turbo', estimatedTime: 15 },
    capabilities: { negativePrompt: true },
  },
  {
    // Sourceful Riverflow（OpenRouter）：sourceful/riverflow-v2.5-fast / -v2.5-pro
    // 通过 chat completions 协议输出图像，与 gpt4o-image / grok-image 同类
    type: 'riverflow',
    label: 'Riverflow',
    category: 'image',
    icon: 'i-heroicons-sparkles',
    cardDisplay: { label: 'Riverflow', color: 'bg-sky-500/80' },
    defaults: { modelName: 'sourceful/riverflow-v2.5-pro:free', estimatedTime: 25 },
    capabilities: { referenceImage: true, sampleCount: 4 },
  },
  {
    type: 'koukoutu',
    label: '抠抠图',
    category: 'image',
    icon: 'i-heroicons-scissors',
    cardDisplay: { label: '抠图', color: 'bg-pink-500/80' },
    defaults: { modelName: 'background-removal', estimatedTime: 10 },
    capabilities: { referenceImage: true },
  },
  {
    // Agnes 绘图：agnes-image-2.0-flash / agnes-image-2.1-flash
    // 走 /v1/images/generations（dalle 兼容），实测上游忽略 size 等参数，纯文生图
    type: 'agnes-image',
    label: 'Agnes 绘图',
    category: 'image',
    icon: 'i-heroicons-photo',
    cardDisplay: { label: 'Agnes', color: 'bg-fuchsia-500/80' },
    defaults: { modelName: 'agnes-image-2.1-flash', estimatedTime: 20 },
    // 上游忽略所有可调参数，不挂任何 capabilities
  },
]

/** 视频模型注册表 */
export const VIDEO_MODEL_REGISTRY: ModelTypeMeta[] = [
  {
    type: 'jimeng-video',
    label: '即梦视频',
    category: 'video',
    cardDisplay: { label: '即梦', color: 'bg-teal-500/80' },
    defaults: { modelName: 'jimeng-video-3.0', estimatedTime: 120 },
  },
  {
    type: 'veo',
    label: 'Veo',
    category: 'video',
    cardDisplay: { label: 'Veo', color: 'bg-rose-500/80' },
    defaults: { modelName: 'veo-3.1-fast', estimatedTime: 180 },
  },
  {
    type: 'sora',
    label: 'Sora',
    category: 'video',
    cardDisplay: { label: 'Sora', color: 'bg-amber-500/80' },
    defaults: { modelName: 'sora-2', estimatedTime: 180 },
  },
  {
    type: 'kling',
    label: 'Kling',
    category: 'video',
    cardDisplay: { label: 'Kling', color: 'bg-pink-500/80' },
    defaults: { modelName: 'kling-3.0', estimatedTime: 120 },
  },
  {
    type: 'grok-video',
    label: 'Grok 视频',
    category: 'video',
    cardDisplay: { label: 'Grok', color: 'bg-red-500/80' },
    defaults: { modelName: 'grok-imagine-video', estimatedTime: 120 },
    capabilities: { referenceImage: true, duration: true, size: true },
  },
  {
    type: 'agnes-video',
    label: 'Agnes 视频',
    category: 'video',
    cardDisplay: { label: 'Agnes', color: 'bg-fuchsia-500/80' },
    defaults: { modelName: 'agnes-video-v2.0', estimatedTime: 90 },
    // 上游忽略所有可调参数（固定 5s · 1280x704），不挂任何 capabilities
  },
]

/** 对话模型注册表 */
export const CHAT_MODEL_REGISTRY: ModelTypeMeta[] = [
  { type: 'gpt', label: 'GPT', category: 'chat', defaults: { modelName: 'gpt-4o', estimatedTime: 2 } },
  { type: 'claude', label: 'Claude', category: 'chat', defaults: { modelName: 'claude-sonnet-4-20250514', estimatedTime: 3 } },
  { type: 'gemini-chat', label: 'Gemini', category: 'chat', defaults: { modelName: 'gemini-2.5-flash', estimatedTime: 2 } },
  { type: 'deepseek', label: 'DeepSeek', category: 'chat', defaults: { modelName: 'deepseek-chat', estimatedTime: 3 } },
  { type: 'qwen-chat', label: '通义千问', category: 'chat', defaults: { modelName: 'qwen-max', estimatedTime: 2 } },
  { type: 'grok', label: 'Grok', category: 'chat', defaults: { modelName: 'grok-3', estimatedTime: 2 } },
  { type: 'llama', label: 'LLaMA', category: 'chat', defaults: { modelName: 'llama-3.3-70b-instruct-fp8-fast', estimatedTime: 2 } },
  { type: 'moonshot', label: 'Kimi', category: 'chat', defaults: { modelName: 'moonshot-v1-128k', estimatedTime: 3 } },
  { type: 'glm', label: '智谱GLM', category: 'chat', defaults: { modelName: 'glm-4.5', estimatedTime: 2 } },
  { type: 'doubao-chat', label: '豆包', category: 'chat', defaults: { modelName: 'doubao-1-5-pro-256k-250115', estimatedTime: 2 } },
  { type: 'minimax', label: 'MiniMax', category: 'chat', defaults: { modelName: 'minimax-m1-80k', estimatedTime: 2 } },
  { type: 'hunyuan', label: '混元', category: 'chat', defaults: { modelName: 'hunyuan-t1', estimatedTime: 3 } },
  { type: 'mixtral', label: 'Mixtral', category: 'chat', defaults: { modelName: 'mixtral-8x22b', estimatedTime: 2 } },
  { type: 'phi', label: 'Phi', category: 'chat', defaults: { modelName: 'phi-4', estimatedTime: 2 } },
]

/** 所有模型注册表 */
export const MODEL_TYPE_REGISTRY: ModelTypeMeta[] = [
  ...IMAGE_MODEL_REGISTRY,
  ...VIDEO_MODEL_REGISTRY,
  ...CHAT_MODEL_REGISTRY,
]

// ============================================================================
// 工具函数
// ============================================================================

/** 根据模型类型获取可用的 API 格式 */
export function getApiFormatsForModelType(modelType: ImageModelType | VideoModelType | ChatModelType): string[] {
  return PROVIDER_REGISTRY
    .filter(p => (p.supportedModelTypes as string[]).includes(modelType))
    .map(p => p.apiFormat)
}

/** 根据模型类型获取元数据 */
export function getModelTypeMeta(modelType: ImageModelType | VideoModelType | ChatModelType): ModelTypeMeta | undefined {
  return MODEL_TYPE_REGISTRY.find(m => m.type === modelType)
}

/** 获取模型类型的显示名称 */
export function getModelTypeLabel(modelType: ImageModelType | VideoModelType | ChatModelType): string {
  return getModelTypeMeta(modelType)?.label ?? modelType
}

/** 获取 API 格式的显示名称 */
export function getApiFormatLabel(apiFormat: string): string {
  return PROVIDER_REGISTRY.find(p => p.apiFormat === apiFormat)?.label ?? apiFormat
}

/** 获取模型类型的默认配置 */
export function getModelTypeDefaults(modelType: ImageModelType | VideoModelType | ChatModelType) {
  return getModelTypeMeta(modelType)?.defaults
}

/** 获取模型类型的卡片显示配置 */
export function getCardDisplay(modelType: ImageModelType | VideoModelType | ChatModelType) {
  return getModelTypeMeta(modelType)?.cardDisplay
}

/** 获取模型类型的能力配置 */
export function getModelCapabilities(modelType: ImageModelType | VideoModelType | ChatModelType): ModelCapabilities {
  return getModelTypeMeta(modelType)?.capabilities ?? {}
}
