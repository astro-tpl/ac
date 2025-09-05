/**
 * Init command - Create project configuration file
 */

import {Flags} from '@oclif/core'
import {join} from 'node:path'

import {BaseCommand} from '../base/base'
import {
  DEFAULT_BRANCH, DEFAULT_CONFIG, DEFAULT_TEST_REPO, PROJECT_CONFIG_FILENAME,
} from '../config/constants'
import {inferRepoAlias, normalizePath} from '../config/paths'
import {t} from '../i18n'
import {fileExists} from '../infra/fs'
import {isValidGitUrl, normalizeGitUrl} from '../infra/git'
import {logger} from '../infra/logger'
import {writeYamlFile} from '../infra/yaml'
import {ProjectConfig, RepoConfig} from '../types/config'
import {ConfigValidationError} from '../types/errors'

export default class Init extends BaseCommand {
  static override description = t('commands.init.description')

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --repo https://github.com/astro-tpl/ac-tpl.git',
    '<%= config.bin %> <%= command.id %> --repo astro-tpl/ac-tpl --name templates',
    '<%= config.bin %> <%= command.id %> --force',
  ]

  static override flags = {
    branch: Flags.string({
      default: DEFAULT_BRANCH,
      description: t('commands.init.flags.branch'),
    }),
    force: Flags.boolean({
      default: false,
      description: t('commands.init.flags.force'),
    }),
    name: Flags.string({
      description: t('commands.init.flags.name'),
      helpValue: 'templates',
    }),
    repo: Flags.string({
      description: t('commands.init.flags.repo'),
      helpValue: 'https://github.com/astro-tpl/ac-tpl.git',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Init)

    const configPath = join(process.cwd(), PROJECT_CONFIG_FILENAME)

    // Check if configuration file already exists
    if (await fileExists(configPath) && !flags.force) {
      throw new ConfigValidationError(
        t('init.exists', {path: configPath}),
      )
    }

    // Create basic configuration
    const config: ProjectConfig = {
      ...DEFAULT_CONFIG,
      repos: [],
    }

    // If repository URL provided, add to configuration
    if (flags.repo) {
      if (!isValidGitUrl(flags.repo)) {
        throw new ConfigValidationError(
          t('error.git.invalid_url', {url: flags.repo}),
        )
      }

      const normalizedUrl = normalizeGitUrl(flags.repo)
      const repoName = flags.name || inferRepoAlias(normalizedUrl)

      const repoConfig: RepoConfig = {
        branch: flags.branch,
        git: normalizedUrl,
        name: repoName,
      }

      config.repos.push(repoConfig)
      config.defaults.repo = repoName
    }

    try {
      await writeYamlFile(configPath, config)

      logger.success(t('init.success', {path: configPath}))

      if (config.repos.length > 0) {
        logger.info(t('init.repo.added', {
          name: config.repos[0].name,
          url: config.repos[0].git,
        }))
        logger.info(t('init.next.list'))
        logger.info(t('init.next.add'))
      } else {
        logger.info(t('init.repo.suggest', {url: DEFAULT_TEST_REPO}))
      }
    } catch (error: any) {
      logger.error(t('apply.failed', {error: error.message}), error)
      throw error
    }
  }
}
