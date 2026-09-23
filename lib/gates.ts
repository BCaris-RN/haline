import type { EntitlementState } from './entitlements';

export type GatedCapability = 'history' | 'export' | 'alerts';

export type GateDecision =
  | { status: 'available' }
  | { status: 'locked' }
  | { status: 'unavailable'; message: string };

const ENFORCE_GATES = process.env.EXPO_PUBLIC_ENFORCE_GATES === 'true';

export function getGateDecision(
  capability: GatedCapability,
  entitlements: EntitlementState,
  subscriptionsAvailable: boolean,
): GateDecision {
  if (!ENFORCE_GATES) {
    return { status: 'available' };
  }

  if (!subscriptionsAvailable) {
    return { status: 'available' };
  }

  const allowed = {
    history: entitlements.canViewHistory,
    export: entitlements.canExport,
    alerts: entitlements.canUseAlerts,
  }[capability];

  return allowed ? { status: 'available' } : { status: 'locked' };
}
