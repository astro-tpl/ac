/**
 * YAML 读写工具
 */

import * as yaml from 'js-yaml'
import { readFile, atomicWriteFile } from './fs.js'
import { ConfigValidationError, TemplateValidationError } from '../types/errors.js'

/**
 * 读取并解析 YAML 文件
 */
export async function readYamlFile<T = any>(filepath: string): Promise<T> {
  try {
    const content = await readFile(filepath)
    const parsed = yaml.load(content, {
      // 严格模式，不允许重复的 key
      json: true,
      // 不允许执行任意代码
      schema: yaml.JSON_SCHEMA
    })
    
    if (parsed === null || parsed === undefined) {
      throw new Error('YAML 文件内容为空')
    }
    
    return parsed as T
  } catch (error: any) {
    if (error.name === 'YAMLException') {
      throw new ConfigValidationError(
        `YAML 格式错误: ${filepath} - ${error.message}`
      )
    }
    throw error
  }
}

/**
 * 将对象序列化为 YAML 并写入文件
 */
export async function writeYamlFile(filepath: string, data: any): Promise<void> {
  try {
    const yamlContent = yaml.dump(data, {
      // 缩进 2 个空格
      indent: 2,
      // 使用流式格式，更紧凑
      flowLevel: -1,
      // 不对长字符串进行折行
      lineWidth: -1,
      // 不添加文档分隔符
      noRefs: true,
      // 不对 Unicode 字符进行转义
      noCompatMode: true,
      // 对字符串加引号的策略
      quotingType: '"',
      // 不强制引用
      forceQuotes: false
    })
    
    await atomicWriteFile(filepath, yamlContent)
  } catch (error: any) {
    throw new ConfigValidationError(
      `写入 YAML 文件失败: ${filepath} - ${error.message}`
    )
  }
}

/**
 * 解析 YAML 字符串
 */
export function parseYaml<T = any>(content: string): T {
  try {
    const parsed = yaml.load(content, {
      json: true,
      schema: yaml.JSON_SCHEMA
    })
    
    if (parsed === null || parsed === undefined) {
      throw new Error('YAML 内容为空')
    }
    
    return parsed as T
  } catch (error: any) {
    if (error.name === 'YAMLException') {
      throw new TemplateValidationError(
        `YAML 格式错误: ${error.message}`
      )
    }
    throw error
  }
}

/**
 * 将对象序列化为 YAML 字符串
 */
export function stringifyYaml(data: any): string {
  try {
    return yaml.dump(data, {
      indent: 2,
      flowLevel: -1,
      lineWidth: -1,
      noRefs: true,
      noCompatMode: true,
      quotingType: '"',
      forceQuotes: false
    })
  } catch (error: any) {
    throw new ConfigValidationError(
      `序列化 YAML 失败: ${error.message}`
    )
  }
}

/**
 * 验证 YAML 格式是否正确
 */
export function isValidYaml(content: string): boolean {
  try {
    yaml.load(content, {
      json: true,
      schema: yaml.JSON_SCHEMA
    })
    return true
  } catch {
    return false
  }
}

/**
 * 安全地解析 YAML（返回 null 而不是抛出异常）
 */
export function safeParseYaml<T = any>(content: string): T | null {
  try {
    return parseYaml<T>(content)
  } catch {
    return null
  }
}

/**
 * 格式化 YAML 内容（美化）
 */
export function formatYaml(content: string): string {
  try {
    const parsed = parseYaml(content)
    return stringifyYaml(parsed)
  } catch (error: any) {
    throw new ConfigValidationError(
      `格式化 YAML 失败: ${error.message}`
    )
  }
}
