/**
 * 版本兼容性校验工具
 */

import { CURRENT_CONFIG_VERSION } from '../config/constants.js'
import { VersionIncompatibleError } from '../types/errors.js'

/**
 * 检查配置版本兼容性
 * 只校验大版本号（1.x.x 和 2.x.x 不兼容）
 */
export function checkVersionCompatibility(configVersion: number): void {
  const currentMajor = Math.floor(CURRENT_CONFIG_VERSION)
  const configMajor = Math.floor(configVersion)
  
  if (currentMajor !== configMajor) {
    throw new VersionIncompatibleError(
      `配置版本 ${configVersion} 与当前工具版本 ${CURRENT_CONFIG_VERSION} 不兼容，请升级配置文件`
    )
  }
}

/**
 * 检查配置版本是否有效
 */
export function isValidVersion(version: unknown): version is number {
  return typeof version === 'number' && version > 0 && Number.isInteger(version)
}

/**
 * 获取版本兼容性信息
 */
export function getVersionCompatibilityInfo(configVersion: number): {
  isCompatible: boolean
  currentMajor: number
  configMajor: number
  message: string
} {
  const currentMajor = Math.floor(CURRENT_CONFIG_VERSION)
  const configMajor = Math.floor(configVersion)
  const isCompatible = currentMajor === configMajor
  
  let message: string
  if (isCompatible) {
    message = '版本兼容'
  } else if (configMajor < currentMajor) {
    message = '配置版本过低，需要升级'
  } else {
    message = '配置版本过高，需要升级 ac 工具'
  }
  
  return {
    isCompatible,
    currentMajor,
    configMajor,
    message
  }
}

/**
 * 格式化版本号显示
 */
export function formatVersion(version: number): string {
  return `v${version}.x`
}

/**
 * 生成版本升级建议
 */
export function getUpgradeSuggestion(configVersion: number): string {
  const currentMajor = Math.floor(CURRENT_CONFIG_VERSION)
  const configMajor = Math.floor(configVersion)
  
  if (configMajor < currentMajor) {
    return `请使用 'ac init --force' 升级配置文件到 ${formatVersion(CURRENT_CONFIG_VERSION)}`
  } else if (configMajor > currentMajor) {
    return `请升级 ac 工具到 ${formatVersion(configVersion)} 或更高版本`
  }
  
  return '版本兼容，无需升级'
}
