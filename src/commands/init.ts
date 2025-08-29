/**
 * Init 命令 - 创建项目配置文件
 */

import { Flags } from '@oclif/core'
import { BaseCommand } from './base'
import { join } from 'node:path'
import { writeYamlFile } from '../infra/yaml'
import { fileExists } from '../infra/fs'
import { logger } from '../infra/logger'
import { t } from '../i18n'
import { DEFAULT_CONFIG, PROJECT_CONFIG_FILENAME, DEFAULT_TEST_REPO, DEFAULT_BRANCH } from '../config/constants'
import { inferRepoAlias, normalizePath } from '../config/paths'
import { normalizeGitUrl, isValidGitUrl } from '../infra/git'
import { ProjectConfig, RepoConfig } from '../types/config'
import { ConfigValidationError } from '../types/errors'

export default class Init extends BaseCommand {
  static override description = '在当前目录生成 .ac.yaml 项目配置文件'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --repo https://github.com/astro-tpl/ac-tpl.git',
    '<%= config.bin %> <%= command.id %> --repo astro-tpl/ac-tpl --name templates',
    '<%= config.bin %> <%= command.id %> --force'
  ]

  static override flags = {
    repo: Flags.string({
      description: '默认模板仓库 URL',
      helpValue: 'https://github.com/astro-tpl/ac-tpl.git'
    }),
    name: Flags.string({
      description: '仓库别名',
      helpValue: 'templates'
    }),
    branch: Flags.string({
      description: '分支名',
      default: DEFAULT_BRANCH
    }),
    force: Flags.boolean({
      description: '强制覆盖已存在的配置文件',
      default: false
    })
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init)
    
    const configPath = join(process.cwd(), PROJECT_CONFIG_FILENAME)
    
    // 检查配置文件是否已存在
    if (await fileExists(configPath) && !flags.force) {
      throw new ConfigValidationError(
        t('init.exists', { path: configPath })
      )
    }
    
    // 创建基础配置
    const config: ProjectConfig = {
      ...DEFAULT_CONFIG,
      repos: []
    }
    
    // 如果提供了仓库 URL，添加到配置中
    if (flags.repo) {
      if (!isValidGitUrl(flags.repo)) {
        throw new ConfigValidationError(
          t('error.git.invalid_url', { url: flags.repo })
        )
      }
      
      const normalizedUrl = normalizeGitUrl(flags.repo)
      const repoName = flags.name || inferRepoAlias(normalizedUrl)
      
      const repoConfig: RepoConfig = {
        name: repoName,
        git: normalizedUrl,
        branch: flags.branch
      }
      
      config.repos.push(repoConfig)
      config.defaults.repo = repoName
    }
    
    try {
      await writeYamlFile(configPath, config)
      
      logger.success(t('init.success', { path: configPath }))
      
      if (config.repos.length > 0) {
        logger.info(t('init.repo.added', { 
          name: config.repos[0].name, 
          url: config.repos[0].git 
        }))
        logger.info(t('init.next.list'))
        logger.info(t('init.next.add'))
      } else {
        logger.info(t('init.repo.suggest', { url: DEFAULT_TEST_REPO }))
      }
      
    } catch (error: any) {
      logger.error(t('apply.failed', { error: error.message }), error)
      throw error
    }
  }
}
