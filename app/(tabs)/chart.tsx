import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchNOAASSTData, NOAA_SOURCE, type NOAADataResult, type NOAARecord } from '../../lib/noaa';

type ChartState =
  | { status: 'loading' }
  | { status: 'ready'; data: NOAADataResult; records: NOAARecord[] }
  | { status: 'empty'; data: NOAADataResult };

const SERIES_LENGTH = 120;
const CHART_HEIGHT = 220;

function latestRecords(records: readonly NOAARecord[], count: number): NOAARecord[] {
  return [...records]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .slice(-count);
}

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

function colorValue(value: number, maxAbs: number): string {
  if (maxAbs === 0) return interpolateColor(0.5);
  return interpolateColor((value / maxAbs + 1) / 2);
}

function formatMonth(record: NOAARecord): string {
  return `${record.year}-${String(record.month).padStart(2, '0')}`;
}

function formatRange(records: readonly NOAARecord[]): string {
  const first = records[0];
  const last = records[records.length - 1];
  if (!first || !last) return 'Monthly range';
  return `${formatMonth(first)} to ${formatMonth(last)}`;
}

function sourceLabel(data: NOAADataResult): string {
  if (data.source === 'unavailable') return 'Unavailable';
  if (data.isStale) return 'Stale cached NOAA data';
  if (data.source === 'cache') return 'Cached NOAA data';
  return 'Verified NOAA data';
}

export default function ChartScreen() {
  const [state, setState] = useState<ChartState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    fetchNOAASSTData()
      .then((data) => {
        if (!mounted) return;
        const records = latestRecords(data.records, SERIES_LENGTH);
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
    const maxAbs = Math.max(Math.abs(min), Math.abs(max), 0.01);
    return {
      warmest: state.records.reduce((best, record) => record.value > best.value ? record : best),
      coolest: state.records.reduce((best, record) => record.value < best.value ? record : best),
      average: values.reduce((total, value) => total + value, 0) / values.length,
      min: min - padding,
      max: max + padding,
      maxAbs,
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
        ) : (
          <>
            <View style={[styles.sourceBlock, state.data.isStale && styles.staleBlock]}>
              <Text style={[styles.sourceLabel, state.data.isStale && styles.staleText]}>
                {sourceLabel(state.data)}
              </Text>
              <Text style={styles.sourceText}>
                {state.records.length} monthly observations, NOAA base period {state.data.metadata.baseline}.
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
              <View style={styles.stripeWrap}>
                {state.records.map(record => (
                  <View
                    key={record.date}
                    style={[
                      styles.stripe,
                      {
                        backgroundColor: summary
                          ? colorValue(record.value, summary.maxAbs)
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
            </ScrollView>

            {summary ? (
              <View style={styles.summary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Average anomaly</Text>
                  <Text style={styles.summaryValue}>{summary.average.toFixed(2)}°C</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Warmest month</Text>
                  <Text style={styles.summaryValue}>{formatMonth(summary.warmest)}</Text>
                  <Text style={styles.summaryMeta}>{summary.warmest.value.toFixed(2)}°C</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Coolest month</Text>
                  <Text style={styles.summaryValue}>{formatMonth(summary.coolest)}</Text>
                  <Text style={styles.summaryMeta}>{summary.coolest.value.toFixed(2)}°C</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.legend}>
              <Text style={styles.legendText}>Below 0°C</Text>
              <View style={[styles.legendSwatch, { backgroundColor: '#1d4ed8' }]} />
              <View style={[styles.legendSwatch, { backgroundColor: '#f8fafc' }]} />
              <View style={[styles.legendSwatch, { backgroundColor: '#b91c1c' }]} />
              <Text style={styles.legendText}>Above 0°C</Text>
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
    minWidth: 840,
  },
  chartScroll: {
    flexGrow: 0,
    maxHeight: CHART_HEIGHT + 8,
  },
  stripe: {
    marginRight: 1,
    width: 6,
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
