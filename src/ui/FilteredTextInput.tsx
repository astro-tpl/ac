import React, { useState, useEffect } from 'react'
import { Text, useInput } from 'ink'
import { normalizeKeyEvent, isControlChar } from './utils/keyboardMapping'

interface FilteredTextInputProps {
  /** 输入值 */
  value: string
  /** 值变化回调 */
  onChange: (value: string) => void
  /** 占位符 */
  placeholder?: string
  /** 是否聚焦 */
  focus?: boolean
  /** 是否显示光标 */
  showCursor?: boolean
}

/**
 * 过滤快捷键的文本输入组件
 * 防止 Ctrl+J/K 等导航快捷键被当作正常输入
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

  useInput((input, key) => {
    if (!focus) return

    const normalizedKey = normalizeKeyEvent(input, key)

    // 让父组件处理所有 Ctrl 组合键
    if (normalizedKey.isCtrl) {
      return // 让父组件处理这些键
    }

    // 让父组件处理导航键和功能键，但不包括编辑相关的键
    if (normalizedKey.isSpecial) {
      const editingKeys = ['backspace', 'delete', 'left', 'right']
      if (!editingKeys.includes(normalizedKey.specialKey || '')) {
        return // 让父组件处理非编辑键
      }
    }

    // 过滤掉控制字符（包括 Ctrl+J 产生的 \n）
    if (isControlChar(input)) {
      return // 忽略所有控制字符
    }

    // 处理退格键和删除键
    if (key.backspace || key.delete) {
      if (cursorOffset > 0) {
        const newValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset)
        onChange(newValue)
        setCursorOffset(cursorOffset - 1)
      }
      return
    }

    // 处理左右箭头键（仅移动光标）
    if (key.leftArrow) {
      setCursorOffset(Math.max(0, cursorOffset - 1))
      return
    }

    if (key.rightArrow) {
      setCursorOffset(Math.min(value.length, cursorOffset + 1))
      return
    }

    // 处理正常字符输入（包括中文多字符输入）
    if (input && input.length > 0 && !isControlChar(input)) {
      // 检查是否包含可打印字符
      const hasValidChars = Array.from(input).some(char => char.charCodeAt(0) >= 32)
      if (hasValidChars) {
        const newValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset)
        onChange(newValue)
        setCursorOffset(cursorOffset + input.length)
      }
    }
  }, { isActive: focus })

  // 构建显示文本
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
