/**
 * Debug logging utility for Onboarding module
 * 
 * Logs are gated behind import.meta.env.DEV check (Vite built-in)
 * In production builds, these become no-ops and get tree-shaken out
 * 
 * To enable debug logs in development:
 * - Logs automatically appear when running `npm run dev` (DEV=true)
 * - Production builds have logs stripped out (DEV=false)
 */

/**
 * Debug logger for Onboarding module - only logs in development
 */
export const onboardingDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

/**
 * Error logger for Onboarding module - always logs (errors should be visible in prod)
 */
export const onboardingError = (...args: any[]) => {
  console.error(...args)
}

/**
 * Warning logger for Onboarding module - only logs in development
 */
export const onboardingWarn = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.warn(...args)
  }
}
