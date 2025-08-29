/**
 * JSON 浅合并工具
 */

import { readFile, atomicWriteFile } from './fs'
import { MergeNotSupportedError, FileOperationError } from '../types/errors'
import { logger } from './logger'

/**
 * 检查文件是否为 JSON 格式
 */
export function isJsonFile(filepath: string): boolean {
  return filepath.toLowerCase().endsWith('.json')
}

/**
 * 安全解析 JSON 字符串
 */
export function parseJsonSafely(content: string): any {
  try {
    return JSON.parse(content)
  } catch (error: any) {
    throw new FileOperationError(
      `JSON 格式错误: ${error.message}`
    )
  }
}

/**
 * 格式化 JSON 字符串
 */
export function stringifyJson(data: any): string {
  return JSON.stringify(data, null, 2)
}

/**
 * 执行 JSON 对象的浅合并
 * 只合并第一层属性，深层嵌套对象会被完全替换
 */
export function mergeJsonObjects(target: any, source: any): any {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    throw new MergeNotSupportedError(
      'JSON 合并只支持普通对象（非数组、非 null、非基础类型）'
    )
  }
  
  const result = { ...target }
  
  for (const [key, value] of Object.entries(source)) {
    result[key] = value
  }
  
  return result
}

/**
 * 检查是否为普通对象（非数组、非 null）
 */
function isPlainObject(obj: any): boolean {
  return obj !== null && 
         typeof obj === 'object' && 
         !Array.isArray(obj) &&
         obj.constructor === Object
}

/**
 * 分析合并差异
 */
export function analyzeJsonMergeDiff(target: any, source: any): {
  added: string[]
  modified: string[]
  unchanged: string[]
} {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return { added: [], modified: [], unchanged: [] }
  }
  
  const added: string[] = []
  const modified: string[] = []
  const unchanged: string[] = []
  
  const targetKeys = new Set(Object.keys(target))
  const sourceKeys = new Set(Object.keys(source))
  
  // 检查源对象的每个键
  for (const key of sourceKeys) {
    if (!targetKeys.has(key)) {
      added.push(key)
    } else if (JSON.stringify(target[key]) !== JSON.stringify(source[key])) {
      modified.push(key)
    } else {
      unchanged.push(key)
    }
  }
  
  return { added, modified, unchanged }
}

/**
 * 合并 JSON 文件
 */
export async function mergeJsonFile(
  filepath: string, 
  newContent: string,
  options: {
    createIfNotExists?: boolean
  } = {}
): Promise<{
  success: boolean
  diff: {
    added: string[]
    modified: string[]
    unchanged: string[]
  }
}> {
  if (!isJsonFile(filepath)) {
    throw new MergeNotSupportedError(
      `文件不是 JSON 格式: ${filepath}`
    )
  }
  
  const { createIfNotExists = true } = options
  
  // 解析新内容
  const sourceData = parseJsonSafely(newContent)
  
  let targetData: any = {}
  let fileExists = false
  
  try {
    // 尝试读取现有文件
    const existingContent = await readFile(filepath)
    targetData = parseJsonSafely(existingContent)
    fileExists = true
  } catch (error: any) {
    if (!createIfNotExists) {
      throw new FileOperationError(
        `目标文件不存在且不允许创建: ${filepath}`
      )
    }
    // 文件不存在，使用空对象作为目标
    logger.debug(`目标文件不存在，将创建新文件: ${filepath}`)
  }
  
  // 分析差异
  const diff = analyzeJsonMergeDiff(targetData, sourceData)
  
  // 执行合并
  const mergedData = mergeJsonObjects(targetData, sourceData)
  
  // 写入合并结果
  const mergedContent = stringifyJson(mergedData)
  await atomicWriteFile(filepath, mergedContent)
  
  logger.debug(`JSON 合并完成: ${filepath}`)
  logger.debug(`- 新增键: ${diff.added.length}`)
  logger.debug(`- 修改键: ${diff.modified.length}`)
  logger.debug(`- 不变键: ${diff.unchanged.length}`)
  
  return {
    success: true,
    diff
  }
}

/**
 * 预览 JSON 合并结果（不实际写入文件）
 */
export async function previewJsonMerge(
  filepath: string,
  newContent: string
): Promise<{
  canMerge: boolean
  error?: string
  diff?: {
    added: string[]
    modified: string[]
    unchanged: string[]
  }
  preview?: string
}> {
  try {
    if (!isJsonFile(filepath)) {
      return {
        canMerge: false,
        error: `文件不是 JSON 格式: ${filepath}`
      }
    }
    
    // 解析新内容
    const sourceData = parseJsonSafely(newContent)
    
    let targetData: any = {}
    
    try {
      const existingContent = await readFile(filepath)
      targetData = parseJsonSafely(existingContent)
    } catch {
      // 文件不存在或解析失败，使用空对象
    }
    
    // 分析差异
    const diff = analyzeJsonMergeDiff(targetData, sourceData)
    
    // 生成预览
    const mergedData = mergeJsonObjects(targetData, sourceData)
    const preview = stringifyJson(mergedData)
    
    return {
      canMerge: true,
      diff,
      preview
    }
  } catch (error: any) {
    return {
      canMerge: false,
      error: error.message
    }
  }
}

/**
 * 验证 JSON 内容是否可以安全合并
 */
export function canSafelyMergeJson(content: string): {
  canMerge: boolean
  error?: string
} {
  try {
    const data = parseJsonSafely(content)
    
    if (!isPlainObject(data)) {
      return {
        canMerge: false,
        error: 'JSON 内容必须是普通对象（非数组、非基础类型）'
      }
    }
    
    return { canMerge: true }
  } catch (error: any) {
    return {
      canMerge: false,
      error: error.message
    }
  }
}
