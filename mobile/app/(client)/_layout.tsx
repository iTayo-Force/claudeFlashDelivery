import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../utils/theme';

function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    home: '🏠',
    deliveries: '📦',
    track: '🔍',
    profile: '👤',
  };
  return <Text style={{ fontSize: 22 }}>{icons[name] || '•'}</Text>;
}

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          paddingBottom: 4,
          height: 60,
        },
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="new-delivery"
        options={{
          title: 'Envoyer',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 26 }}>➕</Text>,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Mes Colis',
          tabBarIcon: ({ color }) => <TabIcon name="deliveries" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          title: 'Paiement',
          href: null, // Hidden from tab bar (navigated to programmatically)
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: 'Suivi en direct',
          href: null, // Hidden from tab bar
        }}
      />
    </Tabs>
  );
}
