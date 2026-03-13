import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { paymentService } from '../../services/payments';
import { Button, Input, Card } from '../../components/common';
import { formatCurrency } from '../../utils/helpers';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

type Provider = 'orange_money' | 'mtn_momo';

export default function Payment() {
  const { deliveryId, amount } = useLocalSearchParams<{ deliveryId: string; amount: string }>();
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>('orange_money');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [polling, setPolling] = useState(false);

  const parsedAmount = parseFloat(amount || '0');

  const handleInitiate = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Veuillez saisir un numéro de téléphone valide');
      return;
    }
    setLoading(true);
    try {
      const { data } = await paymentService.initiate({
        deliveryId: deliveryId!,
        provider,
        phoneNumber: phone,
        amount: parsedAmount,
      });
      setPaymentId(data.payment.id);
      setReferenceId(data.payment.transactionId || null);
      setStatus('pending');
      setPolling(true);
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.error || 'Échec de l\'initiation du paiement');
    } finally {
      setLoading(false);
    }
  };

  // Poll for payment status
  const checkStatus = useCallback(async () => {
    if (!paymentId) return;
    try {
      const { data } = await paymentService.getStatus(paymentId);
      const paymentStatus = data.payment.status;
      if (paymentStatus === 'Completed' || paymentStatus === 'completed') {
        setStatus('success');
        setPolling(false);
      } else if (paymentStatus === 'Failed' || paymentStatus === 'failed') {
        setStatus('failed');
        setPolling(false);
      }
    } catch {
      // Keep polling on network errors
    }
  }, [paymentId]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkStatus, 5000);
    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      setPolling(false);
      if (status === 'pending') setStatus('timeout');
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [polling, checkStatus, status]);

  if (status === 'success') {
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultIcon}>✅</Text>
        <Text style={styles.resultTitle}>Paiement réussi !</Text>
        <Text style={styles.resultSubtitle}>
          {formatCurrency(parsedAmount)} payé via {provider === 'orange_money' ? 'Orange Money' : 'MTN MoMo'}
        </Text>
        <Button title="Retour aux livraisons" onPress={() => router.replace('/(client)/deliveries')} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultIcon}>❌</Text>
        <Text style={styles.resultTitle}>Paiement échoué</Text>
        <Text style={styles.resultSubtitle}>Le paiement n'a pas pu être traité. Veuillez réessayer.</Text>
        <Button title="Réessayer" onPress={() => { setStatus('idle'); setPaymentId(null); }} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Paiement mobile</Text>

      <Card style={styles.amountCard}>
        <Text style={styles.amountLabel}>Montant à payer</Text>
        <Text style={styles.amountValue}>{formatCurrency(parsedAmount)}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Moyen de paiement</Text>
      <View style={styles.providers}>
        <TouchableOpacity
          style={[styles.providerCard, provider === 'orange_money' && styles.providerActive]}
          onPress={() => setProvider('orange_money')}
        >
          <Text style={styles.providerIcon}>🟠</Text>
          <Text style={[styles.providerName, provider === 'orange_money' && styles.providerNameActive]}>
            Orange Money
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.providerCard, provider === 'mtn_momo' && styles.providerActive]}
          onPress={() => setProvider('mtn_momo')}
        >
          <Text style={styles.providerIcon}>🟡</Text>
          <Text style={[styles.providerName, provider === 'mtn_momo' && styles.providerNameActive]}>
            MTN MoMo
          </Text>
        </TouchableOpacity>
      </View>

      <Input
        label={`Numéro ${provider === 'orange_money' ? 'Orange Money' : 'MTN MoMo'}`}
        placeholder={provider === 'orange_money' ? '6 9X XX XX XX' : '6 7X XX XX XX'}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      {status === 'pending' ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingIcon}>⏳</Text>
          <Text style={styles.pendingTitle}>En attente de confirmation</Text>
          <Text style={styles.pendingText}>
            Veuillez valider le paiement sur votre téléphone. Composez {provider === 'orange_money' ? '#150#' : '*126#'} si vous ne recevez pas de notification.
          </Text>
        </View>
      ) : (
        <Button title={`Payer ${formatCurrency(parsedAmount)}`} onPress={handleInitiate} loading={loading} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  amountCard: { alignItems: 'center', marginBottom: spacing.lg, padding: spacing.xl, backgroundColor: colors.primary + '08', borderWidth: 1, borderColor: colors.primary + '20' },
  amountLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  amountValue: { fontSize: 36, fontWeight: '800', color: colors.primary },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  providers: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  providerCard: { flex: 1, padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center' },
  providerActive: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  providerIcon: { fontSize: 32, marginBottom: spacing.sm },
  providerName: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
  providerNameActive: { color: colors.primary, fontWeight: '700' },
  pendingBox: { alignItems: 'center', padding: spacing.xl, backgroundColor: colors.warning + '10', borderRadius: borderRadius.lg },
  pendingIcon: { fontSize: 48, marginBottom: spacing.md },
  pendingTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  pendingText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background },
  resultIcon: { fontSize: 64, marginBottom: spacing.lg },
  resultTitle: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  resultSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
});
