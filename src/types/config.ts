/**
 * Configuration file type definitions
 */

// Repository configuration
export interface RepoConfig {
  /** Repository alias */
  name: string
  /** Git URL */
  git: string
  /** Branch name */
  branch: string
  /** Local path (optional, default concatenated by rules) */
  path?: string
}

// Default configuration
export interface DefaultConfig {
  /** Default repository alias */
  repo: string
  /** Default target directory */
  dest: string
  /** Default write mode */
  mode: 'write' | 'append' | 'merge'
  /** Default language */
  lang: string
}

// Project configuration file (.ac.yaml)
export interface ProjectConfig {
  /** Configuration version */
  version: number
  /** Repository list */
  repos: RepoConfig[]
  /** Default configuration */
  defaults: DefaultConfig
}

// Global configuration file (~/.ac/config.yaml)
export interface GlobalConfig {
  /** Configuration version */
  version: number
  /** Repository list */
  repos: RepoConfig[]
  /** Default configuration */
  defaults: DefaultConfig
}

// Configuration resolution result
export interface ResolvedConfig {
  /** Configuration source type */
  source: 'project' | 'global'
  /** Configuration file path */
  path: string
  /** Configuration content */
  config: ProjectConfig | GlobalConfig
}
