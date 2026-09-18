import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import type { ComponentProps } from 'react';

type TabIconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: TabIconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons color={color} name={name} size={size} />
  );
}

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
      <Tabs.Screen name="index" options={{ tabBarIcon: tabIcon('speedometer-outline'), title: 'Dashboard' }} />
      <Tabs.Screen name="chart" options={{ tabBarIcon: tabIcon('analytics-outline'), title: 'Chart' }} />
      <Tabs.Screen name="about" options={{ tabBarIcon: tabIcon('information-circle-outline'), title: 'About' }} />
    </Tabs>
  );
}
