/**
 * Configuration file type definitions
 */

// Repository configuration
export interface RepoConfig {
  /** Branch name */
  branch: string
  /** Git URL */
  git: string
  /** Repository alias */
  name: string
  /** Local path (optional, default concatenated by rules) */
  path?: string
}

// Default configuration
export interface DefaultConfig {
  /** Default target directory */
  dest: string
  /** Default language */
  lang: string
  /** Default write mode */
  mode: 'append' | 'merge' | 'write'
  /** Default repository alias */
  repo: string
}

// Project configuration file (.ac.yaml)
export interface ProjectConfig {
  /** Default configuration */
  defaults: DefaultConfig
  /** Repository list */
  repos: RepoConfig[]
  /** Configuration version */
  version: number
}

// Global configuration file (~/.ac/config.yaml)
export interface GlobalConfig {
  /** Default configuration */
  defaults: DefaultConfig
  /** Repository list */
  repos: RepoConfig[]
  /** Configuration version */
  version: number
}

// Configuration resolution result
export interface ResolvedConfig {
  /** Configuration content */
  config: GlobalConfig | ProjectConfig
  /** Configuration file path */
  path: string
  /** Configuration source type */
  source: 'global' | 'project'
}
