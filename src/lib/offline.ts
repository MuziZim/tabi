import { get, set, del, keys } from 'idb-keyval';
import type { TripDay, ItineraryItem } from './types';

const CACHE_PREFIX = 'tabi_';
const QUEUE_KEY = 'tabi_mutation_queue';

// ---- Cached Data ----

export async function cacheTripDays(tripId: string, days: TripDay[]) {
  await set(`${CACHE_PREFIX}days_${tripId}`, days);
}

export async function getCachedTripDays(tripId: string): Promise<TripDay[] | undefined> {
  return get(`${CACHE_PREFIX}days_${tripId}`);
}

export async function cacheItems(dayId: string, items: ItineraryItem[]) {
  await set(`${CACHE_PREFIX}items_${dayId}`, items);
}

export async function getCachedItems(dayId: string): Promise<ItineraryItem[] | undefined> {
  return get(`${CACHE_PREFIX}items_${dayId}`);
}

// ---- Mutation Queue (for offline changes) ----

interface QueuedMutation {
  id: string;
  type: 'insert' | 'update' | 'delete' | 'reorder';
  table: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export async function queueMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) {
  const queue = (await get<QueuedMutation[]>(QUEUE_KEY)) || [];
  queue.push({
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  await set(QUEUE_KEY, queue);
}

export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  return (await get<QueuedMutation[]>(QUEUE_KEY)) || [];
}

export async function clearMutationQueue() {
  await del(QUEUE_KEY);
}

export async function removeMutation(id: string) {
  const queue = (await get<QueuedMutation[]>(QUEUE_KEY)) || [];
  await set(
    QUEUE_KEY,
    queue.filter((m) => m.id !== id)
  );
}

// ---- Connectivity ----

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onConnectivityChange(callback: (online: boolean) => void) {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ---- Cache Cleanup ----

export async function clearAllCache() {
  const allKeys = await keys();
  for (const key of allKeys) {
    if (typeof key === 'string' && key.startsWith(CACHE_PREFIX)) {
      await del(key);
    }
  }
}

// ---- Mutation Queue Flush (sync offline changes when back online) ----

export async function flushMutationQueue(
  supabase: { from: (table: string) => unknown }
): Promise<{ flushed: number; failed: number }> {
  const queue = await getQueuedMutations();
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  for (const mutation of queue) {
    try {
      const table = supabase.from(mutation.table) as Record<string, (...args: unknown[]) => { eq?: (...args: unknown[]) => unknown }>;

      switch (mutation.type) {
        case 'insert': {
          const { error } = await (table.insert as (payload: unknown) => Promise<{ error: unknown }>)(mutation.payload);
          if (error) throw error;
          break;
        }
        case 'update': {
          const { id, ...updates } = mutation.payload;
          const { error } = await (table.update as (updates: unknown) => { eq: (col: string, val: unknown) => Promise<{ error: unknown }> })(updates).eq('id', id);
          if (error) throw error;
          break;
        }
        case 'delete': {
          const { error } = await (table.delete as () => { eq: (col: string, val: unknown) => Promise<{ error: unknown }> })().eq('id', mutation.payload.id);
          if (error) throw error;
          break;
        }
        case 'reorder': {
          const items = mutation.payload.items as Array<{ id: string; sort_order: number }>;
          for (const item of items) {
            await (table.update as (updates: unknown) => { eq: (col: string, val: unknown) => Promise<{ error: unknown }> })({ sort_order: item.sort_order }).eq('id', item.id);
          }
          break;
        }
      }

      await removeMutation(mutation.id);
      flushed++;
    } catch {
      failed++;
      // Leave failed mutations in the queue for next attempt
    }
  }

  return { flushed, failed };
}
