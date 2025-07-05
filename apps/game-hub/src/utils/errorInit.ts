// Error tracking initialization
import { errorTracker, logInfo } from './errorTracking'

// Initialize error tracking system
export const initializeErrorTracking = () => {
  if (import.meta.env.DEV) {
    console.log('🐛 Error tracking system initialized')
    
    // Log initial setup
    logInfo('Application Started', {
      metadata: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        environment: 'development'
      }
    })

    // Add performance monitoring
    const measurePerformance = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      if (navigation) {
        logInfo('Performance Metrics', {
          metadata: {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            totalTime: navigation.loadEventEnd - navigation.fetchStart
          }
        })
      }
    }

    // Measure performance on load
    if (document.readyState === 'complete') {
      measurePerformance()
    } else {
      window.addEventListener('load', measurePerformance)
    }

    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      logInfo('Page Visibility Changed', {
        metadata: {
          hidden: document.hidden,
          visibilityState: document.visibilityState
        }
      })
    })

    // Monitor online/offline status
    window.addEventListener('online', () => {
      logInfo('Connection Restored')
    })

    window.addEventListener('offline', () => {
      logInfo('Connection Lost')
    })

    // Monitor memory usage (if available)
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory
      logInfo('Memory Usage', {
        metadata: {
          usedJSHeapSize: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024),
          totalJSHeapSize: Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024),
          jsHeapSizeLimit: Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024)
        }
      })
    }

    // Expose error tracker to window for debugging
    ;(window as any).errorTracker = errorTracker
    ;(window as any).logTestError = () => {
      try {
        throw new Error('This is a test error for debugging')
      } catch (error) {
        console.error('Test error:', error)
      }
    }

    // Add console debugging helpers
    ;(window as any).debugConsole = {
      showAllErrors: () => {
        console.group('🐛 All Tracked Errors')
        console.log(errorTracker.getErrors())
        console.groupEnd()
      },
      showErrorSummary: () => {
        console.group('📊 Error Summary')
        console.log(errorTracker.getErrorSummary())
        console.groupEnd()
      },
      clearErrors: () => {
        errorTracker.clearErrors()
        console.log('✅ All errors cleared')
      },
      testError: () => {
        console.error('🧪 Test Console Error')
        errorTracker.logError('Test Manual Error', { component: 'Console', action: 'debug' })
        console.log('✅ Test errors generated')
      },
      enableVerboseLogging: () => {
        // Override console methods to show they're being captured
        const originalError = console.error
        const originalWarn = console.warn
        
        console.error = (...args) => {
          originalError('🔴 ERROR CAPTURED:', ...args)
          return originalError.apply(console, args)
        }
        
        console.warn = (...args) => {
          originalWarn('🟡 WARNING CAPTURED:', ...args)
          return originalWarn.apply(console, args)
        }
        
        console.log('✅ Verbose logging enabled - all errors/warnings will show "CAPTURED" prefix')
      }
    }

    console.log('🐛 aVOIDgame.io Error Tracking Active')
    console.log('Available debugging commands:')
    console.log('- window.errorTracker: Access error tracker instance')
    console.log('- window.logTestError(): Generate a test error')
    console.log('- window.debugConsole.showAllErrors(): Show all tracked errors')
    console.log('- window.debugConsole.showErrorSummary(): Show error summary')
    console.log('- window.debugConsole.clearErrors(): Clear all errors')
    console.log('- window.debugConsole.testError(): Generate test errors')
    console.log('- window.debugConsole.enableVerboseLogging(): Show when errors are captured')
    console.log('💡 You can also open the Error Dashboard (red button bottom-right) to view errors visually')
  }
}

// Error tracking middleware for fetch requests
export const trackFetchErrors = () => {
  const originalFetch = window.fetch
  
  window.fetch = async (...args) => {
    const [resource, config] = args
    const url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : resource.toString())
    
    try {
      const response = await originalFetch(...args)
      
      if (!response.ok) {
        logInfo('Fetch Error', {
          metadata: {
            url,
            status: response.status,
            statusText: response.statusText,
            method: config?.method || 'GET'
          }
        })
      }
      
      return response
    } catch (error) {
      logInfo('Network Error', {
        metadata: {
          url,
          method: config?.method || 'GET',
          error: (error as Error).message
        }
      })
      throw error
    }
  }
}

// Log Supabase database schema for debugging
export const logDatabaseSchema = async () => {
  if (import.meta.env.DEV) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-ref.supabase.co'
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here'
      
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        logInfo('Database Schema Check Skipped - Missing Environment Variables', {
          metadata: {
            hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
            hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY
          }
        })
        return
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      // Test basic queries to identify schema issues
      const tables = ['games', 'leaderboard_scores', 'user_profiles']
      
      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1)
          
          if (error) {
            logInfo(`Database Schema Error - ${table}`, {
              metadata: {
                table,
                error: error.message,
                code: error.code,
                details: error.details
              }
            })
          } else {
            logInfo(`Database Schema OK - ${table}`, {
              metadata: {
                table,
                hasData: data && data.length > 0,
                sampleColumns: data && data.length > 0 ? Object.keys(data[0]) : []
              }
            })
          }
        } catch (err) {
          logInfo(`Database Connection Error - ${table}`, {
            metadata: {
              table,
              error: (err as Error).message
            }
          })
        }
      }
    } catch (error) {
      logInfo('Database Schema Check Failed', {
        metadata: {
          error: (error as Error).message
        }
      })
    }
  }
} 