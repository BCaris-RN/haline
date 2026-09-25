// .-~-.  HALINE  ·  lib/warnerWeiss.ts
// Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.

import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

function HostComponent(name: string) {
  return function Component({ children }: { children?: ReactNode }) {
    return createElement(name, null, children);
  };
}

vi.mock('react-native', () => ({
  ScrollView: HostComponent('ScrollView'),
  StyleSheet: { create: (styles: unknown) => styles },
  Text: HostComponent('Text'),
  View: HostComponent('View'),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: HostComponent('SafeAreaView'),
}));

vi.mock('../cfcBias', () => ({
  calculateCFCBias: () => ({ average_reduction_percent: 4.82 }),
}));

vi.mock('../noaa', () => ({
  fetchNOAASSTData: async () => ({
    records: [{ year: 2026, month: 8, value: 1.08, date: '2026-08-01' }],
    source: 'network',
    isStale: false,
    fetchedAt: Date.UTC(2026, 8, 1),
    metadata: {
      id: 'ncei-cag-global-ocean-monthly-1901-2000-v1',
      title: 'Global Ocean Average Temperature Departures',
      units: 'Degrees Celsius',
      baseline: '1901-2000',
    },
  }),
  getLatestRecord: (records: { year: number; month: number; value: number; date: string }[]) => records[0] ?? null,
}));

describe('DashboardScreen', () => {
  test('renders the required CFC solubility label', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { default: DashboardScreen } = await import('../../app/(tabs)/index');

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(DashboardScreen));
      await Promise.resolve();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('CFC solubility shift %');
  });
});
