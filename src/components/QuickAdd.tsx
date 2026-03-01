import { useState, useRef, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import type { ItemCategory } from '../lib/types';
import { CATEGORIES } from '../lib/types';
import { getCategoryEmoji } from '../lib/utils';

interface QuickAddProps {
  onAdd: (item: {
    title: string;
    category: ItemCategory;
    start_time?: string | null;
    location_name?: string | null;
  }) => void;
}

export function QuickAdd({ onAdd }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory>('activity');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      category,
      start_time: time || null,
      location_name: location || null,
    });
    // Keep form open — just reset fields for quick batch entry
    setTitle('');
    setTime('');
    setLocation('');
    // Re-focus the title input for the next item
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-cream-dark
          text-sumi-muted text-sm flex items-center justify-center gap-2
          hover:border-indigo/30 hover:text-indigo transition-colors"
      >
        <Plus size={16} />
        Add item
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-indigo/20 shadow-card p-3 animate-fade-in"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-sumi flex-1">New item</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1 text-sumi-muted hover:text-sumi"
        >
          <X size={14} />
        </button>
      </div>

      {/* Title */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's happening?"
        autoFocus
        className="w-full px-3 py-2 rounded-lg border border-cream-dark bg-cream/30
          text-sumi text-sm focus:outline-none focus:ring-2 focus:ring-indigo/20 focus:border-indigo mb-2"
      />

      {/* Category pills */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {(Object.keys(CATEGORIES) as ItemCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all
              ${category === cat
                ? 'bg-indigo text-white'
                : 'bg-cream text-sumi-muted hover:bg-cream-dark'
              }`}
          >
            {getCategoryEmoji(cat)} {CATEGORIES[cat].label}
          </button>
        ))}
      </div>

      {/* Time & Location row */}
      <div className="flex gap-2 mb-3">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
            text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20 w-28"
          placeholder="Time"
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          className="flex-1 px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
            text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="flex-1 py-2 rounded-lg bg-indigo text-white text-xs font-medium
            hover:bg-indigo-dark transition-colors disabled:opacity-40"
        >
          Add to itinerary
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); setTime(''); setLocation(''); }}
          className="px-3 py-2 rounded-lg border border-cream-dark text-xs font-medium
            text-sumi-muted hover:text-sumi hover:bg-cream transition-colors"
        >
          Done
        </button>
      </div>
    </form>
  );
}
