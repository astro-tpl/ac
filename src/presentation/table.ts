/**
 * Table output formatting utility
 */
import { t } from '../i18n'

/**
 * Table column definition
 */
export interface TableColumn {
  /** Column header */
  header: string
  /** Column key name */
  key: string
  /** Column width */
  width?: number
  /** Alignment */
  align?: 'left' | 'center' | 'right'
  /** Formatter function */
  formatter?: (value: any) => string
}

/**
 * Table options
 */
export interface TableOptions {
  /** Whether to show borders */
  border?: boolean
  /** Whether to show header */
  header?: boolean
  /** Table style */
  style?: 'simple' | 'grid' | 'compact'
  /** Maximum column width */
  maxColumnWidth?: number
  /** Truncate long text */
  truncate?: boolean
}

/**
 * Table renderer
 */
export class TableRenderer {
  private options: Required<TableOptions>
  
  constructor(options: TableOptions = {}) {
    this.options = {
      border: true,
      header: true,
      style: 'simple',
      maxColumnWidth: 50,
      truncate: true,
      ...options
    }
  }
  
  /**
   * Render table
   */
  render(data: any[], columns: TableColumn[]): string {
    if (data.length === 0) {
      return t('table.no_data')
    }
    
    // Calculate column widths
    const columnWidths = this.calculateColumnWidths(data, columns)
    
    // Generate table content
    const lines: string[] = []
    
    // Table header
    if (this.options.header) {
      lines.push(this.renderHeader(columns, columnWidths))
      if (this.options.border) {
        lines.push(this.renderSeparator(columnWidths))
      }
    }
    
    // Data rows
    for (const row of data) {
      lines.push(this.renderRow(row, columns, columnWidths))
    }
    
    // Bottom border
    if (this.options.border && this.options.style === 'grid') {
      lines.push(this.renderSeparator(columnWidths))
    }
    
    return lines.join('\n')
  }
  
  /**
   * Calculate column widths
   */
  private calculateColumnWidths(data: any[], columns: TableColumn[]): number[] {
    const widths: number[] = []
    
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]
      let maxWidth = column.width || column.header.length
      
      // Check maximum width in data
      for (const row of data) {
        const value = this.formatCellValue(row[column.key], column)
        maxWidth = Math.max(maxWidth, this.getDisplayWidth(value))
      }
      
      // Apply maximum column width limit
      if (this.options.maxColumnWidth > 0) {
        maxWidth = Math.min(maxWidth, this.options.maxColumnWidth)
      }
      
      widths.push(maxWidth)
    }
    
    return widths
  }
  
  /**
   * Render table header
   */
  private renderHeader(columns: TableColumn[], widths: number[]): string {
    const cells = columns.map((column, i) => {
      const content = this.truncateText(column.header, widths[i])
      return this.alignText(content, widths[i], column.align || 'left')
    })
    
    switch (this.options.style) {
      case 'grid':
        return `| ${cells.join(' | ')} |`
      case 'compact':
        return cells.join('  ')
      default:
        return cells.join(' | ')
    }
  }
  
  /**
   * Render separator
   */
  private renderSeparator(widths: number[]): string {
    const separators = widths.map(width => '-'.repeat(width))
    
    switch (this.options.style) {
      case 'grid':
        return `|-${separators.join('-|-')}-|`
      default:
        return separators.join('-|-')
    }
  }
  
  /**
   * Render data rows
   */
  private renderRow(row: any, columns: TableColumn[], widths: number[]): string {
    const cells = columns.map((column, i) => {
      const value = this.formatCellValue(row[column.key], column)
      const content = this.truncateText(value, widths[i])
      return this.alignText(content, widths[i], column.align || 'left')
    })
    
    switch (this.options.style) {
      case 'grid':
        return `| ${cells.join(' | ')} |`
      case 'compact':
        return cells.join('  ')
      default:
        return cells.join(' | ')
    }
  }
  
  /**
   * Format cell value
   */
  private formatCellValue(value: any, column: TableColumn): string {
    if (value == null) {
      return ''
    }
    
    if (column.formatter) {
      return column.formatter(value)
    }
    
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    
    return String(value)
  }
  
  /**
   * Truncate text
   */
  private truncateText(text: string, maxWidth: number): string {
    if (!this.options.truncate || text.length <= maxWidth) {
      return text
    }
    
    if (maxWidth <= 3) {
      return '...'.slice(0, maxWidth)
    }
    
    return text.slice(0, maxWidth - 3) + '...'
  }
  
  /**
   * Align text
   */
  private alignText(text: string, width: number, align: 'left' | 'center' | 'right'): string {
    const padding = width - this.getDisplayWidth(text)
    
    if (padding <= 0) {
      return text
    }
    
    switch (align) {
      case 'center': {
        const leftPad = Math.floor(padding / 2)
        const rightPad = padding - leftPad
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad)
      }
      case 'right':
        return ' '.repeat(padding) + text
      default:
        return text + ' '.repeat(padding)
    }
  }
  
  /**
   * Get display width (handle Chinese characters)
   */
  private getDisplayWidth(text: string): number {
    let width = 0
    for (const char of text) {
      // Chinese characters occupy two display positions
      if (char.match(/[\u4e00-\u9fff]/)) {
        width += 2
      } else {
        width += 1
      }
    }
    return width
  }
}

