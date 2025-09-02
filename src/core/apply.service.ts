import { t } from '../i18n'
/**
 * 应用服务 - 模板插值、内容组装、文件写入
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
 * 应用选项
 */
export interface ApplyOptions {
  /** Context 模板 ID */
  context?: string
  /** Prompt 模板 ID */
  prompt?: string
  /** 本地文件内容 */
  content?: string
  /** 从标准输入读取 */
  stdin?: boolean
  /** 目标目录或文件 */
  dest?: string
  /** 文件名（当 dest 为目录时） */
  filename?: string
  /** 写入模式 */
  mode?: 'write' | 'append' | 'merge'
  /** 仓库别名 */
  repo?: string
  /** 强制使用全局配置 */
  forceGlobal?: boolean
  /** 预览模式 */
  dryRun?: boolean
}

/**
 * 应用服务类
 */
export class ApplyService {
  /**
   * 应用模板到项目文件
   */
  async applyTemplate(options: ApplyOptions): Promise<DryRunResult | void> {
    // 验证输入参数
    this.validateOptions(options)
    
    // 解析配置
    const resolvedConfig = await configService.resolveConfig({ 
      forceGlobal: options.forceGlobal 
    })
    
    // 确定内容来源和应用逻辑
    if (options.context) {
      return this.applyContextTemplate(options, resolvedConfig)
    } else {
      return this.applyDirectContent(options, resolvedConfig)
    }
  }
  
