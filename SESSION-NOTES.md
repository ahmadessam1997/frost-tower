# Session notes

## 2026-08-06 (later) — AAB uploaded, closed track fully staged, blocked on IARC

The first AAB is **uploaded and processed**, the closed testing track is
configured, and **15 changes are staged in Publishing overview**. The submit
button is blocked by exactly one thing: **Incomplete content ratings
declaration**. That is the IARC questionnaire, which needs the owner.

**Closed testing - Alpha — 3 of 4 setup steps complete:**

| Step | State |
|---|---|
| Create a new release | **Done** — build `1 (1.0.0)`, 9.25 MB download, uploaded from the existing AAB (no rebuild) |
| Select country | **Done** — all **177** countries/regions targeted, verified after reload |
| Select testers | **Done** — email list `HomeKept Closed Testers` (2 users), feedback channel `ahmadessam1997@gmail.com` |
| Send for review | **BLOCKED** on the IARC content rating |

Play Console reported the bundle as: version `1 (1.0.0)`, API levels `24+`,
target SDK `36`, screen layouts 4, ABIs `All` — matching the build config.
**Play App Signing was already enabled** ("Releases are signed by Google Play"),
so there was no opt-in decision to make at first upload.

Release notes were written for `en-US` (first-closed-test blurb, the three
monetization bullets, and a request to report crashes / purchase problems /
missing ads).

**The one remaining warning is expected and fine:** "no deobfuscation file
associated with this App Bundle". This project sets `minifyEnabled false`
deliberately, so there is no mapping file to upload. Not a problem.

> **The 2-tester list does NOT satisfy the 12-tester rule.** The owner chose to
> reuse `HomeKept Closed Testers` to get the track live. Production access needs
> **12 testers opted in for 14 continuous days**, so a real list still has to be
> built and the clock only starts once the release is actually live.

**How to upload an AAB from here (the file-path trap):** the `file_upload` tool
only accepts files the session is allowed to read, and
`D:\Current\Projects\...\app-release.aab` is **not** one of them. Copy it into
the session scratchpad first and upload from there — verify with `Get-FileHash`
that the copy is byte-identical before uploading. (`10,017,837` bytes,
SHA-256 starts `15CF4897B72AD3A8`.)

**Play Console URL corrections** — both of the obvious guesses are wrong:

| Wrong | Right |
|---|---|
| `/tracks/closed-testing` | `/closed-testing` (the `/tracks/...` form errors with `490D9AD7`) |
| `/publishing-overview` | `/publishing` (the `-overview` form bounces to the app list) |

Navigating by clicking the left nav is more reliable than either. The nav needs
`Test and release` expanded, then `Testing`, then the track.

**Next, in order:**

1. **Owner: complete the IARC questionnaire** (`App content → Content rating`).
   Answers are already decided in `store-listing.md`: ads **yes**, digital
   purchases **yes** → expect Everyone / PEGI 3.
2. Then **Publishing overview → Submit 15 changes for review**. Everything else
   is already staged and waiting.
3. Once live, build a real tester list of 12+ and start the 14-day clock.
4. Then the four in-app products (Play refuses to create them until a
   BILLING-permission build is on a track — after step 2 that is satisfied),
   then import them into RevenueCat with one entitlement each.

---

## 2026-08-06 — Data safety COMPLETE, category + contact details; 10 of 11

App content checklist went **8 of 11 → 10 of 11**. Only **Content rating
(IARC)** is left, and that one needs the owner. **Closed testing is now
unlocked** — the dashboard previously read `lock — To start a closed test,
finish setting up your game`; it no longer does.

**Data safety — submitted, not just drafted.** Verified by hard-reloading the
dashboard and seeing `check` against Data safety. Steps 1–3 were intact on
resume (deletion URL still populated, all six data types still selected — a
collapsed section reads `check_circle 1/1 data type selected`, which is how you
confirm one without expanding it).

Step 4, "Data usage and handling", all six rows. Every row is Collected **and**
Shared, and none is ephemeral:

