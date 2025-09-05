/**
 * Repo command group entry point
 */

import { Command } from '@oclif/core'
import { t } from '../../i18n'

export default class Repo extends Command {
  static override description = t('commands.repo.description')

  static override examples = [
    '<%= config.bin %> <%= command.id %> list',
    '<%= config.bin %> <%= command.id %> add https://github.com/astro-tpl/ac-tpl.git',
    '<%= config.bin %> <%= command.id %> update',
    '<%= config.bin %> <%= command.id %> remove template-repo'
  ]

  public async run(): Promise<void> {
    this.log(t('commands.repo.description'))
  }
}
