import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Clock, MapPin, ChevronDown, ChevronUp,
  Trash2, CheckCircle2, CircleDashed, CircleCheck, CircleX,
  ExternalLink
} from 'lucide-react';
import type { ItineraryItem, ItemStatus } from '../lib/types';
import { CATEGORIES } from '../lib/types';
import { formatTime24, formatCurrency, getCategoryEmoji, cn } from '../lib/utils';

interface ItemCardProps {
  item: ItineraryItem;
  tripCurrency: string;
  onUpdate: (id: string, updates: Partial<ItineraryItem>) => void;
  onDelete: (id: string) => void;
}

const statusIcons: Record<ItemStatus, typeof CircleDashed> = {
  planned: CircleDashed,
  confirmed: CircleCheck,
  done: CheckCircle2,
  skipped: CircleX,
};

const statusColors: Record<ItemStatus, string> = {
  planned: 'text-sumi-muted',
  confirmed: 'text-indigo',
  done: 'text-bamboo',
  skipped: 'text-sumi-muted/40',
};

const nextStatus: Record<ItemStatus, ItemStatus> = {
  planned: 'confirmed',
  confirmed: 'done',
  done: 'planned',
  skipped: 'planned',
};

export function ItemCard({ item, tripCurrency, onUpdate, onDelete }: ItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cat = CATEGORIES[item.category];
  const StatusIcon = statusIcons[item.status];
  const isDone = item.status === 'done';
  const isSkipped = item.status === 'skipped';

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(item.id, { status: nextStatus[item.status] });
  };

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle !== item.title) {
      onUpdate(item.id, { title: editTitle.trim() });
    } else {
      setEditTitle(item.title);
    }
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white rounded-xl border shadow-card transition-all group',
        isDragging && 'shadow-card-drag z-50 opacity-90 scale-[1.02]',
        isSkipped && 'opacity-50',
        cat.bgColor
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="touch-none p-1 text-sumi-muted/30 hover:text-sumi-muted cursor-grab active:cursor-grabbing
            opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <GripVertical size={16} />
        </button>

        {/* Status toggle */}
        <button
          onClick={handleStatusToggle}
          className={cn('shrink-0 transition-colors', statusColors[item.status])}
          title={`Status: ${item.status}`}
        >
          <StatusIcon size={20} />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">{getCategoryEmoji(item.category)}</span>
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') { setEditTitle(item.title); setEditing(false); }
                }}
                autoFocus
                className="flex-1 text-sm font-medium text-sumi bg-transparent border-b border-indigo
                  focus:outline-none py-0"
              />
            ) : (
              <span
                onClick={() => setEditing(true)}
                className={cn(
                  'text-sm font-medium cursor-text truncate',
                  isDone ? 'text-sumi-muted line-through' : 'text-sumi'
                )}
              >
                {item.title}
              </span>
            )}
          </div>

          {/* Time & location summary */}
          <div className="flex items-center gap-3 mt-0.5">
            {item.start_time && (
              <span className="flex items-center gap-1 text-xs text-sumi-muted">
                <Clock size={10} />
                {formatTime24(item.start_time)}
                {item.end_time && ` – ${formatTime24(item.end_time)}`}
              </span>
            )}
            {item.location_name && (
              <span className="flex items-center gap-1 text-xs text-sumi-muted truncate">
                <MapPin size={10} />
                {item.location_name}
              </span>
            )}
          </div>
        </div>

        {/* Cost & expand */}
        <div className="flex items-center gap-2 shrink-0">
          {item.cost_estimate && (
            <span className="text-xs text-sumi-muted font-medium">
              {formatCurrency(item.cost_estimate, item.currency)}
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-sumi-muted/40 hover:text-sumi-muted transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-cream-dark/50 animate-fade-in">
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
            {/* Time */}
            <label className="block">
              <span className="text-sumi-muted uppercase tracking-wider text-[10px] font-medium">Start</span>
              <input
                type="time"
                value={item.start_time || ''}
                onChange={(e) => onUpdate(item.id, { start_time: e.target.value || null })}
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
                  text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20"
              />
            </label>
            <label className="block">
              <span className="text-sumi-muted uppercase tracking-wider text-[10px] font-medium">End</span>
              <input
                type="time"
                value={item.end_time || ''}
                onChange={(e) => onUpdate(item.id, { end_time: e.target.value || null })}
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
                  text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20"
              />
            </label>

            {/* Location */}
            <label className="block col-span-2">
              <span className="text-sumi-muted uppercase tracking-wider text-[10px] font-medium">Location</span>
              <input
                type="text"
                value={item.location_name || ''}
                onChange={(e) => onUpdate(item.id, { location_name: e.target.value || null })}
                placeholder="Place name"
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
                  text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20"
              />
            </label>

            {/* Category */}
            <label className="block">
              <span className="text-sumi-muted uppercase tracking-wider text-[10px] font-medium">Category</span>
              <select
                value={item.category}
                onChange={(e) => onUpdate(item.id, { category: e.target.value as ItineraryItem['category'] })}
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
                  text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20"
              >
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </label>

            {/* Cost */}
            <label className="block">
              <span className="text-sumi-muted uppercase tracking-wider text-[10px] font-medium">Cost ({tripCurrency})</span>
              <input
                type="number"
                value={item.cost_estimate || ''}
                onChange={(e) => onUpdate(item.id, {
                  cost_estimate: e.target.value ? Number(e.target.value) : null
                })}
                placeholder="0"
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
                  text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20"
              />
            </label>

            {/* Notes */}
            <label className="block col-span-2">
              <span className="text-sumi-muted uppercase tracking-wider text-[10px] font-medium">Notes</span>
              <textarea
                value={item.notes || ''}
                onChange={(e) => onUpdate(item.id, { notes: e.target.value || null })}
                rows={2}
                placeholder="Additional details, booking refs..."
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
                  text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20 resize-none"
              />
            </label>

            {/* Booking ref & URL */}
            <label className="block">
              <span className="text-sumi-muted uppercase tracking-wider text-[10px] font-medium">Booking ref</span>
              <input
                type="text"
                value={item.booking_ref || ''}
                onChange={(e) => onUpdate(item.id, { booking_ref: e.target.value || null })}
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
                  text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20"
              />
            </label>
            <label className="block">
              <span className="text-sumi-muted uppercase tracking-wider text-[10px] font-medium">Link</span>
              <div className="flex gap-1 mt-0.5">
                <input
                  type="url"
                  value={item.url || ''}
                  onChange={(e) => onUpdate(item.id, { url: e.target.value || null })}
                  placeholder="https://..."
                  className="flex-1 px-2 py-1.5 rounded-lg border border-cream-dark bg-cream/30
                    text-sumi text-xs focus:outline-none focus:ring-1 focus:ring-indigo/20"
                />
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-indigo hover:text-indigo-dark"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </label>
          </div>

          {/* Delete */}
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-cream-dark/30">
            <button
              onClick={() => onUpdate(item.id, { status: 'skipped' })}
              className="text-[10px] text-sumi-muted hover:text-sumi transition-colors uppercase tracking-wider"
            >
              Skip
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this item?')) onDelete(item.id);
              }}
              className="flex items-center gap-1 text-[10px] text-vermillion/60 hover:text-vermillion
                transition-colors uppercase tracking-wider"
            >
              <Trash2 size={10} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
