import { useEffect, useCallback, useState } from 'react'
import { useInput } from 'ink'
import { KeyBindings, DEFAULT_KEY_BINDINGS } from '@/types/ui'

export type KeyboardAction = 
  | 'up'
  | 'down'
  | 'select'
  | 'back'
  | 'quit'
  | 'apply'
  | 'copy'
  | 'toggle_detail'
  | 'clear_search'
  | 'help'

interface UseKeyboardOptions {
  keyBindings?: Partial<KeyBindings>
  onAction?: (action: KeyboardAction, key: string) => void
  disabled?: boolean
}

interface UseKeyboardReturn {
  lastAction: KeyboardAction | null
  lastKey: string | null
  clearLastAction: () => void
}

export function useKeyboard(options: UseKeyboardOptions = {}): UseKeyboardReturn {
  const { keyBindings: userBindings = {}, onAction, disabled = false } = options
  
  // Merge user bindings with defaults
  const keyBindings = { ...DEFAULT_KEY_BINDINGS, ...userBindings }
  
  const [lastAction, setLastAction] = useState<KeyboardAction | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null)
  
  const clearLastAction = useCallback(() => {
    setLastAction(null)
    setLastKey(null)
  }, [])
  
  const handleKeyPress = useCallback((input: string, key: any) => {
    if (disabled) return
    
    let action: KeyboardAction | null = null
    
    // Handle special keys
    if (key.upArrow) {
      action = 'up'
    } else if (key.downArrow) {
      action = 'down'
    } else if (key.return) {
      action = 'select'
    } else if (key.escape) {
      action = 'back'
    } else if (key.ctrl && input === 'c') {
      action = 'quit'
    } else if (key.ctrl) {
      // Handle Ctrl + character combinations
      const inputLower = input.toLowerCase()
      
      if (inputLower === 'j') {
        action = 'down'
      } else if (inputLower === 'k') {
        action = 'up'
      } else if (inputLower === 'a') {
        action = 'apply'
      } else if (inputLower === 'y') {
        action = 'copy'
      } else if (inputLower === 'd') {
        action = 'toggle_detail'
      } else if (inputLower === 'u') {
        action = 'clear_search'
      } else if (inputLower === 'h') {
        action = 'help'
      } else if (inputLower === 'q') {
        action = 'quit'
      } else if (inputLower === 'b') {
        action = 'back'
      }
    }
    
    if (action) {
      setLastAction(action)
      setLastKey(input)
      onAction?.(action, input)
    }
  }, [disabled, keyBindings, onAction])
  
  useInput(handleKeyPress, { isActive: !disabled })
  
  return {
    lastAction,
    lastKey,
    clearLastAction
  }
}

// Helper hook for navigation-specific keyboard handling
export function useNavigationKeyboard(options: {
  onUp?: () => void
  onDown?: () => void
  onSelect?: () => void
  onBack?: () => void
  onQuit?: () => void
  disabled?: boolean
}) {
  const { onUp, onDown, onSelect, onBack, onQuit, disabled } = options
  
  return useKeyboard({
    onAction: (action) => {
      switch (action) {
        case 'up':
          onUp?.()
          break
        case 'down':
          onDown?.()
          break
        case 'select':
          onSelect?.()
          break
        case 'back':
          onBack?.()
          break
        case 'quit':
          onQuit?.()
          break
      }
    },
    disabled
  })
}

// Helper hook for search-specific keyboard handling
export function useSearchKeyboard(options: {
  onApply?: () => void
  onCopy?: () => void
  onToggleDetail?: () => void
  onClearSearch?: () => void
  onHelp?: () => void
  onQuit?: () => void
  disabled?: boolean
}) {
  const { onApply, onCopy, onToggleDetail, onClearSearch, onHelp, onQuit, disabled } = options
  
  return useKeyboard({
    onAction: (action) => {
      switch (action) {
        case 'apply':
          onApply?.()
          break
        case 'copy':
          onCopy?.()
          break
        case 'toggle_detail':
          onToggleDetail?.()
          break
        case 'clear_search':
          onClearSearch?.()
          break
        case 'help':
          onHelp?.()
          break
        case 'quit':
          onQuit?.()
          break
      }
    },
    disabled
  })
}
