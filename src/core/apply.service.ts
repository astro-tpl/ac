import { t } from '../i18n'
/**
 * Apply Service - Template interpolation, content assembly, file writing
 */

import { join, dirname, isAbsolute } from 'node:path'
import { configService } from './config.service'
import { templateService } from './template.service'
import { atomicWriteFile, readFile, fileExists, isDirectory, isFile } from '../infra/fs'
import { mergeJsonFile, previewJsonMerge, isJsonFile } from '../infra/json-merge'
import { normalizePath } from '../config/paths'
import { 
  Template, 
  PromptTemplate, 
  ContextTemplate, 
  TargetConfig 
} from '../types/template'
import { 
  ApplyResult, 
  DryRunResult 
} from '../types/commands'
import { 
  TemplateNotFoundError,
  FileOperationError,
  MergeNotSupportedError 
} from '../types/errors'
import { logger } from '../infra/logger'

/**
 * Apply options
 */
export interface ApplyOptions {
  /** Context template ID */
  context?: string
  /** Prompt template ID */
  prompt?: string
  /** Local file content */
  content?: string
  /** Read from standard input */
  stdin?: boolean
  /** Target directory or file */
  dest?: string
  /** Filename (when dest is a directory) */
  filename?: string
  /** Write mode */
  mode?: 'write' | 'append' | 'merge'
  /** Repository alias */
  repo?: string
  /** Force use global configuration */
  forceGlobal?: boolean
  /** Preview mode */
  dryRun?: boolean
}

/**
 * Apply Service Class
 */
export class ApplyService {
  /**
   * Apply template to project files
   */
  async applyTemplate(options: ApplyOptions): Promise<DryRunResult | void> {
    // Validate input parameters
    this.validateOptions(options)
    
    // Parse configuration
    const resolvedConfig = await configService.resolveConfig({ 
      forceGlobal: options.forceGlobal 
    })
    
    // Determine content source and apply logic
    if (options.context) {
      return this.applyContextTemplate(options, resolvedConfig)
    } else {
      return this.applyDirectContent(options, resolvedConfig)
    }
  }
  
  /**
   * Apply Context template
   */
  private async applyContextTemplate(
    options: ApplyOptions, 
    resolvedConfig: any
  ): Promise<DryRunResult | void> {
    // Load Context template
    const template = await templateService.loadTemplate(options.context!, {
      repoName: options.repo,
      forceGlobal: options.forceGlobal
    })
    
    if (template.type !== 'context') {
      throw new TemplateNotFoundError(t('apply.error.not_context_template', { id: options.context || '' }))
    }
    
    const contextTemplate = template as ContextTemplate
    const results: ApplyResult[] = []
    
    // Process each target
    for (const target of contextTemplate.targets) {
      const result = await this.processTarget(
        target,
        template,
        options,
        resolvedConfig
      )
      results.push(result)
    }
    
    if (options.dryRun) {
      return {
        results,
        totalFiles: results.length
      }
    } else {
      // Actually write files
      await this.writeTargets(results, contextTemplate)
    }
  }
  
  /**
   * Apply direct content (Prompt/Content/Stdin)
   */
  private async applyDirectContent(
    options: ApplyOptions,
    resolvedConfig: any
  ): Promise<DryRunResult | void> {
    let content = ''
    let contentSource = ''
    
    // Determine content source
    if (options.prompt) {
      const template = await templateService.loadTemplate(options.prompt, {
        repoName: options.repo,
        forceGlobal: options.forceGlobal
      })
      
      if (template.type !== 'prompt') {
        throw new TemplateNotFoundError(t('apply.error.not_prompt_template', { id: options.prompt }))
      }
      
      content = (template as PromptTemplate).content
      contentSource = `prompt:${options.prompt}`
    } else if (options.content) {
      content = await readFile(options.content)
      contentSource = `file:${options.content}`
    } else if (options.stdin) {
      content = await this.readFromStdin()
      contentSource = 'stdin'
    }
    
    // Determine target path
    const targetPath = this.resolveTargetPath(
      options.dest || '.',
      options.filename
    )
    
    // Create apply result
    const result: ApplyResult = {
      targetPath,
      mode: options.mode || 'write',
      isNewFile: !await fileExists(targetPath),
      contentSummary: this.createContentSummary(content, contentSource),
      content // Store actual content
    }
    
    if (options.dryRun) {
      return {
        results: [result],
        totalFiles: 1
      }
    } else {
      // Actually write files
      await this.writeContent(result.targetPath, result.content, result.mode)
      logger.success(t('common.done'))
    }
  }
  
  /**
   * Process single target
   */
  private async processTarget(
    target: TargetConfig,
    template: Template,
    options: ApplyOptions,
    resolvedConfig: any
  ): Promise<ApplyResult> {
    // Interpolate path
    const targetPath = this.interpolatePath(target.path, template, resolvedConfig)
    const absolutePath = this.resolveTargetPath(
      options.dest ? join(options.dest, targetPath) : targetPath
    )
    
    // Assemble content
    const content = await this.assembleTargetContent(target, template, options)
    
    // Determine write mode
    const mode = target.mode || options.mode || 'write'
    
    // Create result
    const result: ApplyResult = {
      targetPath: absolutePath,
      mode,
      isNewFile: !await fileExists(absolutePath),
      contentSummary: this.createContentSummary(content, `context:${template.id}`),
      content // Store actual content
    }
    
    // If merge mode, analyze JSON differences
    if (mode === 'merge' && isJsonFile(absolutePath)) {
      try {
        const preview = await previewJsonMerge(absolutePath, content)
        if (preview.canMerge && preview.diff) {
          result.jsonKeyDiff = {
            added: preview.diff.added,
            modified: preview.diff.modified
          }
        }
      } catch (error: any) {
        logger.debug(t('apply.failed', { error: error.message }))
      }
    }
    
    return result
  }
  
