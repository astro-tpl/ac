import {DEFAULT_KEY_BINDINGS, KeyBindings} from '@/types/ui'
import {useInput} from 'ink'
import {useCallback, useEffect, useState} from 'react'

export type KeyboardAction =
  | 'apply'
  | 'back'
  | 'clear_search'
  | 'copy'
  | 'down'
  | 'help'
  | 'quit'
  | 'select'
  | 'toggle_detail'
  | 'up'

interface UseKeyboardOptions {
  disabled?: boolean
  keyBindings?: Partial<KeyBindings>
  onAction?: (action: KeyboardAction, key: string) => void
}

interface UseKeyboardReturn {
  clearLastAction: () => void
  lastAction: KeyboardAction | null
  lastKey: null | string
}

export function useKeyboard(options: UseKeyboardOptions = {}): UseKeyboardReturn {
  const {disabled = false, keyBindings: userBindings = {}, onAction} = options

  // Merge user bindings with defaults
  const keyBindings = {...DEFAULT_KEY_BINDINGS, ...userBindings}

  const [lastAction, setLastAction] = useState<KeyboardAction | null>(null)
  const [lastKey, setLastKey] = useState<null | string>(null)

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

      switch (inputLower) {
      case 'j': {
        action = 'down'

        break
      }

      case 'k': {
        action = 'up'

        break
      }

      case 'a': {
        action = 'apply'

        break
      }

      case 'y': {
        action = 'copy'

        break
      }

      case 'd': {
        action = 'toggle_detail'

        break
      }

      case 'u': {
        action = 'clear_search'

        break
      }

      case 'h': {
        action = 'help'

        break
      }

      case 'q': {
        action = 'quit'

        break
      }

      case 'b': {
        action = 'back'

        break
      }
      // No default
      }
    }

    if (action) {
      setLastAction(action)
      setLastKey(input)
      onAction?.(action, input)
    }
  }, [disabled, keyBindings, onAction])

  useInput(handleKeyPress, {isActive: !disabled})

  return {
    clearLastAction,
    lastAction,
    lastKey,
  }
}

// Helper hook for navigation-specific keyboard handling
export function useNavigationKeyboard(options: {
  disabled?: boolean
  onBack?: () => void
  onDown?: () => void
  onQuit?: () => void
  onSelect?: () => void
  onUp?: () => void
}) {
  const {disabled, onBack, onDown, onQuit, onSelect, onUp} = options

  return useKeyboard({
    disabled,
    onAction(action) {
      switch (action) {
      case 'up': {
        onUp?.()
        break
      }

      case 'down': {
        onDown?.()
        break
      }

      case 'select': {
        onSelect?.()
        break
      }

      case 'back': {
        onBack?.()
        break
      }

      case 'quit': {
        onQuit?.()
        break
      }
      }
    },
  })
}

// Helper hook for search-specific keyboard handling
export function useSearchKeyboard(options: {
  disabled?: boolean
  onApply?: () => void
  onClearSearch?: () => void
  onCopy?: () => void
  onHelp?: () => void
  onQuit?: () => void
  onToggleDetail?: () => void
}) {
  const {disabled, onApply, onClearSearch, onCopy, onHelp, onQuit, onToggleDetail} = options

  return useKeyboard({
    disabled,
    onAction(action) {
      switch (action) {
      case 'apply': {
        onApply?.()
        break
      }

      case 'copy': {
        onCopy?.()
        break
      }

      case 'toggle_detail': {
        onToggleDetail?.()
        break
      }

      case 'clear_search': {
        onClearSearch?.()
        break
      }

      case 'help': {
        onHelp?.()
        break
      }

      case 'quit': {
        onQuit?.()
        break
      }
      }
    },
  })
}
