/**
 * Show command - Display template content
 * Implemented according to specification document lines 144-173
 */

import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../base/base'
import {configService} from '../core/config.service'
import {searchService} from '../core/search.service'
import {templateService} from '../core/template.service'
import {t} from '../i18n'
import {logger} from '../infra/logger'
import {renderKeyValue, renderTable} from '../presentation/table'
import {ContextTemplate, PromptTemplate, Template} from '../types/template'

export default class Show extends BaseCommand {
  static override args = {
    id: Args.string({
      description: t('commands.show.args.id'),
      required: true,
    }),
  }

  static override description = t('commands.show.description')

  static override examples = [
    '<%= config.bin %> <%= command.id %> cursor-default',
    '<%= config.bin %> <%= command.id %> cursor-default --repo templates',
    '<%= config.bin %> <%= command.id %> cursor-default --output content',
    '<%= config.bin %> <%= command.id %> cursor-default --output targets',
    '<%= config.bin %> <%= command.id %> cursor-default --output name',
  ]

  static override flags = {
    global: Flags.boolean({
      default: false,
      description: t('commands.show.flags.global'),
    }),
    output: Flags.string({
      char: 'o',
      description: t('commands.show.flags.output'),
      helpValue: 'content|targets|name|labels|summary',
    }),
    repo: Flags.string({
      description: t('commands.show.flags.repo'),
      helpValue: 'templates',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Show)

    try {
      // Get configuration
      const resolvedConfig = await configService.resolveConfig({
        forceGlobal: flags.global,
      })

      let {repos} = resolvedConfig.config

      // Filter repositories
      if (flags.repo) {
        repos = repos.filter(r => r.name === flags.repo)
        if (repos.length === 0) {
          logger.error(t('repo.remove.notfound', {alias: flags.repo}))
          this.exit(1)
        }
      }

      if (repos.length === 0) {
        logger.error(t('search.stats.no_repos'))
        this.exit(1)
      }

      // Find template
      const templates = await this.findTemplates(args.id, repos)

      if (templates.length === 0) {
        logger.error(t('show.notfound', {id: args.id}))
        logger.info(t('search.suggest.check'))
        this.exit(1)
      }

      // Handle duplicate ID cases
      let selectedTemplate: Template
      selectedTemplate = templates.length > 1 ? (await this.selectTemplate(templates, args.id)) : templates[0]

      // Display template content
      this.displayTemplate(selectedTemplate, flags.output)
    } catch (error: any) {
      logger.error(t('apply.failed', {error: error.message}), error)
      this.exit(1)
    }
  }

  /**
   * Display specified attribute
   */
  private displayAttribute(template: Template, path: string): void {
    const value = this.getAttributeValue(template, path)

    if (value === undefined) {
      logger.error(t('show.attr.notfound', {path}))
      this.exit(1)
    }

    if (typeof value === 'string') {
      logger.plain(value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          logger.plain(item)
        } else {
          logger.plain(JSON.stringify(item, null, 2))
        }
      }
    } else {
      logger.plain(JSON.stringify(value, null, 2))
    }
  }

  /**
   * Display Context template content
   */
  private displayContextContent(template: ContextTemplate): void {
    logger.info(t('show.target_files', {count: template.targets.length}))
    logger.plain('')

    for (const [index, target] of template.targets.entries()) {
      logger.plain(t('show.target_file_item', {index: index + 1, path: target.path}))

      const details = {
        [t('show.content_order')]: target.content_order || 'content-first',
        [t('show.content_source')]: target.content_from_prompt
          ? t('show.content_from_prompt', {prompt: target.content_from_prompt})
          : t('show.direct_content'),
        [t('ui.detail.mode')]: target.mode,
      }

      logger.plain(renderKeyValue(details, {indent: 2}))

      if (target.content) {
        logger.plain(`  ${t('show.content_preview')}:`)
        const preview = target.content.length > 200
          ? target.content.slice(0, 200) + '...'
          : target.content
        logger.plain(`  ${preview.replaceAll('\n', '\n  ')}`)
      }

      logger.plain('')
    }
  }

