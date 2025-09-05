import {ConfigService} from '@/core/config.service'
import {SearchService} from '@/core/search.service'
import {Template} from '@/types/template'
import {DEFAULT_SEARCH_CONFIG, SearchConfig, SearchState} from '@/types/ui'
import {
  useCallback, useEffect, useMemo, useState,
} from 'react'

interface UseSearchOptions {
  config?: Partial<SearchConfig>
  onError?: (error: Error) => void
  onResults?: (results: Template[]) => void
}

interface UseSearchReturn {
  clearSearch: () => void
  hasResults: boolean
  isSearching: boolean
  navigateDown: () => void
  navigateUp: () => void
  resultCount: number
  search: (query: string) => void
  searchState: SearchState
  selectResult: (index: number) => void
  setFilters: (filters: Partial<SearchState['filters']>) => void
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {config: userConfig = {}, onError, onResults} = options

  // Merge user config with defaults
  const config = useMemo(() => ({
    ...DEFAULT_SEARCH_CONFIG,
    ...userConfig,
  }), [userConfig])

  // Search state
  const [searchState, setSearchState] = useState<SearchState>({
    detailTemplate: undefined,
    error: undefined,
    filters: {
      labels: [],
      repo: undefined,
      type: undefined,
    },
    isLoading: false,
    query: '',
    results: [],
    selectedIndex: 0,
    showDetail: false,
    stats: {
      repositories: [],
      searchTime: 0,
      totalResults: 0,
    },
  })

  // Services
  const [searchService] = useState(() => new SearchService())
  const [configService] = useState(() => new ConfigService())

  // Debounced search function
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const performSearch = useCallback(async (query: string, filters: SearchState['filters']) => {
    // When query is empty and no filters, show all templates (for initial state)
    const isEmpty = !query.trim() && !filters.type && filters.labels.length === 0

    // For truly empty queries (initial state), we want to show all templates
    // But if query is cleared, we also want to show all templates again

    setSearchState(prev => ({...prev, error: undefined, isLoading: true}))

    try {
      const startTime = Date.now()

      const searchOptions = {
        enablePinyin: config.enablePinyin,
        keyword: isEmpty ? '' : query, // Use empty string for empty queries to get all templates
        labels: filters.labels,
        maxResults: config.maxResults,
        repoName: filters.repo,
        threshold: config.threshold,
        type: filters.type,
      }

      const results = await searchService.searchTemplates(searchOptions)
      const searchTime = Date.now() - startTime

      const repositories = [...new Set(results.map(r => r.template.repoName))]

      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        results,
        selectedIndex: 0,
        stats: {
          repositories,
          searchTime,
          totalResults: results.length,
        },
      }))

      onResults?.(results.map(r => r.template as any))
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Search failed')
      setSearchState(prev => ({
        ...prev,
        error: err.message,
        isLoading: false,
        results: [],
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

      // If debounce time is 0, execute search immediately; otherwise set timer
      if (config.debounceMs === 0) {
        performSearch(query, prev.filters)
      } else {
        const timer = setTimeout(() => {
          performSearch(query, prev.filters)
        }, config.debounceMs)

        setDebounceTimer(timer)
      }

      return {...prev, query}
    })
  }, [debounceTimer, performSearch, config.debounceMs])

  const clearSearch = useCallback(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      setDebounceTimer(null)
    }

    setSearchState({
      detailTemplate: undefined,
      error: undefined,
      filters: {
        labels: [],
        repo: undefined,
        type: undefined,
      },
      isLoading: false,
      query: '',
      results: [],
      selectedIndex: 0,
      showDetail: false,
      stats: {
        repositories: [],
        searchTime: 0,
        totalResults: 0,
      },
    })

    // After clearing query, re-execute empty search to show all templates
    performSearch('', {
      labels: [],
      repo: undefined,
      type: undefined,
    })
  }, [debounceTimer, performSearch])

  const setFilters = useCallback((newFilters: Partial<SearchState['filters']>) => {
    setSearchState(prev => {
      const updatedFilters = {...prev.filters, ...newFilters}

      // Trigger search with new filters if there's a query
      if (prev.query.trim() || updatedFilters.type || updatedFilters.labels.length > 0) {
        // Clear existing timer
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }

        // If debounce time is 0, execute search immediately; otherwise set timer
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
        filters: updatedFilters,
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
        selectedIndex: newIndex,
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
        selectedIndex: newIndex,
      }
    })
  }, [])

  const selectResult = useCallback((index: number) => {
    setSearchState(prevState => ({
      ...prevState,
      selectedIndex: Math.max(0, Math.min(index, prevState.results.length - 1)),
    }))
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    clearSearch,
    hasResults: searchState.results.length > 0,
    isSearching: searchState.isLoading,
    navigateDown,
    navigateUp,
    resultCount: searchState.results.length,
    search,
    searchState,
    selectResult,
    setFilters,
  }
}
