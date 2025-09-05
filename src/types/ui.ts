/**
 * UI related type definitions
 */

import {IndexedTemplate, SearchResult} from './template'

// Search state
export interface SearchState {
  /** Currently viewing detail template */
  detailTemplate?: IndexedTemplate
  /** Search error message */
  error?: string
  /** Search filters */
  filters: {
    labels: string[]
    repo?: string
    type?: 'context' | 'prompt'
  }
  /** Whether loading */
  isLoading: boolean
  /** Search keywords */
  query: string
  /** Search results */
  results: SearchResult[]
  /** Currently selected result index */
  selectedIndex: number
  /** Whether to show details */
  showDetail: boolean
  /** Search statistics */
  stats: {
    repositories: string[]
    searchTime: number
    totalResults: number
  }
}

// Keyboard action types
export type KeyboardAction =
  | 'apply'
  | 'back'
  | 'clear-input'
  | 'copy-to-clipboard'
  | 'exit'
  | 'move-down'
  | 'move-up'
  | 'select'
  | 'show-detail'

// Application modes
export type ApplyMode = 'append' | 'merge' | 'write'

// Application state
export interface ApplyState {
  /** Application error message */
  error?: string
  /** Whether currently applying */
  isApplying: boolean
  /** Application mode */
  mode: ApplyMode
  /** Whether to show application confirmation interface */
  showApplyConfirm: boolean
  /** Target path */
  targetPath?: string
  /** Template to apply */
  templateToApply?: IndexedTemplate
}

// Application result
export interface ApplyResult {
  /** List of affected files */
  affectedFiles: string[]
  /** Error message */
  error?: string
  /** Whether successful */
  success: boolean
}

// Search options
export interface SearchOptions {
  /** Label filter */
  labels?: string[]
  /** Maximum number of results */
  maxResults?: number
  /** Repository filter */
  repo?: string
  /** Template type filter */
  type?: 'context' | 'prompt'
}

// UI theme configuration
export interface UITheme {
  /** Error color */
  error: string
  /** Primary color */
  primary: string
  /** Secondary text color */
  secondary: string
  /** Selected item background color */
  selectedBg: string
  /** Selected item foreground color */
  selectedFg: string
  /** Success color */
  success: string
  /** Warning color */
  warning: string
}

// Default theme
export const DEFAULT_THEME: UITheme = {
  error: '#cc0000',
  primary: '#0066cc',
  secondary: '#666666',
  selectedBg: '#0066cc',
  selectedFg: '#ffffff',
  success: '#00cc00',
  warning: '#cc6600',
}

// Key bindings configuration
export interface KeyBindings {
  apply: string
  back: string
  clearSearch: string
  copy: string
  help: string
  moveDown: string
  moveUp: string
  quit: string
  select: string
  toggleDetail: string
}

// Default key bindings
export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  apply: 'a',
  back: 'escape',
  clearSearch: 'u',
  copy: 'c',
  help: 'h',
  moveDown: 'j',
  moveUp: 'k',
  quit: 'q',
  select: 'enter',
  toggleDetail: 'd',
}

// Search configuration
export interface SearchConfig {
  /** Debounce delay (milliseconds) */
  debounceMs: number
  /** Whether to enable pinyin search */
  enablePinyin: boolean
  /** Maximum display results */
  maxDisplayResults: number
  /** Maximum results */
  maxResults: number
  /** Search weight configuration */
  searchWeights: {
    content: number
    id: number
    labels: number
    name: number
    summary: number
  }
  /** Search threshold */
  threshold: number
}

// Default search configuration
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  debounceMs: 0,
  enablePinyin: true,
  maxDisplayResults: 10,
  maxResults: 20,
  searchWeights: {
    content: 1,
    id: 4,
    labels: 2,
    name: 3,
    summary: 2,
  },
  threshold: -10_000,
}
