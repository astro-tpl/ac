/**
 * Fuzzysort 搜索引擎测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { 
  FuzzysortSearchEngine,
  searchTemplates,
  highlightSearchResults,
  getSearchSuggestions
} from '../infra/fuzzysort'
import { IndexedTemplate } from '../types/template'

describe('FuzzysortSearchEngine', () => {
  let searchEngine: FuzzysortSearchEngine
  let mockTemplates: IndexedTemplate[]

  beforeEach(() => {
    searchEngine = new FuzzysortSearchEngine()
    
    mockTemplates = [
      {
        id: 'react-component',
        type: 'context',
        name: 'React Component Template',
        labels: ['react', 'frontend', 'component'],
        summary: 'A template for creating React components',
        repoName: 'templates',
        absPath: '/path/to/react-component.yaml',
        lastModified: Date.now()
      },
      {
        id: 'vue-setup',
        type: 'prompt',
        name: 'Vue 3 Setup Guide',
        labels: ['vue', 'frontend', 'setup'],
        summary: 'Guide for setting up Vue 3 projects',
        repoName: 'templates',
        absPath: '/path/to/vue-setup.yaml',
        lastModified: Date.now()
      },
      {
        id: 'backend-api',
        type: 'context',
        name: 'Backend API Template',
        labels: ['backend', 'api', 'nodejs'],
        summary: 'Template for creating backend APIs',
        repoName: 'templates',
        absPath: '/path/to/backend-api.yaml',
        lastModified: Date.now()
      },
      {
        id: 'chinese-template',
        type: 'prompt',
        name: '中文模板示例',
        labels: ['中文', '示例', 'chinese'],
        summary: '这是一个中文模板的示例',
        repoName: 'templates',
        absPath: '/path/to/chinese-template.yaml',
        lastModified: Date.now()
      }
    ]
  })

  describe('search', () => {
    it('should return all templates when query is empty', () => {
      const results = searchEngine.search(mockTemplates, { query: '' })
      
      expect(results).toHaveLength(4)
      expect(results.every(r => r.score === 1)).toBe(true)
      expect(results.every(r => r.matchedFields.length === 0)).toBe(true)
    })

    it('should search by template ID', () => {
      const results = searchEngine.search(mockTemplates, { query: 'react' })
      
      expect(results.length).toBeGreaterThan(0)
      const reactResult = results.find(r => r.template.id === 'react-component')
      expect(reactResult).toBeDefined()
      expect(reactResult!.matchedFields).toContain('id')
    })

    it('should search by template name', () => {
      const results = searchEngine.search(mockTemplates, { query: 'Vue' })
      
      expect(results.length).toBeGreaterThan(0)
      const vueResult = results.find(r => r.template.id === 'vue-setup')
      expect(vueResult).toBeDefined()
      expect(vueResult!.matchedFields).toContain('name')
    })

    it('should search by labels', () => {
      const results = searchEngine.search(mockTemplates, { query: 'frontend' })
      
      expect(results.length).toBeGreaterThanOrEqual(2)
      const frontendResults = results.filter(r => 
        r.template.labels.includes('frontend')
      )
      expect(frontendResults.length).toBeGreaterThanOrEqual(2)
    })

    it('should search by summary', () => {
      const results = searchEngine.search(mockTemplates, { query: 'creating' })
      
      expect(results.length).toBeGreaterThan(0)
      const hasCreatingInSummary = results.some(r => 
        r.template.summary.includes('creating')
      )
      expect(hasCreatingInSummary).toBe(true)
    })

    it('should support Chinese search', () => {
      const results = searchEngine.search(mockTemplates, { query: '中文' })
      
      expect(results.length).toBeGreaterThan(0)
      const chineseResult = results.find(r => r.template.id === 'chinese-template')
      expect(chineseResult).toBeDefined()
    })

    it('should support pinyin search', () => {
      const results = searchEngine.search(mockTemplates, { 
        query: 'zhongwen',
        enablePinyin: true
      })
      
      expect(results.length).toBeGreaterThan(0)
      const chineseResult = results.find(r => r.template.id === 'chinese-template')
      expect(chineseResult).toBeDefined()
    })

    it('should support pinyin initials search', () => {
      const results = searchEngine.search(mockTemplates, { 
        query: 'zw',
        enablePinyin: true
      })
      
      expect(results.length).toBeGreaterThan(0)
      const chineseResult = results.find(r => r.template.id === 'chinese-template')
      expect(chineseResult).toBeDefined()
    })

    it('should respect limit parameter', () => {
      const results = searchEngine.search(mockTemplates, { 
        query: 'template',
        limit: 2
      })
      
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should sort results by score', () => {
      const results = searchEngine.search(mockTemplates, { query: 'template' })
      
      expect(results.length).toBeGreaterThan(1)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    it('should filter results by threshold', () => {
      const results = searchEngine.search(mockTemplates, { 
        query: 'xyz123nonexistent',
        threshold: -1000
      })
      
      expect(results.length).toBe(0)
    })
  })

  describe('highlightMatches', () => {
    it('should highlight matched text', () => {
      const template = mockTemplates[0] // react-component
      const highlighted = searchEngine.highlightMatches(
        template,
        'react',
        ['id', 'name']
      )
      
      expect(highlighted.id).toContain('<mark>')
      expect(highlighted.id).toContain('</mark>')
    })

    it('should return original text if no match', () => {
      const template = mockTemplates[0]
      const highlighted = searchEngine.highlightMatches(
        template,
        'nonexistent',
        ['id']
      )
      
      expect(highlighted.id).toBe(template.id)
    })
  })

  describe('getSuggestions', () => {
    it('should return suggestions based on query', () => {
      const suggestions = searchEngine.getSuggestions(mockTemplates, 'react')
      
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions).toContain('react-component')
    })

    it('should limit suggestions count', () => {
      const suggestions = searchEngine.getSuggestions(mockTemplates, 'template', 2)
      
      expect(suggestions.length).toBeLessThanOrEqual(2)
    })

    it('should return empty array for empty query', () => {
      const suggestions = searchEngine.getSuggestions(mockTemplates, '')
      
      expect(suggestions).toEqual([])
    })
  })
})

describe('Convenience Functions', () => {
  let mockTemplates: IndexedTemplate[]

  beforeEach(() => {
    mockTemplates = [
      {
        id: 'test-template',
        type: 'context',
        name: 'Test Template',
        labels: ['test'],
        summary: 'A test template',
        repoName: 'templates',
        absPath: '/path/to/test.yaml',
        lastModified: Date.now()
      }
    ]
  })

  describe('searchTemplates', () => {
    it('should work as convenience function', () => {
      const results = searchTemplates(mockTemplates, 'test')
      
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].template.id).toBe('test-template')
    })
  })

  describe('highlightSearchResults', () => {
    it('should work as convenience function', () => {
      const highlighted = highlightSearchResults(
        mockTemplates[0],
        'test',
        ['id', 'name']
      )
      
      expect(highlighted).toHaveProperty('id')
      expect(highlighted).toHaveProperty('name')
    })
  })

  describe('getSearchSuggestions', () => {
    it('should work as convenience function', () => {
      const suggestions = getSearchSuggestions(mockTemplates, 'test')
      
      expect(Array.isArray(suggestions)).toBe(true)
    })
  })
})
