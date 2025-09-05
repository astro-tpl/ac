/**
 * Application constants definition
 */

import {homedir} from 'node:os'
import {join} from 'node:path'

// Application information
export const APP_NAME = 'ac'
export const APP_VERSION = '1.0.0'
export const CURRENT_CONFIG_VERSION = 1

// Configuration file names
export const PROJECT_CONFIG_FILENAME = '.ac.yaml'
export const GLOBAL_CONFIG_FILENAME = 'config.yaml'

// Default paths
export const AC_HOME = join(homedir(), '.ac')
export const GLOBAL_CONFIG_PATH = join(AC_HOME, GLOBAL_CONFIG_FILENAME)
export const REPOS_CACHE_DIR = join(AC_HOME, 'repos')
export const INDEX_CACHE_PATH = join(AC_HOME, 'index.json')

// Default repository configuration
export const DEFAULT_TEST_REPO = 'https://github.com/astro-tpl/ac-tpl.git'
export const DEFAULT_BRANCH = 'main'

// Search weight configuration
export const SEARCH_WEIGHTS = {
  CONTENT: 1,      // Weight for content
  HEAD_FIELDS: 3,  // Weight for id/name/labels/summary fields
} as const

// Default configuration values
export const DEFAULT_CONFIG = {
  defaults: {
    dest: '.',
    lang: 'zh',
    mode: 'write' as const,
    repo: '',
  },
  repos: [],
  version: CURRENT_CONFIG_VERSION,
} as const

// File operation constants
export const FILE_ENCODING = 'utf8'
export const TEMP_FILE_SUFFIX = '.tmp'
