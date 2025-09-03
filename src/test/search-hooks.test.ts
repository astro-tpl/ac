/**
 * 搜索相关 hooks 测试
 * 测试 useSearch hook 的状态管理和用户交互功能
 */

import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { SearchResult } from '@/types/template'

// Mock 搜索服务
vi.mock('@/core/search.service', () => ({
  SearchService: vi.fn(() => ({
    searchTemplates: vi.fn(),
  })),
}))

import { useSearch } from '@/ui/hooks/useSearch'
import { SearchService } from '@/core/search.service'

// 测试用的搜索结果
const mockSearchResults: SearchResult[] = [
  {
    matchedFields: ['name'],
    score: 100,
    template: {
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
  },
  {
    matchedFields: ['labels'],
    score: 80,
    template: {
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
  },
]

describe('useSearch Hook', () => {
  let mockSearchService: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchService = {
      searchTemplates: vi.fn(),
    }
    vi.mocked(SearchService).mockImplementation(() => mockSearchService)
  })

  describe('初始状态', () => {
    test('应该返回正确的初始状态', () => {
      const { result } = renderHook(() => useSearch())

      expect(result.current.searchState.results).toEqual([])
      expect(result.current.searchState.isLoading).toBe(false)
      expect(result.current.searchState.error).toBeUndefined()
      expect(result.current.searchState.selectedIndex).toBe(0)
      expect(result.current.searchState.showDetail).toBe(false)
      expect(result.current.searchState.detailTemplate).toBeUndefined()
      expect(result.current.searchState.filters).toEqual({
        labels: [],
        repo: undefined,
        type: undefined,
      })
      expect(result.current.isSearching).toBe(false)
      expect(result.current.hasResults).toBe(false)
    })

    test('应该使用自定义配置', () => {
      const customConfig = {
        enablePinyin: false,
        maxResults: 5,
        threshold: -5000,
      }

      const { result } = renderHook(() => useSearch({ config: customConfig }))

      // Hook 应该接受自定义配置，但初始状态仍然是默认的
      expect(result.current.searchState.results).toEqual([])
    })
  })

  describe('搜索功能', () => {
    test('应该执行搜索并更新结果', async () => {
      mockSearchService.searchTemplates.mockResolvedValue(mockSearchResults)

      const { result } = renderHook(() => useSearch())

      // 执行搜索
      await act(async () => {
        result.current.search('前端')
      })

      expect(result.current.searchState.results).toEqual(mockSearchResults)
      expect(result.current.searchState.isLoading).toBe(false)
      expect(result.current.searchState.selectedIndex).toBe(0)
      expect(result.current.hasResults).toBe(true)
      expect(mockSearchService.searchTemplates).toHaveBeenCalledWith({
        enablePinyin: true,
        keyword: '前端',
        labels: [],
        maxResults: 20,
        repoName: undefined,
        threshold: -10000,
        type: undefined,
      })
    })

    test('应该处理空搜索结果', async () => {
      mockSearchService.searchTemplates.mockResolvedValue([])

      const { result } = renderHook(() => useSearch())

      await act(async () => {
        result.current.search('不存在的模板')
      })

      expect(result.current.searchState.results).toEqual([])
      expect(result.current.hasResults).toBe(false)
    })

    test('应该处理搜索错误', async () => {
      const searchError = new Error('Search failed')
      mockSearchService.searchTemplates.mockRejectedValue(searchError)

      const onError = vi.fn()
      const { result } = renderHook(() => useSearch({ onError }))

      await act(async () => {
        result.current.search('错误查询')
      })

      expect(result.current.searchState.error).toBe('Search failed')
      expect(result.current.searchState.results).toEqual([])
      expect(onError).toHaveBeenCalledWith(searchError)
    })

    test('应该完成异步搜索', async () => {
      let resolveSearch: (value: SearchResult[]) => void
      const searchPromise = new Promise<SearchResult[]>((resolve) => {
        resolveSearch = resolve
      })
      mockSearchService.searchTemplates.mockReturnValue(searchPromise)

      const { result } = renderHook(() => useSearch())

      // 开始搜索
      act(() => {
        result.current.search('测试')
      })

      // 完成搜索
      await act(async () => {
        resolveSearch!(mockSearchResults)
        await searchPromise
      })

      expect(result.current.searchState.results).toEqual(mockSearchResults)
    })
  })

  describe('清空搜索', () => {
    test('应该清空搜索结果并重置状态', async () => {
      mockSearchService.searchTemplates.mockResolvedValue(mockSearchResults)

      const { result } = renderHook(() => useSearch())

      // 先执行搜索
      await act(async () => {
        result.current.search('前端')
      })

      expect(result.current.searchState.results).toEqual(mockSearchResults)

      // 清空搜索
      act(() => {
        result.current.clearSearch()
      })

      expect(result.current.searchState.results).toEqual([])
      expect(result.current.searchState.selectedIndex).toBe(0)
      expect(result.current.searchState.error).toBeUndefined()
    })
  })

  describe('导航功能', () => {
    beforeEach(async () => {
      mockSearchService.searchTemplates.mockResolvedValue(mockSearchResults)
    })

    test('应该支持向下导航', async () => {
      const { result } = renderHook(() => useSearch())

      await act(async () => {
        result.current.search('前端')
      })

      expect(result.current.searchState.selectedIndex).toBe(0)

      // 向下导航
      act(() => {
        result.current.navigateDown()
      })

      expect(result.current.searchState.selectedIndex).toBe(1)

      // 到达末尾时应该循环到开始
      act(() => {
        result.current.navigateDown()
      })

      expect(result.current.searchState.selectedIndex).toBe(0)
    })

    test('应该支持向上导航', async () => {
      const { result } = renderHook(() => useSearch())

      await act(async () => {
        result.current.search('前端')
      })

      expect(result.current.searchState.selectedIndex).toBe(0)

      // 向上导航（从开始应该循环到末尾）
      act(() => {
        result.current.navigateUp()
      })

      expect(result.current.searchState.selectedIndex).toBe(1)

      // 再次向上导航
      act(() => {
        result.current.navigateUp()
      })

      expect(result.current.searchState.selectedIndex).toBe(0)
    })

    test('没有结果时导航应该不产生效果', () => {
      const { result } = renderHook(() => useSearch())

      expect(result.current.searchState.selectedIndex).toBe(0)

      act(() => {
        result.current.navigateDown()
      })

      expect(result.current.searchState.selectedIndex).toBe(0)

      act(() => {
        result.current.navigateUp()
      })

      expect(result.current.searchState.selectedIndex).toBe(0)
    })
  })

  describe('选择结果', () => {
    beforeEach(async () => {
      mockSearchService.searchTemplates.mockResolvedValue(mockSearchResults)
    })

    test('应该选择指定的结果', async () => {
      const { result } = renderHook(() => useSearch())

      await act(async () => {
        result.current.search('前端')
      })

      act(() => {
        result.current.selectResult(1)
      })

      expect(result.current.searchState.selectedIndex).toBe(1)
      // selectResult 只设置 selectedIndex，不自动显示详情
      expect(result.current.searchState.showDetail).toBe(false)
    })

    test('选择无效索引时应该限制到有效范围', async () => {
      const { result } = renderHook(() => useSearch())

      await act(async () => {
        result.current.search('前端')
      })

      act(() => {
        result.current.selectResult(999) // 无效索引
      })

      // selectResult 会限制索引到有效范围 (0 到 length-1)
      expect(result.current.searchState.selectedIndex).toBe(1) // 最大有效索引
      expect(result.current.searchState.showDetail).toBe(false)
    })
  })

  describe('过滤器功能', () => {
    test('应该设置过滤器并重新搜索', async () => {
      mockSearchService.searchTemplates.mockResolvedValue(mockSearchResults)

      const { result } = renderHook(() => useSearch())

      // 先搜索一次
      await act(async () => {
        result.current.search('前端')
      })

      // 设置过滤器
      await act(async () => {
        result.current.setFilters({
          labels: ['react'],
          type: 'prompt',
        })
      })

      expect(result.current.searchState.filters).toEqual({
        labels: ['react'],
        repo: undefined,
        type: 'prompt',
      })

      // 应该使用过滤器重新搜索
      expect(mockSearchService.searchTemplates).toHaveBeenLastCalledWith({
        enablePinyin: true,
        keyword: '前端',
        labels: ['react'],
        maxResults: 20,
        repoName: undefined,
        threshold: -10000,
        type: 'prompt',
      })
    })
  })

  describe('回调函数', () => {
    test('应该在搜索结果更新时调用 onResults', async () => {
      const onResults = vi.fn()
      mockSearchService.searchTemplates.mockResolvedValue(mockSearchResults)

      const { result } = renderHook(() => useSearch({ onResults }))

      await act(async () => {
        result.current.search('前端')
      })

      expect(onResults).toHaveBeenCalledWith([
        mockSearchResults[0].template,
        mockSearchResults[1].template,
      ])
    })

    test('应该在错误时调用 onError', async () => {
      const onError = vi.fn()
      const searchError = new Error('Search failed')
      mockSearchService.searchTemplates.mockRejectedValue(searchError)

      const { result } = renderHook(() => useSearch({ onError }))

      await act(async () => {
        result.current.search('错误查询')
      })

      expect(onError).toHaveBeenCalledWith(searchError)
    })
  })

  describe('边界情况和错误处理', () => {
    test('应该处理空查询字符串', async () => {
      mockSearchService.searchTemplates.mockResolvedValue(mockSearchResults)

      const { result } = renderHook(() => useSearch())

      await act(async () => {
        result.current.search('')
      })

      expect(mockSearchService.searchTemplates).toHaveBeenCalledWith({
        enablePinyin: true,
        keyword: '',
        labels: [],
        maxResults: 20,
        repoName: undefined,
        threshold: -10000,
        type: undefined,
      })
    })

    test('应该处理连续的搜索调用', async () => {
      mockSearchService.searchTemplates.mockResolvedValue(mockSearchResults)

      const { result } = renderHook(() => useSearch())

      // 连续搜索
      await act(async () => {
        result.current.search('query1')
        result.current.search('query2')
        result.current.search('query3')
      })

      // 应该执行所有搜索
      expect(mockSearchService.searchTemplates).toHaveBeenCalledTimes(3)
      expect(mockSearchService.searchTemplates).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'query3' })
      )
    })

    test('应该处理搜索服务返回的异常数据', async () => {
      // 返回 null 或 undefined
      mockSearchService.searchTemplates.mockResolvedValue(null)

      const { result } = renderHook(() => useSearch())

      await act(async () => {
        result.current.search('test')
      })

      expect(result.current.searchState.results).toEqual([])
    })

    test('应该处理异步搜索错误', async () => {
      const timeoutError = new Error('Search timeout')
      mockSearchService.searchTemplates.mockRejectedValue(timeoutError)

      const { result } = renderHook(() => useSearch())

      await act(async () => {
        result.current.search('slow query')
      })

      expect(result.current.searchState.error).toBe('Search timeout')
      expect(result.current.searchState.results).toEqual([])
    })
  })
})
