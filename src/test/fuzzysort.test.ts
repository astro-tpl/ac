/**
 * Fuzzysort 搜索引擎测试
 * 测试模糊搜索、拼音搜索、权重计算等核心功能
 */

import type { IndexedTemplate } from '@/types/template'
import {
  FuzzysortSearchEngine,
  getSearchSuggestions,
  highlightSearchResults,
  searchTemplates,
} from '@/infra/fuzzysort'
import { describe, expect, test } from 'vitest'

// 测试用的模板数据
const mockTemplates: IndexedTemplate[] = [
  {
    absPath: '/test/frontend-review.yaml',
    content: '前端代码评审规范',
    id: 'frontend-review-v1',
    labels: ['frontend', 'review', 'react'],
    lastModified: Date.now(),
    name: '前端代码评审',
    repoName: 'templates',
    summary: 'React 前端代码评审提示词',
    type: 'prompt',
  },
  {
    absPath: '/test/backend-api.yaml',
    content: 'API 接口设计规范',
    id: 'backend-api-v1',
    labels: ['backend', 'api', 'design'],
    lastModified: Date.now(),
    name: '后端API设计',
    repoName: 'templates',
    summary: 'RESTful API 设计最佳实践',
    type: 'context',
  },
  {
    absPath: '/test/vue-component.yaml',
    content: 'Vue 组件开发规范',
    id: 'vue-component-v1',
    labels: ['frontend', 'vue', 'component'],
    lastModified: Date.now(),
    name: 'Vue组件开发',
    repoName: 'templates',
    summary: 'Vue 组件开发最佳实践',
    type: 'prompt',
  },
  {
    absPath: '/test/database-design.yaml',
    content: '数据库设计规范',
    id: 'database-design-v1',
    labels: ['database', 'design', 'mysql'],
    lastModified: Date.now(),
    name: '数据库设计',
    repoName: 'templates',
    summary: 'MySQL 数据库设计规范',
    type: 'context',
  },
]

