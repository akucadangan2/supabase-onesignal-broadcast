# Supabase + OneSignal broadcast notification starter

A ready-to-use broadcast push notification system for apps built on Supabase. Send targeted push notifications to your users from a simple web admin panel, powered by a Supabase Edge Function and OneSignal.

## How it works

1. An admin fills out a form (title, message, target audience, optional image) in the Next.js admin panel.
2. The panel calls a Supabase Edge Function with the admin's session token.
3. The Edge Function looks up matching OneSignal player IDs from your `profiles` table, filtered by the chosen target.
4. It sends the notification through the OneSignal REST API.
5. The result (recipient count, invalid device count) is returned and shown in the admin panel.

```
Admin panel (Next.js)
        |
        v
Supabase Edge Function (broadcast-notification)
        |
        v
profiles table  --->  OneSignal API
        |
        v
User's device (push notification)
```

## What's included

- `supabase-function/index.ts` — the Edge Function that queries target users and sends the push via OneSignal.
- `admin-panel/page.js` — a Next.js client component with a form, live preview, quick templates, and send history.

## Requirements

- A Supabase project with Edge Functions enabled
- A OneSignal app already set up for your mobile app (Android/iOS), with your app saving each device's player/subscription ID
- A `profiles` (or equivalent) table that stores each user's OneSignal player ID and role

## Database setup

Your user table needs at least these two columns:

| Column | Type | Description |
|---|---|---|
| `onesignal_player_id` | `text` | The OneSignal subscription ID for that user's device |
| `role` | `text` | Used to filter who receives the notification (e.g. `customer`, `admin`) |

If your table or column names are different, update the `CONFIG` section at the top of `supabase-function/index.ts`.

## Setup

### 1. Deploy the Edge Function

Copy `supabase-function/index.ts` into your project at:

```
supabase/functions/broadcast-notification/index.ts
```

Deploy it:

```bash
supabase functions deploy broadcast-notification
```

### 2. Set environment variables

In your Supabase project (Project Settings → Edge Functions → Secrets), set:

| Variable | Description |
|---|---|
| `ONESIGNAL_APP_ID` | Your OneSignal app ID |
| `ONESIGNAL_API_KEY` | Your OneSignal REST API key |
| `SERVICE_ROLE_KEY` | Your Supabase service role key |

`SUPABASE_URL` is provided automatically inside Edge Functions — you don't need to set it yourself.

> **Security note:** `SERVICE_ROLE_KEY` bypasses Row Level Security. It must only ever be used server-side, inside the Edge Function. Never expose it to the browser or commit it to your repo.

### 3. Add the admin panel page

Copy `admin-panel/page.js` into your Next.js app, for example at:

```
app/admin/broadcast/page.js
```

Adjust the relative import path to your Supabase client:

```js
import { supabase } from '../../../lib/supabase'
```

Make sure your Next.js app has `NEXT_PUBLIC_SUPABASE_URL` set in its environment variables.

### 4. Restrict access (important)

This page sends notifications to every matching user, so it should only be reachable by admins. At minimum:

- Gate the route behind your existing auth/role check
- Optionally add a check inside the Edge Function itself, verifying the caller's role from their JWT before proceeding

### 5. Customize branding

Open the `CONFIG` section at the top of `admin-panel/page.js`:

```js
const APP_NAME = 'My App'
const APP_BADGE = 'APP'
const BRAND_COLOR = '#4f46e5'
const BRAND_COLOR_LIGHT = '#eef2ff'

const TARGET_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'customer', label: 'Customers' },
]

const PRESET_NOTIFS = [/* ... */]
```

Change `BRAND_COLOR` to a single hex value and the whole page's accent color updates — no Tailwind class editing needed. Add or remove entries in `TARGET_OPTIONS` to match the roles in your own `role` column, and edit `PRESET_NOTIFS` to fit your own use cases.

## API reference

**POST** `/functions/v1/broadcast-notification`

Headers:
```
Authorization: Bearer <user_access_token>
Content-Type: application/json
```

Body:
```json
{
  "title": "Flash sale!",
  "message": "50% off today only.",
  "target": "all",
  "imageUrl": "https://example.com/promo.jpg"
}
```

Response:
```json
{
  "success": true,
  "recipients": 128,
  "invalid_count": 3
}
```

`imageUrl` is optional. `target` should be `"all"` or a value matching your `role` column.

## License

MIT — use freely in personal and commercial projects.
