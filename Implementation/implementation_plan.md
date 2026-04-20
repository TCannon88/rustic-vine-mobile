# The Rustic Vine PWA — Implementation Plan

## Overview

Build a Progressive Web App for **The Rustic Vine** (therustic-vine.com), a faith-based handmade craft kit business. The core conversion funnel is: **push notification → live stream → in-stream product link → checkout**.

The app is a pure React + Vite frontend hosted on Cloudflare Pages, backed by a Cloudflare Worker API layer, Wix Headless for commerce/CMS, Mux for HLS streaming, and Ably for real-time chat.

---

## User Review Required

> [!IMPORTANT]
> The project will be scaffolded **inside the existing `/home/tom/Projects/rustic-vine-mobile` workspace** (already a git repo). The `rustic-vine-pwa/` structure from the spec will be created at the root of this repo.

> [!IMPORTANT]
> **Mux credentials found** in the existing `.env` file:
> - `MUX_TOKEN_ID=3221df83-bef2-421a-99ba-b7447bde4718`
> - `MUX_TOKEN_SECRET=KKg0qpgm6gnZscSwbmmecE1sJGop5mG7YSyjDrOtzYSvXTowzXUBKH4alfKIEiTVNQJugReOp74`
>
> These will be referenced in the Cloudflare Worker. They are already in the repo — confirm you're OK keeping them there, or we can move them to a gitignored secrets file immediately.

> [!WARNING]
> **VIP/Auth gating is explicitly out of scope for this phase.** We stop after the store and live player are working end-to-end. The `Insiders.jsx` and `Account.jsx` pages will be scaffolded as stubs only.

> [!NOTE]
> Checkout stays on **Wix-hosted pages** — no payment handling in the PWA. The cart in localStorage builds a product list and then redirects to the Wix checkout URL.

---

## Open Questions

> [!IMPORTANT]
> **You need to provide these values before the app can connect to live data:**
> 1. `VITE_WIX_SITE_ID` — your Wix site ID (found in Wix dashboard → Settings)
> 2. `VITE_WIX_API_KEY` — a Wix API key with Commerce + Blog + Members scopes
> 3. `VITE_ABLY_SUBSCRIBE_KEY` — the Ably subscribe-only key (from Ably dashboard)
> 4. `VITE_VAPID_PUBLIC_KEY` — generated VAPID key pair (we can generate one together)
> 5. `VITE_MUX_PLAYBACK_ID` — the Playback ID for your existing Mux live stream
>
> The app will scaffold and run locally with placeholder values; real data connections come after these are filled in.

> [!NOTE]
> **Do you have a Cloudflare account and Pages project set up yet?** The CI/CD wiring (GitHub Actions → Cloudflare Pages) can be added now or later. For the initial phase we'll focus on the app itself and a locally-testable Worker via Wrangler.

> [!NOTE]
> **Icon assets**: I'll generate placeholder PWA icons (192×192 and 512×512) with a vine/craft aesthetic using the image generation tool. Do you have final brand assets you'd prefer to use instead?

---

## Proposed Changes

### Phase 1 Scope (this session)
1. Scaffold Vite + React + Tailwind + vite-plugin-pwa
2. Build `manifest.json` + PWA icons
3. Implement Cloudflare Worker (`/notify`, `/event`, `/featured-product`)
4. Implement `useWixProducts.js` hook
5. Implement `LivePlayer.jsx` with HLS.js + featured product poll
6. Wire together the `Home`, `Shop`, and `Live` pages
7. Scaffold stub pages for `Insiders` and `Account`

---

### Project Root

#### [MODIFY] README.md
Add project description, tech stack summary, local dev instructions, and env variable documentation.

---

### PWA Frontend

#### [NEW] vite.config.js
- Vite + React plugin
- `vite-plugin-pwa` with Workbox `generateSW` strategy
- Stale-while-revalidate runtime caching for `/api/*` (CF Worker), Wix API, and Mux
- Service worker registered in `src/main.jsx`

