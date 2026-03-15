import { extendTheme, type ThemeConfig, type StyleFunctionProps } from '@chakra-ui/react'

const brand = {
  50: '#f5f7fb',
  100: '#d6dbe5',
  200: '#b4bccb',
  300: '#919bad',
  400: '#717b8d',
  500: '#565f71',
  600: '#424957',
  700: '#2d3440',
  800: '#1b212b',
  900: '#0d1117',
}

const accent = {
  50: '#fff8e0',
  100: '#fef0b8',
  200: '#fde58a',
  300: '#fbd24d',
  400: '#f7c724',
  500: '#e3b341',
  600: '#c89112',
  700: '#9a6d0a',
  800: '#6d4c06',
  900: '#483004',
}

const success = {
  500: '#2fbf71',
}

const warning = {
  500: '#f59e0b',
}

const danger = {
  500: '#ef4444',
}

const colors = {
  brand,
  accent,
  gray: brand,
  success,
  warning,
  danger,
}

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
  disableTransitionOnChange: false,
}

const formFieldOutlined = {
  field: {
    borderRadius: 'xl',
    borderWidth: '1px',
    borderColor: 'rgba(255,255,255,0.08)',
    bg: 'rgba(255,255,255,0.035)',
    color: 'text.primary',
    backdropFilter: 'blur(14px)',
    transition: 'all 0.18s ease',
    _placeholder: {
      color: 'text.muted',
    },
    _hover: {
      borderColor: 'rgba(227,179,65,0.28)',
      bg: 'rgba(255,255,255,0.05)',
    },
    _focusVisible: {
      borderColor: 'accent.500',
      boxShadow: '0 0 0 1px var(--chakra-colors-accent-500), 0 0 0 6px rgba(227, 179, 65, 0.12)',
      bg: 'rgba(255,255,255,0.065)',
    },
  },
}

const buttonScheme = (props: StyleFunctionProps) => props.colorScheme || 'accent'

