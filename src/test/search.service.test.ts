/**
 * 搜索服务测试
 * 测试整个搜索服务的集成功能，包括配置解析、仓库管理、索引构建和搜索等
 */

import type { IndexedTemplate, SearchResult } from '@/types/template'
import type { RepoConfig } from '@/types/config'
import { SearchService } from '@/core/search.service'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock 依赖模块
vi.mock('@/core/config.service', () => ({
  configService: {
    resolveConfig: vi.fn(),
  },
}))

vi.mock('@/infra/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/infra/index-cache', () => ({
  getTemplateIndex: vi.fn(),
}))

vi.mock('@/infra/fuzzysort', () => ({
  searchTemplates: vi.fn(),
}))

import { configService } from '@/core/config.service'
import { searchTemplates as fuzzysortSearch } from '@/infra/fuzzysort'
import { getTemplateIndex } from '@/infra/index-cache'

// 测试用的模板索引数据
const mockIndexedTemplates: IndexedTemplate[] = [
  {
    absPath: '/test/templates/frontend-review.yaml',
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
    absPath: '/test/templates/backend-api.yaml',
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
    absPath: '/test/templates/vue-component.yaml',
    content: 'Vue 组件开发规范',
    id: 'vue-component-v1',
    labels: ['frontend', 'vue', 'component'],
    lastModified: Date.now(),
    name: 'Vue组件开发',
    repoName: 'vue-templates',
    summary: 'Vue 组件开发最佳实践',
    type: 'prompt',
  },
]

const mockRepoConfigs: RepoConfig[] = [
  {
    branch: 'main',
    git: 'https://github.com/test/templates.git',
    name: 'templates',
    path: '/test/templates',
  },
  {
    branch: 'main',
    git: 'https://github.com/test/vue-templates.git',
    name: 'vue-templates',
    path: '/test/vue-templates',
  },
]

