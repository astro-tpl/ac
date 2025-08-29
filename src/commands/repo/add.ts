/**
 * Repo Add 命令 - 添加模板仓库
 */

import { Command, Args, Flags } from '@oclif/core'
import { repoService } from '../../core/repo.service'
import { logger } from '../../infra/logger'
import { DEFAULT_BRANCH } from '../../config/constants'

export default class RepoAdd extends Command {
  static override description = '添加模板仓库到配置并克隆到本地缓存目录'

  static override examples = [
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git',
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git --name templates',
    '<%= config.bin %> <%= command.id %> astro-tpl/ac-tpl --branch develop',
    '<%= config.bin %> <%= command.id %> https://github.com/astro-tpl/ac-tpl.git --global'
  ]

  static override args = {
    'git-url': Args.string({
      description: 'Git 仓库 URL',
      required: true
    })
  }

  static override flags = {
    name: Flags.string({
      description: '仓库别名（默认从 URL 推断）',
      helpValue: 'my-templates'
    }),
    branch: Flags.string({
      description: '分支名',
      default: DEFAULT_BRANCH
    }),
    global: Flags.boolean({
      description: '添加到全局配置而非项目配置',
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
        logger.success(`仓库已添加: ${result.repo.name}`)
      } else {
        logger.info(`仓库已存在: ${result.repo.name}`)
      }
      
      logger.info(`- 名称: ${result.repo.name}`)
      logger.info(`- URL: ${result.repo.git}`)
      logger.info(`- 分支: ${result.repo.branch}`)
      logger.info(`- 本地路径: ~/.ac/repos/${result.repo.name}`)
      
      if (result.isNew) {
        logger.info('使用 \'ac search\' 搜索可用模板')
      }
      
    } catch (error: any) {
      logger.error('添加仓库失败', error)
      this.exit(1)
    }
  }
}
