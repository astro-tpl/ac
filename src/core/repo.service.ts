/**
 * Repository Service - Manage template repository CRUD operations
 */

import {getRepoPath, inferRepoAlias} from '../config/paths'
import {t} from '../i18n'
import {isDirectory, removeDir} from '../infra/fs'
import {
  cloneRepository, getRepositoryInfo, isValidGitUrl, normalizeGitUrl, updateRepository,
} from '../infra/git'
import {indexCache, rebuildTemplateIndex} from '../infra/index-cache'
import {createProgress, logger} from '../infra/logger'
import {RepoConfig, ResolvedConfig} from '../types/config'
import {
  ConfigValidationError,
  GitOperationError,
  RepoNotFoundError,
} from '../types/errors'
import {configService} from './config.service'

/**
 * Repository Service Class
 */
export class RepoService {
  /**
   * Add repository
   */
  async addRepo(options: {
    branch?: string
    forceGlobal?: boolean
    gitUrl: string
    name?: string
  }): Promise<{
    isNew: boolean
    repo: RepoConfig
  }> {
    const {branch = 'main', forceGlobal = false, gitUrl, name} = options

    // Validate Git URL
    if (!isValidGitUrl(gitUrl)) {
      throw new ConfigValidationError(t('error.git.invalid_url', {url: gitUrl}))
    }

    const normalizedUrl = normalizeGitUrl(gitUrl)
    const repoName = name || inferRepoAlias(normalizedUrl)
    const repoPath = getRepoPath(repoName)

    // Resolve configuration
    const resolvedConfig = await configService.resolveConfig({forceGlobal})

    // Check if repository already exists in configuration
    const existingRepo = resolvedConfig.config.repos.find(r => r.name === repoName)
    if (existingRepo) {
      // Repository exists in config, check if local directory exists
      if (await isDirectory(repoPath)) {
        logger.info(t('repo.add.exists', {name: repoName}))
        return {isNew: false, repo: existingRepo}
      }

      // Config exists but local directory doesn't exist, re-clone
      logger.info(t('repo.add.cloning', {alias: repoName, url: normalizedUrl}))
    }

    // Create repository configuration
    const repoConfig: RepoConfig = {
      branch,
      git: normalizedUrl,
      name: repoName,
    }

    try {
      // Clone repository
      logger.info(t('repo.add.cloning', {alias: repoName, url: normalizedUrl}))
      await cloneRepository(normalizedUrl, repoPath, branch)

      // Add to configuration (if not exists)
      if (existingRepo) {
        logger.success(t('common.success'))
      } else {
        await configService.addRepoToConfig(resolvedConfig, repoConfig)
        logger.success(t('repo.add.success', {name: repoName}))
      }

      // Clear index cache, force rebuild
      await indexCache.clearCache()

      // Rebuild index to ensure cache is up-to-date
      const resolvedConfigForIndex = await configService.resolveConfig({forceGlobal})
      await rebuildTemplateIndex(resolvedConfigForIndex.config.repos)
      logger.info(t('repo.add.index_refreshed'))

      return {isNew: !existingRepo, repo: repoConfig}
    } catch (error: any) {
      logger.error(t('repo.add.failed'), error)
      throw new GitOperationError(`${t('repo.add.failed')}: ${error.message}`)
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
      currentBranch?: string
      exists: boolean
      hasUncommittedChanges?: boolean
      isValid?: boolean
      lastCommit?: {
        author: string
        date: Date
        hash: string
        message: string
      }
      remoteUrl?: string
    }
  }> {
    const {forceGlobal = false} = options

    const resolvedConfig = await configService.resolveConfig({forceGlobal})

    const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
    if (!repo) {
      throw new RepoNotFoundError(t('repo.remove.notfound', {alias: repoName}))
    }

    const localPath = getRepoPath(repoName)
    let status: any = {exists: false}

    try {
      const repoInfo = await getRepositoryInfo(localPath)
      status = {
        currentBranch: repoInfo.currentBranch,
        exists: repoInfo.isValid,
        hasUncommittedChanges: repoInfo.hasUncommittedChanges,
        isValid: repoInfo.isValid,
        lastCommit: repoInfo.lastCommit,
        remoteUrl: repoInfo.remoteUrl,
      }
    } catch (error: any) {
      logger.debug(t('repo.debug.status_failed', {error: error.message, name: repoName}))
    }

    return {
      config: repo,
      localPath,
      status,
    }
  }

  /**
   * List all repositories
   */
  async listRepos(options: {
    forceGlobal?: boolean
    includeStatus?: boolean
  } = {}): Promise<{
    configPath: string
    configSource: 'global' | 'project'
    repos: Array<{
      localPath: string
      status?: {
        currentBranch?: string
        exists: boolean
        hasUncommittedChanges?: boolean
        isValid?: boolean
        lastCommit?: {
          author: string
          date: Date
          hash: string
          message: string
        }
      }
    } & RepoConfig>
  }> {
    const {forceGlobal = false, includeStatus = false} = options

    const resolvedConfig = await configService.resolveConfig({forceGlobal})

    const repos = await Promise.all(
      resolvedConfig.config.repos.map(async repo => {
        const localPath = getRepoPath(repo.name)
        let status: any

        if (includeStatus) {
          try {
            const repoInfo = await getRepositoryInfo(localPath)
            status = {
              currentBranch: repoInfo.currentBranch,
              exists: repoInfo.isValid,
              hasUncommittedChanges: repoInfo.hasUncommittedChanges,
              isValid: repoInfo.isValid,
              lastCommit: repoInfo.lastCommit,
            }
          } catch {
            status = {exists: false}
          }
        }

        return {
          ...repo,
          localPath,
          status,
        }
      }),
    )

    return {
      configPath: resolvedConfig.path,
      configSource: resolvedConfig.source,
      repos,
    }
  }

