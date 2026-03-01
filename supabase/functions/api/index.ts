import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- CORS ----

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(data: unknown, status = 200): Response {
  return json({ ok: true, data }, status);
}

function err(message: string, status = 400): Response {
  return json({ ok: false, error: message }, status);
}

// ---- Auth ----

function authenticate(req: Request): boolean {
  const apiKey = Deno.env.get("TABI_API_KEY");
  if (!apiKey) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  return token === apiKey;
}

// ---- Supabase Client ----

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// ---- Helpers (mirrored from MCP server) ----

type SupabaseClient = ReturnType<typeof getSupabase>;

async function getDayByDate(supabase: SupabaseClient, tripId: string, date: string) {
  const { data, error } = await supabase
    .from("trip_days")
    .select("*")
    .eq("trip_id", tripId)
    .eq("date", date)
    .single();
  if (error) throw new Error(`Day not found for date ${date}: ${error.message}`);
  return data;
}

async function getDayByNumber(supabase: SupabaseClient, tripId: string, dayNumber: number) {
  const { data: trip } = await supabase
    .from("trips")
    .select("start_date")
    .eq("id", tripId)
    .single();
  if (!trip) throw new Error("Trip not found");

  const startDate = new Date(trip.start_date + "T00:00:00Z");
  const targetDate = new Date(startDate);
  targetDate.setUTCDate(startDate.getUTCDate() + dayNumber - 1);
  const dateStr = targetDate.toISOString().split("T")[0];

  return getDayByDate(supabase, tripId, dateStr);
}

async function resolveDay(
  supabase: SupabaseClient,
  tripId: string,
  body: { day_number?: number; date?: string },
) {
  if (body.day_number) return getDayByNumber(supabase, tripId, body.day_number);
  if (body.date) return getDayByDate(supabase, tripId, body.date);
  throw new Error("Provide either day_number or date");
}

// ---- Route Matching ----

interface RouteMatch {
  params: Record<string, string>;
}

function matchRoute(
  method: string,
  path: string,
  expectedMethod: string,
  pattern: string,
): RouteMatch | null {
  if (method !== expectedMethod) return null;

  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return { params };
}

// ---- Route Handlers ----

// GET /api/trips
async function handleGetTrips(supabase: SupabaseClient, url: URL): Promise<Response> {
  const tripId = url.searchParams.get("trip_id");

  if (tripId) {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();
    if (error || !data) return err("Trip not found", 404);
    return ok(data);
  }

  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: true });
  if (error) return err(error.message, 500);
  return ok(data);
}

// GET /api/trips/:trip_id/overview
async function handleGetOverview(
  supabase: SupabaseClient,
  tripId: string,
): Promise<Response> {
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();
  if (!trip) return err("Trip not found", 404);

  const { data: days } = await supabase
    .from("trip_days")
    .select("*")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  const daysWithItems = [];
  if (days) {
    for (const day of days) {
      const { data: items } = await supabase
        .from("itinerary_items")
        .select("*")
        .eq("day_id", day.id)
        .order("sort_order", { ascending: true });

      const dayNum =
        Math.floor(
          (new Date(day.date).getTime() -
            new Date(trip.start_date).getTime()) /
            86400000,
        ) + 1;

      daysWithItems.push({
        day_number: dayNum,
        date: day.date,
        title: day.title,
        notes: day.notes,
        items: items || [],
      });
    }
  }

  return ok({
    trip: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
      timezone: trip.timezone,
      currency: trip.currency,
      cover_emoji: trip.cover_emoji,
    },
    days: daysWithItems,
  });
}

// GET /api/trips/:trip_id/days
async function handleGetDays(
  supabase: SupabaseClient,
  tripId: string,
): Promise<Response> {
  const { data: trip } = await supabase
    .from("trips")
    .select("start_date")
    .eq("id", tripId)
    .single();
  if (!trip) return err("Trip not found", 404);

  const { data: days, error } = await supabase
    .from("trip_days")
    .select("*")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  if (error) return err(error.message, 500);

  const result = (days || []).map((day) => {
    const dayNum =
      Math.floor(
        (new Date(day.date).getTime() -
          new Date(trip.start_date).getTime()) /
          86400000,
      ) + 1;
    return { ...day, day_number: dayNum };
  });

  return ok(result);
}

