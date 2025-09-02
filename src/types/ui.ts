/**
 * UI 相关类型定义
 */

import { SearchResult, IndexedTemplate } from './template'

// 搜索状态
export interface SearchState {
  /** 搜索关键词 */
  query: string
  /** 搜索结果 */
  results: SearchResult[]
  /** 当前选中的结果索引 */
  selectedIndex: number
  /** 是否正在加载 */
  isLoading: boolean
  /** 搜索错误信息 */
  error?: string
  /** 是否显示详情 */
  showDetail: boolean
  /** 当前查看详情的模板 */
  detailTemplate?: IndexedTemplate
  /** 搜索过滤器 */
  filters: {
    type?: 'prompt' | 'context'
    labels: string[]
    repo?: string
  }
  /** 搜索统计信息 */
  stats: {
    totalResults: number
    searchTime: number
    repositories: string[]
  }
}

// 键盘动作类型
export type KeyboardAction = 
  | 'move-up'
  | 'move-down'
  | 'select'
  | 'apply'
  | 'show-detail'
  | 'copy-to-clipboard'
  | 'exit'
  | 'clear-input'
  | 'back'

// 应用模式
export type ApplyMode = 'write' | 'append' | 'merge'

// 应用状态
export interface ApplyState {
  /** 是否显示应用确认界面 */
  showApplyConfirm: boolean
  /** 要应用的模板 */
  templateToApply?: IndexedTemplate
  /** 目标路径 */
  targetPath?: string
  /** 应用模式 */
  mode: ApplyMode
  /** 是否正在应用 */
  isApplying: boolean
  /** 应用错误信息 */
  error?: string
}

// 应用结果
export interface ApplyResult {
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 受影响的文件列表 */
  affectedFiles: string[]
}

// 搜索选项
export interface SearchOptions {
  /** 模板类型过滤 */
  type?: 'prompt' | 'context'
  /** 标签过滤 */
  labels?: string[]
  /** 仓库过滤 */
  repo?: string
  /** 最大结果数 */
  maxResults?: number
}

// UI 主题配置
export interface UITheme {
  /** 主色调 */
  primary: string
  /** 选中项背景色 */
  selectedBg: string
  /** 选中项前景色 */
  selectedFg: string
  /** 错误色 */
  error: string
  /** 成功色 */
  success: string
  /** 警告色 */
  warning: string
  /** 次要文本色 */
  secondary: string
}

// 默认主题
export const DEFAULT_THEME: UITheme = {
  primary: '#0066cc',
  selectedBg: '#0066cc',
  selectedFg: '#ffffff',
  error: '#cc0000',
  success: '#00cc00',
  warning: '#cc6600',
  secondary: '#666666'
}

// 快捷键配置
export interface KeyBindings {
  moveUp: string
  moveDown: string
  select: string
  apply: string
  copy: string
  toggleDetail: string
  clearSearch: string
  help: string
  quit: string
  back: string
}

// 默认快捷键
export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveUp: 'k',
  moveDown: 'j',
  select: 'enter',
  apply: 'a',
  copy: 'c',
  toggleDetail: 'd',
  clearSearch: 'u',
  help: 'h',
  quit: 'q',
  back: 'escape'
}

// 搜索配置
export interface SearchConfig {
  /** 防抖延迟（毫秒） */
  debounceMs: number
  /** 最大显示结果数 */
  maxDisplayResults: number
  /** 是否启用拼音搜索 */
  enablePinyin: boolean
  /** 搜索阈值 */
  threshold: number
  /** 最大结果数 */
  maxResults: number
  /** 搜索权重配置 */
  searchWeights: {
    id: number
    name: number
    labels: number
    summary: number
    content: number
  }
}

// 默认搜索配置
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  debounceMs: 0,
  maxDisplayResults: 10,
  enablePinyin: true,
  threshold: -10000,
  maxResults: 20,
  searchWeights: {
    id: 4,
    name: 3,
    labels: 2,
    summary: 2,
    content: 1
  }
}
