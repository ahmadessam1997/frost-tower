# Frost Tower — Google Play listing

**App name (30 chars max):** `Frost Tower: Climb or Freeze` (28)
**Package:** `com.ahmadessam.frosttower`
**Version:** 1.2.0 (versionCode 13)

> **Rewritten 2026-07-31.** The previous version of this file declared
> "no ads", "no data collected" and "Free" with no purchases. All three are
> now false: the app ships AdMob and four one-time products. A data-safety
> form that contradicts the app or the privacy policy gets releases rejected,
> so the answers below are the ones to use.

> **Updated 2026-10-02 for 1.2.0** — daily missions, power-ups, pause, a local
> reminder notification and Firebase Analytics events. What that changes in
> Play Console is collected under "1.2.0 — Play Console changes" below.

## Short description (80 chars max)
`Icy one-thumb climber. Bounce higher, chain combos, outrun the rising frost!` (76)

## Full description
The frost is rising. Climb. ❄️

FROST TOWER is a one-thumb endless climber in the spirit of the arcade
classics: you bounce automatically — your RUN SPEED becomes your JUMP HEIGHT.
Sprint, rebound off the walls, skip whole floors, and keep climbing before the
frost swallows the tower.

⚡ SPEED = HEIGHT
• Hold left or right to sprint — release into a bounce and fly
• Rebound off walls without losing speed, Icy-Tower style
• Skip 2+ floors in one leap to ignite combo chains ×5, ×12, ×20…
• The higher you climb, the narrower the ice — and the faster the frost

🏔 A TOWER WITH MOODS
• Ice platforms, moving platforms, cracking planks that crumble underfoot
• An aurora sky that shifts as you rise past floor markers
• A little frost sprite with a scarf who deserves better than freezing

❄️ NINE CLIMBERS TO COLLECT
• Earn snowflakes every run and spend them on new climbers
• Ember and Midnight unlock by climbing — no payment, just skill
• Mint Chip, Cocoa and Glacier cost snowflakes you earn in game
• Aurora, Golden Crown and Void Walker are optional premium unlocks

🎯 A NEW MISSION EVERY DAY
• One daily mission with a snowflake reward
• Claim on consecutive days to build a streak bonus
• Spend snowflakes on a Shield or a Head start for your next run

👑 CHASE YOUR CROWN
• Score for every floor, big bonuses for combos
• Your best climb is saved on-device — beat it, then beat it again
• Climb the global ranking with Google Play Games

📱 PERFECT FOR ONE HAND
• Free to play, works fully offline
• No account, no sign-up, no personal details
• Play a run in 30 seconds or lose an evening chasing floor 100
• Tiny download

Frost Tower is free and supported by ads shown between climbs. Prefer silence?
A single Remove Ads purchase turns every ad off for good.

How high before the frost catches you?

## Screenshot captions (rendered into play-assets/screenshot-1..6.png)
1. CLIMB FOREVER · 2. THE FROST IS RISING · 3. SPEED = HEIGHT
4. SKIP FLOORS, CHAIN COMBOS · 5. BEAT YOUR BEST CLIMB · 6. ONE THUMB. PURE FLOW.

> **TODO before submission:** the current six screenshots predate the shop and
> the skins. Replace at least one with a shop capture showing the nine climbers,
> and one showing a non-default skin mid-climb — Play requires screenshots to
> represent the actual app, and the collection loop is the main hook now.

## Play Console answers

| Question | Answer |
|---|---|
| Category | Game → Arcade |
| Free or paid | **Free** |
| Contains ads | **YES** (was "none") |
| In-app purchases | **YES — $1.99–$2.99 per item** |
| Content rating | Everyone / PEGI 3 — but the IARC questionnaire must be answered with **"contains ads" = yes** and **"digital purchases" = yes** |
| Target audience | **13+ — do NOT opt into the Families programme.** The art is cute enough that a "children" answer is tempting, but that pulls the app into Families policy, which requires certified ad SDKs and forbids the advertising ID. Staying 13+ keeps the current AdMob setup compliant. |
| Data safety | See table below — **NOT "no data collected" any more** |
| Privacy policy URL | `docs/privacy-policy.html` — host it (GitHub Pages → deploy from branch → /docs) |
| Data deletion URL | `docs/delete-data.html` — Play requires a *web* deletion route |
| Ad ID declaration | **YES**, the app uses the advertising ID |
| App access | No restricted areas — all content reachable without login |
| Government app | No |
| Financial features | No |

## Data safety form

Collected **and shared**, all "collected" (not ephemeral):

