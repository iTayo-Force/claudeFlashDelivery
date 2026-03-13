import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { Button, Input } from '../components/common';
import { colors, spacing, fontSize } from '../utils/theme';

export default function Register() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const update = (field: string) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleRegister = async () => {
    const { firstName, lastName, phone, password, confirmPassword } = form;
    if (!firstName || !lastName || !phone || !password) {
      Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    try {
      clearError();
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email || undefined,
        password: form.password,
        preferredLanguage: 'fr',
      });
      router.replace('/(client)');
    } catch {
      // error is set in the store
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez Claude Flash Delivery</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="Prénom *" placeholder="Jean" value={form.firstName} onChangeText={update('firstName')} />
          </View>
          <View style={styles.half}>
            <Input label="Nom *" placeholder="Dupont" value={form.lastName} onChangeText={update('lastName')} />
          </View>
        </View>

        <Input
          label="Téléphone *"
          placeholder="+237 6XX XXX XXX"
          value={form.phone}
          onChangeText={update('phone')}
          keyboardType="phone-pad"
        />

        <Input
          label="Email (optionnel)"
          placeholder="jean@example.com"
          value={form.email}
          onChangeText={update('email')}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Input
          label="Mot de passe *"
          placeholder="Min. 8 caractères"
          value={form.password}
          onChangeText={update('password')}
          secureTextEntry
        />

        <Input
          label="Confirmer le mot de passe *"
          placeholder="Retapez votre mot de passe"
          value={form.confirmPassword}
          onChangeText={update('confirmPassword')}
          secureTextEntry
        />

        <Button title="Créer mon compte" onPress={handleRegister} loading={isLoading} />

        <Button
          title="Déjà inscrit ? Connectez-vous"
          variant="ghost"
          onPress={() => router.push('/login')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  errorBox: {
    backgroundColor: colors.error + '15',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
});