| Data type | Required? | Purposes (collected = shared) |
|---|---|---|
| Purchase history | **Users can choose** | App functionality; Account management |
| Approximate location | Required | Advertising or marketing |
| Crash logs | Required | Fraud prevention, security and compliance |
| Diagnostics | Required | Fraud prevention, security and compliance |
| App interactions | Required | Advertising or marketing; Analytics |
| Device or other IDs | Required | Advertising or marketing; Analytics; Fraud prevention, security and compliance |

Purchase history is the only **optional** one: the user chooses whether to buy.
Everything else is ad/SDK-driven and cannot be turned off, so it is *required*.

**Store settings — also done:**

- **App category**: App or game = `Game`, Category = `Arcade` (per `store-listing.md`).
- **Store Listing contact details**: email `ahmadessam1997@gmail.com`, website
  `https://ahmadessam1997.github.io/frost-tower/`, **phone deliberately blank**.
  Owner chose these; the email is published publicly on the listing.

### The expensive lesson: a dialog "Save" is not persistence

The first pass through step 4 *looked* finished — all six rows read `Completed`
— and the step-5 **Save** even reported `saved. Send for review in Publishing
overview.` But after a reload, **Device or other IDs was back to `Not started`**
and the dashboard still showed 8 of 11.

What actually happened: the only state that survived was the state as of the
last **Save draft** click, which had been made when five rows were done. The
sixth row's dialog-Save, and the step-5 Save, both silently failed to commit it.
The tell was that step 5 offered **two** enabled `Save` buttons — one belonged to
a stale, detached dialog — and the click went to the wrong one. On the second
pass there was exactly **one** enabled `Save`, and it committed.

**Therefore, the rule for this form:** after every individual row, click the
form-level **Save draft**; then reload the page and re-read the row statuses
before trusting them. Treat "the row says Completed" as unverified until it has
survived a reload. `Save draft` disabling itself afterwards is a good signal
that there is nothing uncommitted.

**Other gotchas (all cost real time):**

- **The dialog cannot be found reliably by `[role=dialog]`.** A freshly opened
  dialog may not be in that query yet, while a *stale* dialog from a
  previously-saved row stays in the DOM at full height and wins `.pop()`.
- **`document.elementFromPoint` is not safe either** — the stale overlay can
  still be the topmost painted element, so hit-testing returned `Purchase
  history` while `App interactions` was visibly on screen.
- **What works:** the dialog root is `div.popup`. Select
  `[...document.querySelectorAll('div.popup')]`, keep those that are connected,
  taller than 300px, contain a `material-checkbox`, and whose
  `innerText.split('\n')[0]` **equals the data type you just opened**, then
  `.pop()`. **Always assert the resolved title before ticking anything.**
- **Selector shape depends on window width.** At ~770px the earlier
  title-matching selector stopped resolving; the rows are virtualised and simply
  absent from the DOM until scrolled into view. Resize to ~1600×1000 first.
- **`input.click()` on the inner `input[type=checkbox]`/`radio` works.** Plain
  `.click()` on `Start`/`Save` buttons works too — the earlier belief that it
  did not was a misread caused by slicing `document.body.innerText` from the
  wrong offset. `row.querySelector('button')` is *not* enough, though: it can
  grab the section collapse toggle. Match on the button whose text is `Start`.
- **`Runtime.evaluate` times out at 45s on this page**, but the work usually
  *completes* anyway — the timeout is the CDP round-trip, not the page. Re-query
  state in a fresh short call before redoing anything. Keep each script to
  roughly one question's worth of clicks.
- Play Console threw `An unexpected error has occurred (724AB855)` once when a
  long script raced it. Smaller steps stopped it recurring.
- **Deep links still bounce** — `publishing-overview` loaded cold dumped us on
  the app list. Load `app-dashboard` first.
- The Chrome extension disconnected mid-session. Chrome itself kept the page and
  all injected `window.__*` helpers alive; bringing the Chrome window to the
  foreground woke the extension and everything resumed intact.

---

## 2026-08-05 — keystore, hosting, RevenueCat, most of App content

Picked up from the 2026-07-31 session below; nothing had changed on disk in
between. Tests re-verified at **42/42** twice (before and after the config
change). Owner decisions this session: **Claude generates the keystore**,
**whole project public on GitHub**, **AdMob + RevenueCat before the first
upload**.

