/**
 * 国际化模块 - 根据规格文档第422-486行实现
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const en = JSON.parse(readFileSync(join(__dirname, 'en.json'), 'utf-8'))
const zh = JSON.parse(readFileSync(join(__dirname, 'zh.json'), 'utf-8'))

type Dict = Record<string, string>
const dicts: Record<string, Dict> = { en, zh }

let current = 'en'

/**
 * 初始化国际化系统
 * 检测优先级：命令行 flag > 配置文件 defaults.lang > 系统环境变量 LANG/LC_ALL/LC_MESSAGES > 默认 en
 */
export function initI18n(lang?: string): void {
  if (lang && dicts[lang]) {
    current = lang
    return
  }
  
  // 检测系统语言环境
  const sysLang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || 'en'
  const short = sysLang.split('.')[0].split('_')[0]  // e.g. "zh_CN.UTF-8" -> "zh"
  current = dicts[short] ? short : 'en'
}

/**
 * 确保国际化系统已初始化（如果没有配置则使用默认值）
 */
export function ensureI18nInitialized(): void {
  // 如果还没有初始化，使用默认语言
  if (!current || current === 'en') {
    initI18n()
  }
}

/**
 * 翻译函数 - 支持参数插值
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = dicts[current][key] || dicts['en'][key] || key
  
  if (!params) return template
  
  return Object.entries(params).reduce(
    (msg, [k, v]) => msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template
  )
}

/**
 * 获取当前语言
 */
export function getCurrentLang(): string {
  return current
}

/**
 * 设置当前语言
 */
export function setLang(lang: string): boolean {
  if (dicts[lang]) {
    current = lang
    return true
  }
  return false
}

/**
 * 获取支持的语言列表
 */
export function getSupportedLangs(): string[] {
  return Object.keys(dicts)
}
