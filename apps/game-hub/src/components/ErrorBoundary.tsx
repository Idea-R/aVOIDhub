import React, { Component } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { logError } from '../utils/errorTracking'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log to our error tracking system
    logError('React Component Error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    }, {
      component: 'ErrorBoundary',
      action: 'componentDidCatch'
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-space">
          <div className="max-w-md w-full text-center">
            
            {/* Error Icon */}
            <div className="mb-8">
              <AlertTriangle className="mx-auto text-red-400 mb-4" size={64} />
              <h1 className="text-3xl font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-white/60">
                We encountered an unexpected error. Our team has been notified.
              </p>
            </div>

            {/* Error Details (Development Only) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
                <details className="text-sm">
                  <summary className="text-red-400 font-medium cursor-pointer mb-2">
                    Error Details (Development)
                  </summary>
                  <div className="text-white/80 space-y-2">
                    <div>
                      <strong>Message:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="text-xs mt-1 whitespace-pre-wrap break-all">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="text-xs mt-1 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={this.handleRetry}
                className="btn-primary inline-flex items-center justify-center space-x-2"
              >
                <RefreshCw size={18} />
                <span>Try Again</span>
              </button>
              
              <Link 
                to="/" 
                className="btn-secondary inline-flex items-center justify-center space-x-2"
              >
                <Home size={18} />
                <span>Go Home</span>
              </Link>
            </div>

            {/* Help Text */}
            <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white/60 text-sm">
                If this problem persists, try:
              </p>
              <ul className="text-white/80 text-sm mt-2 space-y-1">
                <li>• Refreshing the page</li>
                <li>• Clearing your browser cache</li>
                <li>• Checking your internet connection</li>
                <li>• Contacting support if the issue continues</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

export default ErrorBoundary 