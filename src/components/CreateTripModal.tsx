import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

interface CreateTripModalProps {
  onClose: () => void;
  onCreate: (trip: {
    name: string;
    destination?: string;
    start_date: string;
    end_date: string;
    cover_emoji?: string;
  }) => Promise<void>;
}

const EMOJI_OPTIONS = ['✈️', '🗾', '⛩️', '🏯', '🌸', '🎌', '🗻', '🚄', '🍣', '🎎'];

export function CreateTripModal({ onClose, onCreate }: CreateTripModalProps) {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('Japan');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [emoji, setEmoji] = useState('⛩️');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onCreate({
      name,
      destination: destination || undefined,
      start_date: startDate,
      end_date: endDate,
      cover_emoji: emoji,
    });
    setLoading(false);
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-sumi-light uppercase tracking-wider">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
