/**
 * Apply command - Apply templates to project files
 */

import { Flags } from '@oclif/core'
import { BaseCommand } from '../base/base'
import { applyService } from '../core/apply.service'
import { configService } from '../core/config.service'
import { searchService } from '../core/search.service'
import { logger } from '../infra/logger'
import { t } from '../i18n'
import { renderTable, renderKeyValue } from '../presentation/table'
import { Template } from '../types/template'

export default class Apply extends BaseCommand {
  static override description = t('commands.apply.description')
  


  static override examples = [
    '<%= config.bin %> <%= command.id %> --context cursor-default',
    '<%= config.bin %> <%= command.id %> --prompt code_principles --dest ./prompt.md',
    '<%= config.bin %> <%= command.id %> --content ./template.txt --dest ./output.txt',
    '<%= config.bin %> <%= command.id %> --context cursor-default --dry-run',
    '<%= config.bin %> <%= command.id %> --prompt code_principles --dest docs/ --filename principles.md'
  ]

  static override flags = {
    context: Flags.string({
      description: t('commands.apply.flags.context'),
      exclusive: ['prompt', 'content', 'stdin']
    }),
    prompt: Flags.string({
      description: t('commands.apply.flags.prompt'),
      exclusive: ['context', 'content', 'stdin']
    }),
    content: Flags.string({
      description: t('commands.apply.flags.content'),
      exclusive: ['context', 'prompt', 'stdin']
    }),
    stdin: Flags.boolean({
      description: t('commands.apply.flags.stdin'),
      exclusive: ['context', 'prompt', 'content']
    }),
    dest: Flags.string({
      description: t('commands.apply.flags.dest'),
      helpValue: './output'
    }),
    filename: Flags.string({
      description: t('commands.apply.flags.filename'),
      helpValue: 'output.md'
    }),
    mode: Flags.string({
      description: t('commands.apply.flags.mode'),
      options: ['write', 'append', 'merge'],
      default: 'write'
    }),
    repo: Flags.string({
      description: t('commands.apply.flags.repo'),
      helpValue: 'templates'
    }),
    global: Flags.boolean({
      description: t('commands.apply.flags.global'),
      default: false
    }),
    'dry-run': Flags.boolean({
      description: t('commands.apply.flags.dry_run'),
      default: false
    })
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Apply)
    
