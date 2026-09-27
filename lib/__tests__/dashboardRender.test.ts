// .-~-.  HALINE  ·  lib/__tests__/dashboardRender.test.ts
// Render regression test for dashboard source and label output.

import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

function HostComponent(name: string) {
  return function Component({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) {
    return createElement(name, props, children);
  };
}

vi.mock('react-native', () => ({
  ActivityIndicator: HostComponent('ActivityIndicator'),
  Pressable: HostComponent('Pressable'),
  RefreshControl: HostComponent('RefreshControl'),
  ScrollView: HostComponent('ScrollView'),
  StyleSheet: { create: (styles: unknown) => styles },
  Text: HostComponent('Text'),
  View: HostComponent('View'),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: HostComponent('SafeAreaView'),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: HostComponent('Ionicons'),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => undefined),
}));

vi.mock('react-native-view-shot', () => ({
  captureRef: vi.fn(async () => 'file:///tmp/haline-share.png'),
}));

vi.mock('../cfcBias', () => ({
  calculateCFCBias: () => ({ average_reduction_percent: 4.82 }),
}));

const noaaMock = vi.hoisted(() => ({
  fetchNOAASSTData: vi.fn(),
}));

function noaaResult(value: number, fetchedAt: number) {
  return {
    records: [{ year: 2026, month: 8, value, date: '2026-08-01' }],
    source: 'network' as const,
    isStale: false,
    fetchedAt,
    metadata: {
      id: 'ncei-cag-global-ocean-monthly-1901-2000-v1',
      title: 'Global Ocean Average Temperature Departures',
      units: 'Degrees Celsius',
      baseline: '1901-2000',
    },
  };
}

function renderedText(renderer: ReactTestRenderer): string {
  return (renderer.root as unknown as { findAllByType(type: string): Array<{ props: { children?: ReactNode } }> })
    .findAllByType('Text')
    .flatMap(node => node.props.children)
    .join(' ');
}

function refresh(renderer: ReactTestRenderer): Promise<void> {
  return (renderer.root as unknown as { findByType(type: string): { props: { refreshControl: { props: { onRefresh: () => Promise<void> } } } } })
    .findByType('ScrollView')
    .props.refreshControl.props.onRefresh();
}

vi.mock('../noaa', () => ({
  fetchNOAASSTData: noaaMock.fetchNOAASSTData,
  getLatestRecord: (records: { year: number; month: number; value: number; date: string }[]) => records[0] ?? null,
  NOAA_SOURCE: {
    id: 'ncei-cag-global-ocean-monthly-1901-2000-v1',
    title: 'Global Ocean Average Temperature Departures',
    units: 'Degrees Celsius',
    baseline: '1901-2000',
  },
}));

vi.mock('expo-router', () => ({
  Tabs: {
    Screen: HostComponent('Tabs.Screen'),
  },
}));

describe('DashboardScreen', () => {
  beforeEach(() => {
    noaaMock.fetchNOAASSTData.mockReset();
    noaaMock.fetchNOAASSTData.mockResolvedValue(noaaResult(1.08, Date.UTC(2026, 8, 1, 12)));
  });

  test('renders the required CFC solubility label', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { default: DashboardScreen } = await import('../../app/(tabs)/index');

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(DashboardScreen));
      await Promise.resolve();
    });

    expect(renderedText(renderer)).toContain('CFC solubility shift %');
  });

  test('pull-to-refresh updates dashboard data after a successful fetch', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    noaaMock.fetchNOAASSTData
      .mockResolvedValueOnce(noaaResult(1.08, Date.UTC(2026, 8, 1, 12)))
      .mockResolvedValueOnce(noaaResult(1.22, Date.UTC(2026, 8, 2, 12)));
    const { default: DashboardScreen } = await import('../../app/(tabs)/index');

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(DashboardScreen));
      await Promise.resolve();
    });

    await act(async () => {
      await refresh(renderer);
    });

    const output = renderedText(renderer);
    expect(noaaMock.fetchNOAASSTData).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(output).toContain('1.22');
    expect(output).toContain('Sep 2, 2026');
  });

  test('pull-to-refresh failure keeps existing data and shows a brief error', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    noaaMock.fetchNOAASSTData
      .mockResolvedValueOnce(noaaResult(1.08, Date.UTC(2026, 8, 1, 12)))
      .mockRejectedValueOnce(new Error('offline'));
    const { default: DashboardScreen } = await import('../../app/(tabs)/index');

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(DashboardScreen));
      await Promise.resolve();
    });

    await act(async () => {
      await refresh(renderer);
    });

    const output = renderedText(renderer);
    expect(noaaMock.fetchNOAASSTData).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(output).toContain('1.08');
    expect(output).toContain("Couldn't refresh. Showing the last verified value.");
  });
});
