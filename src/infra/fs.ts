/**
 * File system operation utility
 */

import {promises as fs} from 'node:fs'
import {dirname, join} from 'node:path'

import {FILE_ENCODING, TEMP_FILE_SUFFIX} from '../config/constants'
import {t} from '../i18n'
import {FileOperationError} from '../types/errors'

/**
 * Atomic write file (write temp file first, then rename)
 */
export async function atomicWriteFile(filepath: string, content: string): Promise<void> {
  const tempPath = filepath + TEMP_FILE_SUFFIX

  try {
    // Ensure directory exists
    await ensureDir(dirname(filepath))

    // Write temp file
    await fs.writeFile(tempPath, content, FILE_ENCODING)

    // Atomic rename
    await fs.rename(tempPath, filepath)
  } catch (error: any) {
    // Clean up temp file
    try {
      await fs.unlink(tempPath)
    } catch {
      // Ignore cleanup errors
    }

    throw new FileOperationError(
      t('fs.error.write_failed', {error: error.message, file: filepath}),
    )
  }
}

/**
 * Read file content
 */
export async function readFile(filepath: string): Promise<string> {
  try {
    return await fs.readFile(filepath, FILE_ENCODING)
  } catch (error: any) {
    throw new FileOperationError(
      t('fs.error.read_failed', {error: error.message, file: filepath}),
    )
  }
}

/**
 * Ensure directory exists (create recursively)
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, {recursive: true})
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw new FileOperationError(
        t('fs.error.create_dir_failed', {dir: dirPath, error: error.message}),
      )
    }
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath)
    return true
  } catch {
    return false
  }
}

/**
 * Check if path is a directory
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Check if path is a file
 */
export async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path)
    return stats.isFile()
  } catch {
    return false
  }
}

/**
 * Get file status information
 */
export async function getFileStats(filepath: string): Promise<{
  isDirectory: boolean
  isFile: boolean
  mtime: Date
  size: number
} | null> {
  try {
    const stats = await fs.stat(filepath)
    return {
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      mtime: stats.mtime,
      size: stats.size,
    }
  } catch {
    return null
  }
}

/**
 * Recursively scan files in directory
 */
export async function scanDirectory(
  dirPath: string,
  options: {
    extensions?: string[]
    includeHidden?: boolean
    recursive?: boolean
  } = {},
): Promise<string[]> {
  const {extensions, includeHidden = false, recursive = true} = options
  const results: string[] = []

  try {
    const entries = await fs.readdir(dirPath, {withFileTypes: true})

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      // Skip hidden files (unless explicitly included)
      if (!includeHidden && entry.name.startsWith('.')) {
        continue
      }

      if (entry.isDirectory()) {
        if (recursive) {
          const subResults = await scanDirectory(fullPath, options)
          results.push(...subResults)
        }
      } else if (entry.isFile() // Check file extension
        && (!extensions || extensions.some(ext => entry.name.endsWith(ext)))) {
        results.push(fullPath)
      }
    }

    return results.sort()
  } catch (error: any) {
    throw new FileOperationError(
      t('fs.error.scan_dir_failed', {dir: dirPath, error: error.message}),
    )
  }
}

/**
 * Delete file
 */
export async function removeFile(filepath: string): Promise<void> {
  try {
    await fs.unlink(filepath)
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw new FileOperationError(
        t('fs.error.delete_file_failed', {error: error.message, file: filepath}),
      )
    }
  }
}

/**
 * Recursively delete directory
 */
export async function removeDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, {force: true, recursive: true})
  } catch (error: any) {
    throw new FileOperationError(
      t('fs.error.delete_dir_failed', {dir: dirPath, error: error.message}),
    )
  }
}

/**
 * Copy file
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  try {
    await ensureDir(dirname(dest))
    await fs.copyFile(src, dest)
  } catch (error: any) {
    throw new FileOperationError(
      t('fs.error.copy_file_failed', {dest, error: error.message, src}),
    )
  }
}
