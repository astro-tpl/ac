# AC - AI Context CLI

AI Context CLI - A unified command-line tool for managing AI programming contexts and prompts

## Installation

```bash
npm install -g @astro-tpl/ac
```

or

```bash
npx @astro-tpl/ac --help
```

## Usage

### Search Templates
```bash
# Search all templates
ac search

# Search by keyword
ac search react

# Search by type
ac search --type context

# Search by labels
ac search --label frontend
```

### Apply Templates
```bash
# Apply context template
ac apply --context template-id

# Apply prompt template
ac apply --prompt template-id
```

### Manage Repositories
```bash
# Add repository
ac repo add <alias> <url>

# List repositories
ac repo list

# Update repository
ac repo update <alias>
```

### Update CLI
```bash
ac update
```

## Features

- 🔍 Intelligent Search - Support keyword, type, and label search
- 📋 Template Application - Quickly apply context and prompt templates
- 🗂️ Repository Management - Manage multiple template repositories
- 🌐 Internationalization - Support for Chinese and English interfaces
- ⚡ High Performance - Fast search based on fuzzysort
- 🎯 Smart Matching - Support Chinese pinyin search

## Configuration

### Project Configuration (.ac.yaml)
```yaml
repositories:
  templates:
    url: https://github.com/your-org/templates.git
    branch: main
```

### Global Configuration (~/.ac/config.yaml)
```yaml
language: zh
repositories:
  global-templates:
    url: https://github.com/global/templates.git
```

## Development

```bash
# Install dependencies
pnpm install

# Build
npm run build

# Test
npm test

# Package
npm run pack
```
