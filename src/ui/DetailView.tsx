import React, { useState, useEffect } from 'react'
import { Box, Text, Newline } from 'ink'
import { IndexedTemplate } from '@/types/template'
import { UITheme } from '@/types/ui'
import { t } from '@/i18n'

interface DetailViewProps {
  /** Template to display */
  template: IndexedTemplate
  /** UI theme */
  theme?: UITheme
  /** Whether to show full content */
  showFullContent?: boolean
  /** Maximum lines for content preview */
  maxContentLines?: number
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

export function DetailView({
  template,
  theme = DEFAULT_THEME,
  showFullContent = false,
  maxContentLines = 10
}: DetailViewProps) {
  const [templateContent, setTemplateContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Dynamically load template content
  useEffect(() => {
    async function loadContent() {
      if (template.type === 'prompt' && template.absPath) {
        setIsLoading(true)
        try {
          const fs = await import('node:fs/promises')
          const fileContent = await fs.readFile(template.absPath, 'utf-8')
          const { safeParseYaml } = await import('@/infra/yaml')
          const parsedTemplate = safeParseYaml(fileContent)
          setTemplateContent(parsedTemplate?.content || '')
        } catch (error) {
          console.error('Failed to load template content:', error)
          setTemplateContent('')
        } finally {
          setIsLoading(false)
        }
      } else {
        setTemplateContent(null)
      }
    }
    
    loadContent()
  }, [template.absPath, template.type])
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
    if (!labels || labels.length === 0) return 'None'
    return labels.join(', ')
  }

  const formatContent = (content?: string) => {
    if (!content) return 'No content available'
    
    if (showFullContent) {
      return content
    }
    
    const lines = content.split('\n')
    if (lines.length <= maxContentLines) {
      return content
    }
    
    return lines.slice(0, maxContentLines).join('\n') + '\n...'
  }

  const formatTargets = (template: any) => {
    if (template.type !== 'context' || !template.targets) {
      return null
    }
    
    return template.targets.map((target: any, index: number) => (
      <Box key={index} marginLeft={2} marginBottom={1}>
        <Box>
          <Text color={theme.warning}>Target {index + 1}:</Text>
        </Box>
        <Box marginLeft={2}>
          <Text color={theme.secondary}>Path: </Text>
          <Text>{target.path}</Text>
        </Box>
        <Box marginLeft={2}>
          <Text color={theme.secondary}>Mode: </Text>
          <Text color={theme.success}>{target.mode}</Text>
        </Box>
        {target.content && (
          <Box marginLeft={2} flexDirection="column">
            <Text color={theme.secondary}>Content:</Text>
            <Box marginLeft={2} marginTop={1}>
              <Text>{formatContent(target.content)}</Text>
            </Box>
          </Box>
        )}
      </Box>
    ))
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.primary}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>
          {getTypeIcon(template.type)} Template Details
        </Text>
      </Box>
      
      {/* Basic info */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color={theme.secondary}>Name: </Text>
          <Text color={theme.primary} bold>{template.name}</Text>
        </Box>
        
        <Box>
          <Text color={theme.secondary}>ID: </Text>
          <Text>{template.id}</Text>
        </Box>
        
        <Box>
          <Text color={theme.secondary}>Type: </Text>
          <Text color={theme.success}>{template.type}</Text>
        </Box>
        
        <Box>
          <Text color={theme.secondary}>Repository: </Text>
          <Text color={theme.warning}>{template.repoName}</Text>
        </Box>
        
        <Box>
          <Text color={theme.secondary}>Labels: </Text>
          <Text color={theme.success}>{formatLabels(template.labels)}</Text>
        </Box>
      </Box>
      
      {/* Summary */}
      {template.summary && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.secondary}>Summary:</Text>
          <Box marginLeft={2} marginTop={1}>
            <Text>{template.summary}</Text>
          </Box>
        </Box>
      )}
      
      {/* Content for prompt templates */}
      {template.type === 'prompt' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.secondary}>Content:</Text>
          <Box marginLeft={2} marginTop={1} flexDirection="column">
            {isLoading ? (
              <Text color={theme.secondary}>Loading content...</Text>
            ) : templateContent ? (
              <>
                <Text>{formatContent(templateContent)}</Text>
                {!showFullContent && templateContent.split('\n').length > maxContentLines && (
                  <Text color={theme.secondary} dimColor>
                    <Newline />
                    Press 'f' to show full content
                  </Text>
                )}
              </>
            ) : (
              <Text color={theme.secondary}>No content available</Text>
            )}
          </Box>
        </Box>
      )}
      
      {/* Targets for context templates */}
      {template.type === 'context' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.secondary}>Targets:</Text>
          {formatTargets(template)}
        </Box>
      )}
      
      {/* File info */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.secondary} dimColor>File: {template.absPath}</Text>
        {template.lastModified && (
          <Text color={theme.secondary} dimColor>
            Modified: {new Date(template.lastModified).toLocaleString()}
          </Text>
        )}
      </Box>
      

    </Box>
  )
}

export default DetailView
