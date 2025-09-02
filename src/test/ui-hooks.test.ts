import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from '../ui/hooks/useSearch'
import { useClipboard } from '../ui/hooks/useClipboard'
import { SearchService } from '../core/search.service'
import { ConfigService } from '../core/config.service'
import { ClipboardManager } from '../infra/clipboard'
import { Template } from '../types/template'

// Mock the services
vi.mock('../core/search.service')
vi.mock('../core/config.service')
vi.mock('../infra/clipboard')

describe('useSearch', () => {
  const mockSearchService = {
    searchTemplates: vi.fn()
  }
  
  const mockConfigService = {
    getEffectiveConfig: vi.fn()
  }
  
  const mockTemplate: Template = {
    id: 'test-template',
    name: 'Test Template',
    type: 'context',
    summary: 'A test template',
    labels: ['test'],
    content: 'Test content',
    repo: 'test-repo'
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Setup default mocks
    ;(SearchService as any).mockImplementation(() => mockSearchService)
    ;(ConfigService as any).mockImplementation(() => mockConfigService)
    
    mockConfigService.getEffectiveConfig.mockResolvedValue({
      repositories: [{ name: 'test-repo', url: 'test-url' }]
    })
    
    mockSearchService.searchTemplates.mockResolvedValue([mockTemplate])
  })
  
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })
  
  it('should initialize with empty search state', () => {
    const { result } = renderHook(() => useSearch())
    
    expect(result.current.searchState.query).toBe('')
    expect(result.current.searchState.results).toEqual([])
    expect(result.current.searchState.isLoading).toBe(false)
    expect(result.current.searchState.error).toBe(null)
    expect(result.current.isSearching).toBe(false)
    expect(result.current.hasResults).toBe(false)
    expect(result.current.resultCount).toBe(0)
  })
  
  it('should perform debounced search', async () => {
    const onResults = vi.fn()
    const { result } = renderHook(() => useSearch({ onResults }))
    
    act(() => {
      result.current.search('test query')
    })
    
    expect(result.current.searchState.query).toBe('test query')
    expect(mockSearchService.searchTemplates).not.toHaveBeenCalled()
    
    // Fast-forward past debounce delay
    act(() => {
      vi.advanceTimersByTime(300)
    })
    
    // Wait for async operations
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    expect(mockSearchService.searchTemplates).toHaveBeenCalledWith(
      'test query',
      expect.objectContaining({
        enablePinyin: true,
        threshold: 0.3,
        maxResults: 20
      }),
      expect.any(Object)
    )
    
    expect(onResults).toHaveBeenCalledWith([mockTemplate])
    expect(result.current.hasResults).toBe(true)
    expect(result.current.resultCount).toBe(1)
  })
  
  it('should handle search errors', async () => {
    const onError = vi.fn()
    const error = new Error('Search failed')
    mockSearchService.searchTemplates.mockRejectedValue(error)
    
    const { result } = renderHook(() => useSearch({ onError }))
    
    act(() => {
      result.current.search('test query')
    })
    
    act(() => {
      vi.advanceTimersByTime(300)
    })
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    expect(result.current.searchState.error).toBe(error)
    expect(onError).toHaveBeenCalledWith(error)
    expect(result.current.hasResults).toBe(false)
  })
  
  it('should clear search state', () => {
    const { result } = renderHook(() => useSearch())
    
    act(() => {
      result.current.search('test query')
    })
    
    expect(result.current.searchState.query).toBe('test query')
    
    act(() => {
      result.current.clearSearch()
    })
    
    expect(result.current.searchState.query).toBe('')
    expect(result.current.searchState.results).toEqual([])
    expect(result.current.searchState.selectedIndex).toBe(0)
  })
  
  it('should update filters and trigger search', async () => {
    const { result } = renderHook(() => useSearch())
    
    act(() => {
      result.current.search('test')
    })
    
    act(() => {
      result.current.setFilters({ type: 'context', labels: ['frontend'] })
    })
    
    act(() => {
      vi.advanceTimersByTime(300)
    })
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    expect(result.current.searchState.filters.type).toBe('context')
    expect(result.current.searchState.filters.labels).toEqual(['frontend'])
    
    expect(mockSearchService.searchTemplates).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        type: 'context',
        labels: ['frontend']
      }),
      expect.any(Object)
    )
  })
})

