/// <reference types="vite/client" />

interface Window {
  errorTracker?: any;
  logTestError?: () => void;
  debugConsole?: {
    showAllErrors: () => void;
    showErrorSummary: () => void;
    clearErrors: () => void;
    testError: () => void;
    enableVerboseLogging: () => void;
  };
}
