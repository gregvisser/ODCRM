import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const colors = {
  brand: {
    50: '#f4f7f4',
    100: '#dfe9e3',
    200: '#c8d8cf',
    300: '#afc6b8',
    400: '#96b4a1',
    500: '#7ca38c',
    600: '#6e8f7b',
    700: '#5c7564',
    800: '#485b4e',
    900: '#2d3a32',
  },
  accent: {
    50: '#fdf6ed',
    100: '#fae5c9',
    200: '#f3ce9a',
    300: '#ecb56a',
    400: '#e69f44',
    500: '#cd7f29',
    600: '#a06120',
    700: '#744417',
    800: '#47270d',
    900: '#1f0c02',
  },
}

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

const theme = extendTheme({
  config,
  colors,
  fonts: {
    heading: `'Playfair Display', serif`,
    body: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  },
  styles: {
    global: {
      body: {
        bg: colors.brand[50],
        color: colors.brand[900],
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
  },
})

export default theme

