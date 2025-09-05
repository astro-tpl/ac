/**
 * Template Service - Load, parse and manage templates
 */

import { readYamlFile } from '../infra/yaml'
import { fileExists, scanDirectory } from '../infra/fs'
import { getRepoPath } from '../config/paths'
import { configService } from './config.service'
import { t } from '../i18n'
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
 * Template Service Class
 */
export class TemplateService {
  /**
   * Load template by ID
   */
  async loadTemplate(
    templateId: string, 
    options: {
      repoName?: string
      forceGlobal?: boolean
    } = {}
  ): Promise<Template> {
    const { repoName, forceGlobal = false } = options
    
    // Parse configuration
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    
    // Determine repositories to search
    let repos: RepoConfig[]
    if (repoName) {
      const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
      if (!repo) {
        throw new RepoNotFoundError(t('template.error.repo_not_found', { name: repoName }))
      }
      repos = [repo]
    } else {
      repos = resolvedConfig.config.repos
    }
    
    if (repos.length === 0) {
      throw new RepoNotFoundError(t('template.error.no_repos_configured'))
    }
    
    // Search template in all repositories
    for (const repo of repos) {
      try {
        const template = await this.findTemplateInRepo(templateId, repo)
        if (template) {
          logger.debug(t('template.debug.found_template', { id: templateId, repo: repo.name }))
          return template
        }
      } catch (error: any) {
        logger.debug(t('template.debug.search_failed', { repo: repo.name, error: error.message }))
      }
    }
    
    throw new TemplateNotFoundError(
      t('template.error.template_not_found', { id: templateId })
    )
  }
  
  /**
   * Find template in specified repository
   */
  private async findTemplateInRepo(
    templateId: string, 
    repo: RepoConfig
  ): Promise<Template | null> {
    const repoPath = getRepoPath(repo.name)
    
    if (!await fileExists(repoPath)) {
      throw new RepoNotFoundError(t('template.error.repo_local_not_exists', { path: repoPath }))
    }
    
    // Scan all YAML files
    const yamlFiles = await scanDirectory(repoPath, {
      extensions: ['.yaml', '.yml'],
      recursive: true,
      includeHidden: false
    })
    
    // Check files one by one
    for (const filePath of yamlFiles) {
      try {
        const template = await readYamlFile<Template>(filePath)
        
        // Validate template format
        if (this.isValidTemplate(template) && template.id === templateId) {
          return template
        }
      } catch (error: any) {
        // Ignore unparseable files, continue search
        logger.debug(t('template.debug.skip_invalid_file', { file: filePath }))
      }
    }
    
    return null
  }
  
  /**
   * Load multiple templates
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
   * Load all templates by repository
   */
  async loadAllTemplatesFromRepo(repoName: string): Promise<Template[]> {
    const resolvedConfig = await configService.resolveConfig()
    const repo = resolvedConfig.config.repos.find(r => r.name === repoName)
    
    if (!repo) {
      throw new RepoNotFoundError(t('template.error.repo_not_found', { name: repoName }))
    }
    
    const repoPath = getRepoPath(repo.name)
    
    if (!await fileExists(repoPath)) {
      throw new RepoNotFoundError(t('template.error.repo_local_not_exists', { path: repoPath }))
    }
    
    const templates: Template[] = []
    
    // Scan all YAML files
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
        logger.debug(t('template.debug.skip_invalid_file', { file: filePath }))
      }
    }
    
    return templates
  }
  
  /**
   * Validate template format
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
   * Strictly validate template structure
   */
  validateTemplateStructure(template: any): void {
    // Check basic fields
    if (!template || typeof template !== 'object') {
      throw new TemplateValidationError(t('template.validation.must_be_object'))
    }
    
    if (!template.id || typeof template.id !== 'string') {
      throw new TemplateValidationError(t('template.validation.missing_valid_id'))
    }
    
    if (!template.type || !['prompt', 'context'].includes(template.type)) {
      throw new TemplateValidationError(t('template.validation.invalid_type'))
    }
    
    if (!template.name || typeof template.name !== 'string') {
      throw new TemplateValidationError(t('template.validation.missing_valid_name'))
    }
    
    // Validate labels (optional)
    if (template.labels && !Array.isArray(template.labels)) {
      throw new TemplateValidationError(t('template.validation.labels_must_be_array'))
    }
    
    // Perform type-specific validation
    if (template.type === 'prompt') {
      this.validatePromptTemplate(template)
    } else if (template.type === 'context') {
      this.validateContextTemplate(template)
    }
  }
  
  /**
   * Validate Prompt template
   */
  private validatePromptTemplate(template: any): void {
    if (!template.content || typeof template.content !== 'string') {
      throw new TemplateValidationError(t('template.validation.prompt_missing_content'))
    }
  }
  
  /**
   * Validate Context template
   */
  private validateContextTemplate(template: any): void {
    if (!template.targets || !Array.isArray(template.targets)) {
      throw new TemplateValidationError(t('template.validation.context_missing_targets'))
    }
    
    if (template.targets.length === 0) {
      throw new TemplateValidationError(t('template.validation.context_needs_one_target'))
    }
    
    for (let i = 0; i < template.targets.length; i++) {
      const target = template.targets[i]
      
      if (!target.path || typeof target.path !== 'string') {
        throw new TemplateValidationError(t('template.validation.target_missing_path', { index: i + 1 }))
      }
      
      if (target.mode && !['write', 'append', 'merge'].includes(target.mode)) {
        throw new TemplateValidationError(t('template.validation.target_invalid_mode', { index: i + 1 }))
      }
      
      // Check content source
      const hasContent = target.content && typeof target.content === 'string'
      const hasPromptRef = target.content_from_prompt && typeof target.content_from_prompt === 'string'
      
      if (!hasContent && !hasPromptRef) {
        throw new TemplateValidationError(t('template.validation.target_missing_content_source', { index: i + 1 }))
      }
      
      // Validate content order
      if (target.content_order && !['content-first', 'prompt-first'].includes(target.content_order)) {
        throw new TemplateValidationError(t('template.validation.target_invalid_content_order', { index: i + 1 }))
      }
    }
  }
  
  /**
   * Get template summary information
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
   * Check if template matches labels
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
   * Filter templates by type
   */
  filterTemplatesByType(templates: Template[], type?: 'prompt' | 'context'): Template[] {
    if (!type) return templates
    return templates.filter(t => t.type === type)
  }
}

// Global template service instance
export const templateService = new TemplateService()