#### [NEW] tailwind.config.js
- Custom color palette: warm cream, deep burgundy, sage green, gold (brand-appropriate for a rustic craft business)
- Custom font: **Playfair Display** (headings) + **Inter** (body) via Google Fonts
- Dark mode: `class` strategy

#### [NEW] public/manifest.json
```json
{
  "name": "The Rustic Vine",
  "short_name": "Rustic Vine",
  "theme_color": "#6B2D3E",
  "background_color": "#FAF7F2",
  "display": "standalone",
  "start_url": "/",
  "icons": [...]
}
```

#### [NEW] public/icons/
- `icon-192.png` — generated rustic vine PWA icon
- `icon-512.png` — full-size version
- `apple-touch-icon.png` — for iOS home screen

#### [NEW] src/main.jsx
- React root render
- React Router v6 `<BrowserRouter>`
- PWA service worker registration

#### [NEW] src/App.jsx
- Route definitions: `/`, `/shop`, `/live`, `/insiders`, `/account`
- Bottom navigation bar (mobile-first)
- Toast notification layer

#### [NEW] index.html
- Correct `<meta>` tags (viewport, theme-color, apple-mobile-web-app)
- Preconnect to Wix, Mux, Ably domains
- Google Fonts link

---

### Pages

#### [NEW] src/pages/Home.jsx
- Pinned countdown banner to next live event (polls `GET /event` from CF Worker)
- "Shop This Week's Kit" shortcut card
- Blog post feed from Wix Blog API
- Upcoming events list
- `PushOptIn.jsx` banner on second visit (using `localStorage` visit counter)

#### [NEW] src/pages/Shop.jsx
- Product grid using `useWixProducts` hook
- `ProductCard.jsx` component with image, name, price, "Insider Price" badge (placeholder — full auth in Phase 2)
- Cart sidebar / drawer — state in `localStorage`
- "Checkout" button → redirects to Wix-hosted checkout URL

#### [NEW] src/pages/Live.jsx
- `LivePlayer.jsx` — full-screen HLS player
- `ChatPanel.jsx` — Ably real-time chat (below or overlay)
- "Shop This Craft" pinned button — polls CF Worker `/featured-product` every 30s
- Stream offline state (shows next event countdown)

#### [NEW] src/pages/Insiders.jsx *(stub)*
- "Coming soon — VIP login" placeholder screen
- Membership pitch copy

#### [NEW] src/pages/Account.jsx *(stub)*
- Push notification opt-in toggle
- "Sign in with Wix" placeholder button

---

### Components

#### [NEW] src/components/LivePlayer.jsx
- HLS.js player with native HLS fallback for iOS Safari
- Loads **muted** by default; prominent unmute button overlay
- Polls `GET /featured-product` every 30 seconds → updates "Shop This Craft" button
- Accepts `playbackId` prop; constructs `https://stream.mux.com/{playbackId}.m3u8`
- Error/offline states with friendly messaging

#### [NEW] src/components/ChatPanel.jsx
- Ably Realtime connection using subscribe-only key
- Channel: `rustic-vine:live-chat`
- Message list with auto-scroll
- Input field + send button
- Guest username generated from `localStorage` (e.g., "Crafter#4821")

#### [NEW] src/components/ProductCard.jsx
- Product image (Wix media URL)
- Name, price, short description
- "Add to Cart" button
- "Insider Price" badge (conditional)
- Hover animations

#### [NEW] src/components/PushOptIn.jsx
- Permission prompt banner (shown on second visit)
- Calls `usePushSubscription` hook
- Dismissible; stores dismissal in `localStorage`

---

### Hooks

#### [NEW] src/hooks/useWixProducts.js
- Uses **Wix Headless SDK** (`@wix/sdk`, `@wix/stores`)
- Fetches product catalog with pagination
- Returns `{ products, loading, error }`
- Caches in `sessionStorage` to reduce API calls

