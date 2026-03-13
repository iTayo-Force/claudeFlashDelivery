import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../utils/theme';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          paddingBottom: 4,
          height: 60,
        },
        headerStyle: { backgroundColor: colors.secondary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tableau de bord',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Livraisons',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: 'Opérations',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚙️</Text>,
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Itinéraires',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>🗺️</Text>,
        }}
      />
    </Tabs>
  );
}
