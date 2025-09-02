/**
 * 基础命令类 - 确保国际化系统在命令执行前正确初始化
 */

import { Command } from '@oclif/core'
import { configService } from '../core/config.service'
import { initI18n } from '../i18n'

export abstract class BaseCommand extends Command {
  /**
   * 在命令执行前初始化国际化系统
   */
  async init(): Promise<void> {
    await super.init()
    
    try {
      // 尝试解析配置并初始化国际化
      const resolvedConfig = await configService.resolveConfig()
      initI18n(resolvedConfig.config.defaults.lang)
    } catch (error) {
      // 如果配置解析失败，使用默认语言
      initI18n()
    }
  }
}
