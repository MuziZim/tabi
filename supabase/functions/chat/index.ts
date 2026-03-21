import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- CORS ----

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Auth ----

function authenticate(req: Request): boolean {
  const apiKey = Deno.env.get("TABI_API_KEY");
  if (!apiKey) return false;
  const custom = req.headers.get("x-api-key");
  if (custom) return custom === apiKey;
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  return token === apiKey;
}

// ---- Supabase ----

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ---- Tool definitions for Claude ----

const TOOLS = [
  {
    name: "get_trip_overview",
    description:
      "Get a full overview of a trip including all days and itinerary items. Use this first to understand what's already planned.",
    input_schema: {
      type: "object" as const,
      properties: {
        trip_id: { type: "string", description: "The trip UUID" },
      },
      required: ["trip_id"],
    },
  },
  {
    name: "add_item",
    description:
      "Add a new itinerary item to a specific day. Categories: transport, food, activity, stay, free_time.",
    input_schema: {
      type: "object" as const,
      properties: {
        trip_id: { type: "string", description: "The trip UUID" },
        day_number: {
          type: "integer",
          description: "1-based day number within the trip",
        },
        title: { type: "string", description: "Name of the activity/item" },
        category: {
          type: "string",
          enum: ["transport", "food", "activity", "stay", "free_time"],
          description: "Item category",
        },
        start_time: {
          type: "string",
          description: "Start time in HH:MM format (optional)",
        },
        end_time: {
          type: "string",
          description: "End time in HH:MM format (optional)",
        },
        location_name: { type: "string", description: "Venue or place name (optional)" },
        notes: { type: "string", description: "Additional notes (optional)" },
        cost_estimate: {
          type: "number",
          description: "Estimated cost in trip currency (optional)",
        },
      },
      required: ["trip_id", "day_number", "title", "category"],
    },
  },
  {
    name: "update_item",
    description: "Update fields on an existing itinerary item.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: { type: "string", description: "The item UUID" },
        title: { type: "string" },
        category: {
          type: "string",
          enum: ["transport", "food", "activity", "stay", "free_time"],
        },
        start_time: { type: "string" },
        end_time: { type: "string" },
        location_name: { type: "string" },
        notes: { type: "string" },
        cost_estimate: { type: "number" },
        status: {
          type: "string",
          enum: ["planned", "confirmed", "cancelled"],
        },
      },
      required: ["item_id"],
    },
  },
  {
    name: "delete_item",
    description: "Delete an itinerary item. Ask for confirmation before deleting.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: { type: "string", description: "The item UUID to delete" },
      },
      required: ["item_id"],
    },
  },
  {
    name: "move_item",
    description: "Move an itinerary item to a different day.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: { type: "string", description: "The item UUID" },
        trip_id: { type: "string", description: "The trip UUID" },
        target_day_number: {
          type: "integer",
          description: "1-based day number to move the item to",
        },
      },
      required: ["item_id", "trip_id", "target_day_number"],
    },
  },
  {
    name: "search_items",
    description:
      "Search for itinerary items across the trip by text, category, or status.",
    input_schema: {
      type: "object" as const,
      properties: {
        trip_id: { type: "string", description: "The trip UUID" },
        q: { type: "string", description: "Text search query (optional)" },
        category: {
          type: "string",
          enum: ["transport", "food", "activity", "stay", "free_time"],
          description: "Filter by category (optional)",
        },
        status: {
          type: "string",
          enum: ["planned", "confirmed", "cancelled"],
          description: "Filter by status (optional)",
        },
      },
      required: ["trip_id"],
    },
  },
];

