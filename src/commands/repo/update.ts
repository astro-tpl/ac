/**
 * Repo Update Command - Update repositories
 */

import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../../base/base'
import { repoService } from '../../core/repo.service'
import { logger } from '../../infra/logger'
import { t } from '../../i18n'

export default class RepoUpdate extends BaseCommand {
  static override description = t('commands.repo.update.description')
  


  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> ac-tpl',
    '<%= config.bin %> <%= command.id %> --global'
  ]

  static override args = {
    alias: Args.string({
      description: t('commands.repo.update.args.alias'),
      required: false
    })
  }

  static override flags = {
    global: Flags.boolean({
      description: t('commands.repo.update.flags.global'),
      default: false
    })
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RepoUpdate)
    
    try {
      const result = await repoService.updateRepo({
        repoName: args.alias,
        forceGlobal: flags.global
      })
      
      const { updated } = result
      const successCount = updated.filter(r => r.success).length
      const totalCount = updated.length
      
      if (totalCount === 0) {
        logger.info(t('repo.update.no_repos'))
        return
      }
      
      logger.success(t('repo.update.success', { success: successCount, total: totalCount }))
      
      // Show detailed results
      for (const item of updated) {
        if (item.success) {
          logger.info(t('repo.update.success_item', { name: item.name }))
        } else {
          logger.warn(t('repo.update.failed_item', { name: item.name, error: item.error || 'Unknown error' }))
        }
      }
      
      if (successCount > 0) {
        logger.info(t('repo.update.next_step'))
      }
      
    } catch (error: any) {
      logger.error(t('repo.update.failed'), error)
      this.exit(1)
    }
  }
}
