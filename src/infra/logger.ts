/**
 * Logging and error formatting utility - Supports internationalization
 */

import {t} from '../i18n'
import {ACError} from '../types/errors'

// Log levels
export enum LogLevel {
  DEBUG = 3,
  ERROR = 0,
  INFO = 2,
  WARN = 1,
}

// Console colors
const colors = {
  blue: '\u001B[34m',
  gray: '\u001B[90m',
  green: '\u001B[32m',
  red: '\u001B[31m',
  reset: '\u001B[0m',
  yellow: '\u001B[33m',
} as const

/**
 * Simple logger
 */
export class Logger {
  constructor(public level: LogLevel = LogLevel.INFO) {}

  debug(message: string): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`${colors.gray}🔍 DEBUG:${colors.reset} ${message}`)
    }
  }

  error(message: string, error?: ACError | Error): void {
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

  info(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`${colors.blue}ℹ️  ${t('common.info')}:${colors.reset} ${message}`)
    }
  }

  plain(message: string): void {
    console.log(message)
  }

  success(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(`${colors.green}✅ ${t('common.success')}:${colors.reset} ${message}`)
    }
  }

  warn(message: string): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`${colors.yellow}⚠️  ${t('common.warning')}:${colors.reset} ${message}`)
    }
  }
}

// Global logger instance
export const logger = new Logger()

/**
 * Set log level
 */
export function setLogLevel(level: LogLevel): void {
  logger.level = level
}

/**
 * Format error message
 */
export function formatError(error: ACError | Error): string {
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
  complete: (message?: string) => void
  update: (current: number, message?: string) => void
} {
  let lastLength = 0

  return {
    complete(message = t('common.done')) {
      if (lastLength > 0) {
        process.stdout.write('\r' + ' '.repeat(lastLength) + '\r')
      }

      console.log(`${colors.green}✅ ${message}${colors.reset}`)
    },

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
  }
}
