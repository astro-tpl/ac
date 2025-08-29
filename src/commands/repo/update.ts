/**
 * Repo Update 命令 - 更新仓库
 */

import { Command, Args, Flags } from '@oclif/core'
import { repoService } from '../../core/repo.service'
import { logger } from '../../infra/logger'

export default class RepoUpdate extends Command {
  static override description = '更新指定或全部仓库（git pull）并刷新索引'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> ac-tpl',
    '<%= config.bin %> <%= command.id %> --global'
  ]

  static override args = {
    alias: Args.string({
      description: '仓库别名（可选，为空则更新所有）',
      required: false
    })
  }

  static override flags = {
    global: Flags.boolean({
      description: '更新全局配置中的仓库',
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
        logger.info('没有需要更新的仓库')
        return
      }
      
      logger.success(`仓库更新完成: ${successCount}/${totalCount}`)
      
      // 显示详细结果
      for (const item of updated) {
        if (item.success) {
          logger.info(`✅ ${item.name}: 更新成功`)
        } else {
          logger.warn(`❌ ${item.name}: ${item.error}`)
        }
      }
      
      if (successCount > 0) {
        logger.info('模板索引已刷新，使用 \'ac search\' 查看最新模板')
      }
      
    } catch (error: any) {
      logger.error('更新仓库失败', error)
      this.exit(1)
    }
  }
}
