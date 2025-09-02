/**
 * 剪切板操作测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  ClipboardManager,
  copyToClipboard,
  readFromClipboard,
  isClipboardAvailable,
  copyTemplateToClipboard
} from '../infra/clipboard'

// Mock clipboardy
vi.mock('clipboardy', () => ({
  default: {
    write: vi.fn(),
    read: vi.fn()
  }
}))

// Mock logger
vi.mock('../infra/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

// Mock i18n
vi.mock('../i18n', () => ({
  t: vi.fn((key: string) => key)
}))

import clipboardy from 'clipboardy'

describe('ClipboardManager', () => {
  let clipboardManager: ClipboardManager

  beforeEach(() => {
    clipboardManager = new ClipboardManager()
    vi.clearAllMocks()
  })

  describe('copyText', () => {
    it('should copy text successfully', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockResolvedValue(undefined)

      const result = await clipboardManager.copyText('test content')

      expect(result.success).toBe(true)
      expect(result.length).toBe(12)
      expect(mockWrite).toHaveBeenCalledWith('test content')
    })

    it('should handle empty text', async () => {
      const result = await clipboardManager.copyText('')

      expect(result.success).toBe(false)
      expect(result.error).toBe('clipboard.empty_content')
    })

    it('should handle copy errors', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockRejectedValue(new Error('Clipboard error'))

      const result = await clipboardManager.copyText('test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Clipboard error')
    })
  })

  describe('readText', () => {
    it('should read text successfully', async () => {
      const mockRead = vi.mocked(clipboardy.read)
      mockRead.mockResolvedValue('clipboard content')

      const result = await clipboardManager.readText()

      expect(result.success).toBe(true)
      expect(result.content).toBe('clipboard content')
      expect(result.length).toBe(17)
    })

    it('should handle read errors', async () => {
      const mockRead = vi.mocked(clipboardy.read)
      mockRead.mockRejectedValue(new Error('Read error'))

      const result = await clipboardManager.readText()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Read error')
    })
  })

  describe('isAvailable', () => {
    it('should return true when clipboard is available', async () => {
      const mockRead = vi.mocked(clipboardy.read)
      mockRead.mockResolvedValue('test')

      const result = await clipboardManager.isAvailable()

      expect(result).toBe(true)
    })

    it('should return false when clipboard is not available', async () => {
      const mockRead = vi.mocked(clipboardy.read)
      mockRead.mockRejectedValue(new Error('Not available'))

      const result = await clipboardManager.isAvailable()

      expect(result).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear clipboard successfully', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockResolvedValue(undefined)

      const result = await clipboardManager.clear()

      expect(result.success).toBe(true)
      expect(result.length).toBe(0)
      expect(mockWrite).toHaveBeenCalledWith('')
    })

    it('should handle clear errors', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockRejectedValue(new Error('Clear error'))

      const result = await clipboardManager.clear()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Clear error')
    })
  })

  describe('copyTemplateContent', () => {
    it('should copy prompt template content', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockResolvedValue(undefined)

      const template = {
        id: 'test-prompt',
        type: 'prompt' as const,
        name: 'Test Prompt',
        content: 'This is a test prompt'
      }

      const result = await clipboardManager.copyTemplateContent(template)

      expect(result.success).toBe(true)
      expect(mockWrite).toHaveBeenCalledWith('This is a test prompt')
    })

    it('should copy context template content', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockResolvedValue(undefined)

      const template = {
        id: 'test-context',
        type: 'context' as const,
        name: 'Test Context',
        targets: [
          { path: 'file1.txt', mode: 'write' },
          { path: 'file2.txt', mode: 'append' }
        ]
      }

      const result = await clipboardManager.copyTemplateContent(template)

      expect(result.success).toBe(true)
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('# Test Context')
      )
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('Template ID: test-context')
      )
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('- file1.txt (write)')
      )
    })

    it('should handle empty template content', async () => {
      const template = {
        id: 'empty-template',
        type: 'prompt' as const,
        name: 'Empty Template',
        content: ''
      }

      const result = await clipboardManager.copyTemplateContent(template)

      expect(result.success).toBe(false)
      expect(result.error).toBe('clipboard.no_content_to_copy')
    })
  })

  describe('copySearchSummary', () => {
    it('should copy search results summary', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockResolvedValue(undefined)

      const results = [
        {
          template: {
            id: 'template1',
            type: 'prompt',
            name: 'Template 1',
            repoName: 'repo1'
          },
          score: 0.95
        },
        {
          template: {
            id: 'template2',
            type: 'context',
            name: 'Template 2',
            repoName: 'repo2'
          },
          score: 0.80
        }
      ]

      const result = await clipboardManager.copySearchSummary(results)

      expect(result.success).toBe(true)
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('# Search Results (2 templates)')
      )
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('## Template 1')
      )
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('- Score: 0.95')
      )
    })

    it('should handle empty search results', async () => {
      const result = await clipboardManager.copySearchSummary([])

      expect(result.success).toBe(false)
      expect(result.error).toBe('clipboard.no_results_to_copy')
    })
  })
})

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('copyToClipboard', () => {
    it('should work as convenience function', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockResolvedValue(undefined)

      const result = await copyToClipboard('test')

      expect(result.success).toBe(true)
      expect(mockWrite).toHaveBeenCalledWith('test')
    })
  })

  describe('readFromClipboard', () => {
    it('should work as convenience function', async () => {
      const mockRead = vi.mocked(clipboardy.read)
      mockRead.mockResolvedValue('test content')

      const result = await readFromClipboard()

      expect(result.success).toBe(true)
      expect(result.content).toBe('test content')
    })
  })

  describe('isClipboardAvailable', () => {
    it('should work as convenience function', async () => {
      const mockRead = vi.mocked(clipboardy.read)
      mockRead.mockResolvedValue('test')

      const result = await isClipboardAvailable()

      expect(result).toBe(true)
    })
  })

  describe('copyTemplateToClipboard', () => {
    it('should work as convenience function', async () => {
      const mockWrite = vi.mocked(clipboardy.write)
      mockWrite.mockResolvedValue(undefined)

      const template = {
        id: 'test',
        type: 'prompt' as const,
        name: 'Test',
        content: 'test content'
      }

      const result = await copyTemplateToClipboard(template)

      expect(result.success).toBe(true)
      expect(mockWrite).toHaveBeenCalledWith('test content')
    })
  })
})

