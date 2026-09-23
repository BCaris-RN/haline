import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { RevenueCatProvider, useRevenueCat } from '../revenueCat';

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
});
