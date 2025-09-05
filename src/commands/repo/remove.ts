/**
 * Repo Remove Command - Remove repository
 */

import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base/base'
import {repoService} from '../../core/repo.service'
import {t} from '../../i18n'
import {logger} from '../../infra/logger'

export default class RepoRemove extends BaseCommand {
  static override args = {
    alias: Args.string({
      description: t('commands.repo.remove.args.alias'),
      required: true,
    }),
  }

  static override description = t('commands.repo.remove.description')

  static override examples = [
    '<%= config.bin %> <%= command.id %> ac-tpl',
    '<%= config.bin %> <%= command.id %> ac-tpl --remove-local',
    '<%= config.bin %> <%= command.id %> ac-tpl --global',
  ]

  static override flags = {
    global: Flags.boolean({
      default: false,
      description: t('commands.repo.remove.flags.global'),
    }),
    'remove-local': Flags.boolean({
      default: true,
      description: t('commands.repo.remove.flags.remove_local'),
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoRemove)

    try {
      // Confirm operation
      if (flags['remove-local']) {
        logger.warn(t('repo.remove.warning', {name: args.alias}))
        logger.warn(t('repo.remove.warning_irreversible'))
      }

      const result = await repoService.removeRepo({
        forceGlobal: flags.global,
        removeLocal: flags['remove-local'],
        repoName: args.alias,
      })

      if (result.removedFromConfig) {
        logger.success(t('repo.remove.success_config', {name: args.alias}))
      }

      if (result.removedLocal) {
        logger.success(t('repo.remove.success_local', {name: args.alias}))
      } else if (flags['remove-local']) {
        logger.info(t('repo.remove.local_not_exists', {name: args.alias}))
      }

      if (!flags['remove-local']) {
        logger.info(t('repo.remove.local_kept', {name: args.alias}))
        logger.info(t('repo.remove.local_help'))
      }

      logger.info(t('repo.remove.index_refreshed'))
    } catch (error: any) {
      logger.error(t('repo.remove.failed'), error)
      this.exit(1)
    }
  }
}
