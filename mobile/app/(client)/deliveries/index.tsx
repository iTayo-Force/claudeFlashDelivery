import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useDeliveries } from '../../../hooks/useDeliveries';
import { Card, StatusBadge } from '../../../components/common';
import { formatCurrency, formatDate, statusLabels } from '../../../utils/helpers';
import { colors, spacing, fontSize, borderRadius } from '../../../utils/theme';

const FILTERS = ['all', 'pending', 'in_transit', 'delivered', 'cancelled'] as const;
const filterLabels: Record<string, string> = {
  all: 'Toutes',
  pending: 'En attente',
  in_transit: 'En transit',
  delivered: 'Livrées',
  cancelled: 'Annulées',
};

export default function MyDeliveries() {
  const router = useRouter();
  const { deliveries, loading, total, fetchMyDeliveries } = useDeliveries();
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchMyDeliveries(filter === 'all' ? {} : { status: filter });
  }, [filter]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {filterLabels[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchMyDeliveries(filter === 'all' ? {} : { status: filter })} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Aucune livraison trouvée</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(client)/deliveries/${item.id}`)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.tracking}>#{item.trackingNumber}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.route} numberOfLines={1}>📍 {item.pickupAddress}</Text>
              <Text style={styles.routeArrow}>↓</Text>
              <Text style={styles.route} numberOfLines={1}>📍 {item.dropoffAddress}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                <Text style={styles.cost}>{formatCurrency(item.estimatedCost)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  filterChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.white },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { marginBottom: spacing.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  tracking: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray[600] },
  route: { fontSize: fontSize.sm, color: colors.text },
  routeArrow: { fontSize: fontSize.xs, color: colors.gray[400], marginLeft: spacing.md },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  date: { fontSize: fontSize.xs, color: colors.textSecondary },
  cost: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  empty: { alignItems: 'center', padding: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary },
});
