/**
 * UI related type definitions
 */

import { SearchResult, IndexedTemplate } from './template'

// Search state
export interface SearchState {
  /** Search keywords */
  query: string
  /** Search results */
  results: SearchResult[]
  /** Currently selected result index */
  selectedIndex: number
  /** Whether loading */
  isLoading: boolean
  /** Search error message */
  error?: string
  /** Whether to show details */
  showDetail: boolean
  /** Currently viewing detail template */
  detailTemplate?: IndexedTemplate
  /** Search filters */
  filters: {
    type?: 'prompt' | 'context'
    labels: string[]
    repo?: string
  }
  /** Search statistics */
  stats: {
    totalResults: number
    searchTime: number
    repositories: string[]
  }
}

// Keyboard action types
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

// Application modes
export type ApplyMode = 'write' | 'append' | 'merge'

// Application state
export interface ApplyState {
  /** Whether to show application confirmation interface */
  showApplyConfirm: boolean
  /** Template to apply */
  templateToApply?: IndexedTemplate
  /** Target path */
  targetPath?: string
  /** Application mode */
  mode: ApplyMode
  /** Whether currently applying */
  isApplying: boolean
  /** Application error message */
  error?: string
}

// Application result
export interface ApplyResult {
  /** Whether successful */
  success: boolean
  /** Error message */
  error?: string
  /** List of affected files */
  affectedFiles: string[]
}

// Search options
export interface SearchOptions {
  /** Template type filter */
  type?: 'prompt' | 'context'
  /** Label filter */
  labels?: string[]
  /** Repository filter */
  repo?: string
  /** Maximum number of results */
  maxResults?: number
}

// UI theme configuration
export interface UITheme {
  /** Primary color */
  primary: string
  /** Selected item background color */
  selectedBg: string
  /** Selected item foreground color */
  selectedFg: string
  /** Error color */
  error: string
  /** Success color */
  success: string
  /** Warning color */
  warning: string
  /** Secondary text color */
  secondary: string
}

// Default theme
export const DEFAULT_THEME: UITheme = {
  primary: '#0066cc',
  selectedBg: '#0066cc',
  selectedFg: '#ffffff',
  error: '#cc0000',
  success: '#00cc00',
  warning: '#cc6600',
  secondary: '#666666'
}

// Key bindings configuration
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

// Default key bindings
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

// Search configuration
export interface SearchConfig {
  /** Debounce delay (milliseconds) */
  debounceMs: number
  /** Maximum display results */
  maxDisplayResults: number
  /** Whether to enable pinyin search */
  enablePinyin: boolean
  /** Search threshold */
  threshold: number
  /** Maximum results */
  maxResults: number
  /** Search weight configuration */
  searchWeights: {
    id: number
    name: number
    labels: number
    summary: number
    content: number
  }
}

// Default search configuration
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
