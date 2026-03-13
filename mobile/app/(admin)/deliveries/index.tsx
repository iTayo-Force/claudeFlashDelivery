import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useDeliveries } from '../../../hooks/useDeliveries';
import { deliveryService, Delivery } from '../../../services/deliveries';
import { Card, StatusBadge, Button } from '../../../components/common';
import { formatCurrency, formatDate, statusLabels } from '../../../utils/helpers';
import { colors, spacing, fontSize, borderRadius } from '../../../utils/theme';

const STATUSES = ['all', 'pending', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered'] as const;

export default function AdminDeliveries() {
  const { deliveries, loading, fetchAllDeliveries } = useDeliveries();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAllDeliveries(filter === 'all' ? {} : { status: filter });
  }, [filter]);

  const handleStatusUpdate = (delivery: Delivery, newStatus: string) => {
    Alert.alert(
      'Mettre à jour le statut',
      `Changer le statut à "${statusLabels[newStatus] || newStatus}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await deliveryService.updateStatus(delivery.id, newStatus);
              fetchAllDeliveries(filter === 'all' ? {} : { status: filter });
            } catch {
              Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
            }
          },
        },
      ]
    );
  };

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      pending: 'confirmed',
      confirmed: 'assigned',
      assigned: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered',
    };
    return flow[current] || null;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchAllDeliveries(filter === 'all' ? {} : { status: filter })} />}
        ListHeaderComponent={
          <View style={styles.filtersScroll}>
            {STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, filter === s && styles.chipActive]}
                onPress={() => setFilter(s)}
              >
                <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
                  {s === 'all' ? 'Toutes' : statusLabels[s] || s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const nextStatus = getNextStatus(item.status);
          return (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.tracking}>#{item.trackingNumber}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.route} numberOfLines={1}>📍 {item.pickupAddress}</Text>
              <Text style={styles.arrow}>↓</Text>
              <Text style={styles.route} numberOfLines={1}>📍 {item.dropoffAddress}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                <Text style={styles.cost}>{formatCurrency(item.estimatedCost)}</Text>
              </View>
              {nextStatus && (
                <Button
                  title={`→ ${statusLabels[nextStatus]}`}
                  variant="outline"
                  onPress={() => handleStatusUpdate(item, nextStatus)}
                  style={styles.statusButton}
                />
              )}
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucune livraison</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filtersScroll: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.xs },
  chip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { fontSize: fontSize.xs, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  list: { paddingBottom: spacing.xxl },
  card: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  tracking: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray[600] },
  route: { fontSize: fontSize.sm, color: colors.text },
  arrow: { fontSize: fontSize.xs, color: colors.gray[400], marginLeft: spacing.md },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  date: { fontSize: fontSize.xs, color: colors.textSecondary },
  cost: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  statusButton: { marginTop: spacing.sm },
  empty: { alignItems: 'center', padding: spacing.xxl },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary },
});
