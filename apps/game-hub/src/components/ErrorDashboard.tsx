import React, { useState, useEffect } from 'react'
import { AlertTriangle, Bug, Info, AlertCircle, X, Download, Trash2 } from 'lucide-react'
import { errorTracker } from '../utils/errorTracking'

const ErrorDashboard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [errors, setErrors] = useState(errorTracker.getErrors())
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      setErrors(errorTracker.getErrors())
    }, 1000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const filteredErrors = filter === 'all' 
    ? errors 
    : errors.filter(error => error.level === filter)

  const summary = errorTracker.getErrorSummary()

  const handleClearErrors = () => {
    errorTracker.clearErrors()
    setErrors([])
  }

  const handleExportErrors = () => {
    try {
      const data = errorTracker.exportErrors()
      console.log('=== aVOIDgame.io Error Export ===')
      console.log('Timestamp:', new Date().toISOString())
      console.log('Error Data:', JSON.parse(data))
      console.log('=== End Error Export ===')
      
      // Try multiple approaches for downloading
      const downloadFile = () => {
        try {
          const blob = new Blob([data], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const filename = `avoidgame-errors-${new Date().toISOString().split('T')[0]}.json`
          
          // Try using a temporary anchor element
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          link.style.display = 'none'
          
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          
          // Clean up
          setTimeout(() => URL.revokeObjectURL(url), 100)
          
          return true
        } catch (downloadError) {
          console.warn('File download failed:', downloadError)
          return false
        }
      }
      
      // Try to download first
      const downloadSuccess = downloadFile()
      
      // Also copy to clipboard as backup
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data).then(() => {
          if (downloadSuccess) {
            alert('✅ Error data downloaded and copied to clipboard!')
          } else {
            alert('📋 Download failed, but error data copied to clipboard and logged to console!')
          }
        }).catch(() => {
          if (downloadSuccess) {
            alert('✅ Error data downloaded and logged to console!')
          } else {
            alert('📄 Error data logged to console. Check the browser console for details.')
          }
        })
      } else {
        if (downloadSuccess) {
          alert('✅ Error data downloaded and logged to console!')
        } else {
          alert('📄 Error data logged to console. Check the browser console for details.')
        }
      }
    } catch (error) {
      console.error('Error exporting errors:', error)
      alert('❌ Failed to export errors. Check console for details.')
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertTriangle className="text-red-400" size={16} />
      case 'warn': return <AlertCircle className="text-yellow-400" size={16} />
      case 'info': return <Info className="text-blue-400" size={16} />
      case 'debug': return <Bug className="text-green-400" size={16} />
      default: return <AlertTriangle className="text-gray-400" size={16} />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'border-red-500/30 bg-red-500/10'
      case 'warn': return 'border-yellow-500/30 bg-yellow-500/10'
      case 'info': return 'border-blue-500/30 bg-blue-500/10'
      case 'debug': return 'border-green-500/30 bg-green-500/10'
      default: return 'border-gray-500/30 bg-gray-500/10'
    }
  }

  // Only show in development
  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <>
      {/* Floating Error Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg transition-colors"
        title={`${summary.recent} recent errors`}
      >
        <div className="relative">
          <Bug size={20} />
          {summary.recent > 0 && (
            <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {summary.recent > 99 ? '99+' : summary.recent}
            </span>
          )}
        </div>
      </button>

      {/* Error Dashboard Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-white/20 w-full max-w-6xl h-[80vh] flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <Bug className="text-red-400" />
                  <span>Error Dashboard</span>
                </h2>
                <p className="text-white/60 mt-1">
                  Development error tracking and monitoring
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2 text-white/80">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Auto refresh</span>
                </label>
                
                <button
                  onClick={() => {
                    console.log('=== Current Error Summary ===')
                    console.log('Error Tracker:', window.errorTracker)
                    console.log('All Errors:', window.errorTracker?.getErrors())
                    console.log('Error Summary:', window.errorTracker?.getErrorSummary())
                    console.log('=== End Current Errors ===')
                    alert('Current errors logged to console! Open browser console to view.')
                  }}
                  className="btn-secondary-sm flex items-center space-x-1"
                  title="Log to console"
                >
                  <Bug size={14} />
                </button>
                
                <button
                  onClick={handleExportErrors}
                  className="btn-secondary-sm flex items-center space-x-1"
                  title="Export errors"
                >
                  <Download size={14} />
                </button>
                
                <button
                  onClick={() => {
                    // Generate test errors
                    console.error('Test Error: This is a sample error for debugging')
                    console.warn('Test Warning: This is a sample warning')
                    window.errorTracker?.logError('Test Manual Error', { component: 'ErrorDashboard', action: 'test' })
                    alert('Generated test errors! Check the error dashboard and console.')
                  }}
                  className="btn-secondary-sm flex items-center space-x-1 text-blue-400 hover:text-blue-300"
                  title="Generate test errors"
                >
                  <AlertTriangle size={14} />
                </button>
                
                <button
                  onClick={handleClearErrors}
                  className="btn-secondary-sm flex items-center space-x-1 text-red-400 hover:text-red-300"
                  title="Clear all errors"
                >
                  <Trash2 size={14} />
                </button>
                
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/60 hover:text-white p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="p-6 border-b border-white/10">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{summary.total}</div>
                  <div className="text-white/60 text-sm">Total</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">{summary.byLevel.error}</div>
                  <div className="text-white/60 text-sm">Errors</div>
                </div>
                <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{summary.byLevel.warn}</div>
                  <div className="text-white/60 text-sm">Warnings</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{summary.byLevel.info}</div>
                  <div className="text-white/60 text-sm">Info</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{summary.byLevel.debug}</div>
                  <div className="text-white/60 text-sm">Debug</div>
                </div>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="p-4 border-b border-white/10">
              <div className="flex flex-wrap gap-2">
                {['all', 'error', 'warn', 'info', 'debug'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setFilter(level as any)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      filter === level
                        ? 'bg-void-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                    {level !== 'all' && (
                      <span className="ml-1 text-xs opacity-60">
                        ({summary.byLevel[level as keyof typeof summary.byLevel]})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Error List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredErrors.length === 0 ? (
                <div className="text-center py-12">
                  <Bug className="mx-auto text-white/20 mb-4" size={48} />
                  <p className="text-white/60">No {filter !== 'all' ? filter : ''} errors to display</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredErrors.map((error) => (
                    <div
                      key={error.id}
                      className={`p-4 rounded-lg border ${getLevelColor(error.level)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getLevelIcon(error.level)}
                          <span className="font-medium text-white">{error.message}</span>
                        </div>
                        <span className="text-white/40 text-xs">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {error.context && (
                        <div className="mb-2 text-sm text-white/70">
                          <span className="font-medium">Context:</span>
                          {error.context.component && (
                            <span className="ml-2 bg-white/10 px-2 py-1 rounded text-xs">
                              {error.context.component}
                            </span>
                          )}
                          {error.context.action && (
                            <span className="ml-2 bg-white/10 px-2 py-1 rounded text-xs">
                              {error.context.action}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <details className="text-sm">
                        <summary className="cursor-pointer text-white/60 hover:text-white/80">
                          View Details
                        </summary>
                        <div className="mt-2 p-3 bg-black/30 rounded text-xs font-mono text-white/80 overflow-x-auto">
                          <div className="mb-2">
                            <strong>URL:</strong> {error.url}
                          </div>
                          {error.stack && (
                            <div>
                              <strong>Stack Trace:</strong>
                              <pre className="mt-1 whitespace-pre-wrap break-all">
                                {error.stack}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ErrorDashboard 