import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useDeliveries } from '../../hooks/useDeliveries';
import { Card, StatusBadge } from '../../components/common';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

export default function ClientHome() {
  const router = useRouter();
  const { user } = useAuth();
  const { deliveries, loading, fetchMyDeliveries } = useDeliveries();

  useEffect(() => {
    fetchMyDeliveries({ limit: 5 });
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchMyDeliveries({ limit: 5 })} />}
    >
      <View style={styles.greeting}>
        <Text style={styles.hello}>Bonjour, {user?.firstName} 👋</Text>
        <Text style={styles.tagline}>Que souhaitez-vous envoyer aujourd'hui ?</Text>
      </View>

      <TouchableOpacity style={styles.ctaCard} onPress={() => router.push('/(client)/new-delivery')} activeOpacity={0.8}>
        <Text style={styles.ctaIcon}>📦</Text>
        <View>
          <Text style={styles.ctaTitle}>Nouvelle livraison</Text>
          <Text style={styles.ctaSubtitle}>Envoyez un colis en quelques clics</Text>
        </View>
        <Text style={styles.ctaArrow}>→</Text>
      </TouchableOpacity>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>🔍</Text>
          <Text style={styles.actionLabel}>Suivre</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>💰</Text>
          <Text style={styles.actionLabel}>Tarifs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>📞</Text>
          <Text style={styles.actionLabel}>Support</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Livraisons récentes</Text>
        <TouchableOpacity onPress={() => router.push('/(client)/deliveries')}>
          <Text style={styles.seeAll}>Voir tout</Text>
        </TouchableOpacity>
      </View>

      {deliveries.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune livraison pour le moment</Text>
          <Text style={styles.emptySubtext}>Commencez par envoyer votre premier colis !</Text>
        </Card>
      ) : (
        deliveries.slice(0, 5).map((delivery) => (
          <TouchableOpacity key={delivery.id} onPress={() => router.push(`/(client)/deliveries/${delivery.id}`)}>
            <Card style={styles.deliveryCard}>
              <View style={styles.deliveryHeader}>
                <Text style={styles.trackingNumber}>#{delivery.trackingNumber}</Text>
                <StatusBadge status={delivery.status} />
              </View>
              <View style={styles.deliveryRoute}>
                <Text style={styles.routeText} numberOfLines={1}>📍 {delivery.pickupAddress}</Text>
                <Text style={styles.routeArrow}>↓</Text>
                <Text style={styles.routeText} numberOfLines={1}>📍 {delivery.dropoffAddress}</Text>
              </View>
              <View style={styles.deliveryFooter}>
                <Text style={styles.deliveryDate}>{formatDate(delivery.createdAt)}</Text>
                <Text style={styles.deliveryCost}>{formatCurrency(delivery.estimatedCost)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  greeting: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  hello: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  tagline: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  ctaIcon: {
    fontSize: 32,
  },
  ctaTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.white,
  },
  ctaSubtitle: {
    fontSize: fontSize.sm,
    color: colors.white + 'CC',
  },
  ctaArrow: {
    fontSize: 24,
    color: colors.white,
    marginLeft: 'auto',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  seeAll: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  deliveryCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  trackingNumber: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.gray[600],
  },
  deliveryRoute: {
    marginBottom: spacing.sm,
  },
  routeText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  routeArrow: {
    fontSize: fontSize.xs,
    color: colors.gray[400],
    marginLeft: spacing.md,
  },
  deliveryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deliveryDate: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  deliveryCost: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
