/**
 * Search Command - Search templates with modern UI
 */

import {Args, Flags} from '@oclif/core'
import React from 'react'
import {table} from 'table'

import {BaseCommand} from '../base/base'
import {searchService} from '../core/search.service'
import {t} from '../i18n'
import {logger} from '../infra/logger'
import {renderTable} from '../presentation/table'
import {SearchApp} from '../ui/SearchApp'

export default class Search extends BaseCommand {
  static override args = {
    keyword: Args.string({
      description: t('commands.search.args.keyword'),
      required: false,
    }),
  }

  static override description = t('commands.search.description')

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> react',
    '<%= config.bin %> <%= command.id %> --type context',
    '<%= config.bin %> <%= command.id %> --label frontend',
    '<%= config.bin %> <%= command.id %> react --interactive',
    '<%= config.bin %> <%= command.id %> --repo templates',
    '<%= config.bin %> <%= command.id %> --stats',
  ]

  static override flags = {
    global: Flags.boolean({
      default: false,
      description: t('commands.search.flags.global'),
    }),
    interactive: Flags.boolean({
      char: 'i',
      default: false,
      description: t('commands.search.flags.interactive'),
    }),
    label: Flags.string({
      char: 'l',
      description: t('commands.search.flags.label'),
      multiple: true,
    }),
    'max-results': Flags.integer({
      default: 20,
      description: t('commands.search.flags.max_results'),
    }),
    'no-ui': Flags.boolean({
      default: false,
      description: 'Disable interactive UI and show results in table format',
    }),
    repo: Flags.string({
      description: t('commands.search.flags.repo'),
    }),
    stats: Flags.boolean({
      default: false,
      description: t('commands.search.flags.stats'),
    }),
    type: Flags.string({
      description: t('commands.search.flags.type'),
      options: ['context', 'prompt'],
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Search)

    try {
      // If only viewing statistics
      if (flags.stats) {
        await this.showStats(flags.global)
        return
      }

      // If no keywords and interactive mode is enabled (or default behavior)
      if (!args.keyword && (flags.interactive || !flags['no-ui'])) {
        await this.startInteractiveSearch({
          labels: flags.label || [],
          repo: flags.repo,
          type: flags.type as 'context' | 'prompt' | undefined,
        })
        return
      }

      // Execute search
      const results = await searchService.searchTemplates({
        enablePinyin: true,
        forceGlobal: flags.global,
        keyword: args.keyword || '',
        labels: flags.label || [],
        maxResults: flags['max-results'],
        repoName: flags.repo,
        type: flags.type as 'context' | 'prompt' | undefined,
      })

      if (results.length === 0) {
        logger.info(t('search.empty'))

        if (args.keyword) {
          logger.info(t('search.suggest.deep', {keyword: args.keyword}))
        } else {
          logger.info(t('search.suggest.check'))
        }

        return
      }

      // Interactive search
      if (flags.interactive && !flags['no-ui']) {
        await this.startInteractiveSearch({
          initialQuery: args.keyword,
          labels: flags.label || [],
          repo: flags.repo,
          type: flags.type as 'context' | 'prompt' | undefined,
        })
        return
      }

      // Default to table format for search results
      this.displayResultsAsTable(results)
    } catch (error: any) {
      logger.error(t('search.failed'), error)
      this.exit(1)
    }
  }

  /**
   * Display search results in table format
   */
  private displayResultsAsTable(results: Array<{
    matchedFields: string[]
    score: number
    template: {
      id: string
      labels: string[]
      name: string
      repoName: string
      summary: string
      type: string
    }
  }>): void {
    logger.success(t('search.found', {count: results.length}))
    logger.plain('')

    // Prepare table data
    const tableData = [
      // Table header
      ['Type', 'ID', 'Name', 'Summary', 'Labels', 'Repository'],
      // Data rows
      ...results.map(result => {
        const {template} = result
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
          template.repoName,
        ]
      }),
    ]

    // Use table package to render table
    const output = table(tableData, {
      columns: [
        {alignment: 'left', width: 12},   // Type
        {alignment: 'left', width: 18},   // ID
        {alignment: 'left', width: 22},   // Name
        {alignment: 'left', width: 35},   // Summary
        {alignment: 'left', width: 18},   // Labels
        {alignment: 'left', width: 15},    // Repository
      ],
      header: {
        alignment: 'center',
        content: `Search Results (${results.length} found)`,
      },
    })

    logger.plain(output)

    // Show usage tips
    if (results.length > 0) {
      const firstResult = results[0]
      logger.info(t('search.usage.title'))

      if (firstResult.template.type === 'prompt') {
        logger.plain(`  ${t('search.usage.prompt', {id: firstResult.template.id})}`)
      } else {
        logger.plain(`  ${t('search.usage.context', {id: firstResult.template.id})}`)
      }

      logger.plain(`  ${t('search.usage.help')}`)
      logger.plain('  ac search -i  # Start interactive search')
      logger.plain(`  ac show ${firstResult.template.id}  # View template details`)
    }
  }

  /**
   * Show search statistics
   */
  private async showStats(forceGlobal: boolean): Promise<void> {
    try {
      const stats = await searchService.getSearchStats({forceGlobal})

      logger.info(t('search.stats.title'))
      logger.plain('')
      logger.plain(t('search.stats.total', {count: stats.totalTemplates}))
      logger.plain(t('search.stats.prompt', {count: stats.promptCount}))
      logger.plain(t('search.stats.context', {count: stats.contextCount}))
      logger.plain('')

      if (stats.repoStats.length > 0) {
        logger.plain(t('search.stats.by_repo'))

        const tableData = stats.repoStats.map(repo => ({
          count: repo.templateCount,
          name: repo.name,
          percentage: stats.totalTemplates > 0
            ? `${Math.round((repo.templateCount / stats.totalTemplates) * 100)}%`
            : '0%',
        }))

        const table = renderTable(tableData, [
          {align: 'left', header: t('search.stats.repo_header'), key: 'name'},
          {align: 'right', header: t('search.stats.count_header'), key: 'count'},
          {align: 'right', header: t('search.stats.percentage_header'), key: 'percentage'},
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
   * Start interactive search interface
   */
  private async startInteractiveSearch(options: {
    initialQuery?: string
    labels?: string[]
    repo?: string
    type?: 'context' | 'prompt'
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
        const {render} = await import('ink')

        const {unmount} = render(
          React.createElement(SearchApp, {
            initialQuery: options.initialQuery,
            onApplyComplete: handleApplyComplete,
            onExit: handleExit,
            searchOptions: {
              labels: options.labels,
              repo: options.repo,
              type: options.type,
            },
          }),
        )

        // Handle process exit
        const cleanup = () => {
          if (!hasExited) {
            hasExited = true
            unmount()
            resolve()
          }
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)

        // Clean up listeners
        process.once('exit', () => {
          process.removeListener('SIGINT', cleanup)
          process.removeListener('SIGTERM', cleanup)
        })
      } catch (error) {
        if (!hasExited) {
          hasExited = true
          logger.error(`Failed to start interactive search: ${error}`)
          logger.info('Falling back to table output mode.')
          // Fall back to table mode
          try {
            const results = await searchService.searchTemplates({
              enablePinyin: true,
              keyword: options.initialQuery || '',
              labels: options.labels,
              repoName: options.repo,
              type: options.type,
            })
            this.displayResultsAsTable(results)
          } catch {
            logger.error('Failed to display results in table mode.')
          }

          resolve()
        }
      }
    })
  }
}
