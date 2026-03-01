import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTrips } from './hooks/useTrip';
import { supabase } from './lib/supabase';
import { flushMutationQueue, onConnectivityChange } from './lib/offline';
import type { Trip } from './lib/types';
import { AuthScreen } from './components/AuthScreen';
import { TripList } from './components/TripList';
import { TripView } from './components/TripView';

export default function App() {
  const { user, loading: authLoading, signInWithMagicLink, signOut } = useAuth();
  const { trips, loading: tripsLoading, createTrip, updateTrip, deleteTrip } = useTrips(user?.id);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Flush offline mutation queue when connectivity returns
  useEffect(() => {
    return onConnectivityChange(async (online) => {
      if (online) {
        const { flushed, failed } = await flushMutationQueue(supabase as never);
        if (flushed > 0) {
          console.log(`Synced ${flushed} offline change(s)${failed > 0 ? `, ${failed} failed` : ''}`);
        }
      }
    });
  }, []);

  // Load selected trip details
  useEffect(() => {
    if (!selectedTripId) {
      setSelectedTrip(null);
      return;
    }
    const trip = trips.find((t) => t.id === selectedTripId);
    if (trip) {
      setSelectedTrip(trip);
    } else {
      // Fetch from DB if not in list yet (e.g. after creation)
      supabase
        .from('trips')
        .select('*')
        .eq('id', selectedTripId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedTrip(data);
        });
    }
  }, [selectedTripId, trips]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⛩️</div>
          <p className="text-sm text-sumi-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth screen
  if (!user) {
    return <AuthScreen onSignIn={signInWithMagicLink} />;
  }

  // Trip view
  if (selectedTrip) {
    return (
      <TripView
        trip={selectedTrip}
        onBack={() => setSelectedTripId(null)}
      />
    );
  }

  // Trip list
  return (
    <TripList
      trips={trips}
      loading={tripsLoading}
      userEmail={user.email || ''}
      onSelectTrip={setSelectedTripId}
      onCreateTrip={createTrip}
      onUpdateTrip={updateTrip}
      onDeleteTrip={async (tripId) => {
        await deleteTrip(tripId);
        setSelectedTripId(null);
      }}
      onSignOut={signOut}
    />
  );
}
