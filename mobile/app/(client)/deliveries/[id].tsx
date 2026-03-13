import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { deliveryService, Delivery } from '../../../services/deliveries';
import { Button, Card, StatusBadge } from '../../../components/common';
import { formatCurrency, formatDate, packageSizeLabels } from '../../../utils/helpers';
import { colors, spacing, fontSize } from '../../../utils/theme';

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDelivery();
  }, [id]);

  const loadDelivery = async () => {
    try {
      const { data } = await deliveryService.getById(id);
      setDelivery(data.delivery);
    } catch {
      Alert.alert('Erreur', 'Livraison introuvable');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Annuler la livraison', 'Êtes-vous sûr de vouloir annuler cette livraison ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          try {
            await deliveryService.cancel(id);
            loadDelivery();
          } catch {
            Alert.alert('Erreur', 'Impossible d\'annuler la livraison');
          }
        },
      },
    ]);
  };

  const handleCallDriver = () => {
    if (delivery?.driverPhone) {
      Linking.openURL(`tel:${delivery.driverPhone}`);
    }
  };

  if (loading || !delivery) {
    return (
      <View style={styles.loading}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  const canCancel = ['pending', 'confirmed'].includes(delivery.status);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.trackingNumber}>#{delivery.trackingNumber}</Text>
        <StatusBadge status={delivery.status} />
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Ramassage</Text>
        <Text style={styles.address}>{delivery.pickupAddress}</Text>
        <Text style={styles.contact}>{delivery.pickupContactName}</Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Livraison</Text>
        <Text style={styles.address}>{delivery.dropoffAddress}</Text>
        <Text style={styles.contact}>{delivery.dropoffContactName}</Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Colis</Text>
        <Text style={styles.detail}>{delivery.packageDescription}</Text>
        <Text style={styles.detail}>{packageSizeLabels[delivery.packageSize] || delivery.packageSize}</Text>
      </Card>

      {delivery.driverName && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Chauffeur</Text>
          <Text style={styles.detail}>{delivery.driverName}</Text>
          {delivery.driverPhone && (
            <Button title="Appeler le chauffeur" variant="outline" onPress={handleCallDriver} style={{ marginTop: spacing.sm }} />
          )}
        </Card>
      )}

      <Card style={styles.priceSection}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Coût estimé</Text>
          <Text style={styles.priceValue}>{formatCurrency(delivery.estimatedCost)}</Text>
        </View>
        {delivery.actualCost && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Coût final</Text>
            <Text style={styles.priceValue}>{formatCurrency(delivery.actualCost)}</Text>
          </View>
        )}
      </Card>

      <View style={styles.meta}>
        <Text style={styles.metaText}>Créée le {formatDate(delivery.createdAt)}</Text>
        {delivery.estimatedDeliveryTime && (
          <Text style={styles.metaText}>Livraison estimée: {formatDate(delivery.estimatedDeliveryTime)}</Text>
        )}
      </View>

      {canCancel && (
        <Button title="Annuler la livraison" variant="outline" onPress={handleCancel} style={styles.cancelButton} />
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  trackingNumber: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  section: { marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, textTransform: 'uppercase' },
  address: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  contact: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  detail: { fontSize: fontSize.md, color: colors.text, marginBottom: spacing.xs },
  priceSection: { marginBottom: spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  priceLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  priceValue: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },
  meta: { paddingHorizontal: spacing.xs, marginBottom: spacing.lg },
  metaText: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.xs },
  cancelButton: { borderColor: colors.error },
});
