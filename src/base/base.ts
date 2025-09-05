/**
 * Base command class - Ensure internationalization system is properly initialized before command execution
 */

import {Command} from '@oclif/core'

import {configService} from '../core/config.service'
import {initI18n} from '../i18n'

export abstract class BaseCommand extends Command {
  /**
   * Initialize internationalization system before command execution
   */
  async init(): Promise<void> {
    await super.init()

    try {
      // Try to parse configuration and initialize internationalization
      const resolvedConfig = await configService.resolveConfig()
      initI18n(resolvedConfig.config.defaults.lang)
    } catch {
      // If configuration parsing fails, use default language
      initI18n()
    }
  }
}
