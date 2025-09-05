/**
 * Git operations wrapper
 */

import { simpleGit, SimpleGit, CleanOptions } from 'simple-git'
import { ensureDir, fileExists, isDirectory } from './fs'
import { GitOperationError } from '../types/errors'
import { logger } from './logger'
import { t } from '../i18n'

/**
 * Git repository operations class
 */
export class GitRepository {
  private git: SimpleGit
  
  constructor(private repoPath: string) {
    this.git = simpleGit(repoPath)
  }
  
  /**
   * Check if it's a valid Git repository
   */
  async isValidRepo(): Promise<boolean> {
    try {
      await this.git.checkIsRepo()
      return true
    } catch {
      return false
    }
  }
  
  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status()
      return status.current || 'main'
    } catch (error: any) {
      throw new GitOperationError(
        t('error.git.get_branch_failed', { path: this.repoPath, error: error.message })
      )
    }
  }
  
  /**
   * Pull latest code
   */
  async pull(branch: string = 'main'): Promise<void> {
    try {
      logger.debug(t('common.loading'))
      await this.git.pull('origin', branch)
      logger.debug(t('common.done'))
    } catch (error: any) {
      throw new GitOperationError(
        t('error.git.pull_failed', { error: `${this.repoPath} - ${error.message}` })
      )
    }
  }
  
  /**
   * Get latest commit information
   */
  async getLastCommit(): Promise<{
    hash: string
    date: Date
    message: string
    author: string
  }> {
    try {
      const log = await this.git.log(['-1'])
      const latest = log.latest
      
      if (!latest) {
        throw new Error(t('repo.list.status.not_exists'))
      }
      
      return {
        hash: latest.hash,
        date: new Date(latest.date),
        message: latest.message,
        author: latest.author_name
      }
    } catch (error: any) {
      throw new GitOperationError(
        t('error.git.pull_failed', { error: `${this.repoPath} - ${error.message}` })
      )
    }
  }
  
  /**
   * Check if there are uncommitted changes
   */
  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git.status()
      return status.files.length > 0
    } catch (error: any) {
      throw new GitOperationError(
        t('error.git.check_status_failed', { path: this.repoPath, error: error.message })
      )
    }
  }
  
  /**
   * Switch to specified branch
   */
  async checkout(branch: string): Promise<void> {
    try {
      logger.debug(`${branch}`)
      await this.git.checkout(branch)
    } catch (error: any) {
      throw new GitOperationError(
        t('error.git.pull_failed', { error: `${this.repoPath} - ${error.message}` })
      )
    }
  }
  
  /**
   * Get remote URL
   */
  async getRemoteUrl(): Promise<string> {
    try {
      const remotes = await this.git.getRemotes(true)
      const origin = remotes.find(remote => remote.name === 'origin')
      
      if (!origin?.refs?.fetch) {
        throw new Error(t('repo.list.status.not_exists'))
      }
      
      return origin.refs.fetch
    } catch (error: any) {
      throw new GitOperationError(
        t('error.git.pull_failed', { error: `${this.repoPath} - ${error.message}` })
      )
    }
  }
}

/**
 * Clone Git repository
 */
export async function cloneRepository(
  gitUrl: string, 
  targetPath: string, 
  branch: string = 'main'
): Promise<GitRepository> {
  try {
    // If target directory exists and is a valid git repository, return directly
    if (await isDirectory(targetPath)) {
      const repo = new GitRepository(targetPath)
      if (await repo.isValidRepo()) {
        logger.debug(t('repo.list.status.normal'))
        return repo
      } else {
        // Directory exists but is not a valid git repository, delete it
        const fs = await import('node:fs/promises')
        await fs.rm(targetPath, { recursive: true, force: true })
      }
    }
    
    // Ensure parent directory of target directory exists
    const path = await import('node:path')
    const parentDir = path.dirname(targetPath)
    await ensureDir(parentDir)
    
    logger.info(t('repo.add.cloning', { alias: (targetPath.split('/').pop() || targetPath), url: gitUrl }))
    
    const git = simpleGit()
    await git.clone(gitUrl, targetPath, ['--branch', branch, '--single-branch'])
    
    logger.success(t('common.done'))
    
    return new GitRepository(targetPath)
  } catch (error: any) {
    throw new GitOperationError(t('error.git.clone_failed', { error: `${gitUrl} -> ${targetPath} - ${error.message}` }))
  }
}

/**
 * Update existing repository
 */
export async function updateRepository(
  repoPath: string, 
  branch: string = 'main'
): Promise<void> {
  if (!await isDirectory(repoPath)) {
    throw new GitOperationError(t('repo.list.status.not_exists'))
  }
  
  const repo = new GitRepository(repoPath)
  
  if (!await repo.isValidRepo()) {
    throw new GitOperationError(t('repo.list.status.invalid'))
  }
  
  // Switch to specified branch (if not current branch)
  const currentBranch = await repo.getCurrentBranch()
  if (currentBranch !== branch) {
    await repo.checkout(branch)
  }
  
  // Pull latest code
  await repo.pull(branch)
}

/**
 * Get repository information
 */
export async function getRepositoryInfo(repoPath: string): Promise<{
  isValid: boolean
  currentBranch?: string
  lastCommit?: {
    hash: string
    date: Date
    message: string
    author: string
  }
  remoteUrl?: string
  hasUncommittedChanges?: boolean
}> {
  if (!await isDirectory(repoPath)) {
    return { isValid: false }
  }
  
  const repo = new GitRepository(repoPath)
  
  if (!await repo.isValidRepo()) {
    return { isValid: false }
  }
  
  try {
    const [currentBranch, lastCommit, remoteUrl, hasUncommittedChanges] = await Promise.all([
      repo.getCurrentBranch(),
      repo.getLastCommit(),
      repo.getRemoteUrl(),
      repo.hasUncommittedChanges()
    ])
    
    return {
      isValid: true,
      currentBranch,
      lastCommit,
      remoteUrl,
      hasUncommittedChanges
    }
  } catch (error: any) {
    throw new GitOperationError(t('error.git.pull_failed', { error: `${repoPath} - ${error.message}` }))
  }
}

/**
 * Validate Git URL format
 */
export function isValidGitUrl(url: string): boolean {
  // Support https and ssh formats
  const httpsPattern = /^https:\/\/[^/]+\/[^/]+\/[^/]+\.git$/i
  const sshPattern = /^git@[^:]+:[^/]+\/[^/]+\.git$/i
  const githubShortPattern = /^[^/]+\/[^/]+$/  // user/repo format
  
  return httpsPattern.test(url) || sshPattern.test(url) || githubShortPattern.test(url)
}

/**
 * Normalize Git URL (convert short format to full URL)
 */
export function normalizeGitUrl(url: string): string {
  // If it's user/repo format, convert to GitHub HTTPS URL
  if (/^[^/]+\/[^/]+$/.test(url)) {
    return `https://github.com/${url}.git`
  }
  
  // Ensure it ends with .git
  if (!url.endsWith('.git')) {
    return `${url}.git`
  }
  
  return url
}