  /**
   * Assemble target content
   */
  private async assembleTargetContent(
    target: TargetConfig,
    template: Template,
    options: ApplyOptions
  ): Promise<string> {
    let content = ''
    let promptContent = ''
    
    // Get direct content
    if (target.content) {
      content = this.interpolateContent(target.content, template)
    }
    
    // Get Prompt reference content
    if (target.content_from_prompt) {
      const promptTemplate = await templateService.loadTemplate(
        target.content_from_prompt,
        {
          repoName: options.repo,
          forceGlobal: options.forceGlobal
        }
      )
      
      if (promptTemplate.type !== 'prompt') {
        throw new TemplateNotFoundError(
          t('apply.error.referenced_not_prompt_template', { id: target.content_from_prompt })
        )
      }
      
      promptContent = (promptTemplate as PromptTemplate).content
    }
    
    // Assemble content in order
    if (content && promptContent) {
      const order = target.content_order || 'content-first'
      return order === 'content-first' 
        ? content + '\n\n' + promptContent
        : promptContent + '\n\n' + content
    } else {
      return content || promptContent
    }
  }
  
  /**
   * Interpolate path
   */
  private interpolatePath(path: string, template: Template, resolvedConfig: any): string {
    // Get template source repository
    const repo = resolvedConfig.config.repos.find((r: any) => 
      // Need to determine through template's source repository, temporarily use first repository
      true
    )
    
    const repoId = repo?.name || 'unknown'
    
    return path.replace(/\${repo\.id}/g, repoId)
  }
  
  /**
   * Interpolate content
   */
  private interpolateContent(content: string, template: Template): string {
    // More interpolation variables can be extended here
    return content.replace(/\${repo\.id}/g, 'unknown') // Simplified implementation
  }
  
  /**
   * Parse target path
   */
  private resolveTargetPath(dest: string, filename?: string): string {
    const destPath = normalizePath(dest)
    
    if (filename) {
      // dest is directory, filename is file name
      return join(destPath, filename)
    } else if (dest.includes('.') || isAbsolute(dest)) {
      // dest looks like file path
      return destPath
    } else {
      // dest is directory, needs filename
      throw new FileOperationError(t('apply.merge.unsupported'))
    }
  }
  
  /**
   * Write all target files
   */
  private async writeTargets(results: ApplyResult[], template: ContextTemplate): Promise<void> {
    let successCount = 0
    
    for (const result of results) {
      try {
        // Use stored actual content
        await this.writeContent(result.targetPath, result.content, result.mode)
        successCount++
        
        logger.success(t('common.done'))
      } catch (error: any) {
        logger.error(t('error.file.write_failed', { path: `${result.targetPath}: ${error.message}` }))
      }
    }
    
    logger.success(t('apply.success'))
  }
  
  /**
   * Write content to file
   */
  private async writeContent(
    filePath: string,
    content: string,
    mode: 'write' | 'append' | 'merge'
  ): Promise<void> {
    // Ensure directory exists
    const dir = dirname(filePath)
    const { ensureDir } = await import('../infra/fs')
    await ensureDir(dir)
    
    switch (mode) {
      case 'write':
        await atomicWriteFile(filePath, content)
        break
        
      case 'append':
        let existingContent = ''
        if (await fileExists(filePath)) {
          existingContent = await readFile(filePath)
        }
        await atomicWriteFile(filePath, existingContent + '\n' + content)
        break
        
      case 'merge':
        if (!isJsonFile(filePath)) {
          throw new MergeNotSupportedError(
            t('apply.error.file_not_json_for_merge', { file: filePath })
          )
        }
        await mergeJsonFile(filePath, content)
        break
        
      default:
        throw new FileOperationError(t('apply.error.unsupported_write_mode', { mode }))
    }
  }
  
  /**
   * Read content from standard input
   */
  private async readFromStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      let content = ''
      
      process.stdin.setEncoding('utf8')
      
      process.stdin.on('data', (chunk) => {
        content += chunk
      })
      
      process.stdin.on('end', () => {
        resolve(content.trim())
      })
      
      process.stdin.on('error', (error) => {
        reject(new FileOperationError(t('error.file.read_failed', { path: 'stdin' })))
      })
    })
  }
  
  /**
   * Create content summary
   */
  private createContentSummary(content: string, source: string): string {
    const lines = content.split('\n').length
    const chars = content.length
    return `${lines} lines, ${chars} chars (source: ${source})`
  }
  
  /**
   * Validate options
   */
  private validateOptions(options: ApplyOptions): void {
    // Check content source
    const sources = [options.context, options.prompt, options.content, options.stdin]
      .filter(Boolean).length
    
    if (sources === 0) {
      throw new FileOperationError(t('error.command.not_found'))
    }
    
    if (sources > 1) {
      throw new FileOperationError(t('error.command.not_found'))
    }
    
    // Check target path
    if (!options.dest && !options.context) {
      throw new FileOperationError(t('error.file.not_found', { path: '--dest' }))
    }
  }
}

// Global apply service instance
export const applyService = new ApplyService()