**Unblocked:**

- **Keystore created** — `android/frosttower-upload.jks`, alias `upload`,
  SHA-1 `8A:24:2C:C5:75:D8:B1:14:9B:4C:46:29:29:90:0B:1E:DE:1B:E8:4F`, valid to
  2053. Password in the gitignored `android/keystore.properties`. `bundleRelease`
  now emits a **signed** 10.0 MB AAB. Unlike adaptive-chess's blank certificate
  DN, this one is real (`CN=Ahmad Essam, O=Ahmad Essam, C=US`), so there is no
  ambiguity about where the key lives — it is on this disk and nowhere else.
- **Project is now a git repo** and public at
  `github.com/ahmadessam1997/frost-tower`, Pages serving `/docs` from `main`.
  Both legal pages verified HTTP 200. That removes the reason the 2026-07-31
  notes gave for keeping `frost-tower.html` and `privacy-policy.md` around
  ("no way back") — history now covers it.
- **RevenueCat** project `Frost Tower` (`c9b2848b`) + Play Store app
  (`appb1be81e0e7`, Capacitor platform). Public key
  `goog_AmTMmpCjnxrMXGguNLpiuVCsEJG` is in `config.js` and verified present
  inside the built AAB.
- **App content: 8 of 10 declarations saved** — privacy policy URL, ads = YES,
  sign-in details = No, target audience 13+ (Families avoided), advertising
  ID = YES, government = No, financial = none, health = none.
- **Data safety: saved as a draft, steps 1–3 of 5 done.** Collects/shares = Yes,
  encrypted in transit = Yes, no account creation, no external logins, deletion
  URL set. Six data types selected: **Approximate location, Purchase history,
  App interactions, Crash logs, Diagnostics, Device or other IDs.** Step 4
  ("Data usage and handling") is untouched — all six rows read *Not started*.
  Resume by opening each row's **Start** and answering from the table in
  `store-listing.md`: everything is collected **and shared**, none ephemeral, ad
  data **required** and purchase history **optional**.

**Verification log** — what was actually checked, not assumed. Every one of
these is re-runnable:

| Claim | Check | Result (2026-08-05) |
|---|---|---|
| Suite passes | `node test/serve.js` then `npm test` | `42 passed, 0 failed` — run twice, before and after the RevenueCat key |
| AAB is signed | list `META-INF/*.{SF,RSA}` in the AAB zip | `META-INF/UPLOAD.SF`, `META-INF/UPLOAD.RSA` (empty before the keystore existed) |
| AAB size | `Get-Item app-release.aab` | 10,017,837 bytes |
| Key is real, not a stub | `keytool -list -v -alias upload` | `Owner: CN=Ahmad Essam, O=Ahmad Essam, C=US`, valid to 2053-12-21 |
| Upload key SHA-1 | same | `8A:24:2C:C5:75:D8:B1:14:9B:4C:46:29:29:90:0B:1E:DE:1B:E8:4F` |
| RC key reached the bundle | read `assets/public/js/config.js` out of the AAB zip | contains `goog_AmTMmpCjnxrMXGguNLpiuVCsEJG` |
| Legal pages are live | `Invoke-WebRequest` both URLs | HTTP 200, 6110 and 3822 bytes |
| No secrets committed | `git diff --cached --name-only` filtered for `*.jks`, `keystore.properties`, `*.aab` | empty on all three commits |

`npx cap sync android` was run before the final `bundleRelease` — **without it
the AAB ships stale JS** and the RevenueCat key would not have been in it.

**Hard-blocked on the owner (cannot be automated):**

- **AdMob has no account at all.** Signup demands accepting the AdSense Terms of
  Service and picking a payment country that Google says cannot be changed
  later. Account creation and accepting legal terms are not things to do on
  someone's behalf. Until it exists the app keeps Google's test ad unit IDs.
- **Content ratings (IARC)** — the questionnaire says completing it *is*
  agreeing to IARC's Terms of Service. Same reason.

**Root causes worth remembering:**

