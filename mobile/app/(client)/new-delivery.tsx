import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDeliveries } from '../../hooks/useDeliveries';
import { Button, Input, Card } from '../../components/common';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { formatCurrency, packageSizeLabels } from '../../utils/helpers';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import { PriceEstimate, DeliveryRequest } from '../../services/deliveries';

type Step = 'pickup' | 'dropoff' | 'package' | 'review';

export default function NewDelivery() {
  const router = useRouter();
  const { createDelivery, getEstimate, loading } = useDeliveries();
  const [step, setStep] = useState<Step>('pickup');
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const [form, setForm] = useState<DeliveryRequest>({
    pickupAddress: '',
    pickupContactName: '',
    pickupContactPhone: '',
    dropoffAddress: '',
    dropoffContactName: '',
    dropoffContactPhone: '',
    packageDescription: '',
    packageSize: 'small',
    isFragile: false,
    notes: '',
  });

  const update = (field: keyof DeliveryRequest) => (value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const nextStep = async () => {
    if (step === 'pickup') {
      if (!form.pickupAddress || !form.pickupContactName || !form.pickupContactPhone) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs de ramassage');
        return;
      }
      setStep('dropoff');
    } else if (step === 'dropoff') {
      if (!form.dropoffAddress || !form.dropoffContactName || !form.dropoffContactPhone) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs de livraison');
        return;
      }
      setStep('package');
    } else if (step === 'package') {
      if (!form.packageDescription) {
        Alert.alert('Erreur', 'Veuillez décrire votre colis');
        return;
      }
      try {
        const est = await getEstimate(form);
        setEstimate(est);
      } catch {
        // continue without estimate
      }
      setStep('review');
    }
  };

  const prevStep = () => {
    if (step === 'dropoff') setStep('pickup');
    else if (step === 'package') setStep('dropoff');
    else if (step === 'review') setStep('package');
  };

  const handleSubmit = async () => {
    try {
      const delivery = await createDelivery(form);
      Alert.alert('Succès', `Livraison créée ! Numéro: ${delivery.trackingNumber}`, [
        { text: 'OK', onPress: () => router.replace('/(client)/deliveries') },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  const steps: Step[] = ['pickup', 'dropoff', 'package', 'review'];
  const stepIndex = steps.indexOf(step);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Progress bar */}
        <View style={styles.progress}>
          {steps.map((s, i) => (
            <View key={s} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
          ))}
        </View>

        {step === 'pickup' && (
          <View>
            <Text style={styles.stepTitle}>📍 Point de ramassage</Text>
            <AddressAutocomplete label="Adresse de ramassage *" placeholder="Quartier, Rue, Ville" value={form.pickupAddress} onChangeText={(v) => update('pickupAddress')(v)} onSelect={(details) => update('pickupAddress')(details.address)} />
            <Input label="Nom du contact *" placeholder="Nom complet" value={form.pickupContactName} onChangeText={(v) => update('pickupContactName')(v)} />
            <Input label="Téléphone du contact *" placeholder="+237 6XX XXX XXX" value={form.pickupContactPhone} onChangeText={(v) => update('pickupContactPhone')(v)} keyboardType="phone-pad" />
          </View>
        )}

        {step === 'dropoff' && (
          <View>
            <Text style={styles.stepTitle}>📍 Point de livraison</Text>
            <AddressAutocomplete label="Adresse de livraison *" placeholder="Quartier, Rue, Ville" value={form.dropoffAddress} onChangeText={(v) => update('dropoffAddress')(v)} onSelect={(details) => update('dropoffAddress')(details.address)} />
            <Input label="Nom du destinataire *" placeholder="Nom complet" value={form.dropoffContactName} onChangeText={(v) => update('dropoffContactName')(v)} />
            <Input label="Téléphone du destinataire *" placeholder="+237 6XX XXX XXX" value={form.dropoffContactPhone} onChangeText={(v) => update('dropoffContactPhone')(v)} keyboardType="phone-pad" />
          </View>
        )}

        {step === 'package' && (
          <View>
            <Text style={styles.stepTitle}>📦 Détails du colis</Text>
            <Input label="Description *" placeholder="Que contient le colis ?" value={form.packageDescription} onChangeText={(v) => update('packageDescription')(v)} multiline numberOfLines={3} />
            <Text style={styles.label}>Taille du colis *</Text>
            <View style={styles.sizeGrid}>
              {(['small', 'medium', 'large', 'xl'] as const).map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.sizeOption, form.packageSize === size && styles.sizeOptionActive]}
                  onPress={() => update('packageSize')(size)}
                >
                  <Text style={[styles.sizeText, form.packageSize === size && styles.sizeTextActive]}>
                    {packageSizeLabels[size]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.fragileToggle, form.isFragile && styles.fragileActive]}
              onPress={() => update('isFragile')(!form.isFragile)}
            >
              <Text style={styles.fragileText}>⚠️ Colis fragile</Text>
            </TouchableOpacity>
            <Input label="Notes (optionnel)" placeholder="Instructions spéciales..." value={form.notes || ''} onChangeText={(v) => update('notes')(v)} multiline />
          </View>
        )}

        {step === 'review' && (
          <View>
            <Text style={styles.stepTitle}>✅ Récapitulatif</Text>
            <Card style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Ramassage</Text>
              <Text style={styles.reviewValue}>{form.pickupAddress}</Text>
              <Text style={styles.reviewContact}>{form.pickupContactName} • {form.pickupContactPhone}</Text>
            </Card>
            <Card style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Livraison</Text>
              <Text style={styles.reviewValue}>{form.dropoffAddress}</Text>
              <Text style={styles.reviewContact}>{form.dropoffContactName} • {form.dropoffContactPhone}</Text>
            </Card>
            <Card style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Colis</Text>
              <Text style={styles.reviewValue}>{form.packageDescription}</Text>
              <Text style={styles.reviewContact}>{packageSizeLabels[form.packageSize]} {form.isFragile ? '• Fragile' : ''}</Text>
            </Card>
            {estimate && (
              <Card style={[styles.reviewCard, styles.priceCard]}>
                <Text style={styles.priceLabel}>Coût estimé</Text>
                <Text style={styles.priceValue}>{formatCurrency(estimate.estimatedCost)}</Text>
                <Text style={styles.priceDetail}>
                  {estimate.distanceKm.toFixed(1)} km • ~{estimate.estimatedDuration}
                </Text>
              </Card>
            )}
          </View>
        )}

        <View style={styles.navButtons}>
          {stepIndex > 0 && <Button title="Précédent" variant="outline" onPress={prevStep} style={styles.navButton} />}
          {step !== 'review' ? (
            <Button title="Suivant" onPress={nextStep} style={styles.navButton} />
          ) : (
            <Button title="Confirmer la livraison" onPress={handleSubmit} loading={loading} style={styles.navButton} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: spacing.lg },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  progressDot: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray[200] },
  progressDotActive: { backgroundColor: colors.primary },
  stepTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray[700], marginBottom: spacing.sm },
  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  sizeOption: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  sizeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  sizeText: { fontSize: fontSize.sm, color: colors.text },
  sizeTextActive: { color: colors.primary, fontWeight: '600' },
  fragileToggle: { padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, backgroundColor: colors.white },
  fragileActive: { borderColor: colors.warning, backgroundColor: colors.warning + '10' },
  fragileText: { fontSize: fontSize.sm, color: colors.text },
  reviewCard: { marginBottom: spacing.sm },
  reviewLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  reviewValue: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  reviewContact: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  priceCard: { backgroundColor: colors.primary + '08', borderWidth: 1, borderColor: colors.primary + '20' },
  priceLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  priceValue: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.primary },
  priceDetail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  navButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  navButton: { flex: 1 },
});
