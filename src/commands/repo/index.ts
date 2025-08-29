/**
 * Repo 命令组入口
 */

import { Command } from '@oclif/core'

export default class Repo extends Command {
  static override description = '管理模板仓库'

  static override examples = [
    '<%= config.bin %> <%= command.id %> list',
    '<%= config.bin %> <%= command.id %> add https://github.com/astro-tpl/ac-tpl.git',
    '<%= config.bin %> <%= command.id %> update',
    '<%= config.bin %> <%= command.id %> remove template-repo'
  ]

  public async run(): Promise<void> {
    this.log('使用以下子命令管理仓库:')
    this.log('  list    - 列出所有仓库')
    this.log('  add     - 添加新仓库')
    this.log('  update  - 更新仓库')
    this.log('  remove  - 移除仓库')
    this.log('')
    this.log('使用 --help 查看各子命令的详细用法')
  }
}
