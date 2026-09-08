/**
 * 模型推断逻辑
 * 从模型 ID 推断分类、能力、API 格式等信息
 */

import type { ModelCategory, ModelCapability, ApiFormat, ModelType } from './types'

// ==================== 推断结果类型 ====================

export interface InferredModelInfo {
  category: ModelCategory
  group: string
  capabilities: ModelCapability[]
  apiFormat: ApiFormat
  modelType: ModelType
}

// ==================== 厂商分组推断 ====================

// 厂商匹配规则（按顺序匹配，更具体的规则放前面）
const VENDOR_RULES: [RegExp, string][] = [
  // 快手（Kling 系列）—— 必须在 OpenAI 之前，避免 kling-o3 名字里的 o3 被误匹配为 OpenAI
  [/\bkling\b/i, '快手'],
  [/kuaishou/i, '快手'],

  // OpenAI 系列
  [/\b(gpt|o1|o3|o4|dall-e|sora)\b/i, 'OpenAI'],
  [/gpt-image/i, 'OpenAI'],
  [/openai/i, 'OpenAI'],

  // Anthropic
  [/claude/i, 'Anthropic'],
  [/anthropic/i, 'Anthropic'],

  // Google
  [/gemini/i, 'Google'],
  [/gemma/i, 'Google'],
  [/palm/i, 'Google'],
  [/bison/i, 'Google'],
  [/\bveo\b/i, 'Google'],
  [/^omni-fast/i, 'Google'],
  [/nano-banana/i, 'Google'],   // Gemini 系图像（nano-banana / -2 / -pro）
  [/imagen/i, 'Google'],         // Imagen 系（google-imagen-4 等）

  // 阿里（通义系 + 万相）
  // 注：wan 后接数字或连字符（wan2-7 / wan-2 / wan2.5）；纯 wan 容易误匹配
  [/(qwen|qwq|qvq|wan[-\d])/i, '阿里'],

  // 字节跳动
  [/doubao/i, '字节跳动'],
  [/seedream/i, '字节跳动'],
  [/seedance/i, '字节跳动'],
  [/jimeng/i, '字节跳动'],
  [/bytedance/i, '字节跳动'],

  // 深度求索
  [/deepseek/i, 'DeepSeek'],

  // 智谱
  [/glm/i, '智谱'],
  [/cogview/i, '智谱'],
  [/zhipu/i, '智谱'],

  // MiniMax
  [/abab/i, 'MiniMax'],
  [/minimax/i, 'MiniMax'],
  [/hailuo/i, 'MiniMax'],

  // 月之暗面
  [/moonshot/i, '月之暗面'],
  [/kimi/i, '月之暗面'],

  // 腾讯
  [/hunyuan/i, '腾讯'],

  // xAI
  [/grok/i, 'xAI'],

  // Meta
  [/llama/i, 'Meta'],

  // Mistral
  [/mixtral/i, 'Mistral'],
  [/mistral/i, 'Mistral'],
  [/codestral/i, 'Mistral'],
  [/ministral/i, 'Mistral'],
  [/magistral/i, 'Mistral'],
  [/pixtral/i, 'Mistral'],

  // 零一万物
  [/yi-/i, '零一万物'],

  // 百川
  [/baichuan/i, '百川'],

  // 阶跃星辰
  [/step/i, '阶跃星辰'],

  // Microsoft
  [/phi/i, 'Microsoft'],
  [/copilot/i, 'Microsoft'],

  // Stability AI
  [/stable-/i, 'Stability'],
  [/sdxl/i, 'Stability'],
  [/flux/i, 'Black Forest'],

  // Sourceful（Riverflow 系列，OpenRouter）
  [/riverflow/i, 'Sourceful'],
  [/sourceful/i, 'Sourceful'],

  // Midjourney
  [/midjourney/i, 'Midjourney'],
  [/mj-/i, 'Midjourney'],

  // Cohere
  [/cohere/i, 'Cohere'],
  [/command/i, 'Cohere'],

  // 讯飞
  [/sparkdesk/i, '讯飞'],

  // Perplexity
  [/perplexity/i, 'Perplexity'],
  [/sonar/i, 'Perplexity'],

  // Luma
  [/luma/i, 'Luma'],

  // 快手可灵
  [/keling/i, '快手'],
  [/kling/i, '快手'],

  // 生数科技
  [/vidu-/i, '生数科技'],

  // Suno
  [/suno/i, 'Suno'],
  [/chirp/i, 'Suno'],

  // AI21
  [/ai21/i, 'AI21'],
  [/jamba-/i, 'AI21'],

  // NVIDIA
  [/nvidia/i, 'NVIDIA'],

  // Jina
  [/jina/i, 'Jina'],

  // 360
  [/360/i, '360'],

  // 面壁智能
  [/minicpm/i, '面壁智能'],

  // 书生
  [/internlm/i, '书生'],
  [/internvl/i, '书生'],

  // 文心
  [/ernie-/i, '百度'],

  // Agnes（音视频聚合方）
  [/agnes/i, 'Agnes'],
]

