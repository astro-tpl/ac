/**
 * 表格输出格式化工具
 */

/**
 * 表格列定义
 */
export interface TableColumn {
  /** 列标题 */
  header: string
  /** 列键名 */
  key: string
  /** 列宽度 */
  width?: number
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right'
  /** 格式化函数 */
  formatter?: (value: any) => string
}

/**
 * 表格选项
 */
export interface TableOptions {
  /** 是否显示边框 */
  border?: boolean
  /** 是否显示表头 */
  header?: boolean
  /** 表格样式 */
  style?: 'simple' | 'grid' | 'compact'
  /** 最大列宽 */
  maxColumnWidth?: number
  /** 截断长文本 */
  truncate?: boolean
}

/**
 * 表格渲染器
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
   * 渲染表格
   */
  render(data: any[], columns: TableColumn[]): string {
    if (data.length === 0) {
      return '(无数据)'
    }
    
    // 计算列宽
    const columnWidths = this.calculateColumnWidths(data, columns)
    
    // 生成表格内容
    const lines: string[] = []
    
    // 表头
    if (this.options.header) {
      lines.push(this.renderHeader(columns, columnWidths))
      if (this.options.border) {
        lines.push(this.renderSeparator(columnWidths))
      }
    }
    
    // 数据行
    for (const row of data) {
      lines.push(this.renderRow(row, columns, columnWidths))
    }
    
    // 底部边框
    if (this.options.border && this.options.style === 'grid') {
      lines.push(this.renderSeparator(columnWidths))
    }
    
    return lines.join('\n')
  }
  
  /**
   * 计算列宽
   */
  private calculateColumnWidths(data: any[], columns: TableColumn[]): number[] {
    const widths: number[] = []
    
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]
      let maxWidth = column.width || column.header.length
      
      // 检查数据中的最大宽度
      for (const row of data) {
        const value = this.formatCellValue(row[column.key], column)
        maxWidth = Math.max(maxWidth, this.getDisplayWidth(value))
      }
      
      // 应用最大列宽限制
      if (this.options.maxColumnWidth > 0) {
        maxWidth = Math.min(maxWidth, this.options.maxColumnWidth)
      }
      
      widths.push(maxWidth)
    }
    
    return widths
  }
  
  /**
   * 渲染表头
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
   * 渲染分隔符
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
   * 渲染数据行
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
   * 格式化单元格值
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
   * 截断文本
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
   * 对齐文本
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
   * 获取显示宽度（处理中文字符）
   */
  private getDisplayWidth(text: string): number {
    let width = 0
    for (const char of text) {
      // 中文字符占两个显示位置
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
 * 简单表格渲染（快捷方法）
 */
export function renderTable(data: any[], columns: TableColumn[], options?: TableOptions): string {
  const renderer = new TableRenderer(options)
  return renderer.render(data, columns)
}

/**
 * 渲染简单列表
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
 * 渲染键值对
 */
export function renderKeyValue(data: Record<string, any>, options: {
  separator?: string
  indent?: number
  keyWidth?: number
} = {}): string {
  const { separator = ': ', indent = 0, keyWidth } = options
  
  const entries = Object.entries(data)
  if (entries.length === 0) {
    return '(无数据)'
  }
  
  // 计算键的最大宽度
  const maxKeyWidth = keyWidth || Math.max(...entries.map(([key]) => key.length))
  
  const lines = entries.map(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyWidth)
    const valueStr = Array.isArray(value) ? value.join(', ') : String(value)
    return ' '.repeat(indent) + paddedKey + separator + valueStr
  })
  
  return lines.join('\n')
}

/**
 * 渲染进度条
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
 * 格式化文件大小
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
 * 格式化时间差
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
 * 格式化相对时间
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) {
    return `${diffDays} 天前`
  } else if (diffHours > 0) {
    return `${diffHours} 小时前`
  } else if (diffMinutes > 0) {
    return `${diffMinutes} 分钟前`
  } else {
    return '刚刚'
  }
}
