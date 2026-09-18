import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: true,
        headerStyle: { backgroundColor: '#f8fafc' },
        headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
        tabBarStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="chart" options={{ title: 'Chart' }} />
      <Tabs.Screen name="about" options={{ title: 'About' }} />
    </Tabs>
  );
}
