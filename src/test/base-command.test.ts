/**
 * 基础命令类国际化测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BaseCommand } from '../base/base'
import { getCurrentLang, t } from '../i18n'

// 创建测试命令类
class TestCommand extends BaseCommand {
  static description = 'Test command for i18n'
  
  async run(): Promise<void> {
    // 测试翻译函数是否工作
    return Promise.resolve()
  }
  
  // 公开 init 方法用于测试
  public async testInit(): Promise<void> {
    await this.init()
  }
}

describe('BaseCommand I18n Integration', () => {
  let tempDir: string
  let command: TestCommand

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ac-test-'))
    command = new TestCommand([], {})
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should initialize i18n with project config language during command init', async () => {
    // 创建中文配置
    const configPath = join(tempDir, '.ac.yaml')
    const configContent = `
version: 1
repos: []
defaults:
  repo: ""
  dest: .
  mode: write
  lang: zh
`
    await writeFile(configPath, configContent)

    // 模拟在项目目录中执行命令
    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      await command.testInit()
      
      // 验证国际化已正确初始化为中文
      expect(getCurrentLang()).toBe('zh')
      expect(t('common.success')).toBe('成功')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('should initialize i18n with English when config specifies en', async () => {
    // 创建英文配置
    const configPath = join(tempDir, '.ac.yaml')
    const configContent = `
version: 1
repos: []
defaults:
  repo: ""
  dest: .
  mode: write
  lang: en
`
    await writeFile(configPath, configContent)

    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      await command.testInit()
      
      // 验证国际化已正确初始化为英文
      expect(getCurrentLang()).toBe('en')
      expect(t('common.success')).toBe('Success')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('should fallback to default language when config parsing fails', async () => {
    // 创建无效配置
    const configPath = join(tempDir, '.ac.yaml')
    const invalidContent = 'invalid: yaml: ['
    await writeFile(configPath, invalidContent)

    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      await command.testInit()
      
      // 应该回退到默认语言（通过系统环境或默认值）
      const lang = getCurrentLang()
      expect(['en', 'zh']).toContain(lang)
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('should use system language when no config file exists', async () => {
    // 不创建配置文件，在空目录中运行
    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      await command.testInit()
      
      // 应该使用默认的全局配置语言或系统语言
      const lang = getCurrentLang()
      expect(['en', 'zh']).toContain(lang)
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('should handle concurrent command initialization', async () => {
    // 测试多个命令同时初始化时的行为
    const configPath = join(tempDir, '.ac.yaml')
    const configContent = `
version: 1
repos: []
defaults:
  repo: ""
  dest: .
  mode: write
  lang: zh
`
    await writeFile(configPath, configContent)

    const originalCwd = process.cwd()
    process.chdir(tempDir)

    try {
      const command1 = new TestCommand([], {})
      const command2 = new TestCommand([], {})
      
      // 并发初始化
      await Promise.all([
        command1.testInit(),
        command2.testInit()
      ])
      
      // 两个命令都应该使用相同的语言设置
      expect(getCurrentLang()).toBe('zh')
    } finally {
      process.chdir(originalCwd)
    }
  })
})
