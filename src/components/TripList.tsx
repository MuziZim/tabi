import { useState } from 'react';
import { LogOut, Plus, MapPin, Calendar, MoreVertical } from 'lucide-react';
import type { Trip } from '../lib/types';
import { formatDate } from '../lib/utils';
import { CreateTripModal } from './CreateTripModal';
import { EditTripModal } from './EditTripModal';

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
    currency?: string;
  }) => Promise<Trip | null>;
  onUpdateTrip: (tripId: string, updates: {
    name: string;
    destination?: string;
    cover_emoji?: string;
    currency?: string;
  }) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onSignOut: () => void;
}

export function TripList({ trips, loading, userEmail, onSelectTrip, onCreateTrip, onUpdateTrip, onDeleteTrip, onSignOut }: TripListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

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
                <div
                  key={trip.id}
                  className="bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover
                    transition-all group animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => onSelectTrip(trip.id)}
                      className="text-3xl"
                    >
                      {trip.cover_emoji}
                    </button>
                    <button
                      onClick={() => onSelectTrip(trip.id)}
                      className="flex-1 min-w-0 text-left"
                    >
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
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTrip(trip);
                      }}
                      className="p-1.5 text-sumi-muted/30 hover:text-sumi-muted rounded-lg
                        hover:bg-cream transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                      title="Edit trip"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
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

      {editingTrip && (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onUpdate={onUpdateTrip}
          onDelete={async (tripId) => {
            await onDeleteTrip(tripId);
            setEditingTrip(null);
          }}
        />
      )}
    </div>
  );
}
