import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useDeliveries } from '../../../hooks/useDeliveries';
import { Card } from '../../../components/common';
import { colors, spacing, fontSize } from '../../../utils/theme';

export default function Operations() {
  const { deliveries, loading, fetchAllDeliveries } = useDeliveries();

  useEffect(() => {
    fetchAllDeliveries();
  }, []);

  const todayCount = deliveries.filter((d) => {
    const today = new Date().toDateString();
    return new Date(d.createdAt).toDateString() === today;
  }).length;

  const activeCount = deliveries.filter((d) =>
    ['confirmed', 'assigned', 'picked_up', 'in_transit'].includes(d.status)
  ).length;

  const completedToday = deliveries.filter((d) => {
    const today = new Date().toDateString();
    return d.status === 'delivered' && new Date(d.createdAt).toDateString() === today;
  }).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAllDeliveries} />}
    >
      <Text style={styles.title}>Opérations du jour</Text>

      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.info }]}>{todayCount}</Text>
          <Text style={styles.metricLabel}>Nouvelles commandes</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.primary }]}>{activeCount}</Text>
          <Text style={styles.metricLabel}>En cours</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.success }]}>{completedToday}</Text>
          <Text style={styles.metricLabel}>Livrées aujourd'hui</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.warning }]}>
            {deliveries.filter((d) => d.status === 'pending').length}
          </Text>
          <Text style={styles.metricLabel}>À traiter</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Zones actives</Text>
      <Card style={styles.zoneCard}>
        <ZoneRow zone="Douala - Akwa" count={Math.floor(activeCount * 0.4)} />
        <ZoneRow zone="Douala - Bonabéri" count={Math.floor(activeCount * 0.25)} />
        <ZoneRow zone="Yaoundé - Centre" count={Math.floor(activeCount * 0.2)} />
        <ZoneRow zone="Yaoundé - Mvan" count={Math.floor(activeCount * 0.15)} />
      </Card>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function ZoneRow({ zone, count }: { zone: string; count: number }) {
  return (
    <View style={styles.zoneRow}>
      <Text style={styles.zoneName}>{zone}</Text>
      <View style={styles.zoneBarContainer}>
        <View style={[styles.zoneBar, { width: `${Math.min(count * 10, 100)}%` }]} />
      </View>
      <Text style={styles.zoneCount}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '47%', alignItems: 'center', padding: spacing.lg },
  metricValue: { fontSize: 32, fontWeight: '700' },
  metricLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm },
  zoneCard: { padding: spacing.md },
  zoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  zoneName: { fontSize: fontSize.sm, color: colors.text, width: 140 },
  zoneBarContainer: { flex: 1, height: 8, backgroundColor: colors.gray[100], borderRadius: 4, marginHorizontal: spacing.sm },
  zoneBar: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  zoneCount: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray[600], width: 30, textAlign: 'right' },
});
