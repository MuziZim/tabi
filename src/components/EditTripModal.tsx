import { useState, type FormEvent } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Trip } from '../lib/types';
import { COMMON_CURRENCIES } from '../lib/types';

interface EditTripModalProps {
  trip: Trip;
  onClose: () => void;
  onUpdate: (tripId: string, updates: {
    name: string;
    destination?: string;
    cover_emoji?: string;
    currency?: string;
  }) => Promise<void>;
  onDelete: (tripId: string) => Promise<void>;
}

const EMOJI_OPTIONS = ['✈️', '🗾', '⛩️', '🏯', '🌸', '🎌', '🗻', '🚄', '🍣', '🎎'];

export function EditTripModal({ trip, onClose, onUpdate, onDelete }: EditTripModalProps) {
  const [name, setName] = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination || '');
  const [emoji, setEmoji] = useState(trip.cover_emoji);
  const [currency, setCurrency] = useState(trip.currency || 'JPY');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onUpdate(trip.id, {
      name,
      destination: destination || undefined,
      cover_emoji: emoji,
      currency,
    });
    setLoading(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    await onDelete(trip.id);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-sumi/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-sumi">Edit Trip</h2>
          <button onClick={onClose} className="p-1.5 text-sumi-muted hover:text-sumi rounded-lg hover:bg-cream">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Emoji picker */}
          <div>
            <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">Icon</span>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all
                    ${emoji === e ? 'bg-indigo-faint ring-2 ring-indigo scale-110' : 'bg-cream hover:bg-cream-dark'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">Trip name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-cream-dark bg-cream/50
                text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">Destination</span>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-cream-dark bg-cream/50
                text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-cream-dark bg-cream/50
                text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !name}
              className="flex-1 py-3 px-4 rounded-xl bg-indigo text-white font-medium text-sm
                hover:bg-indigo-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Delete section */}
        <div className="mt-6 pt-4 border-t border-cream-dark">
          <button
            onClick={handleDelete}
            disabled={loading}
            className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-all
              ${confirmDelete
                ? 'bg-vermillion text-white hover:bg-vermillion/90'
                : 'text-vermillion/60 hover:text-vermillion hover:bg-vermillion-faint'
              } disabled:opacity-50`}
          >
            <span className="flex items-center justify-center gap-2">
              <Trash2 size={14} />
              {confirmDelete ? 'Tap again to permanently delete' : 'Delete trip'}
            </span>
          </button>
          {confirmDelete && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="w-full mt-2 text-xs text-sumi-muted hover:text-sumi text-center py-1"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
