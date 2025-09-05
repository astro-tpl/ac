/**
 * Logging and error formatting utility - Supports internationalization
 */

import { ACError } from '../types/errors'
import { t } from '../i18n'

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Console colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
} as const

/**
 * Simple logger
 */
export class Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  error(message: string, error?: Error | ACError): void {
    if (this.level >= LogLevel.ERROR) {
      if (error instanceof ACError) {
        console.error(error.format())
      } else if (error) {
        console.error(`${colors.red}❌ ${t('common.error')}:${colors.reset} ${message}`)
        console.error(`${colors.gray}${error.message}${colors.reset}`)
        if (error.stack && this.level >= LogLevel.DEBUG) {
          console.error(`${colors.gray}${error.stack}${colors.reset}`)
        }
      } else {
        console.error(`${colors.red}❌ ${t('common.error')}:${colors.reset} ${message}`)
      }
    }
  }

  warn(message: string): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`${colors.yellow}⚠️  ${t('common.warning')}:${colors.reset} ${message}`)
    }
  }

  info(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`${colors.blue}ℹ️  ${t('common.info')}:${colors.reset} ${message}`)
    }
  }

  success(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`${colors.green}✅ ${t('common.success')}:${colors.reset} ${message}`)
    }
  }

  debug(message: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`${colors.gray}🔍 DEBUG:${colors.reset} ${message}`)
    }
  }

  plain(message: string): void {
    console.log(message)
  }
}

// Global logger instance
export const logger = new Logger()

/**
 * Set log level
 */
export function setLogLevel(level: LogLevel): void {
  logger['level'] = level
}

/**
 * Format error message
 */
export function formatError(error: Error | ACError): string {
  if (error instanceof ACError) {
    return error.format()
  }
  
  return `❌ ${t('common.error')}: ${error.message}`
}

/**
 * Format file size
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
 * Format time difference
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
 * Create progress indicator
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
      
      // Clear previous line
      if (lastLength > 0) {
        process.stdout.write('\r' + ' '.repeat(lastLength) + '\r')
      }
      
      process.stdout.write(output)
      lastLength = output.length
    },
    
    complete(message = t('common.done')) {
      if (lastLength > 0) {
        process.stdout.write('\r' + ' '.repeat(lastLength) + '\r')
      }
      console.log(`${colors.green}✅ ${message}${colors.reset}`)
    }
  }
}
