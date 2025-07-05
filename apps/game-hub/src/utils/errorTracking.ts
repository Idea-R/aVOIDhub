// Error tracking and logging utilities for aVOIDgame.io
interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  metadata?: Record<string, any>
}

interface ErrorReport {
  id: string
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  stack?: string
  context?: ErrorContext
  url: string
  userAgent: string
}

class ErrorTracker {
  private static instance: ErrorTracker
  private errors: ErrorReport[] = []
  private maxErrors = 100
  private isDevelopment = import.meta.env.DEV
  private originalConsoleError: typeof console.error
  private originalConsoleWarn: typeof console.warn
  private isLogging = false // Prevent infinite loops

  private constructor() {
    // Store original console methods before overriding
    this.originalConsoleError = console.error.bind(console)
    this.originalConsoleWarn = console.warn.bind(console)
    this.setupGlobalErrorHandlers()
  }

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
    }
    return ErrorTracker.instance
  }

  private setupGlobalErrorHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      if (!this.isLogging) {
        this.logError('Global Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        })
      }
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (!this.isLogging) {
        this.logError('Unhandled Promise Rejection', {
          reason: event.reason,
          stack: event.reason?.stack
        })
      }
    })

    // Override console.error to capture all console errors
    console.error = (...args: any[]) => {
      if (!this.isLogging) {
        this.logError('Console Error', { args })
      }
      this.originalConsoleError.apply(console, args)
    }

    // Override console.warn for warnings
    console.warn = (...args: any[]) => {
      if (!this.isLogging) {
        this.logWarn('Console Warning', { args })
      }
      this.originalConsoleWarn.apply(console, args)
    }
  }

  private createErrorReport(
    level: ErrorReport['level'],
    message: string,
    details?: any,
    context?: ErrorContext
  ): ErrorReport {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message,
      stack: details?.stack || new Error().stack,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...details
    }
  }

  logError(message: string, details?: any, context?: ErrorContext) {
    if (this.isLogging) return // Prevent infinite loops
    
    this.isLogging = true
    try {
      const errorReport = this.createErrorReport('error', message, details, context)
      this.addError(errorReport)
      
      if (this.isDevelopment) {
        console.group(`🔴 [ERROR] ${message}`)
        this.originalConsoleError('Details:', details)
        this.originalConsoleError('Context:', context)
        this.originalConsoleError('Stack:', errorReport.stack)
        console.groupEnd()
      }
    } finally {
      this.isLogging = false
    }
  }

  logWarn(message: string, details?: any, context?: ErrorContext) {
    if (this.isLogging) return // Prevent infinite loops
    
    this.isLogging = true
    try {
      const errorReport = this.createErrorReport('warn', message, details, context)
      this.addError(errorReport)
      
      if (this.isDevelopment) {
        console.group(`🟡 [WARN] ${message}`)
        this.originalConsoleWarn('Details:', details)
        this.originalConsoleWarn('Context:', context)
        console.groupEnd()
      }
    } finally {
      this.isLogging = false
    }
  }

  logInfo(message: string, details?: any, context?: ErrorContext) {
    const errorReport = this.createErrorReport('info', message, details, context)
    this.addError(errorReport)
    
    if (this.isDevelopment) {
      console.group(`🔵 [INFO] ${message}`)
      console.info('Details:', details)
      console.info('Context:', context)
      console.groupEnd()
    }
  }

  logDebug(message: string, details?: any, context?: ErrorContext) {
    if (this.isDevelopment) {
      const errorReport = this.createErrorReport('debug', message, details, context)
      this.addError(errorReport)
      
      console.group(`🟢 [DEBUG] ${message}`)
      console.debug('Details:', details)
      console.debug('Context:', context)
      console.groupEnd()
    }
  }

  private addError(error: ErrorReport) {
    this.errors.unshift(error)
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }
  }

  getErrors(level?: ErrorReport['level']): ErrorReport[] {
    if (level) {
      return this.errors.filter(error => error.level === level)
    }
    return [...this.errors]
  }

  getRecentErrors(minutes: number = 5): ErrorReport[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString()
    return this.errors.filter(error => error.timestamp > cutoff)
  }

  clearErrors() {
    this.errors = []
  }

  // Method to track Supabase-specific errors
  logSupabaseError(operation: string, error: any, context?: ErrorContext) {
    this.logError(`Supabase ${operation} Error`, {
      supabaseError: {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      }
    }, {
      ...context,
      component: 'Supabase',
      action: operation
    })
  }

  // Method to track authentication errors
  logAuthError(operation: string, error: any, context?: ErrorContext) {
    this.logError(`Auth ${operation} Error`, {
      authError: {
        message: error?.message,
        status: error?.status
      }
    }, {
      ...context,
      component: 'Authentication',
      action: operation
    })
  }

  // Method to track API errors
  logApiError(endpoint: string, error: any, context?: ErrorContext) {
    this.logError(`API ${endpoint} Error`, {
      apiError: {
        message: error?.message,
        status: error?.status,
        response: error?.response
      }
    }, {
      ...context,
      component: 'API',
      action: endpoint
    })
  }

  // Export errors for debugging or sending to external service
  exportErrors(): string {
    return JSON.stringify(this.errors, null, 2)
  }

  // Get error summary for dashboard
  getErrorSummary() {
    const recent = this.getRecentErrors()
    const summary = {
      total: this.errors.length,
      recent: recent.length,
      byLevel: {
        error: this.errors.filter(e => e.level === 'error').length,
        warn: this.errors.filter(e => e.level === 'warn').length,
        info: this.errors.filter(e => e.level === 'info').length,
        debug: this.errors.filter(e => e.level === 'debug').length
      },
      recentByLevel: {
        error: recent.filter(e => e.level === 'error').length,
        warn: recent.filter(e => e.level === 'warn').length,
        info: recent.filter(e => e.level === 'info').length,
        debug: recent.filter(e => e.level === 'debug').length
      }
    }
    return summary
  }
}

// Create singleton instance
export const errorTracker = ErrorTracker.getInstance()

// Convenience functions
export const logError = (message: string, details?: any, context?: ErrorContext) => 
  errorTracker.logError(message, details, context)

export const logWarn = (message: string, details?: any, context?: ErrorContext) => 
  errorTracker.logWarn(message, details, context)

export const logInfo = (message: string, details?: any, context?: ErrorContext) => 
  errorTracker.logInfo(message, details, context)

export const logDebug = (message: string, details?: any, context?: ErrorContext) => 
  errorTracker.logDebug(message, details, context)

export const logSupabaseError = (operation: string, error: any, context?: ErrorContext) => 
  errorTracker.logSupabaseError(operation, error, context)

export const logAuthError = (operation: string, error: any, context?: ErrorContext) => 
  errorTracker.logAuthError(operation, error, context)

export const logApiError = (endpoint: string, error: any, context?: ErrorContext) => 
  errorTracker.logApiError(endpoint, error, context)

// Development helper to access error tracker in console
if (import.meta.env.DEV) {
  (window as any).errorTracker = errorTracker
} 