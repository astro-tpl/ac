/**
 * Fuzzysort 搜索引擎封装
 * 替代 ripgrep，提供模糊搜索功能，支持中文拼音搜索
 */

import fuzzysort from 'fuzzysort'
import { toPinyin, containsChinese } from './pinyin'
import { IndexedTemplate, SearchResult } from '../types/template'
import { DEFAULT_SEARCH_CONFIG } from '../types/ui'

// 搜索选项
export interface FuzzysortSearchOptions {
  /** 搜索关键词 */
  query: string
  /** 最大结果数 */
  limit?: number
  /** 阈值，低于此分数的结果将被过滤 */
  threshold?: number
  /** 是否启用拼音搜索 */
  enablePinyin?: boolean
  /** 搜索权重配置 */
  weights?: {
    id: number
    name: number
    labels: number
    summary: number
    content: number
  }
}

// 搜索字段配置
export interface SearchField {
  key: string
  weight: number
  getter: (template: IndexedTemplate) => string
}

/**
 * Fuzzysort 搜索引擎类
 */
export class FuzzysortSearchEngine {
  private searchFields: SearchField[]

  constructor() {
    // 定义搜索字段和权重
    this.searchFields = [
      {
        key: 'id',
        weight: DEFAULT_SEARCH_CONFIG.searchWeights.id,
        getter: (template) => template.id
      },
      {
        key: 'name',
        weight: DEFAULT_SEARCH_CONFIG.searchWeights.name,
        getter: (template) => template.name
      },
      {
        key: 'labels',
        weight: DEFAULT_SEARCH_CONFIG.searchWeights.labels,
        getter: (template) => template.labels.join(' ')
      },
      {
        key: 'summary',
        weight: DEFAULT_SEARCH_CONFIG.searchWeights.summary,
        getter: (template) => template.summary
      }
    ]
  }

