import api from './api';

export interface PaymentInitPayload {
  deliveryId: string;
  provider: 'orange_money' | 'mtn_momo';
  phoneNumber: string;
  amount: number;
}

export interface Payment {
  id: string;
  deliveryId: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  transactionId?: string;
  createdAt: string;
}

export const paymentService = {
  initiate: (payload: PaymentInitPayload) =>
    api.post<{ payment: Payment; redirectUrl?: string }>('/payments/initiate', payload),

  getStatus: (paymentId: string) =>
    api.get<{ payment: Payment }>(`/payments/${paymentId}/status`),

  getByDelivery: (deliveryId: string) =>
    api.get<{ payments: Payment[] }>(`/payments/delivery/${deliveryId}`),
};
