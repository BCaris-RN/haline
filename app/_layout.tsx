import { Stack } from 'expo-router';
import { RevenueCatProvider } from '../lib/revenueCat';

export default function RootLayout() {
  return (
    <RevenueCatProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </RevenueCatProvider>
  );
}
