#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ---- Configuration ----

// Load .env file manually (no dotenv dependency needed)
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_TRIP_ID = process.env.DEFAULT_TRIP_ID || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- Helper Functions ----

async function getTripId(providedId?: string): Promise<string> {
  const tripId = providedId || DEFAULT_TRIP_ID;
  if (!tripId) {
    throw new Error('No trip_id provided and no DEFAULT_TRIP_ID configured. Please specify a trip_id.');
  }
  return tripId;
}

async function getDayByDate(tripId: string, date: string) {
  const { data, error } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .eq('date', date)
    .single();
  if (error) throw new Error(`Day not found for date ${date}: ${error.message}`);
  return data;
}

async function getDayByNumber(tripId: string, dayNumber: number) {
  const { data: trip } = await supabase
    .from('trips')
    .select('start_date')
    .eq('id', tripId)
    .single();
  if (!trip) throw new Error('Trip not found');

  const startDate = new Date(trip.start_date + 'T00:00:00Z');
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + dayNumber - 1);
  const dateStr = targetDate.toISOString().split('T')[0];

  return getDayByDate(tripId, dateStr);
}

function formatItemForDisplay(item: Record<string, unknown>): string {
  const parts = [];
  if (item.start_time) {
    const t = (item.start_time as string).substring(0, 5);
    parts.push(t);
  }
  parts.push(item.title as string);
  if (item.location_name) parts.push(`@ ${item.location_name}`);
  if (item.status !== 'planned') parts.push(`[${item.status}]`);
  if (item.cost_estimate) {
    const currency = (item.currency as string) || 'JPY';
    parts.push(`${currency} ${item.cost_estimate}`);
  }
  return parts.join(' — ');
}

// ---- MCP Server ----

const server = new Server(
  {
    name: 'tabi-travel',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ---- Resources (read-only views) ----

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [];

  if (DEFAULT_TRIP_ID) {
    resources.push({
      uri: `tabi://trip/${DEFAULT_TRIP_ID}/overview`,
      name: 'Trip Overview',
      description: 'Full overview of the current trip with all days and items',
      mimeType: 'text/plain',
    });
  }

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^tabi:\/\/trip\/([^/]+)\/overview$/);
  if (!match) throw new Error(`Unknown resource: ${uri}`);

  const tripId = match[1];

  const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
  if (!trip) throw new Error('Trip not found');

  const { data: days } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('date', { ascending: true });

  let text = `# ${trip.cover_emoji} ${trip.name}\n`;
  text += `📍 ${trip.destination || 'Unknown'}\n`;
  text += `📅 ${trip.start_date} → ${trip.end_date}\n\n`;

  if (days) {
    for (const day of days) {
      const { data: items } = await supabase
        .from('itinerary_items')
        .select('*')
        .eq('day_id', day.id)
        .order('sort_order', { ascending: true });

      const dayNum = Math.floor(
        (new Date(day.date).getTime() - new Date(trip.start_date).getTime()) / 86400000
      ) + 1;

      text += `## Day ${dayNum} — ${day.date} ${day.title ? `(${day.title})` : ''}\n`;

      if (items && items.length > 0) {
        for (const item of items) {
          text += `  ${formatItemForDisplay(item)}\n`;
        }
      } else {
        text += `  (no items planned)\n`;
      }
      text += '\n';
    }
  }

  return {
    contents: [{ uri, mimeType: 'text/plain', text }],
  };
});

