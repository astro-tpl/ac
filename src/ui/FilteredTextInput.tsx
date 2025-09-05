import React, { useState, useEffect, useCallback } from 'react'
import { Text, useInput } from 'ink'
import { normalizeKeyEvent, isControlChar } from './utils/keyboardMapping'

interface FilteredTextInputProps {
  /** Input value */
  value: string
  /** Value change callback */
  onChange: (value: string) => void
  /** Placeholder */
  placeholder?: string
  /** Whether to focus */
  focus?: boolean
  /** Whether to show cursor */
  showCursor?: boolean
}

/**
 * Filtered text input component
 * Prevents Ctrl+J/K and other navigation shortcuts from being treated as normal input
 */
export function FilteredTextInput({
  value,
  onChange,
  placeholder = '',
  focus = true,
  showCursor = true
}: FilteredTextInputProps) {
  const [cursorOffset, setCursorOffset] = useState(value.length)

  useEffect(() => {
    setCursorOffset(value.length)
  }, [value])

  // Delete one word before cursor (similar to terminal Ctrl+W)
  const deleteWordBackward = useCallback(() => {
    if (cursorOffset === 0) return

    let newOffset = cursorOffset
    
    // Standard terminal Ctrl+W behavior:
    // 1. Delete forward until whitespace character or beginning
    while (newOffset > 0 && !/\s/.test(value[newOffset - 1])) {
      newOffset--
    }
    
    // 2. Continue deleting preceding whitespace characters
    while (newOffset > 0 && /\s/.test(value[newOffset - 1])) {
      newOffset--
    }
    
    const newValue = value.slice(0, newOffset) + value.slice(cursorOffset)
    onChange(newValue)
    setCursorOffset(newOffset)
  }, [value, cursorOffset, onChange])

  useInput((input, key) => {
    if (!focus) return

    const normalizedKey = normalizeKeyEvent(input, key)

    // Handle Ctrl+W word deletion
    if (normalizedKey.isCtrl && normalizedKey.letter === 'w') {
      deleteWordBackward()
      return
    }

    // Let parent component handle other Ctrl key combinations
    if (normalizedKey.isCtrl) {
      return // Let parent component handle these keys
    }

    // Let parent component handle navigation and function keys, but not editing keys
    if (normalizedKey.isSpecial) {
      const editingKeys = ['backspace', 'delete', 'left', 'right']
      if (!editingKeys.includes(normalizedKey.specialKey || '')) {
        return // Let parent component handle non-editing keys
      }
    }

    // Filter out control characters (including \n from Ctrl+J)
    if (isControlChar(input)) {
      return // Ignore all control characters
    }

    // Handle backspace and delete keys
    if (key.backspace || key.delete) {
      if (cursorOffset > 0) {
        const newValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset)
        onChange(newValue)
        setCursorOffset(cursorOffset - 1)
      }
      return
    }

    // Handle left and right arrow keys (only move cursor)
    if (key.leftArrow) {
      setCursorOffset(Math.max(0, cursorOffset - 1))
      return
    }

    if (key.rightArrow) {
      setCursorOffset(Math.min(value.length, cursorOffset + 1))
      return
    }

    // Handle normal character input (including multi-byte Chinese input)
    if (input && input.length > 0 && !isControlChar(input)) {
      // Check if contains printable characters
      const hasValidChars = Array.from(input).some(char => char.charCodeAt(0) >= 32)
      if (hasValidChars) {
        const newValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset)
        onChange(newValue)
        setCursorOffset(cursorOffset + input.length)
      }
    }
  }, { isActive: focus })

  // Build display text
  const displayValue = value || placeholder
  const cursor = showCursor && focus ? '█' : ''
  
  let displayText = displayValue
  if (showCursor && focus) {
    if (value) {
      displayText = value.slice(0, cursorOffset) + cursor + value.slice(cursorOffset)
    } else {
      displayText = cursor
    }
  }

  return <Text>{displayText}</Text>
}

export default FilteredTextInput
