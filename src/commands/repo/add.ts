/**
 * Repo Add Command - Add template repository
 */

import { Args, Flags } from '@oclif/core'
import { BaseCommand } from '../../base/base'
import { repoService } from '../../core/repo.service'
import { logger } from '../../infra/logger'
import { t } from '../../i18n'
import { DEFAULT_BRANCH } from '../../config/constants'

export default class RepoAdd extends BaseCommand {
  static override description = t('commands.repo.add.description')
  


  static override examples = [
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git',
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git --name templates',
    '<%= config.bin %> <%= command.id %> astro-tpl/ac-tpl --branch develop',
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git --global'
  ]

  static override args = {
    'git-url': Args.string({
      description: t('commands.repo.add.args.git_url'),
      required: true
    })
  }

  static override flags = {
    name: Flags.string({
      description: t('commands.repo.add.flags.name'),
      helpValue: 'my-templates'
    }),
    branch: Flags.string({
      description: t('commands.repo.add.flags.branch'),
      default: DEFAULT_BRANCH
    }),
    global: Flags.boolean({
      description: t('commands.repo.add.flags.global'),
      default: false
    })
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RepoAdd)
    
    try {
      const result = await repoService.addRepo({
        gitUrl: args['git-url'],
        name: flags.name,
        branch: flags.branch,
        forceGlobal: flags.global
      })
      
      if (result.isNew) {
        logger.success(t('repo.add.success', { name: result.repo.name }))
      } else {
        logger.info(t('repo.add.exists', { name: result.repo.name }))
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
