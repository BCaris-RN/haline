import { StyleSheet, Text, View } from 'react-native';
import { NOAA_SOURCE } from '../../lib/noaaData';

export default function ChartScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Chart</Text>
      <Text style={styles.body}>Placeholder for monthly ocean temperature history from {NOAA_SOURCE.title}.</Text>
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
});
