import type { ItemCategory } from './types';

export function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

export function formatTime24(time: string | null): string {
  if (!time) return '';
  return time.substring(0, 5);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number | null, currency: string = 'JPY'): string {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount);
}

export function getCategoryEmoji(category: ItemCategory): string {
  const emojis: Record<ItemCategory, string> = {
    transport: '🚄',
    food: '🍜',
    activity: '⛩️',
    stay: '🏨',
    free_time: '☕',
  };
  return emojis[category];
}

export function getDayNumber(tripStart: string, dayDate: string): number {
  const start = new Date(tripStart + 'T00:00:00');
  const day = new Date(dayDate + 'T00:00:00');
  return Math.floor((day.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function reorderArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...arr];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}
