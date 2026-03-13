import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { deliveryService, Delivery } from '../../services/deliveries';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Card, StatusBadge } from '../../components/common';
import { statusLabels } from '../../utils/helpers';
import { colors, spacing, fontSize } from '../../utils/theme';

interface DriverLocation {
  lat: number;
  lng: number;
  timestamp: string;
}

export default function TrackDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<MapView>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(true);

  const ws = useWebSocket({
    onDeliveryUpdate: (update) => {
      if (update.deliveryId === id) {
        setDelivery((prev) => prev ? { ...prev, status: update.status } : prev);
      }
    },
    onDriverLocation: (loc) => {
      setDriverLocation({ lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp });
    },
  });

  useEffect(() => {
    loadDelivery();
  }, [id]);

  useEffect(() => {
    if (ws.authenticated && id) {
      ws.subscribeDelivery(id);
      return () => ws.unsubscribeDelivery(id);
    }
  }, [ws.authenticated, id]);

  const loadDelivery = async () => {
    try {
      const { data } = await deliveryService.getById(id!);
      setDelivery(data.delivery);
    } catch {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!delivery) return;
    const coords = [];
    if (delivery.pickupLat && delivery.pickupLng) {
      coords.push({ latitude: delivery.pickupLat, longitude: delivery.pickupLng });
    }
    if (delivery.dropoffLat && delivery.dropoffLng) {
      coords.push({ latitude: delivery.dropoffLat, longitude: delivery.dropoffLng });
    }
    if (driverLocation) {
      coords.push({ latitude: driverLocation.lat, longitude: driverLocation.lng });
    }
    if (coords.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    }
  }, [delivery, driverLocation]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.loading}>
        <Text>Livraison introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: delivery.pickupLat || 4.0511,
          longitude: delivery.pickupLng || 9.7679,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation
      >
        {delivery.pickupLat && delivery.pickupLng && (
          <Marker
            coordinate={{ latitude: delivery.pickupLat, longitude: delivery.pickupLng }}
            title="Ramassage"
            description={delivery.pickupAddress}
            pinColor={colors.success}
          />
        )}
        {delivery.dropoffLat && delivery.dropoffLng && (
          <Marker
            coordinate={{ latitude: delivery.dropoffLat, longitude: delivery.dropoffLng }}
            title="Livraison"
            description={delivery.dropoffAddress}
            pinColor={colors.error}
          />
        )}
        {driverLocation && (
          <Marker
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            title={delivery.driverName || 'Chauffeur'}
            pinColor={colors.primary}
          />
        )}
        {delivery.pickupLat && delivery.pickupLng && delivery.dropoffLat && delivery.dropoffLng && (
          <Polyline
            coordinates={[
              { latitude: delivery.pickupLat, longitude: delivery.pickupLng },
              ...(driverLocation ? [{ latitude: driverLocation.lat, longitude: driverLocation.lng }] : []),
              { latitude: delivery.dropoffLat, longitude: delivery.dropoffLng },
            ]}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[6, 3]}
          />
        )}
      </MapView>

      <View style={styles.infoPanel}>
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.trackingNumber}>#{delivery.trackingNumber}</Text>
            <StatusBadge status={delivery.status} />
          </View>
          <View style={styles.routeInfo}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={styles.routeText} numberOfLines={1}>{delivery.pickupAddress}</Text>
            </View>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: colors.error }]} />
              <Text style={styles.routeText} numberOfLines={1}>{delivery.dropoffAddress}</Text>
            </View>
          </View>
          {delivery.driverName && (
            <View style={styles.driverInfo}>
              <Text style={styles.driverLabel}>Chauffeur</Text>
              <Text style={styles.driverName}>{delivery.driverName}</Text>
            </View>
          )}
          <View style={styles.wsStatus}>
            <View style={[styles.wsIndicator, { backgroundColor: ws.connected ? colors.success : colors.gray[300] }]} />
            <Text style={styles.wsText}>{ws.connected ? 'Suivi en direct' : 'Connexion...'}</Text>
          </View>
        </Card>
      </View>
    </View>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  infoPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md },
  infoCard: { padding: spacing.lg },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  trackingNumber: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  routeInfo: { gap: spacing.sm, marginBottom: spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  driverInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  driverLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  driverName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  wsStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wsIndicator: { width: 8, height: 8, borderRadius: 4 },
  wsText: { fontSize: fontSize.xs, color: colors.textSecondary },
});
