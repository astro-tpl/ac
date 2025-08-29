/**
 * Git 操作封装
 */

import { simpleGit, SimpleGit, CleanOptions } from 'simple-git'
import { ensureDir, fileExists, isDirectory } from './fs.js'
import { GitOperationError } from '../types/errors.js'
import { logger } from './logger.js'

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
      logger.debug(`正在拉取仓库更新: ${this.repoPath}`)
      await this.git.pull('origin', branch)
      logger.debug(`仓库更新完成: ${this.repoPath}`)
    } catch (error: any) {
      throw new GitOperationError(
        `拉取仓库失败: ${this.repoPath} - ${error.message}`
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
        throw new Error('仓库没有提交记录')
      }
      
      return {
        hash: latest.hash,
        date: new Date(latest.date),
        message: latest.message,
        author: latest.author_name
      }
    } catch (error: any) {
      throw new GitOperationError(
        `获取提交信息失败: ${this.repoPath} - ${error.message}`
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
      logger.debug(`切换到分支: ${branch}`)
      await this.git.checkout(branch)
    } catch (error: any) {
      throw new GitOperationError(
        `切换分支失败: ${this.repoPath} - ${error.message}`
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
        throw new Error('未找到 origin 远程地址')
      }
      
      return origin.refs.fetch
    } catch (error: any) {
      throw new GitOperationError(
        `获取远程地址失败: ${this.repoPath} - ${error.message}`
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
    // 确保目标目录的父目录存在
    await ensureDir(targetPath)
    
    // 如果目标目录已存在且是有效的 git 仓库，则直接返回
    if (await isDirectory(targetPath)) {
      const repo = new GitRepository(targetPath)
      if (await repo.isValidRepo()) {
        logger.debug(`仓库已存在: ${targetPath}`)
        return repo
      }
    }
    
    logger.info(`正在克隆仓库: ${gitUrl}`)
    
    const git = simpleGit()
    await git.clone(gitUrl, targetPath, ['--branch', branch, '--single-branch'])
    
    logger.success(`仓库克隆完成: ${targetPath}`)
    
    return new GitRepository(targetPath)
  } catch (error: any) {
    throw new GitOperationError(
      `克隆仓库失败: ${gitUrl} -> ${targetPath} - ${error.message}`
    )
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
    throw new GitOperationError(`仓库目录不存在: ${repoPath}`)
  }
  
  const repo = new GitRepository(repoPath)
  
  if (!await repo.isValidRepo()) {
    throw new GitOperationError(`无效的 Git 仓库: ${repoPath}`)
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
    throw new GitOperationError(
      `获取仓库信息失败: ${repoPath} - ${error.message}`
    )
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
