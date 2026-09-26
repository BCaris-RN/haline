// .-~-.  HALINE  ·  lib/__tests__/revenueCat.test.ts
// Regression tests for RevenueCat provider lifecycle and purchase handling.

import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PurchasesPackage } from '@revenuecat/purchases-typescript-internal';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { RevenueCatProvider, useRevenueCat } from '../revenueCat';

type RevenueCatSnapshot = ReturnType<typeof useRevenueCat>;

const purchasesMock = vi.hoisted(() => ({
  addCustomerInfoUpdateListener: vi.fn(),
  configure: vi.fn(),
  getCustomerInfo: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  removeCustomerInfoUpdateListener: vi.fn(),
  restorePurchases: vi.fn(),
  setLogLevel: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('react-native-purchases', () => ({
  default: purchasesMock,
  LOG_LEVEL: { WARN: 'WARN' },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function StatusProbe({ onStatus }: { onStatus: (status: string) => void }) {
  const { status } = useRevenueCat();
  onStatus(status);
  return null;
}

function ContextProbe({ onValue }: { onValue: (value: RevenueCatSnapshot) => void }) {
  onValue(useRevenueCat());
  return null;
}

const customerInfoWithoutPro = { entitlements: { active: {} } };

const monthlyPackage = {
  identifier: 'pro_monthly',
  product: {
    priceString: '$4.99',
    subscriptionPeriod: 'P1M',
    title: 'Haline Pro Monthly',
  },
} as PurchasesPackage;

async function renderLoadedProvider(onValue: (value: RevenueCatSnapshot) => void): Promise<ReactTestRenderer> {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'test-ios-key';
  purchasesMock.getCustomerInfo.mockResolvedValue(customerInfoWithoutPro);
  purchasesMock.getOfferings.mockResolvedValue({
    all: { default: { availablePackages: [monthlyPackage] } },
    current: null,
  });

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(
      RevenueCatProvider,
      null,
      createElement(ContextProbe, { onValue }),
    ));
  });

  await act(async () => {
    await Promise.resolve();
  });

  return renderer;
}

describe('RevenueCatProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  });

  test('removes the listener and suppresses updates when unmounted before load resolves', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'test-ios-key';

    const customerInfo = deferred<unknown>();
    const offerings = deferred<unknown>();
    purchasesMock.getCustomerInfo.mockReturnValue(customerInfo.promise);
    purchasesMock.getOfferings.mockReturnValue(offerings.promise);

    const statuses: string[] = [];
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(createElement(
        RevenueCatProvider,
        null,
        createElement(StatusProbe, { onStatus: status => statuses.push(status) }),
      ));
    });

    const listener = purchasesMock.addCustomerInfoUpdateListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf('function');

    act(() => {
      renderer.unmount();
    });

    expect(purchasesMock.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);

    customerInfo.resolve({ entitlements: { active: {} } });
    offerings.resolve({
      all: { default: { availablePackages: [{ identifier: 'pro_monthly' }] } },
      current: null,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    listener({ entitlements: { active: { pro: { isActive: true } } } });

    await act(async () => {
      await Promise.resolve();
    });

    expect(statuses).toEqual(['loading']);
  });

  test('purchase cancellation leaves the paywall usable without an error', async () => {
    const snapshots: RevenueCatSnapshot[] = [];
    const renderer = await renderLoadedProvider(value => snapshots.push(value));
    const loaded = snapshots.at(-1);
    expect(loaded?.status).toBe('ready');
    expect(loaded?.defaultPackages).toEqual([monthlyPackage]);

    purchasesMock.purchasePackage.mockRejectedValue({ userCancelled: true });

    await act(async () => {
      await loaded?.purchasePackage(monthlyPackage);
    });

    const afterCancel = snapshots.at(-1);
    expect(afterCancel?.status).toBe('ready');
    expect(afterCancel?.defaultPackages).toEqual([monthlyPackage]);
    expect(afterCancel?.subscriptionsAvailable).toBe(true);
    expect(afterCancel?.error).toBeNull();

    act(() => {
      renderer.unmount();
    });
  });

  test('purchase failure keeps packages available and reports a friendly error', async () => {
    const snapshots: RevenueCatSnapshot[] = [];
    const renderer = await renderLoadedProvider(value => snapshots.push(value));
    const loaded = snapshots.at(-1);
    expect(loaded?.status).toBe('ready');

    purchasesMock.purchasePackage.mockRejectedValue(new Error('network down'));

    await act(async () => {
      await loaded?.purchasePackage(monthlyPackage);
    });

    const afterFailure = snapshots.at(-1);
    expect(afterFailure?.status).toBe('ready');
    expect(afterFailure?.defaultPackages).toEqual([monthlyPackage]);
    expect(afterFailure?.subscriptionsAvailable).toBe(true);
    expect(afterFailure?.error).toBe('Purchase could not be completed. Please try again.');

    act(() => {
      renderer.unmount();
    });
  });

  test('restore failure keeps packages available and reports a friendly error', async () => {
    const snapshots: RevenueCatSnapshot[] = [];
    const renderer = await renderLoadedProvider(value => snapshots.push(value));
    const loaded = snapshots.at(-1);
    expect(loaded?.status).toBe('ready');

    purchasesMock.restorePurchases.mockRejectedValue(new Error('restore unavailable'));

    await act(async () => {
      await loaded?.restorePurchases();
    });

    const afterFailure = snapshots.at(-1);
    expect(afterFailure?.status).toBe('ready');
    expect(afterFailure?.defaultPackages).toEqual([monthlyPackage]);
    expect(afterFailure?.subscriptionsAvailable).toBe(true);
    expect(afterFailure?.error).toBe('Purchases could not be restored. Please try again.');

    act(() => {
      renderer.unmount();
    });
  });
});
