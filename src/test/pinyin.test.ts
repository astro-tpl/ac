/**
 * 拼音搜索功能测试
 */

import { describe, it, expect } from 'vitest'
import { 
  toPinyin, 
  pinyinFuzzyMatch, 
  pinyinMatchScore, 
  containsChinese 
} from '../infra/pinyin'

describe('Pinyin Search', () => {
  describe('toPinyin', () => {
    it('should convert Chinese characters to pinyin', () => {
      expect(toPinyin('搜索')).toEqual(['sou', 'suo'])
      expect(toPinyin('模板')).toEqual(['mo', 'ban'])
      expect(toPinyin('前端')).toEqual(['qian', 'duan'])
    })

    it('should preserve English characters', () => {
      expect(toPinyin('test')).toEqual(['t', 'e', 's', 't'])
      expect(toPinyin('React')).toEqual(['r', 'e', 'a', 'c', 't'])
    })

    it('should handle mixed Chinese and English', () => {
      expect(toPinyin('前端React')).toEqual(['qian', 'duan', 'r', 'e', 'a', 'c', 't'])
    })

    it('should handle numbers', () => {
      expect(toPinyin('版本1')).toEqual(['ban', 'ben', '1'])
    })

    it('should handle empty string', () => {
      expect(toPinyin('')).toEqual([])
    })

    it('should handle unknown Chinese characters gracefully', () => {
      // 对于不在映射表中的字符，应该被忽略或处理
      const result = toPinyin('测试未知字符')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('pinyinFuzzyMatch', () => {
    it('should match exact Chinese text', () => {
      expect(pinyinFuzzyMatch('搜索', '搜索')).toBe(true)
      expect(pinyinFuzzyMatch('模板', '模板')).toBe(true)
    })

    it('should match Chinese text with pinyin', () => {
      expect(pinyinFuzzyMatch('搜索', 'sousuo')).toBe(true)
      expect(pinyinFuzzyMatch('模板', 'muban')).toBe(true) // pinyin-pro: 模=mu, 板=ban
    })

    it('should match Chinese text with pinyin initials', () => {
      expect(pinyinFuzzyMatch('搜索', 'ss')).toBe(true)
      expect(pinyinFuzzyMatch('模板', 'mb')).toBe(true)
      expect(pinyinFuzzyMatch('前端代码', 'qddm')).toBe(true)
    })

    it('should match partial pinyin', () => {
      expect(pinyinFuzzyMatch('搜索模板', 'sou')).toBe(true)
      expect(pinyinFuzzyMatch('前端开发', 'qian')).toBe(true)
    })

    it('should match English text normally', () => {
      expect(pinyinFuzzyMatch('React', 'React')).toBe(true)
      expect(pinyinFuzzyMatch('JavaScript', 'java')).toBe(true)
      expect(pinyinFuzzyMatch('TypeScript', 'type')).toBe(true)
    })

    it('should be case insensitive for English', () => {
      expect(pinyinFuzzyMatch('React', 'react')).toBe(true)
      expect(pinyinFuzzyMatch('JavaScript', 'JAVA')).toBe(true)
    })

    it('should handle mixed Chinese and English', () => {
      expect(pinyinFuzzyMatch('前端React', 'qian')).toBe(true)
      expect(pinyinFuzzyMatch('前端React', 'react')).toBe(true)
      expect(pinyinFuzzyMatch('Vue组件', 'vue')).toBe(true)
    })

    it('should return false for non-matching text', () => {
      expect(pinyinFuzzyMatch('搜索', 'xyz')).toBe(false)
      expect(pinyinFuzzyMatch('React', 'vue')).toBe(false)
    })

    it('should handle empty inputs', () => {
      expect(pinyinFuzzyMatch('', 'test')).toBe(false)
      expect(pinyinFuzzyMatch('test', '')).toBe(false)
      expect(pinyinFuzzyMatch('', '')).toBe(false)
    })
  })

  describe('pinyinMatchScore', () => {
    it('should give highest score for exact match', () => {
      expect(pinyinMatchScore('搜索', '搜索')).toBe(10)
      expect(pinyinMatchScore('React', 'React')).toBe(10)
    })

    it('should give high score for substring match', () => {
      expect(pinyinMatchScore('前端搜索', '搜索')).toBe(8)
      expect(pinyinMatchScore('JavaScript', 'Script')).toBe(8)
    })

    it('should give medium score for exact pinyin match', () => {
      expect(pinyinMatchScore('搜索', 'sousuo')).toBe(6)
      expect(pinyinMatchScore('模板', 'muban')).toBe(6) // pinyin-pro: 模=mu, 板=ban
    })

    it('should give lower score for partial pinyin match', () => {
      expect(pinyinMatchScore('搜索模板', 'sou')).toBe(4)
      expect(pinyinMatchScore('前端开发', 'qian')).toBe(4)
    })

    it('should give lowest score for pinyin initials', () => {
      expect(pinyinMatchScore('搜索', 'ss')).toBe(2)
      expect(pinyinMatchScore('模板', 'mb')).toBe(2)
    })

    it('should return 0 for no match', () => {
      expect(pinyinMatchScore('搜索', 'xyz')).toBe(0)
      expect(pinyinMatchScore('React', 'vue')).toBe(0)
    })

    it('should handle empty inputs', () => {
      expect(pinyinMatchScore('', 'test')).toBe(0)
      expect(pinyinMatchScore('test', '')).toBe(0)
    })

    it('should prioritize exact matches over pinyin matches', () => {
      const exactScore = pinyinMatchScore('搜索', '搜索')
      const pinyinScore = pinyinMatchScore('搜索', 'sousuo')
      expect(exactScore).toBeGreaterThan(pinyinScore)
    })
  })

  describe('containsChinese', () => {
    it('should detect Chinese characters', () => {
      expect(containsChinese('搜索')).toBe(true)
      expect(containsChinese('模板')).toBe(true)
      expect(containsChinese('前端代码')).toBe(true)
    })

    it('should detect mixed text with Chinese', () => {
      expect(containsChinese('前端React')).toBe(true)
      expect(containsChinese('Vue组件')).toBe(true)
      expect(containsChinese('测试test')).toBe(true)
    })

    it('should return false for pure English', () => {
      expect(containsChinese('React')).toBe(false)
      expect(containsChinese('JavaScript')).toBe(false)
      expect(containsChinese('hello world')).toBe(false)
    })

    it('should return false for numbers and symbols', () => {
      expect(containsChinese('123')).toBe(false)
      expect(containsChinese('!@#$%')).toBe(false)
      expect(containsChinese('test-123')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(containsChinese('')).toBe(false)
    })

    it('should handle Unicode Chinese characters', () => {
      expect(containsChinese('中文')).toBe(true)
      expect(containsChinese('汉字')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in Chinese text', () => {
      expect(pinyinFuzzyMatch('搜索-模板', 'sou')).toBe(true)
      expect(pinyinMatchScore('前端(React)', 'qian')).toBeGreaterThan(0)
    })

    it('should handle very long text', () => {
      const longText = '这是一个非常长的中文文本用来测试拼音搜索功能的性能和正确性'
      expect(pinyinFuzzyMatch(longText, 'zhe')).toBe(true)
      expect(pinyinMatchScore(longText, 'zheshi')).toBeGreaterThan(0)
    })

    it('should handle text with numbers and punctuation', () => {
      expect(pinyinFuzzyMatch('第1章：搜索算法', 'sou')).toBe(true)
      expect(pinyinMatchScore('版本2.0更新', 'banben')).toBeGreaterThan(0)
    })
  })
})
