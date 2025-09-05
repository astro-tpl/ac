/**
 * System clipboard operation wrapper
 * Use clipboardy library to provide cross-platform clipboard support
 */

import clipboardy from 'clipboardy'
import { logger } from './logger'
import { t } from '../i18n'

/**
 * Clipboard operation result
 */
export interface ClipboardResult {
  /** Whether operation succeeded */
  success: boolean
  /** Error message (if failed) */
  error?: string
  /** Length of copied content (if successful) */
  length?: number
}

/**
 * Clipboard operation class
 */
export class ClipboardManager {
  /**
   * Copy text to clipboard
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
   * Read text from clipboard
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
   * Check if clipboard is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to read clipboard content to test availability
      await clipboardy.read()
      return true
    } catch (error) {
      logger.debug('Clipboard not available')
      return false
    }
  }

  /**
   * Clear clipboard
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
   * Copy template content to clipboard
   * Format content based on template type
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
        // For prompt type, read content directly from file
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
        // For context type, read and copy entire file content
        const fs = await import('node:fs/promises')
        const path = await import('node:path')
        
        // Use template's absPath property
        const filePath = template.absPath
        if (filePath) {
          try {
            contentToCopy = await fs.readFile(filePath, 'utf-8')
          } catch (error) {
            // If reading file fails, fallback to template info
            contentToCopy = `# ${template.name}\n\nTemplate ID: ${template.id}\nType: ${template.type}\n\n`
            if (template.targets && template.targets.length > 0) {
              contentToCopy += 'Targets:\n'
              for (const target of template.targets) {
                contentToCopy += `- ${target.path} (${target.mode})\n`
              }
            }
          }
        } else {
          // Fallback logic when no file path available
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
   * Copy search results summary to clipboard
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

// Global clipboard manager instance
export const clipboardManager = new ClipboardManager()

/**
 * Convenience function: copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  return clipboardManager.copyText(text)
}

/**
 * Convenience function: read text from clipboard
 */
export async function readFromClipboard(): Promise<ClipboardResult & { content?: string }> {
  return clipboardManager.readText()
}

/**
 * Convenience function: check if clipboard is available
 */
export async function isClipboardAvailable(): Promise<boolean> {
  return clipboardManager.isAvailable()
}

/**
 * Convenience function: copy template content
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
