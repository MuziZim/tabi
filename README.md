# ⛩️ 旅 Tabi — Travel Companion PWA

A beautiful, offline-capable travel itinerary app with real-time collaboration and LLM integration via MCP (Model Context Protocol).

Built for a Japan trip. Works for any trip.

## Features

- 📱 **Installable PWA** — add to home screen, works like a native app
- 🔄 **Real-time sync** — changes appear instantly for all trip members
- 🤖 **MCP integration** — Claude can read and update your itinerary
- ✈️ **Offline capable** — view and edit your itinerary without internet
- 🎨 **Drag & drop** — reorder items by dragging
- 💰 **Cost tracking** — daily cost summaries in local currency
- 🔐 **Magic link auth** — no passwords, just email

## Architecture

```
PWA (Vercel) ←→ Supabase (Postgres + Realtime) ←→ MCP Server (Claude Desktop)
```

| Layer | Technology |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| Drag & Drop | @dnd-kit |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (magic link) |
| Real-time | Supabase Realtime (Postgres changes) |
| Offline | Service Worker + IndexedDB (idb-keyval) |
| Hosting | Vercel (free tier) |
| LLM Bridge | MCP Server (Node.js) |

## Quick Start

### 1. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Go to **Authentication → URL Configuration** and add your Vercel URL to "Redirect URLs"
4. Copy your **Project URL** and **anon public** key from **Settings → API**

### 2. PWA Setup

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/tabi.git
cd tabi
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Run locally
npm run dev
```

### 3. Deploy to Vercel

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Deploy — Vercel auto-deploys on every push to `main`

### 4. MCP Server Setup (Claude Desktop)

```bash
# Install MCP server dependencies
cd mcp-server
npm install

# Configure Claude Desktop
# Edit: ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
# Or:   %APPDATA%\Claude\claude_desktop_config.json (Windows)
```

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "tabi-travel": {
      "command": "npx",
      "args": ["tsx", "/full/path/to/tabi/mcp-server/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "DEFAULT_TRIP_ID": "your-trip-uuid"
      }
    }
  }
}
```

> ⚠️ The MCP server uses the **service_role** key (not anon). This key bypasses Row Level Security. Keep it secret — never put it in the frontend.

### 5. Get Your Trip ID

After creating a trip in the PWA, find its ID by:
- Opening browser DevTools → Network tab → look for the Supabase request
- Or running in Supabase SQL Editor: `SELECT id, name FROM trips;`

Set this as `DEFAULT_TRIP_ID` in your MCP config so you don't have to specify it every time.

## Using with Claude

Once the MCP server is configured, restart Claude Desktop. You can now say things like:

| What you say | What happens |
|---|---|
| "What does our Japan trip look like?" | Claude reads the full itinerary |
| "What's planned for Day 3?" | Claude shows Day 3 details |
| "Add lunch at Ichiran Ramen at 12:30 on Day 3" | Creates an item |
| "Move dinner to 19:00" | Updates the time |
| "Swap the temple visit and lunch" | Reorders items |
| "Move the Fushimi Inari visit to Day 5" | Moves between days |
| "Find all our restaurant bookings" | Searches by category |
| "Cancel the boat cruise" | Deletes the item |

Changes made by Claude appear in the PWA in real-time.

## Sharing with Your Travel Partner

1. Your partner signs into the PWA with their email (magic link)
2. You add them as a trip member (Share button in the trip view)
3. They now see the same trip with real-time sync

Both of you can edit simultaneously — changes sync in ~1 second via Supabase Realtime.

## Offline Mode

The PWA caches your itinerary in IndexedDB. When you lose connectivity:

- ✅ View your full itinerary
- ✅ See all item details
- ⚠️ Edits queue locally and sync when back online
- ❌ Real-time sync paused until reconnected

A small "Offline" indicator appears in the header when disconnected.

## Project Structure

```
tabi/
├── public/              # Static assets, PWA icons
├── src/
│   ├── components/      # React components
│   ├── hooks/           # Data hooks (auth, trips, items)
│   ├── lib/             # Supabase client, types, utils, offline
│   ├── App.tsx          # Main app with routing
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles + Tailwind
├── supabase/
│   └── schema.sql       # Database schema + RLS policies
├── mcp-server/
│   ├── src/index.ts     # MCP server implementation
│   └── claude_desktop_config.example.json
├── vite.config.ts       # Vite + PWA plugin config
├── tailwind.config.js   # Custom theme (Japanese-inspired)
└── package.json
```

## Cost

| Service | Cost |
|---|---|
| Supabase | Free (generous free tier) |
| Vercel | Free (hobby plan) |
| GitHub | Free |
| Claude Desktop + MCP | Included with Claude Pro subscription |
| **Total** | **$0/month** |

## License

MIT — use it for your own trips!
