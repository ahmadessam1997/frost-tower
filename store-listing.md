# Frost Tower — Google Play listing

**App name (30 chars max):** `Frost Tower: Climb or Freeze` (28)
**Package:** `com.ahmadessam.frosttower`
**Version:** 1.0.0 (versionCode 1)

> **Rewritten 2026-07-31.** The previous version of this file declared
> "no ads", "no data collected" and "Free" with no purchases. All three are
> now false: the app ships AdMob and four one-time products. A data-safety
> form that contradicts the app or the privacy policy gets releases rejected,
> so the answers below are the ones to use.

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

👑 CHASE YOUR CROWN
• Score for every floor, big bonuses for combos
• Your best climb is saved on-device — beat it, then beat it again

📱 PERFECT FOR ONE HAND
• Free to play, works fully offline
• No account, no sign-up, no personal details
• Play a run in 30 seconds or lose an evening chasing floor 100
• Tiny download

Frost Tower is free and supported by ads shown between climbs. Prefer silence?
A single Remove Ads purchase turns them off for good.

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
| App interactions (ad impressions/clicks) | App activity | Advertising or marketing; Analytics | **Yes** — Google |
| Crash logs / diagnostics | App info and performance | Fraud prevention, security, and compliance | **Yes** — Google |
| Approximate location (derived from IP) | Location | Advertising or marketing | **Yes** — Google |

Not collected: name, email, phone, contacts, photos, precise location, messages,
health, calendar, files. **Game progress (scores, snowflakes, owned skins) stays
on the device and is not collected.**

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
| `remove_ads` | Remove Ads | $2.99 | Suppresses interstitials; reward videos stay opt-in |
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
