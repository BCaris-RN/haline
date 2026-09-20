import type { EntitlementState } from './entitlements';

export type GatedCapability = 'history' | 'export' | 'alerts';

export type GateDecision =
  | { status: 'allowed' }
  | { status: 'locked' }
  | { status: 'unavailable'; message: string };

const UNAVAILABLE_MESSAGE = 'Subscriptions unavailable, try again later.';

export function getGateDecision(
  capability: GatedCapability,
  entitlements: EntitlementState,
  subscriptionsAvailable: boolean,
): GateDecision {
  if (!subscriptionsAvailable) {
    return { status: 'unavailable', message: UNAVAILABLE_MESSAGE };
  }

  const allowed = {
    history: entitlements.canViewHistory,
    export: entitlements.canExport,
    alerts: entitlements.canUseAlerts,
  }[capability];

  return allowed ? { status: 'allowed' } : { status: 'locked' };
}