  /**
   * Display complete template
   */
  private displayFullTemplate(template: Template): void {
    // Display basic information
    const basicInfo = {
      ID: template.id,
      [t('ui.detail.labels')]: template.labels.length > 0 ? template.labels.join(', ') : t('ui.detail.no_labels'),
      [t('ui.detail.name')]: template.name,
      [t('ui.detail.summary')]: template.summary || t('common.no_description'),
      [t('ui.detail.type')]: template.type === 'prompt' ? 'Prompt' : 'Context',
    }

    logger.plain(renderKeyValue(basicInfo))
    logger.plain('')

    // Display different content based on type
    if (template.type === 'prompt') {
      this.displayPromptContent(template as PromptTemplate)
    } else {
      this.displayContextContent(template as ContextTemplate)
    }

    // Display usage hint
    logger.plain('')
    logger.info(t('show.usage.title'))
    logger.plain(`  ${t('show.usage.apply', {id: template.id, type: template.type})}`)
  }

  /**
   * Display Prompt template content
   */
  private displayPromptContent(template: PromptTemplate): void {
    logger.info(t('show.content_label'))
    logger.plain('─'.repeat(50))
    logger.plain(template.content)
    logger.plain('─'.repeat(50))
  }

  /**
   * Display template content
   */
  private displayTemplate(template: Template, outputPath?: string): void {
    if (outputPath) {
      this.displayAttribute(template, outputPath)
    } else {
      this.displayFullTemplate(template)
    }
  }

  /**
   * Find matching templates
   */
  private async findTemplates(id: string, repos: any[]): Promise<Template[]> {
    const templates: Template[] = []

    for (const repo of repos) {
      try {
        const template = await templateService.loadTemplate(id, {
          repoName: repo.name,
        })
        templates.push(template)
      } catch {
        // Template doesn't exist, continue searching other repositories
        continue
      }
    }

    return templates
  }

  /**
   * Get attribute value
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

  /**
   * Prompt user to select template
   */
  private async promptUserSelection(templates: Template[]): Promise<Template> {
    const readline = await import('node:readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise(resolve => {
      const askForSelection = () => {
        rl.question(t('show.prompt.select', {max: templates.length}), (answer: string) => {
          const selection = Number.parseInt(answer.trim())

          if (isNaN(selection) || selection < 1 || selection > templates.length) {
            logger.error(t('show.prompt.invalid', {max: templates.length}))
            askForSelection()
            return
          }

          const selectedTemplate = templates[selection - 1]
          logger.success(t('show.prompt.selected', {
            name: selectedTemplate.name,
            repo: (selectedTemplate as any).repoName || 'unknown',
          }))

          rl.close()
          resolve(selectedTemplate)
        })
      }

      askForSelection()
    })
  }

  /**
   * Select template (handle duplicate IDs)
   */
  private async selectTemplate(templates: Template[], id: string): Promise<Template> {
    logger.info(t('show.duplicate.title', {id}))
    logger.plain('')

    // Show selection list
    const tableData = templates.map((template, index) => ({
      index: (index + 1).toString(),
      name: template.name,
      repo: (template as any).repoName || 'unknown',
      summary: template.summary || t('common.no_description'),
      type: template.type === 'prompt' ? '📝 Prompt' : '📦 Context',
    }))

    const table = renderTable(tableData, [
      {header: t('show.table.index'), key: 'index', width: 4},
      {header: t('show.table.type'), key: 'type', width: 10},
      {header: t('show.table.name'), key: 'name', width: 25},
      {header: t('show.table.summary'), key: 'summary', width: 30},
      {header: t('show.table.repo'), key: 'repo', width: 12},
    ])

    logger.plain(table)
    logger.plain('')

    // Interactive selection
    return this.promptUserSelection(templates)
  }
}
