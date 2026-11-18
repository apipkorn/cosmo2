import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { StoreProvider } from '../lib/store';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
    </StoreProvider>
  );
}
