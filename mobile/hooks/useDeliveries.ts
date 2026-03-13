import { useState, useCallback } from 'react';
import { deliveryService, Delivery, DeliveryRequest, PriceEstimate } from '../services/deliveries';

export function useDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchMyDeliveries = useCallback(async (params?: { status?: string; page?: number; limit?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await deliveryService.getMyDeliveries(params);
      setDeliveries(data.deliveries);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllDeliveries = useCallback(async (params?: { status?: string; page?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await deliveryService.getAll(params);
      setDeliveries(data.deliveries);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  const createDelivery = useCallback(async (payload: DeliveryRequest) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await deliveryService.create(payload);
      return data.delivery;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to create delivery';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getEstimate = useCallback(async (payload: Partial<DeliveryRequest>): Promise<PriceEstimate> => {
    const { data } = await deliveryService.getEstimate(payload);
    return data;
  }, []);

  const trackDelivery = useCallback(async (trackingNumber: string) => {
    setLoading(true);
    try {
      const { data } = await deliveryService.track(trackingNumber);
      return data.delivery;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delivery not found');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    deliveries,
    loading,
    error,
    total,
    fetchMyDeliveries,
    fetchAllDeliveries,
    createDelivery,
    getEstimate,
    trackDelivery,
    clearError: () => setError(null),
  };
}