- **`keystore.properties` must have no UTF-8 BOM.** PowerShell 5.1's
  `Set-Content -Encoding utf8` writes one; Java's `Properties.load` reads it as
  part of the first key, so `keystoreProperties['storeFile']` came back null and
  Gradle died with `Cannot convert 'null' to File`. Fix:
  `[System.IO.File]::WriteAllText(path, text, (New-Object System.Text.UTF8Encoding $false))`.
- **"Sign-in details" is about credentials, not payments — answer No.** The
  form's Yes branch lists "payments, such as one-time products", which reads
  like a match for the four IAPs, and we initially went that way. But the Yes
  path has a required checkbox: *"Sign-in details in this declaration provide
  full access to all the features and content within this app, including premium
  or paid content."* With no credentials to give and no way to hand a reviewer
  the paid skins, that cannot be ticked truthfully — the save just fails with a
  bare "Your changes couldn't be saved" and the real reason is only visible in
  the DOM (`error-panel` → "Is any other information required?"). No is correct,
  which is what `store-listing.md` said all along.
- **`npm run serve` is broken** — it calls `http-server`, which is not in
  `devDependencies` and is not installed. Added `test/serve.js`, a
  zero-dependency static server. Run it before `npm test`.
- **Play Console deep links bounce to the app list** if loaded cold. Load
  `app-dashboard` first, then click through; the App content route is
  `app-content/overview`, not `app-content`.
- **Typing into GitHub's repo-name field via raw coordinates hit a keyboard
  shortcut** and navigated to Copilot. Use `find` + `form_input` with element
  refs on GitHub, not screenshot coordinates.
- **Do not click Play Console checkboxes by screenshot coordinate.** The page
  re-scales between the screenshot and the click (viewport flips 744↔698px), so
  clicks land a row or two off — twice they silently collapsed a section instead
  of ticking a box, and `Page.captureScreenshot` times out every few calls
  anyway. What works: every `material-checkbox` wraps a real
  `input[type=checkbox]`, so
  `document.querySelectorAll('material-checkbox')`, match on
  `innerText.split('\n')[0]`, then `input.click()` — Angular picks it up.
  Sections are **collapsible and virtualised**: a collapsed section's inputs are
  not in the DOM at all (they keep their state, they just cannot be queried), so
  click every element whose text is exactly `Show` first, and re-expand between
  passes because the page re-collapses them. Selected sections stop showing
  `n/m data types selected`, which is the tell that a tick registered.

> **BACK UP `android/frosttower-upload.jks` AND ITS PASSWORD OFF THIS MACHINE.**
> The password is only in `android/keystore.properties`, which is gitignored and
> therefore **not** in the GitHub repo — the repo is public, so it must never go
> there. This project signs locally: if the disk dies, the app can never be
> updated again. Play App Signing (opt in at first upload) makes the `.jks` only
> the *upload* key, which Google can reset — that is the real safety net.

**Next.** Only two things need the owner; everything else can proceed now.

*Needs the owner (both are "accepting a third party's terms"):*
1. AdMob account → then real App ID + interstitial + rewarded IDs into
   `www/js/config.js` (`isTest: false`) **and** `AndroidManifest.xml`. The two
   App IDs must match or the app crashes on launch.
2. IARC content-rating questionnaire (answers already decided in
   `store-listing.md`: ads yes, digital purchases yes → expect Everyone/PEGI 3).

*Does not need the owner:*
3. Data safety step 4 — resume the saved draft, six rows at *Not started*.
4. `npx cap sync android` + `gradlew bundleRelease` after any config change.
5. Upload the AAB to **Closed testing** (not Internal — internal does not count
   toward the 12-tester rule) and opt in to Play App Signing.
6. Create the four products, set all **Active**, add
   `ahmadessam1997@gmail.com` to License testing.
7. Import the products into RevenueCat, one entitlement per product with the
   same id, plus a `default` offering.
8. Start the 14-day closed-test clock — it is the only thing setting the launch
   date, so start it even while ads are still on test IDs.

RevenueCat also still needs a **Google service account JSON** (Play Console →
Users and permissions) before it can validate real transactions. The app is
usable without it; real purchases are not verifiable until it is attached.

---

## 2026-07-31 — monetization (skins, coins, ads, IAP) + Play Console

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
