import { useState, useEffect, useCallback, useMemo } from 'react'
import { SearchService } from '@/core/search.service'
import { ConfigService } from '@/core/config.service'
import { Template } from '@/types/template'
import { SearchState, SearchConfig, DEFAULT_SEARCH_CONFIG } from '@/types/ui'

interface UseSearchOptions {
  config?: Partial<SearchConfig>
  onResults?: (results: Template[]) => void
  onError?: (error: Error) => void
}

interface UseSearchReturn {
  searchState: SearchState
  search: (query: string) => void
  clearSearch: () => void
  setFilters: (filters: Partial<SearchState['filters']>) => void
  navigateUp: () => void
  navigateDown: () => void
  selectResult: (index: number) => void
  isSearching: boolean
  hasResults: boolean
  resultCount: number
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { config: userConfig = {}, onResults, onError } = options
  
  // Merge user config with defaults
  const config = useMemo(() => ({
    ...DEFAULT_SEARCH_CONFIG,
    ...userConfig
  }), [userConfig])
  
  // Search state
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    selectedIndex: 0,
    isLoading: false,
    error: undefined,
    showDetail: false,
    detailTemplate: undefined,
    filters: {
      type: undefined,
      labels: [],
      repo: undefined
    },
    stats: {
      totalResults: 0,
      searchTime: 0,
      repositories: []
    }
  })
  
  // Services
  const [searchService] = useState(() => new SearchService())
  const [configService] = useState(() => new ConfigService())
  
  // Debounced search function
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)
  
  const performSearch = useCallback(async (query: string, filters: SearchState['filters']) => {
    // 空查询且没有过滤器时，显示所有模板（用于初始状态）
    const isEmpty = !query.trim() && !filters.type && filters.labels.length === 0
    
    // 对于真正的空查询（初始状态），我们要显示所有模板
    // 但如果查询被清空了，我们也要重新显示所有模板
    
    setSearchState(prev => ({ ...prev, isLoading: true, error: undefined }))
    
    try {
      const startTime = Date.now()
      
      const searchOptions = {
        keyword: isEmpty ? '' : query, // 空查询时使用空字符串来获取所有模板
        type: filters.type,
        labels: filters.labels,
        repoName: filters.repo,
        enablePinyin: config.enablePinyin,
        threshold: config.threshold,
        maxResults: config.maxResults
      }
      
      const results = await searchService.searchTemplates(searchOptions)
      const searchTime = Date.now() - startTime
      
      const repositories = Array.from(new Set(results.map(r => r.template.repoName)))
      
      setSearchState(prev => ({
        ...prev,
        results,
        isLoading: false,
        selectedIndex: 0,
        stats: {
          totalResults: results.length,
          searchTime,
          repositories
        }
      }))
      
      onResults?.(results.map(r => r.template as any))
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Search failed')
      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message,
        results: []
      }))
      onError?.(err)
    }
  }, [searchService, config, onResults, onError])
  
  const search = useCallback((query: string) => {
    setSearchState(prev => {
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      
      // 如果防抖时间为0，立即执行搜索；否则设置定时器
      if (config.debounceMs === 0) {
        performSearch(query, prev.filters)
      } else {
        const timer = setTimeout(() => {
          performSearch(query, prev.filters)
        }, config.debounceMs)
        
        setDebounceTimer(timer)
      }
      
      return { ...prev, query }
    })
  }, [debounceTimer, performSearch, config.debounceMs])
  
  const clearSearch = useCallback(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      setDebounceTimer(null)
    }
    
    setSearchState({
      query: '',
      results: [],
      selectedIndex: 0,
      isLoading: false,
      error: undefined,
      showDetail: false,
      detailTemplate: undefined,
      filters: {
        type: undefined,
        labels: [],
        repo: undefined
      },
      stats: {
        totalResults: 0,
        searchTime: 0,
        repositories: []
      }
    })
    
    // 清除查询后重新执行空搜索来显示所有模板
    performSearch('', {
      type: undefined,
      labels: [],
      repo: undefined
    })
  }, [debounceTimer, performSearch])
  
  const setFilters = useCallback((newFilters: Partial<SearchState['filters']>) => {
    setSearchState(prev => {
      const updatedFilters = { ...prev.filters, ...newFilters }
      
      // Trigger search with new filters if there's a query
      if (prev.query.trim() || updatedFilters.type || updatedFilters.labels.length > 0) {
        // Clear existing timer
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        
        // 如果防抖时间为0，立即执行搜索；否则设置定时器
        if (config.debounceMs === 0) {
          performSearch(prev.query, updatedFilters)
        } else {
          const timer = setTimeout(() => {
            performSearch(prev.query, updatedFilters)
          }, config.debounceMs)
          
          setDebounceTimer(timer)
        }
      }
      
      return {
        ...prev,
        filters: updatedFilters
      }
    })
  }, [debounceTimer, performSearch, config.debounceMs])

  const navigateUp = useCallback(() => {
    setSearchState(prevState => {
      if (prevState.results.length === 0) return prevState
      const newIndex = prevState.selectedIndex > 0 
        ? prevState.selectedIndex - 1 
        : prevState.results.length - 1
      return {
        ...prevState,
        selectedIndex: newIndex
      }
    })
  }, [])

  const navigateDown = useCallback(() => {
    setSearchState(prevState => {
      if (prevState.results.length === 0) return prevState
      const newIndex = prevState.selectedIndex < prevState.results.length - 1
        ? prevState.selectedIndex + 1
        : 0
      return {
        ...prevState,
        selectedIndex: newIndex
      }
    })
  }, [])

  const selectResult = useCallback((index: number) => {
    setSearchState(prevState => ({
      ...prevState,
      selectedIndex: Math.max(0, Math.min(index, prevState.results.length - 1))
    }))
  }, [])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  return {
    searchState,
    search,
    clearSearch,
    setFilters,
    navigateUp,
    navigateDown,
    selectResult,
    isSearching: searchState.isLoading,
    hasResults: searchState.results.length > 0,
    resultCount: searchState.results.length
  }
}
