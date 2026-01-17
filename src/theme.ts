import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const brand = {
  50: '#effae9',
  100: '#d7f2e4',
  200: '#bce4d6',
  300: '#a1d5c8',
  400: '#87c7b8',
  500: '#75a99a', // primary brand color (#75a99a)
  600: '#5f857b',
  700: '#4a695f',
  800: '#334d44',
  900: '#1f322b',
}

const accent = {
  50: '#effdf5',
  100: '#cdf7e6',
  200: '#a7f0d4',
  300: '#7fe6c0',
  400: '#57dba9',
  500: '#3eb489', // accent highlight (#3eb489)
  600: '#2c8b68',
  700: '#1f624a',
  800: '#103b2b',
  900: '#072116',
}

const sage = {
  50: '#effae9',
  100: '#e2f3e3',
  200: '#cce7d4',
  300: '#b6d6c6',
  400: '#9ec5b3',
  500: '#75a99a',
  600: '#5d867a',
  700: '#46685e',
  800: '#2f4a42',
  900: '#1f322b',
}

const colors = {
  brand,
  accent,
  mist: {
    50: '#effae9', // soft background (#effae9)
  },
  gray: sage,
  teal: accent,
}

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
  disableTransitionOnChange: false,
}

const formFieldOutlined = {
  field: {
    borderRadius: 'xl',
    borderWidth: '1px',
    borderColor: 'brand.100',
    bg: 'white',
    transition: 'all 0.2s ease',
    _placeholder: {
      color: 'brand.400',
    },
    _hover: {
      borderColor: 'brand.200',
    },
    _focusVisible: {
      borderColor: 'accent.400',
      boxShadow: '0 0 0 1px var(--chakra-colors-accent-400)',
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
        borderColor: 'brand.700',
        boxShadow: '0 0 0 1px var(--chakra-colors-brand-700)',
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
  semanticTokens: {
    colors: {
      'bg.canvas': { 
        default: 'mist.50',
        _dark: 'brand.900',
      },
      'bg.surface': { 
        default: 'white',
        _dark: 'brand.800',
      },
      'bg.subtle': { 
        default: 'brand.50',
        _dark: 'brand.700',
      },
      'border.subtle': { 
        default: 'brand.100',
        _dark: 'brand.600',
      },
      'text.muted': { 
        default: 'brand.600',
        _dark: 'brand.300',
      },
      'text.primary': {
        default: 'brand.900',
        _dark: 'brand.50',
      },
      'text.secondary': {
        default: 'brand.700',
        _dark: 'brand.200',
      },
    },
  },
  radii: {
    pill: '999px',
  },
  fonts: {
    heading: `'Playfair Display', serif`,
    body: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  },
  styles: {
    global: (props: any) => ({
      'html, body': {
        bg: props.colorMode === 'dark' ? 'brand.900' : 'mist.50',
        color: props.colorMode === 'dark' ? 'brand.50' : 'brand.900',
        minHeight: '100%',
        transition: 'background-color 0.2s, color 0.2s',
      },
      body: {
        bg: props.colorMode === 'dark' ? 'brand.900' : 'mist.50',
      },
      '#root': {
        minHeight: '100vh',
      },
      '::selection': {
        background: props.colorMode === 'dark' ? 'brand.700' : 'mist.50',
        color: props.colorMode === 'dark' ? 'white' : 'brand.900',
      },
    }),
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: 'full',
        fontWeight: '600',
        letterSpacing: '0.02em',
        transition: 'all 0.2s ease',
      },
      variants: {
        solid: {
          bg: 'brand.900',
          color: 'white',
          boxShadow: 'sm',
          _hover: {
            bg: 'brand.800',
            boxShadow: 'md',
            transform: 'translateY(-1px)',
          },
          _active: {
            bg: 'brand.700',
            boxShadow: 'sm',
            transform: 'translateY(0)',
          },
          _dark: {
            bg: 'brand.700',
            _hover: {
              bg: 'brand.600',
            },
            _active: {
              bg: 'brand.500',
            },
          },
        },
        outline: {
          borderColor: 'brand.200',
          color: 'brand.700',
          bg: 'whiteAlpha.700',
          _hover: {
            borderColor: 'brand.400',
            color: 'brand.800',
            bg: 'white',
            boxShadow: 'xs',
          },
          _active: {
            borderColor: 'brand.500',
            color: 'brand.900',
            bg: 'brand.50',
          },
          _dark: {
            borderColor: 'brand.600',
            color: 'brand.200',
            bg: 'brand.800',
            _hover: {
              borderColor: 'brand.500',
              color: 'brand.100',
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
            bg: 'brand.50',
            color: 'brand.900',
          },
          _active: {
            bg: 'brand.100',
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
            borderRadius: 'full',
            px: 4,
            py: 2,
            _selected: {
              bg: 'brand.900',
              color: 'white',
              boxShadow: 'sm',
              _dark: {
                bg: 'brand.700',
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
          },
          td: {
            borderBottomColor: 'border.subtle',
            color: 'text.primary',
          },
          tr: {
            _hover: {
              bg: 'bg.subtle',
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

