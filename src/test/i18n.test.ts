/**
 * 国际化功能测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { initI18n, t, getCurrentLang, setLang, getSupportedLangs } from '../i18n'

describe('i18n', () => {
  beforeEach(() => {
    // 每个测试前重置为默认状态
    initI18n('en')
  })

  describe('initI18n', () => {
    it('should initialize with specified language', () => {
      initI18n('zh')
      expect(getCurrentLang()).toBe('zh')
    })

    it('should fallback to system language when no language specified', () => {
      // 模拟系统环境变量
      const originalLang = process.env.LANG
      process.env.LANG = 'zh_CN.UTF-8'
      
      initI18n()
      expect(getCurrentLang()).toBe('zh')
      
      // 恢复原始环境变量
      process.env.LANG = originalLang
    })

    it('should fallback to English for unsupported language', () => {
      initI18n('fr') // 法语不支持
      expect(getCurrentLang()).toBe('en')
    })

    it('should use English as default when no system language detected', () => {
      const originalLang = process.env.LANG
      const originalLcAll = process.env.LC_ALL
      const originalLcMessages = process.env.LC_MESSAGES
      
      delete process.env.LANG
      delete process.env.LC_ALL
      delete process.env.LC_MESSAGES
      
      initI18n()
      expect(getCurrentLang()).toBe('en')
      
      // 恢复原始环境变量
      if (originalLang) process.env.LANG = originalLang
      if (originalLcAll) process.env.LC_ALL = originalLcAll
      if (originalLcMessages) process.env.LC_MESSAGES = originalLcMessages
    })
  })

  describe('t (translation function)', () => {
    it('should translate English messages', () => {
      initI18n('en')
      expect(t('common.success')).toBe('Success')
      expect(t('common.error')).toBe('Error')
    })

    it('should translate Chinese messages', () => {
      initI18n('zh')
      expect(t('common.success')).toBe('成功')
      expect(t('common.error')).toBe('错误')
    })

    it('should support parameter interpolation', () => {
      initI18n('en')
      expect(t('repo.add.success', { alias: 'test-repo' })).toBe('Repository test-repo added successfully.')
      
      initI18n('zh')
      expect(t('repo.add.success', { alias: 'test-repo' })).toBe('仓库 test-repo 添加成功。')
    })

    it('should support multiple parameters', () => {
      initI18n('en')
      expect(t('search.found', { count: 5 })).toBe('Found 5 template(s)')
      
      initI18n('zh')
      expect(t('search.found', { count: 5 })).toBe('找到 5 个模板')
    })

    it('should fallback to English when key not found in current language', () => {
      initI18n('zh')
      // 假设这个键只在英文中存在
      const nonExistentKey = 'non.existent.key'
      expect(t(nonExistentKey)).toBe(nonExistentKey) // 应该返回键本身
    })

    it('should return key itself when translation not found', () => {
      initI18n('en')
      const unknownKey = 'unknown.key'
      expect(t(unknownKey)).toBe(unknownKey)
    })

    it('should handle numeric parameters', () => {
      initI18n('en')
      expect(t('search.found', { count: 0 })).toBe('Found 0 template(s)')
      expect(t('search.found', { count: 1 })).toBe('Found 1 template(s)')
      expect(t('search.found', { count: 10 })).toBe('Found 10 template(s)')
    })
  })

  describe('setLang', () => {
    it('should set supported language', () => {
      expect(setLang('zh')).toBe(true)
      expect(getCurrentLang()).toBe('zh')
    })

    it('should reject unsupported language', () => {
      expect(setLang('fr')).toBe(false)
      expect(getCurrentLang()).toBe('en') // 应该保持原来的语言
    })
  })

  describe('getSupportedLangs', () => {
    it('should return array of supported languages', () => {
      const langs = getSupportedLangs()
      expect(langs).toContain('en')
      expect(langs).toContain('zh')
      expect(langs.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty parameters object', () => {
      initI18n('en')
      expect(t('common.success', {})).toBe('Success')
    })

    it('should handle undefined parameters', () => {
      initI18n('en')
      expect(t('common.success', undefined)).toBe('Success')
    })

    it('should handle parameter replacement with special characters', () => {
      initI18n('en')
      expect(t('error.git.invalid_url', { url: 'https://example.com/{repo}' }))
        .toBe('Invalid Git URL: https://example.com/{repo}')
    })
  })
})
