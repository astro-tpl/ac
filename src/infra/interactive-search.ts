/**
 * 交互式搜索界面 - 类似 fzf 的体验
 */

import inquirer from 'inquirer'
import { SearchResult, IndexedTemplate } from '../types/template'
import { t } from '../i18n'

/**
 * 搜索结果项，用于交互式选择
 */
export interface InteractiveSearchItem {
  name: string
  value: SimpleSearchResult
  short: string
}

/**
 * 简化的搜索结果，用于交互式选择
 */
export interface SimpleSearchResult {
  score: number
  template: {
    id: string
    type: string
    name: string
    labels: string[]
    summary: string
    repoName: string
  }
  matchedFields: string[]
}

/**
 * 交互式搜索选项
 */
export interface InteractiveSearchOptions {
  /** 搜索结果 */
  results: SimpleSearchResult[]
  /** 提示消息 */
  message?: string
  /** 每页显示数量 */
  pageSize?: number
}

/**
 * 将搜索结果转换为交互式选择项
 */
export function formatSearchResultsForInteractive(results: SimpleSearchResult[]): InteractiveSearchItem[] {
  return results.map((result, index) => {
    const { template } = result
    const typeIcon = template.type === 'prompt' ? '📝' : '📦'
    const typeName = template.type === 'prompt' ? 'prompt' : 'context'
    
    // 格式化标签
    const labelsStr = template.labels.length > 0 
      ? ` [${template.labels.join(', ')}]` 
      : ''
    
    // 构建显示名称：type id name — summary [labels]
    const displayName = `${typeIcon} ${typeName.padEnd(7)} ${template.id.padEnd(20)} ${template.name.padEnd(25)} — ${template.summary || t('common.no_description')}${labelsStr}`
    
    return {
      name: displayName,
      value: result,
      short: `${template.type}:${template.id}`
    }
  })
}

/**
 * 启动交互式搜索界面
 */
export async function startInteractiveSearch(options: InteractiveSearchOptions): Promise<SimpleSearchResult | null> {
  const { results, message = t('search.interactive.select'), pageSize = 10 } = options
  
  if (results.length === 0) {
    return null
  }
  
  // 如果只有一个结果，直接返回
  if (results.length === 1) {
    return results[0]
  }
  
  const choices = formatSearchResultsForInteractive(results)
  
  try {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTemplate',
        message,
        choices: [
          ...choices,
          new inquirer.Separator(),
          {
            name: t('search.interactive.cancel'),
            value: null,
            short: 'cancel'
          }
        ],
        pageSize,
        loop: false
      }
    ])
    
    return answer.selectedTemplate
  } catch (error) {
    // 用户取消 (Ctrl+C)
    return null
  }
}

/**
 * 交互式搜索界面的键盘提示
 */
export function getInteractiveSearchHelp(): string {
  return [
    t('search.interactive.help.title'),
    `  ${t('search.interactive.help.navigation')}`,
    `  ${t('search.interactive.help.select')}`,
    `  ${t('search.interactive.help.cancel')}`,
    ''
  ].join('\n')
}
