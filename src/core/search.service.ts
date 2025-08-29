/**
 * 搜索服务 - 索引构建、关键字匹配、打分算法
 */

import { configService } from './config.service'
import { templateService } from './template.service'
import { getTemplateIndex, rebuildTemplateIndex } from '../infra/index-cache'
import { searchTemplateContent, searchTemplateFields, checkRipgrepAvailable } from '../infra/rg'
import { SEARCH_WEIGHTS } from '../config/constants'
import { 
  SearchResult, 
  IndexedTemplate, 
  TemplateIndex,
  Template 
} from '../types/template'
import { RepoConfig } from '../types/config'
import { logger } from '../infra/logger'

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
  /** 深度搜索（使用 ripgrep） */
  deep?: boolean
  /** 仓库过滤 */
  repoName?: string
  /** 强制使用全局配置 */
  forceGlobal?: boolean
  /** 最大结果数 */
  maxResults?: number
  /** 大小写敏感 */
  caseSensitive?: boolean
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
      keyword,
      type,
      labels = [],
      labelMatchAll = false,
      deep = false,
      repoName,
      forceGlobal = false,
      maxResults = 50,
      caseSensitive = false
    } = options
    
    // 获取配置和仓库信息
    const resolvedConfig = await configService.resolveConfig({ forceGlobal })
    let repos = resolvedConfig.config.repos
    
    // 过滤仓库
    if (repoName) {
      repos = repos.filter(r => r.name === repoName)
      if (repos.length === 0) {
        logger.warn(`仓库不存在: ${repoName}`)
        return []
      }
    }
    
    if (repos.length === 0) {
      logger.info('没有配置任何仓库')
      return []
    }
    
    // 获取索引
    const index = await getTemplateIndex(repos)
    
    let results: SearchResult[] = []
    
    // 基于索引的基础搜索
    const indexResults = await this.searchInIndex(index, {
      keyword,
      type,
      labels,
      labelMatchAll,
      repoName,
      caseSensitive
    })
    
    results.push(...indexResults)
    
    // 深度搜索（如果启用）
    if (deep && keyword) {
      try {
        const deepResults = await this.deepSearch(keyword, repos, {
          type,
          labels,
          labelMatchAll,
          caseSensitive
        })
        
        // 合并结果，避免重复
        const existingIds = new Set(results.map(r => r.template.id))
        const newResults = deepResults.filter(r => !existingIds.has(r.template.id))
        
        results.push(...newResults)
      } catch (error: any) {
        logger.warn(`深度搜索失败: ${error.message}`)
      }
    }
    
    // 排序和限制结果数量
    results = this.sortSearchResults(results)
    
    if (maxResults > 0) {
      results = results.slice(0, maxResults)
    }
    
    return results
  }
  
  /**
   * 在索引中搜索
   */
  private async searchInIndex(
    index: TemplateIndex,
    options: {
      keyword?: string
      type?: 'prompt' | 'context'
      labels?: string[]
      labelMatchAll?: boolean
      repoName?: string
      caseSensitive?: boolean
    }
  ): Promise<SearchResult[]> {
    const { keyword, type, labels = [], labelMatchAll = false, repoName, caseSensitive = false } = options
    
    let templates = index.templates
    
    // 按仓库过滤
    if (repoName) {
      templates = templates.filter(t => t.repoName === repoName)
    }
    
    // 按类型过滤
    if (type) {
      templates = templates.filter(t => t.type === type)
    }
    
    // 按标签过滤
    if (labels.length > 0) {
      templates = templates.filter(t => this.matchesLabels(t, labels, labelMatchAll))
    }
    
    // 关键字搜索和打分
    const results: SearchResult[] = []
    
    for (const template of templates) {
      const score = this.calculateScore(template, keyword, caseSensitive)
      
      if (!keyword || score > 0) {
        results.push({
          score,
          template,
          matchedFields: this.getMatchedFields(template, keyword, caseSensitive)
        })
      }
    }
    
    return results
  }
  
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
    // 检查 ripgrep 是否可用
    if (!await checkRipgrepAvailable()) {
      throw new Error('ripgrep 未安装')
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
            logger.debug(`加载深度搜索模板失败: ${rgResult.path}`)
          }
        }
      } catch (error: any) {
        logger.debug(`仓库 ${repo.name} 深度搜索失败: ${error.message}`)
      }
    }
    
    return results
  }
  
  /**
   * 计算搜索得分
   */
  private calculateScore(template: IndexedTemplate, keyword?: string, caseSensitive = false): number {
    if (!keyword) {
      return 1 // 无关键字时返回基础分数
    }
    
    const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase()
    let score = 0
    
    // 搜索头部字段
    const headFields = [
      template.id,
      template.name,
      template.summary,
      ...template.labels
    ]
    
    for (const field of headFields) {
      if (field) {
        const fieldValue = caseSensitive ? field : field.toLowerCase()
        
        // 完全匹配
        if (fieldValue === searchKeyword) {
          score += SEARCH_WEIGHTS.HEAD_FIELDS * 2
        }
        // 包含匹配
        else if (fieldValue.includes(searchKeyword)) {
          score += SEARCH_WEIGHTS.HEAD_FIELDS
        }
        // 部分匹配（模糊匹配）
        else if (this.fuzzyMatch(fieldValue, searchKeyword)) {
          score += SEARCH_WEIGHTS.HEAD_FIELDS * 0.5
        }
      }
    }
    
    return score
  }
  
  /**
   * 获取匹配的字段
   */
  private getMatchedFields(template: IndexedTemplate, keyword?: string, caseSensitive = false): string[] {
    if (!keyword) {
      return []
    }
    
    const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase()
    const matchedFields: string[] = []
    
    // 检查各个字段
    const fieldMap = {
      id: template.id,
      name: template.name,
      summary: template.summary,
      labels: template.labels.join(' ')
    }
    
    for (const [fieldName, fieldValue] of Object.entries(fieldMap)) {
      if (fieldValue) {
        const value = caseSensitive ? fieldValue : fieldValue.toLowerCase()
        if (value.includes(searchKeyword)) {
          matchedFields.push(fieldName)
        }
      }
    }
    
    return matchedFields
  }
  
  /**
   * 模糊匹配
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    const textChars = text.split('')
    const patternChars = pattern.split('')
    
    let textIndex = 0
    let patternIndex = 0
    
    while (textIndex < textChars.length && patternIndex < patternChars.length) {
      if (textChars[textIndex] === patternChars[patternIndex]) {
        patternIndex++
      }
      textIndex++
    }
    
    return patternIndex === patternChars.length
  }
  
  /**
   * 检查模板是否匹配标签
   */
  private matchesLabels(template: IndexedTemplate, labels: string[], matchAll = false): boolean {
    if (!labels.length) return true
    if (!template.labels.length) return false
    
    const templateLabels = template.labels.map(l => l.toLowerCase())
    const searchLabels = labels.map(l => l.toLowerCase())
    
    if (matchAll) {
      return searchLabels.every(label => templateLabels.includes(label))
    } else {
      return searchLabels.some(label => templateLabels.includes(label))
    }
  }
  
  /**
   * 排序搜索结果
   */
  private sortSearchResults(results: SearchResult[]): SearchResult[] {
    return results.sort((a, b) => {
      // 首先按分数排序（降序）
      if (b.score !== a.score) {
        return b.score - a.score
      }
      
      // 分数相同时按名称排序
      return a.template.name.localeCompare(b.template.name)
    })
  }
  
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
      logger.error('重建索引失败', error)
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
