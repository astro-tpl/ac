/**
 * 文件系统操作工具
 */

import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { FILE_ENCODING, TEMP_FILE_SUFFIX } from '../config/constants'
import { FileOperationError } from '../types/errors'

/**
 * 原子写入文件（先写临时文件，再重命名）
 */
export async function atomicWriteFile(filepath: string, content: string): Promise<void> {
  const tempPath = filepath + TEMP_FILE_SUFFIX
  
  try {
    // 确保目录存在
    await ensureDir(dirname(filepath))
    
    // 写入临时文件
    await fs.writeFile(tempPath, content, FILE_ENCODING)
    
    // 原子性重命名
    await fs.rename(tempPath, filepath)
  } catch (error: any) {
    // 清理临时文件
    try {
      await fs.unlink(tempPath)
    } catch {
      // 忽略清理错误
    }
    
    throw new FileOperationError(
      `写入文件失败: ${filepath} - ${error.message}`
    )
  }
}

/**
 * 读取文件内容
 */
export async function readFile(filepath: string): Promise<string> {
  try {
    return await fs.readFile(filepath, FILE_ENCODING)
  } catch (error: any) {
    throw new FileOperationError(
      `读取文件失败: ${filepath} - ${error.message}`
    )
  }
}

/**
 * 确保目录存在（递归创建）
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw new FileOperationError(
        `创建目录失败: ${dirPath} - ${error.message}`
      )
    }
  }
}

/**
 * 检查文件是否存在
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
 * 检查路径是否为目录
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
 * 检查路径是否为文件
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
 * 获取文件状态信息
 */
export async function getFileStats(filepath: string): Promise<{
  size: number
  mtime: Date
  isFile: boolean
  isDirectory: boolean
} | null> {
  try {
    const stats = await fs.stat(filepath)
    return {
      size: stats.size,
      mtime: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    }
  } catch {
    return null
  }
}

/**
 * 递归扫描目录中的文件
 */
export async function scanDirectory(
  dirPath: string, 
  options: {
    extensions?: string[]
    recursive?: boolean
    includeHidden?: boolean
  } = {}
): Promise<string[]> {
  const { extensions, recursive = true, includeHidden = false } = options
  const results: string[] = []
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      
      // 跳过隐藏文件（除非明确包含）
      if (!includeHidden && entry.name.startsWith('.')) {
        continue
      }
      
      if (entry.isDirectory()) {
        if (recursive) {
          const subResults = await scanDirectory(fullPath, options)
          results.push(...subResults)
        }
      } else if (entry.isFile()) {
        // 检查文件扩展名
        if (!extensions || extensions.some(ext => entry.name.endsWith(ext))) {
          results.push(fullPath)
        }
      }
    }
    
    return results.sort()
  } catch (error: any) {
    throw new FileOperationError(
      `扫描目录失败: ${dirPath} - ${error.message}`
    )
  }
}

/**
 * 删除文件
 */
export async function removeFile(filepath: string): Promise<void> {
  try {
    await fs.unlink(filepath)
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw new FileOperationError(
        `删除文件失败: ${filepath} - ${error.message}`
      )
    }
  }
}

/**
 * 递归删除目录
 */
export async function removeDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch (error: any) {
    throw new FileOperationError(
      `删除目录失败: ${dirPath} - ${error.message}`
    )
  }
}

/**
 * 复制文件
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  try {
    await ensureDir(dirname(dest))
    await fs.copyFile(src, dest)
  } catch (error: any) {
    throw new FileOperationError(
      `复制文件失败: ${src} -> ${dest} - ${error.message}`
    )
  }
}
