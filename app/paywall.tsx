import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaywallScreen() {
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: true, title: 'Haline Pro' }} />
      <View style={styles.screen}>
        <Text style={styles.title}>Haline Pro</Text>
        <Text style={styles.body}>Subscriptions are being prepared.</Text>
      </View>
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
    padding: 24,
    width: '100%',
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
