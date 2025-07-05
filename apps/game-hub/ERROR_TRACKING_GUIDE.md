# Error Tracking System - aVOIDgame.io

## Overview

The aVOIDgame.io hub platform now includes a comprehensive error tracking and monitoring system designed to capture, categorize, and analyze errors during development and production.

## Features

### 🔍 Error Capture
- **Global Error Handling**: Captures all uncaught JavaScript errors and unhandled promise rejections
- **Console Monitoring**: Intercepts and logs all console.error and console.warn calls
- **Component Errors**: React Error Boundaries catch and log component-specific errors
- **Database Errors**: Supabase-specific error tracking with detailed context
- **Authentication Errors**: Auth-specific error tracking with user context
- **Network Errors**: Fetch request monitoring and error tracking

### 📊 Error Categorization
- **Error Levels**: `error`, `warn`, `info`, `debug`
- **Component Context**: Track which component/module generated the error
- **Action Context**: Track what action/operation was being performed
- **Metadata**: Store additional context and debugging information

### 🚨 Real-time Monitoring
- **Error Dashboard**: Visual interface for monitoring errors (development only)
- **Auto-refresh**: Real-time error updates
- **Filtering**: Filter errors by level, component, or time range
- **Export**: Export error logs for analysis

### 📈 Performance Tracking
- **Load Performance**: Track page load times and performance metrics
- **Memory Usage**: Monitor JavaScript heap usage (Chrome only)
- **Network Status**: Track online/offline states
- **Page Visibility**: Monitor tab visibility changes

## Usage

### Basic Error Logging

```typescript
import { logError, logWarn, logInfo, logDebug } from './utils/errorTracking'

// Log different types of messages
logError('Something went wrong', { details: 'error details' })
logWarn('Warning message', { context: 'warning context' })
logInfo('Information message', { data: 'info data' })
logDebug('Debug message', { debug: 'debug info' })
```

### Specialized Error Logging

```typescript
import { logSupabaseError, logAuthError, logApiError } from './utils/errorTracking'

// Supabase errors
logSupabaseError('fetchLeaderboard', error, {
  component: 'LeaderboardPage',
  action: 'loadData'
})

// Authentication errors
logAuthError('signIn', error, {
  component: 'AuthModal',
  metadata: { email: 'user@example.com' }
})

// API errors
logApiError('/api/scores', error, {
  component: 'GameAPI',
  action: 'submitScore'
})
```

### Error Boundary Usage

```typescript
import ErrorBoundary from './components/ErrorBoundary'

// Wrap components that might throw errors
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>

// Or use the HOC
const SafeComponent = withErrorBoundary(MyComponent)
```

## Error Dashboard

The error dashboard is available **only in development** and provides:

### 📱 Floating Error Button
- Red floating button in bottom-right corner
- Shows count of recent errors
- Click to open full dashboard

### 🎛️ Dashboard Features
- **Error Summary**: Total errors by level with recent activity
- **Filtering**: Filter by error level (all, error, warn, info, debug)
- **Auto-refresh**: Real-time updates of error list
- **Export**: Download error logs as JSON
- **Clear**: Clear all logged errors
- **Detailed View**: Expandable error details with stack traces

### 🔧 Development Tools
Available in browser console:
- `window.errorTracker`: Access the error tracker instance
- `window.logTestError()`: Generate a test error
- `errorTracker.getErrors()`: Get all errors
- `errorTracker.getErrorSummary()`: Get error summary
- `errorTracker.exportErrors()`: Export errors as JSON

## Error Types

### 🔴 Error Level
- Critical issues that prevent functionality
- Unhandled exceptions
- Failed database operations
- Authentication failures

### 🟡 Warning Level
- Potential issues that don't break functionality
- Deprecated API usage
- Performance warnings
- Configuration issues

### 🔵 Info Level
- General application events
- User actions
- API requests
- State changes

### 🟢 Debug Level
- Development-only information
- Detailed execution flow
- Variable states
- Performance metrics

