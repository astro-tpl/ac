#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

async function fixImportsInFile(filePath) {
  try {
    let content = await readFile(filePath, 'utf-8')
    let modified = false

    // Fix relative imports without extensions
    content = content.replace(
      /from ['"](\.\.[^'"]*?)['"](?![^'"]*\.js)/g,
      (match, path) => {
        if (!path.endsWith('.js')) {
          modified = true
          // Special handling for directory imports
          if (path.endsWith('/i18n')) {
            return `from '${path}/index.js'`
          }
          return `from '${path}.js'`
        }
        return match
      }
    )

    // Fix relative imports starting with ./
    content = content.replace(
      /from ['"](\.[^'"]*?)['"](?![^'"]*\.js)/g,
      (match, path) => {
        if (!path.endsWith('.js')) {
          modified = true
          // Special handling for directory imports
          if (path.endsWith('/i18n')) {
            return `from '${path}/index.js'`
          }
          return `from '${path}.js'`
        }
        return match
      }
    )

    if (modified) {
      await writeFile(filePath, content, 'utf-8')
      console.log(`Fixed imports in: ${filePath}`)
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message)
  }
}

async function processDirectory(dirPath) {
  try {
    const items = await readdir(dirPath, { withFileTypes: true })
    
    for (const item of items) {
      const fullPath = join(dirPath, item.name)
      
      if (item.isDirectory()) {
        await processDirectory(fullPath)
      } else if (item.isFile() && ['.js', '.jsx'].includes(extname(item.name))) {
        await fixImportsInFile(fullPath)
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error.message)
  }
}

// Start processing from dist directory
await processDirectory('./dist')
console.log('ESM import fixing completed!')