| Data type | Category | Purpose | Shared? |
|---|---|---|---|
| Device or other IDs (advertising ID) | Device or other IDs | Advertising or marketing; Analytics; Fraud prevention | **Yes** — Google |
| Purchase history | Financial info | App functionality; Account management | **Yes** — RevenueCat, Google Play |
| App interactions (ad impressions/clicks, and from 1.2.0 gameplay events sent to Firebase Analytics) | App activity | Advertising or marketing; Analytics | **Yes** — Google |
| Crash logs / diagnostics | App info and performance | Fraud prevention, security, and compliance | **Yes** — Google |
| Approximate location (derived from IP) | Location | Advertising or marketing | **Yes** — Google |

Not collected: name, email, phone, contacts, photos, precise location, messages,
health, calendar, files. **Game progress (scores, snowflakes, owned skins,
power-ups, mission progress and streak) stays on the device and is not
collected** — except that Firebase Analytics receives per-run numbers (floor,
score, seconds, snowflakes) as *App interactions*, and Play Games receives the
best floor for signed-in players.

## 1.2.0 — Play Console changes

| Area | Change needed? |
|---|---|
| Data safety — App interactions | **Review, probably no edit.** Already declared collected + shared with Google for *Advertising or marketing* and *Analytics*, which is what the new Firebase gameplay events are. Confirm *Analytics* is still ticked on that row and on *Device or other IDs*. |
| Data safety — everything else | No change. The reminder is a local notification: no push token, nothing leaves the device. |
| Permissions | The update adds `POST_NOTIFICATIONS` (asked at runtime on the first mission claim), `RECEIVE_BOOT_COMPLETED` and `WAKE_LOCK` (re-arm the reminder after a reboot), `ACCESS_NETWORK_STATE` (Firebase). None needs a declaration form. `SCHEDULE_EXACT_ALARM` is **stripped** in the manifest, so there is no exact-alarm declaration. |
| Privacy policy | `docs/privacy-policy.html` updated (analytics, notification, Play Games, Remove Ads wording). **Push `docs/` so the hosted page changes before the release goes live.** URL unchanged. |
| Store listing text | The full description above gained the mission / power-up / ranking lines and "turns every ad off". Exact text: `play-listing-1.2.0-ready.txt`. **Not live yet (2026-10-02):** the API commit was refused (403) — the `trapjam-publisher` service account lacks the store-listing permission on this app. Paste it in Play Console, or grant that permission and run `node listing.js --pkg com.ahmadessam.frosttower --lang en-US --text "../../frost-tower/play-listing-1.2.0-ready.txt" --commit` from `trap-jam/play-api`. |
| Ads declaration, content rating, target audience | No change. No new ad format or ad unit. |
| In-app products | No new products. Power-ups cost snowflakes, not money. **But the live Play description of `remove_ads` (read 2026-10-02) still says "Rewarded videos stay available if you want to earn extra snowflakes" — false since 1.1.0 (`ads.js`: Remove Ads silences every format, the rewarded video included). Change it to e.g. "Turns off every ad in Frost Tower for good, reward videos included. One-time purchase."** |

Other answers:
- Is all data encrypted in transit? **Yes**
- Can users request data deletion? **Yes** — the delete-data URL above
- Is data collected required or optional? Ad data is **required** (it funds the
  free game); purchase history is **optional** (only if you buy something)

## In-app products (create in Play Console → Monetize → Products → In-app products)

All four are **one-time, non-consumable "managed products"** — never
subscriptions, and never consumable, or a reinstall would wipe the unlock.

| Product ID | Name | Price | Notes |
|---|---|---|---|
| `remove_ads` | Remove Ads | $2.99 | Removes every ad format, reward videos included (since 1.1.0) |
| `skin_aurora` | Aurora climber | $1.99 | |
| `skin_golden` | Golden Crown climber | $2.99 | |
| `skin_void` | Void Walker climber | $2.99 | |

> **Ordering gotcha (cost adaptive-chess a session):** Play refuses to let you
> create in-app products until a build carrying the `com.android.vending.BILLING`
> permission has been uploaded to a track. Upload the AAB to closed testing
> FIRST, then create the four products, then set them **Active**.

Each product must also be imported into RevenueCat with an **entitlement of the
same id** attached, and all four added to an offering. The app additionally
falls back to the raw purchase list, so a missed entitlement degrades gracefully
rather than silently revoking a paid unlock.

## Asset inventory
- `play-assets/screenshot-1..6.png` — 1080×1920 framed marketing shots (**stale, see TODO above**)
- `play-assets/feature-graphic.png` — 1024×500
- `play-assets/play-icon-512.png` — Play Console icon
- `assets/icon.png` + `assets/splash.png` — baked into `android/` via `@capacitor/assets`
- `docs/privacy-policy.html`, `docs/delete-data.html` — host both before submitting
