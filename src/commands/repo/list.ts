/**
 * Repo List 命令 - 列出所有仓库
 */

import { Command, Flags } from '@oclif/core'
import { repoService } from '../../core/repo.service'
import { logger } from '../../infra/logger'

export default class RepoList extends Command {
  static override description = '列出当前有效配置中的仓库'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --status',
    '<%= config.bin %> <%= command.id %> --global'
  ]

  static override flags = {
    global: Flags.boolean({
      description: '列出全局配置中的仓库',
      default: false
    }),
    status: Flags.boolean({
      description: '显示仓库状态信息',
      default: false
    })
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(RepoList)
    
    try {
      const result = await repoService.listRepos({
        forceGlobal: flags.global,
        includeStatus: flags.status
      })
      
      if (result.repos.length === 0) {
        logger.info('没有配置任何仓库')
        logger.info('使用 \'ac repo add <git-url>\' 添加仓库')
        return
      }
      
      logger.info(`配置来源: ${result.configSource === 'project' ? '项目配置' : '全局配置'}`)
      logger.info(`配置文件: ${result.configPath}`)
      logger.info(`仓库数量: ${result.repos.length}`)
      logger.info('')
      
      for (const repo of result.repos) {
        logger.plain(`📦 ${repo.name}`)
        logger.plain(`   URL: ${repo.git}`)
        logger.plain(`   分支: ${repo.branch}`)
        logger.plain(`   路径: ${repo.localPath}`)
        
        if (flags.status && repo.status) {
          const status = repo.status.exists 
            ? (repo.status.isValid ? '✅ 正常' : '❌ 无效') 
            : '❌ 不存在'
          logger.plain(`   状态: ${status}`)
          
          if (repo.status.currentBranch) {
            logger.plain(`   当前分支: ${repo.status.currentBranch}`)
          }
          
          if (repo.status.lastCommit) {
            const commit = repo.status.lastCommit
            logger.plain(`   最新提交: ${commit.hash.slice(0, 8)} (${commit.date.toLocaleDateString()})`)
            logger.plain(`   提交信息: ${commit.message}`)
            logger.plain(`   作者: ${commit.author}`)
          }
          
          if (repo.status.hasUncommittedChanges) {
            logger.plain(`   ⚠️  有未提交的更改`)
          }
        }
        
        logger.plain('')
      }
      
      if (!flags.status) {
        logger.info('使用 --status 显示详细状态信息')
      }
      
    } catch (error: any) {
      logger.error('列出仓库失败', error)
      this.exit(1)
    }
  }
}
