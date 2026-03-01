import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar,
  WifiOff, Users, Pencil, Check, X
} from 'lucide-react';
import type { Trip, TripDay, ItemCategory } from '../lib/types';
import { useTripDays, useItems } from '../hooks/useTrip';
import { formatDate, formatDateLong, getDayNumber, formatCurrency, getCategoryEmoji, reorderArray } from '../lib/utils';
import { isOnline } from '../lib/offline';
import { ItemCard } from './ItemCard';
import { QuickAdd } from './QuickAdd';
import { ShareModal } from './ShareModal';

interface TripViewProps {
  trip: Trip;
  onBack: () => void;
}

export function TripView({ trip, onBack }: TripViewProps) {
  const { days, loading: daysLoading, updateDay } = useTripDays(trip.id);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [online, setOnline] = useState(isOnline());
  const [showShare, setShowShare] = useState(false);

  // Track connectivity
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const currentDay = days[selectedDayIndex];

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-cream-dark sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 text-sumi-muted hover:text-sumi rounded-lg hover:bg-cream transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-lg text-sumi truncate">
                {trip.cover_emoji} {trip.name}
              </h1>
              <p className="text-[11px] text-sumi-muted">
                {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!online && (
                <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <WifiOff size={10} />
                  Offline
                </span>
              )}
              <button
                onClick={() => setShowShare(true)}
                className="p-2 text-sumi-muted hover:text-indigo rounded-lg hover:bg-cream transition-colors"
                title="Trip members"
              >
                <Users size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Day navigation */}
        {days.length > 0 && (
          <DayNav
            days={days}
            tripStart={trip.start_date}
            selectedIndex={selectedDayIndex}
            onSelect={setSelectedDayIndex}
          />
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        {daysLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-sumi-muted text-sm">Loading itinerary...</div>
          </div>
        ) : currentDay ? (
          <DayContent
            day={currentDay}
            tripStart={trip.start_date}
            tripCurrency={trip.currency || 'JPY'}
            onUpdateDay={updateDay}
          />
        ) : (
          <div className="text-center py-20 text-sumi-muted text-sm">
            No days found
          </div>
        )}
      </main>

      {showShare && (
        <ShareModal
          tripId={trip.id}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

// ---- Day Navigation ----

function DayNav({
  days,
  tripStart,
  selectedIndex,
  onSelect,
}: {
  days: TripDay[];
  tripStart: string;
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex items-center border-t border-cream-dark/50">
      <button
        onClick={() => onSelect(Math.max(0, selectedIndex - 1))}
        disabled={selectedIndex === 0}
        className="p-2 text-sumi-muted hover:text-sumi disabled:opacity-20 shrink-0"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 px-1 py-2">
          {days.map((day, i) => {
            const dayNum = getDayNumber(tripStart, day.date);
            const isSelected = i === selectedIndex;
            return (
              <button
                key={day.id}
                onClick={() => onSelect(i)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${isSelected
                    ? 'bg-indigo text-white shadow-sm'
                    : 'text-sumi-muted hover:bg-cream-dark hover:text-sumi'
                  }`}
              >
                <div className="text-[10px] opacity-70">Day {dayNum}</div>
                <div>{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onSelect(Math.min(days.length - 1, selectedIndex + 1))}
        disabled={selectedIndex === days.length - 1}
        className="p-2 text-sumi-muted hover:text-sumi disabled:opacity-20 shrink-0"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ---- Day Content with Drag & Drop ----

function DayContent({
  day,
  tripStart,
  tripCurrency,
  onUpdateDay,
}: {
  day: TripDay;
  tripStart: string;
  tripCurrency: string;
  onUpdateDay: (dayId: string, updates: Partial<TripDay>) => Promise<void>;
}) {
  const { items, loading, addItem, updateItem, deleteItem, reorderItems } = useItems(day.id);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(day.title || '');

  // Sync title draft when day changes
  useEffect(() => {
    setTitleDraft(day.title || '');
    setEditingTitle(false);
  }, [day.id, day.title]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = reorderArray(items, oldIndex, newIndex);
      reorderItems(reordered);
    },
    [items, reorderItems]
  );

  const handleAddItem = useCallback(
    async (item: {
      title: string;
      category: ItemCategory;
      start_time?: string | null;
      location_name?: string | null;
    }) => {
      await addItem({ ...item, currency: tripCurrency });
    },
    [addItem, tripCurrency]
  );

  const handleTitleSave = async () => {
    const newTitle = titleDraft.trim() || null;
    if (newTitle !== day.title) {
      await onUpdateDay(day.id, { title: newTitle });
    }
    setEditingTitle(false);
  };

  // Daily cost summary
  const totalCost = useMemo(
    () => items.reduce((sum, item) => sum + (item.cost_estimate || 0), 0),
    [items]
  );

  const dayNum = getDayNumber(tripStart, day.date);

  return (
    <div className="animate-fade-in">
      {/* Day header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-0.5">
          <Calendar size={14} className="text-indigo" />
          <span className="text-xs font-medium text-indigo uppercase tracking-wider">
            Day {dayNum}
          </span>
        </div>

        {/* Editable day title */}
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') { setTitleDraft(day.title || ''); setEditingTitle(false); }
              }}
              placeholder={formatDateLong(day.date)}
              autoFocus
              className="font-display text-xl text-sumi bg-transparent border-b-2 border-indigo
                focus:outline-none flex-1 py-0"
            />
            <button onClick={handleTitleSave} className="p-1 text-bamboo hover:text-bamboo-light">
              <Check size={18} />
            </button>
            <button onClick={() => { setTitleDraft(day.title || ''); setEditingTitle(false); }}
              className="p-1 text-sumi-muted hover:text-sumi">
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group/title">
            <h2 className="font-display text-xl text-sumi">
              {day.title || formatDateLong(day.date)}
            </h2>
            <button
              onClick={() => setEditingTitle(true)}
              className="p-1 text-sumi-muted/30 hover:text-sumi-muted sm:opacity-0 sm:group-hover/title:opacity-100 transition-opacity"
              title="Edit day title"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}

        <p className="text-xs text-sumi-muted mt-0.5">{formatDateLong(day.date)}</p>
      </div>

      {/* Items */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    tripCurrency={tripCurrency}
                    onUpdate={updateItem}
                    onDelete={deleteItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {items.length === 0 && (
            <div className="text-center py-10 text-sumi-muted/60">
              <div className="text-3xl mb-2">📍</div>
              <p className="text-sm mb-1">No plans yet for this day</p>
              <p className="text-xs text-sumi-muted/40">
                Tap "Add item" below to add {getCategoryEmoji('activity')} activities, {getCategoryEmoji('food')} meals, {getCategoryEmoji('transport')} transport, and more
              </p>
            </div>
          )}

          {/* Add item */}
          <div className="mt-3">
            <QuickAdd onAdd={handleAddItem} />
          </div>

          {/* Day summary */}
          {totalCost > 0 && (
            <div className="mt-4 pt-3 border-t border-cream-dark/50 flex justify-between items-center">
              <span className="text-xs text-sumi-muted">Estimated cost</span>
              <span className="text-sm font-medium text-sumi">
                {formatCurrency(totalCost, tripCurrency)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
