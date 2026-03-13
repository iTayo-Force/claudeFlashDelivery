export function formatCurrency(amount: number, currency = 'XAF'): string {
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPhone(phone: string): string {
  if (phone.startsWith('+237')) {
    const num = phone.slice(4);
    return `+237 ${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`;
  }
  return phone;
}

export const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  assigned: 'Assignée',
  picked_up: 'Ramassée',
  in_transit: 'En transit',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  failed: 'Échouée',
};

export const statusColors: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  assigned: '#8B5CF6',
  picked_up: '#06B6D4',
  in_transit: '#FF6B00',
  delivered: '#10B981',
  cancelled: '#EF4444',
  failed: '#EF4444',
};

export const packageSizeLabels: Record<string, string> = {
  small: 'Petit (< 5kg)',
  medium: 'Moyen (5-15kg)',
  large: 'Grand (15-30kg)',
  xl: 'Très grand (> 30kg)',
};