/**
 * 从模型 ID 推断厂商分组
 */
export function getModelGroup(modelId: string): string {
  if (!modelId) return '其他'

  for (const [pattern, vendor] of VENDOR_RULES) {
    if (pattern.test(modelId)) {
      return vendor
    }
  }

  return '其他'
}

// ==================== 分类推断 ====================

const IMAGE_MODEL_PATTERNS = [
  /dall-e/i,
  /gpt-image/i,
  /gemini.*-image/i,
  /banana/i,
  /flux/i,
  /stable-?diffusion/i,
  /midjourney/i,
  /\bmj-/i,
  /cogview/i,
  /imagen/i,
  /z-image/i,
  /riverflow/i,
  /seedream/i,
  /kandinsky/i,
  // 通用图像关键词：命中 qwen-image-*、wan2-7-image、grok-imagine-image* 等
  // 安全：'image' 不是 'imagine' 的子串，不会误伤 grok-imagine / grok-imagine-video
  // 排除图生视频变体（如 grok-image-video）：'image' 后跟 'video' 的交由视频规则处理
  /image(?!.*video)/i,
  // 裸 grok-imagine（排除 video 变体）归图像
  /grok-imagine(?!.*video)/i,
]

const VIDEO_MODEL_PATTERNS = [
  /\bkling/i,
  /\bluma/i,
  /\brunway/i,
  /\bsora\b/i,
  /\bpika/i,
  /\bveo\b/i,
  /seedance/i,
  /jimeng/i,
  /wan2/i,
  /pixverse/i,
  /grok-video-chat/i,
  /grok.*video.*chat/i,
  /imagine.*video/i,
  // 图生视频命名（grok-image-video、xxx-image-to-video 等）
  /image.*video/i,
  /agnes.*video/i,
  /^omni-fast/i,
]

const EMBEDDING_PATTERNS = [
  /embed/i,
  /bge-/i,
  /\be5-/i,
  /gte-/i,
  /text-embedding/i,
]

/**
 * 推断模型分类
 */
export function inferCategory(modelId: string): ModelCategory {
  // 图片模型
  if (IMAGE_MODEL_PATTERNS.some(p => p.test(modelId))) {
    return 'image'
  }

  // 视频模型
  if (VIDEO_MODEL_PATTERNS.some(p => p.test(modelId))) {
    return 'video'
  }

  // Embedding 模型归类为 chat（暂不单独处理）
  // TTS 模型也归类为 chat

  return 'chat'
}

// ==================== 能力推断 ====================

const VISION_PATTERNS = [
  /gpt-4o/i,
  /gpt-4-turbo/i,
  /gpt-4\.1/i,
  /gpt-4\.5/i,
  /gpt-5/i,
  /claude-3/i,
  /claude-sonnet-4/i,
  /claude-opus-4/i,
  /claude-haiku-4/i,
  /gemini[-_. ]?1\.5/i,
  /gemini[-_. ]?2/i,
  /gemini[-_. ]?3/i,
  /qwen-vl/i,
  /qwen2-vl/i,
  /qwen2\.5-vl/i,
  /qwen3-vl/i,
  /\bqvq\b/i,
  /glm-4v/i,
  /deepseek-vl/i,
  /grok-vision/i,
  /grok-4/i,
  /llava/i,
  /minicpm/i,
  /pixtral/i,
]

const REASONING_PATTERNS = [
  /\bo1\b/i,
  /\bo3\b/i,
  /\bo4\b/i,
  /gpt-5/i,
  /\bqwq\b/i,
  /\bqvq\b/i,
  /qwen3.*thinking/i,
  /deepseek-r1/i,
  /deepseek-v3/i,
  /claude-3\.7/i,
  /claude-3-7/i,
  /claude-sonnet-4/i,
  /claude-opus-4/i,
  /gemini.*thinking/i,
  /glm-z1/i,
  /glm-4\.5/i,
  /glm-4\.6/i,
  /hunyuan-t1/i,
  /hunyuan-a13b/i,
  /doubao.*thinking/i,
  /doubao-seed/i,
  /grok-3-mini/i,
  /grok-4/i,
  /minimax-m1/i,
  /minimax-m2/i,
]

