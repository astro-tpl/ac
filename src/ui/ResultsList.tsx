import React from 'react'
import { Box, Text } from 'ink'
import { SearchResult } from '@/types/template'
import { UITheme } from '@/types/ui'

interface ResultsListProps {
  /** 搜索结果 */
  results: SearchResult[]
  /** 当前选中的索引 */
  selectedIndex: number
  /** 是否显示评分 */
  showScore?: boolean
  /** 最大显示结果数 */
  maxDisplay?: number
  /** UI 主题 */
  theme?: UITheme
  /** 高亮查询关键词 */
  highlightQuery?: string
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

export function ResultsList({
  results,
  selectedIndex,
  showScore = false,
  maxDisplay = 10,
  theme = DEFAULT_THEME,
  highlightQuery = ''
}: ResultsListProps) {
  if (results.length === 0) {
    return (
      <Box marginTop={1}>
        <Text color={theme.secondary}>No results to display</Text>
      </Box>
    )
  }

  const displayResults = results.slice(0, maxDisplay)
  const hasMore = results.length > maxDisplay

  const highlightText = (text: string, query: string) => {
    if (!query) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return <Text key={index} backgroundColor={theme.warning} color="black">{part}</Text>
      }
      return part
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'context':
        return '[context]'
      case 'prompt':
        return '[prompt]'
      default:
        return '[unknown]'
    }
  }

  const formatLabels = (labels: string[]) => {
    if (labels.length === 0) return ''
    return `[${labels.join(', ')}]`
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary}>
          Results ({results.length}{hasMore ? `, showing ${maxDisplay}` : ''}):
        </Text>
      </Box>
      
      {displayResults.map((result, index) => {
        const isSelected = index === selectedIndex
        const template = result.template
        
        return (
          <Box key={`${template.repoName}-${template.id}`} paddingX={1}>
            {/* Single line: type, id, name, summary, labels */}
            <Text 
              color={isSelected ? theme.selectedFg : theme.primary}
              backgroundColor={isSelected ? theme.selectedBg : undefined}
            >
              {getTypeIcon(template.type)} {template.id} {template.name}
              {template.summary && ` - ${template.summary}`}
              {template.labels && template.labels.length > 0 && ` ${formatLabels(template.labels)}`}
              {showScore && ` [${result.score.toFixed(2)}]`}
              {` from ${template.repoName}`}
            </Text>
          </Box>
        )
      })}
      
      {hasMore && (
        <Box marginTop={1}>
          <Text color={theme.secondary} dimColor>
            ... and {results.length - maxDisplay} more results
          </Text>
        </Box>
      )}
      

    </Box>
  )
}

export default ResultsList
