/**
 * Path utility functions
 */

import {homedir} from 'node:os'
import {
  dirname, isAbsolute, join, resolve,
} from 'node:path'

import {t} from '../i18n'
import {PROJECT_CONFIG_FILENAME, REPOS_CACHE_DIR} from './constants'

/**
 * Expand ~ symbol in path
 */
export function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return join(homedir(), filepath.slice(2))
  }

  return filepath
}

/**
 * Normalize path (expand ~ and convert to absolute path)
 */
export function normalizePath(filepath: string, basePath?: string): string {
  const expanded = expandTilde(filepath)
  if (isAbsolute(expanded)) {
    return resolve(expanded)
  }

  return resolve(basePath || process.cwd(), expanded)
}

/**
 * Get repository local cache path
 */
export function getRepoPath(alias: string): string {
  return join(REPOS_CACHE_DIR, alias)
}

/**
 * Infer repository alias from git URL
 */
export function inferRepoAlias(gitUrl: string): string {
  // Extract last path segment and remove .git suffix
  const match = gitUrl.match(/\/([^/]+?)(?:\.git)?$/i)
  if (!match) {
    throw new Error(t('error.git.invalid_url', {url: gitUrl}))
  }

  return match[1]
}

/**
 * Search for project configuration file upward level by level
 * @param startDir Directory to start searching from
 * @returns Configuration file path, or null if not found
 */
export async function findProjectConfig(startDir: string = process.cwd()): Promise<null | string> {
  const {access} = await import('node:fs/promises')

  let currentDir = resolve(startDir)
  const rootDir = resolve('/')

  while (currentDir !== rootDir) {
    const configPath = join(currentDir, PROJECT_CONFIG_FILENAME)
    try {
      await access(configPath)
      return configPath
    } catch {
      // File doesn't exist, continue searching upward
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      // Reached filesystem root directory
      break
    }

    currentDir = parentDir
  }

  return null
}

/**
 * Ensure directory exists (create recursively)
 */
export async function ensureDir(dirPath: string): Promise<void> {
  const {mkdir} = await import('node:fs/promises')
  try {
    await mkdir(dirPath, {recursive: true})
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filepath: string): Promise<boolean> {
  const {access} = await import('node:fs/promises')
  try {
    await access(filepath)
    return true
  } catch {
    return false
  }
}
