import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useDeliveries } from '../../hooks/useDeliveries';
import { Card, Button } from '../../components/common';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

interface Stats {
  total: number;
  pending: number;
  inTransit: number;
  delivered: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { deliveries, loading, fetchAllDeliveries } = useDeliveries();
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, inTransit: 0, delivered: 0 });

  useEffect(() => {
    fetchAllDeliveries();
  }, []);

  useEffect(() => {
    setStats({
      total: deliveries.length,
      pending: deliveries.filter((d) => d.status === 'pending').length,
      inTransit: deliveries.filter((d) => d.status === 'in_transit').length,
      delivered: deliveries.filter((d) => d.status === 'delivered').length,
    });
  }, [deliveries]);

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAllDeliveries} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bienvenue, {user?.firstName}</Text>
          <Text style={styles.role}>{user?.role || 'Admin'}</Text>
        </View>
        <Button title="Déconnexion" variant="ghost" onPress={handleLogout} />
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Total" value={stats.total} color={colors.info} />
        <StatCard label="En attente" value={stats.pending} color={colors.warning} />
        <StatCard label="En transit" value={stats.inTransit} color={colors.primary} />
        <StatCard label="Livrées" value={stats.delivered} color={colors.success} />
      </View>

      <Text style={styles.sectionTitle}>Actions rapides</Text>
      <View style={styles.actionsRow}>
        <Card style={styles.actionCard}>
          <Text style={styles.actionIcon}>📦</Text>
          <Text style={styles.actionLabel}>Gérer livraisons</Text>
        </Card>
        <Card style={styles.actionCard}>
          <Text style={styles.actionIcon}>🚗</Text>
          <Text style={styles.actionLabel}>Assigner chauffeurs</Text>
        </Card>
        <Card style={styles.actionCard}>
          <Text style={styles.actionIcon}>📈</Text>
          <Text style={styles.actionLabel}>Rapports</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Livraisons récentes</Text>
      {deliveries.slice(0, 5).map((d) => (
        <Card key={d.id} style={styles.deliveryCard}>
          <View style={styles.deliveryRow}>
            <View>
              <Text style={styles.deliveryTracking}>#{d.trackingNumber}</Text>
              <Text style={styles.deliveryRoute} numberOfLines={1}>{d.pickupAddress} → {d.dropoffAddress}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusColor(d.status) }]} />
          </View>
        </Card>
      ))}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: colors.warning,
    in_transit: colors.primary,
    delivered: colors.success,
    cancelled: colors.error,
  };
  return map[status] || colors.gray[400];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  greeting: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  role: { fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm },
  statCard: { width: '47%', padding: spacing.md },
  statValue: { fontSize: fontSize.xxl, fontWeight: '700' },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  actionsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  actionCard: { flex: 1, alignItems: 'center', padding: spacing.md },
  actionIcon: { fontSize: 28, marginBottom: spacing.xs },
  actionLabel: { fontSize: fontSize.xs, fontWeight: '500', color: colors.text, textAlign: 'center' },
  deliveryCard: { marginHorizontal: spacing.lg, marginBottom: spacing.xs },
  deliveryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryTracking: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray[600] },
  deliveryRoute: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2, maxWidth: 260 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
