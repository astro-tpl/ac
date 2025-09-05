/**
 * Search Service - Index building, keyword matching, scoring algorithms
 */

import { configService } from './config.service'
import { templateService } from './template.service'
import { getTemplateIndex, rebuildTemplateIndex } from '../infra/index-cache'
import { searchTemplates as fuzzysortSearch } from '../infra/fuzzysort'
import { DEFAULT_SEARCH_CONFIG } from '../types/ui'
import { 
  SearchResult, 
  IndexedTemplate, 
  TemplateIndex,
  Template 
} from '../types/template'
import { RepoConfig } from '../types/config'
import { logger } from '../infra/logger'
import { t } from '../i18n'

/**
 * Search options
 */
export interface SearchOptions {
  /** Keyword */
  keyword?: string
  /** Template type filter */
  type?: 'prompt' | 'context'
  /** Label filter */
  labels?: string[]
  /** Label matching mode */
  labelMatchAll?: boolean
  /** Repository filter */
  repoName?: string
  /** Force use global configuration */
  forceGlobal?: boolean
  /** Maximum results */
  maxResults?: number
  /** Whether to enable pinyin search */
  enablePinyin?: boolean
  /** Search threshold */
  threshold?: number
}

/**
 * Search Service Class
 */
export class SearchService {
  /**
   * Search templates
   */
  async searchTemplates(options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      keyword = '',
      type,
      labels = [],
      labelMatchAll = false,
      repoName,
      forceGlobal = false,
      maxResults = DEFAULT_SEARCH_CONFIG.maxDisplayResults,
      enablePinyin = DEFAULT_SEARCH_CONFIG.enablePinyin,
      threshold = -10000
    } = options
    
    // Get configuration and repository information
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    let repos = resolvedConfig.config.repos
    
    // Filter repositories
    if (repoName) {
      repos = repos.filter(r => r.name === repoName)
      if (repos.length === 0) {
        logger.warn(t('repo.remove.notfound', { alias: repoName }))
        return []
      }
    }
    
    if (repos.length === 0) {
      logger.info(t('search.no_repos'))
      return []
    }
    
    // Get index
    const index = await getTemplateIndex(repos)
    
    // Filter templates
    let templates = index.templates
    
    // Filter by type
    if (type) {
      templates = templates.filter(t => t.type === type)
    }
    
    // Filter by labels
    if (labels.length > 0) {
      templates = templates.filter(template => {
        if (labelMatchAll) {
          return labels.every(label => template.labels.includes(label))
        } else {
          return labels.some(label => template.labels.includes(label))
        }
      })
    }
    
    // Use fuzzysort for search
    const results = fuzzysortSearch(templates, keyword, {
      limit: maxResults,
      threshold,
      enablePinyin,
      weights: DEFAULT_SEARCH_CONFIG.searchWeights
    })
    
    return results
  }
  
  // Old search method has been replaced by fuzzysort
  
  /**
   * Deep search (using ripgrep)
   */
  private async deepSearch(
    keyword: string,
    repos: RepoConfig[],
    options: {
      type?: 'prompt' | 'context'
      labels?: string[]
      labelMatchAll?: boolean
      caseSensitive?: boolean
    }
  ): Promise<SearchResult[]> {
    // TODO: Temporarily disable deep search, will re-implement using fuzzysort during refactoring
    logger.debug('Deep search temporarily disabled, will be reimplemented with fuzzysort')
    return []
    
    /* 
    // Check if ripgrep is available
    if (!await checkRipgrepAvailable()) {
      throw new Error(t('error.ripgrep.not_available'))
    }
    
    const { type, labels = [], labelMatchAll = false, caseSensitive = false } = options
    const results: SearchResult[] = []
    
    for (const repo of repos) {
      try {
        // Search content in repository
        const repoPath = `~/.ac/repos/${repo.name}`
        const ripgrepResults = await searchTemplateContent(keyword, [repoPath], {
          caseSensitive,
          maxResults: 100
        })
        
        // Load template for each matched file
        const processedFiles = new Set<string>()
        
        for (const rgResult of ripgrepResults) {
          if (processedFiles.has(rgResult.path)) {
            continue
          }
          processedFiles.add(rgResult.path)
          
          try {
            const template = await templateService.loadTemplate(rgResult.path.split('/').pop()?.replace(/\.(yaml|yml)$/, '') || '', {
              repoName: repo.name
            })
            
            // Apply filter conditions
            if (type && template.type !== type) {
              continue
            }
            
            if (labels.length > 0 && !templateService.templateMatchesLabels(template, labels, labelMatchAll)) {
              continue
            }
            
            // Create indexed template object
            const indexedTemplate: IndexedTemplate = {
              id: template.id,
              type: template.type,
              name: template.name,
              labels: template.labels || [],
              summary: template.summary || '',
              repoName: repo.name,
              absPath: rgResult.path,
              lastModified: Date.now()
            }
            
            results.push({
              score: SEARCH_WEIGHTS.CONTENT, // Base score for deep search
              template: indexedTemplate,
              matchedFields: ['content']
            })
          } catch (error: any) {
            logger.debug(t('apply.failed', { error: `load template failed: ${rgResult.path}` }))
          }
        }
      } catch (error: any) {
        logger.debug(t('search.failed'))
      }
    }
    
    return results
    */
  }
  
  // Search scoring has been handled by fuzzysort
  
  // Matching field detection has been handled by fuzzysort
  
  // Fuzzy matching has been handled by fuzzysort
  
  // Tag matching has been integrated into main search method
  
  // Result sorting has been handled by fuzzysort
  
  /**
   * Get search statistics
   */
  async getSearchStats(options: { forceGlobal?: boolean } = {}): Promise<{
    totalTemplates: number
    promptCount: number
    contextCount: number
    repoStats: Array<{
      name: string
      templateCount: number
    }>
  }> {
    const { forceGlobal = false } = options
    
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    const repos = resolvedConfig.config.repos
    
    if (repos.length === 0) {
      return {
        totalTemplates: 0,
        promptCount: 0,
        contextCount: 0,
        repoStats: []
      }
    }
    
    const index = await getTemplateIndex(repos)
    
    const promptCount = index.templates.filter(t => t.type === 'prompt').length
    const contextCount = index.templates.filter(t => t.type === 'context').length
    
    const repoStats = repos.map(repo => ({
      name: repo.name,
      templateCount: index.templates.filter(t => t.repoName === repo.name).length
    }))
    
    return {
      totalTemplates: index.templates.length,
      promptCount,
      contextCount,
      repoStats
    }
  }
  
  /**
   * Rebuild search index
   */
  async rebuildIndex(options: { forceGlobal?: boolean } = {}): Promise<{
    success: boolean
    templateCount: number
    duration: number
  }> {
    const { forceGlobal = false } = options
    
    const startTime = Date.now()
    
    try {
      const resolvedConfig = await configService.resolveConfig({ forceGlobal })
      const repos = resolvedConfig.config.repos
      
      const index = await rebuildTemplateIndex(repos)
      const duration = Date.now() - startTime
      
      return {
        success: true,
        templateCount: index.templates.length,
        duration
      }
    } catch (error: any) {
      logger.error(t('search.rebuild_index_failed'), error)
      return {
        success: false,
        templateCount: 0,
        duration: Date.now() - startTime
      }
    }
  }
}

// Global search service instance
export const searchService = new SearchService()