// ---- Tools ----

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_trip_overview',
      description:
        'Get a high-level overview of the trip showing all days and their items. ' +
        'Use this to understand the full itinerary structure.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          trip_id: { type: 'string', description: 'Trip ID (optional if DEFAULT_TRIP_ID is set)' },
        },
      },
    },
    {
      name: 'get_day_details',
      description:
        'Get detailed information about a specific day including all itinerary items. ' +
        'Specify either a day_number (1-based) or a date (YYYY-MM-DD).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          trip_id: { type: 'string', description: 'Trip ID (optional if DEFAULT_TRIP_ID is set)' },
          day_number: { type: 'number', description: 'Day number (1 = first day of trip)' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        },
      },
    },
    {
      name: 'add_item',
      description:
        'Add a new item to the itinerary. Specify the day by day_number or date. ' +
        'Categories: transport, food, activity, stay, free_time. ' +
        'Time format: HH:MM (24hr). Example: "Add lunch at Ichiran Ramen at 12:30 on Day 3"',
      inputSchema: {
        type: 'object' as const,
        properties: {
          trip_id: { type: 'string' },
          day_number: { type: 'number', description: 'Day number (1-based)' },
          date: { type: 'string', description: 'Date YYYY-MM-DD (alternative to day_number)' },
          title: { type: 'string', description: 'Item title (required)' },
          category: {
            type: 'string',
            enum: ['transport', 'food', 'activity', 'stay', 'free_time'],
            description: 'Item category (default: activity)',
          },
          start_time: { type: 'string', description: 'Start time in HH:MM format' },
          end_time: { type: 'string', description: 'End time in HH:MM format' },
          location_name: { type: 'string', description: 'Location/venue name' },
          location_address: { type: 'string', description: 'Full address' },
          notes: { type: 'string', description: 'Additional notes' },
          cost_estimate: { type: 'number', description: 'Estimated cost in JPY' },
          booking_ref: { type: 'string', description: 'Booking reference number' },
          url: { type: 'string', description: 'Related URL' },
        },
        required: ['title'],
      },
    },
    {
      name: 'update_item',
      description:
        'Update an existing itinerary item. Find the item first using get_day_details, ' +
        'then provide its ID and the fields to change. ' +
        'Example: "Move dinner to 19:00" → update start_time to "19:00"',
      inputSchema: {
        type: 'object' as const,
        properties: {
          item_id: { type: 'string', description: 'Item ID (required)' },
          title: { type: 'string' },
          category: {
            type: 'string',
            enum: ['transport', 'food', 'activity', 'stay', 'free_time'],
          },
          start_time: { type: 'string', description: 'HH:MM format, or null to clear' },
          end_time: { type: 'string', description: 'HH:MM format, or null to clear' },
          location_name: { type: 'string' },
          location_address: { type: 'string' },
          notes: { type: 'string' },
          cost_estimate: { type: 'number' },
          booking_ref: { type: 'string' },
          url: { type: 'string' },
          status: {
            type: 'string',
            enum: ['planned', 'confirmed', 'done', 'skipped'],
          },
        },
        required: ['item_id'],
      },
    },
    {
      name: 'delete_item',
      description: 'Delete an itinerary item by its ID.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          item_id: { type: 'string', description: 'Item ID to delete (required)' },
        },
        required: ['item_id'],
      },
    },
    {
      name: 'reorder_items',
      description:
        'Reorder items within a day. Provide the day identifier and an array of item IDs ' +
        'in the desired order.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          trip_id: { type: 'string' },
          day_number: { type: 'number' },
          date: { type: 'string' },
          item_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of item IDs in the desired order',
          },
        },
        required: ['item_ids'],
      },
    },
    {
      name: 'move_item_to_day',
      description:
        'Move an item from one day to another. Specify the item ID and the target day.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          trip_id: { type: 'string' },
          item_id: { type: 'string', description: 'Item ID to move (required)' },
          target_day_number: { type: 'number', description: 'Target day number' },
          target_date: { type: 'string', description: 'Target date YYYY-MM-DD' },
        },
        required: ['item_id'],
      },
    },
    {
      name: 'search_items',
      description:
        'Search for items across the entire trip by text or category. ' +
        'Useful for finding specific bookings, restaurants, or activities.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          trip_id: { type: 'string' },
          query: { type: 'string', description: 'Text to search for in title, notes, location' },
          category: {
            type: 'string',
            enum: ['transport', 'food', 'activity', 'stay', 'free_time'],
          },
          status: {
            type: 'string',
            enum: ['planned', 'confirmed', 'done', 'skipped'],
          },
        },
      },
    },
    {
      name: 'update_day',
      description: 'Update a day\'s title or notes.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          trip_id: { type: 'string' },
          day_number: { type: 'number' },
          date: { type: 'string' },
          title: { type: 'string', description: 'New title for the day' },
          notes: { type: 'string', description: 'Notes for the day' },
        },
      },
    },
  ],
}));

