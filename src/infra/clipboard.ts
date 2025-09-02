/**
 * 系统剪切板操作封装
 * 使用 clipboardy 库提供跨平台剪切板支持
 */

import clipboardy from 'clipboardy'
import { logger } from './logger'
import { t } from '../i18n'

/**
 * 剪切板操作结果
 */
export interface ClipboardResult {
  /** 操作是否成功 */
  success: boolean
  /** 错误信息（如果失败） */
  error?: string
  /** 复制的内容长度（如果成功） */
  length?: number
}

/**
 * 剪切板操作类
 */
export class ClipboardManager {
  /**
   * 复制文本到剪切板
   */
  async copyText(text: string): Promise<ClipboardResult> {
    try {
      if (!text) {
        return {
          success: false,
          error: t('clipboard.empty_content')
        }
      }

      await clipboardy.write(text)
      
      logger.debug(`Copied ${text.length} characters to clipboard`)
      
      return {
        success: true,
        length: text.length
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown clipboard error'
      logger.error(t('clipboard.copy_failed'), error)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 从剪切板读取文本
   */
  async readText(): Promise<ClipboardResult & { content?: string }> {
    try {
      const content = await clipboardy.read()
      
      logger.debug(`Read ${content.length} characters from clipboard`)
      
      return {
        success: true,
        content,
        length: content.length
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown clipboard error'
      logger.error(t('clipboard.read_failed'), error)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 检查剪切板是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 尝试读取剪切板内容来测试可用性
      await clipboardy.read()
      return true
    } catch (error) {
      logger.debug('Clipboard not available')
      return false
    }
  }

  /**
   * 清空剪切板
   */
  async clear(): Promise<ClipboardResult> {
    try {
      await clipboardy.write('')
      
      logger.debug('Clipboard cleared')
      
      return {
        success: true,
        length: 0
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown clipboard error'
      logger.error(t('clipboard.clear_failed'), error)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 复制模板内容到剪切板
   * 根据模板类型格式化内容
   */
  async copyTemplateContent(template: {
    id: string
    type: 'prompt' | 'context'
    name: string
    content?: string
    targets?: any[]
    absPath?: string
  }): Promise<ClipboardResult> {
    try {
      let contentToCopy = ''

      if (template.type === 'prompt') {
        // 对于 prompt 类型，直接从文件读取 content
        if (template.absPath) {
          const fs = await import('node:fs/promises')
          try {
            const fileContent = await fs.readFile(template.absPath, 'utf-8')
            const { safeParseYaml } = await import('./yaml')
            const parsedTemplate = safeParseYaml(fileContent)
            contentToCopy = parsedTemplate?.content || ''
          } catch (error) {
            contentToCopy = ''
          }
        } else {
          contentToCopy = ''
        }
      } else if (template.type === 'context') {
        // 对于 context 类型，读取并复制整个文件内容
        const fs = await import('node:fs/promises')
        const path = await import('node:path')
        
        // 使用模板的 absPath 属性
        const filePath = template.absPath
        if (filePath) {
          try {
            contentToCopy = await fs.readFile(filePath, 'utf-8')
          } catch (error) {
            // 如果读取文件失败，回退到模板信息
            contentToCopy = `# ${template.name}\n\nTemplate ID: ${template.id}\nType: ${template.type}\n\n`
            if (template.targets && template.targets.length > 0) {
              contentToCopy += 'Targets:\n'
              for (const target of template.targets) {
                contentToCopy += `- ${target.path} (${target.mode})\n`
              }
            }
          }
        } else {
          // 没有文件路径时的回退逻辑
          contentToCopy = `# ${template.name}\n\nTemplate ID: ${template.id}\nType: ${template.type}\n\n`
          if (template.targets && template.targets.length > 0) {
            contentToCopy += 'Targets:\n'
            for (const target of template.targets) {
              contentToCopy += `- ${target.path} (${target.mode})\n`
            }
          }
        }
      }

      if (!contentToCopy.trim()) {
        return {
          success: false,
          error: t('clipboard.no_content_to_copy')
        }
      }

      return await this.copyText(contentToCopy)
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error'
      logger.error(t('clipboard.template_copy_failed'), error)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 复制搜索结果摘要到剪切板
   */
  async copySearchSummary(results: Array<{
    template: {
      id: string
      type: string
      name: string
      repoName: string
    }
    score: number
  }>): Promise<ClipboardResult> {
    try {
      if (results.length === 0) {
        return {
          success: false,
          error: t('clipboard.no_results_to_copy')
        }
      }

      let summary = `# Search Results (${results.length} templates)\n\n`
      
      for (const result of results) {
        summary += `## ${result.template.name}\n`
        summary += `- ID: ${result.template.id}\n`
        summary += `- Type: ${result.template.type}\n`
        summary += `- Repository: ${result.template.repoName}\n`
        summary += `- Score: ${result.score.toFixed(2)}\n\n`
      }

      return await this.copyText(summary)
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error'
      logger.error(t('clipboard.summary_copy_failed'), error)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }
}

// 全局剪切板管理器实例
export const clipboardManager = new ClipboardManager()

/**
 * 便捷函数：复制文本到剪切板
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  return clipboardManager.copyText(text)
}

/**
 * 便捷函数：从剪切板读取文本
 */
export async function readFromClipboard(): Promise<ClipboardResult & { content?: string }> {
  return clipboardManager.readText()
}

/**
 * 便捷函数：检查剪切板是否可用
 */
export async function isClipboardAvailable(): Promise<boolean> {
  return clipboardManager.isAvailable()
}

/**
 * 便捷函数：复制模板内容
 */
export async function copyTemplateToClipboard(template: {
  id: string
  type: 'prompt' | 'context'
  name: string
  content?: string
  targets?: any[]
}): Promise<ClipboardResult> {
  return clipboardManager.copyTemplateContent(template)
}
