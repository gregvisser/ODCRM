/**
 * Design System Tokens
 * 
 * THESE ARE THE ONLY SPACING/SIZE VALUES ALLOWED IN THE APP.
 * Do NOT use hardcoded px/rem values outside of these tokens.
 */

// ========================================
// SPACING SCALE (based on 4px)
// ========================================
export const spacing = {
  /** 4px - Minimal spacing */
  1: 1,
  /** 8px - Tight spacing */
  2: 2,
  /** 12px - Compact spacing */
  3: 3,
  /** 16px - Normal spacing */
  4: 4,
  /** 20px - Comfortable spacing */
  5: 5,
  /** 24px - Loose spacing */
  6: 6,
  /** 32px - Section spacing */
  8: 8,
  /** 48px - Major section spacing */
  12: 12,
  /** 64px - Large section spacing */
  16: 16,
} as const

// ========================================
// TYPOGRAPHY SCALE
// ========================================
export const fontSize = {
  /** 12px - Labels, captions */
  xs: 'xs',
  /** 14px - Body text, table data */
  sm: 'sm',
  /** 16px - Body text, form inputs */
  md: 'md',
  /** 18px - Section headings */
  lg: 'lg',
  /** 20px - Page headings */
  xl: 'xl',
  /** 24px - Major headings */
  '2xl': '2xl',
} as const

export const fontWeight = {
  /** 400 - Normal body text */
  normal: 'normal',
  /** 500 - Slightly emphasized */
  medium: 'medium',
  /** 600 - Headings, labels */
  semibold: 'semibold',
  /** 700 - Strong emphasis */
  bold: 'bold',
} as const

// ========================================
// COMPONENT SIZES
// ========================================
export const componentSize = {
  /** Small buttons, inputs - 32px height */
  sm: 'sm',
  /** Medium buttons, inputs - 40px height */
  md: 'md',
  /** Large buttons, inputs - 48px height */
  lg: 'lg',
} as const

export const iconSize = {
  /** 16px - Small icons */
  sm: 4,
  /** 20px - Medium icons */
  md: 5,
  /** 24px - Large icons */
  lg: 6,
  /** 32px - Extra large icons */
  xl: 8,
} as const

// ========================================
// BORDER RADIUS
// ========================================
export const radius = {
  /** 4px - Buttons, badges */
  sm: 'sm',
  /** 6px - Inputs, cards */
  md: 'md',
  /** 8px - Panels, modals */
  lg: 'lg',
  /** 12px - Major sections */
  xl: 'xl',
  /** 16px - Hero sections */
  '2xl': '2xl',
  /** 9999px - Pills, tags */
  full: 'full',
} as const

// ========================================
// BOX SHADOW
// ========================================
export const shadow = {
  /** Subtle hover effects */
  sm: 'sm',
  /** Cards, dropdowns */
  md: 'md',
  /** Modals, popovers */
  lg: 'lg',
  /** Major overlays */
  xl: 'xl',
} as const

// ========================================
// Z-INDEX SCALE
// ========================================
export const zIndex = {
  /** Base layer */
  base: 0,
  /** Slightly elevated */
  raised: 1,
  /** Dropdown menus */
  dropdown: 10,
  /** Sticky headers */
  sticky: 50,
  /** Fixed elements */
  fixed: 100,
  /** Overlays, backdrops */
  overlay: 500,
  /** Modals, drawers */
  modal: 1000,
  /** Toasts, tooltips */
  toast: 1500,
  /** Critical system messages */
  critical: 9999,
} as const

// ========================================
// LAYOUT CONSTANTS
// ========================================
export const layout = {
  /** Maximum content width for readability */
  maxContentWidth: '1600px',
  /** Maximum width for narrow content (forms) */
  maxNarrowWidth: '800px',
  /** Sidebar width (desktop) */
  sidebarWidth: '240px',
  /** Collapsed sidebar width */
  sidebarCollapsedWidth: '60px',
  /** Mobile bottom nav height */
  mobileNavHeight: '64px',
  /** Top header height */
  headerHeight: {
    mobile: '60px',
    desktop: '72px',
  },
} as const

// ========================================
// BREAKPOINTS (from theme)
// ========================================
export const breakpoint = {
  base: '0px',
  sm: '480px',
  md: '768px',
  lg: '992px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// ========================================
// SEMANTIC COLORS (from theme)
// ========================================
export const semanticColor = {
  // Backgrounds
  bgCanvas: 'bg.canvas',
  bgSurface: 'bg.surface',
  bgSubtle: 'bg.subtle',
  bgTransparent: 'bg.transparent',
  
  // Borders
  borderSubtle: 'border.subtle',
  
  // Text
  textPrimary: 'text.primary',
  textSecondary: 'text.secondary',
  textMuted: 'text.muted',
  textOnAccent: 'text.onAccent',
  
  // Sidebar
  sidebarBg: 'sidebar.bg',
  sidebarBorder: 'sidebar.border',
  sidebarText: 'sidebar.text',
  sidebarTextActive: 'sidebar.textActive',
  sidebarItemHover: 'sidebar.itemHover',
  sidebarItemActive: 'sidebar.itemActive',
  
  // Accent
  accentPrimary: 'accent.500',
  accentHover: 'accent.600',
  accentActive: 'accent.700',
} as const

// ========================================
// MOBILE TOUCH TARGETS
// ========================================
export const touchTarget = {
  /** Minimum tap target size (44x44px per iOS HIG) */
  minSize: '44px',
  /** Comfortable tap target */
  comfortable: '48px',
  /** Large tap target for primary actions */
  large: '56px',
} as const

// ========================================
// ANIMATION TIMING
// ========================================
export const transition = {
  /** Fast transitions (hover, focus) */
  fast: '0.15s',
  /** Normal transitions */
  normal: '0.2s',
  /** Slow transitions (page transitions) */
  slow: '0.3s',
  /** Easing function */
  ease: 'ease-in-out',
} as const

// ========================================
// TYPE EXPORTS
// ========================================
export type Spacing = keyof typeof spacing
export type FontSize = keyof typeof fontSize
export type FontWeight = keyof typeof fontWeight
export type ComponentSize = keyof typeof componentSize
export type IconSize = keyof typeof iconSize
export type Radius = keyof typeof radius
export type Shadow = keyof typeof shadow
export type ZIndex = keyof typeof zIndex
export type SemanticColor = keyof typeof semanticColor
