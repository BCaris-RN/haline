// .-~-.  HALINE  ·  app/(tabs)/index.tsx
// Dashboard screen for NOAA ocean anomaly and CFC solubility proxy summaries.

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { calculateCFCBias } from '../../lib/cfcBias';
import { formatNOAAFetchedAt, noaaDataStatusLabel } from '../../lib/dataStatus';
import { fetchNOAASSTData, getLatestRecord, NOAA_SOURCE, type NOAADataResult, type NOAARecord } from '../../lib/noaa';

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

function unavailableData(error: unknown): NOAADataResult {
  return {
    records: [],
    source: 'unavailable',
    isStale: true,
    fetchedAt: null,
    metadata: NOAA_SOURCE,
    error: error instanceof Error ? error.message : 'NOAA data unavailable.',
  };
}

export default function DashboardScreen() {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  const applyData = useCallback((data: NOAADataResult) => {
    const latest = getLatestRecord(data.records);
    setState(latest ? { status: 'ready', data, latest } : { status: 'unavailable', data });
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchNOAASSTData()
      .then((data) => {
        if (!mounted) return;
        applyData(data);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setState({ status: 'unavailable', data: unavailableData(error) });
      });
    return () => { mounted = false; };
  }, [applyData]);

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const data = await fetchNOAASSTData({ forceRefresh: true });
      if (data.error) {
        setRefreshError("Couldn't refresh. Showing the last verified value.");
        return;
      }
      applyData(data);
    } catch {
      setRefreshError("Couldn't refresh. Showing the last verified value.");
    } finally {
      setIsRefreshing(false);
    }
  }, [applyData]);

  const shareDashboardCard = useCallback(async () => {
    if (!shareCardRef.current) return;
    setShareError(null);
    setIsSharing(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setShareError('Sharing is not available on this device.');
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 0.95,
      });
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Share Haline card',
        mimeType: 'image/png',
      });
    } catch {
      setShareError("Couldn't open the share sheet.");
    } finally {
      setIsSharing(false);
    }
  }, []);

  const isReady = state.status === 'ready';
  const cfcShift = isReady
    ? calculateCFCBias(state.latest.value).average_reduction_percent
    : null;
  const formattedCfcShift = cfcShift === null ? null : cfcShift.toFixed(2);
  const formattedAnomaly = isReady ? state.latest.value.toFixed(2) : null;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityLabel="Refresh NOAA dashboard data"
              accessibilityRole="button"
              disabled={isRefreshing}
              hitSlop={10}
              onPress={() => { void refreshDashboard(); }}
              style={styles.headerButton}
            >
              {isRefreshing ? (
                <ActivityIndicator color="#0369a1" size="small" />
              ) : (
                <Ionicons color="#0369a1" name="refresh" size={22} />
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.screen}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { void refreshDashboard(); }}
            tintColor="#0369a1"
          />
        )}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Global ocean signal</Text>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.body}>
            Monthly NOAA anomaly translated into a modeled thermal solubility proxy.
          </Text>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.statusPanel}>
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#0369a1" size="small" />
              <Text style={styles.statusLabel}>Loading NOAA data</Text>
            </View>
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

        {refreshError ? (
          <Text accessibilityLiveRegion="polite" style={styles.refreshError}>{refreshError}</Text>
        ) : null}

        {isReady && formattedAnomaly !== null && formattedCfcShift !== null ? (
          <View style={styles.metrics}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>NOAA anomaly</Text>
              <Text
                accessibilityLabel={`NOAA anomaly ${formattedAnomaly} degrees Celsius`}
                style={styles.metricValue}
              >
                {formattedAnomaly}°C
              </Text>
              <Text style={styles.metricMeta}>{formatMonth(state.latest)}</Text>
            </View>

            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>CFC solubility shift %</Text>
              <Text
                accessibilityLabel={`CFC solubility shift ${formattedCfcShift} percent`}
                style={styles.metricValue}
              >
                {formattedCfcShift}%
              </Text>
              <Text style={styles.metricMeta}>
                Average of CFC-11 and CFC-12, vs. 15 °C baseline.
              </Text>
            </View>

            <View style={styles.meaningBlock}>
              <Text style={styles.meaningTitle}>What this means</Text>
              <Text style={styles.meaningText}>
                Warmer seawater holds less dissolved gas. At today's anomaly, the ocean can hold about {formattedCfcShift}% less CFC-11 and CFC-12 than at the 1901-2000 baseline.
              </Text>
              <Text style={styles.metricMeta}>
                This is a modeled thermal-solubility proxy, not a direct measurement of ocean uptake or flux.
              </Text>
            </View>

            <View
              ref={shareCardRef}
              collapsable={false}
              style={styles.shareCard}
            >
              <View style={styles.shareCardHeader}>
                <View style={styles.shareLogo}>
                  <Text style={styles.shareLogoWave}>~</Text>
                </View>
                <Text style={styles.shareBrand}>haline app</Text>
              </View>
              <Text style={styles.shareMonth}>{formatMonth(state.latest)}</Text>
              <Text style={styles.sharePrimary}>{formattedAnomaly}°C NOAA anomaly</Text>
              <Text style={styles.shareSecondary}>{formattedCfcShift}% CFC solubility shift</Text>
            </View>

            <Pressable
              accessibilityLabel="Share Haline dashboard card"
              accessibilityRole="button"
              disabled={isSharing}
              onPress={() => { void shareDashboardCard(); }}
              style={({ pressed }) => [
                styles.shareButton,
                pressed && styles.shareButtonPressed,
                isSharing && styles.shareButtonDisabled,
              ]}
            >
              <Ionicons color="#ffffff" name="share-outline" size={18} />
              <Text style={styles.shareButtonText}>{isSharing ? 'Preparing share card' : 'Share card'}</Text>
            </Pressable>
            {shareError ? (
              <Text accessibilityLiveRegion="polite" style={styles.refreshError}>{shareError}</Text>
            ) : null}

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
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    marginRight: 8,
    width: 44,
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
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
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
  refreshError: {
    color: '#92400e',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
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
  meaningBlock: {
    borderTopColor: '#cbd5e1',
    borderTopWidth: 1,
    paddingTop: 18,
  },
  meaningTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
  },
  meaningText: {
    color: '#334155',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  shareCard: {
    backgroundColor: '#062033',
    borderRadius: 8,
    gap: 8,
    padding: 20,
  },
  shareCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  shareLogo: {
    alignItems: 'center',
    backgroundColor: '#d8f6ff',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  shareLogoWave: {
    color: '#063a63',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
  },
  shareBrand: {
    color: '#d8f6ff',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  shareMonth: {
    color: '#bae6fd',
    fontSize: 16,
    fontWeight: '600',
  },
  sharePrimary: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
  },
  shareSecondary: {
    color: '#e0f2fe',
    fontSize: 20,
    fontWeight: '700',
  },
  shareButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0369a1',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  shareButtonPressed: {
    backgroundColor: '#075985',
  },
  shareButtonDisabled: {
    opacity: 0.65,
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
