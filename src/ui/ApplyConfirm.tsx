import React, { useState } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { IndexedTemplate } from '@/types/template'
import { UITheme, ApplyMode } from '@/types/ui'

interface ApplyConfirmProps {
  /** 要应用的模板 */
  template: IndexedTemplate
  /** 默认目标路径 */
  defaultPath?: string
  /** 默认应用模式 */
  defaultMode?: ApplyMode
  /** 确认回调 */
  onConfirm: (path: string, mode: ApplyMode) => void
  /** 取消回调 */
  onCancel: () => void
  /** UI 主题 */
  theme?: UITheme
  /** 是否正在应用 */
  isApplying?: boolean
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

type InputStep = 'path' | 'mode' | 'confirm'

export function ApplyConfirm({
  template,
  defaultPath = './',
  defaultMode = 'write',
  onConfirm,
  onCancel,
  theme = DEFAULT_THEME,
  isApplying = false
}: ApplyConfirmProps) {
  const [currentStep, setCurrentStep] = useState<InputStep>('path')
  const [targetPath, setTargetPath] = useState(defaultPath)
  const [applyMode, setApplyMode] = useState<ApplyMode>(defaultMode)
  const [modeInput, setModeInput] = useState('')

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'context':
        return '📄'
      case 'prompt':
        return '💬'
      default:
        return '📝'
    }
  }

  const getModeDescription = (mode: ApplyMode) => {
    switch (mode) {
      case 'write':
        return 'Overwrite existing files'
      case 'append':
        return 'Append to existing files'
      case 'merge':
        return 'Merge with existing content'
      default:
        return 'Unknown mode'
    }
  }

  const handlePathSubmit = () => {
    if (!targetPath.trim()) {
      return
    }
    setCurrentStep('mode')
  }

  const handleModeSubmit = () => {
    const mode = modeInput.toLowerCase() as ApplyMode
    if (['write', 'append', 'merge'].includes(mode)) {
      setApplyMode(mode)
      setCurrentStep('confirm')
    }
  }

  const handleConfirm = () => {
    onConfirm(targetPath, applyMode)
  }

  if (isApplying) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.warning}>
        <Box marginBottom={1}>
          <Text color={theme.warning}>⏳ Applying template...</Text>
        </Box>
        <Box>
          <Text color={theme.secondary}>Please wait while the template is being applied.</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.primary}>
      {/* Header */}
      <Box marginBottom={2}>
        <Text color={theme.primary} bold>
          {getTypeIcon(template.type)} Apply Template: {template.name}
        </Text>
      </Box>

      {/* Template info */}
      <Box flexDirection="column" marginBottom={2}>
        <Box>
          <Text color={theme.secondary}>Type: </Text>
          <Text color={theme.success}>{template.type}</Text>
        </Box>
        <Box>
          <Text color={theme.secondary}>Repository: </Text>
          <Text color={theme.warning}>{template.repoName}</Text>
        </Box>
        {template.summary && (
          <Box>
            <Text color={theme.secondary}>Summary: </Text>
            <Text>{template.summary}</Text>
          </Box>
        )}
      </Box>

      {/* Step 1: Target path */}
      {currentStep === 'path' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.primary}>Step 1: Target Path</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color={theme.secondary}>Enter the target directory or file path:</Text>
          </Box>
          <Box>
            <Text color={theme.primary}>📁 </Text>
            <TextInput
              value={targetPath}
              onChange={setTargetPath}
              onSubmit={handlePathSubmit}
              placeholder="./output"
              focus={true}
            />
          </Box>

        </Box>
      )}

      {/* Step 2: Apply mode */}
      {currentStep === 'mode' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.primary}>Step 2: Apply Mode</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color={theme.secondary}>Choose how to handle existing files:</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text color={theme.success}>• write - {getModeDescription('write')}</Text>
            <Text color={theme.success}>• append - {getModeDescription('append')}</Text>
            <Text color={theme.success}>• merge - {getModeDescription('merge')}</Text>
          </Box>
          <Box>
            <Text color={theme.primary}>⚙️  </Text>
            <TextInput
              value={modeInput}
              onChange={setModeInput}
              onSubmit={handleModeSubmit}
              placeholder={defaultMode}
              focus={true}
            />
          </Box>
        </Box>
      )}

      {/* Step 3: Confirmation */}
      {currentStep === 'confirm' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.primary}>Step 3: Confirm</Text>
          </Box>
          <Box flexDirection="column" marginBottom={2}>
            <Box>
              <Text color={theme.secondary}>Target: </Text>
              <Text color={theme.warning}>{targetPath}</Text>
            </Box>
            <Box>
              <Text color={theme.secondary}>Mode: </Text>
              <Text color={theme.success}>{applyMode}</Text>
            </Box>
            <Box>
              <Text color={theme.secondary}>Description: </Text>
              <Text>{getModeDescription(applyMode)}</Text>
            </Box>
          </Box>
          
          {template.type === 'context' && (
            <Box marginBottom={2}>
              <Text color={theme.warning}>
                ⚠️  This will modify files according to the template's target configuration.
              </Text>
            </Box>
          )}
          

        </Box>
      )}
    </Box>
  )
}

export default ApplyConfirm
