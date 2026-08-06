# Session notes — 2026-07-31 — monetization (skins, coins, ads, IAP) + Play Console

Frost Tower went from a free, offline, zero-data arcade game to a free
ad-supported game with a coin economy, nine collectible climbers and four
one-time purchases. Play Console app created and the store listing completed.
Nothing is public — the app is a **Draft** and no bundle has been uploaded.

Owner decisions taken at the start of the session: **RevenueCat** for billing
(over a raw Play Billing plugin), **interstitial + rewarded** ads (over
banner-inclusive or interstitial-only), and a **mixed skin economy** (milestone
+ coins + premium) over all-IAP or a single bundle.

## What was built

- **9 skins** (`www/js/skins.js`), drawn procedurally so the download stays tiny:
  `frost` free · `ember` floor 30 · `midnight` score 6000 · `mint` 250 ❄ ·
  `cocoa` 600 ❄ · `glacier` 1000 ❄ · `aurora`/`golden`/`void` real money.
  Each has a body gradient, scarf, eye colour, trail colour, optional glow and
  an accessory painter (flame, crescent, chips, marshmallow, ice shards, crown,
  clipped starfield). Aurora hue-cycles per frame.
- **Coin economy**: `floor(score / 25)` per run, +50 per rewarded video.
- **Shop** (`www/js/shop.js`) — grid with owned/coin/premium/milestone states,
  progress bars toward milestones, Remove Ads tile, Restore purchases, animated
  live previews of every skin.
- **Ads** (`www/js/ads.js`) — interstitial every 3rd run that lasted ≥8s, 90s
  cooldown, only between runs; rewarded for a once-per-run revive (needs floor
  ≥10) and for shop coins.
- **Billing** (`www/js/billing.js`) — RevenueCat with three explicit states, see
  "fail closed" below.
- **Revive**: drops the player onto the highest surviving platform, pushes the
  frost well down, grants 1.6s of frost immunity with a blink, once per run.

The single-file game was split into `www/index.html` + `www/js/*.js`
(config, save, skins, billing, ads, shop, game). One file could not carry this.

## Root causes / decisions worth remembering

- **Capacitor 7 → 8 was forced, and it is what clears the Play Billing
  deadline.** RevenueCat's Capacitor plugin ≥12 requires `@capacitor/core >=8`,
  and `@capacitor-community/admob@8` likewise. Staying on Capacitor 7 would have
  meant RevenueCat 11, which rides an older purchases-android. On Capacitor 8,
  `@revenuecat/purchases-capacitor@13.3.0` pulls
  `purchases-hybrid-common:18.28.0` → **`com.android.billingclient:billing:8.3.0`**,
  verified from `gradlew :app:dependencies`, not assumed. Play blocks updates
  published after 31 Aug 2026 that ship BL < 8. adaptive-chess lost a whole
  session to exactly this wall; Frost Tower cleared it by accident of being
  newer, but only because the upgrade was taken rather than pinning old plugins.
