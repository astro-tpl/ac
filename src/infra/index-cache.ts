/**
 * Template index caching mechanism
 */

import { join } from 'node:path'
import { readFile, atomicWriteFile, fileExists, getFileStats, scanDirectory } from './fs'
import { readYamlFile, safeParseYaml } from './yaml'
import { INDEX_CACHE_PATH } from '../config/constants'
import { TemplateIndex, IndexedTemplate, Template, RepoConfig } from '../types/index'
import { getRepoPath } from '../config/paths'
import { logger } from './logger'
import { t } from '../i18n'

/**
 * Index Cache Manager
 */
export class IndexCacheManager {
  private cacheVersion = 1
  
  /**
   * Read index cache
   */
  async readCache(): Promise<TemplateIndex | null> {
    try {
      if (!await fileExists(INDEX_CACHE_PATH)) {
        logger.debug(t('index_cache.debug.file_not_exists'))
        return null
      }
      
      const content = await readFile(INDEX_CACHE_PATH)
      const index = JSON.parse(content) as TemplateIndex
      
      // Check cache version
      if (index.version !== this.cacheVersion) {
        logger.debug(t('index_cache.debug.version_mismatch', { current: index.version, expected: this.cacheVersion }))
        return null
      }
      
      logger.debug(t('index_cache.debug.read_success', { count: index.templates.length }))
      return index
    } catch (error: any) {
      logger.debug(t('index_cache.debug.read_failed', { error: error.message }))
      return null
    }
  }
  
  /**
   * Write index cache
   */
  async writeCache(index: TemplateIndex): Promise<void> {
    try {
      const content = JSON.stringify(index, null, 2)
      await atomicWriteFile(INDEX_CACHE_PATH, content)
      logger.debug(t('index_cache.debug.write_success', { count: index.templates.length }))
    } catch (error: any) {
      logger.debug(t('index_cache.debug.write_failed', { error: error.message }))
      // Cache write failure should not affect main functionality, only log error
    }
  }
  
  /**
   * Check if cache needs update
   */
  async needsUpdate(repos: RepoConfig[]): Promise<boolean> {
    const cache = await this.readCache()
    if (!cache) {
      return true
    }
    
    // Check if repositories have updates
    for (const repo of repos) {
      const repoPath = getRepoPath(repo.name)
      const stats = await getFileStats(repoPath)
      
      if (!stats) {
        // Repository doesn't exist, needs update
        return true
      }
      
      // Check if repository last modified time is later than cache time
      if (stats.mtime.getTime() > cache.lastUpdated) {
        logger.debug(t('index_cache.debug.repo_needs_update', { name: repo.name }))
        return true
      }
    }
    
    return false
  }
  
  /**
   * Build complete index
   */
  async buildIndex(repos: RepoConfig[]): Promise<TemplateIndex> {
    logger.info(t('index_cache.info.building_index'))
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
    
    // Write cache
    await this.writeCache(index)
    
    logger.success(t('index_cache.success.build_complete', { count: templates.length }))
    return index
  }
  
  /**
   * Scan templates in repository
   */
  private async scanRepoTemplates(repo: RepoConfig): Promise<IndexedTemplate[]> {
    const repoPath = getRepoPath(repo.name)
    const templates: IndexedTemplate[] = []
    
    try {
      // Scan all YAML files
      const yamlFiles = await scanDirectory(repoPath, {
        extensions: ['.yaml', '.yml'],
        recursive: true,
        includeHidden: false
      })
      
      logger.debug(t('index_cache.debug.scan_repo', { name: repo.name, count: yamlFiles.length }))
      
      for (const filePath of yamlFiles) {
        try {
          const template = await this.parseTemplateFile(filePath, repo.name)
          if (template) {
            templates.push(template)
          }
        } catch (error: any) {
          logger.debug(t('index_cache.debug.parse_template_failed', { file: filePath, error: error.message }))
          // Continue processing other files, don't interrupt due to single file failure
        }
      }
      
      logger.debug(t('index_cache.debug.repo_parse_success', { name: repo.name, count: templates.length }))
    } catch (error: any) {
      logger.warn(t('index_cache.warn.scan_repo_failed', { name: repo.name, error: error.message }))
    }
    
    return templates
  }
  
  /**
   * Parse single template file
   */
  private async parseTemplateFile(filePath: string, repoName: string): Promise<IndexedTemplate | null> {
    try {
      const template = await readYamlFile<Template>(filePath)
      
      // Validate template format
      if (!this.isValidTemplate(template)) {
        logger.debug(t('index_cache.debug.invalid_template_format', { file: filePath }))
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
      
      // Add specific fields for different types of templates
      if (template.type === 'prompt') {
        indexed.content = (template as any).content
      } else if (template.type === 'context') {
        indexed.targets = (template as any).targets
      }
      
      return indexed
    } catch (error: any) {
      logger.debug(t('index_cache.debug.parse_template_failed', { file: filePath, error: error.message }))
      return null
    }
  }
  
  /**
   * Validate if template format is correct
   */
  private isValidTemplate(template: any): template is Template {
    return template &&
           typeof template.id === 'string' &&
           (template.type === 'prompt' || template.type === 'context') &&
           typeof template.name === 'string'
  }
  
  /**
   * Get or build index
   */
  async getIndex(repos: RepoConfig[], forceRebuild = false): Promise<TemplateIndex> {
    if (!forceRebuild) {
      // Try to read cache
      const cache = await this.readCache()
      if (cache && !await this.needsUpdate(repos)) {
        logger.debug(t('index_cache.debug.using_cached_index'))
        return cache
      }
    }
    
    // Build new index
    return this.buildIndex(repos)
  }
  
  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    try {
      if (await fileExists(INDEX_CACHE_PATH)) {
        const { unlink } = await import('node:fs/promises')
        await unlink(INDEX_CACHE_PATH)
        logger.debug(t('index_cache.debug.cache_cleared'))
      }
    } catch (error: any) {
      logger.debug(t('index_cache.debug.clear_cache_failed', { error: error.message }))
    }
  }
  
  /**
   * Get cache statistics
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

// Global index cache manager instance
export const indexCache = new IndexCacheManager()

/**
 * Shortcut method: Get index
 */
export async function getTemplateIndex(repos: RepoConfig[], forceRebuild = false): Promise<TemplateIndex> {
  return indexCache.getIndex(repos, forceRebuild)
}

/**
 * Shortcut method: Rebuild index
 */
export async function rebuildTemplateIndex(repos: RepoConfig[]): Promise<TemplateIndex> {
  return indexCache.buildIndex(repos)
}

/**
 * Shortcut method: Clear index cache
 */
export async function clearTemplateIndex(): Promise<void> {
  return indexCache.clearCache()
}
