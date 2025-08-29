/**
 * 模板服务 - 加载、解析和管理模板
 */

import { readYamlFile } from '../infra/yaml'
import { fileExists, scanDirectory } from '../infra/fs'
import { getRepoPath } from '../config/paths'
import { configService } from './config.service'
import { 
  Template, 
  PromptTemplate, 
  ContextTemplate, 
  TemplateHeader
} from '../types/template'
import { RepoConfig } from '../types/config'
import { 
  TemplateNotFoundError, 
  TemplateValidationError,
  RepoNotFoundError 
} from '../types/errors'
import { logger } from '../infra/logger'

/**
 * 模板服务类
 */
export class TemplateService {
  /**
   * 根据 ID 加载模板
   */
  async loadTemplate(
    templateId: string, 
    options: {
      repoName?: string
      forceGlobal?: boolean
    } = {}
  ): Promise<Template> {
    const { repoName, forceGlobal = false } = options
    
    // 解析配置
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    
    // 确定搜索的仓库
    let repos: RepoConfig[]
    if (repoName) {
      const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
      if (!repo) {
        throw new RepoNotFoundError(`仓库不存在: ${repoName}`)
      }
      repos = [repo]
    } else {
      repos = resolvedConfig.config.repos
    }
    
    if (repos.length === 0) {
      throw new RepoNotFoundError('没有配置任何仓库')
    }
    
    // 在所有仓库中搜索模板
    for (const repo of repos) {
      try {
        const template = await this.findTemplateInRepo(templateId, repo)
        if (template) {
          logger.debug(`找到模板 ${templateId} 在仓库 ${repo.name}`)
          return template
        }
      } catch (error: any) {
        logger.debug(`在仓库 ${repo.name} 中搜索模板失败: ${error.message}`)
      }
    }
    
    throw new TemplateNotFoundError(
      `模板不存在: ${templateId}。使用 'ac search' 查找可用模板`
    )
  }
  
  /**
   * 在指定仓库中查找模板
   */
  private async findTemplateInRepo(
    templateId: string, 
    repo: RepoConfig
  ): Promise<Template | null> {
    const repoPath = getRepoPath(repo.name)
    
    if (!await fileExists(repoPath)) {
      throw new RepoNotFoundError(`仓库本地目录不存在: ${repoPath}`)
    }
    
    // 扫描所有 YAML 文件
    const yamlFiles = await scanDirectory(repoPath, {
      extensions: ['.yaml', '.yml'],
      recursive: true,
      includeHidden: false
    })
    
    // 逐个检查文件
    for (const filePath of yamlFiles) {
      try {
        const template = await readYamlFile<Template>(filePath)
        
        // 验证模板格式
        if (this.isValidTemplate(template) && template.id === templateId) {
          return template
        }
      } catch (error: any) {
        // 忽略无法解析的文件，继续搜索
        logger.debug(`跳过无效模板文件: ${filePath}`)
      }
    }
    
    return null
  }
  
  /**
   * 加载多个模板
   */
  async loadTemplates(
    templateIds: string[],
    options: {
      repoName?: string
      forceGlobal?: boolean
      continueOnError?: boolean
    } = {}
  ): Promise<{
    templates: Template[]
    errors: Array<{ id: string; error: string }>
  }> {
    const { continueOnError = true } = options
    const templates: Template[] = []
    const errors: Array<{ id: string; error: string }> = []
    
    for (const templateId of templateIds) {
      try {
        const template = await this.loadTemplate(templateId, options)
        templates.push(template)
      } catch (error: any) {
        errors.push({ id: templateId, error: error.message })
        
        if (!continueOnError) {
          throw error
        }
      }
    }
    
    return { templates, errors }
  }
  
  /**
   * 根据仓库加载所有模板
   */
  async loadAllTemplatesFromRepo(repoName: string): Promise<Template[]> {
    const resolvedConfig = await configService.resolveConfig()
    const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
    
    if (!repo) {
      throw new RepoNotFoundError(`仓库不存在: ${repoName}`)
    }
    
    const repoPath = getRepoPath(repo.name)
    
    if (!await fileExists(repoPath)) {
      throw new RepoNotFoundError(`仓库本地目录不存在: ${repoPath}`)
    }
    
    const templates: Template[] = []
    
    // 扫描所有 YAML 文件
    const yamlFiles = await scanDirectory(repoPath, {
      extensions: ['.yaml', '.yml'],
      recursive: true,
      includeHidden: false
    })
    
    for (const filePath of yamlFiles) {
      try {
        const template = await readYamlFile<Template>(filePath)
        
        if (this.isValidTemplate(template)) {
          templates.push(template)
        }
      } catch (error: any) {
        logger.debug(`跳过无效模板文件: ${filePath}`)
      }
    }
    
    return templates
  }
  
