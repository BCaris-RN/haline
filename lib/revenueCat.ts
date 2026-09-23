import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal';
import { entitlementsFromCustomerInfo, type EntitlementState } from './entitlements';

type RevenueCatStatus = 'loading' | 'ready' | 'unavailable';

interface RevenueCatContextValue {
  status: RevenueCatStatus;
  customerInfo: CustomerInfo | null;
  defaultPackages: PurchasesPackage[];
  entitlements: EntitlementState;
  subscriptionsAvailable: boolean;
  error: string | null;
  purchasePackage: (aPackage: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

function unavailableMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Subscriptions unavailable, try again later.';
}

function packagesFromOfferings(offerings: PurchasesOfferings): PurchasesPackage[] {
  const defaultOffering = offerings.all.default ?? offerings.current;
  return defaultOffering?.availablePackages ?? [];
}

async function loadCustomerInfoAndOfferings(): Promise<{
  customerInfo: CustomerInfo;
  defaultPackages: PurchasesPackage[];
}> {
  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);
  return {
    customerInfo,
    defaultPackages: packagesFromOfferings(offerings),
  };
}

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RevenueCatStatus>('loading');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [defaultPackages, setDefaultPackages] = useState<PurchasesPackage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const markUnavailable = useCallback((reason: unknown) => {
    setStatus('unavailable');
    setCustomerInfo(null);
    setDefaultPackages([]);
    setError(unavailableMessage(reason));
  }, []);

  const refreshCustomerInfo = useCallback(async () => {
    try {
      const loaded = await loadCustomerInfoAndOfferings();
      setCustomerInfo(loaded.customerInfo);
      setDefaultPackages(loaded.defaultPackages);
      setError(null);
      setStatus(loaded.defaultPackages.length > 0 ? 'ready' : 'unavailable');
      if (loaded.defaultPackages.length === 0) {
        setError('Subscriptions unavailable, try again later.');
      }
    } catch (loadError) {
      markUnavailable(loadError);
    }
  }, [markUnavailable]);

  useEffect(() => {
    let cancelled = false;
    let listener: ((updatedInfo: CustomerInfo) => void) | null = null;

    const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    if (Platform.OS !== 'ios') {
      markUnavailable('Subscriptions require an iOS dev/EAS build. Expo Go is not a valid purchase test path.');
      return () => { cancelled = true; };
    }
    if (!iosKey) {
      markUnavailable('RevenueCat iOS key is not configured.');
      return () => { cancelled = true; };
    }

    try {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: iosKey });
      listener = (updatedInfo: CustomerInfo) => {
        if (!cancelled) setCustomerInfo(updatedInfo);
      };
      Purchases.addCustomerInfoUpdateListener(listener);
    } catch (configureError) {
      markUnavailable(configureError);
      return () => { cancelled = true; };
    }

    void loadCustomerInfoAndOfferings()
      .then((loaded) => {
        if (cancelled) return;
        setCustomerInfo(loaded.customerInfo);
        setDefaultPackages(loaded.defaultPackages);
        setError(null);
        setStatus(loaded.defaultPackages.length > 0 ? 'ready' : 'unavailable');
        if (loaded.defaultPackages.length === 0) {
          setError('Subscriptions unavailable, try again later.');
        }
      })
      .catch((loadError) => {
        if (!cancelled) markUnavailable(loadError);
      });

    return () => {
      cancelled = true;
      if (listener) Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [markUnavailable]);

  const purchasePackage = useCallback(async (aPackage: PurchasesPackage) => {
    try {
      const result = await Purchases.purchasePackage(aPackage);
      setCustomerInfo(result.customerInfo);
      await refreshCustomerInfo();
    } catch (purchaseError) {
      markUnavailable(purchaseError);
    }
  }, [markUnavailable, refreshCustomerInfo]);

  const restorePurchases = useCallback(async () => {
    try {
      const restoredInfo = await Purchases.restorePurchases();
      setCustomerInfo(restoredInfo);
      await refreshCustomerInfo();
    } catch (restoreError) {
      markUnavailable(restoreError);
    }
  }, [markUnavailable, refreshCustomerInfo]);

  const value = useMemo<RevenueCatContextValue>(() => ({
    status,
    customerInfo,
    defaultPackages,
    entitlements: entitlementsFromCustomerInfo(customerInfo),
    subscriptionsAvailable: status === 'ready' && defaultPackages.length > 0,
    error,
    purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
  }), [customerInfo, defaultPackages, error, purchasePackage, refreshCustomerInfo, restorePurchases, status]);

  return createElement(RevenueCatContext.Provider, { value }, children);
}

export function useRevenueCat(): RevenueCatContextValue {
  const value = useContext(RevenueCatContext);
  if (!value) {
    throw new Error('useRevenueCat must be used inside RevenueCatProvider.');
  }
  return value;
}
