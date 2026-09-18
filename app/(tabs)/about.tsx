import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NOAA_SOURCE } from '../../lib/noaa';

const REPO_URL = 'https://github.com/BCaris-RN/haline';
const ROADMAP_URL = 'https://github.com/BCaris-RN/haline/blob/main/docs/ROADMAP.md';
const PREPRINT_DOI_URL = 'https://doi.org/10.5281/zenodo.20804280';

function openUrl(url: string): void {
  void Linking.openURL(url);
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <Pressable onPress={() => openUrl(url)} style={styles.linkRow}>
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkUrl}>{url.replace('https://', '')}</Text>
    </Pressable>
  );
}

export default function AboutScreen() {
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Method and sources</Text>
          <Text style={styles.title}>About Haline</Text>
          <Text style={styles.body}>
            Haline turns NOAA global ocean temperature anomalies into a modeled thermal solubility proxy for CFC-11 and CFC-12.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data source</Text>
          <Text style={styles.body}>
            The app uses {NOAA_SOURCE.title}, reported in {NOAA_SOURCE.units} against NOAA's {NOAA_SOURCE.baseline} base period.
            NOAA publishes this as a monthly product, so the newest observation can lag the current calendar month.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Method summary</Text>
          <Text style={styles.body}>
            The dashboard applies Warner & Weiss solubility coefficients at a fixed 15°C, salinity-35 baseline, then reports the
            relative change as a modeled thermal solubility proxy. It is not a direct measurement of ocean gas uptake, a flux
            estimate, or an emissions inversion.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Citations</Text>
          <Text style={styles.citation}>
            Warner, M. J., & Weiss, R. F. (1985). Solubilities of chlorofluorocarbons 11 and 12 in water and seawater.
            Deep Sea Research Part A, 32(12), 1485-1497.
          </Text>
          <Text style={styles.citation}>
            Caris, B. W. The Coupled Marine Engine Framework, Papers 1-3. Zenodo preprint collection.
            DOI: 10.5281/zenodo.20804280.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project links</Text>
          <LinkRow label="GitHub repository" url={REPO_URL} />
          <LinkRow label="Public roadmap" url={ROADMAP_URL} />
          <LinkRow label="Preprint DOI" url={PREPRINT_DOI_URL} />
        </View>
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
    gap: 24,
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
  section: {
    borderTopColor: '#cbd5e1',
    borderTopWidth: 1,
    paddingTop: 18,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
  },
  citation: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  linkRow: {
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  linkLabel: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  linkUrl: {
    color: '#0369a1',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
});