## Configuration

### Environment Variables
```env
VITE_ENABLE_ERROR_TRACKING=true
VITE_ERROR_TRACKING_ENDPOINT=https://api.example.com/errors
```

### Initialization
```typescript
import { initializeErrorTracking, trackFetchErrors } from './utils/errorInit'

// Initialize error tracking
initializeErrorTracking()

// Enable fetch error tracking
trackFetchErrors()
```

## Best Practices

### 1. Error Context
Always provide context when logging errors:
```typescript
logError('Database operation failed', error, {
  component: 'UserProfile',
  action: 'saveProfile',
  metadata: { userId: user.id }
})
```

### 2. Error Boundaries
Wrap components that might throw errors:
```typescript
<ErrorBoundary fallback={<CustomErrorUI />}>
  <RiskyComponent />
</ErrorBoundary>
```

### 3. Progressive Enhancement
Handle errors gracefully without breaking the user experience:
```typescript
try {
  const data = await fetchData()
  setData(data)
} catch (error) {
  logError('Data fetch failed', error, { component: 'DataList' })
  setError('Failed to load data. Please try again.')
}
```

### 4. Error Filtering
Use appropriate error levels:
- `error`: For actual problems that affect users
- `warn`: For potential issues or deprecated usage
- `info`: For general application events
- `debug`: For development-only information

## Testing

### Manual Testing
```typescript
import { runErrorTrackingTests, simulateRealWorldErrors } from './utils/errorTest'

// Run basic error tracking tests
runErrorTrackingTests()

// Simulate realistic error scenarios
simulateRealWorldErrors()
```

### Browser Console
1. Open developer tools
2. Go to Console tab
3. Run `window.logTestError()` to generate test errors
4. Click the red floating button to open error dashboard

## Production Considerations

### 1. Privacy
- Avoid logging sensitive user data
- Sanitize error messages before logging
- Respect user privacy settings

### 2. Performance
- Error tracking is lightweight but monitor performance
- Consider error sampling for high-traffic applications
- Use appropriate error levels to avoid noise

### 3. Storage
- Errors are stored in memory (max 100 errors)
- Consider persistent storage for production
- Implement error log rotation

### 4. Monitoring
- Consider integrating with external error tracking services
- Set up alerts for critical errors
- Monitor error trends and patterns

## Integration with External Services

### Sentry Integration
```typescript
import * as Sentry from '@sentry/react'

// Override error tracker to send to Sentry
const originalLogError = errorTracker.logError
errorTracker.logError = (message, details, context) => {
  originalLogError(message, details, context)
  Sentry.captureException(new Error(message), {
    contexts: { custom: context },
    extra: details
  })
}
```

### Custom API Integration
```typescript
const sendErrorToAPI = async (error) => {
  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error)
    })
  } catch (e) {
    console.error('Failed to send error to API:', e)
  }
}
```

## Troubleshooting

### Common Issues

1. **Error Dashboard Not Appearing**
   - Check if you're in development mode
   - Verify error tracking is initialized
   - Check browser console for initialization errors

2. **Errors Not Being Captured**
   - Ensure error tracking is initialized before other code
   - Check if error boundaries are properly placed
   - Verify import paths are correct

3. **Performance Issues**
   - Check error log count (max 100)
   - Disable auto-refresh if needed
   - Consider reducing error detail level

### Debug Commands
```javascript
// Check error tracker status
console.log('Error Tracker:', window.errorTracker)

// Get current errors
console.log('Current Errors:', window.errorTracker.getErrors())

// Get error summary
console.log('Error Summary:', window.errorTracker.getErrorSummary())

// Test error tracking
window.logTestError()
```

## Support

For questions or issues with the error tracking system:
1. Check the browser console for error messages
2. Review the error dashboard for patterns
3. Export error logs for analysis
4. Consult the development team

---

*Error tracking system implemented for aVOIDgame.io hub platform* 