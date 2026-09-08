/**
 * Provider 接口层类型定义
 *
 * 统一任务类服务（绘图/视频）的接口，分为同步和异步两种模式。
 */

import type { ApiFormat, ImageModelParams, ModelType, ImageModelType, VideoModelType, ChatModelType, ModelCategory, TaskStatus } from './types'

// 重新导出，便于外部使用
export type { ApiFormat, ModelType, ImageModelType, VideoModelType, ChatModelType, ModelCategory }

export interface Aimodel {
  id?: number | string
  name?: string
  modelName?: string
  baseUrl?: string
  apiKey?: string
  apiFormat?: ApiFormat
  modelType?: ModelType
  modelParams?: ImageModelParams
}

// ============================================================================
// Provider 元数据
// ============================================================================

/**
 * 模型参数能力
 *
 * 字段集合需与 `app/shared/registry.ts` 中的 ModelCapabilities 保持一致。
 * 前端用于决定表单显示哪些控件；后端 Provider 用于声明协议层能力（便于上层路由）。
 */
export interface ModelCapabilities {
  referenceImage?: boolean    // 支持垫图
  negativePrompt?: boolean    // 支持负面提示词
  size?: boolean              // 支持尺寸
  quality?: boolean           // 支持质量
  style?: boolean             // 支持风格
  aspectRatio?: boolean       // 支持宽高比
  seed?: boolean              // 支持种子
  guidance?: boolean          // 支持引导系数
  watermark?: boolean         // 支持水印
  background?: boolean        // 支持背景（GPT Image）
  outputFormat?: boolean      // 支持输出格式（GPT Image / Flux）
  outputCompression?: boolean // 支持输出压缩率（GPT Image）
  moderation?: boolean        // 支持审核级别（GPT Image）
  inputFidelity?: boolean     // 支持输入保真度（GPT Image 图生图）
  // 视频特有
  duration?: boolean          // 支持时长
  orientation?: boolean       // 支持方向
  enhancePrompt?: boolean     // 支持提示词增强
  enableUpsample?: boolean    // 支持超分
}

/** 验证规则 */
export interface ValidationRules {
  requiresPrompt?: boolean    // 需要提示词（默认 true）
  requiresImage?: boolean     // 必须有图片（如抠图）
  minImages?: number          // 最少图片数（如 blend）
  maxImages?: number          // 最多图片数
  supportsImageUrl?: boolean  // 支持图片 URL（默认 true，false 时需转 base64）
}

/** Provider 元数据 */
export interface ProviderMeta {
  apiFormat: ApiFormat
  label: string
  category: ModelCategory
  isAsync: boolean
  supportedModelTypes: (ImageModelType | VideoModelType)[]
  capabilities?: ModelCapabilities
  validation: ValidationRules
}

// ============================================================================
// 通用类型
// ============================================================================

/** 生成请求参数 */
export interface GenerateParams {
  /** 任务 ID（用于日志） */
  taskId: number
  /** 提示词 */
  prompt: string
  /** 参考图（Base64 格式） */
  images?: string[]
  /** 模型名称 */
  modelName: string
  /** 模型参数 */
  modelParams?: ImageModelParams
  /** MJ 特有：任务类型 */
  type?: 'imagine' | 'blend'
  /** 取消信号 */
  signal?: AbortSignal
}

// ============================================================================
// 同步 Provider
// ============================================================================

/** 同步服务结果 */
export interface SyncResult {
  success: boolean
  /** 远程资源 URL */
  resourceUrl?: string
  /** 下载远程资源时需要附带的请求头 */
  resourceHeaders?: Record<string, string>
  /** Base64 图片数据 */
  imageBase64?: string
  /** MIME 类型 */
  mimeType?: string
  /** 错误信息 */
  error?: string
}

/** 同步服务实例 */
export interface SyncService {
  generate(params: GenerateParams): Promise<SyncResult>
}

/** 同步 Provider 配置 */
export interface SyncProvider {
  readonly meta: ProviderMeta & { isAsync: false }
  createService(aimodel: Aimodel): Promise<SyncService>
}

// ============================================================================
// 异步 Provider
// ============================================================================

/** 异步服务提交结果 */
export interface AsyncSubmitResult {
  upstreamTaskId: string
}

/** 异步服务查询结果 */
export interface AsyncQueryResult {
  status: 'processing' | 'success' | 'failed'
  /** 进度百分比 0-100 */
  progress?: number
  /** 资源 URL */
  resourceUrl?: string
  /** 下载远程资源时需要附带的请求头 */
  resourceHeaders?: Record<string, string>
  /** 错误信息 */
  error?: string
  /** MJ 特有：操作按钮 */
  buttons?: any[]
}

/** 异步服务实例 */
export interface AsyncService {
  submit(params: GenerateParams): Promise<AsyncSubmitResult>
  query(upstreamTaskId: string, taskId?: number): Promise<AsyncQueryResult>
}

/** 异步 Provider 配置 */
export interface AsyncProvider {
  readonly meta: ProviderMeta & { isAsync: true }
  createService(aimodel: Aimodel): Promise<AsyncService>
}

// ============================================================================
// 联合类型
// ============================================================================

export type Provider = SyncProvider | AsyncProvider

/** 类型守卫：判断是否为异步 Provider */
export function isAsyncProvider(provider: Provider): provider is AsyncProvider {
  return provider.meta.isAsync === true
}

/** 类型守卫：判断是否为同步 Provider */
export function isSyncProvider(provider: Provider): provider is SyncProvider {
  return provider.meta.isAsync === false
}
