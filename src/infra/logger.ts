/**
 * 日志和错误格式化工具
 */

import { ACError } from '../types/errors'

// 日志级别
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// 控制台颜色
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
} as const

/**
 * 简单的日志器
 */
export class Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  error(message: string, error?: Error | ACError): void {
    if (this.level >= LogLevel.ERROR) {
      if (error instanceof ACError) {
        console.error(error.format())
      } else if (error) {
        console.error(`${colors.red}❌ 错误:${colors.reset} ${message}`)
        console.error(`${colors.gray}${error.message}${colors.reset}`)
        if (error.stack && this.level >= LogLevel.DEBUG) {
          console.error(`${colors.gray}${error.stack}${colors.reset}`)
        }
      } else {
        console.error(`${colors.red}❌ 错误:${colors.reset} ${message}`)
      }
    }
  }

  warn(message: string): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`${colors.yellow}⚠️  警告:${colors.reset} ${message}`)
    }
  }

  info(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`${colors.blue}ℹ️  信息:${colors.reset} ${message}`)
    }
  }

  success(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`${colors.green}✅ 成功:${colors.reset} ${message}`)
    }
  }

  debug(message: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`${colors.gray}🔍 调试:${colors.reset} ${message}`)
    }
  }

  plain(message: string): void {
    console.log(message)
  }
}

// 全局日志器实例
export const logger = new Logger()

/**
 * 设置日志级别
 */
export function setLogLevel(level: LogLevel): void {
  logger['level'] = level
}

/**
 * 格式化错误信息
 */
export function formatError(error: Error | ACError): string {
  if (error instanceof ACError) {
    return error.format()
  }
  
  return `❌ 错误: ${error.message}`
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * 格式化时间差
 */
export function formatTimeDiff(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }
  
  const seconds = milliseconds / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  
  const minutes = seconds / 60
  return `${minutes.toFixed(1)}m`
}

/**
 * 创建进度指示器
 */
export function createProgress(total: number): {
  update: (current: number, message?: string) => void
  complete: (message?: string) => void
} {
  let lastLength = 0
  
  return {
    update(current: number, message = '') {
      const percentage = Math.round((current / total) * 100)
      const bar = '█'.repeat(Math.round(percentage / 5))
      const empty = '░'.repeat(20 - Math.round(percentage / 5))
      const output = `[${bar}${empty}] ${percentage}% ${message}`
      
      // 清除上一行
      if (lastLength > 0) {
        process.stdout.write('\r' + ' '.repeat(lastLength) + '\r')
      }
      
      process.stdout.write(output)
      lastLength = output.length
    },
    
    complete(message = '完成') {
      if (lastLength > 0) {
        process.stdout.write('\r' + ' '.repeat(lastLength) + '\r')
      }
      console.log(`${colors.green}✅ ${message}${colors.reset}`)
    }
  }
}
