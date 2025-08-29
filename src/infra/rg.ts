/**
 * Ripgrep 调用封装
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { RipgrepNotFoundError } from '../types/errors'
import { logger } from './logger'

const execAsync = promisify(exec)

/**
 * 检查 ripgrep 是否可用
 */
export async function checkRipgrepAvailable(): Promise<boolean> {
  try {
    await execAsync('rg --version')
    return true
  } catch {
    return false
  }
}

/**
 * 确保 ripgrep 可用，否则抛出错误
 */
export async function ensureRipgrepAvailable(): Promise<void> {
  if (!await checkRipgrepAvailable()) {
    throw new RipgrepNotFoundError(
      'ripgrep 未安装，--deep 搜索需要 ripgrep 支持\n' +
      '安装方法请参考: https://github.com/BurntSushi/ripgrep#installation'
    )
  }
}

/**
 * Ripgrep 搜索选项
 */
export interface RipgrepOptions {
  /** 搜索模式（正则表达式） */
  pattern: string
  /** 搜索路径 */
  paths: string[]
  /** 文件类型过滤 */
  fileTypes?: string[]
  /** 大小写敏感 */
  caseSensitive?: boolean
  /** 只返回文件名 */
  filesOnly?: boolean
  /** 最大结果数 */
  maxCount?: number
  /** 包含行号 */
  lineNumbers?: boolean
  /** 上下文行数 */
  contextLines?: number
}

/**
 * Ripgrep 搜索结果
 */
export interface RipgrepResult {
  /** 文件路径 */
  path: string
  /** 行号（如果启用） */
  lineNumber?: number
  /** 匹配的行内容 */
  content: string
  /** 匹配的列位置 */
  column?: number
}

/**
 * 使用 ripgrep 搜索文件内容
 */
export async function ripgrepSearch(options: RipgrepOptions): Promise<RipgrepResult[]> {
  await ensureRipgrepAvailable()
  
  const args = ['rg']
  
  // 基础选项
  args.push('--json')  // 使用 JSON 输出格式
  args.push('--no-heading')
  args.push('--no-messages')  // 不显示错误消息
  
  // 大小写敏感
  if (!options.caseSensitive) {
    args.push('--ignore-case')
  }
  
  // 只返回文件名
  if (options.filesOnly) {
    args.push('--files-with-matches')
  } else {
    // 包含行号
    if (options.lineNumbers) {
      args.push('--line-number')
    }
    
    // 上下文行数
    if (options.contextLines && options.contextLines > 0) {
      args.push(`--context=${options.contextLines}`)
    }
  }
  
  // 最大结果数
  if (options.maxCount && options.maxCount > 0) {
    args.push(`--max-count=${options.maxCount}`)
  }
  
  // 文件类型过滤
  if (options.fileTypes && options.fileTypes.length > 0) {
    for (const type of options.fileTypes) {
      args.push('--type', type)
    }
  }
  
  // 搜索模式
  args.push(options.pattern)
  
  // 搜索路径
  args.push(...options.paths)
  
  const command = args.join(' ')
  logger.debug(`执行 ripgrep 搜索: ${command}`)
  
  try {
    const { stdout } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024  // 10MB buffer
    })
    
    return parseRipgrepOutput(stdout)
  } catch (error: any) {
    // ripgrep 没有找到匹配时会返回退出码 1，这是正常情况
    if (error.code === 1) {
      return []
    }
    
    logger.debug(`ripgrep 搜索失败: ${error.message}`)
    throw new RipgrepNotFoundError(
      `ripgrep 搜索失败: ${error.message}`
    )
  }
}

/**
 * 解析 ripgrep JSON 输出
 */
function parseRipgrepOutput(output: string): RipgrepResult[] {
  if (!output.trim()) {
    return []
  }
  
  const results: RipgrepResult[] = []
  const lines = output.trim().split('\n')
  
  for (const line of lines) {
    try {
      const json = JSON.parse(line)
      
      // 只处理匹配类型的结果
      if (json.type === 'match') {
        const data = json.data
        results.push({
          path: data.path.text,
          lineNumber: data.line_number,
          content: data.lines.text.trim(),
          column: data.submatches?.[0]?.start
        })
      }
    } catch {
      // 忽略解析错误的行
    }
  }
  
  return results
}

/**
 * 搜索 YAML 模板文件内容
 */
export async function searchTemplateContent(
  keyword: string,
  paths: string[],
  options: {
    caseSensitive?: boolean
    maxResults?: number
  } = {}
): Promise<RipgrepResult[]> {
  const { caseSensitive = false, maxResults = 100 } = options
  
  return ripgrepSearch({
    pattern: keyword,
    paths,
    fileTypes: ['yaml', 'yml'],
    caseSensitive,
    maxCount: maxResults,
    lineNumbers: true,
    contextLines: 1
  })
}

/**
 * 搜索指定字段的内容
 */
export async function searchTemplateFields(
  keyword: string,
  paths: string[],
  fields: string[] = ['content', 'summary', 'name'],
  options: {
    caseSensitive?: boolean
    maxResults?: number
  } = {}
): Promise<RipgrepResult[]> {
  const { caseSensitive = false, maxResults = 100 } = options
  
  // 构建搜索模式，匹配指定字段
  const fieldPattern = fields.map(field => `${field}:.*${keyword}`).join('|')
  
  return ripgrepSearch({
    pattern: `(${fieldPattern})`,
    paths,
    fileTypes: ['yaml', 'yml'],
    caseSensitive,
    maxCount: maxResults,
    lineNumbers: true
  })
}

/**
 * 获取包含特定标签的模板文件
 */
export async function searchTemplatesByLabel(
  label: string,
  paths: string[]
): Promise<string[]> {
  const results = await ripgrepSearch({
    pattern: `labels:.*${label}`,
    paths,
    fileTypes: ['yaml', 'yml'],
    filesOnly: true,
    caseSensitive: false
  })
  
  return [...new Set(results.map(r => r.path))]
}