// ---- Tool Handlers ----

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ---- GET TRIP OVERVIEW ----
      case 'get_trip_overview': {
        const tripId = await getTripId(args?.trip_id as string);

        const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
        if (!trip) throw new Error('Trip not found');

        const { data: days } = await supabase
          .from('trip_days')
          .select('*')
          .eq('trip_id', tripId)
          .order('date', { ascending: true });

        let overview = `# ${trip.cover_emoji} ${trip.name}\n`;
        overview += `Destination: ${trip.destination || 'Not set'}\n`;
        overview += `Dates: ${trip.start_date} → ${trip.end_date}\n`;
        overview += `Timezone: ${trip.timezone}\n`;
        overview += `Currency: ${trip.currency || 'JPY'}\n\n`;

        if (days) {
          for (const day of days) {
            const { data: items } = await supabase
              .from('itinerary_items')
              .select('*')
              .eq('day_id', day.id)
              .order('sort_order', { ascending: true });

            const dayNum = Math.floor(
              (new Date(day.date).getTime() - new Date(trip.start_date).getTime()) / 86400000
            ) + 1;

            overview += `## Day ${dayNum} — ${day.date}`;
            if (day.title) overview += ` (${day.title})`;
            overview += `\n`;

            if (items && items.length > 0) {
              for (const item of items) {
                overview += `  • ${formatItemForDisplay(item)}\n`;
                overview += `    [id: ${item.id}]\n`;
              }
            } else {
              overview += `  (empty)\n`;
            }
            overview += '\n';
          }
        }

        return { content: [{ type: 'text', text: overview }] };
      }

      // ---- GET DAY DETAILS ----
      case 'get_day_details': {
        const tripId = await getTripId(args?.trip_id as string);
        let day;

        if (args?.day_number) {
          day = await getDayByNumber(tripId, args.day_number as number);
        } else if (args?.date) {
          day = await getDayByDate(tripId, args.date as string);
        } else {
          throw new Error('Provide either day_number or date');
        }

        const { data: items } = await supabase
          .from('itinerary_items')
          .select('*')
          .eq('day_id', day.id)
          .order('sort_order', { ascending: true });

        let text = `# ${day.date} — ${day.title || 'Untitled'}\n`;
        if (day.notes) text += `Notes: ${day.notes}\n`;
        text += `\n`;

        if (items && items.length > 0) {
          for (const item of items) {
            text += `### ${item.title}\n`;
            text += `  ID: ${item.id}\n`;
            text += `  Category: ${item.category}\n`;
            text += `  Status: ${item.status}\n`;
            if (item.start_time) text += `  Time: ${item.start_time.substring(0, 5)}`;
            if (item.end_time) text += ` – ${item.end_time.substring(0, 5)}`;
            if (item.start_time) text += `\n`;
            if (item.location_name) text += `  Location: ${item.location_name}\n`;
            if (item.location_address) text += `  Address: ${item.location_address}\n`;
            if (item.notes) text += `  Notes: ${item.notes}\n`;
            if (item.cost_estimate) text += `  Cost: ${item.currency || 'JPY'} ${item.cost_estimate}\n`;
            if (item.booking_ref) text += `  Booking: ${item.booking_ref}\n`;
            if (item.url) text += `  URL: ${item.url}\n`;
            text += '\n';
          }
        } else {
          text += '(no items)\n';
        }

        return { content: [{ type: 'text', text }] };
      }

      // ---- ADD ITEM ----
      case 'add_item': {
        const tripId = await getTripId(args?.trip_id as string);
        let day;

        if (args?.day_number) {
          day = await getDayByNumber(tripId, args.day_number as number);
        } else if (args?.date) {
          day = await getDayByDate(tripId, args.date as string);
        } else {
          throw new Error('Provide either day_number or date to specify which day');
        }

        // Get max sort_order
        const { data: existing } = await supabase
          .from('itinerary_items')
          .select('sort_order')
          .eq('day_id', day.id)
          .order('sort_order', { ascending: false })
          .limit(1);

        const nextSort = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

        // Get trip currency for default
        const { data: tripData } = await supabase
          .from('trips')
          .select('currency')
          .eq('id', tripId)
          .single();

        const newItem: Record<string, unknown> = {
          day_id: day.id,
          title: args?.title,
          category: args?.category || 'activity',
          status: 'planned',
          sort_order: nextSort,
          currency: tripData?.currency || 'JPY',
        };

        // Optional fields
        if (args?.start_time) newItem.start_time = args.start_time;
        if (args?.end_time) newItem.end_time = args.end_time;
        if (args?.location_name) newItem.location_name = args.location_name;
        if (args?.location_address) newItem.location_address = args.location_address;
        if (args?.notes) newItem.notes = args.notes;
        if (args?.cost_estimate) newItem.cost_estimate = args.cost_estimate;
        if (args?.booking_ref) newItem.booking_ref = args.booking_ref;
        if (args?.url) newItem.url = args.url;

        const { data, error } = await supabase
          .from('itinerary_items')
          .insert(newItem)
          .select()
          .single();

        if (error) throw new Error(`Failed to add item: ${error.message}`);

        return {
          content: [{
            type: 'text',
            text: `✅ Added "${data.title}" to Day ${args?.day_number || day.date}\n` +
              `  ID: ${data.id}\n` +
              `  Category: ${data.category}\n` +
              (data.start_time ? `  Time: ${data.start_time.substring(0, 5)}\n` : '') +
              (data.location_name ? `  Location: ${data.location_name}\n` : ''),
          }],
        };
      }

      // ---- UPDATE ITEM ----
      case 'update_item': {
        const itemId = args?.item_id as string;
        if (!itemId) throw new Error('item_id is required');

        const updates: Record<string, unknown> = {};
        const allowedFields = [
          'title', 'category', 'start_time', 'end_time', 'location_name',
          'location_address', 'notes', 'cost_estimate', 'booking_ref', 'url', 'status',
        ];

        for (const field of allowedFields) {
          if (args?.[field] !== undefined) {
            updates[field] = args[field];
          }
        }

        if (Object.keys(updates).length === 0) {
          throw new Error('No fields to update. Provide at least one field to change.');
        }

        const { data, error } = await supabase
          .from('itinerary_items')
          .update(updates)
          .eq('id', itemId)
          .select()
          .single();

        if (error) throw new Error(`Failed to update: ${error.message}`);

        const changed = Object.keys(updates).map((k) => `${k}: ${updates[k]}`).join(', ');

        return {
          content: [{
            type: 'text',
            text: `✅ Updated "${data.title}"\n  Changed: ${changed}`,
          }],
        };
      }

      // ---- DELETE ITEM ----
      case 'delete_item': {
        const itemId = args?.item_id as string;
        if (!itemId) throw new Error('item_id is required');

        // Get item title first for confirmation
        const { data: item } = await supabase
          .from('itinerary_items')
          .select('title')
          .eq('id', itemId)
          .single();

        const { error } = await supabase.from('itinerary_items').delete().eq('id', itemId);
        if (error) throw new Error(`Failed to delete: ${error.message}`);

        return {
          content: [{
            type: 'text',
            text: `🗑️ Deleted "${item?.title || itemId}"`,
          }],
        };
      }

      // ---- REORDER ITEMS ----
      case 'reorder_items': {
        const itemIds = args?.item_ids as string[];
        if (!itemIds || itemIds.length === 0) throw new Error('item_ids array is required');

        for (let i = 0; i < itemIds.length; i++) {
          await supabase
            .from('itinerary_items')
            .update({ sort_order: i })
            .eq('id', itemIds[i]);
        }

        return {
          content: [{
            type: 'text',
            text: `✅ Reordered ${itemIds.length} items`,
          }],
        };
      }

      // ---- MOVE ITEM TO DAY ----
      case 'move_item_to_day': {
        const itemId = args?.item_id as string;
        if (!itemId) throw new Error('item_id is required');

        const tripId = await getTripId(args?.trip_id as string);
        let targetDay;

        if (args?.target_day_number) {
          targetDay = await getDayByNumber(tripId, args.target_day_number as number);
        } else if (args?.target_date) {
          targetDay = await getDayByDate(tripId, args.target_date as string);
        } else {
          throw new Error('Provide target_day_number or target_date');
        }

        // Get max sort_order in target day
        const { data: existing } = await supabase
          .from('itinerary_items')
          .select('sort_order')
          .eq('day_id', targetDay.id)
          .order('sort_order', { ascending: false })
          .limit(1);

        const nextSort = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

        const { data, error } = await supabase
          .from('itinerary_items')
          .update({ day_id: targetDay.id, sort_order: nextSort })
          .eq('id', itemId)
          .select()
          .single();

        if (error) throw new Error(`Failed to move: ${error.message}`);

        return {
          content: [{
            type: 'text',
            text: `✅ Moved "${data.title}" to ${targetDay.date} (${targetDay.title || 'Untitled'})`,
          }],
        };
      }

      // ---- SEARCH ITEMS ----
      case 'search_items': {
        const tripId = await getTripId(args?.trip_id as string);

        const { data: days } = await supabase
          .from('trip_days')
          .select('id, date, title')
          .eq('trip_id', tripId);

        if (!days) throw new Error('No days found');

        let query = supabase
          .from('itinerary_items')
          .select('*')
          .in('day_id', days.map((d) => d.id));

        if (args?.category) query = query.eq('category', args.category as string);
        if (args?.status) query = query.eq('status', args.status as string);

        const { data: items, error } = await query.order('sort_order', { ascending: true });
        if (error) throw new Error(`Search failed: ${error.message}`);

        let results = items || [];

        // Text search filter
        if (args?.query) {
          const q = (args.query as string).toLowerCase();
          results = results.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              (item.notes && item.notes.toLowerCase().includes(q)) ||
              (item.location_name && item.location_name.toLowerCase().includes(q)) ||
              (item.booking_ref && item.booking_ref.toLowerCase().includes(q))
          );
        }

        if (results.length === 0) {
          return { content: [{ type: 'text', text: 'No items found matching your search.' }] };
        }

        const dayMap = new Map(days.map((d) => [d.id, d]));
        let text = `Found ${results.length} item(s):\n\n`;

        for (const item of results) {
          const day = dayMap.get(item.day_id);
          text += `• ${item.title} [${item.category}]\n`;
          text += `  Day: ${day?.date || 'Unknown'} (${day?.title || ''})\n`;
          text += `  ID: ${item.id}\n`;
          if (item.start_time) text += `  Time: ${item.start_time.substring(0, 5)}\n`;
          if (item.location_name) text += `  Location: ${item.location_name}\n`;
          text += '\n';
        }

        return { content: [{ type: 'text', text }] };
      }

      // ---- UPDATE DAY ----
      case 'update_day': {
        const tripId = await getTripId(args?.trip_id as string);
        let day;

        if (args?.day_number) {
          day = await getDayByNumber(tripId, args.day_number as number);
        } else if (args?.date) {
          day = await getDayByDate(tripId, args.date as string);
        } else {
          throw new Error('Provide day_number or date');
        }

        const updates: Record<string, unknown> = {};
        if (args?.title !== undefined) updates.title = args.title;
        if (args?.notes !== undefined) updates.notes = args.notes;

        const { error } = await supabase.from('trip_days').update(updates).eq('id', day.id);
        if (error) throw new Error(`Failed to update day: ${error.message}`);

        return {
          content: [{
            type: 'text',
            text: `✅ Updated day ${day.date}: ${Object.keys(updates).join(', ')} changed`,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `❌ Error: ${message}` }],
      isError: true,
    };
  }
});

// ---- Start Server ----

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Tabi MCP server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
