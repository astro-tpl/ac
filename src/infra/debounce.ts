/**
 * Debounce utility functions
 * Used for real-time search debounce handling in interactive search
 */

/**
 * Debounce function - Delay function execution, reset timer if called again within delay period
 * @param func Function to debounce
 * @param delay Delay time (milliseconds)
 * @returns Debounced function
 */
export function debounce<T extends(...args: any[]) => any>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    // Clear previous timer
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Set new timer
    timeoutId = setTimeout(() => {
      func.apply(null, args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Create a cancelable debounce function
 * @param func Function to debounce
 * @param delay Delay time (milliseconds)
 * @returns Object containing debounced function and cancel function
 */
export function createDebouncedFunction<T extends(...args: any[]) => any>(
  func: T,
  delay: number,
): {
  cancel: () => void
  debouncedFunc: (...args: Parameters<T>) => void
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
    cancel,
    debouncedFunc,
    flush,
  }
}