describe('useClipboard', () => {
  const mockClipboardManager = {
    isAvailable: vi.fn(),
    copyText: vi.fn(),
    copyTemplateContent: vi.fn(),
    copySearchSummary: vi.fn(),
    readText: vi.fn(),
    clear: vi.fn()
  }
  
  const mockTemplate: Template = {
    id: 'test-template',
    name: 'Test Template',
    type: 'context',
    summary: 'A test template',
    labels: ['test'],
    content: 'Test content',
    repo: 'test-repo'
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
    ;(ClipboardManager as any).mockImplementation(() => mockClipboardManager)
    mockClipboardManager.isAvailable.mockReturnValue(true)
  })
  
  it('should initialize with clipboard availability', () => {
    const { result } = renderHook(() => useClipboard())
    
    expect(result.current.isAvailable).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.lastError).toBe(null)
  })
  
  it('should copy text successfully', async () => {
    const onSuccess = vi.fn()
    mockClipboardManager.copyText.mockResolvedValue(undefined)
    
    const { result } = renderHook(() => useClipboard({ onSuccess }))
    
    let copyResult: boolean
    await act(async () => {
      copyResult = await result.current.copyText('test text')
    })
    
    expect(copyResult!).toBe(true)
    expect(mockClipboardManager.copyText).toHaveBeenCalledWith('test text')
    expect(onSuccess).toHaveBeenCalledWith('Text copied to clipboard')
    expect(result.current.lastError).toBe(null)
  })
  
  it('should handle copy text errors', async () => {
    const onError = vi.fn()
    const error = new Error('Copy failed')
    mockClipboardManager.copyText.mockRejectedValue(error)
    
    const { result } = renderHook(() => useClipboard({ onError }))
    
    let copyResult: boolean
    await act(async () => {
      copyResult = await result.current.copyText('test text')
    })
    
    expect(copyResult!).toBe(false)
    expect(onError).toHaveBeenCalledWith(error)
    expect(result.current.lastError).toBe(error)
  })
  
  it('should copy template successfully', async () => {
    const onSuccess = vi.fn()
    mockClipboardManager.copyTemplateContent.mockResolvedValue(undefined)
    
    const { result } = renderHook(() => useClipboard({ onSuccess }))
    
    let copyResult: boolean
    await act(async () => {
      copyResult = await result.current.copyTemplate(mockTemplate)
    })
    
    expect(copyResult!).toBe(true)
    expect(mockClipboardManager.copyTemplateContent).toHaveBeenCalledWith(mockTemplate)
    expect(onSuccess).toHaveBeenCalledWith('Template "Test Template" copied to clipboard')
  })
  
  it('should copy search summary successfully', async () => {
    const onSuccess = vi.fn()
    mockClipboardManager.copySearchSummary.mockResolvedValue(undefined)
    
    const { result } = renderHook(() => useClipboard({ onSuccess }))
    
    let copyResult: boolean
    await act(async () => {
      copyResult = await result.current.copySearchSummary([mockTemplate], 'test query')
    })
    
    expect(copyResult!).toBe(true)
    expect(mockClipboardManager.copySearchSummary).toHaveBeenCalledWith([mockTemplate], 'test query')
    expect(onSuccess).toHaveBeenCalledWith('Search summary (1 results) copied to clipboard')
  })
  
  it('should handle unavailable clipboard', async () => {
    const onError = vi.fn()
    mockClipboardManager.isAvailable.mockReturnValue(false)
    
    const { result } = renderHook(() => useClipboard({ onError }))
    
    expect(result.current.isAvailable).toBe(false)
    
    let copyResult: boolean
    await act(async () => {
      copyResult = await result.current.copyText('test text')
    })
    
    expect(copyResult!).toBe(false)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Clipboard is not available'
    }))
  })
  
  it('should read text from clipboard', async () => {
    mockClipboardManager.readText.mockResolvedValue('clipboard content')
    
    const { result } = renderHook(() => useClipboard())
    
    let readResult: string | null
    await act(async () => {
      readResult = await result.current.readText()
    })
    
    expect(readResult!).toBe('clipboard content')
    expect(mockClipboardManager.readText).toHaveBeenCalled()
  })
  
  it('should clear clipboard', async () => {
    const onSuccess = vi.fn()
    mockClipboardManager.clear.mockResolvedValue(undefined)
    
    const { result } = renderHook(() => useClipboard({ onSuccess }))
    
    let clearResult: boolean
    await act(async () => {
      clearResult = await result.current.clear()
    })
    
    expect(clearResult!).toBe(true)
    expect(mockClipboardManager.clear).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledWith('Clipboard cleared')
  })
})
