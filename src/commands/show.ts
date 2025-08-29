/**
 * Show 命令 - 显示模板内容
 * 根据规格文档第144-173行实现
 */

import { Args, Flags } from '@oclif/core'
import { BaseCommand } from './base'
import { configService } from '../core/config.service'
import { templateService } from '../core/template.service'
import { searchService } from '../core/search.service'
import { logger } from '../infra/logger'
import { t } from '../i18n'
import { renderTable, renderKeyValue } from '../presentation/table'
import { Template, PromptTemplate, ContextTemplate } from '../types/template'

export default class Show extends BaseCommand {
  static override description = '显示模板内容'

  static override examples = [
    '<%= config.bin %> <%= command.id %> cursor-default',
    '<%= config.bin %> <%= command.id %> cursor-default --repo templates',
    '<%= config.bin %> <%= command.id %> cursor-default --output content',
    '<%= config.bin %> <%= command.id %> cursor-default --output targets',
    '<%= config.bin %> <%= command.id %> cursor-default --output name'
  ]

  static override args = {
    id: Args.string({
      description: '模板 ID',
      required: true
    })
  }

  static override flags = {
    repo: Flags.string({
      description: '在多仓场景下显式指定模板来源仓库的别名',
      helpValue: 'templates'
    }),
    output: Flags.string({
      description: '输出指定路径的属性值',
      char: 'o',
      helpValue: 'content|targets|name|labels|summary'
    }),
    global: Flags.boolean({
      description: '强制使用并操作全局配置',
      default: false
    })
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Show)
    
    try {
      // 获取配置
      const resolvedConfig = await configService.resolveConfig({ 
        forceGlobal: flags.global 
      })
      
      let repos = resolvedConfig.config.repos
      
      // 过滤仓库
      if (flags.repo) {
        repos = repos.filter(r => r.name === flags.repo)
        if (repos.length === 0) {
          logger.error(t('repo.remove.notfound', { alias: flags.repo }))
          this.exit(1)
        }
      }
      
      if (repos.length === 0) {
        logger.error(t('search.stats.no_repos'))
        this.exit(1)
      }
      
      // 查找模板
      const templates = await this.findTemplates(args.id, repos)
      
      if (templates.length === 0) {
        logger.error(t('show.notfound', { id: args.id }))
        logger.info(t('search.suggest.check'))
        this.exit(1)
      }
      
      // 处理重复ID的情况
      let selectedTemplate: Template
      if (templates.length > 1) {
        selectedTemplate = await this.selectTemplate(templates, args.id)
      } else {
        selectedTemplate = templates[0]
      }
      
      // 显示模板内容
      this.displayTemplate(selectedTemplate, flags.output)
      
    } catch (error: any) {
      logger.error(t('apply.failed', { error: error.message }), error)
      this.exit(1)
    }
  }
  
  /**
   * 查找匹配的模板
   */
  private async findTemplates(id: string, repos: any[]): Promise<Template[]> {
    const templates: Template[] = []
    
    for (const repo of repos) {
      try {
        const template = await templateService.loadTemplate(id, {
          repoName: repo.name
        })
        templates.push(template)
      } catch (error) {
        // 模板不存在，继续查找其他仓库
        continue
      }
    }
    
    return templates
  }
  
  /**
   * 选择模板（处理重复ID）
   */
  private async selectTemplate(templates: Template[], id: string): Promise<Template> {
    logger.info(t('show.duplicate.title', { id }))
    logger.plain('')
    
    // 显示选择列表
    const tableData = templates.map((template, index) => ({
      index: (index + 1).toString(),
      type: template.type === 'prompt' ? '📝 Prompt' : '📦 Context',
      name: template.name,
      summary: template.summary || '(无描述)',
      repo: (template as any).repoName || 'unknown'
    }))
    
    const table = renderTable(tableData, [
      { header: '序号', key: 'index', width: 4 },
      { header: '类型', key: 'type', width: 10 },
      { header: '名称', key: 'name', width: 25 },
      { header: '描述', key: 'summary', width: 30 },
      { header: '仓库', key: 'repo', width: 12 }
    ])
    
    logger.plain(table)
    logger.plain('')
    
    // 简化选择逻辑：默认选择第一个
    // 在实际实现中可以添加交互式选择
    logger.info(`选择了第1个模板: ${templates[0].name}`)
    return templates[0]
  }
  
  /**
   * 显示模板内容
   */
  private displayTemplate(template: Template, outputPath?: string): void {
    if (outputPath) {
      this.displayAttribute(template, outputPath)
    } else {
      this.displayFullTemplate(template)
    }
  }
  
  /**
   * 显示指定属性
   */
  private displayAttribute(template: Template, path: string): void {
    const value = this.getAttributeValue(template, path)
    
    if (value === undefined) {
      logger.error(t('show.attr.notfound', { path }))
      this.exit(1)
    }
    
    if (typeof value === 'string') {
      logger.plain(value)
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string') {
          logger.plain(item)
        } else {
          logger.plain(JSON.stringify(item, null, 2))
        }
      })
    } else {
      logger.plain(JSON.stringify(value, null, 2))
    }
  }
  
  /**
   * 显示完整模板
   */
  private displayFullTemplate(template: Template): void {
    // 显示基本信息
    const basicInfo = {
      'ID': template.id,
      '类型': template.type === 'prompt' ? 'Prompt' : 'Context',
      '名称': template.name,
      '标签': template.labels.length > 0 ? template.labels.join(', ') : '(无标签)',
      '描述': template.summary || '(无描述)'
    }
    
    logger.plain(renderKeyValue(basicInfo))
    logger.plain('')
    
    // 根据类型显示不同内容
    if (template.type === 'prompt') {
      this.displayPromptContent(template as PromptTemplate)
    } else {
      this.displayContextContent(template as ContextTemplate)
    }
    
    // 显示使用提示
    logger.plain('')
    logger.info(t('show.usage.title'))
    logger.plain(`  ${t('show.usage.apply', { type: template.type, id: template.id })}`)
  }
  
  /**
   * 显示 Prompt 模板内容
   */
  private displayPromptContent(template: PromptTemplate): void {
    logger.info('内容:')
    logger.plain('─'.repeat(50))
    logger.plain(template.content)
    logger.plain('─'.repeat(50))
  }
  
  /**
   * 显示 Context 模板内容
   */
  private displayContextContent(template: ContextTemplate): void {
    logger.info(`目标文件 (${template.targets.length} 个):`)
    logger.plain('')
    
    template.targets.forEach((target, index) => {
      logger.plain(`📄 目标 ${index + 1}: ${target.path}`)
      
      const details = {
        '模式': target.mode,
        '内容来源': target.content_from_prompt 
          ? `引用 Prompt: ${target.content_from_prompt}` 
          : '直接内容',
        '内容顺序': target.content_order || 'content-first'
      }
      
      logger.plain(renderKeyValue(details, { indent: 2 }))
      
      if (target.content) {
        logger.plain('  内容预览:')
        const preview = target.content.length > 200 
          ? target.content.substring(0, 200) + '...'
          : target.content
        logger.plain(`  ${preview.replace(/\n/g, '\n  ')}`)
      }
      
      logger.plain('')
    })
  }
  
  /**
   * 获取属性值
   */
  private getAttributeValue(template: Template, path: string): any {
    const parts = path.split('.')
    let value: any = template
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        return undefined
      }
    }
    
    return value
  }
}