  /**
   * 验证模板格式
   */
  private isValidTemplate(template: any): template is Template {
    try {
      this.validateTemplateStructure(template)
      return true
    } catch {
      return false
    }
  }
  
  /**
   * 严格验证模板结构
   */
  validateTemplateStructure(template: any): void {
    // 检查基本字段
    if (!template || typeof template !== 'object') {
      throw new TemplateValidationError('模板必须是一个对象')
    }
    
    if (!template.id || typeof template.id !== 'string') {
      throw new TemplateValidationError('模板缺少有效的 id 字段')
    }
    
    if (!template.type || !['prompt', 'context'].includes(template.type)) {
      throw new TemplateValidationError('模板 type 必须是 prompt 或 context')
    }
    
    if (!template.name || typeof template.name !== 'string') {
      throw new TemplateValidationError('模板缺少有效的 name 字段')
    }
    
    // 验证标签（可选）
    if (template.labels && !Array.isArray(template.labels)) {
      throw new TemplateValidationError('模板 labels 必须是数组')
    }
    
    // 根据类型进行特定验证
    if (template.type === 'prompt') {
      this.validatePromptTemplate(template)
    } else if (template.type === 'context') {
      this.validateContextTemplate(template)
    }
  }
  
  /**
   * 验证 Prompt 模板
   */
  private validatePromptTemplate(template: any): void {
    if (!template.content || typeof template.content !== 'string') {
      throw new TemplateValidationError('Prompt 模板缺少有效的 content 字段')
    }
  }
  
  /**
   * 验证 Context 模板
   */
  private validateContextTemplate(template: any): void {
    if (!template.targets || !Array.isArray(template.targets)) {
      throw new TemplateValidationError('Context 模板缺少有效的 targets 字段')
    }
    
    if (template.targets.length === 0) {
      throw new TemplateValidationError('Context 模板至少需要一个 target')
    }
    
    for (let i = 0; i < template.targets.length; i++) {
      const target = template.targets[i]
      
      if (!target.path || typeof target.path !== 'string') {
        throw new TemplateValidationError(`Target ${i + 1} 缺少有效的 path 字段`)
      }
      
      if (target.mode && !['write', 'append', 'merge'].includes(target.mode)) {
        throw new TemplateValidationError(`Target ${i + 1} 的 mode 必须是 write, append 或 merge`)
      }
      
      // 检查内容来源
      const hasContent = target.content && typeof target.content === 'string'
      const hasPromptRef = target.content_from_prompt && typeof target.content_from_prompt === 'string'
      
      if (!hasContent && !hasPromptRef) {
        throw new TemplateValidationError(`Target ${i + 1} 必须提供 content 或 content_from_prompt`)
      }
      
      // 验证内容顺序
      if (target.content_order && !['content-first', 'prompt-first'].includes(target.content_order)) {
        throw new TemplateValidationError(`Target ${i + 1} 的 content_order 必须是 content-first 或 prompt-first`)
      }
    }
  }
  
  /**
   * 获取模板摘要信息
   */
  getTemplateSummary(template: Template): {
    id: string
    type: string
    name: string
    labels: string[]
    summary: string
    targetCount?: number
  } {
    const summary = {
      id: template.id,
      type: template.type,
      name: template.name,
      labels: template.labels || [],
      summary: template.summary || ''
    }
    
    if (template.type === 'context') {
      return {
        ...summary,
        targetCount: (template as ContextTemplate).targets.length
      }
    }
    
    return summary
  }
  
  /**
   * 检查模板是否匹配标签
   */
  templateMatchesLabels(template: Template, labels: string[], matchAll = false): boolean {
    if (!labels.length) return true
    if (!template.labels?.length) return false
    
    const templateLabels = template.labels.map(l => l.toLowerCase())
    const searchLabels = labels.map(l => l.toLowerCase())
    
    if (matchAll) {
      return searchLabels.every(label => templateLabels.includes(label))
    } else {
      return searchLabels.some(label => templateLabels.includes(label))
    }
  }
  
  /**
   * 按类型过滤模板
   */
  filterTemplatesByType(templates: Template[], type?: 'prompt' | 'context'): Template[] {
    if (!type) return templates
    return templates.filter(t => t.type === type)
  }
}

// 全局模板服务实例
export const templateService = new TemplateService()
