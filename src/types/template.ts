/**
 * Template type definitions
 */

// Common template header
export interface TemplateHeader {
  /** Unique template ID */
  id: string
  /** Tag list */
  labels: string[]
  /** Readable name */
  name: string
  /** Brief description */
  summary: string
  /** Template type */
  type: 'context' | 'prompt'
}

// Prompt template
export interface PromptTemplate extends TemplateHeader {
  /** Prompt content */
  content: string
  type: 'prompt'
}

// Context target configuration
export interface TargetConfig {
  /** Direct content (can contain interpolation variables) */
  content?: string
  /** Referenced prompt ID */
  content_from_prompt?: string
  /** Content concatenation order */
  content_order?: 'content-first' | 'prompt-first'
  /** Write mode */
  mode: 'append' | 'merge' | 'write'
  /** Target file path (can contain interpolation variables) */
  path: string
}

// Context template
export interface ContextTemplate extends TemplateHeader {
  /** Target file list */
  targets: TargetConfig[]
  type: 'context'
}

// Union type
export type Template = ContextTemplate | PromptTemplate

// Indexed template (used for search)
export interface IndexedTemplate extends TemplateHeader {
  /** Template file absolute path */
  absPath: string
  /** Template content (for prompt type) */
  content?: string
  /** Last modified time */
  lastModified: number
  /** Template source repository */
  repoName: string
  /** Target configuration (for context type) */
  targets?: TargetConfig[]
}

// Search result
export interface SearchResult {
  /** Matched fields */
  matchedFields: string[]
  /** Match score */
  score: number
  /** Template information */
  template: IndexedTemplate
}

// Template index cache
export interface TemplateIndex {
  /** Last update time */
  lastUpdated: number
  /** List of indexed templates */
  templates: IndexedTemplate[]
  /** Index version */
  version: number
}