// GET /api/trips/:trip_id/days/:day_number
async function handleGetDay(
  supabase: SupabaseClient,
  tripId: string,
  dayNumber: string,
  url: URL,
): Promise<Response> {
  let day;
  const dateParam = url.searchParams.get("date");

  if (dateParam) {
    day = await getDayByDate(supabase, tripId, dateParam);
  } else {
    const num = parseInt(dayNumber, 10);
    if (isNaN(num)) return err("Invalid day number", 400);
    day = await getDayByNumber(supabase, tripId, num);
  }

  const { data: items } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("day_id", day.id)
    .order("sort_order", { ascending: true });

  return ok({ ...day, items: items || [] });
}

// POST /api/trips/:trip_id/items
async function handleAddItem(
  supabase: SupabaseClient,
  tripId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const day = await resolveDay(supabase, tripId, body as { day_number?: number; date?: string });

  // Get max sort_order
  const { data: existing } = await supabase
    .from("itinerary_items")
    .select("sort_order")
    .eq("day_id", day.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSort = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  // Get trip currency for default
  const { data: tripData } = await supabase
    .from("trips")
    .select("currency")
    .eq("id", tripId)
    .single();

  const newItem: Record<string, unknown> = {
    day_id: day.id,
    title: body.title,
    category: body.category || "activity",
    status: "planned",
    sort_order: nextSort,
    currency: tripData?.currency || "JPY",
  };

  const optionalFields = [
    "start_time", "end_time", "location_name", "location_address",
    "notes", "cost_estimate", "booking_ref", "url",
  ];
  for (const field of optionalFields) {
    if (body[field] !== undefined) newItem[field] = body[field];
  }

  const { data, error } = await supabase
    .from("itinerary_items")
    .insert(newItem)
    .select()
    .single();

  if (error) return err(`Failed to add item: ${error.message}`, 500);
  return ok(data, 201);
}

// PATCH /api/items/:item_id
async function handleUpdateItem(
  supabase: SupabaseClient,
  itemId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const allowedFields = [
    "title", "category", "start_time", "end_time", "location_name",
    "location_address", "notes", "cost_estimate", "booking_ref", "url", "status",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return err("No valid fields to update. Provide at least one field to change.");
  }

  const { data, error } = await supabase
    .from("itinerary_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single();

  if (error) return err(`Failed to update: ${error.message}`, 500);
  return ok(data);
}

// DELETE /api/items/:item_id
async function handleDeleteItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<Response> {
  const { data: item } = await supabase
    .from("itinerary_items")
    .select("title")
    .eq("id", itemId)
    .single();

  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itemId);

  if (error) return err(`Failed to delete: ${error.message}`, 500);
  return ok({ deleted: true, title: item?.title || itemId });
}

// POST /api/items/:item_id/move
async function handleMoveItem(
  supabase: SupabaseClient,
  itemId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const tripId = body.trip_id as string;
  if (!tripId) return err("trip_id is required");

  let targetDay;
  if (body.target_day_number) {
    targetDay = await getDayByNumber(supabase, tripId, body.target_day_number as number);
  } else if (body.target_date) {
    targetDay = await getDayByDate(supabase, tripId, body.target_date as string);
  } else {
    return err("Provide target_day_number or target_date");
  }

  // Get max sort_order in target day
  const { data: existing } = await supabase
    .from("itinerary_items")
    .select("sort_order")
    .eq("day_id", targetDay.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSort = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("itinerary_items")
    .update({ day_id: targetDay.id, sort_order: nextSort })
    .eq("id", itemId)
    .select()
    .single();

  if (error) return err(`Failed to move: ${error.message}`, 500);
  return ok(data);
}

// PATCH /api/items/reorder
async function handleReorderItems(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const itemIds = body.item_ids as string[];
  if (!itemIds || itemIds.length === 0) return err("item_ids array is required");

  for (let i = 0; i < itemIds.length; i++) {
    await supabase
      .from("itinerary_items")
      .update({ sort_order: i })
      .eq("id", itemIds[i]);
  }

  return ok({ reordered: itemIds.length });
}

// GET /api/trips/:trip_id/search
async function handleSearch(
  supabase: SupabaseClient,
  tripId: string,
  url: URL,
): Promise<Response> {
  const { data: days } = await supabase
    .from("trip_days")
    .select("id, date, title")
    .eq("trip_id", tripId);

  if (!days || days.length === 0) return err("No days found for this trip", 404);

  let query = supabase
    .from("itinerary_items")
    .select("*")
    .in("day_id", days.map((d) => d.id));

  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);

  const { data: items, error } = await query.order("sort_order", { ascending: true });
  if (error) return err(`Search failed: ${error.message}`, 500);

  let results = items || [];

  const q = url.searchParams.get("q");
  if (q) {
    const lower = q.toLowerCase();
    results = results.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        (item.notes && item.notes.toLowerCase().includes(lower)) ||
        (item.location_name && item.location_name.toLowerCase().includes(lower)) ||
        (item.booking_ref && item.booking_ref.toLowerCase().includes(lower)),
    );
  }

  const dayMap = new Map(days.map((d) => [d.id, d]));
  const enriched = results.map((item) => {
    const day = dayMap.get(item.day_id);
    return { ...item, day_date: day?.date, day_title: day?.title };
  });

  return ok(enriched);
}

