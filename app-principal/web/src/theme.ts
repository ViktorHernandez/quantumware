import { createTheme, type MantineColorsTuple } from '@mantine/core';

const marca: MantineColorsTuple = [
  '#eef1ff',
  '#dbe0f7',
  '#b4bdec',
  '#8a98e2',
  '#6878d9',
  '#5363d4',
  '#4959d2',
  '#3a49ba',
  '#3240a7',
  '#283593',
];

const acento: MantineColorsTuple = [
  '#e6fcf5',
  '#d0f7ea',
  '#a3edd3',
  '#72e3bb',
  '#4edaa7',
  '#38d59a',
  '#2bd292',
  '#1bb97e',
  '#0ba46f',
  '#008f5e',
];

export const theme = createTheme({
  primaryColor: 'marca',
  colors: { marca, acento },
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  fontFamily:
    '"Inter", "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif',
  headings: {
    fontFamily:
      '"Inter", "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif',
    sizes: {
      h1: { fontWeight: '750', fontSize: '1.9rem' },
      h2: { fontWeight: '700', fontSize: '1.5rem' },
      h3: { fontWeight: '650', fontSize: '1.2rem' },
      h4: { fontWeight: '600' },
    },
  },
  shadows: {
    xs: '0 1px 2px rgba(16, 24, 40, 0.06)',
    sm: '0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)',
    md: '0 4px 12px rgba(16, 24, 40, 0.08), 0 2px 4px rgba(16, 24, 40, 0.04)',
    lg: '0 12px 28px rgba(16, 24, 40, 0.10), 0 4px 8px rgba(16, 24, 40, 0.05)',
  },
  components: {
    Card: {
      defaultProps: { withBorder: true, shadow: 'xs', padding: 'lg', radius: 'md' },
    },
    Paper: { defaultProps: { radius: 'md' } },
    Button: { defaultProps: { fw: 600 } },
    Table: { defaultProps: { verticalSpacing: 'sm', horizontalSpacing: 'md' } },
    Badge: { defaultProps: { radius: 'sm' } },
  },
  other: {
    gradienteMarca:
      'linear-gradient(135deg, #283593 0%, #3a49ba 45%, #1bb97e 140%)',
    superficie: '#f6f7fb',
  },
});
