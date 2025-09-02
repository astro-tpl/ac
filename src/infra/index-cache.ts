/**
 * 模板索引缓存机制
 */

import { join } from 'node:path'
import { readFile, atomicWriteFile, fileExists, getFileStats, scanDirectory } from './fs'
import { readYamlFile, safeParseYaml } from './yaml'
import { INDEX_CACHE_PATH } from '../config/constants'
import { TemplateIndex, IndexedTemplate, Template, RepoConfig } from '../types/index'
import { getRepoPath } from '../config/paths'
import { logger } from './logger'

/**
 * 索引缓存管理器
 */
export class IndexCacheManager {
  private cacheVersion = 1
  
  /**
   * 读取索引缓存
   */
  async readCache(): Promise<TemplateIndex | null> {
    try {
      if (!await fileExists(INDEX_CACHE_PATH)) {
        logger.debug('索引缓存文件不存在')
        return null
      }
      
      const content = await readFile(INDEX_CACHE_PATH)
      const index = JSON.parse(content) as TemplateIndex
      
      // 检查缓存版本
      if (index.version !== this.cacheVersion) {
        logger.debug(`索引缓存版本不匹配: ${index.version} vs ${this.cacheVersion}`)
        return null
      }
      
      logger.debug(`读取索引缓存成功: ${index.templates.length} 个模板`)
      return index
    } catch (error: any) {
      logger.debug(`读取索引缓存失败: ${error.message}`)
      return null
    }
  }
  
  /**
   * 写入索引缓存
   */
  async writeCache(index: TemplateIndex): Promise<void> {
    try {
      const content = JSON.stringify(index, null, 2)
      await atomicWriteFile(INDEX_CACHE_PATH, content)
      logger.debug(`写入索引缓存成功: ${index.templates.length} 个模板`)
    } catch (error: any) {
      logger.debug(`写入索引缓存失败: ${error.message}`)
      // 缓存写入失败不应该影响主要功能，只记录错误
    }
  }
  
  /**
   * 检查缓存是否需要更新
   */
  async needsUpdate(repos: RepoConfig[]): Promise<boolean> {
    const cache = await this.readCache()
    if (!cache) {
      return true
    }
    
    // 检查仓库是否有更新
    for (const repo of repos) {
      const repoPath = getRepoPath(repo.name)
      const stats = await getFileStats(repoPath)
      
      if (!stats) {
        // 仓库不存在，需要更新
        return true
      }
      
      // 检查仓库最后修改时间是否晚于缓存时间
      if (stats.mtime.getTime() > cache.lastUpdated) {
        logger.debug(`仓库 ${repo.name} 有更新，需要重建索引`)
        return true
      }
    }
    
    return false
  }
  
  /**
   * 构建完整索引
   */
  async buildIndex(repos: RepoConfig[]): Promise<TemplateIndex> {
    logger.info('正在构建模板索引...')
    const templates: IndexedTemplate[] = []
    
    for (const repo of repos) {
      const repoTemplates = await this.scanRepoTemplates(repo)
      templates.push(...repoTemplates)
    }
    
    const index: TemplateIndex = {
      version: this.cacheVersion,
      lastUpdated: Date.now(),
      templates
    }
    
    // 写入缓存
    await this.writeCache(index)
    
    logger.success(`索引构建完成: ${templates.length} 个模板`)
    return index
  }
  
  /**
   * 扫描仓库中的模板
   */
  private async scanRepoTemplates(repo: RepoConfig): Promise<IndexedTemplate[]> {
    const repoPath = getRepoPath(repo.name)
    const templates: IndexedTemplate[] = []
    
    try {
      // 扫描所有 YAML 文件
      const yamlFiles = await scanDirectory(repoPath, {
        extensions: ['.yaml', '.yml'],
        recursive: true,
        includeHidden: false
      })
      
      logger.debug(`扫描仓库 ${repo.name}: 找到 ${yamlFiles.length} 个 YAML 文件`)
      
      for (const filePath of yamlFiles) {
        try {
          const template = await this.parseTemplateFile(filePath, repo.name)
          if (template) {
            templates.push(template)
          }
        } catch (error: any) {
          logger.debug(`解析模板文件失败 ${filePath}: ${error.message}`)
          // 继续处理其他文件，不因单个文件失败而中断
        }
      }
      
      logger.debug(`仓库 ${repo.name} 解析成功: ${templates.length} 个模板`)
    } catch (error: any) {
      logger.warn(`扫描仓库失败 ${repo.name}: ${error.message}`)
    }
    
    return templates
  }
  