const theme = extendTheme({
  config,
  colors,
  breakpoints: {
    base: '0em',
    sm: '30em',
    md: '48em',
    lg: '62em',
    xl: '80em',
    '2xl': '96em',
  },
  zIndices: {
    base: 0,
    raised: 1,
    dropdown: 10,
    sticky: 50,
    fixed: 100,
    overlay: 500,
    modal: 1000,
    toast: 1500,
    critical: 9999,
  },
  semanticTokens: {
    colors: {
      'bg.canvas': { default: '#0b0f14' },
      'bg.surface': { default: 'rgba(20, 25, 34, 0.86)' },
      'bg.subtle': { default: 'rgba(255,255,255,0.045)' },
      'bg.elevated': { default: 'rgba(30, 36, 47, 0.94)' },
      'bg.panel': { default: 'rgba(13,17,23,0.76)' },
      'bg.transparent': { default: 'transparent' },
      'border.subtle': { default: 'rgba(255,255,255,0.08)' },
      'border.strong': { default: 'rgba(227,179,65,0.18)' },
      'text.primary': { default: '#f5f7fb' },
      'text.secondary': { default: '#c7cfdb' },
      'text.muted': { default: '#8f9bad' },
      'text.onAccent': { default: '#0d1117' },
      'sidebar.bg': { default: 'rgba(14,18,24,0.9)' },
      'sidebar.border': { default: 'rgba(255,255,255,0.08)' },
      'sidebar.text': { default: '#aeb8c8' },
      'sidebar.textActive': { default: '#fff8e0' },
      'sidebar.itemHover': { default: 'rgba(255,255,255,0.06)' },
      'sidebar.itemActive': { default: 'linear-gradient(135deg, rgba(227,179,65,0.26), rgba(247,199,36,0.10))' },
    },
  },
  radii: {
    pill: '999px',
  },
  fonts: {
    heading: `'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    body: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  },
  shadows: {
    sm: '0 10px 30px rgba(0, 0, 0, 0.18)',
    md: '0 18px 44px rgba(0, 0, 0, 0.26)',
    lg: '0 24px 60px rgba(0, 0, 0, 0.34)',
    xl: '0 34px 84px rgba(0, 0, 0, 0.42)',
    outline: '0 0 0 1px rgba(227, 179, 65, 0.45), 0 0 0 6px rgba(227, 179, 65, 0.12)',
  },
  layerStyles: {
    glassPanel: {
      bg: 'bg.surface',
      border: '1px solid',
      borderColor: 'border.subtle',
      backdropFilter: 'blur(18px)',
      boxShadow: 'md',
    },
  },
  styles: {
    global: {
      'html, body': {
        bg: 'bg.canvas',
        color: 'text.primary',
        minHeight: '100%',
        transition: 'background-color 0.2s, color 0.2s',
        backgroundImage: 'radial-gradient(circle at top, rgba(227,179,65,0.08), transparent 26%), linear-gradient(180deg, #0d1117 0%, #0b0f14 100%)',
        backgroundAttachment: 'fixed',
      },
      body: {
        bg: 'bg.canvas',
      },
      '#root': {
        minHeight: '100vh',
      },
      '::selection': {
        background: 'rgba(227,179,65,0.32)',
        color: '#0d1117',
      },
      '[dir="rtl"] input, [dir="rtl"] textarea': {
        textAlign: 'right',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: 'xl',
        fontWeight: '700',
        letterSpacing: '0.01em',
        transition: 'all 0.18s ease',
      },
      sizes: {
        xs: { h: 8, px: 3, fontSize: 'xs' },
        sm: { h: 10, px: 4, fontSize: 'sm' },
        md: { h: 11, px: 5, fontSize: 'sm' },
        lg: { h: 12, px: 6, fontSize: 'md' },
      },
      variants: {
        solid: (props: StyleFunctionProps) => {
          const scheme = buttonScheme(props)
          return {
            bg: `${scheme}.500`,
            color: scheme === 'accent' ? 'text.onAccent' : 'white',
            boxShadow: '0 12px 28px rgba(227, 179, 65, 0.20)',
            _hover: {
              bg: `${scheme}.400`,
              transform: 'translateY(-1px)',
              boxShadow: '0 16px 34px rgba(227, 179, 65, 0.26)',
            },
            _active: {
              bg: `${scheme}.600`,
              transform: 'translateY(0)',
            },
          }
        },
        outline: {
          borderWidth: '1px',
          borderColor: 'border.subtle',
          color: 'text.primary',
          bg: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          _hover: {
            borderColor: 'border.strong',
            bg: 'rgba(255,255,255,0.06)',
          },
          _active: {
            bg: 'rgba(255,255,255,0.08)',
          },
        },
        ghost: {
          color: 'text.secondary',
          bg: 'transparent',
          _hover: {
            bg: 'rgba(255,255,255,0.05)',
            color: 'text.primary',
          },
          _active: {
            bg: 'rgba(255,255,255,0.08)',
          },
        },
      },
      defaultProps: {
        colorScheme: 'accent',
        variant: 'solid',
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'bg.surface',
          borderWidth: '1px',
          borderColor: 'border.subtle',
          borderRadius: '2xl',
          boxShadow: 'sm',
          backdropFilter: 'blur(18px)',
        },
        header: {
          pb: 3,
        },
      },
    },
    Heading: {
      baseStyle: {
        color: 'text.primary',
        letterSpacing: '-0.03em',
        fontWeight: '800',
      },
    },
    Text: {
      baseStyle: {
        color: 'text.secondary',
      },
    },
    Tabs: {
      baseStyle: {
        tab: {
          fontWeight: '700',
        },
      },
      variants: {
        softRounded: {
          tab: {
            borderRadius: 'xl',
            px: 4,
            py: 2.5,
            _selected: {
              bg: 'rgba(227,179,65,0.16)',
              color: 'accent.200',
              boxShadow: 'sm',
            },
          },
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'full',
        textTransform: 'none',
        letterSpacing: '0.02em',
        fontWeight: '700',
        px: 2.5,
        py: 1,
      },
      variants: {
        subtle: {
          bg: 'rgba(255,255,255,0.06)',
          color: 'text.primary',
        },
        solid: {
          bg: 'accent.500',
          color: 'text.onAccent',
        },
      },
    },
    Tag: {
      baseStyle: {
        borderRadius: 'full',
      },
    },
    Alert: {
      baseStyle: {
        container: {
          borderRadius: '2xl',
          borderWidth: '1px',
          backdropFilter: 'blur(18px)',
          boxShadow: 'sm',
        },
        title: {
          fontWeight: '800',
        },
        description: {
          color: 'text.secondary',
        },
      },
      variants: {
        subtle: (props: StyleFunctionProps) => ({
          container: {
            bg: props.status === 'success'
              ? 'rgba(47,191,113,0.12)'
              : props.status === 'warning'
                ? 'rgba(245,158,11,0.12)'
                : props.status === 'error'
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(227,179,65,0.12)',
            borderColor: props.status === 'success'
              ? 'rgba(47,191,113,0.24)'
              : props.status === 'warning'
                ? 'rgba(245,158,11,0.24)'
                : props.status === 'error'
                  ? 'rgba(239,68,68,0.24)'
                  : 'rgba(227,179,65,0.24)',
          },
        }),
      },
      defaultProps: {
        variant: 'subtle',
      },
    },
    Table: {
      variants: {
        simple: {
          table: {
            borderCollapse: 'separate',
            borderSpacing: '0 8px',
          },
          thead: {
            tr: {
              th: {
                bg: 'rgba(255,255,255,0.04)',
                color: 'text.muted',
                fontWeight: '700',
                textTransform: 'uppercase',
                fontSize: 'xs',
                letterSpacing: '0.08em',
                borderBottomWidth: '0',
              },
            },
          },
          tbody: {
            tr: {
              td: {
                bg: 'rgba(255,255,255,0.025)',
                borderTopWidth: '1px',
                borderBottomWidth: '1px',
                borderColor: 'border.subtle',
                color: 'text.primary',
                '&:first-of-type': {
                  borderLeftWidth: '1px',
                  borderTopLeftRadius: '16px',
                  borderBottomLeftRadius: '16px',
                },
                '&:last-of-type': {
                  borderRightWidth: '1px',
                  borderTopRightRadius: '16px',
                  borderBottomRightRadius: '16px',
                },
              },
              _hover: {
                td: {
                  bg: 'rgba(227,179,65,0.06)',
                  borderColor: 'rgba(227,179,65,0.18)',
                },
              },
            },
          },
        },
      },
    },
    Input: {
      variants: {
        outline: formFieldOutlined,
      },
      defaultProps: {
        focusBorderColor: 'accent.500',
      },
    },
    Select: {
      variants: {
        outline: formFieldOutlined,
      },
      defaultProps: {
        focusBorderColor: 'accent.500',
      },
    },
    Textarea: {
      variants: {
        outline: formFieldOutlined,
      },
      defaultProps: {
        focusBorderColor: 'accent.500',
      },
    },
    NumberInput: {
      variants: {
        outline: formFieldOutlined,
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          bg: 'bg.elevated',
          borderWidth: '1px',
          borderColor: 'border.subtle',
          borderRadius: '2xl',
          boxShadow: 'xl',
          backdropFilter: 'blur(20px)',
        },
        header: {
          fontWeight: '800',
          borderBottomWidth: '1px',
          borderColor: 'border.subtle',
          pb: 4,
        },
        footer: {
          borderTopWidth: '1px',
          borderColor: 'border.subtle',
          pt: 4,
        },
      },
    },
    Drawer: {
      baseStyle: {
        dialog: {
          bg: 'bg.elevated',
          borderLeftWidth: '1px',
          borderColor: 'border.subtle',
          boxShadow: 'xl',
        },
        header: {
          fontWeight: '800',
          borderBottomWidth: '1px',
          borderColor: 'border.subtle',
        },
      },
    },
    Menu: {
      baseStyle: {
        list: {
          bg: 'bg.elevated',
          borderColor: 'border.subtle',
          borderRadius: 'xl',
          boxShadow: 'lg',
          backdropFilter: 'blur(18px)',
          p: 2,
        },
        item: {
          borderRadius: 'lg',
          _hover: {
            bg: 'rgba(255,255,255,0.06)',
          },
          _focus: {
            bg: 'rgba(255,255,255,0.06)',
          },
        },
      },
    },
    Stat: {
      baseStyle: {
        label: {
          color: 'text.muted',
          fontSize: 'xs',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: '700',
        },
        number: {
          color: 'text.primary',
          letterSpacing: '-0.03em',
          fontWeight: '800',
        },
        helpText: {
          color: 'text.secondary',
        },
      },
    },
    Checkbox: {
      baseStyle: {
        control: {
          borderColor: 'border.subtle',
          _checked: {
            bg: 'accent.500',
            borderColor: 'accent.500',
            color: 'text.onAccent',
          },
        },
      },
    },
    Switch: {
      baseStyle: {
        track: {
          bg: 'rgba(255,255,255,0.12)',
          _checked: {
            bg: 'accent.500',
          },
        },
      },
    },
  },
})

export default theme

