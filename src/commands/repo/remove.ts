/**
 * Repo Remove Command - Remove repository
 */

import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../../base/base'
import { repoService } from '../../core/repo.service'
import { logger } from '../../infra/logger'
import { t } from '../../i18n'

export default class RepoRemove extends BaseCommand {
  static override description = t('commands.repo.remove.description')
  


  static override examples = [
    '<%= config.bin %> <%= command.id %> ac-tpl',
    '<%= config.bin %> <%= command.id %> ac-tpl --remove-local',
    '<%= config.bin %> <%= command.id %> ac-tpl --global'
  ]

  static override args = {
    alias: Args.string({
      description: t('commands.repo.remove.args.alias'),
      required: true
    })
  }

  static override flags = {
    'remove-local': Flags.boolean({
      description: t('commands.repo.remove.flags.remove_local'),
      default: true
    }),
    global: Flags.boolean({
      description: t('commands.repo.remove.flags.global'),
      default: false
    })
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RepoRemove)
    
    try {
      // 确认操作
      if (flags['remove-local']) {
        logger.warn(t('repo.remove.warning', { name: args.alias }))
        logger.warn(t('repo.remove.warning_irreversible'))
      }
      
      const result = await repoService.removeRepo({
        repoName: args.alias,
        forceGlobal: flags.global,
        removeLocal: flags['remove-local']
      })
      
      if (result.removedFromConfig) {
        logger.success(t('repo.remove.success_config', { name: args.alias }))
      }
      
      if (result.removedLocal) {
        logger.success(t('repo.remove.success_local', { name: args.alias }))
      } else if (flags['remove-local']) {
        logger.info(t('repo.remove.local_not_exists', { name: args.alias }))
      }
      
      if (!flags['remove-local']) {
        logger.info(t('repo.remove.local_kept', { name: args.alias }))
        logger.info(t('repo.remove.local_help'))
      }
      
      logger.info(t('repo.remove.index_refreshed'))
      
    } catch (error: any) {
      logger.error(t('repo.remove.failed'), error)
      this.exit(1)
    }
  }
}
