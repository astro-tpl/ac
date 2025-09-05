/**
 * Configuration Service - Hierarchical config file lookup and management
 */

import {
  AC_HOME,
  DEFAULT_CONFIG,
  GLOBAL_CONFIG_PATH,
  PROJECT_CONFIG_FILENAME,
} from '../config/constants'
import {findProjectConfig} from '../config/paths'
import {t} from '../i18n'
import {ensureDir, fileExists} from '../infra/fs'
import {logger} from '../infra/logger'
import {checkVersionCompatibility} from '../infra/version-check'
import {readYamlFile, writeYamlFile} from '../infra/yaml'
import {
  GlobalConfig,
  ProjectConfig,
  RepoConfig,
  ResolvedConfig,
} from '../types/config'
import {
  ConfigNotFoundError,
  ConfigValidationError,
  RepoNotFoundError,
} from '../types/errors'

/**
 * Configuration Service Class
 */
export class ConfigService {
  /**
   * Add repository to configuration
   */
  async addRepoToConfig(
    resolvedConfig: ResolvedConfig,
    repo: RepoConfig,
  ): Promise<void> {
    const {config} = resolvedConfig

    // Check if repository already exists
    const existingRepo = config.repos.find(r => r.name === repo.name)
    if (existingRepo) {
      throw new ConfigValidationError(t('repo.add.exists', {name: repo.name}))
    }

    // Add repository
    config.repos.push(repo)

    // If first repository and no default repository set, set as default
    if (config.repos.length === 1 && !config.defaults.repo) {
      config.defaults.repo = repo.name
    }

    // Save configuration
    await this.saveConfig(resolvedConfig.path, config)
  }

  /**
   * Create default global configuration
   */
  async createDefaultGlobalConfig(): Promise<void> {
    await ensureDir(AC_HOME)
    await writeYamlFile(GLOBAL_CONFIG_PATH, DEFAULT_CONFIG)
    logger.debug(t('config.created', {path: GLOBAL_CONFIG_PATH}))
  }

  /**
   * Get configuration summary information
   */
  getConfigSummary(resolvedConfig: ResolvedConfig): {
    defaultMode: string
    defaultRepo?: string
    path: string
    repoCount: number
    source: string
  } {
    const {config} = resolvedConfig

    return {
      defaultMode: config.defaults.mode,
      defaultRepo: config.defaults.repo || undefined,
      path: resolvedConfig.path,
      repoCount: config.repos.length,
      source: resolvedConfig.source === 'project' ? t('config.source.project') : t('config.source.global'),
    }
  }

  /**
   * Get global configuration (auto-create if not exists)
   */
  async getGlobalConfig(): Promise<GlobalConfig> {
    if (!await fileExists(GLOBAL_CONFIG_PATH)) {
      logger.debug(t('config.creating_default_global_config'))
      await this.createDefaultGlobalConfig()
    }

    try {
      const config = await readYamlFile<GlobalConfig>(GLOBAL_CONFIG_PATH)
      this.validateConfig(config)

      // Ensure configuration contains all required fields, provide defaults
      const normalizedConfig: GlobalConfig = {
        ...config,
        defaults: {
          ...DEFAULT_CONFIG.defaults,
          ...config.defaults,
        },
      }

      return normalizedConfig
    } catch (error: any) {
      logger.warn(t('config.project_config_corrupted', {error: error.message}))
      await this.createDefaultGlobalConfig()
      return await readYamlFile<GlobalConfig>(GLOBAL_CONFIG_PATH)
    }
  }

  /**
   * Load project configuration file
   */
  async loadProjectConfig(configPath: string): Promise<ProjectConfig> {
    if (!await fileExists(configPath)) {
      throw new ConfigNotFoundError(
        t('error.file.not_found', {path: configPath}),
      )
    }

    try {
      const config = await readYamlFile<ProjectConfig>(configPath)
      this.validateConfig(config)

      // Ensure configuration contains all required fields, provide defaults
      const normalizedConfig: ProjectConfig = {
        ...config,
        defaults: {
          ...DEFAULT_CONFIG.defaults,
          ...config.defaults,
        },
      }

      return normalizedConfig
    } catch (error: any) {
      throw new ConfigValidationError(
        t('config.invalid', {error: `${configPath} - ${error.message}`}),
      )
    }
  }

