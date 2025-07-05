// Error tracking test utilities
import { logError, logWarn, logInfo, logDebug, logSupabaseError, logAuthError } from './errorTracking'

export const runErrorTrackingTests = () => {
  console.log('🧪 Running Error Tracking Tests...')
  
  // Test different error levels
  logInfo('Test Info Message', { testData: 'info test' })
  logWarn('Test Warning Message', { testData: 'warning test' })
  logDebug('Test Debug Message', { testData: 'debug test' })
  
  // Test Supabase error
  logSupabaseError('testOperation', {
    message: 'Test Supabase error',
    code: 'TEST_ERROR',
    details: 'This is a test error for Supabase'
  })
  
  // Test Auth error
  logAuthError('testAuth', {
    message: 'Test authentication error',
    status: 401
  })
  
  // Test regular error
  logError('Test Error Message', {
    testData: 'error test',
    stack: 'Test stack trace'
  }, {
    component: 'ErrorTest',
    action: 'runTests'
  })
  
  console.log('✅ Error tracking tests completed. Check the error dashboard!')
}

// Generate a realistic error scenario
export const simulateRealWorldErrors = () => {
  console.log('🎭 Simulating real-world errors...')
  
  // Database connection error
  setTimeout(() => {
    logSupabaseError('fetchLeaderboard', {
      message: 'connection to server was lost',
      code: 'PGRST301',
      details: 'Could not connect to database'
    }, {
      component: 'LeaderboardPage',
      action: 'loadData'
    })
  }, 1000)
  
  // Authentication error
  setTimeout(() => {
    logAuthError('signIn', {
      message: 'Invalid credentials',
      status: 401
    }, {
      component: 'AuthModal',
      action: 'handleLogin'
    })
  }, 2000)
  
  // Network error
  setTimeout(() => {
    logError('Network Request Failed', {
      message: 'Failed to fetch',
      url: 'https://api.example.com/data',
      status: 0
    }, {
      component: 'GameAPI',
      action: 'submitScore'
    })
  }, 3000)
  
  // Component error
  setTimeout(() => {
    logError('Component Render Error', {
      message: 'Cannot read property of undefined',
      componentStack: 'at GamesList\n  at HomePage\n  at App'
    }, {
      component: 'GamesList',
      action: 'render'
    })
  }, 4000)
  
  console.log('🎭 Real-world error simulation started')
}

// Test the error boundary
export const triggerErrorBoundary = () => {
  console.log('💥 Triggering error boundary...')
  
  // This will be caught by the error boundary
  setTimeout(() => {
    throw new Error('This is a test error to trigger the error boundary')
  }, 100)
} 