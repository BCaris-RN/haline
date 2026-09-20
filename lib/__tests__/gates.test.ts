import { describe, expect, test } from 'vitest';
import type { EntitlementState } from '../entitlements';
import { getGateDecision, type GatedCapability } from '../gates';

const CAPABILITIES: GatedCapability[] = ['history', 'export', 'alerts'];

const entitled: EntitlementState = {
  hasPro: true,
  canViewHistory: true,
  canExport: true,
  canUseAlerts: true,
};

const notEntitled: EntitlementState = {
  hasPro: false,
  canViewHistory: false,
  canExport: false,
  canUseAlerts: false,
};

describe('gated capability decisions', () => {
  test.each(CAPABILITIES)('%s is allowed for an entitled customer', (capability) => {
    expect(getGateDecision(capability, entitled, true)).toEqual({ status: 'allowed' });
  });

  test.each(CAPABILITIES)('%s is locked for a configured SDK without entitlement', (capability) => {
    expect(getGateDecision(capability, notEntitled, true)).toEqual({ status: 'locked' });
  });

  test.each(CAPABILITIES)('%s is unavailable when RevenueCat is unavailable', (capability) => {
    expect(getGateDecision(capability, entitled, false)).toEqual({
      status: 'unavailable',
      message: 'Subscriptions unavailable, try again later.',
    });
  });
});
