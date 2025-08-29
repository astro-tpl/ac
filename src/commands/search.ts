/**
 * Search 命令 - 搜索模板
 */

import { Args, Flags } from '@oclif/core'
import { BaseCommand } from './base'
import { searchService } from '../core/search.service'
import { logger } from '../infra/logger'
import { t } from '../i18n'
import { renderTable, formatRelativeTime } from '../presentation/table'
import { startInteractiveSearch, getInteractiveSearchHelp } from '../infra/interactive-search'
import Show from './show'

export default class Search extends BaseCommand {
  static override description = '按关键字/类型/标签搜索模板；必要时可深搜正文'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> react',
    '<%= config.bin %> <%= command.id %> --type context',
    '<%= config.bin %> <%= command.id %> --label frontend',
    '<%= config.bin %> <%= command.id %> react --deep',
    '<%= config.bin %> <%= command.id %> --repo templates'
  ]

  static override args = {
    keyword: Args.string({
      description: '搜索关键字（可为空，仅用过滤器筛选）',
      required: false
    })
  }

  static override flags = {
    type: Flags.string({
      description: '按类型过滤模板',
      options: ['context', 'prompt']
    }),
    label: Flags.string({
      description: '按标签过滤（支持多个，用逗号分隔）',
      multiple: true,
      char: 'l'
    }),
    deep: Flags.boolean({
      description: '触发 ripgrep 对模板正文内容进行深度搜索',
      default: false
    }),
    repo: Flags.string({
      description: '指定搜索的仓库别名'
    }),
    global: Flags.boolean({
      description: '搜索全局配置中的仓库',
      default: false
    }),
    'max-results': Flags.integer({
      description: '最大结果数量',
      default: 20
    }),
    'case-sensitive': Flags.boolean({
      description: '大小写敏感搜索',
      default: false
    }),
    stats: Flags.boolean({
      description: '显示搜索统计信息',
      default: false
    }),
    interactive: Flags.boolean({
      description: '启用交互式搜索界面',
      char: 'i',
      default: false
    }),
    table: Flags.boolean({
      description: '使用表格格式显示结果',
      default: false
    })
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Search)
    
    try {
      // 如果只是查看统计信息
      if (flags.stats) {
        await this.showStats(flags.global)
        return
      }
      
      // 执行搜索
      const results = await searchService.searchTemplates({
        keyword: args.keyword,
        type: flags.type as 'prompt' | 'context' | undefined,
        labels: flags.label || [],
        deep: flags.deep,
        repoName: flags.repo,
        forceGlobal: flags.global,
        maxResults: flags['max-results'],
        caseSensitive: flags['case-sensitive']
      })
      
      if (results.length === 0) {
        logger.info(t('search.empty'))
        
        if (args.keyword) {
          logger.info(t('search.suggest.deep', { keyword: args.keyword }))
        } else {
          logger.info(t('search.suggest.check'))
        }
        
        return
      }
      
      // 交互式搜索
      if (flags.interactive) {
        await this.handleInteractiveSearch(results)
        return
      }
      
      // 显示搜索结果
      if (flags.table) {
        this.displayResultsAsTable(results)
      } else {
        this.displayResults(results, {
          keyword: args.keyword,
          showScore: false, // 根据规格要求，分数仅用于排序不显示
          deep: flags.deep
        })
      }
      
    } catch (error: any) {
      logger.error('搜索失败', error)
      this.exit(1)
    }
  }
  
  /**
   * 显示搜索统计信息
   */
  private async showStats(forceGlobal: boolean): Promise<void> {
    try {
      const stats = await searchService.getSearchStats({ forceGlobal })
      
      logger.info('模板库统计信息:')
      logger.plain('')
      logger.plain(`总模板数: ${stats.totalTemplates}`)
      logger.plain(`Prompt 模板: ${stats.promptCount}`)
      logger.plain(`Context 模板: ${stats.contextCount}`)
      logger.plain('')
      
      if (stats.repoStats.length > 0) {
        logger.plain('各仓库统计:')
        
        const tableData = stats.repoStats.map(repo => ({
          name: repo.name,
          count: repo.templateCount,
          percentage: stats.totalTemplates > 0 
            ? `${Math.round((repo.templateCount / stats.totalTemplates) * 100)}%`
            : '0%'
        }))
        
        const table = renderTable(tableData, [
          { header: '仓库', key: 'name', align: 'left' },
          { header: '模板数', key: 'count', align: 'right' },
          { header: '占比', key: 'percentage', align: 'right' }
        ])
        
        logger.plain(table)
      } else {
        logger.info('没有配置任何仓库')
      }
      
    } catch (error: any) {
      logger.error('获取统计信息失败', error)
    }
  }
  
  /**
   * 显示搜索结果 - 按规格第139行要求的格式：score  type  id  name — summary  [labels...]
   */
  private displayResults(
    results: Array<{
      score: number
      template: {
        id: string
        type: string
        name: string
        labels: string[]
        summary: string
        repoName: string
      }
      matchedFields: string[]
    }>,
    options: {
      keyword?: string
      showScore: boolean
      deep: boolean
    }
  ): void {
    const { keyword, showScore, deep } = options
    
    // 显示搜索信息
    let searchInfo = t('search.found', { count: results.length })
    if (keyword) {
      searchInfo += ` (${t('search.keyword', { keyword })})`
    }
    if (deep) {
      searchInfo += ` ${t('search.deep')}`
    }
    
    logger.success(searchInfo)
    logger.plain('')
    
    // 按规格要求的格式显示结果
    results.forEach(result => {
      const { template, score } = result
      
      // 构建输出行：score  type  id  name — summary  [labels...]
      let line = ''
      
      // 得分（如果显示）
      if (showScore) {
        line += `${score.toFixed(1).padStart(5)} `
      }
      
      // 类型
      const typeIcon = template.type === 'prompt' ? '📝' : '📦'
      const typeName = template.type === 'prompt' ? 'prompt' : 'context'
      line += `${typeIcon} ${typeName.padEnd(7)} `
      
      // ID
      line += `${template.id.padEnd(20)} `
      
      // 名称
      line += `${template.name.padEnd(25)} `
      
      // 分隔符和描述
      const summary = template.summary || '(无描述)'
      line += `— ${summary} `
      
      // 标签
      if (template.labels.length > 0) {
        line += `[${template.labels.join(', ')}]`
      }
      
      logger.plain(line)
    })
    
    logger.plain('')
    
    // 显示使用提示
    if (results.length > 0) {
      const firstResult = results[0]
      logger.info(t('search.usage.title'))
      
      if (firstResult.template.type === 'prompt') {
        logger.plain(`  ${t('search.usage.prompt', { id: firstResult.template.id })}`)
      } else {
        logger.plain(`  ${t('search.usage.context', { id: firstResult.template.id })}`)
      }
      
      logger.plain(`  ${t('search.usage.help')}`)
    }
  }
  
  /**
   * 处理交互式搜索
   */
  private async handleInteractiveSearch(results: Array<{
    score: number
    template: {
      id: string
      type: string
      name: string
      labels: string[]
      summary: string
      repoName: string
    }
    matchedFields: string[]
  }>): Promise<void> {
    try {
      // 显示帮助信息
      logger.plain(getInteractiveSearchHelp())
      
      // 启动交互式选择
      const selectedResult = await startInteractiveSearch({ results })
      
      if (!selectedResult) {
        logger.info(t('common.cancel'))
        return
      }
      
      // 调用 show 命令显示选中的模板
      logger.plain('')
      logger.info(`${t('search.interactive.selected')}: ${selectedResult.template.id}`)
      logger.plain('')
      
      // 创建 show 命令实例并运行
      const showArgs = [selectedResult.template.id]
      const showFlags: any = {}
      
      if (selectedResult.template.repoName) {
        showFlags.repo = selectedResult.template.repoName
      }
      
      const showCommand = new Show(showArgs, this.config)
      
      // 手动设置解析后的参数
      ;(showCommand as any).parsedArgs = { id: selectedResult.template.id }
      ;(showCommand as any).parsedFlags = showFlags
      
      await showCommand.run()
      
    } catch (error: any) {
      if (error.message?.includes('User force closed')) {
        // 用户取消
        logger.info(t('common.cancel'))
        return
      }
      throw error
    }
  }
  
  /**
   * 以表格形式显示搜索结果
   */
  private displayResultsAsTable(results: Array<{
    score: number
    template: {
      id: string
      type: string
      name: string
      labels: string[]
      summary: string
      repoName: string
    }
    matchedFields: string[]
  }>): void {
    logger.success(t('search.found', { count: results.length }))
    logger.plain('')
    
    const tableData = results.map(result => {
      const { template } = result
      const typeIcon = template.type === 'prompt' ? '📝' : '📦'
      
      return {
        type: `${typeIcon} ${template.type}`,
        id: template.id,
        name: template.name,
        summary: template.summary || t('common.no_description'),
        labels: template.labels.join(', ') || '-'
      }
    })
    
    const table = renderTable(tableData, [
      { header: 'Type', key: 'type', width: 12, align: 'left' },
      { header: 'ID', key: 'id', width: 20, align: 'left' },
      { header: 'Name', key: 'name', width: 25, align: 'left' },
      { header: 'Summary', key: 'summary', width: 40, align: 'left' },
      { header: 'Labels', key: 'labels', width: 20, align: 'left' }
    ])
    
    logger.plain(table)
    logger.plain('')
    
    // 显示使用提示
    if (results.length > 0) {
      const firstResult = results[0]
      logger.info(t('search.usage.title'))
      
      if (firstResult.template.type === 'prompt') {
        logger.plain(`  ${t('search.usage.prompt', { id: firstResult.template.id })}`)
      } else {
        logger.plain(`  ${t('search.usage.context', { id: firstResult.template.id })}`)
      }
      
      logger.plain(`  ${t('search.usage.help')}`)
      logger.plain(`  ac search -i  # ${t('search.interactive.help.title').replace(':', '')}`)
    }
  }
}
