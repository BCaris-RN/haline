// .-~-.  HALINE  ·  lib/warnerWeiss.ts
// Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.

import { describe, expect, test } from 'vitest';
import { entitlementsFromCustomerInfo, PRO_ENTITLEMENT_ID, type CustomerEntitlementSource } from '../entitlements';

function customerInfoWithPro(isActive: boolean): CustomerEntitlementSource {
  return {
    entitlements: {
      active: {
        [PRO_ENTITLEMENT_ID]: { isActive },
      },
    },
  };
}

describe('Haline Pro entitlement mapping', () => {
  test('grants every gated capability from the single pro entitlement', () => {
    expect(entitlementsFromCustomerInfo(customerInfoWithPro(true))).toEqual({
      hasPro: true,
      canViewHistory: true,
      canExport: true,
    });
  });

  test('denies every gated capability when pro is not active', () => {
    expect(entitlementsFromCustomerInfo(customerInfoWithPro(false))).toEqual({
      hasPro: false,
      canViewHistory: false,
      canExport: false,
    });
  });

  test('denies every gated capability when the SDK is unavailable', () => {
    expect(entitlementsFromCustomerInfo(null)).toEqual({
      hasPro: false,
      canViewHistory: false,
      canExport: false,
    });
  });
});
