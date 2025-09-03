/**
 * Git 操作封装
 */

import { simpleGit, SimpleGit, CleanOptions } from 'simple-git'
import { ensureDir, fileExists, isDirectory } from './fs'
import { GitOperationError } from '../types/errors'
import { logger } from './logger'
import { t } from '../i18n'

/**
 * Git 仓库操作类
 */
export class GitRepository {
  private git: SimpleGit
  
  constructor(private repoPath: string) {
    this.git = simpleGit(repoPath)
  }
  
  /**
   * 检查是否为有效的 Git 仓库
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
   * 获取当前分支名
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status()
      return status.current || 'main'
    } catch (error: any) {
      throw new GitOperationError(
        `获取当前分支失败: ${this.repoPath} - ${error.message}`
      )
    }
  }
  
  /**
   * 拉取最新代码
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
   * 获取最后一次提交信息
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
   * 检查是否有未提交的更改
   */
  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git.status()
      return status.files.length > 0
    } catch (error: any) {
      throw new GitOperationError(
        `检查仓库状态失败: ${this.repoPath} - ${error.message}`
      )
    }
  }
  
  /**
   * 切换到指定分支
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
   * 获取远程 URL
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
 * 克隆 Git 仓库
 */
export async function cloneRepository(
  gitUrl: string, 
  targetPath: string, 
  branch: string = 'main'
): Promise<GitRepository> {
  try {
    // 如果目标目录已存在且是有效的 git 仓库，则直接返回
    if (await isDirectory(targetPath)) {
      const repo = new GitRepository(targetPath)
      if (await repo.isValidRepo()) {
        logger.debug(t('repo.list.status.normal'))
        return repo
      } else {
        // 目录存在但不是有效的git仓库，删除它
        const fs = await import('node:fs/promises')
        await fs.rm(targetPath, { recursive: true, force: true })
      }
    }
    
    // 确保目标目录的父目录存在
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
 * 更新已存在的仓库
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
  
  // 切换到指定分支（如果不是当前分支）
  const currentBranch = await repo.getCurrentBranch()
  if (currentBranch !== branch) {
    await repo.checkout(branch)
  }
  
  // 拉取最新代码
  await repo.pull(branch)
}

/**
 * 获取仓库信息
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
 * 验证 Git URL 格式
 */
export function isValidGitUrl(url: string): boolean {
  // 支持 https 和 ssh 格式
  const httpsPattern = /^https:\/\/[^/]+\/[^/]+\/[^/]+\.git$/i
  const sshPattern = /^git@[^:]+:[^/]+\/[^/]+\.git$/i
  const githubShortPattern = /^[^/]+\/[^/]+$/  // user/repo 格式
  
  return httpsPattern.test(url) || sshPattern.test(url) || githubShortPattern.test(url)
}

/**
 * 规范化 Git URL（将简短格式转换为完整 URL）
 */
export function normalizeGitUrl(url: string): string {
  // 如果是 user/repo 格式，转换为 GitHub HTTPS URL
  if (/^[^/]+\/[^/]+$/.test(url)) {
    return `https://github.com/${url}.git`
  }
  
  // 确保以 .git 结尾
  if (!url.endsWith('.git')) {
    return `${url}.git`
  }
  
  return url
}
