/**
 * Command parameter type definitions
 */

// Global flags
export interface GlobalFlags {
  /** Force use global configuration */
  global?: boolean
}

// Repo command related
export interface RepoAddFlags extends GlobalFlags {
  /** Repository alias */
  name?: string
  /** Branch name */
  branch?: string
}

export interface RepoUpdateArgs {
  /** Repository alias (optional, updates all if empty) */
  alias?: string
}

export interface RepoRemoveArgs {
  /** Repository alias */
  alias: string
}

// Init command related
export interface InitFlags {
  /** Default repository URL */
  repo?: string
  /** Repository alias */
  name?: string
  /** Branch name */
  branch?: string
  /** Force overwrite */
  force?: boolean
}

// Apply command related
export interface ApplyFlags extends GlobalFlags {
  /** Context template ID */
  context?: string
  /** Prompt template ID */
  prompt?: string
  /** Local file content */
  content?: string
  /** Read from standard input */
  stdin?: boolean
  /** Target directory or file */
  dest?: string
  /** Filename (when dest is a directory) */
  filename?: string
  /** Write mode */
  mode?: 'write' | 'append' | 'merge'
  /** Repository alias */
  repo?: string
  /** Preview mode */
  'dry-run'?: boolean
}

// Search command related
export interface SearchArgs {
  /** Search keyword */
  keyword?: string
}

export interface SearchFlags extends GlobalFlags {
  /** Template type filter */
  type?: 'context' | 'prompt'
  /** Label filter */
  label?: string[]
  /** Deep search (requires ripgrep) */
  deep?: boolean
  /** Repository alias */
  repo?: string
}

// Show command related
export interface ShowArgs {
  /** Template ID */
  id: string
}

export interface ShowFlags extends GlobalFlags {
  /** Repository alias */
  repo?: string
  /** Output specified property path */
  output?: string
}

// Application result
export interface ApplyResult {
  /** Target file path */
  targetPath: string
  /** Write mode */
  mode: 'write' | 'append' | 'merge'
  /** Whether it's a new file */
  isNewFile: boolean
  /** Content summary */
  contentSummary: string
  /** Actual content */
  content: string
  /** Key differences during JSON merge */
  jsonKeyDiff?: {
    added: string[]
    modified: string[]
  }
}

// Preview result
export interface DryRunResult {
  /** List of results to be applied */
  results: ApplyResult[]
  /** Total number of files */
  totalFiles: number
}
