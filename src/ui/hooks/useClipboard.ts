import { useState, useCallback, useEffect } from 'react'
import { ClipboardManager } from '@/infra/clipboard'
import { Template, IndexedTemplate } from '@/types/template'

interface UseClipboardOptions {
  onSuccess?: (message: string) => void
  onError?: (error: Error) => void
}

interface UseClipboardReturn {
  isAvailable: boolean
  isLoading: boolean
  lastError: Error | null
  copyText: (text: string) => Promise<boolean>
  copyTemplate: (template: IndexedTemplate) => Promise<boolean>
  copySearchSummary: (results: any[]) => Promise<boolean>
  readText: () => Promise<string | null>
  clear: () => Promise<boolean>
}

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { onSuccess, onError } = options
  
  const [clipboardManager] = useState(() => new ClipboardManager())
  const [isLoading, setIsLoading] = useState(false)
  const [lastError, setLastError] = useState<Error | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  
  const handleSuccess = useCallback((message: string) => {
    setLastError(null)
    onSuccess?.(message)
  }, [onSuccess])
  
  const handleError = useCallback((error: Error) => {
    setLastError(error)
    onError?.(error)
  }, [onError])
  
  // Check clipboard availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      const available = await clipboardManager.isAvailable()
      setIsAvailable(available)
    }
    checkAvailability()
  }, [clipboardManager])
  
  const copyText = useCallback(async (text: string): Promise<boolean> => {
    if (!isAvailable) {
      const error = new Error('Clipboard is not available')
      handleError(error)
      return false
    }
    
    setIsLoading(true)
    try {
      await clipboardManager.copyText(text)
      handleSuccess('Text copied to clipboard')
      return true
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to copy text')
      handleError(err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, clipboardManager, handleSuccess, handleError])
  
  const copyTemplate = useCallback(async (template: IndexedTemplate): Promise<boolean> => {
    if (!isAvailable) {
      const error = new Error('Clipboard is not available')
      handleError(error)
      return false
    }
    
    setIsLoading(true)
    try {
      await clipboardManager.copyTemplateContent(template)
      handleSuccess(`Template "${template.name}" copied to clipboard`)
      return true
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to copy template')
      handleError(err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, clipboardManager, handleSuccess, handleError])
  
  const copySearchSummary = useCallback(async (results: any[]): Promise<boolean> => {
    if (!isAvailable) {
      const error = new Error('Clipboard is not available')
      handleError(error)
      return false
    }
    
    setIsLoading(true)
    try {
      const result = await clipboardManager.copySearchSummary(results)
      if (result.success) {
        handleSuccess(`Search summary (${results.length} results) copied to clipboard`)
        return true
      } else {
        const err = new Error(result.error || 'Failed to copy search summary')
        handleError(err)
        return false
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to copy search summary')
      handleError(err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, clipboardManager, handleSuccess, handleError])
  
  const readText = useCallback(async (): Promise<string | null> => {
    if (!isAvailable) {
      const error = new Error('Clipboard is not available')
      handleError(error)
      return null
    }
    
    setIsLoading(true)
    try {
      const result = await clipboardManager.readText()
      setLastError(null)
      return result.success ? (result.content || null) : null
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to read clipboard')
      handleError(err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, clipboardManager, handleError])
  
  const clear = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) {
      const error = new Error('Clipboard is not available')
      handleError(error)
      return false
    }
    
    setIsLoading(true)
    try {
      await clipboardManager.clear()
      handleSuccess('Clipboard cleared')
      return true
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to clear clipboard')
      handleError(err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, clipboardManager, handleSuccess, handleError])
  
  return {
    isAvailable,
    isLoading,
    lastError,
    copyText,
    copyTemplate,
    copySearchSummary,
    readText,
    clear
  }
}
