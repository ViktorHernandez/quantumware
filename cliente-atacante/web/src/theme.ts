import { createTheme, type MantineColorsTuple } from '@mantine/core';

const laboratorio: MantineColorsTuple = [
  '#ffeaec',
  '#fdd4d6',
  '#f3a7ab',
  '#ea777d',
  '#e24f57',
  '#dd353f',
  '#dc2833',
  '#c31a26',
  '#af1221',
  '#9a001b',
];

export const theme = createTheme({
  primaryColor: 'laboratorio',
  colors: { laboratorio },
  defaultRadius: 'md',
  fontFamily:
    '"Inter", "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif',
  fontFamilyMonospace:
    '"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
});
