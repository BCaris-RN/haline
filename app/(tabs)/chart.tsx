import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chartObservationLabel, latestRecords } from '../../lib/chartData';
import { noaaDataStatusLabel } from '../../lib/dataStatus';
import { getGateDecision } from '../../lib/gates';
import { fetchNOAASSTData, NOAA_SOURCE, type NOAADataResult, type NOAARecord } from '../../lib/noaa';
import { useRevenueCat } from '../../lib/revenueCat';

type ChartState =
  | { status: 'loading' }
  | { status: 'ready'; data: NOAADataResult; records: NOAARecord[] }
  | { status: 'empty'; data: NOAADataResult };

const CHART_HEIGHT = 220;

function interpolateColor(t: number): string {
  const cool = { t: 0, color: [37, 99, 235] as [number, number, number] };
  const middle = { t: 0.5, color: [248, 250, 252] as [number, number, number] };
  const warm = { t: 1, color: [185, 28, 28] as [number, number, number] };
  const clamped = Math.max(0, Math.min(1, t));
  const from = clamped <= 0.5 ? cool : middle;
  const to = clamped <= 0.5 ? middle : warm;
  const localT = (clamped - from.t) / (to.t - from.t);
  const channel = (index: 0 | 1 | 2) => Math.round(from.color[index] + (to.color[index] - from.color[index]) * localT);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function scaleValue(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function colorValue(value: number, min: number, max: number): string {
  return interpolateColor(scaleValue(value, min, max));
}

function formatMonth(record: NOAARecord): string {
  return `${record.year}-${String(record.month).padStart(2, '0')}`;
}

function formatRange(records: readonly NOAARecord[]): string {
  const first = records[0];
  const last = records[records.length - 1];
  if (!first || !last) return 'Monthly range';
  return `Chart window: ${formatMonth(first)} to ${formatMonth(last)}`;
}

export default function ChartScreen() {
  const router = useRouter();
  const { entitlements, subscriptionsAvailable } = useRevenueCat();
  const [state, setState] = useState<ChartState>({ status: 'loading' });
  const historyGate = getGateDecision('history', entitlements, subscriptionsAvailable);

  useEffect(() => {
    let mounted = true;
    fetchNOAASSTData()
      .then((data) => {
        if (!mounted) return;
        const records = latestRecords(data.records);
        setState(records.length > 0 ? { status: 'ready', data, records } : { status: 'empty', data });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setState({
          status: 'empty',
          data: {
            records: [],
            source: 'unavailable',
            isStale: true,
            fetchedAt: null,
            metadata: NOAA_SOURCE,
            error: error instanceof Error ? error.message : 'NOAA data unavailable.',
          },
        });
      });
    return () => { mounted = false; };
  }, []);

  const summary = useMemo(() => {
    if (state.status !== 'ready') return null;
    const values = state.records.map(record => record.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(0.05, (max - min) * 0.12);
    return {
      warmest: state.records.reduce((best, record) => record.value > best.value ? record : best),
      coolest: state.records.reduce((best, record) => record.value < best.value ? record : best),
      average: values.reduce((total, value) => total + value, 0) / values.length,
      min: min - padding,
      max: max + padding,
      colorMin: min,
      colorMax: max,
    };
  }, [state]);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.kicker}>
            {state.status === 'ready' ? formatRange(state.records) : 'Monthly range'}
          </Text>
          <Text style={styles.title}>Monthly history</Text>
          <Text style={styles.body}>
            Warming-stripe bands from {NOAA_SOURCE.title}; each band is one monthly anomaly.
          </Text>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateTitle}>Loading chart</Text>
            <Text style={styles.stateText}>Fetching the verified NOAA monthly series.</Text>
          </View>
        ) : state.status === 'empty' ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateTitle}>No chart data</Text>
            <Text style={styles.stateText}>
              The monthly range is unavailable right now. {state.data.error ?? ''}
            </Text>
          </View>
        ) : historyGate.status === 'unavailable' ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateTitle}>Subscriptions unavailable</Text>
            <Text style={styles.stateText}>{historyGate.message}</Text>
          </View>
        ) : historyGate.status === 'locked' ? (
          <View style={styles.lockPanel}>
            <Text style={styles.stateTitle}>Historical chart is part of Haline Pro</Text>
            <Text style={styles.stateText}>
              Free access keeps the dashboard and method notes available. Pro unlocks historical charting, export, and alerts.
            </Text>
            <View style={styles.lockRows}>
              <Text style={styles.lockRow}>Locked: historical monthly chart</Text>
              <Text style={styles.lockRow}>Locked: export</Text>
              <Text style={styles.lockRow}>Locked: alerts</Text>
            </View>
            <Pressable onPress={() => router.push('/paywall')} style={styles.unlockButton}>
              <Text style={styles.unlockButtonText}>Unlock Haline Pro</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.sourceBlock, state.data.isStale && styles.staleBlock]}>
              <Text style={[styles.sourceLabel, state.data.isStale && styles.staleText]}>
                {noaaDataStatusLabel(state.data)}
              </Text>
              <Text style={styles.sourceText}>
                {chartObservationLabel(state.records)}, NOAA base period {state.data.metadata.baseline}.
              </Text>
            </View>

            <View style={styles.stripeWrap}>
              {state.records.map(record => (
                <View
                  key={record.date}
                  style={[
                    styles.stripe,
                    {
                      backgroundColor: summary
                        ? colorValue(record.value, summary.colorMin, summary.colorMax)
                        : '#ef4444',
                      height: summary
                        ? 16 + scaleValue(record.value, summary.min, summary.max) * (CHART_HEIGHT - 16)
                        : CHART_HEIGHT / 2,
                    },
                  ]}
                  accessibilityLabel={`${formatMonth(record)} anomaly ${record.value.toFixed(2)} degrees Celsius`}
                />
              ))}
            </View>

            {summary ? (
              <View style={styles.summary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Average anomaly</Text>
                  <Text style={styles.summaryValue}>{summary.average.toFixed(2)}°C</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Warmest in chart window</Text>
                  <Text style={styles.summaryValue}>{formatMonth(summary.warmest)}</Text>
                  <Text style={styles.summaryMeta}>{summary.warmest.value.toFixed(2)}°C</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Coolest in chart window</Text>
                  <Text style={styles.summaryValue}>{formatMonth(summary.coolest)}</Text>
                  <Text style={styles.summaryMeta}>{summary.coolest.value.toFixed(2)}°C</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.legend}>
              <Text style={styles.legendText}>
                {summary ? `${summary.coolest.value.toFixed(2)}°C` : 'Coolest'}
              </Text>
              <View style={[styles.legendSwatch, { backgroundColor: '#1d4ed8' }]} />
              <View style={[styles.legendSwatch, { backgroundColor: '#f8fafc' }]} />
              <View style={[styles.legendSwatch, { backgroundColor: '#b91c1c' }]} />
              <Text style={styles.legendText}>
                {summary ? `${summary.warmest.value.toFixed(2)}°C` : 'Warmest'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  screen: {
    alignSelf: 'center',
    backgroundColor: '#f8fafc',
    flexGrow: 1,
    gap: 20,
    maxWidth: 760,
    paddingBottom: 96,
    paddingHorizontal: 24,
    paddingTop: 24,
    width: '100%',
  },
  header: {
    marginTop: 12,
  },
  kicker: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    color: '#0f172a',
    fontSize: 34,
    fontWeight: '700',
  },
  body: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
  },
  stateBlock: {
    borderTopColor: '#cbd5e1',
    borderTopWidth: 1,
    paddingTop: 20,
  },
  stateTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '700',
  },
  stateText: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  lockPanel: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  lockRows: {
    gap: 8,
    marginTop: 16,
  },
  lockRow: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
  unlockButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0369a1',
    borderRadius: 6,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unlockButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  sourceBlock: {
    borderLeftColor: '#0284c7',
    borderLeftWidth: 4,
    paddingLeft: 16,
  },
  staleBlock: {
    borderLeftColor: '#b45309',
  },
  sourceLabel: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  staleText: {
    color: '#92400e',
  },
  sourceText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  stripeWrap: {
    alignItems: 'flex-end',
    borderBottomColor: '#334155',
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: CHART_HEIGHT,
    width: '100%',
  },
  stripe: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 1,
  },
  summary: {
    borderTopColor: '#cbd5e1',
    borderTopWidth: 1,
    gap: 16,
    paddingTop: 20,
  },
  summaryItem: {
    gap: 3,
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '700',
  },
  summaryMeta: {
    color: '#475569',
    fontSize: 14,
  },
  legend: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendSwatch: {
    borderColor: '#cbd5e1',
    borderWidth: 1,
    height: 14,
    width: 28,
  },
  legendText: {
    color: '#475569',
    fontSize: 13,
  },
});
