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
  /** Branch name */
  branch?: string
  /** Repository alias */
  name?: string
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
  /** Branch name */
  branch?: string
  /** Force overwrite */
  force?: boolean
  /** Repository alias */
  name?: string
  /** Default repository URL */
  repo?: string
}

// Apply command related
export interface ApplyFlags extends GlobalFlags {
  /** Local file content */
  content?: string
  /** Context template ID */
  context?: string
  /** Target directory or file */
  dest?: string
  /** Preview mode */
  'dry-run'?: boolean
  /** Filename (when dest is a directory) */
  filename?: string
  /** Write mode */
  mode?: 'append' | 'merge' | 'write'
  /** Prompt template ID */
  prompt?: string
  /** Repository alias */
  repo?: string
  /** Read from standard input */
  stdin?: boolean
}

// Search command related
export interface SearchArgs {
  /** Search keyword */
  keyword?: string
}

export interface SearchFlags extends GlobalFlags {
  /** Deep search (requires ripgrep) */
  deep?: boolean
  /** Label filter */
  label?: string[]
  /** Repository alias */
  repo?: string
  /** Template type filter */
  type?: 'context' | 'prompt'
}

// Show command related
export interface ShowArgs {
  /** Template ID */
  id: string
}

export interface ShowFlags extends GlobalFlags {
  /** Output specified property path */
  output?: string
  /** Repository alias */
  repo?: string
}

// Application result
export interface ApplyResult {
  /** Actual content */
  content: string
  /** Content summary */
  contentSummary: string
  /** Whether it's a new file */
  isNewFile: boolean
  /** Key differences during JSON merge */
  jsonKeyDiff?: {
    added: string[]
    modified: string[]
  }
  /** Write mode */
  mode: 'append' | 'merge' | 'write'
  /** Target file path */
  targetPath: string
}

// Preview result
export interface DryRunResult {
  /** List of results to be applied */
  results: ApplyResult[]
  /** Total number of files */
  totalFiles: number
}
