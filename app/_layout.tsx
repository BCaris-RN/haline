/*
 *                    .-"""""-.
 *                  .'  .---.  '.
 *                 /  .'     '.  \
 *                /  /         \  \
 *               /  /           \  \
 *              /  /             \  '.
 *            .'  /               '.  '.
 *      .----'  .'                  '.  '-.____
 *     (  .----'                      '-.____  )
 *      '-'                                  '-'
 *
 *     _   _    _    _     ___ _   _ _____
 *    | | | |  / \  | |   |_ _| \ | | ____|
 *    | |_| | / _ \ | |    | ||  \| |  _|
 *    |  _  |/ ___ \| |___ | || |\  | |___
 *    |_| |_/_/   \_\_____|___|_| \_|_____|
 *    ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~
 *    Ocean climate, measured.
 *
 *    lib/paywallConfig.ts
 *    Subscription products, entitlements, and paywall copy.
 *
 *    Science: Caris (2026) · doi:10.5281/zenodo.20804280
 *    License: MIT
 */

import { Stack } from 'expo-router';
import { RevenueCatProvider } from '../lib/revenueCat';

export default function RootLayout() {
  return (
    <RevenueCatProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </RevenueCatProvider>
  );
}
