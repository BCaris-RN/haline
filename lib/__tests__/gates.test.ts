// .-~-.  HALINE  ·  lib/warnerWeiss.ts
// Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.

import { afterEach, describe, expect, test, vi } from 'vitest';
import type { EntitlementState } from '../entitlements';
import type { GatedCapability } from '../gates';

const CAPABILITIES: GatedCapability[] = ['history', 'export'];

const entitled: EntitlementState = {
  hasPro: true,
  canViewHistory: true,
  canExport: true,
};

const notEntitled: EntitlementState = {
  hasPro: false,
  canViewHistory: false,
  canExport: false,
};

describe('gated capability decisions', () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.EXPO_PUBLIC_ENFORCE_GATES;
  });

  async function loadGateDecision(enforceGates: string | undefined) {
    vi.resetModules();
    if (enforceGates === undefined) {
      delete process.env.EXPO_PUBLIC_ENFORCE_GATES;
    } else {
      process.env.EXPO_PUBLIC_ENFORCE_GATES = enforceGates;
    }
    return import('../gates');
  }

  test.each(CAPABILITIES)('%s is available with the release flag off and no pro entitlement', async (capability) => {
    const { getGateDecision } = await loadGateDecision(undefined);
    expect(getGateDecision(capability, notEntitled, true)).toEqual({ status: 'available' });
  });

  test.each(CAPABILITIES)('%s is available with the release flag off and RevenueCat unavailable', async (capability) => {
    const { getGateDecision } = await loadGateDecision('false');
    expect(getGateDecision(capability, notEntitled, false)).toEqual({ status: 'available' });
  });

  test.each(CAPABILITIES)('%s is available with the release flag on and RevenueCat unavailable', async (capability) => {
    const { getGateDecision } = await loadGateDecision('true');
    expect(getGateDecision(capability, notEntitled, false)).toEqual({ status: 'available' });
  });

  test.each(CAPABILITIES)('%s is locked with the release flag on, configured RevenueCat, and no pro entitlement', async (capability) => {
    const { getGateDecision } = await loadGateDecision('true');
    expect(getGateDecision(capability, notEntitled, true)).toEqual({ status: 'locked' });
  });

  test.each(CAPABILITIES)('%s is available for an entitled customer when gates are enforced', async (capability) => {
    const { getGateDecision } = await loadGateDecision('true');
    expect(getGateDecision(capability, entitled, true)).toEqual({ status: 'available' });
  });
});
