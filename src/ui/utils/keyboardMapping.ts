/**
 * Keyboard mapping utility - Handle control character mapping issues in terminal
 * 
 * In terminal, certain Ctrl key combinations are mapped to specific control characters:
 * - Ctrl+J = LF (line feed, \n, character code 10)
 * - Ctrl+K = VT (vertical tab, \v, character code 11) 
 * - Ctrl+C = ETX (interrupt, character code 3)
 * - Ctrl+D = EOT (end of transmission, character code 4)
 * - etc...
 */

// Control character to Ctrl key combination mapping
const CONTROL_CHAR_MAP: Record<number, string> = {
  1: 'a',   // Ctrl+A = SOH
  2: 'b',   // Ctrl+B = STX
  3: 'c',   // Ctrl+C = ETX (interrupt)
  4: 'd',   // Ctrl+D = EOT
  5: 'e',   // Ctrl+E = ENQ
  6: 'f',   // Ctrl+F = ACK
  7: 'g',   // Ctrl+G = BEL
  8: 'h',   // Ctrl+H = BS (backspace)
  9: 'i',   // Ctrl+I = TAB
  10: 'j',  // Ctrl+J = LF (line feed)
  11: 'k',  // Ctrl+K = VT
  12: 'l',  // Ctrl+L = FF
  13: 'm',  // Ctrl+M = CR (carriage return)
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
 * Detect if input is a control character (Ctrl combination key)
 */
export function isControlChar(input: string): boolean {
  if (!input || input.length !== 1) return false
  const charCode = input.charCodeAt(0)
  return charCode >= 1 && charCode <= 26
}

/**
 * Convert control character to corresponding letter
 */
export function getControlCharLetter(input: string): string | null {
  if (!isControlChar(input)) return null
  const charCode = input.charCodeAt(0)
  return CONTROL_CHAR_MAP[charCode] || null
}

/**
 * Detect and normalize keyboard input
 * Return normalized keyboard event information
 */
export interface NormalizedKeyEvent {
  /** Raw input character */
  input: string
  /** Whether it's a Ctrl combination key */
  isCtrl: boolean
  /** Corresponding letter (if it's a Ctrl combination key) */
  letter?: string
  /** Whether it's a special key */
  isSpecial: boolean
  /** Special key name */
  specialKey?: string
}

export function normalizeKeyEvent(input: string, key: any): NormalizedKeyEvent {
  const result: NormalizedKeyEvent = {
    input,
    isCtrl: false,
    isSpecial: false
  }

  // First check special key flags - these have highest priority
  if (key.upArrow) {
    result.isSpecial = true
    result.specialKey = 'up'
    return result
  } else if (key.downArrow) {
    result.isSpecial = true
    result.specialKey = 'down'
    return result
  } else if (key.leftArrow) {
    result.isSpecial = true
    result.specialKey = 'left'
    return result
  } else if (key.rightArrow) {
    result.isSpecial = true
    result.specialKey = 'right'
    return result
  } else if (key.return) {
    result.isSpecial = true
    result.specialKey = 'enter'
    return result
  } else if (key.escape) {
    result.isSpecial = true
    result.specialKey = 'escape'
    return result
  } else if (key.tab) {
    result.isSpecial = true
    result.specialKey = 'tab'
    return result
  } else if (key.backspace) {
    result.isSpecial = true
    result.specialKey = 'backspace'
    return result
  } else if (key.delete) {
    result.isSpecial = true
    result.specialKey = 'delete'
    return result
  }

  // Then check ctrl flag in key object
  if (key.ctrl && input && input.length === 1) {
    result.isCtrl = true
    result.letter = input.toLowerCase()
    return result
  }

  // Finally check if it's a control character
  if (isControlChar(input)) {
    result.isCtrl = true
    result.letter = getControlCharLetter(input) || undefined
    return result
  }

  return result
}

/**
 * Check if it's a navigation key
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
 * Check if it's an action key
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
