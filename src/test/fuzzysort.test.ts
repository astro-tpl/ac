/**
 * Fuzzysort search engine tests
 * Test fuzzy search, pinyin search, weight calculation and other core functions
 */

import type {IndexedTemplate} from '@/types/template'

import {
  FuzzysortSearchEngine,
  getSearchSuggestions,
  highlightSearchResults,
  searchTemplates,
} from '@/infra/fuzzysort'
import {describe, expect, test} from 'vitest'

// Test template data
const mockTemplates: IndexedTemplate[] = [
  {
    absPath: '/test/frontend-review.yaml',
    content: 'Frontend code review specifications',
    id: 'frontend-review-v1',
    labels: ['frontend', 'review', 'react'],
    lastModified: Date.now(),
    name: 'Frontend Code Review',
    repoName: 'templates',
    summary: 'React frontend code review prompt',
    type: 'prompt',
  },
  {
    absPath: '/test/backend-api.yaml',
    content: 'API interface design specifications',
    id: 'backend-api-v1',
    labels: ['backend', 'api', 'design'],
    lastModified: Date.now(),
    name: 'Backend API Design',
    repoName: 'templates',
    summary: 'RESTful API design best practices',
    type: 'context',
  },
  {
    absPath: '/test/vue-component.yaml',
    content: 'Vue component development specifications',
    id: 'vue-component-v1',
    labels: ['frontend', 'vue', 'component'],
    lastModified: Date.now(),
    name: 'Vue Component Development',
    repoName: 'templates',
    summary: 'Vue component development best practices',
    type: 'prompt',
  },
  {
    absPath: '/test/database-design.yaml',
    content: 'Database design specifications',
    id: 'database-design-v1',
    labels: ['database', 'design', 'mysql'],
    lastModified: Date.now(),
    name: 'Database Design',
    repoName: 'templates',
    summary: 'MySQL database design specifications',
    type: 'context',
  },
]

