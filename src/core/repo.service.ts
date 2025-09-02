/**
 * 仓库服务 - 管理模板仓库的增删改查
 */

import { cloneRepository, updateRepository, getRepositoryInfo } from '../infra/git'
import { removeDir, isDirectory } from '../infra/fs'
import { configService } from './config.service'
import { indexCache } from '../infra/index-cache'
import { getRepoPath, inferRepoAlias } from '../config/paths'
import { normalizeGitUrl, isValidGitUrl } from '../infra/git'
import { RepoConfig, ResolvedConfig } from '../types/config'
import { 
  RepoNotFoundError, 
  GitOperationError,
  ConfigValidationError 
} from '../types/errors'
import { logger, createProgress } from '../infra/logger'
import { t } from '../i18n'

/**
 * 仓库服务类
 */
export class RepoService {
  /**
   * 添加仓库
   */
  async addRepo(options: {
    gitUrl: string
    name?: string
    branch?: string
    forceGlobal?: boolean
  }): Promise<{
    repo: RepoConfig
    isNew: boolean
  }> {
    const { gitUrl, name, branch = 'main', forceGlobal = false } = options
    
    // 验证 Git URL
    if (!isValidGitUrl(gitUrl)) {
      throw new ConfigValidationError(t('error.git.invalid_url', { url: gitUrl }))
    }
    
    const normalizedUrl = normalizeGitUrl(gitUrl)
    const repoName = name || inferRepoAlias(normalizedUrl)
    const repoPath = getRepoPath(repoName)
    
    // 解析配置
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    
    // 检查仓库是否已存在于配置中
    const existingRepo = resolvedConfig.config.repos.find(r => r.name === repoName)
    if (existingRepo) {
      // 仓库已在配置中，检查本地是否存在
      if (await isDirectory(repoPath)) {
        logger.info(t('repo.add.exists', { name: repoName }))
        return { repo: existingRepo, isNew: false }
      } else {
        // 配置存在但本地目录不存在，重新克隆
        logger.info(t('repo.add.cloning', { alias: repoName, url: normalizedUrl }))
      }
    }
    
    // 创建仓库配置
    const repoConfig: RepoConfig = {
      name: repoName,
      git: normalizedUrl,
      branch
    }
    
    try {
      // 克隆仓库
      logger.info(t('repo.add.cloning', { alias: repoName, url: normalizedUrl }))
      await cloneRepository(normalizedUrl, repoPath, branch)
      
      // 添加到配置（如果不存在）
      if (!existingRepo) {
        await configService.addRepoToConfig(resolvedConfig, repoConfig)
        logger.success(t('repo.add.success', { name: repoName }))
      } else {
        logger.success(t('common.success'))
      }
      
      // 清除索引缓存，强制重建
      await indexCache.clearCache()
      
      return { repo: repoConfig, isNew: !existingRepo }
    } catch (error: any) {
      throw new GitOperationError(t('repo.add.failed'))
    }
  }
  
  /**
   * 列出所有仓库
   */
  async listRepos(options: {
    forceGlobal?: boolean
    includeStatus?: boolean
  } = {}): Promise<{
    repos: Array<RepoConfig & {
      localPath: string
      status?: {
        exists: boolean
        isValid?: boolean
        currentBranch?: string
        lastCommit?: {
          hash: string
          date: Date
          message: string
          author: string
        }
        hasUncommittedChanges?: boolean
      }
    }>
    configSource: 'project' | 'global'
    configPath: string
  }> {
    const { forceGlobal = false, includeStatus = false } = options
    
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    
    const repos = await Promise.all(
      resolvedConfig.config.repos.map(async repo => {
        const localPath = getRepoPath(repo.name)
        let status: any = undefined
        
        if (includeStatus) {
          try {
            const repoInfo = await getRepositoryInfo(localPath)
            status = {
              exists: repoInfo.isValid,
              isValid: repoInfo.isValid,
              currentBranch: repoInfo.currentBranch,
              lastCommit: repoInfo.lastCommit,
              hasUncommittedChanges: repoInfo.hasUncommittedChanges
            }
          } catch {
            status = { exists: false }
          }
        }
        
        return {
          ...repo,
          localPath,
          status
        }
      })
    )
    
    return {
      repos,
      configSource: resolvedConfig.source,
      configPath: resolvedConfig.path
    }
  }
  
