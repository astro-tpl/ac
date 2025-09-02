/**
 * Repo List Command - List all repositories
 */

import { Flags } from '@oclif/core'
import { BaseCommand } from '../../base/base'
import { repoService } from '../../core/repo.service'
import { logger } from '../../infra/logger'
import { t } from '../../i18n'

export default class RepoList extends BaseCommand {
  static override description = t('commands.repo.list.description')
  


  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --status',
    '<%= config.bin %> <%= command.id %> --global'
  ]

  static override flags = {
    global: Flags.boolean({
      description: t('commands.repo.list.flags.global'),
      default: false
    }),
    status: Flags.boolean({
      description: t('commands.repo.list.flags.status'),
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
        logger.info(t('repo.list.no_repos'))
        logger.info(t('repo.list.add_help'))
        return
      }
      
      logger.info(`${t('repo.list.config_source')}: ${result.configSource === 'project' ? t('config.source.project') : t('config.source.global')}`)
      logger.info(`${t('repo.list.config_file')}: ${result.configPath}`)
      logger.info(`${t('repo.list.repo_count')}: ${result.repos.length}`)
      logger.info('')
      
      for (const repo of result.repos) {
        logger.plain(`📦 ${repo.name}`)
        logger.plain(`   ${t('repo.add.info.url')}: ${repo.git}`)
        logger.plain(`   ${t('repo.add.info.branch')}: ${repo.branch}`)
        logger.plain(`   ${t('repo.add.info.path')}: ${repo.localPath}`)
        
        if (flags.status && repo.status) {
          const status = repo.status.exists 
            ? (repo.status.isValid ? t('repo.list.status.normal') : t('repo.list.status.invalid')) 
            : t('repo.list.status.not_exists')
          logger.plain(`   ${t('common.status')}: ${status}`)
          
          if (repo.status.currentBranch) {
            logger.plain(`   ${t('repo.list.current_branch')}: ${repo.status.currentBranch}`)
          }
          
          if (repo.status.lastCommit) {
            const commit = repo.status.lastCommit
            logger.plain(`   ${t('repo.list.last_commit')}: ${commit.hash.slice(0, 8)} (${commit.date.toLocaleDateString()})`)
            logger.plain(`   ${t('repo.list.commit_message')}: ${commit.message}`)
            logger.plain(`   ${t('repo.list.author')}: ${commit.author}`)
          }
          
          if (repo.status.hasUncommittedChanges) {
            logger.plain(`   ${t('repo.list.uncommitted_changes')}`)
          }
        }
        
        logger.plain('')
      }
      
      if (!flags.status) {
        logger.info(t('repo.list.status_help'))
      }
      
    } catch (error: any) {
      logger.error(t('repo.list.failed'), error)
      this.exit(1)
    }
  }
}