  /**
   * 应用 Context 模板
   */
  private async applyContextTemplate(
    options: ApplyOptions, 
    resolvedConfig: any
  ): Promise<DryRunResult | void> {
    // 加载 Context 模板
    const template = await templateService.loadTemplate(options.context!, {
      repoName: options.repo,
      forceGlobal: options.forceGlobal
    })
    
    if (template.type !== 'context') {
      throw new TemplateNotFoundError(`模板 ${options.context} 不是 Context 类型`)
    }
    
    const contextTemplate = template as ContextTemplate
    const results: ApplyResult[] = []
    
    // 处理每个目标
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
      // 实际写入文件
      await this.writeTargets(results, contextTemplate)
    }
  }
  
  /**
   * 应用直接内容（Prompt/Content/Stdin）
   */
  private async applyDirectContent(
    options: ApplyOptions,
    resolvedConfig: any
  ): Promise<DryRunResult | void> {
    let content = ''
    let contentSource = ''
    
    // 确定内容来源
    if (options.prompt) {
      const template = await templateService.loadTemplate(options.prompt, {
        repoName: options.repo,
        forceGlobal: options.forceGlobal
      })
      
      if (template.type !== 'prompt') {
        throw new TemplateNotFoundError(`模板 ${options.prompt} 不是 Prompt 类型`)
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
    
    // 确定目标路径
    const targetPath = this.resolveTargetPath(
      options.dest || '.',
      options.filename
    )
    
    // 创建应用结果
    const result: ApplyResult = {
      targetPath,
      mode: options.mode || 'write',
      isNewFile: !await fileExists(targetPath),
      contentSummary: this.createContentSummary(content, contentSource)
    }
    
    if (options.dryRun) {
      return {
        results: [result],
        totalFiles: 1
      }
    } else {
      // 实际写入文件
      await this.writeContent(targetPath, content, result.mode)
      logger.success(t('common.done'))
    }
  }
  
  /**
   * 处理单个目标
   */
  private async processTarget(
    target: TargetConfig,
    template: Template,
    options: ApplyOptions,
    resolvedConfig: any
  ): Promise<ApplyResult> {
    // 插值处理路径
    const targetPath = this.interpolatePath(target.path, template, resolvedConfig)
    const absolutePath = this.resolveTargetPath(
      options.dest ? join(options.dest, targetPath) : targetPath
    )
    
    // 组装内容
    const content = await this.assembleTargetContent(target, template, options)
    
    // 确定写入模式
    const mode = target.mode || options.mode || 'write'
    
    // 创建结果
    const result: ApplyResult = {
      targetPath: absolutePath,
      mode,
      isNewFile: !await fileExists(absolutePath),
      contentSummary: this.createContentSummary(content, `context:${template.id}`)
    }
    
    // 如果是 merge 模式，分析 JSON 差异
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
   * 组装目标内容
   */
  private async assembleTargetContent(
    target: TargetConfig,
    template: Template,
    options: ApplyOptions
  ): Promise<string> {
    let content = ''
    let promptContent = ''
    
    // 获取直接内容
    if (target.content) {
      content = this.interpolateContent(target.content, template)
    }
    
    // 获取 Prompt 引用内容
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
          `引用的模板 ${target.content_from_prompt} 不是 Prompt 类型`
        )
      }
      
      promptContent = (promptTemplate as PromptTemplate).content
    }
    
    // 按顺序组装内容
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
   * 插值处理路径
   */
  private interpolatePath(path: string, template: Template, resolvedConfig: any): string {
    // 获取模板来源仓库
    const repo = resolvedConfig.config.repos.find((r: any) => 
      // 这里需要通过模板的来源仓库来确定，暂时使用第一个仓库
      true
    )
    
    const repoId = repo?.name || 'unknown'
    
    return path.replace(/\${repo\.id}/g, repoId)
  }
  
  /**
   * 插值处理内容
   */
  private interpolateContent(content: string, template: Template): string {
    // 这里可以扩展更多插值变量
    return content.replace(/\${repo\.id}/g, 'unknown') // 简化实现
  }
  
  /**
   * 解析目标路径
   */
  private resolveTargetPath(dest: string, filename?: string): string {
    const destPath = normalizePath(dest)
    
    if (filename) {
      // dest 是目录，filename 是文件名
      return join(destPath, filename)
    } else if (dest.includes('.') || isAbsolute(dest)) {
      // dest 看起来像文件路径
      return destPath
    } else {
      // dest 是目录，需要 filename
      throw new FileOperationError(t('apply.merge.unsupported'))
    }
  }
  
  /**
   * 写入所有目标文件
   */
  private async writeTargets(results: ApplyResult[], template: ContextTemplate): Promise<void> {
    let successCount = 0
    
    for (const result of results) {
      try {
        // 这里需要获取实际内容，简化实现
        const content = `# Generated by template: ${template.id}`
        
        await this.writeContent(result.targetPath, content, result.mode)
        successCount++
        
        logger.success(t('common.done'))
      } catch (error: any) {
        logger.error(t('error.file.write_failed', { path: `${result.targetPath}: ${error.message}` }))
      }
    }
    
    logger.success(t('apply.success'))
  }
  
  /**
   * 写入内容到文件
   */
  private async writeContent(
    filePath: string,
    content: string,
    mode: 'write' | 'append' | 'merge'
  ): Promise<void> {
    // 确保目录存在
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
            `文件 ${filePath} 不是 JSON 格式，无法使用 merge 模式`
          )
        }
        await mergeJsonFile(filePath, content)
        break
        
      default:
        throw new FileOperationError(`不支持的写入模式: ${mode}`)
    }
  }
  
  /**
   * 从标准输入读取内容
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
   * 创建内容摘要
   */
  private createContentSummary(content: string, source: string): string {
    const lines = content.split('\n').length
    const chars = content.length
    return `${lines} lines, ${chars} chars (source: ${source})`
  }
  
  /**
   * 验证选项
   */
  private validateOptions(options: ApplyOptions): void {
    // 检查内容来源
    const sources = [options.context, options.prompt, options.content, options.stdin]
      .filter(Boolean).length
    
    if (sources === 0) {
      throw new FileOperationError(t('error.command.not_found'))
    }
    
    if (sources > 1) {
      throw new FileOperationError(t('error.command.not_found'))
    }
    
    // 检查目标路径
    if (!options.dest && !options.context) {
      throw new FileOperationError(t('error.file.not_found', { path: '--dest' }))
    }
  }
}

// 全局应用服务实例
export const applyService = new ApplyService()
