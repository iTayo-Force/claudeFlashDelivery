import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { colors } from '../utils/theme';

export default function RootLayout() {
  const restore = useAuth((s) => s.restore);
  const isLoggedIn = useAuth((s) => !!s.accessToken);
  useNotifications();

  useEffect(() => {
    restore();
  }, []);

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.white },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Connexion' }} />
          <Stack.Screen name="register" options={{ title: 'Inscription' }} />
          <Stack.Screen name="admin-login" options={{ title: 'Espace Employé' }} />
          <Stack.Screen name="(client)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        </Stack>
      </View>
    </ErrorBoundary>
  );
}