  /**
   * Remove repository from configuration
   */
  async removeRepoFromConfig(
    resolvedConfig: ResolvedConfig,
    repoName: string,
  ): Promise<void> {
    const {config} = resolvedConfig

    // Find repository
    const repoIndex = config.repos.findIndex(r => r.name === repoName)
    if (repoIndex === -1) {
      throw new RepoNotFoundError(t('repo.remove.notfound', {alias: repoName}))
    }

    // Remove repository
    config.repos.splice(repoIndex, 1)

    // If removed default repository, clear default setting or set to first repository
    if (config.defaults.repo === repoName) {
      config.defaults.repo = config.repos.length > 0 ? config.repos[0].name : ''
    }

    // Save configuration
    await this.saveConfig(resolvedConfig.path, config)
  }

  /**
   * Parse configuration files (search by priority)
   */
  async resolveConfig(options: {
    forceGlobal?: boolean
    startDir?: string
  } = {}): Promise<ResolvedConfig> {
    const {forceGlobal = false, startDir = process.cwd()} = options

    // If forcing global config, directly read global configuration
    if (forceGlobal) {
      const globalConfig = await this.getGlobalConfig()
      return {
        config: globalConfig,
        path: GLOBAL_CONFIG_PATH,
        source: 'global' as const,
      }
    }

    // First try to find project configuration
    const projectConfigPath = await findProjectConfig(startDir)
    if (projectConfigPath) {
      try {
        const projectConfig = await this.loadProjectConfig(projectConfigPath)
        return {
          config: projectConfig,
          path: projectConfigPath,
          source: 'project' as const,
        }
      } catch (error: any) {
        logger.warn(t('config.project_config_corrupted', {error: error.message}))
      }
    }

    // Fall back to global configuration
    const globalConfig = await this.getGlobalConfig()
    return {
      config: globalConfig,
      path: GLOBAL_CONFIG_PATH,
      source: 'global' as const,
    }
  }

  /**
   * Resolve repository by alias or default setting
   */
  resolveRepo(
    config: GlobalConfig | ProjectConfig,
    repoAlias?: string,
  ): RepoConfig {
    // If alias specified, search directly
    if (repoAlias) {
      const repo = config.repos.find(r => r.name === repoAlias)
      if (!repo) {
        throw new RepoNotFoundError(
          t('config.error.repo_not_found_use_list', {alias: repoAlias}),
        )
      }

      return repo
    }

    // Use default repository
    if (config.defaults.repo) {
      const repo = config.repos.find(r => r.name === config.defaults.repo)
      if (repo) {
        return repo
      }
    }

    // Use first repository
    if (config.repos.length > 0) {
      return config.repos[0]
    }

    throw new RepoNotFoundError(t('repo.list.no_repos'))
  }

  /**
   * Save configuration to file
   */
  async saveConfig(
    configPath: string,
    config: GlobalConfig | ProjectConfig,
  ): Promise<void> {
    try {
      this.validateConfig(config)
      await writeYamlFile(configPath, config)
      logger.debug(t('config.created', {path: configPath}))
    } catch (error: any) {
      throw new ConfigValidationError(
        t('error.file.write_failed', {path: `${configPath} - ${error.message}`}),
      )
    }
  }

  /**
   * Update repository configuration
   */
  async updateRepoInConfig(
    resolvedConfig: ResolvedConfig,
    repoName: string,
    updates: Partial<RepoConfig>,
  ): Promise<void> {
    const {config} = resolvedConfig

    // Find repository
    const repo = config.repos.find(r => r.name === repoName)
    if (!repo) {
      throw new RepoNotFoundError(t('repo.remove.notfound', {alias: repoName}))
    }

    // Update repository configuration
    Object.assign(repo, updates)

    // Save configuration
    await this.saveConfig(resolvedConfig.path, config)
  }

  /**
   * Validate configuration format
   */
  private validateConfig(config: GlobalConfig | ProjectConfig): void {
    // Check required fields
    if (!config.version || !config.repos || !config.defaults) {
      throw new Error(t('config.invalid', {error: 'missing required fields: version, repos, defaults'}))
    }

    // Check version compatibility
    checkVersionCompatibility(config.version)

    // Validate repository configuration
    if (!Array.isArray(config.repos)) {
      throw new TypeError(t('config.invalid', {error: 'repos must be an array'}))
    }

    for (const repo of config.repos) {
      if (!repo.name || !repo.git || !repo.branch) {
        throw new Error(t('config.invalid', {error: 'repo missing fields: name, git, branch'}))
      }
    }

    // Validate default configuration
    const {defaults} = config
    if (!defaults.mode || !['append', 'merge', 'write'].includes(defaults.mode)) {
      throw new Error(t('config.invalid', {error: 'defaults.mode must be write|append|merge'}))
    }
  }
}

// Global configuration service instance
export const configService = new ConfigService()
