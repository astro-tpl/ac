/**
 * Repo Remove 命令 - 移除仓库
 */

import { Command, Args, Flags } from '@oclif/core'
import { repoService } from '../../core/repo.service'
import { logger } from '../../infra/logger'

export default class RepoRemove extends Command {
  static override description = '从配置中移除仓库并可选择清理本地缓存目录'

  static override examples = [
    '<%= config.bin %> <%= command.id %> ac-tpl',
    '<%= config.bin %> <%= command.id %> ac-tpl --remove-local',
    '<%= config.bin %> <%= command.id %> ac-tpl --global'
  ]

  static override args = {
    alias: Args.string({
      description: '仓库别名',
      required: true
    })
  }

  static override flags = {
    'remove-local': Flags.boolean({
      description: '同时删除本地缓存目录',
      default: false
    }),
    global: Flags.boolean({
      description: '从全局配置中移除仓库',
      default: false
    })
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RepoRemove)
    
    try {
      // 确认操作
      if (flags['remove-local']) {
        logger.warn(`⚠️  即将删除仓库 "${args.alias}" 的本地缓存目录`)
        logger.warn('此操作不可恢复！')
      }
      
      const result = await repoService.removeRepo({
        repoName: args.alias,
        forceGlobal: flags.global,
        removeLocal: flags['remove-local']
      })
      
      if (result.removedFromConfig) {
        logger.success(`仓库已从配置中移除: ${args.alias}`)
      }
      
      if (result.removedLocal) {
        logger.success(`本地缓存目录已删除: ~/.ac/repos/${args.alias}`)
      } else if (flags['remove-local']) {
        logger.info(`本地缓存目录不存在: ~/.ac/repos/${args.alias}`)
      }
      
      if (!flags['remove-local']) {
        logger.info(`本地缓存目录保留在: ~/.ac/repos/${args.alias}`)
        logger.info('使用 --remove-local 选项可同时删除本地目录')
      }
      
      logger.info('模板索引已刷新')
      
    } catch (error: any) {
      logger.error('移除仓库失败', error)
      this.exit(1)
    }
  }
}