  /**
   * 解析单个模板文件
   */
  private async parseTemplateFile(filePath: string, repoName: string): Promise<IndexedTemplate | null> {
    try {
      const template = await readYamlFile<Template>(filePath)
      
      // 验证模板格式
      if (!this.isValidTemplate(template)) {
        logger.debug(`模板格式无效: ${filePath}`)
        return null
      }
      
      const stats = await getFileStats(filePath)
      if (!stats) {
        return null
      }
      
      const indexed: IndexedTemplate = {
        id: template.id,
        type: template.type,
        name: template.name,
        labels: template.labels || [],
        summary: template.summary || '',
        repoName,
        absPath: filePath,
        lastModified: stats.mtime.getTime()
      }
      
      // 为不同类型的模板添加特定字段
      if (template.type === 'prompt') {
        indexed.content = (template as any).content
      } else if (template.type === 'context') {
        indexed.targets = (template as any).targets
      }
      
      return indexed
    } catch (error: any) {
      logger.debug(`解析模板文件失败 ${filePath}: ${error.message}`)
      return null
    }
  }
  
  /**
   * 验证模板格式是否正确
   */
  private isValidTemplate(template: any): template is Template {
    return template &&
           typeof template.id === 'string' &&
           (template.type === 'prompt' || template.type === 'context') &&
           typeof template.name === 'string'
  }
  
  /**
   * 获取或构建索引
   */
  async getIndex(repos: RepoConfig[], forceRebuild = false): Promise<TemplateIndex> {
    if (!forceRebuild) {
      // 尝试读取缓存
      const cache = await this.readCache()
      if (cache && !await this.needsUpdate(repos)) {
        logger.debug('使用缓存的索引')
        return cache
      }
    }
    
    // 构建新索引
    return this.buildIndex(repos)
  }
  
  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    try {
      if (await fileExists(INDEX_CACHE_PATH)) {
        const { unlink } = await import('node:fs/promises')
        await unlink(INDEX_CACHE_PATH)
        logger.debug('索引缓存已清除')
      }
    } catch (error: any) {
      logger.debug(`清除索引缓存失败: ${error.message}`)
    }
  }
  
  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    exists: boolean
    size?: number
    lastUpdated?: Date
    templateCount?: number
    version?: number
  }> {
    if (!await fileExists(INDEX_CACHE_PATH)) {
      return { exists: false }
    }
    
    try {
      const stats = await getFileStats(INDEX_CACHE_PATH)
      const cache = await this.readCache()
      
      return {
        exists: true,
        size: stats?.size,
        lastUpdated: stats?.mtime,
        templateCount: cache?.templates.length,
        version: cache?.version
      }
    } catch {
      return { exists: true }
    }
  }
}

// 全局索引缓存管理器实例
export const indexCache = new IndexCacheManager()

/**
 * 快捷方法：获取索引
 */
export async function getTemplateIndex(repos: RepoConfig[], forceRebuild = false): Promise<TemplateIndex> {
  return indexCache.getIndex(repos, forceRebuild)
}

/**
 * 快捷方法：重建索引
 */
export async function rebuildTemplateIndex(repos: RepoConfig[]): Promise<TemplateIndex> {
  return indexCache.buildIndex(repos)
}

/**
 * 快捷方法：清除索引缓存
 */
export async function clearTemplateIndex(): Promise<void> {
  return indexCache.clearCache()
}
