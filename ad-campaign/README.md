# Frost Tower: Climb or Freeze — ad campaign

Google Ads App campaign material for this title. Published from
`ad-campaigns/` by `distribute.js` — edit the source there, not these copies.

- Package: `com.ahmadessam.frosttower`
- Play listing: https://play.google.com/store/apps/details?id=com.ahmadessam.frosttower
- Google Ads account: 484-455-8362

## Campaign settings

| Setting | Value |
|---|---|
| Objective | App promotion |
| Type / subtype | App / App installs |
| Platform | Android |
| Campaign name | `Frost Tower — App installs — Android` |
| Locations | United States and Canada |
| Languages | English |
| Bidding | Maximize installs, no target CPI until ~30 conversions |
| Daily budget | $1.10 (portfolio total $6.60/day across six campaigns) |

## Images — `images/` (8 accepted)

Upload all of them; Google picks per slot. The A/B pair of each core
ratio differ in composition and hook so asset-level reporting can tell
you which direction won.

| File | Size | Slot |
|---|---|---|
| `landscape-1200x628-a/b.png` | 1200x628 | landscape 1.91:1 |
| `square-1200x1200-a/b.png` | 1200x1200 | square 1:1 |
| `portrait-1200x1500-a/b.png` | 1200x1500 | portrait 4:5 |
| `mrec-300x250.png` | 300x250 | in-app display |
| `interstitial-320x480.png` | 320x480 | interstitial |

### `not-accepted-by-google-ads/`

`leaderboard-728x90.png` was **rejected on upload** — Google Ads returned
*"Dimensions aren't allowed"* for it while accepting the other eight. Kept
because AdMob house ads do accept that size, which becomes worth doing once
this app has traffic of its own.

## Headlines (max 30 characters)

| # | Headline | Len |
|---|---|---|
| 1 | The Frost Is Rising | 19 |
| 2 | Speed Becomes Height | 20 |
| 3 | One Thumb. Pure Flow. | 21 |
| 4 | Climb Or Freeze | 15 |
| 5 | Chase Floor 100 | 15 |

## Descriptions (max 90 characters)

| # | Description | Len |
|---|---|---|
| 1 | Hold left or right to sprint, release into a bounce, and fly up the tower. | 74 |
| 2 | Rebound off walls without losing speed. Skip floors to ignite combo chains. | 75 |
| 3 | Nine climbers to collect. Earn snowflakes every run and spend them on skins. | 76 |
| 4 | A run takes 30 seconds, or lose an evening chasing floor 100. Works offline. | 76 |
| 5 | Free, a tiny download, no account and no sign-up. Just start climbing. | 70 |

## Video — `video/`

Google Ads takes video only as a **YouTube URL**, never a file upload.
Upload the clip to YouTube (unlisted is fine) and paste the URL into the
campaign. A campaign with no video asset is shut out of YouTube inventory.

| | |
|---|---|
| File | `video/frost-tower-ad.mp4` |
| Spec | 1080×1920 (9:16), 51.0 s, 30 fps, H.264 + silent AAC, 14 MB |
| Replaces | `video/frost-tower-gameplay-v1-old.webm` (26.8 s) |
| Harness | `video-src/` |
| YouTube | `2lJZSEoL44g` — public on the channel, served as a Short |
| In the campaign | the only video asset on ad group 1 since 25 Sept 2026 (replaced `tt583d3WMdk`) |

### Why the first clip had to go

`frost-tower-gameplay.webm` was a MediaRecorder capture of a scripted run at
full 1080×1920. Three things went wrong at once:

- **The play was bad.** A fixed left/right alternation cannot sprint into a
  wall to rebound, which is the entire skill of the game, so it plateaued
  around floor 15 and the captured take ended on **floor 7**.
- **Nothing was legible.** At 1080×1920 the viewport is the whole tower, so
  the climber is a ~32 px speck and the HUD is tiny. You cannot tell what the
  game is.
- **It showed one skin, one floor band and no shop** — none of the collection
  loop the listing leads with.

### What the new one does

Fifty-one seconds, cut into scenes, each with a caption over live gameplay:

| Time | Scene |
|---|---|
| 0:00 | cold open, then the title |
| 0:03 | **SPEED = HEIGHT** — sprinting, then the wall rebound |
| 0:10 | **SKIP FLOORS, CHAIN COMBOS** — combos into the ×30s |
| 0:17 | **MOVING PLATFORMS** (floor 34), **PLANKS THAT CRUMBLE** (68), **A SKY THAT CHANGES** (132) |
| 0:30 | the shop — all nine climbers with their real unlock costs |
| 0:33 | six climbers worn in play, each with a large drawn badge: Ember, Midnight, Mint Chip, Cocoa, Glacier, Aurora |
| 0:43 | **THE FROST IS RISING** with the frost line right under the climber |
| 0:47 | end card |

Two things make it readable where the old clip was not:

- **The viewport is 540×960 at `deviceScaleFactor: 2`.** Native 1080×1920
  output, but the game's own responsive layout zooms the world 2×, so the
  climber, the HUD and the combo text are all twice the size. This is the
  single biggest difference; do not capture at 1080×1920 CSS pixels.
- **Each skin gets a large `FTSkins.drawPreview()` badge** in the caption.
  The in-game climber is often small and far across the screen, so the badge
  is what actually sells the skin.

### Rebuilding it — `video-src/`

```
ftpilot.js     the climber: short-horizon MPC over the game's own physics
ftoverlay.js   the ad layer (captions, badges, end card) + the timeline
ftrender.js    puppeteer driver: ticks the game, paints the overlay, screenshots
ft_seeds.json  the chosen RNG seed per scene (delete, or set RESEED=1, to re-search)
```

It renders against a **copy** of `www/` with two additions, never the shipping
source:

1. a `window.__FT` harness exposing the game's private state plus `tick()`,
   `warp(floor)` and `setDir()`, and a `window.__FT_MANUAL` flag that parks the
   game's own `requestAnimationFrame` loop so frames are deterministic;
2. `shop.js` with the `· DEV` price suffix removed — that suffix only appears
   because `Billing.isMock()` is true off-device, so dropping it shows the
   shop exactly as a real device does.

`Math.random` is replaced with a seeded LCG, so a good run is reproducible:
`ftrender.js` dry-runs 24 seeds per scene and keeps one where the pilot
survives the whole segment and climbs furthest.

### The pilot

The old clip's problem was the input pattern, not the frame rate. A one-step
lookahead fixes it: every frame the pilot replays the game's physics forward
2 seconds for each of `dir = -1, 0, +1` and keeps whichever climbs highest
without dropping out of frame.

| Strategy | Best floor |
|---|---|
| hold one direction | 1 |
| fixed 1 s alternation (the old clip) | 16 |
| push the way you're already moving | 13 |
| **2 s lookahead MPC** | **169** |

`ftpilot.js` treats moving platforms as static inside the horizon, which is
close enough over 2 s and keeps the search cheap.

### Honest notes

- The save is seeded with a plausible `best` (8,420) and 1,240 snowflakes so
  the HUD and the shop wallet are not zeroes. Skin ownership is left at the
  default, so the shop shows genuine `LOCKED` / `250 ❄` / `$1.99` states.
- Scenes are cut to floor bands with `warp()` rather than played from floor 1 —
  a single continuous run to floor 132 would be several minutes long.
