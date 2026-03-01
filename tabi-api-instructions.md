# Tabi API — Build Instructions for Claude Code

## Objective

Build a REST API for the Tabi travel itinerary app using **Supabase Edge Functions** (Deno/TypeScript), plus an **OpenAPI 3.1 spec** for ChatGPT Custom GPT Actions. This API mirrors the existing MCP server's capabilities but exposes them as HTTP endpoints that ChatGPT (and any other client) can call.

## Context

- **Repo:** https://github.com/MuziZim/tabi
- **Existing MCP server:** `mcp-server/src/index.ts` — reference this for all business logic, helper functions, and response formatting. The Edge Functions should replicate its behavior.
- **Database schema:** `supabase/schema.sql` — 4 tables: `trips`, `trip_members`, `trip_days`, `itinerary_items`
- **Database:** Supabase (Postgres with RLS enabled)
- **Auth for API:** Bearer token using `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS, same as MCP server)

## Architecture

Create a **single Edge Function** at `supabase/functions/api/index.ts` that handles all routes via URL path matching. This is simpler to deploy and manage than one function per endpoint.

```
supabase/functions/api/index.ts    ← single entry point, routes internally
supabase/functions/api/routes/     ← route handlers (optional, for organisation)
```

**Base URL pattern:** `https://<project-ref>.supabase.co/functions/v1/api`

## Authentication

Use a simple Bearer token approach:
- Requests must include header: `Authorization: Bearer <API_KEY>`
- The API_KEY is a custom secret set via `supabase secrets set TABI_API_KEY=<some-random-key>`
- The Edge Function validates this token before processing any request
- Internally, the function uses `SUPABASE_SERVICE_ROLE_KEY` (available automatically in Edge Functions via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`) to access the database, bypassing RLS
- Keep it simple — no JWT, no OAuth, no user-level auth. This is a personal API.

## Endpoints

All endpoints are under `/api`. Implement these routes:

### GET /api/trips
List all trips (or a single trip if `?trip_id=xxx` is provided).

### GET /api/trips/:trip_id/overview
Full trip overview with all days and items (mirrors `get_trip_overview` MCP tool).
Response should be structured JSON, not plain text.

### GET /api/trips/:trip_id/days
List all days for a trip.

### GET /api/trips/:trip_id/days/:day_number
Get details for a specific day (1-based day number) including all items.
Also support query param `?date=YYYY-MM-DD` as alternative.

### POST /api/trips/:trip_id/items
Add a new itinerary item. Body:
```json
{
  "day_number": 3,        // or "date": "2025-04-15"
  "title": "Lunch at Ichiran",
  "category": "food",     // transport | food | activity | stay | free_time
  "start_time": "12:30",  // HH:MM, optional
  "end_time": "13:30",    // optional
  "location_name": "Ichiran Shibuya",  // optional
  "location_address": "...",           // optional
  "notes": "...",         // optional
  "cost_estimate": 1200,  // optional
  "booking_ref": "...",   // optional
  "url": "..."            // optional
}
```

### PATCH /api/items/:item_id
Update an existing item. Body contains only the fields to change.

### DELETE /api/items/:item_id
Delete an item.

### POST /api/items/:item_id/move
Move an item to a different day. Body:
```json
{
  "trip_id": "xxx",
  "target_day_number": 5    // or "target_date": "2025-04-17"
}
```

### PATCH /api/items/reorder
Reorder items within a day. Body:
```json
{
  "item_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### GET /api/trips/:trip_id/search?q=ramen&category=food&status=confirmed
Search items across the trip. All query params optional.

### PATCH /api/trips/:trip_id/days/:day_number
Update a day's title or notes. Body:
```json
{
  "title": "Tokyo Exploration",
  "notes": "Focus on Shibuya and Shinjuku"
}
```

## Response Format

All responses should be JSON with consistent structure:

**Success:**
```json
{
  "ok": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "ok": false,
  "error": "Human-readable error message"
}
```

Use appropriate HTTP status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error).

## Helper Functions to Replicate

From the MCP server (`mcp-server/src/index.ts`), replicate these helpers:
- `getTripId(providedId?)` — resolve trip ID
- `getDayByDate(tripId, date)` — find a day by date
- `getDayByNumber(tripId, dayNumber)` — find a day by 1-based number
- `formatItemForDisplay(item)` — not needed for JSON API, but useful for search results

## CORS

Enable CORS for all origins (this is a personal API):
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};
```

Handle OPTIONS preflight requests.

## OpenAPI Spec

Generate an OpenAPI 3.1.0 spec file at `supabase/functions/api/openapi.yaml` (also save a copy to repo root as `openapi.yaml`). This spec will be used to configure ChatGPT Custom GPT Actions.

The spec must include:
- All endpoints listed above with full request/response schemas
- Server URL as a placeholder: `https://YOUR_PROJECT_REF.supabase.co/functions/v1`
- Security scheme: Bearer token (`TABI_API_KEY`)
- Descriptive operation summaries that help ChatGPT understand when to use each endpoint
- Example values in schemas where helpful

## ChatGPT Custom GPT Setup Instructions

Create a `CHATGPT_SETUP.md` file in the repo root with step-by-step instructions:

1. How to deploy the Edge Function to Supabase
2. How to set the `TABI_API_KEY` secret
3. How to create a Custom GPT in ChatGPT
4. How to configure the Actions using the OpenAPI spec
5. How to set the Bearer token auth
6. Suggested system prompt for the Custom GPT that explains Tabi's data model and how to use the API effectively

The suggested GPT system prompt should include:
- What Tabi is
- The trip/day/item data model
- The user's default trip ID (placeholder)
- Guidance on when to use which endpoint
- Examples like "When I say 'add lunch at X on day 3', use POST /api/trips/{trip_id}/items with category='food'"

## Claude App Integration Notes

Also add a section to `CHATGPT_SETUP.md` explaining that the same API can be used with Claude Desktop via MCP (already exists in `mcp-server/`) and that if Anthropic adds custom tool support to the Claude app in the future, the OpenAPI spec can be reused.

## Technical Notes

- Supabase Edge Functions run on Deno — use `Deno.env.get()` for environment variables
- Import Supabase client: `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'`
- The function will have access to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically
- Only `TABI_API_KEY` needs to be set manually via `supabase secrets set`
- Test locally with `supabase functions serve api --env-file .env.local`
- Deploy with `supabase functions deploy api`

## File Structure (what to create)

```
supabase/
  functions/
    api/
      index.ts          ← main Edge Function entry point
openapi.yaml            ← OpenAPI spec (repo root, for easy access)
CHATGPT_SETUP.md        ← setup guide
```

## Validation

After building, verify:
1. `index.ts` compiles without errors in Deno
2. All 10 endpoints are implemented
3. Auth check is present on every route
4. CORS headers are set
5. OpenAPI spec is valid (can be checked at https://editor.swagger.io)
6. `CHATGPT_SETUP.md` has complete instructions

## Reference

The MCP server at `mcp-server/src/index.ts` is the source of truth for business logic. The Edge Function should produce equivalent results for the same operations — just as JSON over HTTP instead of MCP protocol over stdio.
