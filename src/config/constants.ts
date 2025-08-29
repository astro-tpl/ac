/**
 * 应用常量定义
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

// 应用信息
export const APP_NAME = 'ac'
export const APP_VERSION = '1.0.0'
export const CURRENT_CONFIG_VERSION = 1

// 配置文件名
export const PROJECT_CONFIG_FILENAME = '.ac.yaml'
export const GLOBAL_CONFIG_FILENAME = 'config.yaml'

// 默认路径
export const AC_HOME = join(homedir(), '.ac')
export const GLOBAL_CONFIG_PATH = join(AC_HOME, GLOBAL_CONFIG_FILENAME)
export const REPOS_CACHE_DIR = join(AC_HOME, 'repos')
export const INDEX_CACHE_PATH = join(AC_HOME, 'index.json')

// 默认仓库配置
export const DEFAULT_TEST_REPO = 'https://github.com/astro-tpl/ac-tpl.git'
export const DEFAULT_BRANCH = 'main'

// 搜索权重配置
export const SEARCH_WEIGHTS = {
  HEAD_FIELDS: 3,  // id/name/labels/summary 字段权重
  CONTENT: 1,      // content 内容权重
} as const

// 默认配置值
export const DEFAULT_CONFIG = {
  version: CURRENT_CONFIG_VERSION,
  repos: [],
  defaults: {
    repo: '',
    dest: '.',
    mode: 'write' as const,
    lang: 'zh',
  },
} as const

// 文件操作常量
export const FILE_ENCODING = 'utf8'
export const TEMP_FILE_SUFFIX = '.tmp'
