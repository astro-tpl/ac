/**
 * Configuration Service - Hierarchical config file lookup and management
 */

import { readYamlFile, writeYamlFile } from '../infra/yaml'
import { fileExists, ensureDir } from '../infra/fs'
import { findProjectConfig } from '../config/paths'
import { checkVersionCompatibility } from '../infra/version-check'
import { 
  GLOBAL_CONFIG_PATH, 
  AC_HOME, 
  DEFAULT_CONFIG,
  PROJECT_CONFIG_FILENAME 
} from '../config/constants'
import { 
  ProjectConfig, 
  GlobalConfig, 
  ResolvedConfig,
  RepoConfig 
} from '../types/config'
import { 
  ConfigNotFoundError, 
  ConfigValidationError,
  RepoNotFoundError 
} from '../types/errors'
import { logger } from '../infra/logger'
import { t } from '../i18n'

/**
 * 配置服务类
 */
export class ConfigService {
  /**
   * 解析配置文件（按优先级查找）
   */
  async resolveConfig(options: {
    forceGlobal?: boolean
    startDir?: string
  } = {}): Promise<ResolvedConfig> {
    const { forceGlobal = false, startDir = process.cwd() } = options
    
    // 如果强制使用全局配置，直接读取全局配置
    if (forceGlobal) {
      const globalConfig = await this.getGlobalConfig()
      return {
        source: 'global' as const,
        path: GLOBAL_CONFIG_PATH,
        config: globalConfig
      }
    }
    
    // 首先尝试查找项目配置
    const projectConfigPath = await findProjectConfig(startDir)
    if (projectConfigPath) {
      try {
        const projectConfig = await this.loadProjectConfig(projectConfigPath)
        return {
          source: 'project' as const,
          path: projectConfigPath,
          config: projectConfig
        }
      } catch (error: any) {
        logger.warn(t('config.project_config_corrupted', { error: error.message }))
      }
    }
    
    // 回退到全局配置
    const globalConfig = await this.getGlobalConfig()
    return {
      source: 'global' as const,
      path: GLOBAL_CONFIG_PATH,
      config: globalConfig
    }
  }
  
  /**
   * 加载项目配置文件
   */
  async loadProjectConfig(configPath: string): Promise<ProjectConfig> {
    if (!await fileExists(configPath)) {
      throw new ConfigNotFoundError(
        t('error.file.not_found', { path: configPath })
      )
    }
    
    try {
      const config = await readYamlFile<ProjectConfig>(configPath)
      this.validateConfig(config)
      
      // 确保配置包含所有必需字段，提供默认值
      const normalizedConfig: ProjectConfig = {
        ...config,
        defaults: {
          ...DEFAULT_CONFIG.defaults,
          ...config.defaults
        }
      }
      
      return normalizedConfig
    } catch (error: any) {
      throw new ConfigValidationError(
        t('config.invalid', { error: `${configPath} - ${error.message}` })
      )
    }
  }
  
  /**
   * 获取全局配置（不存在则自动创建）
   */
  async getGlobalConfig(): Promise<GlobalConfig> {
    if (!await fileExists(GLOBAL_CONFIG_PATH)) {
      logger.debug(t('config.creating_default_global_config'))
      await this.createDefaultGlobalConfig()
    }
    
    try {
      const config = await readYamlFile<GlobalConfig>(GLOBAL_CONFIG_PATH)
      this.validateConfig(config)
      
      // 确保配置包含所有必需字段，提供默认值
      const normalizedConfig: GlobalConfig = {
        ...config,
        defaults: {
          ...DEFAULT_CONFIG.defaults,
          ...config.defaults
        }
      }
      
      return normalizedConfig
    } catch (error: any) {
      logger.warn(t('config.project_config_corrupted', { error: error.message }))
      await this.createDefaultGlobalConfig()
      return await readYamlFile<GlobalConfig>(GLOBAL_CONFIG_PATH)
    }
  }
  
  /**
   * 创建默认全局配置
   */
  async createDefaultGlobalConfig(): Promise<void> {
    await ensureDir(AC_HOME)
    await writeYamlFile(GLOBAL_CONFIG_PATH, DEFAULT_CONFIG)
    logger.debug(t('config.created', { path: GLOBAL_CONFIG_PATH }))
  }
  
