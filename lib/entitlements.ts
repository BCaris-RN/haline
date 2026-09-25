export const PRO_ENTITLEMENT_ID = 'pro';

export interface EntitlementState {
  hasPro: boolean;
  canViewHistory: boolean;
  canExport: boolean;
}

export interface CustomerEntitlementSource {
  entitlements: {
    active: Record<string, { isActive?: boolean } | undefined>;
  };
}

export function entitlementsFromCustomerInfo(customerInfo: CustomerEntitlementSource | null): EntitlementState {
  const hasPro = customerInfo?.entitlements.active[PRO_ENTITLEMENT_ID]?.isActive === true;

  return {
    hasPro,
    canViewHistory: hasPro,
    canExport: hasPro,
  };
}
