/**
 * Pinyin search functionality tests
 * Test Chinese pinyin conversion and fuzzy matching functionality
 */

import {
  containsChinese,
  pinyinFuzzyMatch,
  pinyinMatchScore,
  toPinyin,
} from '@/infra/pinyin'
import {describe, expect, test} from 'vitest'

describe('Pinyin conversion functionality', () => {
  describe('toPinyin', () => {
    test('Should correctly convert Chinese to pinyin array', () => {
      expect(toPinyin('前端')).toEqual(['qian', 'duan'])
      expect(toPinyin('配置')).toEqual(['pei', 'zhi'])
      expect(toPinyin('搜索')).toEqual(['sou', 'suo'])
    })

    test('Should preserve English characters and numbers', () => {
      expect(toPinyin('React前端')).toEqual(['r', 'e', 'a', 'c', 't', 'qian', 'duan'])
      expect(toPinyin('前端123')).toEqual(['qian', 'duan', '1', '2', '3'])
    })

    test('应该忽略标点符号', () => {
      expect(toPinyin('前端-配置')).toEqual(['qian', 'duan', 'pei', 'zhi'])
      expect(toPinyin('前端，搜索！')).toEqual(['qian', 'duan', 'sou', 'suo'])
    })

    test('应该处理空字符串', () => {
      expect(toPinyin('')).toEqual([])
    })

    test('应该处理单个字符', () => {
      expect(toPinyin('前')).toEqual(['qian'])
      expect(toPinyin('a')).toEqual(['a'])
    })
  })

  describe('containsChinese', () => {
    test('应该正确检测中文字符', () => {
      expect(containsChinese('前端')).toBe(true)
      expect(containsChinese('React前端')).toBe(true)
      expect(containsChinese('前端配置')).toBe(true)
    })

    test('应该正确检测非中文字符串', () => {
      expect(containsChinese('React')).toBe(false)
      expect(containsChinese('123')).toBe(false)
      expect(containsChinese('hello-world')).toBe(false)
    })

    test('应该处理空字符串', () => {
      expect(containsChinese('')).toBe(false)
    })
  })
})

describe('拼音模糊匹配功能', () => {
  describe('pinyinFuzzyMatch', () => {
    test('应该支持直接文本匹配', () => {
      expect(pinyinFuzzyMatch('前端开发', '前端')).toBe(true)
      expect(pinyinFuzzyMatch('React应用', 'React')).toBe(true)
      expect(pinyinFuzzyMatch('前端配置', '配置')).toBe(true)
    })

    test('应该支持拼音完整匹配', () => {
      expect(pinyinFuzzyMatch('前端', 'qianduan')).toBe(true)
      expect(pinyinFuzzyMatch('配置', 'peizhi')).toBe(true)
      expect(pinyinFuzzyMatch('搜索功能', 'sousuo')).toBe(true)
    })

    test('应该支持拼音首字母匹配', () => {
      expect(pinyinFuzzyMatch('前端开发', 'qdkf')).toBe(true)
      expect(pinyinFuzzyMatch('配置文件', 'pzwj')).toBe(true)
      expect(pinyinFuzzyMatch('搜索引擎', 'ssyq')).toBe(true)
    })

    test('应该处理部分匹配', () => {
      expect(pinyinFuzzyMatch('前端开发', 'qian')).toBe(true)
      expect(pinyinFuzzyMatch('前端开发', 'qd')).toBe(true)
      expect(pinyinFuzzyMatch('React前端', 'react')).toBe(true)
    })

    test('应该忽略大小写', () => {
      expect(pinyinFuzzyMatch('前端', 'QIANDUAN')).toBe(true)
      expect(pinyinFuzzyMatch('前端', 'QianDuan')).toBe(true)
      expect(pinyinFuzzyMatch('React前端', 'REACT')).toBe(true)
    })

    test('不匹配的情况应该返回 false', () => {
      expect(pinyinFuzzyMatch('前端', 'backend')).toBe(false)
      expect(pinyinFuzzyMatch('配置', 'xyz')).toBe(false)
      expect(pinyinFuzzyMatch('', 'test')).toBe(false)
      expect(pinyinFuzzyMatch('test', '')).toBe(false)
    })
  })

  describe('pinyinMatchScore', () => {
    test('完全匹配应该得到最高分', () => {
      expect(pinyinMatchScore('前端', '前端')).toBe(10)
      expect(pinyinMatchScore('React', 'React')).toBe(10)
      expect(pinyinMatchScore('config', 'config')).toBe(10)
    })

    test('包含匹配应该得到高分', () => {
      expect(pinyinMatchScore('前端开发', '前端')).toBe(8)
      expect(pinyinMatchScore('React应用', 'React')).toBe(8)
      expect(pinyinMatchScore('配置文件', '配置')).toBe(8)
    })

    test('拼音完全匹配应该得到中等分数', () => {
      expect(pinyinMatchScore('前端', 'qianduan')).toBe(6)
      expect(pinyinMatchScore('配置', 'peizhi')).toBe(6)
    })

    test('拼音包含匹配应该得到较低分数', () => {
      expect(pinyinMatchScore('前端开发', 'qian')).toBe(4)
      expect(pinyinMatchScore('配置文件', 'pei')).toBe(4)
    })

    test('拼音首字母匹配应该得到最低分数', () => {
      expect(pinyinMatchScore('前端开发', 'qd')).toBe(2)
      expect(pinyinMatchScore('配置文件', 'pz')).toBe(2)
    })

    test('不匹配应该得到 0 分', () => {
      expect(pinyinMatchScore('前端', 'backend')).toBe(0)
      expect(pinyinMatchScore('配置', 'xyz')).toBe(0)
      expect(pinyinMatchScore('', 'test')).toBe(0)
      expect(pinyinMatchScore('test', '')).toBe(0)
    })

    test('应该忽略大小写', () => {
      expect(pinyinMatchScore('前端', '前端')).toBe(10)
      expect(pinyinMatchScore('前端', 'QIANDUAN')).toBe(6)
      expect(pinyinMatchScore('React', 'REACT')).toBe(10)
    })
  })
})

describe('边界情况和错误处理', () => {
  test('应该处理特殊字符', () => {
    expect(toPinyin('前端@#$%')).toEqual(['qian', 'duan'])
    expect(containsChinese('前端@#$%')).toBe(true)
    expect(pinyinFuzzyMatch('前端@#$%', 'qianduan')).toBe(true)
  })

  test('应该处理空白字符', () => {
    expect(toPinyin('前端 配置')).toEqual(['qian', 'duan', 'pei', 'zhi'])
    expect(pinyinFuzzyMatch('前端 配置', 'qianduan')).toBe(true)
  })

  test('应该处理繁体中文', () => {
    expect(containsChinese('繁體中文')).toBe(true)
    // 注意：pinyin-pro 应该能处理繁体中文，这里测试基本功能
  })

  test('应该处理数字和符号混合', () => {
    expect(toPinyin('Vue3前端框架')).toEqual(['v', 'u', 'e', '3', 'qian', 'duan', 'kuang', 'jia'])
    expect(pinyinFuzzyMatch('Vue3前端框架', 'vue3qianduan')).toBe(true)
  })
})
