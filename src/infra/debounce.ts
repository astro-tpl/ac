/**
 * 防抖工具函数
 * 用于交互式搜索中的实时搜索防抖处理
 */

/**
 * 防抖函数 - 延迟执行函数调用，如果在延迟时间内再次调用则重新计时
 * @param func 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    // 清除之前的定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    // 设置新的定时器
    timeoutId = setTimeout(() => {
      func.apply(null, args)
      timeoutId = null
    }, delay)
  }
}

/**
 * 创建一个可取消的防抖函数
 * @param func 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 包含防抖函数和取消函数的对象
 */
export function createDebouncedFunction<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): {
  debouncedFunc: (...args: Parameters<T>) => void
  cancel: () => void
  flush: (...args: Parameters<T>) => void
} {
  let timeoutId: NodeJS.Timeout | null = null
  
  const debouncedFunc = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      func.apply(null, args)
      timeoutId = null
    }, delay)
  }
  
  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }
  
  const flush = (...args: Parameters<T>) => {
    cancel()
    func.apply(null, args)
  }
  
  return {
    debouncedFunc,
    cancel,
    flush
  }
}
