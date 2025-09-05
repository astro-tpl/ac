/**
 * YAML read/write utility
 */

import * as yaml from 'js-yaml'

import {t} from '../i18n'
import {ConfigValidationError, TemplateValidationError} from '../types/errors'
import {atomicWriteFile, readFile} from './fs'

/**
 * Read and parse YAML file
 */
export async function readYamlFile<T = any>(filepath: string): Promise<T> {
  try {
    const content = await readFile(filepath)
    const parsed = yaml.load(content, {
      // Strict mode, no duplicate keys allowed
      json: true,
      // No arbitrary code execution allowed
      schema: yaml.JSON_SCHEMA,
    })

    if (parsed === null || parsed === undefined) {
      throw new Error(t('error.file.read_failed', {path: filepath}))
    }

    return parsed as T
  } catch (error: any) {
    if (error.name === 'YAMLException') {
      throw new ConfigValidationError(t('error.yaml.parse_failed', {error: `${filepath} - ${error.message}`}))
    }

    throw error
  }
}

/**
 * Serialize object to YAML and write to file
 */
export async function writeYamlFile(filepath: string, data: any): Promise<void> {
  try {
    const yamlContent = yaml.dump(data, {
      // Use flow format, more compact
      flowLevel: -1,
      // Don't force quotes
      forceQuotes: false,
      // Indent 2 spaces
      indent: 2,
      // Don't wrap long strings
      lineWidth: -1,
      // Don't escape Unicode characters
      noCompatMode: true,
      // Don't add document separator
      noRefs: true,
      // String quoting strategy
      quotingType: '"',
    })

    await atomicWriteFile(filepath, yamlContent)
  } catch (error: any) {
    throw new ConfigValidationError(t('error.file.write_failed', {path: `${filepath} - ${error.message}`}))
  }
}

/**
 * Parse YAML string
 */
export function parseYaml<T = any>(content: string): T {
  try {
    const parsed = yaml.load(content, {
      json: true,
      schema: yaml.JSON_SCHEMA,
    })

    if (parsed === null || parsed === undefined) {
      throw new Error(t('error.yaml.parse_failed', {error: 'empty content'}))
    }

    return parsed as T
  } catch (error: any) {
    if (error.name === 'YAMLException') {
      throw new TemplateValidationError(t('error.yaml.parse_failed', {error: error.message}))
    }

    throw error
  }
}

/**
 * Serialize object to YAML string
 */
export function stringifyYaml(data: any): string {
  try {
    return yaml.dump(data, {
      flowLevel: -1,
      forceQuotes: false,
      indent: 2,
      lineWidth: -1,
      noCompatMode: true,
      noRefs: true,
      quotingType: '"',
    })
  } catch (error: any) {
    throw new ConfigValidationError(
      t('yaml.error.serialize_failed', {error: error.message}),
    )
  }
}

/**
 * Validate if YAML format is correct
 */
export function isValidYaml(content: string): boolean {
  try {
    yaml.load(content, {
      json: true,
      schema: yaml.JSON_SCHEMA,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Safely parse YAML (return null instead of throwing exception)
 */
export function safeParseYaml<T = any>(content: string): T | null {
  try {
    return parseYaml<T>(content)
  } catch {
    return null
  }
}

/**
 * Format YAML content (beautify)
 */
export function formatYaml(content: string): string {
  try {
    const parsed = parseYaml(content)
    return stringifyYaml(parsed)
  } catch (error: any) {
    throw new ConfigValidationError(t('error.yaml.parse_failed', {error: error.message}))
  }
}
