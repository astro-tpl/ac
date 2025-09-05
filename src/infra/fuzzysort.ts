/**
 * Fuzzysort search engine wrapper
 * Replaces ripgrep, provides fuzzy search functionality with Chinese pinyin support
 */

import fuzzysort from 'fuzzysort'
import { toPinyin, containsChinese } from './pinyin'
import { IndexedTemplate, SearchResult } from '../types/template'
import { DEFAULT_SEARCH_CONFIG } from '../types/ui'

// Search options
export interface FuzzysortSearchOptions {
  /** Search keywords */
  query: string
  /** Maximum results */
  limit?: number
  /** Threshold, results below this score will be filtered */
  threshold?: number
  /** Whether to enable pinyin search */
  enablePinyin?: boolean
  /** Search weight configuration */
  weights?: {
    id: number
    name: number
    labels: number
    summary: number
    content: number
  }
}

// Search field configuration
export interface SearchField {
  key: string
  weight: number
  getter: (template: IndexedTemplate) => string
}

/**
 * Fuzzysort Search Engine Class
 */
export class FuzzysortSearchEngine {
  private searchFields: SearchField[]

  constructor() {
    // Define search fields and weights
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
   * Search templates
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

    // Calculate search score for each template
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

    // Sort by score and limit result count
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Search single template
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

    // Search each field
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

    // If no matching fields, return null
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
   * Search single field
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

    // Search original text directly
    const directResult = fuzzysort.single(query, fieldValue)
    let bestScore = directResult ? directResult.score : -Infinity

    // If pinyin search is enabled and contains Chinese, search pinyin simultaneously
    if (enablePinyin && containsChinese(fieldValue)) {
      const pinyinArray = toPinyin(fieldValue)
      
      // Search spaced pinyin version (e.g., "pei zhi")
      const pinyinWithSpaces = pinyinArray.join(' ')
      const pinyinSpacedResult = fuzzysort.single(query, pinyinWithSpaces)
      
      if (pinyinSpacedResult && pinyinSpacedResult.score > bestScore) {
        bestScore = pinyinSpacedResult.score
      }
      
      // Search non-spaced pinyin version (e.g., "peizhi")
      const pinyinWithoutSpaces = pinyinArray.join('')
      const pinyinJoinedResult = fuzzysort.single(query, pinyinWithoutSpaces)
      
      if (pinyinJoinedResult && pinyinJoinedResult.score > bestScore) {
        bestScore = pinyinJoinedResult.score
      }

      // Search pinyin initials
      const pinyinInitials = this.getPinyinInitials(fieldValue)
      const initialsResult = fuzzysort.single(query, pinyinInitials)
      
      if (initialsResult && initialsResult.score > bestScore) {
        bestScore = initialsResult.score
      }
    }

    // Apply weight
    return bestScore === -Infinity ? -Infinity : bestScore * weight
  }

  /**
   * Get pinyin initials
   */
  private getPinyinInitials(text: string): string {
    const pinyinArray = toPinyin(text)
    return pinyinArray
      .map(word => word.charAt(0))
      .join('')
      .toLowerCase()
  }

  /**
   * Highlight search results
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

      // Use fuzzysort for highlighting
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
   * Get search suggestions
   */
  getSuggestions(
    templates: IndexedTemplate[],
    query: string,
    limit: number = 5
  ): string[] {
    if (!query.trim()) return []

    const suggestions = new Set<string>()

    // Extract suggestions from template ID and name
    for (const template of templates) {
      // ID suggestions
      if (template.id.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(template.id)
      }

      // Name suggestions
      const nameWords = template.name.split(/\s+/)
      for (const word of nameWords) {
        if (word.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(word)
        }
      }

      // Label suggestions
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

// Global search engine instance
export const fuzzysortSearchEngine = new FuzzysortSearchEngine()

/**
 * Convenient search function
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
 * Highlight search results
 */
export function highlightSearchResults(
  template: IndexedTemplate,
  query: string,
  matchedFields: string[]
): Record<string, string> {
  return fuzzysortSearchEngine.highlightMatches(template, query, matchedFields)
}

/**
 * Get search suggestions
 */
export function getSearchSuggestions(
  templates: IndexedTemplate[],
  query: string,
  limit?: number
): string[] {
  return fuzzysortSearchEngine.getSuggestions(templates, query, limit)
}
