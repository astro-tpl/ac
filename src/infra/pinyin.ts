/**
 * 拼音搜索工具 - 支持中文拼音模糊搜索
 * 根据规格文档第138行要求实现
 */

import { pinyin } from 'pinyin-pro'

/**
 * 将中文字符转换为拼音
 */
export function toPinyin(text: string): string[] {
  const result: string[] = []
  
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      // 中文字符，转换为拼音
      const pinyinResult = pinyin(char, { toneType: 'none', type: 'array' })
      result.push(...pinyinResult)
    } else if (/[a-zA-Z0-9]/.test(char)) {
      // 保留英文字符和数字
      result.push(char.toLowerCase())
    }
    // 忽略其他字符（标点等）
  }
  
  return result
}

/**
 * 拼音模糊匹配
 */
export function pinyinFuzzyMatch(text: string, pattern: string): boolean {
  if (!pattern || !text) return false
  
  const textLower = text.toLowerCase()
  const patternLower = pattern.toLowerCase()
  
  // 直接文本匹配
  if (textLower.includes(patternLower)) {
    return true
  }
  
  // 拼音匹配 - 使用 pinyin-pro
  const textPinyin = pinyin(text, { toneType: 'none', type: 'array' }).join('')
  if (textPinyin.toLowerCase().includes(patternLower)) {
    return true
  }
  
  // 拼音首字母匹配
  const textInitials = pinyin(text, { toneType: 'none', type: 'array' })
    .map(py => py.charAt(0)).join('')
  if (textInitials.toLowerCase().includes(patternLower)) {
    return true
  }
  
  return false
}

/**
 * 计算拼音匹配得分
 */
export function pinyinMatchScore(text: string, pattern: string): number {
  if (!pattern || !text) return 0
  
  const textLower = text.toLowerCase()
  const patternLower = pattern.toLowerCase()
  
  // 完全匹配
  if (textLower === patternLower) {
    return 10
  }
  
  // 包含匹配
  if (textLower.includes(patternLower)) {
    return 8
  }
  
  // 拼音完全匹配 - 使用 pinyin-pro
  const textPinyin = pinyin(text, { toneType: 'none', type: 'array' }).join('').toLowerCase()
  const patternPinyin = pinyin(pattern, { toneType: 'none', type: 'array' }).join('').toLowerCase()
  
  if (textPinyin === patternPinyin) {
    return 6
  }
  
  // 拼音包含匹配
  if (textPinyin.includes(patternLower)) {
    return 4
  }
  
  // 拼音首字母匹配
  const textInitials = pinyin(text, { toneType: 'none', type: 'array' })
    .map(py => py.charAt(0)).join('').toLowerCase()
  
  if (textInitials.includes(patternLower)) {
    return 2
  }
  
  return 0
}

/**
 * 检测是否包含中文字符
 */
export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}
