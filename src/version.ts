/**
 * Deploy-verifiable build info. Set in CI via VITE_BUILD_SHA and VITE_BUILD_TIME.
 * Expose on window.__ODCRM_BUILD__ so deployed commit can be verified in console.
 */
export const BUILD_SHA = import.meta.env.VITE_BUILD_SHA ?? 'unknown'
export const BUILD_TIME = import.meta.env.VITE_BUILD_TIME ?? 'unknown'
