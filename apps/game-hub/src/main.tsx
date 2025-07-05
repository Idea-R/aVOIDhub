import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Initialize error tracking
import { initializeErrorTracking, trackFetchErrors, logDatabaseSchema } from './utils/errorInit'

// Start error tracking
initializeErrorTracking()
trackFetchErrors()

// Test database schema in development
if (import.meta.env.DEV) {
  logDatabaseSchema()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