const FUNCTION_CALLING_PATTERNS = [
  /gpt-4o/i,
  /gpt-4\b/i,
  /gpt-4\.5/i,
  /gpt-5/i,
  /\bo1\b/i,
  /\bo3\b/i,
  /\bo4\b/i,
  /claude/i,
  /\bqwen\b/i,
  /qwen3/i,
  /gemini/i,
  /deepseek/i,
  /glm-4/i,
  /grok-3/i,
  /doubao-seed/i,
  /hunyuan/i,
]

// 排除工具调用的模式
const FUNCTION_CALLING_EXCLUDED = [
  ...EMBEDDING_PATTERNS,
  ...IMAGE_MODEL_PATTERNS,
  /rerank/i,
]

// Web Search 能力匹配规则
const WEB_SEARCH_PATTERNS = [
  // Claude 支持的模型
  /claude-3[.-]5-sonnet/i,
  /claude-3[.-]7-sonnet/i,
  /claude-3[.-]5-haiku/i,
  /claude-sonnet-4/i,
  /claude-opus-4/i,
  /claude-haiku-4/i,
  // OpenAI 支持的模型
  /gpt-4o(?!-image)/i,  // gpt-4o 系列（排除 image 变体）
  /gpt-4\.1(?!-nano)/i,
  /\bo3\b/i,
  /\bo4\b/i,
  /gpt-5(?!.*chat)/i,   // gpt-5 系列（排除 chat 变体）
  // Gemini 支持的模型
  /gemini[-_. ]?2(?!.*-image)/i,
  /gemini[-_. ]?3/i,
  // Grok
  /grok-[34]/i,
  // Perplexity
  /sonar/i,
  // 阿里云
  /qwen-turbo/i,
  /qwen-max/i,
  /qwen-plus/i,
  /qwq/i,
  /qwen-flash/i,
  /qwen3-max/i,
  // 智谱
  /glm-4-/i,
  // 腾讯混元（排除 lite）
  /hunyuan(?!-lite)/i,
]

/**
 * 推断模型能力
 */
export function inferCapabilities(modelId: string): ModelCapability[] {
  const capabilities: ModelCapability[] = []

  // 排除非对话模型
  if (EMBEDDING_PATTERNS.some(p => p.test(modelId))) {
    return []
  }

  // 视觉能力
  if (VISION_PATTERNS.some(p => p.test(modelId))) {
    capabilities.push('vision')
  }

  // 推理能力
  if (REASONING_PATTERNS.some(p => p.test(modelId))) {
    capabilities.push('reasoning')
  }

  // 工具调用能力
  const isExcluded = FUNCTION_CALLING_EXCLUDED.some(p => p.test(modelId))
  if (!isExcluded && FUNCTION_CALLING_PATTERNS.some(p => p.test(modelId))) {
    capabilities.push('function_calling')
  }

  // Web Search 能力
  if (WEB_SEARCH_PATTERNS.some(p => p.test(modelId))) {
    capabilities.push('web_search')
  }

  return capabilities
}

// ==================== API 格式推断 ====================

/**
 * 推断 API 格式
 */
