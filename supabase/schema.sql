-- ============================================
-- TABI — Travel Companion Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Trips
create table public.trips (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  destination text,
  start_date date not null,
  end_date date not null,
  timezone text not null default 'Asia/Tokyo',
  cover_emoji text default '✈️',
  currency text not null default 'JPY',
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trip members (sharing)
create table public.trip_members (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz default now(),
  unique(trip_id, user_id)
);

-- Days within a trip
create table public.trip_days (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  date date not null,
  title text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(trip_id, date)
);

-- Itinerary items
create table public.itinerary_items (
  id uuid default uuid_generate_v4() primary key,
  day_id uuid references public.trip_days(id) on delete cascade not null,
  title text not null,
  description text,
  start_time time,
  end_time time,
  location_name text,
  location_address text,
  latitude decimal(10, 7),
  longitude decimal(10, 7),
  category text not null default 'activity'
    check (category in ('transport', 'food', 'activity', 'stay', 'free_time')),
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'done', 'skipped')),
  sort_order integer not null default 0,
  notes text,
  cost_estimate decimal(12, 2),
  currency text default 'JPY',
  booking_ref text,
  url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_trip_members_user on public.trip_members(user_id);
create index idx_trip_members_trip on public.trip_members(trip_id);
create index idx_trip_days_trip on public.trip_days(trip_id);
create index idx_trip_days_date on public.trip_days(date);
create index idx_items_day on public.itinerary_items(day_id);
create index idx_items_sort on public.itinerary_items(day_id, sort_order);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trips_updated_at
  before update on public.trips
  for each row execute procedure public.handle_updated_at();

create trigger trip_days_updated_at
  before update on public.trip_days
  for each row execute procedure public.handle_updated_at();

create trigger items_updated_at
  before update on public.itinerary_items
  for each row execute procedure public.handle_updated_at();

-- ============================================
-- AUTO-CREATE TRIP MEMBER ON TRIP CREATION
-- ============================================

create or replace function public.handle_new_trip()
returns trigger as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_trip_created
  after insert on public.trips
  for each row execute procedure public.handle_new_trip();

-- ============================================
-- AUTO-GENERATE DAYS WHEN TRIP IS CREATED
-- ============================================

create or replace function public.generate_trip_days()
returns trigger as $$
declare
  d date;
  i integer := 0;
begin
  d := new.start_date;
  while d <= new.end_date loop
    insert into public.trip_days (trip_id, date, title, sort_order)
    values (new.id, d, 'Day ' || (i + 1), i);
    d := d + 1;
    i := i + 1;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_trip_created_generate_days
  after insert on public.trips
  for each row execute procedure public.generate_trip_days();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_days enable row level security;
alter table public.itinerary_items enable row level security;

-- Trips: users can see trips they're a member of
create policy "Users can view their trips"
  on public.trips for select
  using (
    id in (
      select trip_id from public.trip_members
      where user_id = auth.uid()
    )
  );

create policy "Users can create trips"
  on public.trips for insert
  with check (created_by = auth.uid());

create policy "Members can update trips"
  on public.trips for update
  using (
    id in (
      select trip_id from public.trip_members
      where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

create policy "Owners can delete trips"
  on public.trips for delete
  using (
    id in (
      select trip_id from public.trip_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Trip Members: users can see members of their trips
create policy "Users can view trip members"
  on public.trip_members for select
  using (
    trip_id in (
      select trip_id from public.trip_members
      where user_id = auth.uid()
    )
  );

create policy "Owners can manage members"
  on public.trip_members for insert
  with check (
    trip_id in (
      select trip_id from public.trip_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "Owners can remove members"
  on public.trip_members for delete
  using (
    trip_id in (
      select trip_id from public.trip_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Trip Days: visible to trip members
create policy "Members can view days"
  on public.trip_days for select
  using (
    trip_id in (
      select trip_id from public.trip_members
      where user_id = auth.uid()
    )
  );

create policy "Editors can manage days"
  on public.trip_days for all
  using (
    trip_id in (
      select trip_id from public.trip_members
      where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

-- Itinerary Items: visible to trip members via day → trip chain
create policy "Members can view items"
  on public.itinerary_items for select
  using (
    day_id in (
      select td.id from public.trip_days td
      join public.trip_members tm on tm.trip_id = td.trip_id
      where tm.user_id = auth.uid()
    )
  );

create policy "Editors can manage items"
  on public.itinerary_items for all
  using (
    day_id in (
      select td.id from public.trip_days td
      join public.trip_members tm on tm.trip_id = td.trip_id
      where tm.user_id = auth.uid() and tm.role in ('owner', 'editor')
    )
  );

-- ============================================
-- REALTIME
-- ============================================

-- Enable realtime for itinerary changes
alter publication supabase_realtime add table public.itinerary_items;
alter publication supabase_realtime add table public.trip_days;

-- ============================================
-- SERVICE ROLE API KEY ACCESS (for MCP server)
-- ============================================
-- The MCP server uses the service_role key which bypasses RLS.
-- This is intentional — the MCP server authenticates via API key
-- and is trusted to access trip data.
-- Keep the service_role key SECRET. Never expose it in the frontend.

-- ============================================
-- MIGRATIONS (run manually if upgrading)
-- ============================================

-- v1.1: Add currency to trips (default JPY for existing trips)
-- ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'JPY';
