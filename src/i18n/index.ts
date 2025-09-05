/**
 * Internationalization module - Implemented according to lines 422-486 of specification document
 */

import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const en = JSON.parse(readFileSync(join(__dirname, 'en.json'), 'utf-8'))
const zh = JSON.parse(readFileSync(join(__dirname, 'zh.json'), 'utf-8'))

type Dict = Record<string, string>
const dicts: Record<string, Dict> = {en, zh}

let current = 'en'

/**
 * Initialize internationalization system
 * Detection priority: command line flag > config file defaults.lang > system environment variables LANG/LC_ALL/LC_MESSAGES > default en
 */
export function initI18n(lang?: string): void {
  if (lang && dicts[lang]) {
    current = lang
    return
  }

  // Detect system language environment
  const sysLang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || 'en'
  const short = sysLang.split('.')[0].split('_')[0]  // e.g. "zh_CN.UTF-8" -> "zh"
  current = dicts[short] ? short : 'en'
}

/**
 * Ensure internationalization system is initialized (use default if not configured)
 */
export function ensureI18nInitialized(): void {
  // If not initialized yet, use default language
  if (!current || current === 'en') {
    initI18n()
  }
}

/**
 * Translation function - Support parameter interpolation
 */
export function t(key: string, params?: Record<string, number | string>): string {
  const template = dicts[current][key] || dicts.en[key] || key

  if (!params) return template

  return Object.entries(params).reduce(
    (msg, [k, v]) => msg.replaceAll(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  )
}

/**
 * Get current language
 */
export function getCurrentLang(): string {
  return current
}

/**
 * Set current language
 */
export function setLang(lang: string): boolean {
  if (dicts[lang]) {
    current = lang
    return true
  }

  return false
}

/**
 * Get list of supported languages
 */
export function getSupportedLangs(): string[] {
  return Object.keys(dicts)
}
