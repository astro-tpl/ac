/**
 * 配置服务 - 逐级查找和管理配置文件
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
        source: 'global',
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
          source: 'project',
          path: projectConfigPath,
          config: projectConfig
        }
      } catch (error: any) {
        logger.warn(`项目配置文件损坏，回退到全局配置: ${error.message}`)
      }
    }
    
    // 回退到全局配置
    const globalConfig = await this.getGlobalConfig()
    return {
      source: 'global',
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
        `项目配置文件不存在: ${configPath}`
      )
    }
    
    try {
      const config = await readYamlFile<ProjectConfig>(configPath)
      this.validateConfig(config)
      return config
    } catch (error: any) {
      throw new ConfigValidationError(
        `项目配置文件格式错误: ${configPath} - ${error.message}`
      )
    }
  }
  
  /**
   * 获取全局配置（不存在则自动创建）
   */
  async getGlobalConfig(): Promise<GlobalConfig> {
    if (!await fileExists(GLOBAL_CONFIG_PATH)) {
      logger.debug('全局配置文件不存在，正在创建默认配置')
      await this.createDefaultGlobalConfig()
    }
    
    try {
      const config = await readYamlFile<GlobalConfig>(GLOBAL_CONFIG_PATH)
      this.validateConfig(config)
      return config
    } catch (error: any) {
      logger.warn(`全局配置文件损坏，正在重新创建: ${error.message}`)
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
    logger.debug(`默认全局配置已创建: ${GLOBAL_CONFIG_PATH}`)
  }
  
  /**
   * 验证配置格式
   */
  private validateConfig(config: ProjectConfig | GlobalConfig): void {
    // 检查必需字段
    if (!config.version || !config.repos || !config.defaults) {
      throw new Error('配置文件缺少必需字段: version, repos, defaults')
    }
    
    // 检查版本兼容性
    checkVersionCompatibility(config.version)
    
    // 验证仓库配置
    if (!Array.isArray(config.repos)) {
      throw new Error('repos 字段必须是数组')
    }
    
    for (const repo of config.repos) {
      if (!repo.name || !repo.git || !repo.branch) {
        throw new Error('仓库配置缺少必需字段: name, git, branch')
      }
    }
    
    // 验证默认配置
    const { defaults } = config
    if (!defaults.mode || !['write', 'append', 'merge'].includes(defaults.mode)) {
      throw new Error('defaults.mode 必须是 write, append 或 merge')
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
      logger.debug(`配置已保存: ${configPath}`)
    } catch (error: any) {
      throw new ConfigValidationError(
        `保存配置失败: ${configPath} - ${error.message}`
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
      throw new ConfigValidationError(
        `仓库别名已存在: ${repo.name}`
      )
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
      throw new RepoNotFoundError(
        `仓库不存在: ${repoName}`
      )
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
      throw new RepoNotFoundError(
        `仓库不存在: ${repoName}`
      )
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
    
    throw new RepoNotFoundError(
      '没有可用的仓库。使用 \'ac repo add <git-url>\' 添加仓库'
    )
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
      source: resolvedConfig.source === 'project' ? '项目配置' : '全局配置',
      path: resolvedConfig.path,
      repoCount: config.repos.length,
      defaultRepo: config.defaults.repo || undefined,
      defaultMode: config.defaults.mode
    }
  }
}

// 全局配置服务实例
export const configService = new ConfigService()