describe('SearchService', () => {
  let searchService: SearchService

  beforeEach(() => {
    searchService = new SearchService()
    vi.clearAllMocks()
  })

  describe('基本搜索功能', () => {
    test('成功搜索模板', async () => {
      // Mock 配置和索引
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: mockIndexedTemplates,
        version: '1.0.0',
      })

      // Mock 搜索结果
      const mockSearchResults: SearchResult[] = [
        {
          matchedFields: ['name', 'labels'],
          score: 100,
          template: mockIndexedTemplates[0],
        },
      ]
      vi.mocked(fuzzysortSearch).mockReturnValue(mockSearchResults)

      const results = await searchService.searchTemplates({
        keyword: '前端',
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(mockSearchResults[0])
      expect(configService.resolveConfig).toHaveBeenCalledWith({ forceGlobal: false })
      expect(getTemplateIndex).toHaveBeenCalledWith(mockRepoConfigs)
      expect(fuzzysortSearch).toHaveBeenCalledWith(
        mockIndexedTemplates,
        '前端',
        expect.objectContaining({
          enablePinyin: true,
          limit: 10, // 默认 maxDisplayResults 是 10
          threshold: -10000,
          weights: expect.objectContaining({
            id: 4,
            name: 3,
            labels: 2,
            summary: 2,
            content: 1,
          }),
        })
      )
    })

    test('空关键词搜索返回所有模板', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: mockIndexedTemplates,
        version: '1.0.0',
      })

      const mockSearchResults: SearchResult[] = mockIndexedTemplates.map(template => ({
        matchedFields: [],
        score: 1,
        template,
      }))
      vi.mocked(fuzzysortSearch).mockReturnValue(mockSearchResults)

      const results = await searchService.searchTemplates({
        keyword: '',
      })

      expect(results).toHaveLength(3)
      expect(fuzzysortSearch).toHaveBeenCalledWith(
        mockIndexedTemplates,
        '',
        expect.any(Object)
      )
    })

    test('使用强制全局配置', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'global',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: mockIndexedTemplates,
        version: '1.0.0',
      })

      vi.mocked(fuzzysortSearch).mockReturnValue([])

      await searchService.searchTemplates({
        keyword: 'test',
        forceGlobal: true,
      })

      expect(configService.resolveConfig).toHaveBeenCalledWith({ forceGlobal: true })
    })
  })

  describe('过滤功能', () => {
    beforeEach(() => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: mockIndexedTemplates,
        version: '1.0.0',
      })
    })

    test('按类型过滤模板', async () => {
      vi.mocked(fuzzysortSearch).mockReturnValue([])

      await searchService.searchTemplates({
        keyword: 'test',
        type: 'prompt',
      })

      // 验证传递给搜索引擎的模板只包含 prompt 类型
      expect(fuzzysortSearch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'prompt' }),
        ]),
        'test',
        expect.any(Object)
      )

      const passedTemplates = (fuzzysortSearch as any).mock.calls[0][0]
      expect(passedTemplates.every((t: any) => t.type === 'prompt')).toBe(true)
    })

    test('按标签过滤模板（ANY 逻辑）', async () => {
      vi.mocked(fuzzysortSearch).mockReturnValue([])

      await searchService.searchTemplates({
        keyword: 'test',
        labels: ['frontend', 'vue'],
      })

      // 验证传递给搜索引擎的模板包含指定标签
      const passedTemplates = (fuzzysortSearch as any).mock.calls[0][0]
      expect(passedTemplates.length).toBeGreaterThan(0)
      expect(
        passedTemplates.every((t: any) =>
          t.labels.some((label: string) => ['frontend', 'vue'].includes(label))
        )
      ).toBe(true)
    })

    test('按标签过滤模板（ALL 逻辑）', async () => {
      vi.mocked(fuzzysortSearch).mockReturnValue([])

      await searchService.searchTemplates({
        keyword: 'test',
        labels: ['frontend', 'react'],
        labelMatchAll: true,
      })

      // 验证传递给搜索引擎的模板包含所有指定标签
      const passedTemplates = (fuzzysortSearch as any).mock.calls[0][0]
      expect(passedTemplates.length).toBeGreaterThan(0)
      expect(
        passedTemplates.every((t: any) =>
          ['frontend', 'react'].every(label => t.labels.includes(label))
        )
      ).toBe(true)
    })

    test('按仓库过滤模板', async () => {
      vi.mocked(fuzzysortSearch).mockReturnValue([])

      await searchService.searchTemplates({
        keyword: 'test',
        repoName: 'vue-templates',
      })

      // 验证配置只包含指定的仓库
      expect(getTemplateIndex).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'vue-templates' }),
      ])
    })

    test('指定不存在的仓库时返回空结果', async () => {
      const results = await searchService.searchTemplates({
        keyword: 'test',
        repoName: 'nonexistent-repo',
      })

      expect(results).toEqual([])
    })
  })

  describe('搜索选项配置', () => {
    beforeEach(() => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: mockIndexedTemplates,
        version: '1.0.0',
      })

      vi.mocked(fuzzysortSearch).mockReturnValue([])
    })

    test('自定义最大结果数量', async () => {
      await searchService.searchTemplates({
        keyword: 'test',
        maxResults: 5,
      })

      expect(fuzzysortSearch).toHaveBeenCalledWith(
        expect.any(Array),
        'test',
        expect.objectContaining({
          limit: 5,
        })
      )
    })

    test('自定义搜索阈值', async () => {
      await searchService.searchTemplates({
        keyword: 'test',
        threshold: -5000,
      })

      expect(fuzzysortSearch).toHaveBeenCalledWith(
        expect.any(Array),
        'test',
        expect.objectContaining({
          threshold: -5000,
        })
      )
    })

    test('禁用拼音搜索', async () => {
      await searchService.searchTemplates({
        keyword: 'test',
        enablePinyin: false,
      })

      expect(fuzzysortSearch).toHaveBeenCalledWith(
        expect.any(Array),
        'test',
        expect.objectContaining({
          enablePinyin: false,
        })
      )
    })

    test('使用默认搜索配置', async () => {
      await searchService.searchTemplates({})

      expect(fuzzysortSearch).toHaveBeenCalledWith(
        expect.any(Array),
        '',
        expect.objectContaining({
          enablePinyin: true,
          limit: 10, // 默认 maxDisplayResults 是 10
          threshold: -10000, // 默认阈值
          weights: {
            content: 1,
            id: 4,
            labels: 2,
            name: 3,
            summary: 2,
          },
        })
      )
    })
  })

  describe('错误处理和边界情况', () => {
    test('没有配置仓库时返回空结果', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      const results = await searchService.searchTemplates({
        keyword: 'test',
      })

      expect(results).toEqual([])
    })

    test('索引构建失败时处理错误', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockRejectedValue(new Error('Index build failed'))

      await expect(
        searchService.searchTemplates({
          keyword: 'test',
        })
      ).rejects.toThrow('Index build failed')
    })

    test('搜索引擎异常时处理错误', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: mockIndexedTemplates,
        version: '1.0.0',
      })

      vi.mocked(fuzzysortSearch).mockImplementation(() => {
        throw new Error('Search engine error')
      })

      await expect(
        searchService.searchTemplates({
          keyword: 'test',
        })
      ).rejects.toThrow('Search engine error')
    })

    test('空模板索引时返回空结果', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: [],
        version: '1.0.0',
      })

      vi.mocked(fuzzysortSearch).mockReturnValue([])

      const results = await searchService.searchTemplates({
        keyword: 'test',
      })

      expect(results).toEqual([])
    })

    test('处理无效的标签过滤', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: mockIndexedTemplates,
        version: '1.0.0',
      })

      vi.mocked(fuzzysortSearch).mockReturnValue([])

      // 空标签数组应该不影响搜索
      const results = await searchService.searchTemplates({
        keyword: 'test',
        labels: [],
      })

      expect(fuzzysortSearch).toHaveBeenCalledWith(
        mockIndexedTemplates,
        'test',
        expect.any(Object)
      )
    })

    test('处理特殊字符的搜索关键词', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: mockRepoConfigs,
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getTemplateIndex).mockResolvedValue({
        lastUpdated: Date.now(),
        templates: mockIndexedTemplates,
        version: '1.0.0',
      })

      vi.mocked(fuzzysortSearch).mockReturnValue([])

      const specialKeywords = ['@#$%', '  ', '中文混合English123', '']
      
      for (const keyword of specialKeywords) {
        await searchService.searchTemplates({
          keyword,
        })
        
        expect(fuzzysortSearch).toHaveBeenCalledWith(
          expect.any(Array),
          keyword,
          expect.any(Object)
        )
      }
    })
  })
})
