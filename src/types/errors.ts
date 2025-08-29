/**
 * 错误类型定义
 */

// 基础错误类
export abstract class ACError extends Error {
  abstract code: string
  abstract suggestion?: string

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }

  format(): string {
    let output = `❌ 错误: ${this.message}`
    if (this.suggestion) {
      output += `\n💡 建议: ${this.suggestion}`
    }
    if (this.code) {
      output += `\n🔍 错误代码: ${this.code}`
    }
    return output
  }
}

// 配置相关错误
export class ConfigNotFoundError extends ACError {
  code = 'CONFIG_NOT_FOUND'
  suggestion = '使用 `ac init` 创建项目配置文件'
}

export class ConfigValidationError extends ACError {
  code = 'CONFIG_VALIDATION_ERROR'
  suggestion = '检查配置文件格式是否正确'
}

export class VersionIncompatibleError extends ACError {
  code = 'VERSION_INCOMPATIBLE'
  suggestion = '请升级配置文件版本或使用兼容的 ac 版本'
}

// 仓库相关错误
export class RepoNotFoundError extends ACError {
  code = 'REPO_NOT_FOUND'
  suggestion = '使用 `ac repo add` 添加仓库或检查仓库别名是否正确'
}

export class GitOperationError extends ACError {
  code = 'GIT_OPERATION_ERROR'
  suggestion = '检查网络连接和 Git 仓库访问权限'
}

// 模板相关错误
export class TemplateNotFoundError extends ACError {
  code = 'TEMPLATE_NOT_FOUND'
  suggestion = '使用 `ac search` 查找可用的模板'
}

export class TemplateValidationError extends ACError {
  code = 'TEMPLATE_VALIDATION_ERROR'
  suggestion = '检查模板 YAML 文件格式是否正确'
}

// 工具依赖错误
export class RipgrepNotFoundError extends ACError {
  code = 'RIPGREP_NOT_FOUND'
  suggestion = '安装 ripgrep: https://github.com/BurntSushi/ripgrep#installation'
}

// 文件操作错误
export class FileOperationError extends ACError {
  code = 'FILE_OPERATION_ERROR'
  suggestion = '检查文件路径和权限'
}

export class MergeNotSupportedError extends ACError {
  code = 'MERGE_NOT_SUPPORTED'
  suggestion = '合并模式仅支持 JSON 文件，请使用 write 或 append 模式'
}
