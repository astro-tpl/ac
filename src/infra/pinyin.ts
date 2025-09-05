/**
 * Pinyin search utility - Support Chinese pinyin fuzzy search
 * Implemented according to requirements in line 138 of specification document
 */

import { pinyin } from 'pinyin-pro'

/**
 * Convert Chinese characters to pinyin
 */
export function toPinyin(text: string): string[] {
  const result: string[] = []
  
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      // Chinese character, convert to pinyin
      const pinyinResult = pinyin(char, { toneType: 'none', type: 'array' })
      result.push(...pinyinResult)
    } else if (/[a-zA-Z0-9]/.test(char)) {
      // Keep English characters and numbers
      result.push(char.toLowerCase())
    }
    // Ignore other characters (punctuation, etc.)
  }
  
  return result
}

/**
 * Pinyin fuzzy matching
 */
export function pinyinFuzzyMatch(text: string, pattern: string): boolean {
  if (!pattern || !text) return false
  
  const textLower = text.toLowerCase()
  const patternLower = pattern.toLowerCase()
  
  // Direct text matching
  if (textLower.includes(patternLower)) {
    return true
  }
  
  // Pinyin matching - using pinyin-pro
  const textPinyin = pinyin(text, { toneType: 'none', type: 'array' }).join('')
  if (textPinyin.toLowerCase().includes(patternLower)) {
    return true
  }
  
  // Pinyin initial matching
  const textInitials = pinyin(text, { toneType: 'none', type: 'array' })
    .map(py => py.charAt(0)).join('')
  if (textInitials.toLowerCase().includes(patternLower)) {
    return true
  }
  
  return false
}

/**
 * Calculate pinyin matching score
 */
export function pinyinMatchScore(text: string, pattern: string): number {
  if (!pattern || !text) return 0
  
  const textLower = text.toLowerCase()
  const patternLower = pattern.toLowerCase()
  
  // Exact match
  if (textLower === patternLower) {
    return 10
  }
  
  // Contains match
  if (textLower.includes(patternLower)) {
    return 8
  }
  
  // Pinyin exact match - using pinyin-pro
  const textPinyin = pinyin(text, { toneType: 'none', type: 'array' }).join('').toLowerCase()
  const patternPinyin = pinyin(pattern, { toneType: 'none', type: 'array' }).join('').toLowerCase()
  
  if (textPinyin === patternPinyin) {
    return 6
  }
  
  // Pinyin contains match
  if (textPinyin.includes(patternLower)) {
    return 4
  }
  
  // Pinyin initial matching
  const textInitials = pinyin(text, { toneType: 'none', type: 'array' })
    .map(py => py.charAt(0)).join('').toLowerCase()
  
  if (textInitials.includes(patternLower)) {
    return 2
  }
  
  return 0
}

/**
 * Detect if contains Chinese characters
 */
export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}
