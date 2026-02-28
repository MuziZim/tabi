export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  timezone: string;
  cover_emoji: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: string;
}

export interface TripDay {
  id: string;
  trip_id: string;
  date: string;
  title: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  items?: ItineraryItem[];
}

export type ItemCategory = 'transport' | 'food' | 'activity' | 'stay' | 'free_time';
export type ItemStatus = 'planned' | 'confirmed' | 'done' | 'skipped';

export interface ItineraryItem {
  id: string;
  day_id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: ItemCategory;
  status: ItemStatus;
  sort_order: number;
  notes: string | null;
  cost_estimate: number | null;
  currency: string;
  booking_ref: string | null;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export type NewItineraryItem = Omit<ItineraryItem, 'id' | 'created_at' | 'updated_at'>;

export interface CategoryConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

export const CATEGORIES: Record<ItemCategory, CategoryConfig> = {
  transport: { label: 'Transport', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: 'train' },
  food: { label: 'Food & Drink', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200', icon: 'utensils' },
  activity: { label: 'Activity', color: 'text-indigo', bgColor: 'bg-indigo-faint border-indigo/20', icon: 'compass' },
  stay: { label: 'Accommodation', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: 'bed' },
  free_time: { label: 'Free Time', color: 'text-violet-600', bgColor: 'bg-violet-50 border-violet-200', icon: 'coffee' },
};

export const STATUS_CONFIG: Record<ItemStatus, { label: string; icon: string }> = {
  planned: { label: 'Planned', icon: 'circle-dashed' },
  confirmed: { label: 'Confirmed', icon: 'circle-check' },
  done: { label: 'Done', icon: 'check-circle-2' },
  skipped: { label: 'Skipped', icon: 'circle-x' },
};
