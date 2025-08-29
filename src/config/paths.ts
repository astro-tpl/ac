/**
 * 路径工具函数
 */

import { homedir } from 'node:os'
import { resolve, dirname, join, isAbsolute } from 'node:path'
import { PROJECT_CONFIG_FILENAME, REPOS_CACHE_DIR } from './constants.js'

/**
 * 展开路径中的 ~ 符号
 */
export function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return join(homedir(), filepath.slice(2))
  }
  return filepath
}

/**
 * 规范化路径（展开 ~ 并转为绝对路径）
 */
export function normalizePath(filepath: string, basePath?: string): string {
  const expanded = expandTilde(filepath)
  if (isAbsolute(expanded)) {
    return resolve(expanded)
  }
  return resolve(basePath || process.cwd(), expanded)
}

/**
 * 获取仓库本地缓存路径
 */
export function getRepoPath(alias: string): string {
  return join(REPOS_CACHE_DIR, alias)
}

/**
 * 从 git URL 推断仓库别名
 */
export function inferRepoAlias(gitUrl: string): string {
  // 提取最后一个路径段并去掉 .git 后缀
  const match = gitUrl.match(/\/([^/]+?)(?:\.git)?$/i)
  if (!match) {
    throw new Error(`无法从 Git URL 推断仓库别名: ${gitUrl}`)
  }
  return match[1]
}

/**
 * 逐级向上查找项目配置文件
 * @param startDir 开始查找的目录
 * @returns 配置文件路径，未找到则返回 null
 */
export async function findProjectConfig(startDir: string = process.cwd()): Promise<string | null> {
  const { access } = await import('node:fs/promises')
  
  let currentDir = resolve(startDir)
  const rootDir = resolve('/')
  
  while (currentDir !== rootDir) {
    const configPath = join(currentDir, PROJECT_CONFIG_FILENAME)
    try {
      await access(configPath)
      return configPath
    } catch {
      // 文件不存在，继续向上查找
    }
    
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      // 已到达文件系统根目录
      break
    }
    currentDir = parentDir
  }
  
  return null
}

/**
 * 确保目录存在（递归创建）
 */
export async function ensureDir(dirPath: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises')
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filepath: string): Promise<boolean> {
  const { access } = await import('node:fs/promises')
  try {
    await access(filepath)
    return true
  } catch {
    return false
  }
}