#### [NEW] src/hooks/useMuxStream.js
- Reads `VITE_MUX_PLAYBACK_ID` from env
- Checks stream liveness (optional — Mux Data API or simply attempts HLS load)
- Returns `{ playbackUrl, isLive }`

#### [NEW] src/hooks/useAblyChat.js
- Initializes Ably Realtime with subscribe key
- Subscribes to `rustic-vine:live-chat` channel
- Returns `{ messages, sendMessage, connectionState }`

#### [NEW] src/hooks/usePushSubscription.js
- Checks `Notification.permission`
- Registers service worker push subscription with VAPID public key
- POSTs subscription object to `POST /subscribe` on CF Worker
- Returns `{ isSubscribed, subscribe, unsubscribe }`

---

### Cloudflare Worker

#### [NEW] cloudflare-worker/index.js
Three endpoints + CORS headers for Cloudflare Pages domain:

| Endpoint | Method | Description |
|---|---|---|
| `GET /event` | GET | Returns next scheduled live event from KV (`next_event` key) |
| `GET /featured-product` | GET | Returns current featured product ID from KV (`featured_product_id` key) |
| `POST /notify` | POST | Broadcasts Web Push notification to all subscribers in KV |
| `POST /subscribe` | POST | Saves a new push subscription to KV |

**KV bindings needed** (defined in `wrangler.toml`):
- `RUSTIC_VINE_KV` — main store
  - `next_event` → JSON: `{ title, date, description }`
  - `featured_product_id` → string (Wix product ID)
  - `push_subscribers` → JSON array of Web Push subscription objects

**Worker secrets** (never in repo):
- `VAPID_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`
- `ABLY_ROOT_KEY`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`

#### [NEW] cloudflare-worker/wrangler.toml
- Worker name, KV namespace bindings, compatibility date

---

### Service Worker

#### [NEW] src/workers/sw.js
- Custom SW handlers (merged with Workbox-generated SW via `vite-plugin-pwa`)
- Push event handler: displays notification with `showNotification`
- Notification click handler: opens `/live` for stream notifications
- Background sync stub for cart (Phase 2)

---

### Config & Env

#### [NEW] .env.example
```
VITE_WIX_SITE_ID=
VITE_WIX_API_KEY=
VITE_ABLY_SUBSCRIBE_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_MUX_PLAYBACK_ID=
```

#### [NEW] .gitignore
- `.env`, `node_modules/`, `dist/`, `.wrangler/`

#### [NEW] package.json
Key dependencies:
- `react`, `react-dom`, `react-router-dom`
- `hls.js`
- `ably`
- `@wix/sdk`, `@wix/stores`, `@wix/blog`, `@wix/members`
- `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`
- `tailwindcss`, `autoprefixer`, `postcss`

---

## Verification Plan

### Local Dev
```bash
cd /home/tom/Projects/rustic-vine-mobile
npm run dev        # Vite dev server at localhost:5173
```

### Cloudflare Worker (local)
```bash
cd cloudflare-worker
npx wrangler dev   # Worker at localhost:8787
```

### PWA Checklist
- [ ] Lighthouse PWA audit passes (installable, offline fallback, push capable)
- [ ] `manifest.json` valid — Chrome DevTools → Application tab
- [ ] HLS.js plays `https://stream.mux.com/{PLAYBACK_ID}.m3u8` in Chrome
- [ ] Native HLS fallback verified in iOS Safari (via BrowserStack or real device)
- [ ] Ably chat connects and messages appear in real time
- [ ] `/featured-product` poll updates "Shop This Craft" button every 30s
- [ ] Cart persists across page refreshes via `localStorage`
- [ ] "Add to Home Screen" prompt fires on second visit
- [ ] Push notification permission prompt fires on first visit

### Browser Tests
- Chrome (Windows/Linux/Android)
- Safari (iOS) — HLS native fallback critical path
- Firefox — service worker + push support