  /**
   * Remove repository
   */
  async removeRepo(options: {
    forceGlobal?: boolean
    removeLocal?: boolean
    repoName: string
  }): Promise<{
    removedFromConfig: boolean
    removedLocal: boolean
  }> {
    const {forceGlobal = false, removeLocal = false, repoName} = options

    const resolvedConfig = await configService.resolveConfig({forceGlobal})

    // Check if repository exists
    const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
    if (!repo) {
      throw new RepoNotFoundError(t('repo.remove.notfound', {alias: repoName}))
    }

    let removedFromConfig = false
    let removedLocalDir = false

    try {
      // Remove from configuration
      await configService.removeRepoFromConfig(resolvedConfig, repoName)
      removedFromConfig = true
      logger.success(t('repo.remove.success_config', {name: repoName}))

      // Remove local directory (if requested)
      if (removeLocal) {
        const repoPath = getRepoPath(repoName)
        if (await isDirectory(repoPath)) {
          await removeDir(repoPath)
          removedLocalDir = true
          logger.success(t('repo.remove.success_local', {name: repoName}))
        }
      }

      // Clear index cache
      await indexCache.clearCache()

      // Rebuild index to ensure cache is up-to-date
      const resolvedConfigForIndex = await configService.resolveConfig({forceGlobal})
      await rebuildTemplateIndex(resolvedConfigForIndex.config.repos)

      return {
        removedFromConfig,
        removedLocal: removedLocalDir,
      }
    } catch {
      throw new GitOperationError(t('repo.remove.failed'))
    }
  }

  /**
   * Update repository
   */
  async updateRepo(options: {
    forceGlobal?: boolean
    repoName?: string
  } = {}): Promise<{
    updated: Array<{
      error?: string
      name: string
      success: boolean
    }>
  }> {
    const {forceGlobal = false, repoName} = options

    const resolvedConfig = await configService.resolveConfig({forceGlobal})

    // Determine which repositories to update
    const reposToUpdate = repoName
      ? resolvedConfig.config.repos.filter(r => r.name === repoName)
      : resolvedConfig.config.repos

    if (repoName && reposToUpdate.length === 0) {
      throw new RepoNotFoundError(t('repo.remove.notfound', {alias: repoName}))
    }

    if (reposToUpdate.length === 0) {
      logger.info(t('search.no_repos'))
      return {updated: []}
    }

    const progress = createProgress(reposToUpdate.length)
    const results: Array<{ error?: string; name: string; success: boolean }> = []

    for (const [i, repo] of reposToUpdate.entries()) {
      progress.update(i, t('repo.update.success_item', {name: repo.name}))

      try {
        const repoPath = getRepoPath(repo.name)

        if (await isDirectory(repoPath)) {
          // Update existing repository
          await updateRepository(repoPath, repo.branch)
        } else {
          // Repository doesn't exist, re-clone
          logger.debug(t('repo.list.status.not_exists'))
          await cloneRepository(repo.git, repoPath, repo.branch)
        }

        results.push({name: repo.name, success: true})
      } catch (error: any) {
        logger.warn(t('repo.update.failed_item', {error: error.message, name: repo.name}))
        results.push({
          error: error.message,
          name: repo.name,
          success: false,
        })
      }
    }

    progress.complete(t('repo.update.success', {success: results.filter(r => r.success).length, total: results.length}))

    // Clear index cache, force rebuild
    await indexCache.clearCache()

    // Rebuild index to ensure cache is up-to-date
    const resolvedConfigForIndex = await configService.resolveConfig({forceGlobal})
    await rebuildTemplateIndex(resolvedConfigForIndex.config.repos)

    return {updated: results}
  }

  /**
   * Validate integrity of all repositories
   */
  async validateRepos(options: {
    autoFix?: boolean
    forceGlobal?: boolean
  } = {}): Promise<{
    invalid: Array<{
      error: string
      fixed?: boolean
      name: string
    }>
    valid: string[]
  }> {
    const {autoFix = false, forceGlobal = false} = options

    const {repos} = await this.listRepos({forceGlobal, includeStatus: true})

    const valid: string[] = []
    const invalid: Array<{ error: string; fixed?: boolean; name: string }> = []

    for (const repo of repos) {
      if (repo.status?.exists && repo.status?.isValid) {
        valid.push(repo.name)
      } else {
        const error = repo.status?.exists
          ? t('repo.validation.invalid_git_repo')
          : t('repo.validation.local_not_exists')

        let fixed = false

        if (autoFix) {
          try {
            logger.info(t('repo.validation.fixing_repo', {name: repo.name}))
            await cloneRepository(repo.git, repo.localPath, repo.branch)
            valid.push(repo.name)
            fixed = true
          } catch (fixError: any) {
            logger.warn(t('repo.validation.fix_failed', {error: fixError.message, name: repo.name}))
          }
        }

        invalid.push({error, fixed, name: repo.name})
      }
    }

    if (autoFix && invalid.some(r => r.fixed)) {
      await indexCache.clearCache()
    }

    return {invalid, valid}
  }
}

// Global repository service instance
export const repoService = new RepoService()
