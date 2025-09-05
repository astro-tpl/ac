/**
 * Template service tests
 * Test template loading, parsing, validation and other functions
 */

import type { RepoConfig } from '@/types/config'
import type { ContextTemplate, PromptTemplate } from '@/types/template'
import { TemplateService } from '@/core/template.service'
import {
  RepoNotFoundError,
  TemplateNotFoundError,
  TemplateValidationError,
} from '@/types/errors'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock file system and configuration service
vi.mock('@/infra/fs', () => ({
  fileExists: vi.fn(),
  scanDirectory: vi.fn(),
}))

vi.mock('@/infra/yaml', () => ({
  readYamlFile: vi.fn(),
}))

vi.mock('@/core/config.service', () => ({
  configService: {
    resolveConfig: vi.fn(),
  },
}))

vi.mock('@/config/paths', () => ({
  getRepoPath: vi.fn(),
}))

vi.mock('@/infra/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

import { configService } from '@/core/config.service'
import { getRepoPath } from '@/config/paths'
import { fileExists, scanDirectory } from '@/infra/fs'
import { readYamlFile } from '@/infra/yaml'

// Test template data
const mockPromptTemplate: PromptTemplate = {
  content: 'You are a frontend expert, please review the following code',
  id: 'frontend-review-v1',
  labels: ['frontend', 'review', 'react'],
  name: 'Frontend Code Review',
  summary: 'React frontend code review prompt',
  type: 'prompt',
}

const mockContextTemplate: ContextTemplate = {
  id: 'cursor-rules-v1',
  labels: ['frontend', 'rules', 'cursor'],
  name: 'Cursor Basic Rules',
  summary: 'Cursor rules configuration for frontend projects',
  targets: [
    {
      content: '# Cursor Rules\n- Prohibit direct import of services',
      mode: 'write',
      path: '.cursor/rules.md',
    },
    {
      content_from_prompt: 'frontend-review-v1',
      mode: 'write',
      path: '.claude/prompt.md',
    },
  ],
  type: 'context',
}

const mockRepoConfig: RepoConfig = {
  branch: 'main',
  git: 'https://github.com/test/templates.git',
  name: 'templates',
  path: '/test/templates',
}

describe('TemplateService', () => {
  let templateService: TemplateService

  beforeEach(() => {
    templateService = new TemplateService()
    vi.clearAllMocks()
  })

  describe('Template loading functionality', () => {
    test('Successfully load Prompt template', async () => {
      // Mock configuration service
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      // Mock file system
      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(scanDirectory).mockResolvedValue(['/test/templates/prompt.yaml'])
      vi.mocked(readYamlFile).mockResolvedValue(mockPromptTemplate)

      const result = await templateService.loadTemplate('frontend-review-v1')

      expect(result).toEqual(mockPromptTemplate)
      expect(configService.resolveConfig).toHaveBeenCalledWith({ forceGlobal: false })
      expect(scanDirectory).toHaveBeenCalledWith('/test/templates', {
        extensions: ['.yaml', '.yml'],
        includeHidden: false,
        recursive: true,
      })
    })

    test('Successfully load Context template', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(scanDirectory).mockResolvedValue(['/test/templates/context.yaml'])
      vi.mocked(readYamlFile).mockResolvedValue(mockContextTemplate)

      const result = await templateService.loadTemplate('cursor-rules-v1')

      expect(result).toEqual(mockContextTemplate)
    })

    test('Load template from specified repository', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(scanDirectory).mockResolvedValue(['/test/templates/prompt.yaml'])
      vi.mocked(readYamlFile).mockResolvedValue(mockPromptTemplate)

      const result = await templateService.loadTemplate('frontend-review-v1', {
        repoName: 'templates',
      })

      expect(result).toEqual(mockPromptTemplate)
    })

    test('Throw error when template does not exist', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(scanDirectory).mockResolvedValue(['/test/templates/other.yaml'])
      vi.mocked(readYamlFile).mockResolvedValue({
        ...mockPromptTemplate,
        id: 'other-template',
      })

      await expect(
        templateService.loadTemplate('nonexistent-template')
      ).rejects.toThrow(TemplateNotFoundError)
    })

    test('Throw error when specified repository does not exist', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      await expect(
        templateService.loadTemplate('test-template', {
          repoName: 'nonexistent-repo',
        })
      ).rejects.toThrow(RepoNotFoundError)
    })

    test('Throw error when no repositories are configured', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      await expect(
        templateService.loadTemplate('test-template')
      ).rejects.toThrow(RepoNotFoundError)
    })

    test('仓库目录不存在时抛出模板未找到错误', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(false)

      // 当仓库目录不存在时，会在所有仓库中搜索失败，最终抛出模板未找到错误
      await expect(
        templateService.loadTemplate('test-template')
      ).rejects.toThrow(TemplateNotFoundError)
    })
  })

  describe('批量加载模板功能', () => {
    test('成功加载多个模板', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(scanDirectory).mockResolvedValue([
        '/test/templates/prompt.yaml',
        '/test/templates/context.yaml',
      ])

      // Mock 不同的模板文件
      vi.mocked(readYamlFile)
        .mockResolvedValueOnce(mockPromptTemplate)
        .mockResolvedValueOnce(mockContextTemplate)
        .mockResolvedValueOnce(mockPromptTemplate) // 第二次调用同一模板
        .mockResolvedValueOnce(mockContextTemplate)

      const result = await templateService.loadTemplates([
        'frontend-review-v1',
        'cursor-rules-v1',
      ])

      expect(result.templates).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
      expect(result.templates[0]).toEqual(mockPromptTemplate)
      expect(result.templates[1]).toEqual(mockContextTemplate)
    })

    test('部分模板加载失败时继续加载其他模板', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(scanDirectory).mockResolvedValue(['/test/templates/prompt.yaml'])
      
      // 只能找到一个模板
      vi.mocked(readYamlFile).mockResolvedValue(mockPromptTemplate)

      const result = await templateService.loadTemplates([
        'frontend-review-v1',
        'nonexistent-template',
      ])

      expect(result.templates).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
      expect(result.templates[0]).toEqual(mockPromptTemplate)
      expect(result.errors[0].id).toBe('nonexistent-template')
    })

    test('设置 continueOnError=false 时遇到错误停止加载', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      await expect(
        templateService.loadTemplates(
          ['template1', 'template2'],
          { continueOnError: false }
        )
      ).rejects.toThrow(RepoNotFoundError)
    })
  })

  describe('仓库模板加载功能', () => {
    test('加载指定仓库的所有模板', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(scanDirectory).mockResolvedValue([
        '/test/templates/prompt.yaml',
        '/test/templates/context.yaml',
      ])

      vi.mocked(readYamlFile)
        .mockResolvedValueOnce(mockPromptTemplate)
        .mockResolvedValueOnce(mockContextTemplate)

      const result = await templateService.loadAllTemplatesFromRepo('templates')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(mockPromptTemplate)
      expect(result[1]).toEqual(mockContextTemplate)
    })

    test('直接加载不存在仓库的模板时抛出仓库未找到错误', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(false)

      await expect(
        templateService.loadAllTemplatesFromRepo('templates')
      ).rejects.toThrow(RepoNotFoundError)
    })
  })

  describe('模板验证功能', () => {
    test('验证有效的 Prompt 模板', () => {
      expect(() => {
        templateService.validateTemplateStructure(mockPromptTemplate)
      }).not.toThrow()
    })

    test('验证有效的 Context 模板', () => {
      expect(() => {
        templateService.validateTemplateStructure(mockContextTemplate)
      }).not.toThrow()
    })

    test('缺少必要字段时验证失败', () => {
      const invalidTemplate = {
        ...mockPromptTemplate,
        id: undefined,
      }

      expect(() => {
        templateService.validateTemplateStructure(invalidTemplate)
      }).toThrow(TemplateValidationError)
    })

    test('无效的模板类型时验证失败', () => {
      const invalidTemplate = {
        ...mockPromptTemplate,
        type: 'invalid-type',
      }

      expect(() => {
        templateService.validateTemplateStructure(invalidTemplate)
      }).toThrow(TemplateValidationError)
    })

    test('Prompt 模板缺少 content 字段时验证失败', () => {
      const invalidTemplate = {
        ...mockPromptTemplate,
        content: undefined,
      }

      expect(() => {
        templateService.validateTemplateStructure(invalidTemplate)
      }).toThrow(TemplateValidationError)
    })

    test('Context 模板缺少 targets 字段时验证失败', () => {
      const invalidTemplate = {
        ...mockContextTemplate,
        targets: undefined,
      }

      expect(() => {
        templateService.validateTemplateStructure(invalidTemplate)
      }).toThrow(TemplateValidationError)
    })

    test('Context 模板 targets 为空数组时验证失败', () => {
      const invalidTemplate = {
        ...mockContextTemplate,
        targets: [],
      }

      expect(() => {
        templateService.validateTemplateStructure(invalidTemplate)
      }).toThrow(TemplateValidationError)
    })

    test('Context 模板 target 缺少 path 字段时验证失败', () => {
      const invalidTemplate = {
        ...mockContextTemplate,
        targets: [
          {
            content: 'test',
            mode: 'write',
          },
        ],
      }

      expect(() => {
        templateService.validateTemplateStructure(invalidTemplate)
      }).toThrow(TemplateValidationError)
    })

    test('Context 模板 target 既没有 content 也没有 content_from_prompt 时验证失败', () => {
      const invalidTemplate = {
        ...mockContextTemplate,
        targets: [
          {
            mode: 'write',
            path: 'test.md',
          },
        ],
      }

      expect(() => {
        templateService.validateTemplateStructure(invalidTemplate)
      }).toThrow(TemplateValidationError)
    })
  })

  describe('工具函数', () => {
    test('获取模板摘要信息', () => {
      const promptSummary = templateService.getTemplateSummary(mockPromptTemplate)
      
      expect(promptSummary).toEqual({
        id: mockPromptTemplate.id,
        labels: mockPromptTemplate.labels,
        name: mockPromptTemplate.name,
        summary: mockPromptTemplate.summary,
        type: mockPromptTemplate.type,
      })

      const contextSummary = templateService.getTemplateSummary(mockContextTemplate)
      
      expect(contextSummary).toEqual({
        id: mockContextTemplate.id,
        labels: mockContextTemplate.labels,
        name: mockContextTemplate.name,
        summary: mockContextTemplate.summary,
        targetCount: mockContextTemplate.targets.length,
        type: mockContextTemplate.type,
      })
    })

    test('检查模板标签匹配', () => {
      // 匹配任意标签
      expect(
        templateService.templateMatchesLabels(mockPromptTemplate, ['frontend'])
      ).toBe(true)
      
      expect(
        templateService.templateMatchesLabels(mockPromptTemplate, ['backend'])
      ).toBe(false)

      // 匹配所有标签
      expect(
        templateService.templateMatchesLabels(
          mockPromptTemplate,
          ['frontend', 'react'],
          true
        )
      ).toBe(true)

      expect(
        templateService.templateMatchesLabels(
          mockPromptTemplate,
          ['frontend', 'vue'],
          true
        )
      ).toBe(false)

      // 空标签列表应该总是返回 true
      expect(
        templateService.templateMatchesLabels(mockPromptTemplate, [])
      ).toBe(true)
    })

    test('按类型过滤模板', () => {
      const templates = [mockPromptTemplate, mockContextTemplate]

      const promptTemplates = templateService.filterTemplatesByType(templates, 'prompt')
      expect(promptTemplates).toHaveLength(1)
      expect(promptTemplates[0]).toEqual(mockPromptTemplate)

      const contextTemplates = templateService.filterTemplatesByType(templates, 'context')
      expect(contextTemplates).toHaveLength(1)
      expect(contextTemplates[0]).toEqual(mockContextTemplate)

      const allTemplates = templateService.filterTemplatesByType(templates)
      expect(allTemplates).toHaveLength(2)
    })
  })

  describe('错误处理和边界情况', () => {
    test('处理无效的 YAML 文件', async () => {
      vi.mocked(configService.resolveConfig).mockResolvedValue({
        config: {
          repos: [mockRepoConfig],
        },
        path: '/test/.ac.yaml',
        source: 'project',
      })

      vi.mocked(getRepoPath).mockReturnValue('/test/templates')
      vi.mocked(fileExists).mockResolvedValue(true)
      vi.mocked(scanDirectory).mockResolvedValue(['/test/templates/invalid.yaml'])
      vi.mocked(readYamlFile).mockRejectedValue(new Error('Invalid YAML'))

      await expect(
        templateService.loadTemplate('test-template')
      ).rejects.toThrow(TemplateNotFoundError)
    })

    test('处理不完整的模板对象', () => {
      const incompleteTemplate = {
        id: 'test',
        type: 'prompt',
        // 缺少其他必要字段
      }

      expect(() => {
        templateService.validateTemplateStructure(incompleteTemplate)
      }).toThrow(TemplateValidationError)
    })

    test('处理空的标签列表', () => {
      const templateWithoutLabels = {
        ...mockPromptTemplate,
        labels: undefined,
      }

      expect(() => {
        templateService.validateTemplateStructure(templateWithoutLabels)
      }).not.toThrow()
    })
  })
})
