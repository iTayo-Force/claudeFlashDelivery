import api from './api';

export interface DeliveryRequest {
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupContactName: string;
  pickupContactPhone: string;
  dropoffAddress: string;
  dropoffLat?: number;
  dropoffLng?: number;
  dropoffContactName: string;
  dropoffContactPhone: string;
  packageDescription: string;
  packageSize: 'small' | 'medium' | 'large' | 'xl';
  isFragile?: boolean;
  notes?: string;
  scheduledPickupTime?: string;
  vehicleType?: 'motorcycle' | 'car' | 'van' | 'truck';
}

export interface Delivery {
  id: string;
  trackingNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageDescription: string;
  packageSize: string;
  estimatedCost: number;
  actualCost?: number;
  pickupContactName: string;
  dropoffContactName: string;
  createdAt: string;
  estimatedDeliveryTime?: string;
  driverName?: string;
  driverPhone?: string;
}

export interface PriceEstimate {
  estimatedCost: number;
  currency: string;
  distanceKm: number;
  estimatedDuration: string;
  breakdown: {
    baseFare: number;
    distanceFare: number;
    sizeSurcharge: number;
    fragileSurcharge: number;
  };
}

export const deliveryService = {
  create: (payload: DeliveryRequest) =>
    api.post<{ delivery: Delivery }>('/deliveries', payload),

  getEstimate: (payload: Partial<DeliveryRequest>) =>
    api.post<PriceEstimate>('/deliveries/estimate', payload),

  getMyDeliveries: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ deliveries: Delivery[]; total: number }>('/deliveries/my', { params }),

  getById: (id: string) =>
    api.get<{ delivery: Delivery }>(`/deliveries/${id}`),

  track: (trackingNumber: string) =>
    api.get<{ delivery: Delivery }>(`/deliveries/track/${trackingNumber}`),

  cancel: (id: string) =>
    api.post(`/deliveries/${id}/cancel`),

  rate: (id: string, rating: number, feedback?: string) =>
    api.post(`/deliveries/${id}/rate`, { rating, feedback }),

  // Admin/employee endpoints
  getAll: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ deliveries: Delivery[]; total: number }>('/admin/deliveries', { params }),

  assign: (id: string, driverId: string) =>
    api.post(`/admin/deliveries/${id}/assign`, { driverId }),

  updateStatus: (id: string, status: string) =>
    api.patch(`/admin/deliveries/${id}/status`, { status }),
};
