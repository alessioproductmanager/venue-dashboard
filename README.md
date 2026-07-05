# Tiqets Supplier Tooling Hub — interview prototype (v4)

A working prototype built for a Junior Product Manager (B2B Supplier Tooling)
application at Tiqets. It simulates a channel-manager for cultural venues,
centered on two things a real supplier tool needs to nail: **fast product
creation/editing with a live preview**, and **live context for pricing**.

## Flow

1. **Staff badge login** (`js/login.js`) — a name and one of ten icons, no
   password. Every edit and push in the activity feed is signed with this.
2. **Onboarding quiz** (`js/quiz.js`) — three "boarding pass" steps: two
   knowledge checks about which cities have a Disney park, then a
   personalization step that reorders the destination list. Skippable;
   remembered per browser so returning visitors go straight to the hub.
3. **Product Hub** — a grid of Tiqets-style product cards per destination.
   - **Live pricing signals**: real live weather (Open-Meteo) + a mocked
     nearby-events feed + a "booking window" control, feeding a small
     rule-based pricing engine (`js/pricing.js`).
   - Click a card, or **"Add product"**, to open the editor: real editable
     fields (title, tagline, price, highlights, description, cancellation
     policy) next to a **live preview styled after a real Tiqets product
     page** (hero, rating, price box, included list, description,
     cancellation) that updates as you type. "Add product" also exposes
     Smart Ingestion — paste a URL, it detects a known destination and
     pre-fills the draft.
   - **Pricing assistant** inside the editor computes one concrete
     suggested price from the live signals, with an "Apply" button.
   - **Push panel**: after saving, push the product to every *connected*
     OTA channel (Tiqets, GetYourGuide, Viator, Klook, Expedia). Every
     edit and push is logged with who did it and when.
4. **Channel Sync** — connection toggles (mock OAuth) + the shared
   activity feed.
5. **API Monitoring** — per **product**, split into the four call types a
   real integration actually makes: Availability, Reservation, Booking,
   Cancellation. All simulated, labeled as such.
6. **Read Me** (in-app tab) — the goal, a live-updating list of which
   services are actually connected vs. mocked (reads `App.CONFIG`
   directly, so it flips to "LIVE" the moment a real key is added), and
   the architecture notes — so a reviewer doesn't have to leave the tool
   to see this.
7. **PM Profile** — the CV / case-for-hire tab.

## New in v4

- **Opening hours matter.** Each destination has representative real
  opening hours (`js/db.js` — see sources below). Every weather/event/match
  signal is now checked against whether the park is actually open when it
  happens (`js/hours.js`) — a match kicking off after closing gets flagged
  as low pricing relevance instead of triggering a discount that wouldn't
  make sense.
- **The Live Pricing Signals card is now actually live**, not a one-time
  snapshot: an "updated Xs ago" label, a live match countdown, a manual
  refresh button, and a background refresh every 90s.
