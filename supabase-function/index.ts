// supabase/functions/broadcast-notification/index.ts
//
// Generic broadcast push notification via OneSignal + Supabase.
// Before deploying, set these environment variables in your Supabase project:
//   ONESIGNAL_APP_ID
//   ONESIGNAL_API_KEY
//   SUPABASE_URL              (automatically available in Edge Functions)
//   SERVICE_ROLE_KEY          (Supabase service role key, NEVER use this on the client)
//
// Adjust APP_ICON_URL and the table/column names in the "CONFIG" section below
// to match your project.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===================== CONFIG =====================
// Update these to match your database schema and branding.
const TABLE_NAME          = "profiles";              // table where player IDs are stored
const PLAYER_ID_COLUMN    = "onesignal_player_id";    // column storing the OneSignal player/subscription ID
const ROLE_COLUMN         = "role";                   // user role column (used to filter targets)
const APP_ICON_URL        = "https://example.com/icon-512.png"; // fallback large_icon when imageUrl is empty
const SMALL_ICON_NAME     = "ic_notif_logo";          // Android small icon drawable name (optional)
const ACCENT_COLOR        = "FF1D9E75";               // Android notification accent color (ARGB hex)
// ====================================================

const ONESIGNAL_APP_ID  = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // target: free-form string, should match the values in ROLE_COLUMN in your database.
    // "all" means "send to every user with a player_id", regardless of role.
    const { title, message, target, imageUrl } = await req.json();

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "title and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch player IDs matching the target
    let query = supabase
      .from(TABLE_NAME)
      .select(PLAYER_ID_COLUMN)
      .not(PLAYER_ID_COLUMN, "is", null);

    if (target && target !== "all") {
      query = query.eq(ROLE_COLUMN, target);
    }

    const { data: rows, error: queryError } = await query;

    if (queryError) {
      console.error("[Broadcast] Failed to query target users:", queryError);
      return new Response(JSON.stringify({ error: "Failed to fetch target users" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const playerIds = (rows ?? [])
      .map((row: Record<string, unknown>) => row[PLAYER_ID_COLUMN] as string)
      .filter(Boolean);

    console.log(`[Broadcast] Target "${target}" -> ${playerIds.length} player_id(s) found`);

    if (playerIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, recipients: 0, reason: "No matching player_id found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Send the push notification via OneSignal
    const oneSignalRes = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_subscription_ids: playerIds,
        headings: { en: title },
        contents: { en: message },
        data: { type: "broadcast" },
        small_icon: SMALL_ICON_NAME,
        android_accent_color: ACCENT_COLOR,
        ...(imageUrl
          ? {
              big_picture: imageUrl,
              large_icon: imageUrl,
              ios_attachments: { id1: imageUrl },
            }
          : {
              large_icon: APP_ICON_URL,
            }),
        priority: 10,
        ttl: 86400,
      }),
    });

    const oneSignalData = await oneSignalRes.json();
    console.log("[Broadcast] OneSignal response:", JSON.stringify(oneSignalData));

    if (!oneSignalRes.ok) {
      return new Response(
        JSON.stringify({ error: "OneSignal request failed", detail: oneSignalData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // invalid_player_ids is not a fatal error — it just means the device is inactive/uninstalled
    const invalidCount = oneSignalData.errors?.invalid_player_ids?.length ?? 0;

    return new Response(
      JSON.stringify({
        success: true,
        recipients: oneSignalData.recipients ?? (playerIds.length - invalidCount),
        invalid_count: invalidCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Broadcast] Unexpected error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
