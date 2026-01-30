import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const brand = {
  50: '#f5f8fa',
  100: '#e1eaf0',
  200: '#cbd6e2',
  300: '#a7b8c8',
  400: '#8696a8',
  500: '#66788a',
  600: '#4d5c6d',
  700: '#33475b',
  800: '#243747',
  900: '#1b2a38',
}

const accent = {
  50: '#fff3ef',
  100: '#ffd9cc',
  200: '#ffb8a1',
  300: '#ff9b7a',
  400: '#ff855f',
  500: '#ff7a59',
  600: '#f25c3c',
  700: '#d94d30',
  800: '#b63b26',
  900: '#8f2a1b',
}

const colors = {
  brand,
  accent,
  gray: brand,
}

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
  disableTransitionOnChange: false,
}

const formFieldOutlined = {
  field: {
    borderRadius: 'md',
    borderWidth: '1px',
    borderColor: 'brand.200',
    bg: 'white',
    transition: 'all 0.2s ease',
    _placeholder: {
      color: 'brand.400',
    },
    _hover: {
      borderColor: 'brand.300',
    },
    _focusVisible: {
      borderColor: 'accent.500',
      boxShadow: '0 0 0 1px var(--chakra-colors-accent-500)',
    },
    _dark: {
      borderColor: 'brand.700',
      bg: 'brand.800',
      color: 'white',
      _placeholder: {
        color: 'brand.400',
      },
      _hover: {
        borderColor: 'brand.600',
      },
      _focusVisible: {
        borderColor: 'brand.500',
        boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
      },
    },
  },
}

const theme = extendTheme({
  config,
  colors,
  breakpoints: {
    base: '0em',    // 0px
    sm: '30em',     // 480px
    md: '48em',     // 768px
    lg: '62em',     // 992px
    xl: '80em',     // 1280px
    '2xl': '96em',  // 1536px
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
      'bg.canvas': {
        default: 'brand.50',
        _dark: 'brand.900',
      },
      'bg.surface': {
        default: 'white',
        _dark: 'brand.800',
      },
      'bg.subtle': {
        default: 'brand.100',
        _dark: 'brand.700',
      },
      'border.subtle': {
        default: 'brand.200',
        _dark: 'brand.700',
      },
      'text.muted': {
        default: 'brand.500',
        _dark: 'brand.300',
      },
      'text.primary': {
        default: 'brand.900',
        _dark: 'brand.50',
      },
      'text.secondary': {
        default: 'brand.600',
        _dark: 'brand.200',
      },
      'sidebar.bg': {
        default: 'brand.700',
        _dark: 'brand.800',
      },
      'sidebar.border': {
        default: 'brand.800',
        _dark: 'brand.900',
      },
      'sidebar.text': {
        default: 'whiteAlpha.700',
        _dark: 'whiteAlpha.700',
      },
      'sidebar.textActive': {
        default: 'white',
        _dark: 'white',
      },
      'sidebar.itemHover': {
        default: 'whiteAlpha.200',
        _dark: 'whiteAlpha.200',
      },
      'sidebar.itemActive': {
        default: 'whiteAlpha.300',
        _dark: 'whiteAlpha.300',
      },
    },
  },
  radii: {
    pill: '999px',
  },
  fonts: {
    heading: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    body: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  },
  styles: {
    global: (props: any) => ({
      'html, body': {
        bg: props.colorMode === 'dark' ? 'brand.900' : 'brand.50',
        color: props.colorMode === 'dark' ? 'brand.50' : 'brand.900',
        minHeight: '100%',
        transition: 'background-color 0.2s, color 0.2s',
      },
      body: {
        bg: props.colorMode === 'dark' ? 'brand.900' : 'brand.50',
      },
      '#root': {
        minHeight: '100vh',
      },
      '::selection': {
        background: props.colorMode === 'dark' ? 'brand.700' : 'brand.100',
        color: props.colorMode === 'dark' ? 'white' : 'brand.900',
      },
    }),
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: 'md',
        fontWeight: '600',
        letterSpacing: '0.01em',
        transition: 'all 0.2s ease',
      },
      variants: {
        solid: {
          bg: 'accent.500',
          color: 'white',
          boxShadow: 'sm',
          _hover: {
            bg: 'accent.600',
            boxShadow: 'md',
            transform: 'translateY(-1px)',
          },
          _active: {
            bg: 'accent.700',
            boxShadow: 'sm',
            transform: 'translateY(0)',
          },
          _dark: {
            bg: 'accent.600',
            _hover: {
              bg: 'accent.700',
            },
            _active: {
              bg: 'accent.800',
            },
          },
        },
        outline: {
          borderColor: 'brand.200',
          color: 'brand.700',
          bg: 'white',
          _hover: {
            borderColor: 'brand.400',
            color: 'brand.800',
            bg: 'brand.50',
            boxShadow: 'xs',
          },
          _active: {
            borderColor: 'brand.500',
            color: 'brand.900',
            bg: 'brand.100',
          },
          _dark: {
            borderColor: 'brand.600',
            color: 'brand.200',
            bg: 'brand.800',
            _hover: {
              borderColor: 'brand.500',
              color: 'brand.50',
              bg: 'brand.700',
            },
            _active: {
              borderColor: 'brand.400',
              color: 'white',
              bg: 'brand.600',
            },
          },
        },
        ghost: {
          color: 'brand.700',
          bg: 'transparent',
          _hover: {
            bg: 'brand.100',
            color: 'brand.900',
          },
          _active: {
            bg: 'brand.200',
          },
          _dark: {
            color: 'brand.200',
            _hover: {
              bg: 'brand.700',
              color: 'brand.50',
            },
            _active: {
              bg: 'brand.600',
            },
          },
        },
      },
      defaultProps: {
        colorScheme: 'gray',
        variant: 'solid',
      },
    },
    Heading: {
      baseStyle: {
        color: 'brand.800',
        letterSpacing: '-0.01em',
        _dark: {
          color: 'brand.50',
        },
      },
    },
    Tabs: {
      baseStyle: {
        tab: {
          fontWeight: '600',
        },
      },
      variants: {
        softRounded: {
          tab: {
            borderRadius: 'md',
            px: 4,
            py: 2,
            _selected: {
              bg: 'brand.700',
              color: 'white',
              boxShadow: 'sm',
              _dark: {
                bg: 'brand.600',
              },
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
      },
    },
    Tag: {
      baseStyle: {
        borderRadius: 'full',
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            bg: 'bg.subtle',
            color: 'text.primary',
            fontWeight: '600',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          },
          td: {
            borderBottomColor: 'border.subtle',
            color: 'text.primary',
          },
          tr: {
            _hover: {
              bg: 'brand.50',
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
        focusBorderColor: 'brand.700',
      },
    },
    Select: {
      variants: {
        outline: formFieldOutlined,
      },
      defaultProps: {
        focusBorderColor: 'brand.700',
      },
    },
    Textarea: {
      variants: {
        outline: formFieldOutlined,
      },
      defaultProps: {
        focusBorderColor: 'brand.700',
      },
    },
    NumberInput: {
      variants: {
        outline: formFieldOutlined,
      },
    },
  },
})

export default theme