describe('Fuzzysort 搜索引擎', () => {
  let searchEngine: FuzzysortSearchEngine

  test('搜索引擎初始化', () => {
    searchEngine = new FuzzysortSearchEngine()
    expect(searchEngine).toBeDefined()
  })

  describe('基本搜索功能', () => {
    searchEngine = new FuzzysortSearchEngine()

    test('空查询应该返回所有模板', () => {
      const results = searchEngine.search(mockTemplates, {
        query: '',
        limit: 10,
      })

      expect(results).toHaveLength(4)
      expect(results.every(r => r.score === 1)).toBe(true)
    })

    test('精确匹配 ID 应该得到最高优先级', () => {
      const results = searchEngine.search(mockTemplates, {
        query: 'frontend-review-v1',
        limit: 10,
        threshold: -20000,
      })

      expect(results.length).toBeGreaterThan(0)
      const exactMatch = results.find(r => r.template.id === 'frontend-review-v1')
      expect(exactMatch).toBeDefined()
      expect(exactMatch!.score).toBeGreaterThan(-10000) // fuzzysort 使用负数评分
    })

    test('模板名称匹配', () => {
      const results = searchEngine.search(mockTemplates, {
        query: '前端',
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      const frontendTemplate = results.find(r => r.template.id === 'frontend-review-v1')
      expect(frontendTemplate).toBeDefined()
    })

    test('标签匹配', () => {
      const results = searchEngine.search(mockTemplates, {
        query: 'react',
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      const reactTemplate = results.find(r => r.template.labels.includes('react'))
      expect(reactTemplate).toBeDefined()
    })

    test('摘要内容匹配', () => {
      const results = searchEngine.search(mockTemplates, {
        query: 'RESTful',
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      const apiTemplate = results.find(r => r.template.id === 'backend-api-v1')
      expect(apiTemplate).toBeDefined()
    })
  })

  describe('拼音搜索功能', () => {
    searchEngine = new FuzzysortSearchEngine()

    test('中文拼音完整匹配', () => {
      const results = searchEngine.search(mockTemplates, {
        query: 'qianduan',
        enablePinyin: true,
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      const frontendTemplate = results.find(r => r.template.name.includes('前端'))
      expect(frontendTemplate).toBeDefined()
    })

    test('中文拼音首字母匹配', () => {
      const results = searchEngine.search(mockTemplates, {
        query: 'qd',
        enablePinyin: true,
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      const frontendTemplate = results.find(r => r.template.name.includes('前端'))
      expect(frontendTemplate).toBeDefined()
    })

    test('拼音混合搜索', () => {
      const results = searchEngine.search(mockTemplates, {
        query: 'vue zujian',
        enablePinyin: true,
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      const vueTemplate = results.find(r => r.template.id === 'vue-component-v1')
      expect(vueTemplate).toBeDefined()
    })

    test('禁用拼音搜索应该只匹配英文', () => {
      const resultsWithPinyin = searchEngine.search(mockTemplates, {
        query: 'qianduan',
        enablePinyin: true,
        limit: 10,
      })

      const resultsWithoutPinyin = searchEngine.search(mockTemplates, {
        query: 'qianduan',
        enablePinyin: false,
        limit: 10,
      })

      expect(resultsWithPinyin.length).toBeGreaterThan(resultsWithoutPinyin.length)
    })
  })

  describe('搜索结果排序和权重', () => {
    searchEngine = new FuzzysortSearchEngine()

    test('ID 匹配应该比名称匹配权重更高', () => {
      // 创建测试数据，其中一个模板的name包含"frontend"，另一个的id包含"frontend"
      const testTemplates: IndexedTemplate[] = [
        {
          ...mockTemplates[0],
          id: 'test-id',
          name: 'frontend测试',
        },
        {
          ...mockTemplates[1],
          id: 'frontend-test',
          name: '测试模板',
        },
      ]

      const results = searchEngine.search(testTemplates, {
        query: 'frontend',
        limit: 10,
      })

      expect(results.length).toBe(2)
      // ID 匹配的应该排在前面
      expect(results[0].template.id).toBe('frontend-test')
    })

    test('自定义权重配置', () => {
      const customWeights = {
        content: 5,
        id: 1,
        labels: 3,
        name: 2,
        summary: 4,
      }

      const results = searchEngine.search(mockTemplates, {
        query: 'React',
        weights: customWeights,
        limit: 10,
        threshold: -20000,
      })

      expect(results.length).toBeGreaterThan(0)
      // fuzzysort 使用负数评分系统，但匹配的结果应该有有效的分数
      expect(results.every(r => r.score > -Infinity)).toBe(true)
    })

    test('阈值过滤低分结果', () => {
      const highThreshold = searchEngine.search(mockTemplates, {
        query: 'nonexistent',
        threshold: -1000,
        limit: 10,
      })

      const lowThreshold = searchEngine.search(mockTemplates, {
        query: 'nonexistent',
        threshold: -20000,
        limit: 10,
      })

      expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length)
    })

    test('结果数量限制', () => {
      const unlimitedResults = searchEngine.search(mockTemplates, {
        query: '',
        limit: 100,
      })

      const limitedResults = searchEngine.search(mockTemplates, {
        query: '',
        limit: 2,
      })

      expect(unlimitedResults.length).toBe(4)
      // 空查询时，应该返回所有模板但受 limit 限制
      expect(limitedResults.length).toBe(2)
    })
  })

  describe('搜索建议功能', () => {
    searchEngine = new FuzzysortSearchEngine()

    test('获取搜索建议', () => {
      const suggestions = searchEngine.getSuggestions(mockTemplates, 'front', 5)
      
      expect(suggestions).toBeDefined()
      expect(Array.isArray(suggestions)).toBe(true)
      // 应该包含包含 'front' 的建议
      expect(suggestions.some(s => s.toLowerCase().includes('front'))).toBe(true)
    })

    test('空查询不应该返回建议', () => {
      const suggestions = searchEngine.getSuggestions(mockTemplates, '', 5)
      
      expect(suggestions).toEqual([])
    })

    test('限制建议数量', () => {
      const suggestions = searchEngine.getSuggestions(mockTemplates, 'e', 2)
      
      expect(suggestions.length).toBeLessThanOrEqual(2)
    })
  })

  describe('搜索结果高亮', () => {
    searchEngine = new FuzzysortSearchEngine()

    test('高亮匹配的字段', () => {
      const template = mockTemplates[0]
      const matchedFields = ['name']
      
      const highlighted = searchEngine.highlightMatches(template, '前端', matchedFields)
      
      expect(highlighted).toBeDefined()
      expect(highlighted.name).toBeDefined()
    })

    test('处理不匹配的情况', () => {
      const template = mockTemplates[0]
      const matchedFields = ['name']
      
      const highlighted = searchEngine.highlightMatches(template, 'nonexistent', matchedFields)
      
      expect(highlighted).toBeDefined()
      expect(highlighted.name).toBe(template.name)
    })
  })
})

describe('便捷搜索函数', () => {
  test('searchTemplates 函数', () => {
    const results = searchTemplates(mockTemplates, '前端', {
      enablePinyin: true,
      limit: 5,
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
  })

  test('highlightSearchResults 函数', () => {
    const template = mockTemplates[0]
    const highlighted = highlightSearchResults(template, '前端', ['name'])

    expect(highlighted).toBeDefined()
    expect(highlighted.name).toBeDefined()
  })

  test('getSearchSuggestions 函数', () => {
    const suggestions = getSearchSuggestions(mockTemplates, 'front', 3)

    expect(suggestions).toBeDefined()
    expect(Array.isArray(suggestions)).toBe(true)
  })
})

describe('边界情况和错误处理', () => {
  const searchEngine = new FuzzysortSearchEngine()

  test('空模板数组', () => {
    const results = searchEngine.search([], { query: 'test' })
    expect(results).toEqual([])
  })

  test('模板数据缺失字段', () => {
    const incompleteTemplate = {
      ...mockTemplates[0],
      name: '',
      summary: undefined,
    } as any

    const results = searchEngine.search([incompleteTemplate], {
      query: 'test',
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
  })

  test('特殊字符查询', () => {
    const results = searchEngine.search(mockTemplates, {
      query: '@#$%^&*()',
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
  })

  test('超长查询字符串', () => {
    const longQuery = 'a'.repeat(1000)
    const results = searchEngine.search(mockTemplates, {
      query: longQuery,
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
  })

  test('负数权重配置', () => {
    const negativeWeights = {
      content: -1,
      id: -2,
      labels: -1,
      name: -1,
      summary: -1,
    }

    const results = searchEngine.search(mockTemplates, {
      query: 'frontend',
      weights: negativeWeights,
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
  })
})
