/**
 * JSON shallow merge utility
 */

import {t} from '../i18n'
import {FileOperationError, MergeNotSupportedError} from '../types/errors'
import {atomicWriteFile, readFile} from './fs'
import {logger} from './logger'

/**
 * Check if file is in JSON format
 */
export function isJsonFile(filepath: string): boolean {
  return filepath.toLowerCase().endsWith('.json')
}

/**
 * Safely parse JSON string
 */
export function parseJsonSafely(content: string): any {
  try {
    return JSON.parse(content)
  } catch (error: any) {
    throw new FileOperationError(
      t('json_merge.error.invalid_format', {error: error.message}),
    )
  }
}

/**
 * Format JSON string
 */
export function stringifyJson(data: any): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Execute shallow merge of JSON objects
 * Only merge first level properties, deeply nested objects will be completely replaced
 */
export function mergeJsonObjects(target: any, source: any): any {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    throw new MergeNotSupportedError(
      t('json_merge.error.only_plain_objects'),
    )
  }

  const result = {...target}

  for (const [key, value] of Object.entries(source)) {
    result[key] = value
  }

  return result
}

/**
 * Check if it's a plain object (not array, not null)
 */
function isPlainObject(obj: any): boolean {
  return obj !== null
         && typeof obj === 'object'
         && !Array.isArray(obj)
         && obj.constructor === Object
}

/**
 * Analyze merge differences
 */
export function analyzeJsonMergeDiff(target: any, source: any): {
  added: string[]
  modified: string[]
  unchanged: string[]
} {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return {added: [], modified: [], unchanged: []}
  }

  const added: string[] = []
  const modified: string[] = []
  const unchanged: string[] = []

  const targetKeys = new Set(Object.keys(target))
  const sourceKeys = new Set(Object.keys(source))

  // Check each key of source object
  for (const key of sourceKeys) {
    if (!targetKeys.has(key)) {
      added.push(key)
    } else if (JSON.stringify(target[key]) === JSON.stringify(source[key])) {
      unchanged.push(key)
    } else {
      modified.push(key)
    }
  }

  return {added, modified, unchanged}
}

/**
 * Merge JSON file
 */
export async function mergeJsonFile(
  filepath: string,
  newContent: string,
  options: {
    createIfNotExists?: boolean
  } = {},
): Promise<{
  diff: {
    added: string[]
    modified: string[]
    unchanged: string[]
  }
  success: boolean
}> {
  if (!isJsonFile(filepath)) {
    throw new MergeNotSupportedError(
      t('json_merge.error.file_not_json', {file: filepath}),
    )
  }

  const {createIfNotExists = true} = options

  // Parse new content
  const sourceData = parseJsonSafely(newContent)

  let targetData: any = {}
  let fileExists = false

  try {
    // Try to read existing file
    const existingContent = await readFile(filepath)
    targetData = parseJsonSafely(existingContent)
    fileExists = true
  } catch {
    if (!createIfNotExists) {
      throw new FileOperationError(
        t('json_merge.error.file_not_exists_no_create', {file: filepath}),
      )
    }

    // File doesn't exist, use empty object as target
    logger.debug(t('json_merge.debug.creating_new_file', {file: filepath}))
  }

  // Analyze differences
  const diff = analyzeJsonMergeDiff(targetData, sourceData)

  // Execute merge
  const mergedData = mergeJsonObjects(targetData, sourceData)

  // Write merge result
  const mergedContent = stringifyJson(mergedData)
  await atomicWriteFile(filepath, mergedContent)

  logger.debug(t('json_merge.debug.merge_completed', {file: filepath}))
  logger.debug(t('json_merge.debug.keys_added', {count: diff.added.length}))
  logger.debug(t('json_merge.debug.keys_modified', {count: diff.modified.length}))
  logger.debug(t('json_merge.debug.keys_unchanged', {count: diff.unchanged.length}))

  return {
    diff,
    success: true,
  }
}

/**
 * Preview JSON merge result (without actually writing to file)
 */
export async function previewJsonMerge(
  filepath: string,
  newContent: string,
): Promise<{
  canMerge: boolean
  diff?: {
    added: string[]
    modified: string[]
    unchanged: string[]
  }
  error?: string
  preview?: string
}> {
  try {
    if (!isJsonFile(filepath)) {
      return {
        canMerge: false,
        error: t('json_merge.error.file_not_json', {file: filepath}),
      }
    }

    // Parse new content
    const sourceData = parseJsonSafely(newContent)

    let targetData: any = {}

    try {
      const existingContent = await readFile(filepath)
      targetData = parseJsonSafely(existingContent)
    } catch {
      // File doesn't exist or parsing failed, use empty object
    }

    // Analyze differences
    const diff = analyzeJsonMergeDiff(targetData, sourceData)

    // Generate preview
    const mergedData = mergeJsonObjects(targetData, sourceData)
    const preview = stringifyJson(mergedData)

    return {
      canMerge: true,
      diff,
      preview,
    }
  } catch (error: any) {
    return {
      canMerge: false,
      error: error.message,
    }
  }
}

/**
 * Validate if JSON content can be safely merged
 */
export function canSafelyMergeJson(content: string): {
  canMerge: boolean
  error?: string
} {
  try {
    const data = parseJsonSafely(content)

    if (!isPlainObject(data)) {
      return {
        canMerge: false,
        error: t('json_merge.error.content_must_be_object'),
      }
    }

    return {canMerge: true}
  } catch (error: any) {
    return {
      canMerge: false,
      error: error.message,
    }
  }
}
