import {t} from '../i18n'
/**
 * Apply Service - Template interpolation, content assembly, file writing
 */

import {dirname, isAbsolute, join} from 'node:path'

import {normalizePath} from '../config/paths'
import {
  atomicWriteFile, fileExists, isDirectory, isFile, readFile,
} from '../infra/fs'
import {isJsonFile, mergeJsonFile, previewJsonMerge} from '../infra/json-merge'
import {logger} from '../infra/logger'
import {
  ApplyResult,
  DryRunResult,
} from '../types/commands'
import {
  FileOperationError,
  MergeNotSupportedError,
  TemplateNotFoundError,
} from '../types/errors'
import {
  ContextTemplate,
  PromptTemplate,
  TargetConfig,
  Template,
} from '../types/template'
import {configService} from './config.service'
import {templateService} from './template.service'

/**
 * Apply options
 */
export interface ApplyOptions {
  /** Local file content */
  content?: string
  /** Context template ID */
  context?: string
  /** Target directory or file */
  dest?: string
  /** Preview mode */
  dryRun?: boolean
  /** Filename (when dest is a directory) */
  filename?: string
  /** Force use global configuration */
  forceGlobal?: boolean
  /** Write mode */
  mode?: 'append' | 'merge' | 'write'
  /** Prompt template ID */
  prompt?: string
  /** Repository alias */
  repo?: string
  /** Read from standard input */
  stdin?: boolean
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
      forceGlobal: options.forceGlobal,
    })

    // Determine content source and apply logic
    if (options.context) {
      return this.applyContextTemplate(options, resolvedConfig)
    }

    return this.applyDirectContent(options, resolvedConfig)
  }

  /**
   * Apply Context template
   */
  private async applyContextTemplate(
    options: ApplyOptions,
    resolvedConfig: any,
  ): Promise<DryRunResult | void> {
    // Load Context template
    const template = await templateService.loadTemplate(options.context!, {
      forceGlobal: options.forceGlobal,
      repoName: options.repo,
    })

    if (template.type !== 'context') {
      throw new TemplateNotFoundError(t('apply.error.not_context_template', {id: options.context || ''}))
    }

    const contextTemplate = template as ContextTemplate
    const results: ApplyResult[] = []

    // Process each target
    for (const target of contextTemplate.targets) {
      const result = await this.processTarget(
        target,
        template,
        options,
        resolvedConfig,
      )
      results.push(result)
    }

    if (options.dryRun) {
      return {
        results,
        totalFiles: results.length,
      }
    }

    // Actually write files
    await this.writeTargets(results, contextTemplate)
  }

  /**
   * Apply direct content (Prompt/Content/Stdin)
   */
  private async applyDirectContent(
    options: ApplyOptions,
    resolvedConfig: any,
  ): Promise<DryRunResult | void> {
    let content = ''
    let contentSource = ''

    // Determine content source
    if (options.prompt) {
      const template = await templateService.loadTemplate(options.prompt, {
        forceGlobal: options.forceGlobal,
        repoName: options.repo,
      })

      if (template.type !== 'prompt') {
        throw new TemplateNotFoundError(t('apply.error.not_prompt_template', {id: options.prompt}))
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
      options.filename,
    )

    // Create apply result
    const result: ApplyResult = {
      content, // Store actual content
      contentSummary: this.createContentSummary(content, contentSource),
      isNewFile: !await fileExists(targetPath),
      mode: options.mode || 'write',
      targetPath,
    }

    if (options.dryRun) {
      return {
        results: [result],
        totalFiles: 1,
      }
    }

    // Actually write files
    await this.writeContent(result.targetPath, result.content, result.mode)
    logger.success(t('common.done'))
  }

  /**
   * Assemble target content
   */
  private async assembleTargetContent(
    target: TargetConfig,
    template: Template,
    options: ApplyOptions,
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
          forceGlobal: options.forceGlobal,
          repoName: options.repo,
        },
      )

      if (promptTemplate.type !== 'prompt') {
        throw new TemplateNotFoundError(
          t('apply.error.referenced_not_prompt_template', {id: target.content_from_prompt}),
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
    }

    return content || promptContent
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
   * Interpolate content
   */
  private interpolateContent(content: string, template: Template): string {
    // More interpolation variables can be extended here
    return content.replaceAll('${repo.id}', 'unknown') // Simplified implementation
  }

  /**
   * Interpolate path
   */
  private interpolatePath(path: string, template: Template, resolvedConfig: any): string {
    // Get template source repository
    const repo = resolvedConfig.config.repos.find((r: any) =>
      // Need to determine through template's source repository, temporarily use first repository
      true,
    )

    const repoId = repo?.name || 'unknown'

    return path.replaceAll('${repo.id}', repoId)
  }

  /**
   * Process single target
   */
  private async processTarget(
    target: TargetConfig,
    template: Template,
    options: ApplyOptions,
    resolvedConfig: any,
  ): Promise<ApplyResult> {
    // Interpolate path
    const targetPath = this.interpolatePath(target.path, template, resolvedConfig)
    const absolutePath = this.resolveTargetPath(
      options.dest ? join(options.dest, targetPath) : targetPath,
    )

    // Assemble content
    const content = await this.assembleTargetContent(target, template, options)

    // Determine write mode
    const mode = target.mode || options.mode || 'write'

    // Create result
    const result: ApplyResult = {
      content, // Store actual content
      contentSummary: this.createContentSummary(content, `context:${template.id}`),
      isNewFile: !await fileExists(absolutePath),
      mode,
      targetPath: absolutePath,
    }

    // If merge mode, analyze JSON differences
    if (mode === 'merge' && isJsonFile(absolutePath)) {
      try {
        const preview = await previewJsonMerge(absolutePath, content)
        if (preview.canMerge && preview.diff) {
          result.jsonKeyDiff = {
            added: preview.diff.added,
            modified: preview.diff.modified,
          }
        }
      } catch (error: any) {
        logger.debug(t('apply.failed', {error: error.message}))
      }
    }

    return result
  }

  /**
   * Read content from standard input
   */
  private async readFromStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      let content = ''

      process.stdin.setEncoding('utf8')

      process.stdin.on('data', chunk => {
        content += chunk
      })

      process.stdin.on('end', () => {
        resolve(content.trim())
      })

      process.stdin.on('error', error => {
        reject(new FileOperationError(t('error.file.read_failed', {path: 'stdin'})))
      })
    })
  }

  /**
   * Parse target path
   */
  private resolveTargetPath(dest: string, filename?: string): string {
    const destPath = normalizePath(dest)

    if (filename) {
      // dest is directory, filename is file name
      return join(destPath, filename)
    }

    if (dest.includes('.') || isAbsolute(dest)) {
      // dest looks like file path
      return destPath
    }

    // dest is directory, needs filename
    throw new FileOperationError(t('apply.merge.unsupported'))
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
      throw new FileOperationError(t('error.file.not_found', {path: '--dest'}))
    }
  }

  /**
   * Write content to file
   */
  private async writeContent(
    filePath: string,
    content: string,
    mode: 'append' | 'merge' | 'write',
  ): Promise<void> {
    // Ensure directory exists
    const dir = dirname(filePath)
    const {ensureDir} = await import('../infra/fs')
    await ensureDir(dir)

    switch (mode) {
    case 'write': {
      await atomicWriteFile(filePath, content)
      break
    }

    case 'append': {
      let existingContent = ''
      if (await fileExists(filePath)) {
        existingContent = await readFile(filePath)
      }

      await atomicWriteFile(filePath, existingContent + '\n' + content)
      break
    }

    case 'merge': {
      if (!isJsonFile(filePath)) {
        throw new MergeNotSupportedError(
          t('apply.error.file_not_json_for_merge', {file: filePath}),
        )
      }

      await mergeJsonFile(filePath, content)
      break
    }

    default: {
      throw new FileOperationError(t('apply.error.unsupported_write_mode', {mode}))
    }
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
        logger.error(t('error.file.write_failed', {path: `${result.targetPath}: ${error.message}`}))
      }
    }

    logger.success(t('apply.success'))
  }
}

// Global apply service instance
export const applyService = new ApplyService()