describe('Fuzzysort search engine', () => {
  let searchEngine: FuzzysortSearchEngine

  test('Search engine initialization', () => {
    searchEngine = new FuzzysortSearchEngine()
    expect(searchEngine).toBeDefined()
  })

  describe('Basic search functionality', () => {
    searchEngine = new FuzzysortSearchEngine()

    test('Empty query should return all templates', () => {
      const results = searchEngine.search(mockTemplates, {
        limit: 10,
        query: '',
      })

      expect(results).toHaveLength(4)
      expect(results.every(r => r.score === 1)).toBe(true)
    })

    test('精确匹配 ID 应该得到最高优先级', () => {
      const results = searchEngine.search(mockTemplates, {
        limit: 10,
        query: 'frontend-review-v1',
        threshold: -20_000,
      })

      expect(results.length).toBeGreaterThan(0)
      const exactMatch = results.find(r => r.template.id === 'frontend-review-v1')
      expect(exactMatch).toBeDefined()
      expect(exactMatch!.score).toBeGreaterThan(-10_000) // fuzzysort 使用负数评分
    })

    test('Template name matching', () => {
      const results = searchEngine.search(mockTemplates, {
        limit: 10,
        query: 'frontend',
      })

      expect(results.length).toBeGreaterThan(0)
      const frontendTemplate = results.find(r => r.template.id === 'frontend-review-v1')
      expect(frontendTemplate).toBeDefined()
    })

    test('标签匹配', () => {
      const results = searchEngine.search(mockTemplates, {
        limit: 10,
        query: 'react',
      })

      expect(results.length).toBeGreaterThan(0)
      const reactTemplate = results.find(r => r.template.labels.includes('react'))
      expect(reactTemplate).toBeDefined()
    })

    test('摘要内容匹配', () => {
      const results = searchEngine.search(mockTemplates, {
        limit: 10,
        query: 'RESTful',
      })

      expect(results.length).toBeGreaterThan(0)
      const apiTemplate = results.find(r => r.template.id === 'backend-api-v1')
      expect(apiTemplate).toBeDefined()
    })
  })

  describe('Pinyin search functionality', () => {
    searchEngine = new FuzzysortSearchEngine()

    // Create test data with Chinese content for pinyin testing
    const chineseTestTemplates: IndexedTemplate[] = [
      {
        ...mockTemplates[0],
        content: '前端代码评审规范',
        name: '前端代码评审',
        summary: 'React 前端代码评审提示词',
      },
      {
        ...mockTemplates[2],
        content: 'Vue 组件开发规范',
        name: 'Vue组件开发',
        summary: 'Vue 组件开发最佳实践',
      },
    ]

    test('Chinese pinyin full matching', () => {
      const results = searchEngine.search(chineseTestTemplates, {
        enablePinyin: true,
        limit: 10,
        query: 'qianduan',
      })

      expect(results.length).toBeGreaterThan(0)
      const frontendTemplate = results.find(r => r.template.name.includes('前端'))
      expect(frontendTemplate).toBeDefined()
    })

    test('Chinese pinyin initial matching', () => {
      const results = searchEngine.search(chineseTestTemplates, {
        enablePinyin: true,
        limit: 10,
        query: 'qd',
      })

      expect(results.length).toBeGreaterThan(0)
      const frontendTemplate = results.find(r => r.template.name.includes('前端'))
      expect(frontendTemplate).toBeDefined()
    })

    test('Mixed pinyin search', () => {
      const results = searchEngine.search(chineseTestTemplates, {
        enablePinyin: true,
        limit: 10,
        query: 'vue zujian',
      })

      expect(results.length).toBeGreaterThan(0)
      const vueTemplate = results.find(r => r.template.name.includes('Vue'))
      expect(vueTemplate).toBeDefined()
    })

    test('Disabling pinyin search should only match English', () => {
      const resultsWithPinyin = searchEngine.search(chineseTestTemplates, {
        enablePinyin: true,
        limit: 10,
        query: 'qianduan',
      })

      const resultsWithoutPinyin = searchEngine.search(chineseTestTemplates, {
        enablePinyin: false,
        limit: 10,
        query: 'qianduan',
      })

      expect(resultsWithPinyin.length).toBeGreaterThan(resultsWithoutPinyin.length)
    })
  })

  describe('Search result sorting and weighting', () => {
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
        limit: 10,
        query: 'frontend',
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
        limit: 10,
        query: 'React',
        threshold: -20_000,
        weights: customWeights,
      })

      expect(results.length).toBeGreaterThan(0)
      // fuzzysort 使用负数评分系统，但匹配的结果应该有有效的分数
      expect(results.every(r => r.score > Number.NEGATIVE_INFINITY)).toBe(true)
    })

    test('阈值过滤低分结果', () => {
      const highThreshold = searchEngine.search(mockTemplates, {
        limit: 10,
        query: 'nonexistent',
        threshold: -1000,
      })

      const lowThreshold = searchEngine.search(mockTemplates, {
        limit: 10,
        query: 'nonexistent',
        threshold: -20_000,
      })

      expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length)
    })

    test('结果数量限制', () => {
      const unlimitedResults = searchEngine.search(mockTemplates, {
        limit: 100,
        query: '',
      })

      const limitedResults = searchEngine.search(mockTemplates, {
        limit: 2,
        query: '',
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

describe('Utility search functions', () => {
  test('searchTemplates function', () => {
    const results = searchTemplates(mockTemplates, 'frontend', {
      enablePinyin: true,
      limit: 5,
    })

    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
  })

  test('highlightSearchResults function', () => {
    const template = mockTemplates[0]
    const highlighted = highlightSearchResults(template, 'frontend', ['name'])

    expect(highlighted).toBeDefined()
    expect(highlighted.name).toBeDefined()
  })

  test('getSearchSuggestions function', () => {
    const suggestions = getSearchSuggestions(mockTemplates, 'front', 3)

    expect(suggestions).toBeDefined()
    expect(Array.isArray(suggestions)).toBe(true)
  })
})

describe('Edge cases and error handling', () => {
  const searchEngine = new FuzzysortSearchEngine()

  test('空模板数组', () => {
    const results = searchEngine.search([], {query: 'test'})
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
