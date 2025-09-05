/**
 * Error type definitions
 */
import {t} from '../i18n'

// Base error class
export abstract class ACError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }

  format(): string {
    let output = `❌ ${t('common.error')}: ${this.message}`
    if (this.suggestion) {
      output += `\n💡 ${t('common.suggestion')}: ${this.suggestion}`
    }

    if (this.code) {
      output += `\n🔍 ${t('common.error_code')}: ${this.code}`
    }

    return output
  }

  abstract code: string

  abstract suggestion?: string
}

// Configuration related errors
export class ConfigNotFoundError extends ACError {
  code = 'CONFIG_NOT_FOUND'
  suggestion = t('error.suggestion.use_ac_init')
}

export class ConfigValidationError extends ACError {
  code = 'CONFIG_VALIDATION_ERROR'
  suggestion = t('error.suggestion.check_config_format')
}

export class VersionIncompatibleError extends ACError {
  code = 'VERSION_INCOMPATIBLE'
  suggestion = t('error.suggestion.upgrade_config_version')
}

// Repository related errors
export class RepoNotFoundError extends ACError {
  code = 'REPO_NOT_FOUND'
  suggestion = t('error.suggestion.repo_not_found')
}

export class GitOperationError extends ACError {
  code = 'GIT_OPERATION_ERROR'
  suggestion = t('error.suggestion.git_operation_failed')
}

// Template related errors
export class TemplateNotFoundError extends ACError {
  code = 'TEMPLATE_NOT_FOUND'
  suggestion = t('error.suggestion.template_not_found')
}

export class TemplateValidationError extends ACError {
  code = 'TEMPLATE_VALIDATION_ERROR'
  suggestion = t('error.suggestion.template_validation_failed')
}

// Tool dependency errors
export class RipgrepNotFoundError extends ACError {
  code = 'RIPGREP_NOT_FOUND'
  suggestion = t('error.suggestion.ripgrep_not_found')
}

// File operation errors
export class FileOperationError extends ACError {
  code = 'FILE_OPERATION_ERROR'
  suggestion = t('error.suggestion.file_operation_failed')
}

export class MergeNotSupportedError extends ACError {
  code = 'MERGE_NOT_SUPPORTED'
  suggestion = t('error.suggestion.merge_not_supported')
}
