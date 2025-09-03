import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { SearchInput } from './SearchInput'
import { ResultsList } from './ResultsList'
import { DetailView } from './DetailView'
import { ApplyConfirm, InputStep } from './ApplyConfirm'
import { useSearch } from './hooks/useSearch'
import { useClipboard } from './hooks/useClipboard'
import { IndexedTemplate } from '@/types/template'
import { UITheme, ApplyMode } from '@/types/ui'
import { ApplyService } from '@/core/apply.service'
import { normalizeKeyEvent, isNavigationKey, getActionKey } from './utils/keyboardMapping'

interface SearchAppProps {
  /** 初始搜索查询 */
  initialQuery?: string
  /** 搜索选项 */
  searchOptions?: {
    type?: 'prompt' | 'context'
    labels?: string[]
    repo?: string
  }
  /** UI 主题 */
  theme?: UITheme
  /** 应用完成回调 */
  onApplyComplete?: (success: boolean, error?: string) => void
  /** 退出回调 */
  onExit?: () => void
}

type AppState = 'search' | 'detail' | 'apply'

export function SearchApp({
  initialQuery = '',
  searchOptions = {},
  theme = {
    primary: '#0066cc',
    selectedBg: '#0066cc',
    selectedFg: '#ffffff',
    error: '#cc0000',
    success: '#00cc00',
    warning: '#cc6600',
    secondary: '#666666'
  },
  onApplyComplete,
  onExit
}: SearchAppProps) {
  const { exit } = useApp()
  const [appState, setAppState] = useState<AppState>('search')
  const [selectedTemplate, setSelectedTemplate] = useState<IndexedTemplate | null>(null)
  const [showFullContent, setShowFullContent] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [currentApplyStep, setCurrentApplyStep] = useState<InputStep>('path')
  const [applyConfirmFn, setApplyConfirmFn] = useState<(() => void) | null>(null)

  // Search hook
  const {
    searchState,
    search,
    clearSearch,
    setFilters,
    navigateUp,
    navigateDown,
    selectResult,
    isSearching,
    hasResults
  } = useSearch({
    onError: (error) => {
      console.error('Search error:', error)
    }
  })

  // Clipboard hook
  const { copyTemplate, copyText } = useClipboard({
    onSuccess: (message) => {
      // Could show a toast notification here
      console.log(message)
    },
    onError: (error) => {
      console.error('Clipboard error:', error)
    }
  })

  // Apply service
  const [applyService] = useState(() => new ApplyService())

  // 回到搜索状态的函数
  const backToSearch = useCallback(() => {
    setAppState('search')
    setSelectedTemplate(null)
    setShowFullContent(false)
  }, [])

  // 切换全内容显示的函数
  const toggleFullContent = useCallback(() => {
    setShowFullContent(prev => !prev)
  }, [])

  // Initialize filters first
  useEffect(() => {
    if (searchOptions.type || searchOptions.labels || searchOptions.repo) {
      setFilters({
        type: searchOptions.type,
        labels: searchOptions.labels || [],
        repo: searchOptions.repo
      })
    }
  }, [searchOptions.type, searchOptions.labels, searchOptions.repo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize search after a brief delay to allow filters to be set
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialQuery) {
        search(initialQuery)
      } else {
        // 如果没有初始查询，显示所有模板
        search('')
      }
    }, 10) // 很短的延迟确保过滤器先设置
    
    return () => clearTimeout(timer)
  }, [initialQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectCurrent = useCallback(() => {
    if (searchState.results.length === 0) return
    const selected = searchState.results[searchState.selectedIndex]
    if (selected) {
      setSelectedTemplate(selected.template)
      setAppState('detail')
    }
  }, [searchState.results, searchState.selectedIndex])

  // Apply template
  const handleApplyTemplate = useCallback(async (path: string, mode: ApplyMode) => {
    if (!selectedTemplate) return

    setIsApplying(true)
    setApplyError(null)

    try {
      const applyOptions = {
        [selectedTemplate.type]: selectedTemplate.id,
        dest: path,
        mode,
        repo: selectedTemplate.repoName
      }

      const result = await applyService.applyTemplate(applyOptions)

      // ApplyService returns void for success, throws for errors
      onApplyComplete?.(true)
      setAppState('search')
      setSelectedTemplate(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setApplyError(errorMessage)
      onApplyComplete?.(false, errorMessage)
    } finally {
      setIsApplying(false)
    }
  }, [selectedTemplate, applyService, onApplyComplete])

  // Keyboard input handling
  useInput((input: string, key: any) => {
    const normalizedKey = normalizeKeyEvent(input, key)
    
    // 全局快捷键处理
    const actionKey = getActionKey(normalizedKey)
    
    if (actionKey === 'quit') {
      onExit?.()
      exit()
      return
    }

    if (normalizedKey.isSpecial && normalizedKey.specialKey === 'escape' || key.escape) {
      if (appState === 'detail') {
        backToSearch()
      } else if (appState === 'apply') {
        setAppState('detail')
        setIsApplying(false)
        setApplyError(null)
      } else {
        onExit?.()
        exit()
      }
      return
    }

    // 状态特定的快捷键处理
    switch (appState) {
      case 'search':
        // 导航处理
        const navDirection = isNavigationKey(normalizedKey)
        if (navDirection === 'up') {
          navigateUp()
        } else if (navDirection === 'down') {
          navigateDown()
        } else if (normalizedKey.isSpecial && normalizedKey.specialKey === 'enter') {
          selectCurrent()
        } else if (actionKey === 'detail' && hasResults) {
          selectCurrent()
        } else if (actionKey === 'copy' && hasResults) {
          const current = searchState.results[searchState.selectedIndex]
          if (current) {
            copyTemplate(current.template as any)
          }
        } else if (actionKey === 'apply' && hasResults) {
          const current = searchState.results[searchState.selectedIndex]
          if (current) {
            setSelectedTemplate(current.template)
            setAppState('apply')
          }
        } else if (actionKey === 'clear') {
          clearSearch()
        }
        break

      case 'detail':
        // 详情页使用简化的单字母快捷键
        if (input === 'f') {
          toggleFullContent()
        } else if (input === 'y' && selectedTemplate) {
          copyTemplate(selectedTemplate)
        } else if (input === 'a' && selectedTemplate) {
          setAppState('apply')
        }
        break

      case 'apply':
        if (normalizedKey.isSpecial && normalizedKey.specialKey === 'enter' && currentApplyStep === 'confirm' && applyConfirmFn) {
          // 在确认步骤按下 enter，触发确认
          applyConfirmFn()
        }
        break
    }
  })

  const renderContent = () => {
    switch (appState) {
      case 'search':
        return (
          <Box flexDirection="column">
            <SearchInput
              value={searchState.query}
              onChange={search}
              isSearching={isSearching}
              resultCount={searchState.results.length}
              theme={theme}
            />
            
            {hasResults && (
              <ResultsList
                results={searchState.results}
                selectedIndex={searchState.selectedIndex}
                showScore={false}
                theme={theme}
                highlightQuery={searchState.query}
                searchTime={searchState.stats.searchTime}
              />
            )}
            
            {searchState.error && (
              <Box marginTop={1}>
                <Text color={theme.error}>Error: {searchState.error}</Text>
              </Box>
            )}
          </Box>
        )

      case 'detail':
        return selectedTemplate ? (
          <DetailView
            template={selectedTemplate}
            theme={theme}
            showFullContent={showFullContent}
          />
        ) : null

      case 'apply':
        return selectedTemplate ? (
          <Box flexDirection="column">
            <ApplyConfirm
              template={selectedTemplate}
              onConfirm={handleApplyTemplate}
              onCancel={() => setAppState('detail')}
              theme={theme}
              isApplying={isApplying}
              onStepChange={setCurrentApplyStep}
              onExposeConfirm={setApplyConfirmFn}
            />
            
            {applyError && (
              <Box marginTop={1}>
                <Text color={theme.error}>Apply Error: {applyError}</Text>
              </Box>
            )}
          </Box>
        ) : null

      default:
        return null
    }
  }

  return (
    <Box flexDirection="column" padding={1}>


      {/* Main content */}
      {renderContent()}

      {/* Footer help */}
      <Box marginTop={1} borderStyle="single" borderColor={theme.secondary} padding={1}>
        <Text color={theme.secondary} dimColor>
          {appState === 'search' && 'Ctrl+C: Exit | ↑/↓ or Ctrl+J/K: Navigate | Enter: Select | Ctrl+D: Details | Ctrl+A: Apply | Ctrl+Y: Copy | Ctrl+U: Clear'}
          {appState === 'detail' && 'Esc: Back | f: Toggle full content | a: Apply | y: Copy | Ctrl+C: Exit'}
          {appState === 'apply' && 'Enter: Continue | Esc: Cancel | Ctrl+C: Exit'}
        </Text>
      </Box>
    </Box>
  )
}

export default SearchApp