export function inferApiFormat(modelId: string): ApiFormat {
  const id = modelId.toLowerCase()

  if (/midjourney|mj-/.test(id)) return 'mj-proxy'
  if (/dall-e|gpt-image/.test(id)) return 'dalle'
  if (/claude/.test(id)) return 'claude'
  // Agnes 视频走 OpenAI Video 协议（/v1/videos）
  if (/agnes.*video/.test(id)) return 'openai-video'
  if (/^omni-fast(?:-|$)/.test(id)) return 'openai-video'
  if (/grok-video-chat|grok.*video.*chat/.test(id)) return 'grok-video-chat'
  // Grok Video（grok-imagine-video / grok-imagine1.5-video / grok-image-video 等）
  if (/grok-imag(?:e|ine).*video/.test(id)) return 'openai-video'
  // OpenAI Images API 兼容（/v1/images/generations）：
  // ProAPI 风格图像统一走 dalle 格式。在 gemini 规则之前匹配，
  // 因为 nano-banana / imagen 是 Google 系图像但仍走 dalle 兼容协议。
  // Riverflow（Sourceful/OpenRouter）走 chat completions 协议（含 sourceful/ 前缀或 riverflow 关键字）
  if (/riverflow|sourceful\//.test(id)) return 'openai-chat'
  if (/sora.?image|sora_image|gemini.*image|nano-banana|imagen|flux|seedream|byte-plus|wan\d|qwen-image|grok-imagine|agnes-image|hunyuan.*image/.test(id)) return 'dalle'
  // OpenAI Sora 协议（Sora / Veo / Kling / Seedance 等 /v1/videos 端点）
  if (/sora|veo|kling|seedance/.test(id)) return 'openai-video'
  if (/gemini/.test(id)) return 'gemini'
  // 国内聚合自定义协议 /v1/video/create
  if (/luma|runway|pika|jimeng/.test(id)) return 'video-unified'

  // OpenAI 模型按版本选择 API 格式
  // gpt-3 系列用 Chat Completion，其他 OpenAI 模型用 Response API
  if (/gpt-3/.test(id)) return 'openai-chat'
  if (/gpt-4|gpt-5|o1|o3|o4/.test(id)) return 'openai-response'

  return 'openai-chat'
}

// ==================== 模型类型推断 ====================

/**
 * 推断模型类型
 */
export function inferModelType(modelId: string, category: ModelCategory): ModelType {
  const id = modelId.toLowerCase()

  if (category === 'image') {
    if (/midjourney|mj-/.test(id)) return 'midjourney'
    if (/dall-e/.test(id)) return 'dalle'
    if (/gpt-image/.test(id)) return 'gpt-image'
    if (/riverflow|sourceful\//.test(id)) return 'riverflow'
    if (/flux/.test(id)) return 'flux'
    // Gemini 系：含 nano-banana / imagen（Google 图像模型族）
    if (/gemini|nano-banana|imagen/.test(id)) return 'gemini'
    // 豆包 / Seedream / byte-plus 系（字节跳动图像模型）
    if (/doubao|seedream|byte-plus/.test(id)) return 'doubao'
    if (/grok/.test(id)) return 'grok-image'
    // 通义系：qwen-image / wan2-7 等（阿里通义万相）
    if (/qwen|wan\d/.test(id)) return 'qwen-image'
    if (/sora/.test(id)) return 'sora-image'
    if (/z-image/.test(id)) return 'z-image'
    if (/agnes/.test(id)) return 'agnes-image'
    return 'dalle' // 默认
  }

  if (category === 'video') {
    if (/jimeng/.test(id)) return 'jimeng-video'
    if (/veo/.test(id)) return 'veo'
    if (/sora/.test(id)) return 'sora'
    if (/kling/.test(id)) return 'kling'
    // seedance 复用 sora 类型(同走 openai-video provider, 参数一致); 厂商分组由 VENDOR_RULES 标为字节跳动
    if (/seedance/.test(id)) return 'sora'
    if (/grok/.test(id)) return 'grok-video'
    if (/agnes/.test(id)) return 'agnes-video'
    return 'jimeng-video' // 默认
  }

  // chat
  if (/gpt|openai|o1|o3|o4/.test(id)) return 'gpt'
  if (/claude/.test(id)) return 'claude'
  if (/gemini/.test(id)) return 'gemini-chat'
  if (/deepseek/.test(id)) return 'deepseek'
  if (/qwen|qwq|qvq/.test(id)) return 'qwen-chat'
  if (/grok/.test(id)) return 'grok'
  if (/llama/.test(id)) return 'llama'
  if (/moonshot|kimi/.test(id)) return 'moonshot'
  if (/glm/.test(id)) return 'glm'
  if (/doubao/.test(id)) return 'doubao-chat'
  if (/minimax/.test(id)) return 'minimax'
  if (/hunyuan/.test(id)) return 'hunyuan'
  if (/mixtral|mistral/.test(id)) return 'mixtral'
  if (/phi/.test(id)) return 'phi'

  return 'gpt' // 默认
}

// ==================== 主函数 ====================

/**
 * 从模型 ID 推断完整的模型信息
 */
export function inferModelInfo(modelId: string): InferredModelInfo {
  const category = inferCategory(modelId)
  const group = getModelGroup(modelId)
  const capabilities = category === 'chat' ? inferCapabilities(modelId) : []
  const apiFormat = inferApiFormat(modelId)
  const modelType = inferModelType(modelId, category)

  return {
    category,
    group,
    capabilities,
    apiFormat,
    modelType,
  }
}