  /**
   * 更新仓库
   */
  async updateRepo(options: {
    repoName?: string
    forceGlobal?: boolean
  } = {}): Promise<{
    updated: Array<{
      name: string
      success: boolean
      error?: string
    }>
  }> {
    const { repoName, forceGlobal = false } = options
    
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    
    // 确定要更新的仓库列表
    const reposToUpdate = repoName 
      ? resolvedConfig.config.repos.filter(r => r.name === repoName)
      : resolvedConfig.config.repos
    
    if (repoName && reposToUpdate.length === 0) {
      throw new RepoNotFoundError(t('repo.remove.notfound', { alias: repoName }))
    }
    
    if (reposToUpdate.length === 0) {
      logger.info(t('search.no_repos'))
      return { updated: [] }
    }
    
    const progress = createProgress(reposToUpdate.length)
    const results: Array<{ name: string; success: boolean; error?: string }> = []
    
    for (let i = 0; i < reposToUpdate.length; i++) {
      const repo = reposToUpdate[i]
      progress.update(i, t('repo.update.success_item', { name: repo.name }))
      
      try {
        const repoPath = getRepoPath(repo.name)
        
        if (!await isDirectory(repoPath)) {
          // 仓库不存在，重新克隆
          logger.debug(t('repo.list.status.not_exists'))
          await cloneRepository(repo.git, repoPath, repo.branch)
        } else {
          // 更新现有仓库
          await updateRepository(repoPath, repo.branch)
        }
        
        results.push({ name: repo.name, success: true })
      } catch (error: any) {
        logger.warn(t('repo.update.failed_item', { name: repo.name, error: error.message }))
        results.push({ 
          name: repo.name, 
          success: false, 
          error: error.message 
        })
      }
    }
    
    progress.complete(t('repo.update.success', { success: results.filter(r => r.success).length, total: results.length }))
    
    // 清除索引缓存，强制重建
    await indexCache.clearCache()
    
    return { updated: results }
  }
  
  /**
   * 移除仓库
   */
  async removeRepo(options: {
    repoName: string
    forceGlobal?: boolean
    removeLocal?: boolean
  }): Promise<{
    removedFromConfig: boolean
    removedLocal: boolean
  }> {
    const { repoName, forceGlobal = false, removeLocal = false } = options
    
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    
    // 检查仓库是否存在
    const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
    if (!repo) {
      throw new RepoNotFoundError(t('repo.remove.notfound', { alias: repoName }))
    }
    
    let removedFromConfig = false
    let removedLocalDir = false
    
    try {
      // 从配置中移除
      await configService.removeRepoFromConfig(resolvedConfig, repoName)
      removedFromConfig = true
      logger.success(t('repo.remove.success_config', { name: repoName }))
      
      // 移除本地目录（如果请求）
      if (removeLocal) {
        const repoPath = getRepoPath(repoName)
        if (await isDirectory(repoPath)) {
          await removeDir(repoPath)
          removedLocalDir = true
          logger.success(t('repo.remove.success_local', { name: repoName }))
        }
      }
      
      // 清除索引缓存
      await indexCache.clearCache()
      
      return {
        removedFromConfig,
        removedLocal: removedLocalDir
      }
    } catch (error: any) {
      throw new GitOperationError(t('repo.remove.failed'))
    }
  }
  
  /**
   * 获取仓库详细信息
   */
  async getRepoInfo(repoName: string, options: {
    forceGlobal?: boolean
  } = {}): Promise<{
    config: RepoConfig
    localPath: string
    status: {
      exists: boolean
      isValid?: boolean
      currentBranch?: string
      remoteUrl?: string
      lastCommit?: {
        hash: string
        date: Date
        message: string
        author: string
      }
      hasUncommittedChanges?: boolean
    }
  }> {
    const { forceGlobal = false } = options
    
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    
    const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
    if (!repo) {
      throw new RepoNotFoundError(t('repo.remove.notfound', { alias: repoName }))
    }
    
    const localPath = getRepoPath(repoName)
    let status: any = { exists: false }
    
    try {
      const repoInfo = await getRepositoryInfo(localPath)
      status = {
        exists: repoInfo.isValid,
        isValid: repoInfo.isValid,
        currentBranch: repoInfo.currentBranch,
        remoteUrl: repoInfo.remoteUrl,
        lastCommit: repoInfo.lastCommit,
        hasUncommittedChanges: repoInfo.hasUncommittedChanges
      }
    } catch (error: any) {
      logger.debug(`获取仓库状态失败 ${repoName}: ${error.message}`)
    }
    
    return {
      config: repo,
      localPath,
      status
    }
  }
  
  /**
   * 验证所有仓库的完整性
   */
  async validateRepos(options: {
    forceGlobal?: boolean
    autoFix?: boolean
  } = {}): Promise<{
    valid: string[]
    invalid: Array<{
      name: string
      error: string
      fixed?: boolean
    }>
  }> {
    const { forceGlobal = false, autoFix = false } = options
    
    const { repos } = await this.listRepos({ forceGlobal, includeStatus: true })
    
    const valid: string[] = []
    const invalid: Array<{ name: string; error: string; fixed?: boolean }> = []
    
    for (const repo of repos) {
      if (repo.status?.exists && repo.status?.isValid) {
        valid.push(repo.name)
      } else {
        const error = !repo.status?.exists 
          ? '本地目录不存在' 
          : '不是有效的 Git 仓库'
        
        let fixed = false
        
        if (autoFix) {
          try {
            logger.info(`正在修复仓库: ${repo.name}`)
            await cloneRepository(repo.git, repo.localPath, repo.branch)
            valid.push(repo.name)
            fixed = true
          } catch (fixError: any) {
            logger.warn(`修复仓库失败 ${repo.name}: ${fixError.message}`)
          }
        }
        
        invalid.push({ name: repo.name, error, fixed })
      }
    }
    
    if (autoFix && invalid.some(r => r.fixed)) {
      await indexCache.clearCache()
    }
    
    return { valid, invalid }
  }
}

// 全局仓库服务实例
export const repoService = new RepoService()