- **Billing FAILS CLOSED.** Three states: `mock` (browser only, gated on
  `Capacitor.isNativePlatform() === false`, prices suffixed `· DEV`), `ready`
  (native + key), `unavailable` (native, no key → buttons disabled, "Store
  unavailable", grants nothing). HomeKept shipped the opposite once and its dev
  mock handed out free lifetime access; that mistake is structurally impossible
  here because the mock cannot activate in a packaged build.
- **Entitlements are read twice.** `customerInfo.entitlements.active` is the
  documented path, but a product imported into RevenueCat without an entitlement
  attached would silently revoke a paid unlock. So `allPurchasedProductIdentifiers`
  is also trusted (safe — all four products are non-consumable). Wire the
  entitlements properly anyway.
- **Products are fetched one at a time.** adaptive-chess found that a single
  inactive SKU poisons a whole batch query and produces "the sku was not found".
- **User cancellation is not an error.** HomeKept surfaced a scary "Purchase
  failed" alert on cancel; here cancel returns `{cancelled:true}` and shows
  nothing.
- **Remove Ads suppresses interstitials only.** Rewarded videos stay reachable
  because they are opt-in and are the only coin faucet. The shop says so
  explicitly, and so does the privacy policy, so nobody feels cheated.

## Gotchas discovered (expensive ones)

- **Chrome throttles `requestAnimationFrame` to zero in a tab it considers
  hidden.** Driving the game through the live browser looked like a physics bug
  — the climber never moved and a `rAF`-awaiting probe hung for 45s and returned
  "renderer may be frozen". `document.visibilityState` was `hidden`. It was a
  harness artifact, not a game bug. Anything that needs the game loop to advance
  must run under Puppeteer (foregrounded), not the attached browser.
- **Play Console's asset picker needs three steps, not one.** Uploading into the
  hidden `input[type=file]` only puts the file in the asset *library*. You then
  have to click the asset row, click the `arrow_right_alt` (open detail), and
  click **Add**. Closing the panel instead discards the selection and the slot
  stays empty. Also: the Add button's `innerText` is `"add_photo_alternate Add"`
  (icon ligature + label), so an exact `=== 'Add'` match silently fails.
- **Play Console screenshots time out constantly** (`Page.captureScreenshot`
  after 30s) — the Angular app is heavy. Retrying once usually works;
  `read_page` and in-page JS are far more reliable than screenshots there.
- **Play Console renders no plain text at the top level** — `get_page_text`
  returns almost nothing and the app list is virtualised. Read it with JS
  against the DOM, or screenshots.
- **Setting a value on an Angular textarea needs the native setter** plus an
  `input` event, and even then the *validation* stays red until a real keystroke
  lands. Type a space and backspace it to clear the error.
- Java 21 is required (Android Studio JBR at
  `C:\Program Files\Android\Android Studio\jbr`); the machine default is 17 and
  fails with "invalid source release: 21". Same as the 2026-07-11 session.

## Testing

`npm test` → `test/e2e.js`, Puppeteer at 412×915 @2.62dpr. **42 assertions, all
passing**, covering: boot state, a real climb (real input events, real physics),
a real game-over, coin crediting, milestone thresholds (including the
one-short-of-threshold negative case), coin spend + overspend refusal, mock
premium purchases, remove-ads suppressing the interstitial, all nine skins
drawing without throwing, preview canvases actually painting pixels,
persistence across reload, **corrupt-save resilience**, **v1 `ftb` high-score
migration**, and zero console errors.

Two test bugs found and fixed, both in the harness rather than the game: the
milestone assertion assumed Ember had not already been earned by the real climb
in step 2, and the favicon 404 filter missed because the console message text
carries no URL (it is on `message.location()`).

**Not verified — needs a device:** an interstitial actually appearing, a rewarded
video paying out, the revive on real hardware, any real purchase, and restore
after reinstall. Purchases only work on a build installed *from Play*.

## Store screenshots

`test/gen-screenshots.js` (re-runnable) captures genuine in-app frames and
composes framed 1080×1920 shots matching the v1 art direction (navy gradient,
blurred orbs, bold caption, rounded phone frame). Two problems caught and fixed
while generating:

1. Shot 3 captured the **game-over card instead of a climb** — the frost speed
   ramps with elapsed run time (`26 + maxFloor*0.9 + tGame*1.1`), so reusing a
   12-second-old run lands the capture on the wrong screen. Fixed with a
   `freshRun()` helper before each in-game shot.
2. Shot 4 showed **"✓ Ads removed"** — i.e. advertising the already-purchased
   state, which is weak marketing and implies the app ships ad-free. The
   generator now revokes `remove_ads` for that capture so the $2.99 offer shows.

The six shots now show real combos (×11 with Aurora, ×3 with Void Walker) and
the actual shop.

## Legal / store docs — REWRITTEN, and this mattered

The v1 policy said *"Frost Tower collects no data. None."* and *"no advertising
SDKs, no tracking of any kind."* Both became false the moment AdMob and
RevenueCat shipped. A privacy policy that contradicts the data-safety form is
one of the most reliable ways to get a release rejected.

- `docs/privacy-policy.html` — new, hostable. Documents the advertising ID,
  AdMob and RevenueCat as processors, purchase history, what stays on-device,
  and a deletion route.
- `docs/delete-data.html` — new. Play requires a **web** deletion route.
- `privacy-policy.md` — marked **SUPERSEDED**, kept only as history. Do not host.
- `store-listing.md` — rewritten: contains ads = **YES**, IAP **$1.99–$2.99**,
  full data-safety table, and **target audience 13+ — do NOT join the Families
  programme** (it forbids the advertising ID this AdMob setup uses).

## Native config

- `android/` regenerated for Capacitor 8 (`cap add android`); the Capacitor 7
  project is preserved at `android.cap7.bak/` (32 MB, safe to delete).
- Manifest: AdMob `APPLICATION_ID` meta-data (**app crashes on launch without
  it**), `com.google.android.gms.permission.AD_ID`. Merged manifest verified to
  contain `com.android.vending.BILLING` — which is what unblocks IAP product
  creation in Play Console.
- targetSdk/compileSdk 36, minSdk 24, versionCode 1, versionName 1.0.0.
- Signing wired: `signingConfig` reads a gitignored `keystore.properties`; if
  absent the release build stays unsigned rather than failing, so a fresh clone
  still compiles. Added a `.gitignore` (the project had none) blocking `*.jks`
  and `keystore.properties`.
- `gradlew assembleDebug` **succeeds** (13 MB debug APK).

## Play Console state

- Developer account `ahmadessam1997` / `7599532919585116115`.
- App **created**: `Frost Tower: Climb or Freeze`, `com.ahmadessam.frosttower`,
  Game, Free, en-US. App ID **`4973059284762378472`**. Status **Draft**.
- Both creation declarations (Developer Programme Policies, US export laws)
  accepted, with the owner's explicit go-ahead.
- **Store listing complete and saved**: name, short (76/80), full (1571/4000),
  icon 1/1, feature graphic 1/1, phone screenshots 6/8.
- Existing sibling apps confirmed on the account: Adaptive Chess (Closed
  testing), HomeKept (Draft), Investment Tracker (Production).

## Not done / blocked

1. **Keystore** — owner chose to run `keytool` themselves so the password stays
   theirs. Until then no release AAB. Unlike adaptive-chess (whose upload key
   lives in EAS's cloud), this project signs locally, so the `.jks` really is
   unrecoverable if lost. Back it up off-machine.
2. **Hosting the legal pages** — this project is **not a git repo**, so GitHub
   Pages is not set up. App content in Play Console is hard-blocked on public
   URLs for the two `docs/*.html` files.
3. **App content section** — privacy policy URL, data deletion URL, data safety
   form, ads declaration, IARC rating, target audience. All blocked on (2).
4. **AdMob account** — ships with Google's **test** ad unit IDs (`isTest: true`).
   Real IDs go in `www/js/config.js` *and* the manifest, which must match.
   Never test real ad units on your own device; that gets accounts banned.
5. **RevenueCat account** — `androidApiKey` is empty, so billing is
   `unavailable` on device by design.
6. **Play products** — cannot be created until a BILLING-permission build is
   uploaded to a track. Upload first, then create the four products, then
   activate them.
7. **Closed test** — 12+ testers for 14 continuous days. That clock is the only
   thing setting the launch date; start it as soon as an AAB exists, even with
   test ad IDs.

## Known issues, deliberately not fixed

- `frost-tower.html` at the project root is a **stale v1.0 snapshot** with no
  shop, skins, ads or purchases. It used to be a byte-identical duplicate of
  `www/index.html`, kept in sync by hand; that is impossible now that the game is
  split across modules. It carries a loud banner comment saying so. Not deleted
  because this is not a git repo and there would be no way back.
- The coin grind for `glacier` (1000 ❄) is long — roughly 35–40 runs, or 20
  rewarded videos. Worth re-tuning after real play data.
- No coin-pack IAP. Deliberate: the owner asked for skins, ads and remove-ads,
  and adding a currency pack changes the store's character.
- `minifyEnabled false` — matches the sibling games; avoids ProGuard surprises
  with the ads/billing SDKs at the cost of some size.

## Key file map

| File | Purpose |
|---|---|
| `www/js/config.js` | **The only file to edit when the real accounts exist** — AdMob IDs, RevenueCat key, product IDs, ad pacing, economy tuning |
| `www/js/billing.js` | RevenueCat wrapper, three-state, fail-closed |
| `www/js/ads.js` | AdMob wrapper, never rejects |
| `www/js/skins.js` | Skin registry + procedural rendering |
| `www/js/save.js` | Persistence + v1 migration + corruption repair |
| `GO-LIVE.md` | Ordered runbook with the Play/AdMob/RevenueCat click paths |
| `store-listing.md` | Listing copy + every Play Console answer |
| `test/e2e.js` | 42-assertion suite (`npm test`) |
| `test/gen-screenshots.js` | Regenerates the six store screenshots |
