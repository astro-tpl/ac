/**
 * Version compatibility check utility
 */

import {CURRENT_CONFIG_VERSION} from '../config/constants'
import {t} from '../i18n'
import {VersionIncompatibleError} from '../types/errors'

/**
 * Check configuration version compatibility
 * Only check major version number (1.x.x and 2.x.x are incompatible)
 */
export function checkVersionCompatibility(configVersion: number): void {
  const currentMajor = Math.floor(CURRENT_CONFIG_VERSION)
  const configMajor = Math.floor(configVersion)

  if (currentMajor !== configMajor) {
    throw new VersionIncompatibleError(
      t('version.error.incompatible', {configVersion, currentVersion: CURRENT_CONFIG_VERSION}),
    )
  }
}

/**
 * Check if configuration version is valid
 */
export function isValidVersion(version: unknown): version is number {
  return typeof version === 'number' && version > 0 && Number.isInteger(version)
}

/**
 * Get version compatibility information
 */
export function getVersionCompatibilityInfo(configVersion: number): {
  configMajor: number
  currentMajor: number
  isCompatible: boolean
  message: string
} {
  const currentMajor = Math.floor(CURRENT_CONFIG_VERSION)
  const configMajor = Math.floor(configVersion)
  const isCompatible = currentMajor === configMajor

  let message: string
  if (isCompatible) {
    message = t('version.compatible')
  } else if (configMajor < currentMajor) {
    message = t('version.config_too_low')
  } else {
    message = t('version.config_too_high')
  }

  return {
    configMajor,
    currentMajor,
    isCompatible,
    message,
  }
}

/**
 * Format version number display
 */
export function formatVersion(version: number): string {
  return `v${version}.x`
}

/**
 * Generate version upgrade suggestion
 */
export function getUpgradeSuggestion(configVersion: number): string {
  const currentMajor = Math.floor(CURRENT_CONFIG_VERSION)
  const configMajor = Math.floor(configVersion)

  if (configMajor < currentMajor) {
    return t('version.suggestion.upgrade_config', {version: formatVersion(CURRENT_CONFIG_VERSION)})
  }

  if (configMajor > currentMajor) {
    return t('version.suggestion.upgrade_tool', {version: formatVersion(configVersion)})
  }

  return t('version.suggestion.compatible')
}
