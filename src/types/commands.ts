/**
 * 命令参数类型定义
 */

// 全局标志
export interface GlobalFlags {
  /** 强制使用全局配置 */
  global?: boolean
}

// Repo 命令相关
export interface RepoAddFlags extends GlobalFlags {
  /** 仓库别名 */
  name?: string
  /** 分支名 */
  branch?: string
}

export interface RepoUpdateArgs {
  /** 仓库别名（可选，为空则更新所有） */
  alias?: string
}

export interface RepoRemoveArgs {
  /** 仓库别名 */
  alias: string
}

// Init 命令相关
export interface InitFlags {
  /** 默认仓库 URL */
  repo?: string
  /** 仓库别名 */
  name?: string
  /** 分支名 */
  branch?: string
  /** 强制覆盖 */
  force?: boolean
}

// Apply 命令相关
export interface ApplyFlags extends GlobalFlags {
  /** Context 模板 ID */
  context?: string
  /** Prompt 模板 ID */
  prompt?: string
  /** 本地文件内容 */
  content?: string
  /** 从标准输入读取 */
  stdin?: boolean
  /** 目标目录或文件 */
  dest?: string
  /** 文件名（当 dest 为目录时） */
  filename?: string
  /** 写入模式 */
  mode?: 'write' | 'append' | 'merge'
  /** 仓库别名 */
  repo?: string
  /** 预览模式 */
  'dry-run'?: boolean
}

// Search 命令相关
export interface SearchArgs {
  /** 搜索关键字 */
  keyword?: string
}

export interface SearchFlags extends GlobalFlags {
  /** 模板类型过滤 */
  type?: 'context' | 'prompt'
  /** 标签过滤 */
  label?: string[]
  /** 深度搜索（需要 ripgrep） */
  deep?: boolean
  /** 仓库别名 */
  repo?: string
}

// 应用结果
export interface ApplyResult {
  /** 目标文件路径 */
  targetPath: string
  /** 写入模式 */
  mode: 'write' | 'append' | 'merge'
  /** 是否为新文件 */
  isNewFile: boolean
  /** 内容摘要 */
  contentSummary: string
  /** JSON 合并时的 key 差异 */
  jsonKeyDiff?: {
    added: string[]
    modified: string[]
  }
}

// 预览结果
export interface DryRunResult {
  /** 将要应用的结果列表 */
  results: ApplyResult[]
  /** 总计文件数 */
  totalFiles: number
}
