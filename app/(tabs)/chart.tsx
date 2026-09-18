import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchNOAASSTData, getAnomaliesBetween, NOAA_SOURCE, type NOAADataResult, type NOAARecord } from '../../lib/noaa';

type ChartState =
  | { status: 'loading' }
  | { status: 'ready'; data: NOAADataResult; records: NOAARecord[] }
  | { status: 'empty'; data: NOAADataResult };

function stripeColor(value: number): string {
  if (value < -0.5) return '#1d4ed8';
  if (value < -0.25) return '#3b82f6';
  if (value < 0) return '#93c5fd';
  if (value < 0.5) return '#fca5a5';
  if (value < 1) return '#ef4444';
  return '#991b1b';
}

function formatMonth(record: NOAARecord): string {
  return `${record.year}-${String(record.month).padStart(2, '0')}`;
}

function sourceLabel(data: NOAADataResult): string {
  if (data.source === 'unavailable') return 'Unavailable';
  if (data.isStale) return 'Stale cached NOAA data';
  if (data.source === 'cache') return 'Cached NOAA data';
  return 'Live NOAA data';
}

export default function ChartScreen() {
  const [state, setState] = useState<ChartState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    fetchNOAASSTData()
      .then((data) => {
        if (!mounted) return;
        const records = getAnomaliesBetween(data.records, 2016, 2025);
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
    return {
      warmest: state.records.reduce((best, record) => record.value > best.value ? record : best),
      coolest: state.records.reduce((best, record) => record.value < best.value ? record : best),
      average: values.reduce((total, value) => total + value, 0) / values.length,
    };
  }, [state]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>2016-2025</Text>
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
            The 2016-2025 monthly range is unavailable right now. {state.data.error ?? ''}
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.stripeWrap}>
              {state.records.map(record => (
                <View
                  key={record.date}
                  style={[
                    styles.stripe,
                    {
                      backgroundColor: stripeColor(record.value),
                      height: 82 + Math.min(38, Math.max(0, record.value) * 20),
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
            <Text style={styles.legendText}>Cooler</Text>
            <View style={[styles.legendSwatch, { backgroundColor: '#1d4ed8' }]} />
            <View style={[styles.legendSwatch, { backgroundColor: '#93c5fd' }]} />
            <View style={[styles.legendSwatch, { backgroundColor: '#fca5a5' }]} />
            <View style={[styles.legendSwatch, { backgroundColor: '#991b1b' }]} />
            <Text style={styles.legendText}>Warmer</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 760,
    padding: 24,
    backgroundColor: '#f8fafc',
    gap: 24,
    width: '100%',
  },
  header: {
    marginTop: 36,
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
    height: 132,
    minWidth: 720,
  },
  stripe: {
    marginRight: 1,
    width: 5,
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
    gap: 8,
  },
  legendSwatch: {
    height: 14,
    width: 28,
  },
  legendText: {
    color: '#475569',
    fontSize: 13,
  },
});