  /**
   * 搜索模板
   */
  search(templates: IndexedTemplate[], options: FuzzysortSearchOptions): SearchResult[] {
    const {
      query,
      limit = 50,
      threshold = -10000,
      enablePinyin = true,
      weights = DEFAULT_SEARCH_CONFIG.searchWeights
    } = options

    if (!query.trim()) {
      return templates.slice(0, limit).map(template => ({
        score: 1,
        template,
        matchedFields: []
      }))
    }

    const results: SearchResult[] = []

    // 为每个模板计算搜索得分
    for (const template of templates) {
      const searchResult = this.searchTemplate(template, query, {
        threshold,
        enablePinyin,
        weights
      })

      if (searchResult) {
        results.push(searchResult)
      }
    }

    // 按得分排序并限制结果数量
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * 搜索单个模板
   */
  private searchTemplate(
    template: IndexedTemplate,
    query: string,
    options: {
      threshold: number
      enablePinyin: boolean
      weights: typeof DEFAULT_SEARCH_CONFIG.searchWeights
    }
  ): SearchResult | null {
    const { threshold, enablePinyin, weights } = options
    let totalScore = 0
    const matchedFields: string[] = []

    // 搜索各个字段
    for (const field of this.searchFields) {
      const fieldValue = field.getter(template)
      if (!fieldValue) continue

      const fieldScore = this.searchField(fieldValue, query, {
        enablePinyin,
        weight: weights[field.key as keyof typeof weights] || field.weight
      })

      if (fieldScore > threshold) {
        totalScore += fieldScore
        matchedFields.push(field.key)
      }
    }

    // 如果没有匹配的字段，返回 null
    if (matchedFields.length === 0) {
      return null
    }

    return {
      score: totalScore,
      template,
      matchedFields
    }
  }

  /**
   * 搜索单个字段
   */
  private searchField(
    fieldValue: string,
    query: string,
    options: {
      enablePinyin: boolean
      weight: number
    }
  ): number {
    const { enablePinyin, weight } = options

    // 直接搜索原始文本
    const directResult = fuzzysort.single(query, fieldValue)
    let bestScore = directResult ? directResult.score : -Infinity

    // 如果启用拼音搜索且包含中文，则同时搜索拼音
    if (enablePinyin && containsChinese(fieldValue)) {
      const pinyinArray = toPinyin(fieldValue)
      
      // 搜索有空格的拼音版本 (e.g., "pei zhi")
      const pinyinWithSpaces = pinyinArray.join(' ')
      const pinyinSpacedResult = fuzzysort.single(query, pinyinWithSpaces)
      
      if (pinyinSpacedResult && pinyinSpacedResult.score > bestScore) {
        bestScore = pinyinSpacedResult.score
      }
      
      // 搜索无空格的拼音版本 (e.g., "peizhi")
      const pinyinWithoutSpaces = pinyinArray.join('')
      const pinyinJoinedResult = fuzzysort.single(query, pinyinWithoutSpaces)
      
      if (pinyinJoinedResult && pinyinJoinedResult.score > bestScore) {
        bestScore = pinyinJoinedResult.score
      }

      // 搜索拼音首字母
      const pinyinInitials = this.getPinyinInitials(fieldValue)
      const initialsResult = fuzzysort.single(query, pinyinInitials)
      
      if (initialsResult && initialsResult.score > bestScore) {
        bestScore = initialsResult.score
      }
    }

    // 应用权重
    return bestScore === -Infinity ? -Infinity : bestScore * weight
  }

  /**
   * 获取拼音首字母
   */
  private getPinyinInitials(text: string): string {
    const pinyinArray = toPinyin(text)
    return pinyinArray
      .map(word => word.charAt(0))
      .join('')
      .toLowerCase()
  }

  /**
   * 高亮搜索结果
   */
  highlightMatches(
    template: IndexedTemplate,
    query: string,
    matchedFields: string[]
  ): Record<string, string> {
    const highlighted: Record<string, string> = {}

    for (const fieldKey of matchedFields) {
      const field = this.searchFields.find(f => f.key === fieldKey)
      if (!field) continue

      const fieldValue = field.getter(template)
      if (!fieldValue) continue

      // 使用 fuzzysort 进行高亮
      const result = fuzzysort.single(query, fieldValue)
      if (result) {
        highlighted[fieldKey] = fuzzysort.highlight(result, '<mark>', '</mark>') || fieldValue
      } else {
        highlighted[fieldKey] = fieldValue
      }
    }

    return highlighted
  }

  /**
   * 获取搜索建议
   */
  getSuggestions(
    templates: IndexedTemplate[],
    query: string,
    limit: number = 5
  ): string[] {
    if (!query.trim()) return []

    const suggestions = new Set<string>()

    // 从模板 ID 和名称中提取建议
    for (const template of templates) {
      // ID 建议
      if (template.id.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(template.id)
      }

      // 名称建议
      const nameWords = template.name.split(/\s+/)
      for (const word of nameWords) {
        if (word.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(word)
        }
      }

      // 标签建议
      for (const label of template.labels) {
        if (label.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(label)
        }
      }

      if (suggestions.size >= limit) break
    }

    return Array.from(suggestions).slice(0, limit)
  }
}

// 全局搜索引擎实例
export const fuzzysortSearchEngine = new FuzzysortSearchEngine()

/**
 * 便捷搜索函数
 */
export function searchTemplates(
  templates: IndexedTemplate[],
  query: string,
  options?: Partial<FuzzysortSearchOptions>
): SearchResult[] {
  return fuzzysortSearchEngine.search(templates, {
    query,
    ...options
  })
}

/**
 * 高亮搜索结果
 */
export function highlightSearchResults(
  template: IndexedTemplate,
  query: string,
  matchedFields: string[]
): Record<string, string> {
  return fuzzysortSearchEngine.highlightMatches(template, query, matchedFields)
}

/**
 * 获取搜索建议
 */
export function getSearchSuggestions(
  templates: IndexedTemplate[],
  query: string,
  limit?: number
): string[] {
  return fuzzysortSearchEngine.getSuggestions(templates, query, limit)
}