// PATCH /api/trips/:trip_id/days/:day_number
async function handleUpdateDay(
  supabase: SupabaseClient,
  tripId: string,
  dayNumber: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const num = parseInt(dayNumber, 10);
  if (isNaN(num)) return err("Invalid day number", 400);

  const day = await getDayByNumber(supabase, tripId, num);

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.notes !== undefined) updates.notes = body.notes;

  if (Object.keys(updates).length === 0) {
    return err("Provide title or notes to update");
  }

  const { error } = await supabase
    .from("trip_days")
    .update(updates)
    .eq("id", day.id);

  if (error) return err(`Failed to update day: ${error.message}`, 500);
  return ok({ ...day, ...updates });
}

// ---- Main Handler ----

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Authenticate
  if (!authenticate(req)) {
    return err("Unauthorized — provide a valid Bearer token", 401);
  }

  const url = new URL(req.url);
  // Strip the /api prefix from the Edge Function path
  // Edge Functions are mounted at /functions/v1/api, so the full path is /functions/v1/api/...
  // We need to extract the part after /api
  const fullPath = url.pathname;
  const apiIndex = fullPath.indexOf("/api");
  const path = apiIndex !== -1 ? fullPath.slice(apiIndex) : fullPath;
  const method = req.method;

  const supabase = getSupabase();

  try {
    let match: RouteMatch | null;

    // GET /api/trips
    match = matchRoute(method, path, "GET", "/api/trips");
    if (match) return await handleGetTrips(supabase, url);

    // GET /api/trips/:trip_id/overview
    match = matchRoute(method, path, "GET", "/api/trips/:trip_id/overview");
    if (match) return await handleGetOverview(supabase, match.params.trip_id);

    // GET /api/trips/:trip_id/days/:day_number
    match = matchRoute(method, path, "GET", "/api/trips/:trip_id/days/:day_number");
    if (match)
      return await handleGetDay(supabase, match.params.trip_id, match.params.day_number, url);

    // GET /api/trips/:trip_id/days
    match = matchRoute(method, path, "GET", "/api/trips/:trip_id/days");
    if (match) return await handleGetDays(supabase, match.params.trip_id);

    // POST /api/trips/:trip_id/items
    match = matchRoute(method, path, "POST", "/api/trips/:trip_id/items");
    if (match) {
      const body = await req.json();
      return await handleAddItem(supabase, match.params.trip_id, body);
    }

    // GET /api/trips/:trip_id/search
    match = matchRoute(method, path, "GET", "/api/trips/:trip_id/search");
    if (match) return await handleSearch(supabase, match.params.trip_id, url);

    // PATCH /api/trips/:trip_id/days/:day_number
    match = matchRoute(method, path, "PATCH", "/api/trips/:trip_id/days/:day_number");
    if (match) {
      const body = await req.json();
      return await handleUpdateDay(supabase, match.params.trip_id, match.params.day_number, body);
    }

    // PATCH /api/items/reorder  (must be before /api/items/:item_id to avoid matching "reorder" as item_id)
    match = matchRoute(method, path, "PATCH", "/api/items/reorder");
    if (match) {
      const body = await req.json();
      return await handleReorderItems(supabase, body);
    }

    // PATCH /api/items/:item_id
    match = matchRoute(method, path, "PATCH", "/api/items/:item_id");
    if (match) {
      const body = await req.json();
      return await handleUpdateItem(supabase, match.params.item_id, body);
    }

    // DELETE /api/items/:item_id
    match = matchRoute(method, path, "DELETE", "/api/items/:item_id");
    if (match) return await handleDeleteItem(supabase, match.params.item_id);

    // POST /api/items/:item_id/move
    match = matchRoute(method, path, "POST", "/api/items/:item_id/move");
    if (match) {
      const body = await req.json();
      return await handleMoveItem(supabase, match.params.item_id, body);
    }

    return err("Not found", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(message, 500);
  }
});
