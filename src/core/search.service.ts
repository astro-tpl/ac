/**
 * Search Service - Index building, keyword matching, scoring algorithms
 */

import {t} from '../i18n'
import {searchTemplates as fuzzysortSearch} from '../infra/fuzzysort'
import {getTemplateIndex, rebuildTemplateIndex} from '../infra/index-cache'
import {logger} from '../infra/logger'
import {RepoConfig} from '../types/config'
import {
  IndexedTemplate,
  SearchResult,
  Template,
  TemplateIndex,
} from '../types/template'
import {DEFAULT_SEARCH_CONFIG} from '../types/ui'
import {configService} from './config.service'
import {templateService} from './template.service'

/**
 * Search options
 */
export interface SearchOptions {
  /** Whether to enable pinyin search */
  enablePinyin?: boolean
  /** Force use global configuration */
  forceGlobal?: boolean
  /** Keyword */
  keyword?: string
  /** Label matching mode */
  labelMatchAll?: boolean
  /** Label filter */
  labels?: string[]
  /** Maximum results */
  maxResults?: number
  /** Repository filter */
  repoName?: string
  /** Search threshold */
  threshold?: number
  /** Template type filter */
  type?: 'context' | 'prompt'
}

/**
 * Search Service Class
 */
export class SearchService {
  /**
   * Get search statistics
   */
  async getSearchStats(options: { forceGlobal?: boolean } = {}): Promise<{
    contextCount: number
    promptCount: number
    repoStats: Array<{
      name: string
      templateCount: number
    }>
    totalTemplates: number
  }> {
    const {forceGlobal = false} = options

    const resolvedConfig = await configService.resolveConfig({forceGlobal})
    const {repos} = resolvedConfig.config

    if (repos.length === 0) {
      return {
        contextCount: 0,
        promptCount: 0,
        repoStats: [],
        totalTemplates: 0,
      }
    }

    const index = await getTemplateIndex(repos)

    const promptCount = index.templates.filter(t => t.type === 'prompt').length
    const contextCount = index.templates.filter(t => t.type === 'context').length

    const repoStats = repos.map(repo => ({
      name: repo.name,
      templateCount: index.templates.filter(t => t.repoName === repo.name).length,
    }))

    return {
      contextCount,
      promptCount,
      repoStats,
      totalTemplates: index.templates.length,
    }
  }

  // Old search method has been replaced by fuzzysort

  /**
   * Rebuild search index
   */
  async rebuildIndex(options: { forceGlobal?: boolean } = {}): Promise<{
    duration: number
    success: boolean
    templateCount: number
  }> {
    const {forceGlobal = false} = options

    const startTime = Date.now()

    try {
      const resolvedConfig = await configService.resolveConfig({forceGlobal})
      const {repos} = resolvedConfig.config

      const index = await rebuildTemplateIndex(repos)
      const duration = Date.now() - startTime

      return {
        duration,
        success: true,
        templateCount: index.templates.length,
      }
    } catch (error: any) {
      logger.error(t('search.rebuild_index_failed'), error)
      return {
        duration: Date.now() - startTime,
        success: false,
        templateCount: 0,
      }
    }
  }

  // Search scoring has been handled by fuzzysort

  // Matching field detection has been handled by fuzzysort

  // Fuzzy matching has been handled by fuzzysort

  // Tag matching has been integrated into main search method

  // Result sorting has been handled by fuzzysort

  /**
   * Search templates
   */
  async searchTemplates(options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      enablePinyin = DEFAULT_SEARCH_CONFIG.enablePinyin,
      forceGlobal = false,
      keyword = '',
      labelMatchAll = false,
      labels = [],
      maxResults = DEFAULT_SEARCH_CONFIG.maxDisplayResults,
      repoName,
      threshold = -10_000,
      type,
    } = options

    // Get configuration and repository information
    const resolvedConfig = await configService.resolveConfig({forceGlobal})
    let {repos} = resolvedConfig.config

    // Filter repositories
    if (repoName) {
      repos = repos.filter(r => r.name === repoName)
      if (repos.length === 0) {
        logger.warn(t('repo.remove.notfound', {alias: repoName}))
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
    let {templates} = index

    // Filter by type
    if (type) {
      templates = templates.filter(t => t.type === type)
    }

    // Filter by labels
    if (labels.length > 0) {
      templates = templates.filter(template => {
        if (labelMatchAll) {
          return labels.every(label => template.labels.includes(label))
        }

        return labels.some(label => template.labels.includes(label))
      })
    }

    // Use fuzzysort for search
    const results = fuzzysortSearch(templates, keyword, {
      enablePinyin,
      limit: maxResults,
      threshold,
      weights: DEFAULT_SEARCH_CONFIG.searchWeights,
    })

    return results
  }

  /**
   * Deep search (using ripgrep)
   */
  private async deepSearch(
    keyword: string,
    repos: RepoConfig[],
    options: {
      caseSensitive?: boolean
      labelMatchAll?: boolean
      labels?: string[]
      type?: 'context' | 'prompt'
    },
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
}

// Global search service instance
export const searchService = new SearchService()
