/**
 * Init 命令 - 创建项目配置文件
 */

import { Command, Flags } from '@oclif/core'
import { join } from 'node:path'
import { writeYamlFile } from '../infra/yaml'
import { fileExists } from '../infra/fs'
import { logger } from '../infra/logger'
import { DEFAULT_CONFIG, PROJECT_CONFIG_FILENAME, DEFAULT_TEST_REPO, DEFAULT_BRANCH } from '../config/constants'
import { inferRepoAlias, normalizePath } from '../config/paths'
import { normalizeGitUrl, isValidGitUrl } from '../infra/git'
import { ProjectConfig, RepoConfig } from '../types/config'
import { ConfigValidationError } from '../types/errors'

export default class Init extends Command {
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
        `配置文件已存在: ${configPath}。使用 --force 强制覆盖`
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
          `无效的 Git URL: ${flags.repo}`
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
      
      logger.success(`配置文件已创建: ${configPath}`)
      
      if (config.repos.length > 0) {
        logger.info(`已添加默认仓库: ${config.repos[0].name} (${config.repos[0].git})`)
        logger.info(`使用 'ac repo list' 查看仓库列表`)
        logger.info(`使用 'ac repo add <git-url>' 添加更多仓库`)
      } else {
        logger.info(`使用 'ac repo add ${DEFAULT_TEST_REPO}' 添加默认测试仓库`)
      }
      
    } catch (error: any) {
      logger.error('创建配置文件失败', error)
      throw error
    }
  }
}
