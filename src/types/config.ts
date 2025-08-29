/**
 * 配置文件类型定义
 */

// 仓库配置
export interface RepoConfig {
  /** 仓库别名 */
  name: string
  /** Git URL */
  git: string
  /** 分支名 */
  branch: string
  /** 本地路径（可选，默认按规则拼接） */
  path?: string
}

// 默认配置
export interface DefaultConfig {
  /** 默认仓库别名 */
  repo: string
  /** 默认目标目录 */
  dest: string
  /** 默认写入模式 */
  mode: 'write' | 'append' | 'merge'
}

// 项目配置文件 (.ac.yaml)
export interface ProjectConfig {
  /** 配置版本 */
  version: number
  /** 仓库列表 */
  repos: RepoConfig[]
  /** 默认配置 */
  defaults: DefaultConfig
}

// 全局配置文件 (~/.ac/config.yaml)
export interface GlobalConfig {
  /** 配置版本 */
  version: number
  /** 仓库列表 */
  repos: RepoConfig[]
  /** 默认配置 */
  defaults: DefaultConfig
}

// 配置解析结果
export interface ResolvedConfig {
  /** 配置来源类型 */
  source: 'project' | 'global'
  /** 配置文件路径 */
  path: string
  /** 配置内容 */
  config: ProjectConfig | GlobalConfig
}
