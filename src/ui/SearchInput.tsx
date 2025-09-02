import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { FilteredTextInput } from './FilteredTextInput'
import { UITheme } from '@/types/ui'

interface SearchInputProps {
  /** 搜索查询 */
  value: string
  /** 搜索查询变化回调 */
  onChange: (value: string) => void
  /** 占位符文本 */
  placeholder?: string
  /** 是否正在搜索 */
  isSearching?: boolean
  /** 搜索结果数量 */
  resultCount?: number
  /** 是否聚焦 */
  focus?: boolean
  /** UI 主题 */
  theme?: UITheme
}

const DEFAULT_THEME = {
  primary: '#0066cc',
  selectedBg: '#0066cc',
  selectedFg: '#ffffff',
  error: '#cc0000',
  success: '#00cc00',
  warning: '#cc6600',
  secondary: '#666666'
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search templates...',
  isSearching = false,
  resultCount = 0,
  focus = true,
  theme = DEFAULT_THEME
}: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(focus)

  useEffect(() => {
    setIsFocused(focus)
  }, [focus])

  const getStatusText = () => {
    // if (isSearching) {
    //   return <Text color={theme.warning}>Searching...</Text>
    // }
    
    // if (value && resultCount === 0) {
    //   return <Text color={theme.error}>No results found</Text>
    // }
    
    // if (value && resultCount > 0) {
    //   return (
    //     <Text color={theme.success}>
    //       {resultCount} result{resultCount === 1 ? '' : 's'} found
    //     </Text>
    //   )
    // }
    
    return null
  }

  const getPromptSymbol = () => {
    return <Text color={theme.primary}>🔍 </Text>
  }

  return (
    <Box flexDirection="column">
      {/* Search input line */}
      <Box>
        {getPromptSymbol()}
        <FilteredTextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          focus={isFocused}
          showCursor={isFocused}
        />
      </Box>
      
      {/* Status line */}
      {getStatusText() && (
        <Box marginTop={1}>
          {getStatusText()}
        </Box>
      )}
      

    </Box>
  )
}

export default SearchInput
