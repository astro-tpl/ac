/**
 * 键盘映射工具 - 处理终端中的控制字符映射问题
 * 
 * 在终端中，某些 Ctrl 组合键会被映射为特定的控制字符：
 * - Ctrl+J = LF (换行符, \n, 字符码10)
 * - Ctrl+K = VT (垂直制表符, \v, 字符码11) 
 * - Ctrl+C = ETX (中断, 字符码3)
 * - Ctrl+D = EOT (文件结束, 字符码4)
 * - 等等...
 */

// 控制字符到 Ctrl 组合键的映射
const CONTROL_CHAR_MAP: Record<number, string> = {
  1: 'a',   // Ctrl+A = SOH
  2: 'b',   // Ctrl+B = STX
  3: 'c',   // Ctrl+C = ETX (中断)
  4: 'd',   // Ctrl+D = EOT
  5: 'e',   // Ctrl+E = ENQ
  6: 'f',   // Ctrl+F = ACK
  7: 'g',   // Ctrl+G = BEL
  8: 'h',   // Ctrl+H = BS (退格)
  9: 'i',   // Ctrl+I = TAB
  10: 'j',  // Ctrl+J = LF (换行)
  11: 'k',  // Ctrl+K = VT
  12: 'l',  // Ctrl+L = FF
  13: 'm',  // Ctrl+M = CR (回车)
  14: 'n',  // Ctrl+N = SO
  15: 'o',  // Ctrl+O = SI
  16: 'p',  // Ctrl+P = DLE
  17: 'q',  // Ctrl+Q = DC1
  18: 'r',  // Ctrl+R = DC2
  19: 's',  // Ctrl+S = DC3
  20: 't',  // Ctrl+T = DC4
  21: 'u',  // Ctrl+U = NAK
  22: 'v',  // Ctrl+V = SYN
  23: 'w',  // Ctrl+W = ETB
  24: 'x',  // Ctrl+X = CAN
  25: 'y',  // Ctrl+Y = EM
  26: 'z',  // Ctrl+Z = SUB
}

/**
 * 检测输入是否为控制字符（Ctrl 组合键）
 */
export function isControlChar(input: string): boolean {
  if (!input || input.length !== 1) return false
  const charCode = input.charCodeAt(0)
  return charCode >= 1 && charCode <= 26
}

/**
 * 将控制字符转换为对应的字母
 */
export function getControlCharLetter(input: string): string | null {
  if (!isControlChar(input)) return null
  const charCode = input.charCodeAt(0)
  return CONTROL_CHAR_MAP[charCode] || null
}

/**
 * 检测并标准化键盘输入
 * 返回标准化的键盘事件信息
 */
export interface NormalizedKeyEvent {
  /** 原始输入字符 */
  input: string
  /** 是否为 Ctrl 组合键 */
  isCtrl: boolean
  /** 对应的字母（如果是 Ctrl 组合键） */
  letter?: string
  /** 是否为特殊键 */
  isSpecial: boolean
  /** 特殊键名称 */
  specialKey?: string
}

export function normalizeKeyEvent(input: string, key: any): NormalizedKeyEvent {
  const result: NormalizedKeyEvent = {
    input,
    isCtrl: false,
    isSpecial: false
  }

  // 检查是否为控制字符
  if (isControlChar(input)) {
    result.isCtrl = true
    result.letter = getControlCharLetter(input) || undefined
    return result
  }

  // 检查 key 对象中的 ctrl 标志
  if (key.ctrl && input && input.length === 1) {
    result.isCtrl = true
    result.letter = input.toLowerCase()
    return result
  }

  // 检查特殊键
  if (key.upArrow) {
    result.isSpecial = true
    result.specialKey = 'up'
  } else if (key.downArrow) {
    result.isSpecial = true
    result.specialKey = 'down'
  } else if (key.leftArrow) {
    result.isSpecial = true
    result.specialKey = 'left'
  } else if (key.rightArrow) {
    result.isSpecial = true
    result.specialKey = 'right'
  } else if (key.return) {
    result.isSpecial = true
    result.specialKey = 'enter'
  } else if (key.escape) {
    result.isSpecial = true
    result.specialKey = 'escape'
  } else if (key.tab) {
    result.isSpecial = true
    result.specialKey = 'tab'
  } else if (key.backspace) {
    result.isSpecial = true
    result.specialKey = 'backspace'
  } else if (key.delete) {
    result.isSpecial = true
    result.specialKey = 'delete'
  }

  return result
}

/**
 * 检查是否为导航键
 */
export function isNavigationKey(normalizedEvent: NormalizedKeyEvent): 'up' | 'down' | null {
  if (normalizedEvent.isSpecial) {
    if (normalizedEvent.specialKey === 'up') return 'up'
    if (normalizedEvent.specialKey === 'down') return 'down'
  }
  
  if (normalizedEvent.isCtrl) {
    if (normalizedEvent.letter === 'k') return 'up'
    if (normalizedEvent.letter === 'j') return 'down'
  }
  
  return null
}

/**
 * 检查是否为动作键
 */
export function getActionKey(normalizedEvent: NormalizedKeyEvent): string | null {
  if (normalizedEvent.isSpecial) {
    if (normalizedEvent.specialKey === 'enter') return 'select'
    if (normalizedEvent.specialKey === 'escape') return 'back'
  }
  
  if (normalizedEvent.isCtrl) {
    switch (normalizedEvent.letter) {
      case 'c': return 'quit'
      case 'd': return 'detail'
      case 'a': return 'apply'
      case 'y': return 'copy'
      case 'u': return 'clear'
      case 'h': return 'help'
      default: return null
    }
  }
  
  return null
}
