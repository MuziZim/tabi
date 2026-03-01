# Tabi — ChatGPT Custom GPT Setup Guide

This guide walks you through deploying the Tabi API and connecting it to a ChatGPT Custom GPT so you can manage your travel itineraries via natural language.

---

## 1. Deploy the Edge Function

Make sure you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and linked to your project.

```bash
# Link to your Supabase project (if not already)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the API function
supabase functions deploy api
```

## 2. Set the API Key Secret

Generate a random API key and store it as a Supabase secret:

```bash
# Generate a key (or use any random string)
API_KEY=$(openssl rand -hex 32)
echo "Your API key: $API_KEY"

# Set it in Supabase
supabase secrets set TABI_API_KEY=$API_KEY
```

Save this key — you'll need it when configuring the GPT.

## 3. Test the API

Verify the deployment works:

```bash
# Replace with your project ref and API key
BASE_URL="https://YOUR_PROJECT_REF.supabase.co/functions/v1/api"

curl -H "Authorization: Bearer YOUR_API_KEY" "$BASE_URL/trips"
```

You should get a JSON response with `{"ok": true, "data": [...]}`.

## 4. Create a Custom GPT in ChatGPT

1. Go to [ChatGPT](https://chat.openai.com) → **Explore GPTs** → **Create a GPT**
2. In the **Configure** tab, set:
   - **Name:** Tabi Travel Planner
   - **Description:** Manage your travel itineraries — add activities, meals, transport, and more.
   - **Instructions:** Use the system prompt below (Section 6)

## 5. Configure Actions

1. In the GPT editor, scroll down to **Actions** → **Create new action**
2. Click **Import from URL** or paste the contents of `openapi.yaml` from this repo
3. If importing from URL, you'll need to host the spec somewhere accessible (e.g. raw GitHub URL)
4. **Update the server URL** in the spec: replace `YOUR_PROJECT_REF` with your actual Supabase project ref
5. Under **Authentication**:
   - Type: **API Key**
   - Auth Type: **Bearer**
   - Paste your `TABI_API_KEY`

## 6. Suggested GPT System Prompt

Paste this into the **Instructions** field of your Custom GPT:

---

You are Tabi, a travel itinerary assistant. You help the user plan and manage their trips using the Tabi API.

### Data Model

- **Trip**: A travel plan with a name, destination, start/end dates, timezone, and currency.
- **Day**: Each trip has one day per date from start to end. Days have a 1-based day_number, an optional title, and optional notes.
- **Item**: An itinerary entry on a specific day. Items have a title, category, optional times, location, notes, cost, booking ref, and URL.

Item categories: `transport`, `food`, `activity`, `stay`, `free_time`
Item statuses: `planned`, `confirmed`, `cancelled`

### Default Trip

The user's default trip ID is: `YOUR_TRIP_ID_HERE`

Always use this trip ID unless the user specifies a different trip.

### How to Use the API

**Viewing the itinerary:**
- To see the full trip: use `getTripOverview`
- To see a specific day: use `getDay` with the day number
- To find specific items: use `searchItems` with text or category filters

**Adding items:**
- When the user says "add lunch at X on day 3", use `addItem` with `day_number=3`, `category="food"`, and the restaurant name as the title
- When they say "book hotel Y for nights 1-3", use `addItem` with `category="stay"` for each night
- When they mention transport like "take the train from A to B", use `category="transport"`

**Modifying items:**
- To change details: use `updateItem` with only the fields that need changing
- To move an item to a different day: use `moveItem`
- To remove an item: use `deleteItem`
- To reorder items within a day: use `reorderItems`

**Day notes:**
- To set a theme or notes for a day: use `updateDay`

### Response Style

- After making changes, briefly confirm what was done
- When showing the itinerary, format it nicely with times, categories, and locations
- Use emoji for categories: 🚆 transport, 🍜 food, 🎯 activity, 🏨 stay, ☕ free_time
- Be concise but helpful

---

## 7. Local Development

To test the Edge Function locally:

```bash
# Create a .env.local file with your secrets
echo "TABI_API_KEY=test-key-123" > .env.local

# Serve locally
supabase functions serve api --env-file .env.local
```

The function will be available at `http://localhost:54321/functions/v1/api`.

---

## Claude App / MCP Integration

The Tabi app already includes an MCP (Model Context Protocol) server at `mcp-server/` that provides the same capabilities over the MCP protocol via stdio. This is the recommended way to use Tabi with **Claude Desktop**.

To set up Claude Desktop with Tabi:

1. Build the MCP server: `cd mcp-server && npm install && npm run build`
2. Add the server to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tabi": {
      "command": "node",
      "args": ["/path/to/tabi/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://YOUR_PROJECT_REF.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

If Anthropic adds custom tool/action support to the Claude app (similar to ChatGPT Actions), the `openapi.yaml` spec in this repo can be reused directly to configure it.
