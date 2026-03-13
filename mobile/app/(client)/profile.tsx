import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Button, Card } from '../../components/common';
import { formatPhone } from '../../utils/helpers';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </View>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.phone}>{user?.phone ? formatPhone(user.phone) : ''}</Text>
        {user?.email && <Text style={styles.email}>{user.email}</Text>}
      </View>

      <Card style={styles.menuCard}>
        <MenuItem label="Mes livraisons" icon="📦" onPress={() => router.push('/(client)/deliveries')} />
        <MenuItem label="Moyens de paiement" icon="💳" />
        <MenuItem label="Adresses enregistrées" icon="📍" />
        <MenuItem label="Notifications" icon="🔔" />
        <MenuItem label="Langue" icon="🌐" detail="Français" />
      </Card>

      <Card style={styles.menuCard}>
        <MenuItem label="Centre d'aide" icon="❓" />
        <MenuItem label="Conditions d'utilisation" icon="📄" />
        <MenuItem label="Politique de confidentialité" icon="🔒" />
      </Card>

      <Button title="Se déconnecter" variant="outline" onPress={handleLogout} style={styles.logoutButton} />

      <Text style={styles.version}>Claude Flash Delivery v1.0.0</Text>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function MenuItem({ label, icon, detail, onPress }: { label: string; icon: string; detail?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      {detail && <Text style={styles.menuDetail}>{detail}</Text>}
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  avatarText: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.white },
  name: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  phone: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  email: { fontSize: fontSize.sm, color: colors.textSecondary },
  menuCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: 0, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  menuIcon: { fontSize: 20, marginRight: spacing.md },
  menuLabel: { flex: 1, fontSize: fontSize.md, color: colors.text },
  menuDetail: { fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing.sm },
  menuArrow: { fontSize: 20, color: colors.gray[300] },
  logoutButton: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderColor: colors.error },
  version: { textAlign: 'center', fontSize: fontSize.xs, color: colors.gray[400], marginTop: spacing.lg },
});
