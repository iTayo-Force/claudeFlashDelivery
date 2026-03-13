import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common';
import { colors, spacing, fontSize, borderRadius } from '../utils/theme';

export default function Welcome() {
  const router = useRouter();
  const { isAuthenticated, isLoading, portal } = useAuth();

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(portal === 'admin' ? '/(admin)' : '/(client)');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.logo}>⚡ Claude Flash</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>⚡</Text>
        <Text style={styles.title}>Claude Flash</Text>
        <Text style={styles.subtitle}>Livraison rapide au Cameroun</Text>
        <Text style={styles.description}>
          Envoyez vos colis partout au Cameroun en quelques clics. Rapide, fiable, abordable.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button title="Se connecter" onPress={() => router.push('/login')} />
        <Button title="Créer un compte" variant="outline" onPress={() => router.push('/register')} />
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.line} />
        </View>
        <Button title="Espace Employé" variant="ghost" onPress={() => router.push('/admin-login')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 100,
    paddingBottom: spacing.xxl,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  hero: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
});
