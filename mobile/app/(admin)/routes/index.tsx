import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useDeliveries } from '../../../hooks/useDeliveries';
import { Card, StatusBadge } from '../../../components/common';
import { colors, spacing, fontSize } from '../../../utils/theme';

export default function Routes() {
  const { deliveries, loading, fetchAllDeliveries } = useDeliveries();

  useEffect(() => {
    fetchAllDeliveries({ status: 'in_transit' });
  }, []);

  const activeDeliveries = deliveries.filter((d) =>
    ['assigned', 'picked_up', 'in_transit'].includes(d.status)
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchAllDeliveries({ status: 'in_transit' })} />}
    >
      <Text style={styles.title}>Itinéraires actifs</Text>
      <Text style={styles.subtitle}>{activeDeliveries.length} livraisons en cours</Text>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapIcon}>🗺️</Text>
        <Text style={styles.mapText}>Carte interactive</Text>
        <Text style={styles.mapSubtext}>Intégration Google Maps à venir</Text>
      </View>

      <Text style={styles.sectionTitle}>Livraisons en transit</Text>
      {activeDeliveries.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune livraison en transit</Text>
        </Card>
      ) : (
        activeDeliveries.map((d) => (
          <Card key={d.id} style={styles.routeCard}>
            <View style={styles.routeHeader}>
              <Text style={styles.tracking}>#{d.trackingNumber}</Text>
              <StatusBadge status={d.status} />
            </View>
            <View style={styles.routePoints}>
              <View style={styles.routePoint}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text style={styles.routeAddress} numberOfLines={1}>{d.pickupAddress}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routePoint}>
                <View style={[styles.dot, { backgroundColor: colors.error }]} />
                <Text style={styles.routeAddress} numberOfLines={1}>{d.dropoffAddress}</Text>
              </View>
            </View>
            {d.driverName && (
              <Text style={styles.driver}>🚗 {d.driverName}</Text>
            )}
          </Card>
        ))
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  mapPlaceholder: { backgroundColor: colors.gray[100], borderRadius: 16, padding: spacing.xxl, alignItems: 'center', marginBottom: spacing.lg },
  mapIcon: { fontSize: 48, marginBottom: spacing.sm },
  mapText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  mapSubtext: { fontSize: fontSize.sm, color: colors.textSecondary },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  routeCard: { marginBottom: spacing.sm },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  tracking: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray[600] },
  routePoints: { marginLeft: spacing.xs },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, height: 20, backgroundColor: colors.gray[200], marginLeft: 4 },
  routeAddress: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  driver: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm },
  emptyCard: { alignItems: 'center', padding: spacing.xl },
  emptyText: { color: colors.textSecondary },
});