/**
 * Simple table rendering (shortcut method)
 */
export function renderTable(data: any[], columns: TableColumn[], options?: TableOptions): string {
  const renderer = new TableRenderer(options)
  return renderer.render(data, columns)
}

/**
 * Render simple list
 */
export function renderList(items: string[], options: {
  bullet?: string
  indent?: number
} = {}): string {
  const { bullet = '•', indent = 0 } = options
  const prefix = ' '.repeat(indent) + bullet + ' '
  
  return items.map(item => prefix + item).join('\n')
}

/**
 * Render key-value pairs
 */
export function renderKeyValue(data: Record<string, any>, options: {
  separator?: string
  indent?: number
  keyWidth?: number
} = {}): string {
  const { separator = ': ', indent = 0, keyWidth } = options
  
  const entries = Object.entries(data)
  if (entries.length === 0) {
    return t('table.no_data')
  }
  
  // Calculate maximum key width
  const maxKeyWidth = keyWidth || Math.max(...entries.map(([key]) => key.length))
  
  const lines = entries.map(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyWidth)
    const valueStr = Array.isArray(value) ? value.join(', ') : String(value)
    return ' '.repeat(indent) + paddedKey + separator + valueStr
  })
  
  return lines.join('\n')
}

/**
 * Render progress bar
 */
export function renderProgressBar(
  current: number, 
  total: number, 
  options: {
    width?: number
    fillChar?: string
    emptyChar?: string
    showPercentage?: boolean
  } = {}
): string {
  const { 
    width = 20, 
    fillChar = '█', 
    emptyChar = '░',
    showPercentage = true 
  } = options
  
  const percentage = Math.round((current / total) * 100)
  const filledWidth = Math.round((current / total) * width)
  const emptyWidth = width - filledWidth
  
  const bar = fillChar.repeat(filledWidth) + emptyChar.repeat(emptyWidth)
  
  if (showPercentage) {
    return `[${bar}] ${percentage}%`
  }
  
  return `[${bar}]`
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format time difference
 */
export function formatTimeDiff(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }
  
  const seconds = milliseconds / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  
  const minutes = seconds / 60
  if (minutes < 60) {
    return `${minutes.toFixed(1)}m`
  }
  
  const hours = minutes / 60
  return `${hours.toFixed(1)}h`
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) {
    return t('time.days_ago', { count: diffDays })
  } else if (diffHours > 0) {
    return t('time.hours_ago', { count: diffHours })
  } else if (diffMinutes > 0) {
    return t('time.minutes_ago', { count: diffMinutes })
  } else {
    return t('time.just_now')
  }
}
