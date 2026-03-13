import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, Platform } from 'react-native';
import MapView, { Marker, Polyline, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useDeliveries } from '../../../hooks/useDeliveries';
import { Card, StatusBadge } from '../../../components/common';
import { colors, spacing, fontSize } from '../../../utils/theme';
import { Delivery } from '../../../services/deliveries';

const DOUALA_REGION: Region = {
  latitude: 4.0511,
  longitude: 9.7679,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function Routes() {
  const { deliveries, loading, fetchAllDeliveries } = useDeliveries();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    fetchAllDeliveries({ status: 'in_transit' });
  }, []);

  const activeDeliveries = useMemo(
    () => deliveries.filter((d) => ['assigned', 'picked_up', 'in_transit'].includes(d.status)),
    [deliveries]
  );

  const markers = useMemo(() => {
    const result: { id: string; type: 'pickup' | 'dropoff'; lat: number; lng: number; label: string; tracking: string }[] = [];
    activeDeliveries.forEach((d) => {
      if (d.pickupLat && d.pickupLng) {
        result.push({ id: `${d.id}-pickup`, type: 'pickup', lat: d.pickupLat, lng: d.pickupLng, label: d.pickupAddress, tracking: d.trackingNumber });
      }
      if (d.dropoffLat && d.dropoffLng) {
        result.push({ id: `${d.id}-dropoff`, type: 'dropoff', lat: d.dropoffLat, lng: d.dropoffLng, label: d.dropoffAddress, tracking: d.trackingNumber });
      }
    });
    return result;
  }, [activeDeliveries]);

  const routes = useMemo(() => {
    return activeDeliveries
      .filter((d) => d.pickupLat && d.pickupLng && d.dropoffLat && d.dropoffLng)
      .map((d) => ({
        id: d.id,
        coordinates: [
          { latitude: d.pickupLat!, longitude: d.pickupLng! },
          { latitude: d.dropoffLat!, longitude: d.dropoffLng! },
        ],
      }));
  }, [activeDeliveries]);

  useEffect(() => {
    if (markers.length > 0 && mapRef.current) {
      const coords = markers.map((m) => ({ latitude: m.lat, longitude: m.lng }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [markers]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchAllDeliveries({ status: 'in_transit' })} />}
    >
      <Text style={styles.title}>Itinéraires actifs</Text>
      <Text style={styles.subtitle}>{activeDeliveries.length} livraisons en cours</Text>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={DOUALA_REGION}
          showsUserLocation
          showsMyLocationButton
        >
          {markers.map((m) => (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              title={`#${m.tracking}`}
              description={m.label}
              pinColor={m.type === 'pickup' ? colors.success : colors.error}
            />
          ))}
          {routes.map((r) => (
            <Polyline
              key={r.id}
              coordinates={r.coordinates}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[6, 3]}
            />
          ))}
        </MapView>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Ramassage</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
            <Text style={styles.legendText}>Livraison</Text>
          </View>
        </View>
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  mapContainer: { borderRadius: 16, overflow: 'hidden', marginBottom: spacing.lg, backgroundColor: colors.gray[100] },
  map: { width: SCREEN_WIDTH - spacing.lg * 2, height: 280 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.white },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: fontSize.xs, color: colors.textSecondary },
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
