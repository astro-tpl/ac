/**
 * Repo Add Command - Add template repository
 */

import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base/base'
import {DEFAULT_BRANCH} from '../../config/constants'
import {repoService} from '../../core/repo.service'
import {t} from '../../i18n'
import {logger} from '../../infra/logger'

export default class RepoAdd extends BaseCommand {
  static override args = {
    'git-url': Args.string({
      description: t('commands.repo.add.args.git_url'),
      required: true,
    }),
  }

  static override description = t('commands.repo.add.description')

  static override examples = [
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git',
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git --name templates',
    '<%= config.bin %> <%= command.id %> astro-tpl/ac-tpl --branch develop',
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git --global',
  ]

  static override flags = {
    branch: Flags.string({
      default: DEFAULT_BRANCH,
      description: t('commands.repo.add.flags.branch'),
    }),
    global: Flags.boolean({
      default: false,
      description: t('commands.repo.add.flags.global'),
    }),
    name: Flags.string({
      description: t('commands.repo.add.flags.name'),
      helpValue: 'my-templates',
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(RepoAdd)

    try {
      const result = await repoService.addRepo({
        branch: flags.branch,
        forceGlobal: flags.global,
        gitUrl: args['git-url'],
        name: flags.name,
      })

      if (result.isNew) {
        logger.success(t('repo.add.success', {name: result.repo.name}))
      } else {
        logger.info(t('repo.add.exists', {name: result.repo.name}))
      }

      logger.info(`- ${t('repo.add.info.name')}: ${result.repo.name}`)
      logger.info(`- ${t('repo.add.info.url')}: ${result.repo.git}`)
      logger.info(`- ${t('repo.add.info.branch')}: ${result.repo.branch}`)
      logger.info(`- ${t('repo.add.info.path')}: ~/.ac/repos/${result.repo.name}`)

      if (result.isNew) {
        logger.info(t('repo.add.next_step'))
      }
    } catch (error: any) {
      logger.error(t('repo.add.failed'), error)
      this.exit(1)
    }
  }
}
