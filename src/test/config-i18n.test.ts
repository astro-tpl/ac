/**
 * 配置服务国际化集成测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { configService } from '../core/config.service'
import { getCurrentLang, t } from '../i18n'

describe('Config Service I18n Integration', () => {
  let tempDir: string

  beforeEach(async () => {
    // 创建临时目录
    tempDir = await mkdtemp(join(tmpdir(), 'ac-test-'))
  })

  afterEach(async () => {
    // 清理临时目录
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should initialize i18n with project config language', async () => {
    // 创建项目配置文件
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

    // 解析配置（这应该会初始化国际化）
    const resolved = await configService.resolveConfig({ startDir: tempDir })
    
    expect(resolved.config.defaults.lang).toBe('zh')
    expect(resolved.source).toBe('project')
  })

  it('should handle English configuration', async () => {
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

    const resolved = await configService.resolveConfig({ startDir: tempDir })
    
    expect(resolved.config.defaults.lang).toBe('en')
    expect(resolved.source).toBe('project')
  })

  it('should fallback to global config when project config is missing', async () => {
    // 不创建项目配置，应该回退到全局配置
    const resolved = await configService.resolveConfig({ startDir: tempDir })
    
    // 全局配置默认语言应该是 en（因为我们手动设置了）
    expect(resolved.config.defaults.lang).toBe('en')
    expect(resolved.source).toBe('global')
  })

  it('should handle invalid project config gracefully', async () => {
    // 创建无效的配置文件
    const configPath = join(tempDir, '.ac.yaml')
    const invalidContent = 'invalid: yaml: content: ['
    await writeFile(configPath, invalidContent)

    // 应该回退到全局配置
    const resolved = await configService.resolveConfig({ startDir: tempDir })
    
    expect(resolved.source).toBe('global')
    expect(resolved.config.defaults.lang).toBe('en')
  })

  it('should respect forceGlobal option', async () => {
    // 创建项目配置
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

    // 强制使用全局配置
    const resolved = await configService.resolveConfig({ 
      startDir: tempDir, 
      forceGlobal: true 
    })
    
    expect(resolved.source).toBe('global')
    expect(resolved.config.defaults.lang).toBe('en') // 全局配置的默认语言
  })
})
