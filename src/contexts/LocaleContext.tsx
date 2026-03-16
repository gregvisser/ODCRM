/**
 * Locale context: UI language (en/ar) and direction (ltr/rtl).
 * Persisted in localStorage only; no backend. Used for presentation layer.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getDirection,
  LOCALE_STORAGE_KEY,
  t as tRaw,
  type Locale,
} from '../i18n'

interface LocaleContextValue {
  locale: Locale
  direction: 'ltr' | 'rtl'
  setLocale: (next: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (v === 'ar' || v === 'en') return v
  } catch {
    // ignore
  }
  return 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)
  const direction = useMemo(() => getDirection(locale), [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => tRaw(key, locale, params),
    [locale]
  )

  // Apply dir and lang to document root for RTL and screen readers
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('dir', direction)
    root.setAttribute('lang', locale === 'ar' ? 'ar' : 'en')
  }, [direction, locale])

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, direction, setLocale, t }),
    [locale, direction, setLocale, t]
  )

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return ctx
}
