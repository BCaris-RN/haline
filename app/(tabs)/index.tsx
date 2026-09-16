import { StyleSheet, Text, View } from 'react-native';
import { calculateCFCBias } from '../../lib/cfcBias';

const SAMPLE_ANOMALY_C = 1.08;
const sampleShift = calculateCFCBias(SAMPLE_ANOMALY_C).average_reduction_percent;

export default function DashboardScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Latest placeholder</Text>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.metricLabel}>CFC solubility shift %</Text>
      <Text style={styles.metricValue}>{sampleShift.toFixed(2)}%</Text>
      <Text style={styles.body}>NOAA live data wiring comes next. This screen imports the science model from lib directly.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
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
    marginTop: 24,
  },
});
