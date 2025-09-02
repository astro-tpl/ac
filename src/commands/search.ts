/**
 * Search Command - Search templates with modern UI
 */

import React from 'react'
import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../base/base'
import { searchService } from '../core/search.service'
import { logger } from '../infra/logger'
import { t } from '../i18n'
import { renderTable } from '../presentation/table'
import { SearchApp } from '../ui/SearchApp'
import { table } from 'table'

export default class Search extends BaseCommand {
  static override description = t('commands.search.description')

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> react',
    '<%= config.bin %> <%= command.id %> --type context',
    '<%= config.bin %> <%= command.id %> --label frontend',
    '<%= config.bin %> <%= command.id %> react --interactive',
    '<%= config.bin %> <%= command.id %> --repo templates',
    '<%= config.bin %> <%= command.id %> --stats'
  ]

  static override args = {
    keyword: Args.string({
      description: t('commands.search.args.keyword'),
      required: false
    })
  }

  static override flags = {
    type: Flags.string({
      description: t('commands.search.flags.type'),
      options: ['context', 'prompt']
    }),
    label: Flags.string({
      description: t('commands.search.flags.label'),
      multiple: true,
      char: 'l'
    }),
    repo: Flags.string({
      description: t('commands.search.flags.repo')
    }),
    global: Flags.boolean({
      description: t('commands.search.flags.global'),
      default: false
    }),
    'max-results': Flags.integer({
      description: t('commands.search.flags.max_results'),
      default: 20
    }),
    stats: Flags.boolean({
      description: t('commands.search.flags.stats'),
      default: false
    }),
    interactive: Flags.boolean({
      description: t('commands.search.flags.interactive'),
      char: 'i',
      default: false
    }),
    'no-ui': Flags.boolean({
      description: 'Disable interactive UI and show results in table format',
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

      // 如果没有关键词且启用交互式模式（或默认行为）
      if (!args.keyword && (flags.interactive || !flags['no-ui'])) {
        await this.startInteractiveSearch({
          type: flags.type as 'prompt' | 'context' | undefined,
          labels: flags.label || [],
          repo: flags.repo
        })
        return
      }

      // 执行搜索
      const results = await searchService.searchTemplates({
        keyword: args.keyword || '',
        type: flags.type as 'prompt' | 'context' | undefined,
        labels: flags.label || [],
        repoName: flags.repo,
        forceGlobal: flags.global,
        maxResults: flags['max-results'],
        enablePinyin: true
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
      if (flags.interactive && !flags['no-ui']) {
        await this.startInteractiveSearch({
          initialQuery: args.keyword,
          type: flags.type as 'prompt' | 'context' | undefined,
          labels: flags.label || [],
          repo: flags.repo
        })
        return
      }
      
      // 默认使用表格格式显示搜索结果
      this.displayResultsAsTable(results)
      
    } catch (error: any) {
      logger.error(t('search.failed'), error)
      this.exit(1)
    }
  }

  /**
   * 启动交互式搜索界面
   */
  private async startInteractiveSearch(options: {
    initialQuery?: string
    type?: 'prompt' | 'context'
    labels?: string[]
    repo?: string
  }): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let hasExited = false

      const handleExit = () => {
        if (!hasExited) {
          hasExited = true
          resolve()
        }
      }

      const handleApplyComplete = (success: boolean, error?: string) => {
        if (success) {
          logger.success('Template applied successfully!')
        } else {
          logger.error(`Apply failed: ${error}`)
        }
      }

      try {
        const { render } = await import('ink')
        
        const { unmount } = render(
          React.createElement(SearchApp, {
            initialQuery: options.initialQuery,
            searchOptions: {
              type: options.type,
              labels: options.labels,
              repo: options.repo
            },
            onApplyComplete: handleApplyComplete,
            onExit: handleExit
          })
        )

        // 处理进程退出
        const cleanup = () => {
          if (!hasExited) {
            hasExited = true
            unmount()
            resolve()
          }
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)
        
        // 清理监听器
        process.once('exit', () => {
          process.removeListener('SIGINT', cleanup)
          process.removeListener('SIGTERM', cleanup)
        })

      } catch (error) {
        if (!hasExited) {
          hasExited = true
          logger.error(`Failed to start interactive search: ${error}`)
          logger.info('Falling back to table output mode.')
          // 回退到表格模式
          try {
            const results = await searchService.searchTemplates({
              keyword: options.initialQuery || '',
              type: options.type,
              labels: options.labels,
              repoName: options.repo,
              enablePinyin: true
            })
            this.displayResultsAsTable(results)
          } catch (fallbackError) {
            logger.error('Failed to display results in table mode.')
          }
          resolve()
        }
      }
    })
  }
  
  /**
   * 显示搜索统计信息
   */
  private async showStats(forceGlobal: boolean): Promise<void> {
    try {
      const stats = await searchService.getSearchStats({ forceGlobal })
      
      logger.info(t('search.stats.title'))
      logger.plain('')
      logger.plain(t('search.stats.total', { count: stats.totalTemplates }))
      logger.plain(t('search.stats.prompt', { count: stats.promptCount }))
      logger.plain(t('search.stats.context', { count: stats.contextCount }))
      logger.plain('')
      
      if (stats.repoStats.length > 0) {
        logger.plain(t('search.stats.by_repo'))
        
        const tableData = stats.repoStats.map(repo => ({
          name: repo.name,
          count: repo.templateCount,
          percentage: stats.totalTemplates > 0 
            ? `${Math.round((repo.templateCount / stats.totalTemplates) * 100)}%`
            : '0%'
        }))
        
        const table = renderTable(tableData, [
          { header: t('search.stats.repo_header'), key: 'name', align: 'left' },
          { header: t('search.stats.count_header'), key: 'count', align: 'right' },
          { header: t('search.stats.percentage_header'), key: 'percentage', align: 'right' }
        ])
        
        logger.plain(table)
      } else {
        logger.info(t('search.stats.no_repos'))
      }
      
    } catch (error: any) {
      logger.error(t('search.stats.failed'), error)
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
    
    // 准备表格数据
    const tableData = [
      // 表头
      ['Type', 'ID', 'Name', 'Summary', 'Labels', 'Repository'],
      // 数据行
      ...results.map(result => {
        const { template } = result
        const typeIcon = template.type === 'prompt' ? '📝' : '📦'
        const typeDisplay = `${typeIcon} ${template.type}`
        const summary = template.summary || t('common.no_description')
        const labels = template.labels.length > 0 ? template.labels.join(', ') : '-'
        
        return [
          typeDisplay, 
          template.id, 
          template.name, 
          summary, 
          labels,
          template.repoName
        ]
      })
    ]
    
    // 使用 table 包渲染表格
    const output = table(tableData, {
      header: {
        alignment: 'center',
        content: `Search Results (${results.length} found)`
      },
      columns: [
        { alignment: 'left', width: 12 },   // Type
        { alignment: 'left', width: 18 },   // ID
        { alignment: 'left', width: 22 },   // Name
        { alignment: 'left', width: 35 },   // Summary
        { alignment: 'left', width: 18 },   // Labels
        { alignment: 'left', width: 15 }    // Repository
      ]
    })
    
    logger.plain(output)
    
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
      logger.plain(`  ac search -i  # Start interactive search`)
      logger.plain(`  ac show ${firstResult.template.id}  # View template details`)
    }
  }
}