    try {
      // Check if there are duplicate IDs that need handling
      const templateId = flags.context || flags.prompt
      if (templateId && !flags.repo) {
        const resolvedOptions = await this.resolveTemplateOptions(templateId, flags)
        if (resolvedOptions) {
          // Use parsed options
          const result = await applyService.applyTemplate({
            ...resolvedOptions,
            content: flags.content,
            stdin: flags.stdin,
            dest: flags.dest,
            filename: flags.filename,
            mode: flags.mode as 'write' | 'append' | 'merge',
            forceGlobal: flags.global,
            dryRun: flags['dry-run']
          })
          
          if (flags['dry-run'] && result) {
            this.displayDryRunResult(result)
          }
          return
        }
      }

      // Original logic
      const result = await applyService.applyTemplate({
        context: flags.context,
        prompt: flags.prompt,
        content: flags.content,
        stdin: flags.stdin,
        dest: flags.dest,
        filename: flags.filename,
        mode: flags.mode as 'write' | 'append' | 'merge',
        repo: flags.repo,
        forceGlobal: flags.global,
        dryRun: flags['dry-run']
      })
      
      if (flags['dry-run'] && result) {
        this.displayDryRunResult(result)
      }
      
    } catch (error: any) {
      logger.error(t('apply.failed', { error: error.message }), error)
      this.exit(1)
    }
  }

  /**
   * Parse template options, handle duplicate IDs
   */
  private async resolveTemplateOptions(templateId: string, flags: any): Promise<any | null> {
    try {
      // Get configuration
      const resolvedConfig = await configService.resolveConfig({ 
        forceGlobal: flags.global 
      })
      
      let repos = resolvedConfig.config.repos
      
      if (repos.length === 0) {
        return null
      }
      
      // Find all matching templates
      const templates = await this.findAllTemplates(templateId, repos)
      
      if (templates.length === 0) {
        return null
      }
      
      // If only one template, use directly
      if (templates.length === 1) {
        return null // Let original logic handle
      }
      
      // Handle duplicate ID cases
      const selectedTemplate = await this.selectTemplateForApply(templates, templateId)
      const repoName = (selectedTemplate as any).repoName
      
      // Return options with repository information
      if (flags.context) {
        return { context: templateId, repo: repoName }
      } else if (flags.prompt) {
        return { prompt: templateId, repo: repoName }
      }
      
      return null
    } catch (error) {
      // If error occurs, let original logic handle
      return null
    }
  }

  /**
   * Find all matching templates
   */
  private async findAllTemplates(id: string, repos: any[]): Promise<Template[]> {
    try {
      // Use search service to find exactly matching templates
      const results = await searchService.searchTemplates({
        keyword: id,
        forceGlobal: false
      })
      
      // Filter out exactly matching templates
      const exactMatches = results.filter(result => 
        result.template.id === id
      ).map(result => result.template as any)
      
      return exactMatches
    } catch (error) {
      return []
    }
  }

  /**
   * Select template to apply
   */
  private async selectTemplateForApply(templates: Template[], id: string): Promise<Template> {
    logger.info(t('apply.duplicate.title', { id, count: templates.length }))
    logger.plain('')
    
    // Show selection list
    const tableData = templates.map((template, index) => ({
      index: (index + 1).toString(),
      type: template.type === 'prompt' ? '📝 Prompt' : '📦 Context',
      name: template.name,
      summary: template.summary || t('common.no_description'),
      repo: (template as any).repoName || 'unknown'
    }))
    
    const table = renderTable(tableData, [
      { header: t('apply.table.index'), key: 'index', width: 4 },
      { header: t('apply.table.type'), key: 'type', width: 10 },
      { header: t('apply.table.name'), key: 'name', width: 25 },
      { header: t('apply.table.summary'), key: 'summary', width: 30 },
      { header: t('apply.table.repo'), key: 'repo', width: 12 }
    ])
    
    logger.plain(table)
    logger.plain('')
    
    // Interactive selection
    return this.promptUserSelectionForApply(templates)
  }

  /**
   * Prompt user to select template to apply
   */
  private async promptUserSelectionForApply(templates: Template[]): Promise<Template> {
    const readline = await import('node:readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      const askForSelection = () => {
        rl.question(t('apply.prompt.select', { max: templates.length }), (answer: string) => {
          const selection = parseInt(answer.trim())
          
          if (isNaN(selection) || selection < 1 || selection > templates.length) {
            logger.error(t('apply.prompt.invalid', { max: templates.length }))
            askForSelection()
            return
          }
          
          const selectedTemplate = templates[selection - 1]
          logger.success(t('apply.prompt.selected', { 
            name: selectedTemplate.name,
            repo: (selectedTemplate as any).repoName || 'unknown'
          }))
          
          rl.close()
          resolve(selectedTemplate)
        })
      }
      
      askForSelection()
    })
  }
  
  /**
   * Show preview results
   */
  private displayDryRunResult(result: {
    results: Array<{
      targetPath: string
      mode: string
      isNewFile: boolean
      contentSummary: string
      jsonKeyDiff?: {
        added: string[]
        modified: string[]
      }
    }>
    totalFiles: number
  }  ): void {
    logger.info(t('apply.preview.title', { count: result.totalFiles }))
    logger.plain('')
    
    for (let i = 0; i < result.results.length; i++) {
      const item = result.results[i]
      
      logger.plain(t('apply.preview.file', { index: i + 1, path: item.targetPath }))
      
      const details = {
        [t('common.status')]: item.isNewFile ? t('apply.preview.status.new') : t('apply.preview.status.modify'),
        [t('apply.preview.mode')]: item.mode,
        [t('apply.preview.content')]: item.contentSummary
      }
      
      logger.plain(renderKeyValue(details, { indent: 2 }))
      
      // Show JSON merge differences
      if (item.jsonKeyDiff) {
        logger.plain(`  ${t('apply.preview.json_diff')}`)
        
        if (item.jsonKeyDiff.added.length > 0) {
          logger.plain(`    ${t('apply.preview.json_added', { keys: item.jsonKeyDiff.added.join(', ') })}`)
        }
        
        if (item.jsonKeyDiff.modified.length > 0) {
          logger.plain(`    ${t('apply.preview.json_modified', { keys: item.jsonKeyDiff.modified.join(', ') })}`)
        }
      }
      
      logger.plain('')
    }
    
    logger.info(t('apply.preview.execute'))
  }
}
