export {}

declare global {
  const __BUILD_STAMP__: string

  interface Window {
    __odcrm_loaded?: boolean
  }
}
