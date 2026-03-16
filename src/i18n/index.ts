/**
 * Frontend-only i18n: t() helper and locale utilities.
 * English is canonical; Arabic falls back to English for missing keys.
 */
import { en } from './en'
import { ar } from './ar'

export type Locale = 'en' | 'ar'

export const LOCALE_STORAGE_KEY = 'odcrm:locale'

const dictionaries: Record<Locale, Record<string, string>> = { en, ar }

/**
 * Get direction for locale. Used for root dir attribute.
 */
export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

/**
 * Get translation for key. Params replace {{key}} in the string.
 * Fallback: ar -> en -> key. Never throws.
 */
export function t(
  key: string,
  locale: Locale,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[locale]
  const enDict = dictionaries.en
  let raw = (locale === 'ar' ? dict[key] ?? enDict[key] : dict[key]) ?? enDict[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      raw = raw.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
    }
  }
  return raw
}

export { en, ar }
