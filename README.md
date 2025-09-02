# AC - AI Context CLI

AI Context CLI - 统一管理 AI 编程上下文与提示词的命令行工具

## 安装

```bash
npm install -g ac
```

## 使用

### 搜索模板
```bash
# 搜索所有模板
ac search

# 按关键词搜索
ac search react

# 按类型搜索
ac search --type context

# 按标签搜索
ac search --label frontend
```

### 应用模板
```bash
# 应用上下文模板
ac apply --context template-id

# 应用提示词模板
ac apply --prompt template-id
```

### 管理仓库
```bash
# 添加仓库
ac repo add <alias> <url>

# 列出仓库
ac repo list

# 更新仓库
ac repo update <alias>
```

### 更新 CLI
```bash
ac update
```

## 功能特性

- 🔍 智能搜索 - 支持关键词、类型、标签搜索
- 📋 模板应用 - 快速应用上下文和提示词模板
- 🗂️ 仓库管理 - 管理多个模板仓库
- 🌐 国际化 - 支持中英文界面
- ⚡ 高性能 - 基于 fuzzysort 的快速搜索
- 🎯 智能匹配 - 支持中文拼音搜索

## 配置

### 项目配置 (.ac.yaml)
```yaml
repositories:
  templates:
    url: https://github.com/your-org/templates.git
    branch: main
```

### 全局配置 (~/.ac/config.yaml)
```yaml
language: zh
repositories:
  global-templates:
    url: https://github.com/global/templates.git
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建
npm run build

# 测试
npm test

# 打包
npm run pack
```
