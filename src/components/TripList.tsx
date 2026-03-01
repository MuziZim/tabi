import { useState, useEffect, useRef } from 'react';
import { LogOut, Plus, MapPin, Calendar, MoreVertical, Pencil, Trash2, Copy } from 'lucide-react';
import type { Trip } from '../lib/types';
import { formatDate } from '../lib/utils';
import { CreateTripModal } from './CreateTripModal';
import { EditTripModal } from './EditTripModal';
import { ConfirmDialog } from './ConfirmDialog';

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
    name?: string;
    destination?: string;
    start_date?: string;
    end_date?: string;
    cover_emoji?: string;
    currency?: string;
  }) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onSignOut: () => void;
}

export function TripList({ trips, loading, userEmail, onSelectTrip, onCreateTrip, onUpdateTrip, onDeleteTrip, onSignOut }: TripListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [menuTripId, setMenuTripId] = useState<string | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

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
            onClick={() => setShowSignOutConfirm(true)}
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
                    transition-all group animate-slide-up relative"
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
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuTripId(menuTripId === trip.id ? null : trip.id);
                        }}
                        className="p-2 text-sumi-muted hover:text-sumi rounded-lg
                          hover:bg-cream transition-colors"
                        title="Trip options"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {/* Context menu */}
                      {menuTripId === trip.id && (
                        <TripContextMenu
                          onEdit={() => { setMenuTripId(null); setEditingTrip(trip); }}
                          onDuplicate={() => {
                            setMenuTripId(null);
                            onCreateTrip({
                              name: `${trip.name} (copy)`,
                              destination: trip.destination || undefined,
                              start_date: trip.start_date,
                              end_date: trip.end_date,
                              cover_emoji: trip.cover_emoji,
                              currency: trip.currency,
                            });
                          }}
                          onDelete={() => { setMenuTripId(null); setDeletingTrip(trip); }}
                          onClose={() => setMenuTripId(null)}
                        />
                      )}
                    </div>
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

      {deletingTrip && (
        <ConfirmDialog
          title="Delete trip"
          message={`Permanently delete "${deletingTrip.name}" and all its itinerary items? This can't be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            const tripId = deletingTrip.id;
            setDeletingTrip(null);
            await onDeleteTrip(tripId);
          }}
          onCancel={() => setDeletingTrip(null)}
        />
      )}

      {showSignOutConfirm && (
        <ConfirmDialog
          title="Sign out"
          message="Are you sure you want to sign out? You'll need a new magic link to sign back in."
          confirmLabel="Sign out"
          onConfirm={() => {
            setShowSignOutConfirm(false);
            onSignOut();
          }}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      )}
    </div>
  );
}

// ---- Context Menu ----

function TripContextMenu({
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const itemClass = 'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-cream transition-colors first:rounded-t-lg last:rounded-b-lg';

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-card-hover border border-cream-dark
        z-20 min-w-[140px] animate-fade-in overflow-hidden"
    >
      <button onClick={onEdit} className={itemClass}>
        <Pencil size={14} className="text-sumi-muted" />
        <span className="text-sumi">Edit</span>
      </button>
      <button onClick={onDuplicate} className={itemClass}>
        <Copy size={14} className="text-sumi-muted" />
        <span className="text-sumi">Duplicate</span>
      </button>
      <div className="border-t border-cream-dark" />
      <button onClick={onDelete} className={`${itemClass} hover:!bg-vermillion-faint`}>
        <Trash2 size={14} className="text-vermillion/60" />
        <span className="text-vermillion">Delete</span>
      </button>
    </div>
  );
}