// ---- Tool execution ----

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  apiBaseUrl: string,
  apiKey: string,
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };

  try {
    switch (name) {
      case "get_trip_overview": {
        const res = await fetch(
          `${apiBaseUrl}/api/trips/${input.trip_id}/overview`,
          { headers },
        );
        const data = await res.json();
        return JSON.stringify(data, null, 2);
      }

      case "add_item": {
        const body: Record<string, unknown> = {
          day_number: input.day_number,
          title: input.title,
          category: input.category,
        };
        if (input.start_time) body.start_time = input.start_time;
        if (input.end_time) body.end_time = input.end_time;
        if (input.location_name) body.location_name = input.location_name;
        if (input.notes) body.notes = input.notes;
        if (input.cost_estimate !== undefined)
          body.cost_estimate = input.cost_estimate;

        const res = await fetch(
          `${apiBaseUrl}/api/trips/${input.trip_id}/items`,
          { method: "POST", headers, body: JSON.stringify(body) },
        );
        const data = await res.json();
        return JSON.stringify(data, null, 2);
      }

      case "update_item": {
        const { item_id, ...updates } = input;
        const res = await fetch(`${apiBaseUrl}/api/items/${item_id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        return JSON.stringify(data, null, 2);
      }

      case "delete_item": {
        const res = await fetch(`${apiBaseUrl}/api/items/${input.item_id}`, {
          method: "DELETE",
          headers,
        });
        const data = await res.json();
        return JSON.stringify(data, null, 2);
      }

      case "move_item": {
        const res = await fetch(
          `${apiBaseUrl}/api/items/${input.item_id}/move`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              trip_id: input.trip_id,
              target_day_number: input.target_day_number,
            }),
          },
        );
        const data = await res.json();
        return JSON.stringify(data, null, 2);
      }

      case "search_items": {
        const params = new URLSearchParams();
        if (input.q) params.set("q", input.q as string);
        if (input.category) params.set("category", input.category as string);
        if (input.status) params.set("status", input.status as string);

        const res = await fetch(
          `${apiBaseUrl}/api/trips/${input.trip_id}/search?${params}`,
          { headers },
        );
        const data = await res.json();
        return JSON.stringify(data, null, 2);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---- Main handler ----

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!authenticate(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }

  const tabiApiKey = Deno.env.get("TABI_API_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const apiBaseUrl = `${supabaseUrl}/functions/v1`;

  try {
    const { messages, trip_id } = (await req.json()) as {
      messages: ChatMessage[];
      trip_id: string;
    };

    if (!messages || !trip_id) {
      return json({ error: "messages and trip_id are required" }, 400);
    }

    // Look up trip name for the system prompt
    const supabase = getSupabase();
    const { data: trip } = await supabase
      .from("trips")
      .select("name, destination, start_date, end_date, timezone, currency")
      .eq("id", trip_id)
      .single();

    const tripContext = trip
      ? `Current trip: "${trip.name}" to ${trip.destination || "unknown destination"}, ${trip.start_date} to ${trip.end_date} (${trip.timezone}, ${trip.currency}).`
      : "";

    const systemPrompt = `You are Tabi, a friendly and concise travel planning assistant embedded in a trip itinerary app.
${tripContext}
Trip ID: ${trip_id}

Guidelines:
- Keep responses short and helpful — this is a mobile chat.
- When the user asks to add, change, or look up items, use your tools.
- Always fetch the trip overview first if you need context about what's already planned.
- When adding items, pick the most appropriate category and suggest times when possible.
- Use the trip's local currency for cost estimates.
- Be conversational but efficient — no long paragraphs.`;

    // Claude API conversation loop (handle tool use)
    let claudeMessages: unknown[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const claudeRes = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: systemPrompt,
            tools: TOOLS,
            messages: claudeMessages,
          }),
        },
      );

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return json(
          { error: `Claude API error: ${claudeRes.status}`, details: errText },
          502,
        );
      }

      const claudeData = await claudeRes.json();

      // If Claude is done (no tool use), return the text response
      if (claudeData.stop_reason === "end_turn") {
        const textBlock = claudeData.content.find(
          (b: { type: string }) => b.type === "text",
        );
        return json({
          reply: textBlock?.text || "",
          stop_reason: "end_turn",
        });
      }

      // If Claude wants to use tools, execute them
      if (claudeData.stop_reason === "tool_use") {
        // Add assistant message with tool_use blocks
        claudeMessages = [
          ...claudeMessages,
          { role: "assistant", content: claudeData.content },
        ];

        // Execute each tool call
        const toolResults = [];
        for (const block of claudeData.content) {
          if (block.type === "tool_use") {
            const result = await executeTool(
              block.name,
              block.input,
              apiBaseUrl,
              tabiApiKey,
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        // Add tool results
        claudeMessages = [
          ...claudeMessages,
          { role: "user", content: toolResults },
        ];

        continue; // Next round
      }

      // Unexpected stop reason
      const textBlock = claudeData.content.find(
        (b: { type: string }) => b.type === "text",
      );
      return json({
        reply: textBlock?.text || "",
        stop_reason: claudeData.stop_reason,
      });
    }

    return json({
      reply: "I ran into a limit processing your request. Could you try rephrasing?",
      stop_reason: "max_rounds",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});
