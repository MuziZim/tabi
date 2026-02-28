import { useState } from 'react';
import { LogOut, Plus, MapPin, Calendar } from 'lucide-react';
import type { Trip } from '../lib/types';
import { formatDate } from '../lib/utils';
import { CreateTripModal } from './CreateTripModal';

interface TripListProps {
  trips: Trip[];
  loading: boolean;
  userEmail: string;
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: (trip: {
    name: string;
    destination?: string;
    start_date: string;
    end_date: string;
    cover_emoji?: string;
  }) => Promise<Trip | null>;
  onSignOut: () => void;
}

export function TripList({ trips, loading, userEmail, onSelectTrip, onCreateTrip, onSignOut }: TripListProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-cream-dark sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-sumi">旅 Tabi</h1>
            <p className="text-xs text-sumi-muted">{userEmail}</p>
          </div>
          <button
            onClick={onSignOut}
            className="p-2 text-sumi-muted hover:text-sumi rounded-lg hover:bg-cream transition-colors"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-sumi-muted">Loading trips...</div>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="text-6xl mb-4">🗾</div>
            <h2 className="font-display text-2xl text-sumi mb-2">No trips yet</h2>
            <p className="text-sumi-muted text-sm mb-8">Plan your next adventure</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo text-white rounded-xl
                font-medium text-sm hover:bg-indigo-dark transition-colors"
            >
              <Plus size={18} />
              Create your first trip
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-sumi">Your Trips</h2>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo text-white rounded-lg
                  text-xs font-medium hover:bg-indigo-dark transition-colors"
              >
                <Plus size={14} />
                New trip
              </button>
            </div>

            <div className="space-y-3">
              {trips.map((trip, i) => (
                <button
                  key={trip.id}
                  onClick={() => onSelectTrip(trip.id)}
                  className="w-full bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover
                    transition-all text-left group animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{trip.cover_emoji}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg text-sumi group-hover:text-indigo transition-colors">
                        {trip.name}
                      </h3>
                      {trip.destination && (
                        <div className="flex items-center gap-1 text-sumi-muted text-xs mt-0.5">
                          <MapPin size={12} />
                          {trip.destination}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-sumi-muted text-xs mt-1">
                        <Calendar size={12} />
                        {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
                      </div>
                    </div>
                    <div className="text-sumi-muted/40 group-hover:text-indigo/40 transition-colors text-lg">
                      →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {showCreate && (
        <CreateTripModal
          onClose={() => setShowCreate(false)}
          onCreate={async (trip) => {
            await onCreateTrip(trip);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
