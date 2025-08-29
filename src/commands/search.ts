/**
 * Search 命令 - 搜索模板
 */

import { Command, Args, Flags } from '@oclif/core'
import { searchService } from '../core/search.service'
import { logger } from '../infra/logger'
import { renderTable, formatRelativeTime } from '../presentation/table'

export default class Search extends Command {
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
        logger.info('没有找到匹配的模板')
        
        if (args.keyword) {
          logger.info(`尝试使用 'ac search --deep ${args.keyword}' 进行深度搜索`)
        } else {
          logger.info('尝试调整搜索条件或使用 \'ac repo list\' 检查仓库状态')
        }
        
        return
      }
      
      // 显示搜索结果
      this.displayResults(results, {
        keyword: args.keyword,
        showScore: !!args.keyword,
        deep: flags.deep
      })
      
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
   * 显示搜索结果
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
    let searchInfo = `找到 ${results.length} 个模板`
    if (keyword) {
      searchInfo += ` (关键字: "${keyword}")`
    }
    if (deep) {
      searchInfo += ' [深度搜索]'
    }
    
    logger.success(searchInfo)
    logger.plain('')
    
    // 准备表格数据
    const tableData = results.map(result => {
      const { template, score, matchedFields } = result
      
      return {
        score: showScore ? score.toFixed(1) : '',
        type: template.type === 'prompt' ? '📝 Prompt' : '📦 Context',
        id: template.id,
        name: template.name,
        summary: template.summary || '(无描述)',
        labels: template.labels.length > 0 ? template.labels.join(', ') : '(无标签)',
        repo: template.repoName,
        matched: matchedFields.length > 0 ? matchedFields.join(', ') : ''
      }
    })
    
    // 定义表格列
    const columns = [
      ...(showScore ? [{ header: '得分', key: 'score', align: 'right' as const, width: 6 }] : []),
      { header: '类型', key: 'type', width: 10 },
      { header: 'ID', key: 'id', width: 20 },
      { header: '名称', key: 'name', width: 25 },
      { header: '描述', key: 'summary', width: 30 },
      { header: '标签', key: 'labels', width: 20 },
      { header: '仓库', key: 'repo', width: 12 }
    ]
    
    // 如果有关键字搜索，显示匹配字段
    if (keyword && results.some(r => r.matchedFields.length > 0)) {
      columns.push({ header: '匹配字段', key: 'matched', width: 15 })
    }
    
    // 渲染表格
    const table = renderTable(tableData, columns, {
      style: 'simple',
      maxColumnWidth: 40,
      truncate: true
    })
    
    logger.plain(table)
    logger.plain('')
    
    // 显示使用提示
    if (results.length > 0) {
      const firstResult = results[0]
      logger.info('使用方式:')
      
      if (firstResult.template.type === 'prompt') {
        logger.plain(`  ac apply --prompt ${firstResult.template.id} --dest ./prompt.md`)
      } else {
        logger.plain(`  ac apply --context ${firstResult.template.id}`)
      }
      
      logger.plain(`  ac apply --help  # 查看更多选项`)
    }
  }
}