  /**
   * 验证配置格式
   */
  private validateConfig(config: ProjectConfig | GlobalConfig): void {
    // 检查必需字段
    if (!config.version || !config.repos || !config.defaults) {
      throw new Error(t('config.invalid', { error: 'missing required fields: version, repos, defaults' }))
    }
    
    // 检查版本兼容性
    checkVersionCompatibility(config.version)
    
    // 验证仓库配置
    if (!Array.isArray(config.repos)) {
      throw new Error(t('config.invalid', { error: 'repos must be an array' }))
    }
    
    for (const repo of config.repos) {
      if (!repo.name || !repo.git || !repo.branch) {
        throw new Error(t('config.invalid', { error: 'repo missing fields: name, git, branch' }))
      }
    }
    
    // 验证默认配置
    const { defaults } = config
    if (!defaults.mode || !['write', 'append', 'merge'].includes(defaults.mode)) {
      throw new Error(t('config.invalid', { error: 'defaults.mode must be write|append|merge' }))
    }
  }
  
  /**
   * 保存配置到文件
   */
  async saveConfig(
    configPath: string, 
    config: ProjectConfig | GlobalConfig
  ): Promise<void> {
    try {
      this.validateConfig(config)
      await writeYamlFile(configPath, config)
      logger.debug(t('config.created', { path: configPath }))
    } catch (error: any) {
      throw new ConfigValidationError(
        t('error.file.write_failed', { path: `${configPath} - ${error.message}` })
      )
    }
  }
  
  /**
   * 添加仓库到配置
   */
  async addRepoToConfig(
    resolvedConfig: ResolvedConfig,
    repo: RepoConfig
  ): Promise<void> {
    const config = resolvedConfig.config
    
    // 检查仓库是否已存在
    const existingRepo = config.repos.find(r => r.name === repo.name)
    if (existingRepo) {
      throw new ConfigValidationError(t('repo.add.exists', { name: repo.name }))
    }
    
    // 添加仓库
    config.repos.push(repo)
    
    // 如果是第一个仓库且没有设置默认仓库，则设为默认
    if (config.repos.length === 1 && !config.defaults.repo) {
      config.defaults.repo = repo.name
    }
    
    // 保存配置
    await this.saveConfig(resolvedConfig.path, config)
  }
  
  /**
   * 从配置中移除仓库
   */
  async removeRepoFromConfig(
    resolvedConfig: ResolvedConfig,
    repoName: string
  ): Promise<void> {
    const config = resolvedConfig.config
    
    // 查找仓库
    const repoIndex = config.repos.findIndex(r => r.name === repoName)
    if (repoIndex === -1) {
      throw new RepoNotFoundError(t('repo.remove.notfound', { alias: repoName }))
    }
    
    // 移除仓库
    config.repos.splice(repoIndex, 1)
    
    // 如果移除的是默认仓库，清除默认设置或设为第一个仓库
    if (config.defaults.repo === repoName) {
      config.defaults.repo = config.repos.length > 0 ? config.repos[0].name : ''
    }
    
    // 保存配置
    await this.saveConfig(resolvedConfig.path, config)
  }
  
  /**
   * 更新仓库配置
   */
  async updateRepoInConfig(
    resolvedConfig: ResolvedConfig,
    repoName: string,
    updates: Partial<RepoConfig>
  ): Promise<void> {
    const config = resolvedConfig.config
    
    // 查找仓库
    const repo = config.repos.find(r => r.name === repoName)
    if (!repo) {
      throw new RepoNotFoundError(t('repo.remove.notfound', { alias: repoName }))
    }
    
    // 更新仓库配置
    Object.assign(repo, updates)
    
    // 保存配置
    await this.saveConfig(resolvedConfig.path, config)
  }
  
  /**
   * 根据别名或默认设置解析仓库
   */
  resolveRepo(
    config: ProjectConfig | GlobalConfig,
    repoAlias?: string
  ): RepoConfig {
    // 如果指定了别名，直接查找
    if (repoAlias) {
      const repo = config.repos.find(r => r.name === repoAlias)
      if (!repo) {
        throw new RepoNotFoundError(
          `仓库不存在: ${repoAlias}。使用 'ac repo list' 查看可用仓库`
        )
      }
      return repo
    }
    
    // 使用默认仓库
    if (config.defaults.repo) {
      const repo = config.repos.find(r => r.name === config.defaults.repo)
      if (repo) {
        return repo
      }
    }
    
    // 使用第一个仓库
    if (config.repos.length > 0) {
      return config.repos[0]
    }
    
    throw new RepoNotFoundError(t('repo.list.no_repos'))
  }
  
  /**
   * 获取配置摘要信息
   */
  getConfigSummary(resolvedConfig: ResolvedConfig): {
    source: string
    path: string
    repoCount: number
    defaultRepo?: string
    defaultMode: string
  } {
    const config = resolvedConfig.config
    
    return {
      source: resolvedConfig.source === 'project' ? t('config.source.project') : t('config.source.global'),
      path: resolvedConfig.path,
      repoCount: config.repos.length,
      defaultRepo: config.defaults.repo || undefined,
      defaultMode: config.defaults.mode
    }
  }
}

// 全局配置服务实例
export const configService = new ConfigService()
