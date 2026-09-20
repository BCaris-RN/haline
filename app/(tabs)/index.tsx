import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calculateCFCBias } from '../../lib/cfcBias';
import { formatNOAAFetchedAt, noaaDataStatusLabel } from '../../lib/dataStatus';
import { fetchNOAASSTData, getLatestRecord, type NOAADataResult, type NOAARecord } from '../../lib/noaa';

type DashboardState =
  | { status: 'loading' }
  | { status: 'ready'; data: NOAADataResult; latest: NOAARecord }
  | { status: 'unavailable'; data: NOAADataResult };

function formatMonth(record: NOAARecord): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(record.year, record.month - 1, 1)));
}

function formatNextObservationMonth(record: NOAARecord): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(record.year, record.month, 1)));
}

function sourceDetail(data: NOAADataResult): string {
  if (data.source === 'unavailable') {
    return data.error ? `NOAA data unavailable: ${data.error}` : 'NOAA data unavailable.';
  }
  if (data.isStale) {
    return data.error
      ? `Showing stale cached data because the refresh failed: ${data.error}`
      : 'Showing stale cached data; refresh when a network connection is available.';
  }
  if (data.source === 'cache') return 'Using a verified cache less than 24 hours old.';
  return data.cacheWarning ?? 'Fetched from NOAA and verified against the expected product metadata.';
}

export default function DashboardScreen() {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    fetchNOAASSTData()
      .then((data) => {
        if (!mounted) return;
        const latest = getLatestRecord(data.records);
        setState(latest ? { status: 'ready', data, latest } : { status: 'unavailable', data });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setState({
          status: 'unavailable',
          data: {
            records: [],
            source: 'unavailable',
            isStale: true,
            fetchedAt: null,
            metadata: {
              id: 'ncei-cag-global-ocean-monthly-1901-2000-v1',
              title: 'Global Ocean Average Temperature Departures',
              units: 'Degrees Celsius',
              baseline: '1901-2000',
            },
            error: error instanceof Error ? error.message : 'NOAA data unavailable.',
          },
        });
      });
    return () => { mounted = false; };
  }, []);

  const isReady = state.status === 'ready';
  const cfcShift = isReady
    ? calculateCFCBias(state.latest.value).average_reduction_percent
    : null;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Global ocean signal</Text>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.body}>
            Monthly NOAA anomaly translated into a modeled thermal solubility proxy.
          </Text>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.statusPanel}>
            <Text style={styles.statusLabel}>Loading NOAA data</Text>
            <Text style={styles.statusText}>Checking the latest verified global ocean monthly product.</Text>
          </View>
        ) : (
          <View style={[styles.statusPanel, state.data.isStale && styles.stalePanel]}>
            <Text style={[styles.statusLabel, state.data.isStale && styles.staleText]}>
              {noaaDataStatusLabel(state.data)}
            </Text>
            <Text style={styles.statusText}>{sourceDetail(state.data)}</Text>
          </View>
        )}

        {isReady && cfcShift !== null ? (
          <View style={styles.metrics}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>NOAA anomaly</Text>
              <Text style={styles.metricValue}>{state.latest.value.toFixed(2)}°C</Text>
              <Text style={styles.metricMeta}>{formatMonth(state.latest)}</Text>
            </View>

            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>CFC solubility decrease</Text>
              <Text style={styles.metricValue}>{cfcShift.toFixed(2)}%</Text>
              <Text style={styles.metricMeta}>
                Average of CFC-11 and CFC-12, vs. 15 °C baseline.
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>NOAA base period</Text>
              <Text style={styles.detailValue}>{state.data.metadata.baseline}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Source month</Text>
              <Text style={styles.detailValue}>{formatMonth(state.latest)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cache fetched</Text>
              <Text style={styles.detailValue}>{formatNOAAFetchedAt(state.data.fetchedAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expected next update</Text>
              <Text style={styles.detailValue}>{formatNextObservationMonth(state.latest)} observation</Text>
            </View>
          </View>
        ) : state.status === 'unavailable' ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Data unavailable</Text>
            <Text style={styles.body}>
              Haline could not load a current NOAA record and has no verified cached value to display.
            </Text>
          </View>
        ) : null}
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
    flexGrow: 1,
    maxWidth: 760,
    paddingHorizontal: 24,
    paddingBottom: 96,
    paddingTop: 24,
    backgroundColor: '#f8fafc',
    gap: 24,
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
    marginTop: 8,
  },
  metricLabel: {
    color: '#334155',
    fontSize: 16,
    marginTop: 32,
  },
  metricValue: {
    color: '#0369a1',
    fontSize: 44,
    fontWeight: '700',
    marginTop: 4,
  },
  body: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
  },
  statusPanel: {
    borderLeftColor: '#0284c7',
    borderLeftWidth: 4,
    paddingLeft: 16,
  },
  stalePanel: {
    borderLeftColor: '#b45309',
  },
  statusLabel: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  staleText: {
    color: '#92400e',
  },
  statusText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  metrics: {
    gap: 22,
  },
  metricBlock: {
    borderTopColor: '#cbd5e1',
    borderTopWidth: 1,
    paddingTop: 18,
  },
  metricMeta: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 6,
  },
  detailRow: {
    alignItems: 'flex-start',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  detailLabel: {
    color: '#64748b',
    flexShrink: 0,
    fontSize: 14,
  },
  detailValue: {
    color: '#0f172a',
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  emptyState: {
    borderTopColor: '#cbd5e1',
    borderTopWidth: 1,
    paddingTop: 20,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '700',
  },
});