- **Price calendar** inside each product's editor — 14 days, color-coded
  by demand tier (derived from the same weekend/event/match signals as the
  dashboard, seeded so it's stable across renders), with demo availability
  % and projected sales per day, and a "Schedule" button per day that sets
  a price override (`product.priceSchedule`).
- **Marketing Packages tab** — three tiers (Starter/Growth/Premium) per
  product with demo impressions/CTR/booking-lift numbers and a rule-based
  "AI suggestion" (reads the product's own status/review count — not a
  model call, so it's reproducible and explainable). Includes a mock
  checkout (no real payment, clearly labeled) that logs to the same
  activity feed as pushes.
- **Floating AI Product Assistant** (`js/assistant.js`) — ask about a
  product's status; calls Hugging Face if a token is configured, with an
  honest rule-based local fallback (and the same fallback fires if the
  model is cold-loading or the call fails). Every reply is tagged with
  its real source.
- **Bring-your-own-key panel**, in the Read Me tab — see below.

### Real opening hours used (representative baselines, not live — parks adjust by season)
- Disneyland Paris: 09:30–22:40 (confirmed via Tiqets' own listing)
- Magic Kingdom (Orlando): 09:00–22:00 (typical baseline, extends seasonally)
- Tokyo Disneyland: 09:00–21:00
- Disneyland (Anaheim): 08:00–22:00
- Hong Kong Disneyland: 10:30–20:30
- Shanghai Disney Resort: 08:30–20:30

## Keeping real API keys out of the public repo

`App.CONFIG.HUGGINGFACE_TOKEN` and `FOOTBALL_DATA_TOKEN` in `js/db.js`
**must stay empty** in anything you commit publicly. GitHub's secret
scanning partners with providers including Hugging Face — a real token
pushed to a public repo gets detected and the provider is notified to
revoke it automatically. That's not a bug to work around by hiding the
token cleverly in the code; there is no client-side hiding place a public
repo's scanner (or a browser's view-source) can't reach.

The actual fix: keys never go in the code at all. The Read Me tab has an
"Add your own API keys" panel — whatever you paste there is saved only to
`localStorage` via `App.DB.saveUserKeys()` and layered onto `App.CONFIG`
at runtime (`App.DB.applyUserKeys()`, called once on boot, before anything
else reads `App.CONFIG`). The committed file never changes. Each person
running this locally adds their own key if they want live data; nobody
else's key is ever at risk, and there's nothing for a scanner to find.

`js/worldcup.js` adds a second, opposite-direction signal next to nearby
events: a big match kicked off during typical visiting hours tends to
*reduce* attraction visits (people stay in to watch), unlike a concert or
expo nearby which tends to *increase* them. It also weights matches
involving the destination's own country higher (`countryTeam` in
`js/db.js`), since that's when the effect is strongest.

- **Live**: calls `football-data.org` v4, competition code `WC` (FIFA
  World Cup — free tier, forever, per their published policy), if
  `App.CONFIG.FOOTBALL_DATA_TOKEN` is set in `js/db.js`.
- **Mock fallback**: a small fixed fixture list, used automatically if no
  token is set or the request fails.
- **Getting a token**: register free at
  `https://www.football-data.org/client/register`, the token appears in
  your account area, send it as the `X-Auth-Token` header. Free tier: 10
  requests/minute, 12 competitions including the World Cup. This key only
  reads public fixtures — no billing or destructive risk — so embedding
  it client-side for this demo is a reasonable, low-stakes call, unlike
  the Hugging Face key mentioned below. Don't reuse it elsewhere.

## Push now lets you pick channels

The push panel in the product editor shows a checkbox per OTA channel —
connected channels are checked by default and editable, disconnected ones
are shown disabled with a "Connect in Channel Sync" hint, so you push to
exactly the channels you mean to, not a blind "everything".

## The pricing logic is grounded in real practice

`js/pricing.js` cites this in-app (see the small note under "Live pricing
signals"). Three real, checkable facts shaped the rules:

- Museums and attractions (SFMOMA, MoPOP Seattle, Indianapolis Zoo) already
  run demand-based pricing tied to day, season and weather.
- Disney's own parks already vary published ticket prices by calendar date.
  The Empire State Building goes further and adjusts prices live with an
  algorithm that factors in demand, weather, time of day and nearby events —
  functionally the same signal set this dashboard uses.
- Framing matters: research on visitor acceptance found dynamic pricing
  lands much better presented as an off-peak saving than as a peak
  surcharge, and advance bookings are usually rewarded rather than
  penalized. The suggestion copy follows that framing.

## What's real vs. mocked

| Piece | Status |
|---|---|
| Weather (Open-Meteo) | **Real, live**, no API key needed |
| Nearby events | Mocked — small fixed dataset (`js/events.js`) |
| World Cup fixtures | **Real, live** if a football-data.org key is added via the Read Me tab — mocked otherwise |
| Opening hours | Representative real baselines, not a live feed (see sources above) |
| Smart Ingestion | Mocked — detects a destination name in the pasted URL text, doesn't scrape cross-origin |
| OTA OAuth connect / push | Mocked — no real GetYourGuide/Viator/Klook/Expedia credentials |
| API Monitoring (per product) | Simulated — labeled "demo only" in the UI |
| Price calendar | Simulated demand/availability/sales — no real inventory system |
| Marketing Packages | Simulated projections + mock checkout — no ad platform or payment processor connected |
| AI Product Assistant | **Real Hugging Face call** if a key is added via the Read Me tab — honest rule-based fallback otherwise |
| Login | Name + icon only, no password, no server — a label for the activity feed, not real auth |
| "Database" | `localStorage`, wrapped in `js/db.js` — persists in the browser only |

## Running it

No build step. Open `index.html` directly, or serve the folder:

```
npx serve venue-dashboard
```

Reset all demo state (login, quiz, catalog, connections, activity) from the
browser console: `App.DB.reset()` — or clear site data for the page.

## About the Hugging Face key

`App.CONFIG.HUGGINGFACE_TOKEN` in `js/db.js` is an intentionally empty
placeholder. An earlier draft had a real token hardcoded client-side — if
you're reusing anything from that draft, rotate/revoke that token in your
Hugging Face account first. Any secret written into a file the browser
downloads is visible to anyone who views source; the safe way to add a real
AI call back in is a small serverless proxy that holds the key server-side.

## Structure

```
index.html
css/  variables · base · layout · components · quiz · login · editor · animations
js/   db (config + mock persistence + activity log) · ui · login
      weather (real) · events (mock) · worldcup (real if keyed, else mock)
      pricing (booking-window + match aware) · ota (connections + selective push + activity feed)
      apihealth (per product × 4 call types, simulated) · readme (live connected-services list)
      quiz · editor (cards + create/edit modal + live preview + channel picker) · dashboard · app (bootstrap)
```
