/// <reference types="vite/client" />

declare const __BUILD_STAMP__: string
declare const __GIT_SHA__: string

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_AZURE_CLIENT_ID: string
  readonly VITE_AZURE_TENANT_ID: string
  readonly VITE_AZURE_REDIRECT_URI: string
  readonly VITE_AUTH_ALLOWED_EMAILS?: string
  readonly VITE_AUTH_ALLOWED_DOMAINS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
