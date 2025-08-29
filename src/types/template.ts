/**
 * 模板类型定义
 */

// 模板公共头部
export interface TemplateHeader {
  /** 唯一模板 ID */
  id: string
  /** 模板类型 */
  type: 'prompt' | 'context'
  /** 可读名称 */
  name: string
  /** 标签列表 */
  labels: string[]
  /** 简要说明 */
  summary: string
}

// Prompt 模板
export interface PromptTemplate extends TemplateHeader {
  type: 'prompt'
  /** 提示词内容 */
  content: string
}

// Context 目标配置
export interface TargetConfig {
  /** 目标文件路径（可含插值变量） */
  path: string
  /** 写入模式 */
  mode: 'write' | 'append' | 'merge'
  /** 直接内容（可含插值变量） */
  content?: string
  /** 引用 prompt 的 ID */
  content_from_prompt?: string
  /** 内容拼接顺序 */
  content_order?: 'content-first' | 'prompt-first'
}

// Context 模板
export interface ContextTemplate extends TemplateHeader {
  type: 'context'
  /** 目标文件列表 */
  targets: TargetConfig[]
}

// 联合类型
export type Template = PromptTemplate | ContextTemplate

// 索引化的模板（用于搜索）
export interface IndexedTemplate extends TemplateHeader {
  /** 模板来源仓库 */
  repoName: string
  /** 模板文件绝对路径 */
  absPath: string
  /** 最后修改时间 */
  lastModified: number
}

// 搜索结果
export interface SearchResult {
  /** 匹配得分 */
  score: number
  /** 模板信息 */
  template: IndexedTemplate
  /** 匹配的字段 */
  matchedFields: string[]
}

// 模板索引缓存
export interface TemplateIndex {
  /** 索引版本 */
  version: number
  /** 最后更新时间 */
  lastUpdated: number
  /** 索引的模板列表 */
  templates: IndexedTemplate[]
}
