/**
 * UI 类型定义测试
 */

import { describe, it, expect } from 'vitest'
import { 
  DEFAULT_THEME, 
  DEFAULT_KEY_BINDINGS, 
  DEFAULT_SEARCH_CONFIG,
  type SearchState,
  type ApplyState,
  type UITheme,
  type KeyBindings,
  type SearchConfig
} from '../types/ui'

describe('UI Types', () => {
  describe('DEFAULT_THEME', () => {
    it('should have all required theme properties', () => {
      expect(DEFAULT_THEME).toHaveProperty('primary')
      expect(DEFAULT_THEME).toHaveProperty('selectedBg')
      expect(DEFAULT_THEME).toHaveProperty('selectedFg')
      expect(DEFAULT_THEME).toHaveProperty('error')
      expect(DEFAULT_THEME).toHaveProperty('success')
      expect(DEFAULT_THEME).toHaveProperty('warning')
      expect(DEFAULT_THEME).toHaveProperty('secondary')
    })

    it('should have valid color values', () => {
      expect(DEFAULT_THEME.primary).toMatch(/^#[0-9a-f]{6}$/i)
      expect(DEFAULT_THEME.selectedBg).toMatch(/^#[0-9a-f]{6}$/i)
      expect(DEFAULT_THEME.selectedFg).toMatch(/^#[0-9a-f]{6}$/i)
      expect(DEFAULT_THEME.error).toMatch(/^#[0-9a-f]{6}$/i)
      expect(DEFAULT_THEME.success).toMatch(/^#[0-9a-f]{6}$/i)
      expect(DEFAULT_THEME.warning).toMatch(/^#[0-9a-f]{6}$/i)
      expect(DEFAULT_THEME.secondary).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  describe('DEFAULT_KEY_BINDINGS', () => {
    it('should have all required key binding properties', () => {
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('moveUp')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('moveDown')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('select')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('apply')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('copy')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('toggleDetail')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('clearSearch')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('help')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('quit')
      expect(DEFAULT_KEY_BINDINGS).toHaveProperty('back')
    })

    it('should have string key combinations', () => {
      Object.values(DEFAULT_KEY_BINDINGS).forEach(key => {
        expect(typeof key).toBe('string')
        expect(key.length).toBeGreaterThan(0)
      })
    })

    it('should include expected key combinations', () => {
      expect(DEFAULT_KEY_BINDINGS.moveUp).toBe('k')
      expect(DEFAULT_KEY_BINDINGS.moveDown).toBe('j')
      expect(DEFAULT_KEY_BINDINGS.select).toBe('enter')
      expect(DEFAULT_KEY_BINDINGS.apply).toBe('a')
      expect(DEFAULT_KEY_BINDINGS.copy).toBe('c')
      expect(DEFAULT_KEY_BINDINGS.toggleDetail).toBe('d')
      expect(DEFAULT_KEY_BINDINGS.clearSearch).toBe('u')
      expect(DEFAULT_KEY_BINDINGS.help).toBe('h')
      expect(DEFAULT_KEY_BINDINGS.quit).toBe('q')
      expect(DEFAULT_KEY_BINDINGS.back).toBe('escape')
    })
  })

  describe('DEFAULT_SEARCH_CONFIG', () => {
    it('should have all required search config properties', () => {
      expect(DEFAULT_SEARCH_CONFIG).toHaveProperty('debounceMs')
      expect(DEFAULT_SEARCH_CONFIG).toHaveProperty('maxDisplayResults')
      expect(DEFAULT_SEARCH_CONFIG).toHaveProperty('enablePinyin')
      expect(DEFAULT_SEARCH_CONFIG).toHaveProperty('threshold')
      expect(DEFAULT_SEARCH_CONFIG).toHaveProperty('maxResults')
      expect(DEFAULT_SEARCH_CONFIG).toHaveProperty('searchWeights')
    })

    it('should have valid numeric values', () => {
      expect(typeof DEFAULT_SEARCH_CONFIG.debounceMs).toBe('number')
      expect(DEFAULT_SEARCH_CONFIG.debounceMs).toBeGreaterThan(0)
      
      expect(typeof DEFAULT_SEARCH_CONFIG.maxDisplayResults).toBe('number')
      expect(DEFAULT_SEARCH_CONFIG.maxDisplayResults).toBeGreaterThan(0)
      
      expect(typeof DEFAULT_SEARCH_CONFIG.threshold).toBe('number')
      expect(typeof DEFAULT_SEARCH_CONFIG.maxResults).toBe('number')
      expect(DEFAULT_SEARCH_CONFIG.maxResults).toBeGreaterThan(0)
      
      expect(typeof DEFAULT_SEARCH_CONFIG.enablePinyin).toBe('boolean')
    })

    it('should have valid search weights', () => {
      const weights = DEFAULT_SEARCH_CONFIG.searchWeights
      expect(weights).toHaveProperty('id')
      expect(weights).toHaveProperty('name')
      expect(weights).toHaveProperty('labels')
      expect(weights).toHaveProperty('summary')
      expect(weights).toHaveProperty('content')
      
      Object.values(weights).forEach(weight => {
        expect(typeof weight).toBe('number')
        expect(weight).toBeGreaterThan(0)
      })
    })

    it('should have reasonable default values', () => {
      expect(DEFAULT_SEARCH_CONFIG.debounceMs).toBe(300)
      expect(DEFAULT_SEARCH_CONFIG.maxDisplayResults).toBe(10)
      expect(DEFAULT_SEARCH_CONFIG.enablePinyin).toBe(true)
      expect(DEFAULT_SEARCH_CONFIG.threshold).toBe(0.3)
      expect(DEFAULT_SEARCH_CONFIG.maxResults).toBe(20)
      expect(DEFAULT_SEARCH_CONFIG.searchWeights.id).toBe(4)
      expect(DEFAULT_SEARCH_CONFIG.searchWeights.name).toBe(3)
      expect(DEFAULT_SEARCH_CONFIG.searchWeights.labels).toBe(2)
      expect(DEFAULT_SEARCH_CONFIG.searchWeights.summary).toBe(2)
      expect(DEFAULT_SEARCH_CONFIG.searchWeights.content).toBe(1)
    })
  })

  describe('Type Guards', () => {
    it('should create valid SearchState objects', () => {
      const searchState: SearchState = {
        query: 'test',
        results: [],
        selectedIndex: 0,
        isSearching: false,
        showDetail: false
      }
      
      expect(searchState.query).toBe('test')
      expect(Array.isArray(searchState.results)).toBe(true)
      expect(typeof searchState.selectedIndex).toBe('number')
      expect(typeof searchState.isSearching).toBe('boolean')
      expect(typeof searchState.showDetail).toBe('boolean')
    })

    it('should create valid ApplyState objects', () => {
      const applyState: ApplyState = {
        showApplyConfirm: false,
        mode: 'write',
        isApplying: false
      }
      
      expect(typeof applyState.showApplyConfirm).toBe('boolean')
      expect(['write', 'append', 'merge']).toContain(applyState.mode)
      expect(typeof applyState.isApplying).toBe('boolean')
    })
  })
})
