import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppLanguage = 'en' | 'ar'

type TranslationDictionary = Record<string, string>

const STORAGE_KEY = 'odcrm:language'

const translations: Record<AppLanguage, TranslationDictionary> = {
  en: {
    'shell.productName': 'ODCRM',
    'shell.language': 'Language',
    'shell.english': 'English',
    'shell.arabic': 'Arabic',
    'shell.signOut': 'Sign out',
    'shell.production': 'Production',
    'shell.dev': 'Dev',
    'shell.build': 'Build',
    'shell.loading': 'Loading...',
    'nav.customers': 'OpensDoors Clients',
    'nav.marketing': 'OpensDoors Marketing',
    'nav.onboarding': 'Onboarding',
    'nav.settings': 'Settings',
    'customers.sectionTitle': 'Clients',
    'customers.accounts': 'Accounts',
    'customers.contacts': 'Contacts',
    'customers.leads': 'Leads',
    'customers.bridgeTitle': 'OpensDoors Clients is the live workspace for accounts, contacts, and leads.',
    'customers.bridgeBody': 'Keep client records current here, then continue in Marketing Readiness when outreach setup needs attention.',
    'customers.nextStep': 'Continue in Marketing Readiness',
    'marketing.sectionTitle': 'Marketing',
    'marketing.readiness': 'Readiness',
    'marketing.reports': 'Reports',
    'marketing.leadSources': 'Lead Sources',
    'marketing.compliance': 'Suppression List',
    'marketing.emailAccounts': 'Email Accounts',
    'marketing.templates': 'Templates',
    'marketing.sequences': 'Sequences',
    'marketing.schedules': 'Schedules',
    'marketing.inbox': 'Inbox',
    'marketing.guidance': 'Start with Readiness to see what needs attention now. Then use Sequences to inspect or act, Inbox to handle replies, and Reports to confirm results.',
    'marketing.guidanceSecondary': 'If setup or data blockers appear, switch to Onboarding or OpensDoors Clients, then return here to continue operations.',
    'marketing.openOnboarding': 'Open Onboarding setup',
    'marketing.openClients': 'Open Clients data health',
    'onboarding.sectionTitle': 'Onboarding',
    'onboarding.progressTracker': 'Progress Tracker',
    'onboarding.clientOnboarding': 'Client Onboarding',
    'onboarding.statusTitle': 'Onboarding status',
    'onboarding.statusBody': 'See whether this client should stay in onboarding or move on to the next workflow.',
    'onboarding.reviewReadiness': 'Review marketing readiness',
    'onboarding.continue': 'Continue onboarding',
    'onboarding.selectClientFirst': 'Select a client first.',
    'onboarding.selectClientBegin': 'Select a client to begin',
    'onboarding.selectClientBeginBody': 'Choose a client to review onboarding status, update progress, and complete the remaining setup work.',
    'progress.title': 'Onboarding progress',
    'progress.alertSelectTitle': 'Select a client to continue onboarding',
    'progress.alertSelectBody': 'Choose a client below to review progress and finish the remaining onboarding work.',
    'common.selectClient': 'Select client',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.refresh': 'Refresh',
    'common.back': 'Back',
    'common.open': 'Open',
    'common.review': 'Review',
    'common.create': 'Create',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.status': 'Status',
    'common.loading': 'Loading...',
    'common.followUp': 'Follow-up & troubleshooting',
    'emailAccounts.title': 'Email Accounts',
    'emailAccounts.description': 'Manage connected mailboxes, check sending readiness, and confirm safe sending limits for the selected client.',
    'templates.title': 'Templates',
    'templates.description': 'Find reusable outreach copy, preview how it renders, and update the templates this client relies on.',
    'sequences.title': 'Sequences',
    'sequences.description': 'Review sequence setup, recipient readiness, and launch state without changing how the current workflow behaves.',
    'schedules.title': 'Schedules',
    'schedules.description': 'See which schedules are active or paused, which mailbox and sequence each one uses, and what should happen next.',
    'inbox.title': 'Inbox',
    'inbox.description': 'Review conversations, handle replies, and keep operator follow-up moving across connected mailboxes.',
    'reports.title': 'Reports',
    'reports.description': 'Review what sent, what failed, who replied, and who opted out for the selected client.',
    'compliance.title': 'Compliance',
    'compliance.description': 'Review protection coverage and the current suppression lists for the selected client.',
    'leadSources.title': 'Lead Sources',
    'leadSources.description': 'See which lead sources are ready, review the latest batches for a client, and pass the right batch into Sequences.',
    'readiness.title': 'Readiness',
    'readiness.description': 'Review launch blockers, identity health, and recent sending outcomes for the selected client.',
    'search.templates': 'Search templates...',
    'search.inbox': 'Search contacts, companies, campaigns, or reply text...',
    'search.leadSources': 'Search lead sources',
    'filter.allStatus': 'All status',
    'actions.reviewBatches': 'Review batches',
    'actions.reviewContacts': 'Review contacts',
    'actions.openSummary': 'Open summary',
    'actions.openInbox': 'Open Inbox',
    'actions.openReports': 'Open Reports',
    'actions.openSequences': 'Open Sequences',
  },
  ar: {
    'shell.productName': 'أو دي سي آر إم',
    'shell.language': 'اللغة',
    'shell.english': 'الإنجليزية',
    'shell.arabic': 'العربية',
    'shell.signOut': 'تسجيل الخروج',
    'shell.production': 'الإنتاج',
    'shell.dev': 'تطوير',
    'shell.build': 'البنية',
    'shell.loading': 'جارٍ التحميل...',
    'nav.customers': 'عملاء أوبنز دورز',
    'nav.marketing': 'تسويق أوبنز دورز',
    'nav.onboarding': 'الإعداد',
    'nav.settings': 'الإعدادات',
    'customers.sectionTitle': 'العملاء',
    'customers.accounts': 'الحسابات',
    'customers.contacts': 'جهات الاتصال',
    'customers.leads': 'العملاء المحتملون',
    'customers.bridgeTitle': 'مساحة العملاء هي مساحة العمل المباشرة للحسابات وجهات الاتصال والعملاء المحتملين.',
    'customers.bridgeBody': 'حافظ على تحديث بيانات العميل هنا، ثم تابع إلى جاهزية التسويق عندما يحتاج إعداد التواصل إلى مراجعة.',
    'customers.nextStep': 'المتابعة إلى جاهزية التسويق',
    'marketing.sectionTitle': 'التسويق',
    'marketing.readiness': 'الجاهزية',
    'marketing.reports': 'التقارير',
    'marketing.leadSources': 'مصادر العملاء المحتملين',
    'marketing.compliance': 'قائمة المنع',
    'marketing.emailAccounts': 'حسابات البريد',
    'marketing.templates': 'القوالب',
    'marketing.sequences': 'التسلسلات',
    'marketing.schedules': 'الجداول',
    'marketing.inbox': 'الوارد',
    'marketing.guidance': 'ابدأ من الجاهزية لمعرفة ما يحتاج إلى اهتمام الآن، ثم استخدم التسلسلات للمراجعة أو التنفيذ، والوارد للتعامل مع الردود، والتقارير لتأكيد النتائج.',
    'marketing.guidanceSecondary': 'إذا ظهرت عوائق في الإعداد أو البيانات، انتقل إلى الإعداد أو العملاء ثم عد هنا لمتابعة العمل.',
    'marketing.openOnboarding': 'فتح إعداد الإعداد',
    'marketing.openClients': 'فتح صحة بيانات العملاء',
    'onboarding.sectionTitle': 'الإعداد',
    'onboarding.progressTracker': 'متابعة التقدم',
    'onboarding.clientOnboarding': 'إعداد العميل',
    'onboarding.statusTitle': 'حالة الإعداد',
    'onboarding.statusBody': 'اعرف ما إذا كان يجب أن يبقى هذا العميل في الإعداد أو ينتقل إلى سير العمل التالي.',
    'onboarding.reviewReadiness': 'مراجعة جاهزية التسويق',
    'onboarding.continue': 'متابعة الإعداد',
    'onboarding.selectClientFirst': 'اختر عميلاً أولاً.',
    'onboarding.selectClientBegin': 'اختر عميلاً للبدء',
    'onboarding.selectClientBeginBody': 'اختر عميلاً لمراجعة حالة الإعداد وتحديث التقدم وإكمال أعمال الإعداد المتبقية.',
    'progress.title': 'تقدم الإعداد',
    'progress.alertSelectTitle': 'اختر عميلاً لمتابعة الإعداد',
    'progress.alertSelectBody': 'اختر عميلاً أدناه لمراجعة التقدم وإنهاء أعمال الإعداد المتبقية.',
    'common.selectClient': 'اختر عميلاً',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.refresh': 'تحديث',
    'common.back': 'رجوع',
    'common.open': 'فتح',
    'common.review': 'مراجعة',
    'common.create': 'إنشاء',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.close': 'إغلاق',
    'common.status': 'الحالة',
    'common.loading': 'جارٍ التحميل...',
    'common.followUp': 'المتابعة واستكشاف الأخطاء',
    'emailAccounts.title': 'حسابات البريد',
    'emailAccounts.description': 'أدر صناديق البريد المتصلة، وافحص جاهزية الإرسال، وأكد حدود الإرسال الآمنة للعميل المحدد.',
    'templates.title': 'القوالب',
    'templates.description': 'اعثر على نصوص التواصل القابلة لإعادة الاستخدام، واعرض طريقة ظهورها، وحدّث القوالب التي يعتمد عليها هذا العميل.',
    'sequences.title': 'التسلسلات',
    'sequences.description': 'راجع إعداد التسلسلات وجاهزية المستلمين وحالة الإطلاق بدون تغيير سير العمل الحالي.',
    'schedules.title': 'الجداول',
    'schedules.description': 'اعرف أي الجداول نشطة أو متوقفة، وأي صندوق بريد وتسلسل يستخدم كل جدول، وما الذي سيحدث بعد ذلك.',
    'inbox.title': 'الوارد',
    'inbox.description': 'راجع المحادثات، وتعامل مع الردود، وحافظ على متابعة المشغل عبر صناديق البريد المتصلة.',
    'reports.title': 'التقارير',
    'reports.description': 'راجع ما تم إرساله وما فشل ومن رد ومن ألغى الاشتراك للعميل المحدد.',
    'compliance.title': 'الامتثال',
    'compliance.description': 'راجع تغطية الحماية وقوائم المنع الحالية للعميل المحدد.',
    'leadSources.title': 'مصادر العملاء المحتملين',
    'leadSources.description': 'اعرف أي مصادر العملاء المحتملين جاهزة، وراجع أحدث الدُفعات للعميل، ثم مرّر الدفعة الصحيحة إلى التسلسلات.',
    'readiness.title': 'الجاهزية',
    'readiness.description': 'راجع عوائق الإطلاق وصحة الحسابات ونتائج الإرسال الأخيرة للعميل المحدد.',
    'search.templates': 'ابحث في القوالب...',
    'search.inbox': 'ابحث في جهات الاتصال أو الشركات أو الحملات أو نص الرد...',
    'search.leadSources': 'ابحث في مصادر العملاء المحتملين',
    'filter.allStatus': 'كل الحالات',
    'actions.reviewBatches': 'مراجعة الدُفعات',
    'actions.reviewContacts': 'مراجعة جهات الاتصال',
    'actions.openSummary': 'فتح الملخص',
    'actions.openInbox': 'فتح الوارد',
    'actions.openReports': 'فتح التقارير',
    'actions.openSequences': 'فتح التسلسلات',
  },
}

interface I18nContextValue {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  dir: 'ltr' | 'rtl'
  isRTL: boolean
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en'

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'ar' || stored === 'en') return stored
  } catch {
    // Ignore storage access issues and use English.
  }

  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => getInitialLanguage())

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage)
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage)
    } catch {
      // Ignore storage failures for UI preferences.
    }
  }

  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const isRTL = dir === 'rtl'

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = language
    document.documentElement.dir = dir
    document.body.dir = dir
    document.body.dataset.odcrmLanguage = language
  }, [dir, language])

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    dir,
    isRTL,
    t: (key: string) => translations[language][key] ?? translations.en[key] ?? key,
  }), [dir, isRTL, language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
