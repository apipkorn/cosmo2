import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#14181F',
  muted: '#5B6472',
  border: '#E1E4E9',
  accent: '#0F766E',
  onAccent: '#FFFFFF',
  chip: '#E6EAEE',
  star: '#D97706',
};

const dark: typeof light = {
  bg: '#0E1116',
  card: '#181C23',
  text: '#F1F3F5',
  muted: '#9BA3AF',
  border: '#2A303A',
  accent: '#2DD4BF',
  onAccent: '#06241F',
  chip: '#232933',
  star: '#FBBF24',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
