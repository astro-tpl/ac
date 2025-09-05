/**
 * Template type definitions
 */

// Common template header
export interface TemplateHeader {
  /** Unique template ID */
  id: string
  /** Template type */
  type: 'prompt' | 'context'
  /** Readable name */
  name: string
  /** Tag list */
  labels: string[]
  /** Brief description */
  summary: string
}

// Prompt template
export interface PromptTemplate extends TemplateHeader {
  type: 'prompt'
  /** Prompt content */
  content: string
}

// Context target configuration
export interface TargetConfig {
  /** Target file path (can contain interpolation variables) */
  path: string
  /** Write mode */
  mode: 'write' | 'append' | 'merge'
  /** Direct content (can contain interpolation variables) */
  content?: string
  /** Referenced prompt ID */
  content_from_prompt?: string
  /** Content concatenation order */
  content_order?: 'content-first' | 'prompt-first'
}

// Context template
export interface ContextTemplate extends TemplateHeader {
  type: 'context'
  /** Target file list */
  targets: TargetConfig[]
}

// Union type
export type Template = PromptTemplate | ContextTemplate

// Indexed template (used for search)
export interface IndexedTemplate extends TemplateHeader {
  /** Template source repository */
  repoName: string
  /** Template file absolute path */
  absPath: string
  /** Last modified time */
  lastModified: number
  /** Template content (for prompt type) */
  content?: string
  /** Target configuration (for context type) */
  targets?: TargetConfig[]
}

// Search result
export interface SearchResult {
  /** Match score */
  score: number
  /** Template information */
  template: IndexedTemplate
  /** Matched fields */
  matchedFields: string[]
}

// Template index cache
export interface TemplateIndex {
  /** Index version */
  version: number
  /** Last update time */
  lastUpdated: number
  /** List of indexed templates */
  templates: IndexedTemplate[]
}
