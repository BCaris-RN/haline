import { Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from '@revenuecat/purchases-typescript-internal';
import { CONTACT_EMAIL, PRIVACY_URL, TERMS_URL } from '../lib/paywallConfig';
import { useRevenueCat } from '../lib/revenueCat';

function openUrl(url: string): void {
  void Linking.openURL(url);
}

function openEmail(email: string): void {
  void Linking.openURL(`mailto:${email}`);
}

function formatBillingPeriod(period: string | null): string {
  if (!period) return 'one-time access';
  const normalized = period.toUpperCase();
  if (normalized === 'P1W') return 'weekly billing';
  if (normalized === 'P1M') return 'monthly billing';
  if (normalized === 'P2M') return 'every 2 months';
  if (normalized === 'P3M') return 'every 3 months';
  if (normalized === 'P6M') return 'every 6 months';
  if (normalized === 'P1Y') return 'annual billing';
  return `billing period ${period}`;
}

function PackageCard({
  aPackage,
  onPurchase,
}: {
  aPackage: PurchasesPackage;
  onPurchase: (aPackage: PurchasesPackage) => void;
}) {
  return (
    <View style={styles.packageCard}>
      <Text style={styles.packageTitle}>{aPackage.product.title}</Text>
      <Text style={styles.price}>{aPackage.product.priceString}</Text>
      <Text style={styles.packageMeta}>
        {formatBillingPeriod(aPackage.product.subscriptionPeriod)}. Subscription auto-renews until canceled.
      </Text>
      <Pressable onPress={() => onPurchase(aPackage)} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

export default function PaywallScreen() {
  const {
    defaultPackages,
    purchasePackage,
    restorePurchases,
    subscriptionsAvailable,
    error,
  } = useRevenueCat();
  const packagesToShow = defaultPackages.slice(0, 2);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: true, title: 'Haline Pro' }} />
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.kicker}>Haline Pro</Text>
        <Text style={styles.title}>Unlock historical ocean context</Text>
        <Text style={styles.body}>
          Pro unlocks historical charting and export. The dashboard and method notes remain free.
        </Text>

        {!subscriptionsAvailable || packagesToShow.length === 0 ? (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableTitle}>Subscriptions unavailable, try again later.</Text>
            <Text style={styles.body}>{error ?? 'Offerings are not available right now.'}</Text>
          </View>
        ) : (
          <View style={styles.packages}>
            {packagesToShow.map((aPackage) => (
              <PackageCard
                key={aPackage.identifier}
                aPackage={aPackage}
                onPurchase={(selectedPackage) => { void purchasePackage(selectedPackage); }}
              />
            ))}
          </View>
        )}

        <Pressable onPress={() => { void restorePurchases(); }} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
        </Pressable>

        <View style={styles.links}>
          <Pressable onPress={() => openUrl(TERMS_URL)}>
            <Text style={styles.linkText}>Terms of Use</Text>
          </Pressable>
          <Pressable onPress={() => openUrl(PRIVACY_URL)}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => openEmail(CONTACT_EMAIL)}>
            <Text style={styles.linkText}>Students & teachers: classroom pricing coming soon — contact us</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  screen: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: 20,
    maxWidth: 760,
    paddingBottom: 96,
    paddingHorizontal: 24,
    paddingTop: 24,
    width: '100%',
  },
  kicker: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '700',
  },
  body: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
  },
  packages: {
    gap: 14,
  },
  packageCard: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  packageTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  price: {
    color: '#0369a1',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 8,
  },
  packageMeta: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0369a1',
    borderRadius: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderColor: '#0369a1',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#0369a1',
    fontSize: 15,
    fontWeight: '700',
  },
  links: {
    borderTopColor: '#cbd5e1',
    borderTopWidth: 1,
    gap: 14,
    paddingTop: 18,
  },
  linkText: {
    color: '#0369a1',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  unavailable: {
    borderLeftColor: '#b45309',
    borderLeftWidth: 4,
    paddingLeft: 16,
  },
  unavailableTitle: {
    color: '#92400e',
    fontSize: 17,
    fontWeight: '700',
  },
});
