import { useState, useEffect, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { COMMON_CURRENCIES } from '../lib/types';
import { formatErrorMessage } from '../lib/errors';

interface CreateTripModalProps {
  onClose: () => void;
  onCreate: (trip: {
    name: string;
    destination?: string;
    start_date: string;
    end_date: string;
    cover_emoji?: string;
    currency?: string;
  }) => Promise<void>;
}

const EMOJI_OPTIONS = ['✈️', '🗾', '⛩️', '🏯', '🌸', '🎌', '🗻', '🚄', '🍣', '🎎'];

export function CreateTripModal({ onClose, onCreate }: CreateTripModalProps) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [emoji, setEmoji] = useState('⛩️');
  const [currency, setCurrency] = useState('JPY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate dates
    if (endDate < startDate) {
      setError('End date must be on or after start date.');
      return;
    }

    setLoading(true);
    try {
      await onCreate({
        name,
        destination: destination || undefined,
        start_date: startDate,
        end_date: endDate,
        cover_emoji: emoji,
        currency,
      });
    } catch (err) {
      const message = formatErrorMessage(err);
      console.error('Create trip error:', err);
      setError(`Failed to create trip: ${message}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-sumi/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-sumi">New Trip</h2>
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
              placeholder="Japan Adventure 2026"
              required
              className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-cream-dark bg-cream/50
                text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
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
            <label className="block">
              <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">Destination</span>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Japan"
                className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-cream-dark bg-cream/50
                  text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // Auto-clear end date if it's now before start date
                  if (endDate && e.target.value > endDate) {
                    setEndDate('');
                  }
                }}
                required
                className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-cream-dark bg-cream/50
                  text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
                className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-cream-dark bg-cream/50
                  text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
              />
            </label>
          </div>

          {error && (
            <p className="text-vermillion text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name || !startDate || !endDate}
            className="w-full py-3 px-4 rounded-xl bg-indigo text-white font-medium text-sm
              hover:bg-indigo-dark transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating...' : 'Create Trip'}
          </button>
        </form>
      </div>
    </div>
  );
}
