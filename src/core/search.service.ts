/**
 * 搜索服务 - 索引构建、关键字匹配、打分算法
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
 * 搜索选项
 */
export interface SearchOptions {
  /** 关键字 */
  keyword?: string
  /** 模板类型过滤 */
  type?: 'prompt' | 'context'
  /** 标签过滤 */
  labels?: string[]
  /** 标签匹配模式 */
  labelMatchAll?: boolean
  /** 仓库过滤 */
  repoName?: string
  /** 强制使用全局配置 */
  forceGlobal?: boolean
  /** 最大结果数 */
  maxResults?: number
  /** 是否启用拼音搜索 */
  enablePinyin?: boolean
  /** 搜索阈值 */
  threshold?: number
}

/**
 * 搜索服务类
 */
export class SearchService {
  /**
   * 搜索模板
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
    
    // 获取配置和仓库信息
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    let repos = resolvedConfig.config.repos
    
    // 过滤仓库
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
    
    // 获取索引
    const index = await getTemplateIndex(repos)
    
    // 过滤模板
    let templates = index.templates
    
    // 按类型过滤
    if (type) {
      templates = templates.filter(t => t.type === type)
    }
    
    // 按标签过滤
    if (labels.length > 0) {
      templates = templates.filter(template => {
        if (labelMatchAll) {
          return labels.every(label => template.labels.includes(label))
        } else {
          return labels.some(label => template.labels.includes(label))
        }
      })
    }
    
    // 使用 fuzzysort 进行搜索
    const results = fuzzysortSearch(templates, keyword, {
      limit: maxResults,
      threshold,
      enablePinyin,
      weights: DEFAULT_SEARCH_CONFIG.searchWeights
    })
    
    return results
  }
  
  // 旧的搜索方法已被 fuzzysort 替代
  
  /**
   * 深度搜索（使用 ripgrep）
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
    // TODO: 临时禁用深度搜索，将在重构时使用 fuzzysort 重新实现
    logger.debug('Deep search temporarily disabled, will be reimplemented with fuzzysort')
    return []
    
    /* 
    // 检查 ripgrep 是否可用
    if (!await checkRipgrepAvailable()) {
      throw new Error(t('error.ripgrep.not_available'))
    }
    
    const { type, labels = [], labelMatchAll = false, caseSensitive = false } = options
    const results: SearchResult[] = []
    
    for (const repo of repos) {
      try {
        // 在仓库中搜索内容
        const repoPath = `~/.ac/repos/${repo.name}`
        const ripgrepResults = await searchTemplateContent(keyword, [repoPath], {
          caseSensitive,
          maxResults: 100
        })
        
        // 为每个匹配的文件加载模板
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
            
            // 应用过滤条件
            if (type && template.type !== type) {
              continue
            }
            
            if (labels.length > 0 && !templateService.templateMatchesLabels(template, labels, labelMatchAll)) {
              continue
            }
            
            // 创建索引模板对象
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
              score: SEARCH_WEIGHTS.CONTENT, // 深度搜索的基础分数
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
  
  // 搜索得分计算已由 fuzzysort 处理
  
  // 匹配字段检测已由 fuzzysort 处理
  
  // 模糊匹配已由 fuzzysort 处理
  
  // 标签匹配已集成到主搜索方法中
  
  // 结果排序已由 fuzzysort 处理
  
  /**
   * 获取搜索统计信息
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
   * 重建搜索索引
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

// 全局搜索服务实例
export const searchService = new SearchService()
