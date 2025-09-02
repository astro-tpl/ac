/**
 * 重构后的搜索服务测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SearchService } from '../core/search.service'
import { IndexedTemplate } from '../types/template'

// Mock dependencies
vi.mock('../core/config.service', () => ({
  configService: {
    resolveConfig: vi.fn().mockResolvedValue({
      config: {
        repos: [
          { name: 'test-repo', git: 'https://github.com/test/repo.git' }
        ]
      }
    })
  }
}))

vi.mock('../infra/index-cache', () => ({
  getTemplateIndex: vi.fn().mockResolvedValue({
    templates: [
      {
        id: 'react-component',
        type: 'context',
        name: 'React Component Template',
        labels: ['react', 'frontend', 'component'],
        summary: 'A template for creating React components',
        repoName: 'test-repo',
        absPath: '/path/to/react-component.yaml',
        lastModified: Date.now()
      },
      {
        id: 'vue-setup',
        type: 'prompt',
        name: 'Vue 3 Setup Guide',
        labels: ['vue', 'frontend', 'setup'],
        summary: 'Guide for setting up Vue 3 projects',
        repoName: 'test-repo',
        absPath: '/path/to/vue-setup.yaml',
        lastModified: Date.now()
      },
      {
        id: 'backend-api',
        type: 'context',
        name: 'Backend API Template',
        labels: ['backend', 'api', 'nodejs'],
        summary: 'Template for creating backend APIs',
        repoName: 'test-repo',
        absPath: '/path/to/backend-api.yaml',
        lastModified: Date.now()
      }
    ]
  }),
  rebuildTemplateIndex: vi.fn().mockResolvedValue({
    templates: []
  })
}))

vi.mock('../infra/fuzzysort', () => ({
  searchTemplates: vi.fn().mockImplementation((templates, query, options = {}) => {
    // Simple mock implementation
    let results
    
    if (!query) {
      results = templates.map((template: IndexedTemplate) => ({
        score: 1,
        template,
        matchedFields: []
      }))
    } else {
      results = templates
        .filter((template: IndexedTemplate) => 
          template.id.toLowerCase().includes(query.toLowerCase()) ||
          template.name.toLowerCase().includes(query.toLowerCase()) ||
          template.labels.some((label: string) => label.toLowerCase().includes(query.toLowerCase()))
        )
        .map((template: IndexedTemplate) => ({
          score: 0.8,
          template,
          matchedFields: ['name']
        }))
    }
    
    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit)
    }
    
    return results
  })
}))

vi.mock('../infra/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('../i18n', () => ({
  t: vi.fn((key: string) => key)
}))

describe('SearchService (Refactored)', () => {
  let searchService: SearchService

  beforeEach(() => {
    searchService = new SearchService()
    vi.clearAllMocks()
  })

  describe('searchTemplates', () => {
    it('should search templates using fuzzysort', async () => {
      const results = await searchService.searchTemplates({
        keyword: 'react'
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].template.id).toBe('react-component')
      expect(results[0].matchedFields).toContain('name')
    })

    it('should return all templates when no keyword provided', async () => {
      const results = await searchService.searchTemplates({
        keyword: ''
      })

      expect(results.length).toBe(3)
      expect(results.every(r => r.score === 1)).toBe(true)
    })

    it('should filter by template type', async () => {
      const results = await searchService.searchTemplates({
        keyword: '',
        type: 'prompt'
      })

      expect(results.length).toBe(1)
      expect(results[0].template.type).toBe('prompt')
      expect(results[0].template.id).toBe('vue-setup')
    })

    it('should filter by labels (any match)', async () => {
      const results = await searchService.searchTemplates({
        keyword: '',
        labels: ['frontend']
      })

      expect(results.length).toBe(2)
      expect(results.every(r => r.template.labels.includes('frontend'))).toBe(true)
    })

    it('should filter by labels (all match)', async () => {
      const results = await searchService.searchTemplates({
        keyword: '',
        labels: ['react', 'component'],
        labelMatchAll: true
      })

      expect(results.length).toBe(1)
      expect(results[0].template.id).toBe('react-component')
      expect(results[0].template.labels).toEqual(
        expect.arrayContaining(['react', 'component'])
      )
    })

    it('should filter by repository name', async () => {
      const results = await searchService.searchTemplates({
        keyword: '',
        repoName: 'test-repo'
      })

      expect(results.length).toBe(3)
      expect(results.every(r => r.template.repoName === 'test-repo')).toBe(true)
    })

    it('should return empty array for non-existent repository', async () => {
      const results = await searchService.searchTemplates({
        keyword: '',
        repoName: 'non-existent-repo'
      })

      expect(results.length).toBe(0)
    })

    it('should respect maxResults parameter', async () => {
      const results = await searchService.searchTemplates({
        keyword: '',
        maxResults: 2
      })

      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should pass fuzzysort options correctly', async () => {
      const { searchTemplates: mockSearchTemplates } = await import('../infra/fuzzysort')
      
      await searchService.searchTemplates({
        keyword: 'test',
        maxResults: 5,
        enablePinyin: false,
        threshold: -5000
      })

      expect(mockSearchTemplates).toHaveBeenCalledWith(
        expect.any(Array),
        'test',
        expect.objectContaining({
          limit: 5,
          enablePinyin: false,
          threshold: -5000,
          weights: expect.any(Object)
        })
      )
    })
  })

  describe('getSearchStats', () => {
    it('should return search statistics', async () => {
      const stats = await searchService.getSearchStats()

      expect(stats).toHaveProperty('totalTemplates')
      expect(stats).toHaveProperty('promptCount')
      expect(stats).toHaveProperty('contextCount')
      expect(stats).toHaveProperty('repoStats')
      expect(Array.isArray(stats.repoStats)).toBe(true)
    })
  })

  describe('rebuildIndex', () => {
    it('should rebuild search index', async () => {
      const result = await searchService.rebuildIndex()

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('templateCount')
      expect(result).toHaveProperty('duration')
      expect(typeof result.duration).toBe('number')
    })
  })
})
