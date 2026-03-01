import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { cacheTripDays, getCachedTripDays, cacheItems, getCachedItems } from '../lib/offline';
import type { Trip, TripDay, ItineraryItem, NewItineraryItem } from '../lib/types';

export function useTrips(userId: string | undefined) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('trips')
      .select('*')
      .order('start_date', { ascending: true });
    if (fetchError) {
      setError('Failed to load trips. Pull down to retry.');
      console.error('fetchTrips error:', fetchError);
    }
    if (data) setTrips(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const createTrip = async (trip: {
    name: string;
    destination?: string;
    start_date: string;
    end_date: string;
    timezone?: string;
    cover_emoji?: string;
    currency?: string;
  }) => {
    if (!userId) return null;

    // Insert without .select().single() — the trips SELECT RLS policy
    // depends on trip_members, which is populated by an AFTER INSERT
    // trigger. PostgREST's RETURNING may not see the trigger's side
    // effects, causing .single() to error on an empty result.
    const { error: insertError } = await supabase
      .from('trips')
      .insert({ ...trip, created_by: userId });
    if (insertError) throw insertError;

    // Fetch the newly created trip in a separate query, which runs
    // after the trigger has committed the trip_members row.
    const { data, error: fetchError } = await supabase
      .from('trips')
      .select('*')
      .eq('created_by', userId)
      .eq('name', trip.name)
      .eq('start_date', trip.start_date)
      .eq('end_date', trip.end_date)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (fetchError) throw fetchError;
    if (data) setTrips((prev) => [...prev, data]);
    return data;
  };

  const updateTrip = async (tripId: string, updates: {
    name?: string;
    destination?: string;
    start_date?: string;
    end_date?: string;
    cover_emoji?: string;
    currency?: string;
  }) => {
    const { error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', tripId);
    if (error) throw error;
    setTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, ...updates } : t))
    );
  };

  const deleteTrip = async (tripId: string) => {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId);
    if (error) throw error;
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  };

  return { trips, loading, error, createTrip, updateTrip, deleteTrip, refreshTrips: fetchTrips };
}

export function useTripDays(tripId: string | undefined) {
  const [days, setDays] = useState<TripDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDays = useCallback(async () => {
    if (!tripId) return;

    // Try cache first
    const cached = await getCachedTripDays(tripId);
    if (cached) {
      setDays(cached);
      setLoading(false);
    }

    // Fetch from server
    const { data, error } = await supabase
      .from('trip_days')
      .select('*')
      .eq('trip_id', tripId)
      .order('date', { ascending: true });

    if (error) {
      console.error('fetchDays error:', error);
    }
    if (data) {
      setDays(data);
      await cacheTripDays(tripId, data);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchDays();
  }, [fetchDays]);

  // Real-time subscription for day changes
  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel(`trip_days:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_days',
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          fetchDays();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, fetchDays]);

  const updateDay = async (dayId: string, updates: Partial<TripDay>) => {
    const { error } = await supabase
      .from('trip_days')
      .update(updates)
      .eq('id', dayId);
    if (error) throw error;
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, ...updates } : d))
    );
  };

  return { days, loading, updateDay, refreshDays: fetchDays };
}

export function useItems(dayId: string | undefined) {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!dayId) return;

    const cached = await getCachedItems(dayId);
    if (cached) {
      setItems(cached);
      setLoading(false);
    }

    const { data, error } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('day_id', dayId)
      .order('sort_order', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('fetchItems error:', error);
    }
    if (data) {
      setItems(data);
      await cacheItems(dayId, data);
    }
    setLoading(false);
  }, [dayId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Real-time subscription for item changes
  useEffect(() => {
    if (!dayId) return;

    const channel = supabase
      .channel(`items:${dayId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'itinerary_items',
          filter: `day_id=eq.${dayId}`,
        },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dayId, fetchItems]);

  const addItem = async (item: Partial<NewItineraryItem>) => {
    const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    const newItem = {
      day_id: dayId,
      title: item.title || 'New Item',
      category: item.category || 'activity',
      status: item.status || 'planned',
      sort_order: item.sort_order ?? maxSort,
      currency: item.currency || 'JPY',
      ...item,
    };

    const { data, error } = await supabase
      .from('itinerary_items')
      .insert(newItem)
      .select()
      .single();

    if (error) throw error;
    if (data) setItems((prev) => [...prev, data].sort((a, b) => a.sort_order - b.sort_order));
    return data;
  };

  const updateItem = async (itemId: string, updates: Partial<ItineraryItem>) => {
    const { error } = await supabase
      .from('itinerary_items')
      .update(updates)
      .eq('id', itemId);
    if (error) throw error;
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    );
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const reorderItems = async (reordered: ItineraryItem[]) => {
    const updates = reordered.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));

    // Optimistic update
    setItems(reordered.map((item, index) => ({ ...item, sort_order: index })));

    // Persist
    for (const update of updates) {
      await supabase
        .from('itinerary_items')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id);
    }
  };

  return { items, loading, addItem, updateItem, deleteItem, reorderItems, refreshItems: fetchItems };
}
