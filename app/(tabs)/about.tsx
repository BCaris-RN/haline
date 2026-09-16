import { StyleSheet, Text, View } from 'react-native';
import { KH } from '../../lib/warnerWeiss';

const baselineCfc11 = KH(288.15, 35, 'cfc11');

export default function AboutScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>About</Text>
      <Text style={styles.body}>Haline is an ocean climate companion built from the shared science core in this repository.</Text>
      <Text style={styles.body}>Baseline CFC-11 solubility placeholder: {baselineCfc11.toExponential(3)} mol kg^-1 atm^-1.</Text>
      <Text style={styles.body}>Research citation details live in CITATION.cff.</Text>
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
