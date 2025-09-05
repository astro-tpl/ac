/**
 * Repository Service - Manage template repository CRUD operations
 */

import { cloneRepository, updateRepository, getRepositoryInfo } from '../infra/git'
import { removeDir, isDirectory } from '../infra/fs'
import { configService } from './config.service'
import { indexCache, rebuildTemplateIndex } from '../infra/index-cache'
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
 * Repository Service Class
 */
export class RepoService {
  /**
   * Add repository
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
    
    // Validate Git URL
    if (!isValidGitUrl(gitUrl)) {
      throw new ConfigValidationError(t('error.git.invalid_url', { url: gitUrl }))
    }
    
    const normalizedUrl = normalizeGitUrl(gitUrl)
    const repoName = name || inferRepoAlias(normalizedUrl)
    const repoPath = getRepoPath(repoName)
    
    // Resolve configuration
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    
    // Check if repository already exists in configuration
    const existingRepo = resolvedConfig.config.repos.find(r => r.name === repoName)
    if (existingRepo) {
      // Repository exists in config, check if local directory exists
      if (await isDirectory(repoPath)) {
        logger.info(t('repo.add.exists', { name: repoName }))
        return { repo: existingRepo, isNew: false }
      } else {
        // Config exists but local directory doesn't exist, re-clone
        logger.info(t('repo.add.cloning', { alias: repoName, url: normalizedUrl }))
      }
    }
    
    // Create repository configuration
    const repoConfig: RepoConfig = {
      name: repoName,
      git: normalizedUrl,
      branch
    }
    
    try {
      // Clone repository
      logger.info(t('repo.add.cloning', { alias: repoName, url: normalizedUrl }))
      await cloneRepository(normalizedUrl, repoPath, branch)
      
      // Add to configuration (if not exists)
      if (!existingRepo) {
        await configService.addRepoToConfig(resolvedConfig, repoConfig)
        logger.success(t('repo.add.success', { name: repoName }))
      } else {
        logger.success(t('common.success'))
      }
      
      // Clear index cache, force rebuild
      await indexCache.clearCache()
      
      // Rebuild index to ensure cache is up-to-date
      const resolvedConfigForIndex = await configService.resolveConfig({ forceGlobal })
      await rebuildTemplateIndex(resolvedConfigForIndex.config.repos)
      logger.info(t('repo.add.index_refreshed'))
      
      return { repo: repoConfig, isNew: !existingRepo }
    } catch (error: any) {
      logger.error(t('repo.add.failed'), error)
      throw new GitOperationError(`${t('repo.add.failed')}: ${error.message}`)
    }
  }
  
  /**
   * List all repositories
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
   * Update repository
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
    
    // Determine which repositories to update
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
          // Repository doesn't exist, re-clone
          logger.debug(t('repo.list.status.not_exists'))
          await cloneRepository(repo.git, repoPath, repo.branch)
        } else {
          // Update existing repository
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
    
    // Clear index cache, force rebuild
    await indexCache.clearCache()
    
    // Rebuild index to ensure cache is up-to-date
    const resolvedConfigForIndex = await configService.resolveConfig({ forceGlobal })
    await rebuildTemplateIndex(resolvedConfigForIndex.config.repos)
    
    return { updated: results }
  }
  
  /**
   * Remove repository
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
    
    // Check if repository exists
    const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
    if (!repo) {
      throw new RepoNotFoundError(t('repo.remove.notfound', { alias: repoName }))
    }
    
    let removedFromConfig = false
    let removedLocalDir = false
    
    try {
      // Remove from configuration
      await configService.removeRepoFromConfig(resolvedConfig, repoName)
      removedFromConfig = true
      logger.success(t('repo.remove.success_config', { name: repoName }))
      
      // Remove local directory (if requested)
      if (removeLocal) {
        const repoPath = getRepoPath(repoName)
        if (await isDirectory(repoPath)) {
          await removeDir(repoPath)
          removedLocalDir = true
          logger.success(t('repo.remove.success_local', { name: repoName }))
        }
      }
      
      // Clear index cache
      await indexCache.clearCache()
      
      // Rebuild index to ensure cache is up-to-date
      const resolvedConfigForIndex = await configService.resolveConfig({ forceGlobal })
      await rebuildTemplateIndex(resolvedConfigForIndex.config.repos)
      
      return {
        removedFromConfig,
        removedLocal: removedLocalDir
      }
    } catch (error: any) {
      throw new GitOperationError(t('repo.remove.failed'))
    }
  }
  
  /**
   * Get repository detailed information
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
      logger.debug(t('repo.debug.status_failed', { name: repoName, error: error.message }))
    }
    
    return {
      config: repo,
      localPath,
      status
    }
  }
  
  /**
   * Validate integrity of all repositories
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
          ? t('repo.validation.local_not_exists') 
          : t('repo.validation.invalid_git_repo')
        
        let fixed = false
        
        if (autoFix) {
          try {
            logger.info(t('repo.validation.fixing_repo', { name: repo.name }))
            await cloneRepository(repo.git, repo.localPath, repo.branch)
            valid.push(repo.name)
            fixed = true
          } catch (fixError: any) {
            logger.warn(t('repo.validation.fix_failed', { name: repo.name, error: fixError.message }))
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

// Global repository service instance
export const repoService = new RepoService()
