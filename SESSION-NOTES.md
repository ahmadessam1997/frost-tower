# Session notes

> ## ▶ RESUME HERE (as of 2026-08-10)
>
> **Everything technical is done and shipped.** Build `6 (1.0.0)` **passed
> review and is live** — *Available to selected testers*, released 10 Aug
> 21:16, Closed testing - Alpha, 177 countries. It carries the global
> leaderboard plus the purchase and ads fixes. Publishing overview is empty:
> nothing pending, nothing in review. App content 11 of 11. RevenueCat
> credentials **Valid**, all four products **Published**. Play Games services
> project **Published** with the leaderboard live.
>
> **The only thing left is testers: 1 of 12, and the 14-day clock has not
> started.** That is the sole gate on production access. Nothing technical
> blocks launch.
>
> **Owner-only, in priority order:**
>
> 1. **A real tester list of 12+ people.** The track uses
>    `HomeKept Closed Testers`, which has **2** addresses (the owner's public
>    contact address plus one personal alt — see Settings → Email lists).
>    Production access needs **12 testers opted in for 14 continuous days** —
>    that clock sets the launch date and it is not running. **Critical path.**
> 2. **Confirm a purchase end to end** once build 6 reaches the device. Play
>    accepted one earlier but RevenueCat could not validate it; credentials are
>    valid now, so **Restore purchases** should pull it through.
> 3. **Confirm the leaderboard** once build 6 lands: the menu should show
>    **🏆 GLOBAL RANKING**, and a finished run should post the best floor. The
>    button stays hidden if Play Games is unavailable — that is by design, not
>    a bug.
> 4. **AdMob payment profile**, if the banner still reads *"Payment setup
>    incomplete…"*. Apps in review stay unreviewed until bank/tax details exist.
>
> **Suite re-verified 2026-08-10 before the build-6 upload: `42 passed, 0 failed`.**
>
> ### Build gotcha — `gradlew` needs JDK 21, and the shell default is 17
>
> `JAVA_HOME` on this machine points at `C:\Program Files\Microsoft\jdk-17…`,
> and `:capacitor-android:compileReleaseJavaWithJavac` fails with
> `error: invalid source release: 21`. Build with Android Studio's bundled JDK:
>
> ```powershell
> $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
> .\android\gradlew.bat -p .\android bundleRelease
> ```
>
> Output: `android/app/build/outputs/bundle/release/app-release.aab`.

## 2026-10-02 — 1.2.0 / versionCode 13: retention + income batch (NOT uploaded, NOT committed)

Debug APK built and the three suites pass (`npm test` 42, `node test/rate-sim.js`
24, `node test/features-sim.js` 137). Nothing device-tested.

- **Seam ads** — `Ads.showSeamAd()` is now the only full-screen entry point.
  One cadence (every 3 counted runs + 90 s) decides WHEN; every 3rd seam ad is
  the rewarded interstitial (`rewardedInterstitialEveryNthAd`). The old
  every-6 cadence shared the counter the every-3 interstitial reset, so it
  was unreachable. Counter + seam-ad count persist in the save (`adRuns`,
  `seamAds`). A revived run now counts as ONE run (it used to tick the run
  count, the rate prompt and the ad cadence twice).
- **Boot banner** — raised once ads init resolves (and billing, or 3 s), only
  on the menu / game-over card. `Save.data.noAds` mirrors Remove Ads so an
  owner never sees it in the gap. `--banner-h` pads the cards clear of it.
- **Double snowflakes** (game-over card, once per run, min 5) and **revive
  from floor 5** (`Cfg.revive.minFloor`).
- **Power-ups** — Shield 50 ❄, Head start 40 ❄ (floor 15), stock auto-used by
  the next run. **Decision:** on a head-start run `bestFloor` — the number the
  global board ranks and the floor milestones unlock on — counts only floors
  CLIMBED (`maxFloor - startFloor`). Score needs no correction (skipped floors
  pay nothing). Daily missions DO see the HUD floor, on purpose.
- **Pause + back** — `@capacitor/app`; HUD button, auto-pause on background,
  back: prompt/shop/more → close, run → pause, pause → resume, game over →
  menu, menu → exit.
- **Daily mission + streak** (`missions.js`), local reminder via
  `@capacitor/local-notifications`. Permission asked from the CLAIM tap only.
  **Gotcha:** the plugin defaults `isExactNotification` to TRUE and on
  Android 12+ `schedule()` then opens the system "Alarms & reminders" page.
  We pass `false` and strip `SCHEDULE_EXACT_ALARM` in the manifest.
- **Rate prompt back-off** — 2, then 5 after the first Later, then every 10.
  `rate.js` also gained an `onChoice` option (analytics). The three games'
  copies are no longer byte-identical unless re-synced.
- **Analytics** — `analytics.js` wraps `@capacitor-firebase/analytics`.
- **More games** — `Cfg.moreGames`; all three siblings are live (Trap Jam flipped to `live:true` on 2026-10-14).
- `docs/privacy-policy.html` + `store-listing.md` updated; **`docs/` must be
  pushed** for the hosted policy to change.

## 2026-09-07 (later) — the consent port was incomplete: no way to CHANGE a choice

versionCode 8 shipped `showPrivacyOptions()` in `ads.js` with **nothing
calling it**. The UMP form therefore appeared once, on first run, and a
player who consented could never revisit the decision. Google's EU user
consent policy requires a persistent entry point, so this was half a port,
not a finished one — caught by grepping Escape for the same symbol and
finding it wired where Frost's was orphaned.

Escape does it in `shop.js`; Frost now matches, in Frost's own idiom
(module-private functions and the shared `busy` flag, not Escape's `self`):

- `www/index.html` — `<button class="restore-btn hidden" id="shopPrivacy">`
  added under Upgrades, beside Restore purchases.
- `www/js/shop.js` — `el.privacy` cached in `init()`, click wired to a new
  `openPrivacyOptions()`, and `render()` toggles `hidden` on
  `Ads.privacyOptionsRequired`.

Two things deliberately copied from Escape's reasoning:
- **Visibility is gated on `privacyOptionsRequired`, not on `removeAds`.**
  Buying Remove Ads silences the interstitial, but rewarded videos — and
  therefore the ad SDK and its consent — remain, so the choice must stay
  reachable. Google hides the entry point where no form exists, and a dead
  button is worse than no button.
- **It does NOT re-render the shop afterwards.** The form changes ad
  personalisation, not anything the shop displays; a flicker on dismiss
  would read as a purchase state changing.

**Build:** versionCode 8 -> **9**, versionName 1.0.1 -> **1.0.2**, signed,
11,348,471 bytes. Verified inside the .aab: button in markup, listener
wired, toggle present, consent flow intact.

> **Do not upload this while 1.0.1 is in review.** Play will not accept a
> second production release over one still under review — wait for 1.0.1 to
> go live (or be rejected), then submit 9.

## 2026-09-07 — UMP consent ported from Escape; versionCode 8 built

Frost was one generation behind Escape on ads: `ads.js` went straight to
`AdMob.initialize()` with no consent step, so every ad request in the EEA/UK
went out under an unknown consent state. Escape's flow is now mirrored here
verbatim.

**Code** — `www/js/ads.js`:
- `_requestConsent()` runs BEFORE `initialize()` and always resolves. A
  consent failure must not cost the player their ads or their game.
- `canRequestAds` (defaults **true**, so a failure degrades to the previous
  behaviour rather than silently killing ads everywhere) now gates the
  preload pair. Preloading under REQUIRED-but-unanswered burns a request
  that returns empty and leaves `_ready` false anyway.
- `_applyConsent()` and `showPrivacyOptions()` added. The latter is only
  worth surfacing from the shop when `privacyOptionsRequired` is true —
  Google hides the entry point otherwise and a dead button is worse.

**Config** — `www/js/config.js` gains `admob.consent { debugGeography: 0,
enabled: true }`. `debugGeography` is read natively with `call.getInt()`, so
it is a NUMBER; passing `'EEA'` silently does nothing, the same failure mode
as the `maxAdContentRating` `'G'` bug fixed earlier.

**Console — both messages created and Published, bound to Frost Tower only:**

| Message | Name | Notes |
|---|---|---|
| European regulations | `Frost Tower - EEA/UK consent` | Consent On, Manage options On, **Do not consent On for every country** |
| US state regulations | `Frost Tower - US states opt-out` | Opt out On |

Publishing the GDPR message required a privacy policy URL against the app,
which Frost had never had registered — Escape had one, Frost's cell read
*Add URL*. Set to `https://ahmadessam1997.github.io/frost-tower/privacy-policy.html`
(the page was already live; only the AdMob registration was missing).

> Neither half works alone. Without the console message the SDK reports no
> form available; without the code the message is never shown to anyone.
> That is why Escape did both together and why Frost was inert until now.

**Build:** versionCode 7 -> **8**, versionName 1.0.0 -> **1.0.1**. Synced,
`bundleRelease` with JDK 21, signed (`UPLOAD.RSA`), 11,348,020 bytes.
Verified inside the .aab: real app id `ca-app-pub-7898882561225435~4844848706`,
zero occurrences of the Google test publisher, `isTest:false`,
`requestConsentInfo` and the `canRequestAds` gate both present.

**Test device — NOT outstanding.** `testDeviceIds` is still `[]` and stays
that way. The phone is registered account-level (advertising ID
`9da360bf-4ad0-41a1-b114-588f4f48e2e6`, `Ahmad phone (all apps: ...)`), which
covers every app under the publisher. Re-verified in the console this
session. See escape-chambers/GO-LIVE.md step 7.


## 2026-08-10 (last) — build 6 live; production gate measured precisely

Build 6 cleared review the same evening it was submitted. Verified in console,
not assumed: track reads *Active · Latest release: 6 (1.0.0) · 177
countries/regions*, the release reads *Available to selected testers ·
Released on 10 Aug 21:16*, and Publishing overview shows no pending or
in-review changes.

### The production gate, as Google actually counts it

Dashboard → Production → *Apply for access to production*:

| | Requirement | State |
|---|---|---|
| ✅ | Publish a closed testing release | done |
| ⬜ | At least 12 testers opted-in | **1 tester currently opted in** |
| ⬜ | Run the test with 12+ testers for 14 days | not started |

**Apply for production** is greyed out.

> ### Being on the email list is NOT opting in
>
> The track now has **two** lists attached — `HomeKept Closed Testers` (2) and
> `Investment Tracker Test List` (2), both borrowed from sibling apps and
> probably overlapping. Google still counts **1**. A person only counts once
> they open the join link on the device, accept, and install from Play.
> Until then the 14-day clock does not tick.
>
> So the earliest possible launch is **14 days after the twelfth person
> actually installs**, not 14 days from any console change. Adding addresses
> changes nothing on its own — this is the single most misleading number in
> the whole console.

Opt-in link: Closed testing → **Testers** → *How testers join your test* →
**Copy link** (Android and web variants). Standard form is
`play.google.com/apps/testing/com.ahmadessam.frosttower`. Feedback address on
the track is already set to `ahmadessam1997@gmail.com`.

**Recruiting risk, owner's call.** A testerscommunity.com submit-app page was
open during this session. Tester-exchange services satisfy the count
mechanically, but the production application asks how testers were recruited
and what feedback came back, and Google has been rejecting applications whose
twelve testers were reciprocal sign-ups that never really played. Twelve real
people is slower to assemble and much safer for the one thing gating launch.

### For future forms: this is Capacitor, not a TWA

Asked whether the app was built with PWABuilder or Bubblewrap. **No — neither.**
`MainActivity` extends `com.getcapacitor.BridgeActivity`; there is no
`TrustedWebActivity`, no `androidbrowserhelper` dependency and no
`twa-manifest.json`.

PWABuilder and Bubblewrap both emit a **TWA**, a shell that opens Chrome
against a hosted URL with Digital Asset Links. Capacitor bundles the web
assets into the AAB (`assets/public/`) and exposes native SDKs over a plugin
bridge — which is the only reason AdMob, RevenueCat and `LeaderboardPlugin`
work at all. A TWA could not run any of them.

The question is usually asked to apply Play's minimum-functionality policy
("is this just a website in a shell?"). It does not apply here: the game runs
entirely on-device with no server. **Answer forms with "No".**

## 2026-08-10 (later) — global leaderboard via our own PGS plugin

Owner asked for a global high score across all players (highest floor).
Implemented with Google Play Games Services.

**Why not a third-party plugin.** The only Capacitor 8 option on npm was
`@idleflowgames/capacitor-play-games` **v0.2.1** — created seven weeks earlier,
single maintainer, pre-1.0. Owner chose a hand-written plugin instead. Given
that a single wrong assumption about `Purchases.configure()` killed both ads
and purchases in builds 1–3, taking an unproven native dependency into a live
monetized app was not worth the hours saved.

**Play Console setup done:**

| Thing | Value |
|---|---|
| PGS project | **`198265567595`** (linked to the `frost-tower` Cloud project) |
| Leaderboard | "Highest Floor", **`CgkI6_KxzOIFEAIQAA`**, largest-first, tamper protection on |

> Sort order **cannot be changed after publishing** — largest-first is correct
> for a highest-floor board.

**Code added:**

- `android/.../LeaderboardPlugin.java` — signIn / isSignedIn / submitScore /
  showLeaderboard. Every method resolves, never rejects, and every one is
  explicitly `RETURN_PROMISE` (the RevenueCat lesson).
- `MainActivity.java` — `registerPlugin()` **before** `super.onCreate()`;
  Capacitor builds its registry during `BridgeActivity.onCreate()`, so a
  plugin registered after that never reaches `window.Capacitor.Plugins`.
  `PlayGamesSdk.initialize()` is wrapped in try/catch so a device without Play
  Games still boots the game.
- `www/js/leaderboard.js` — fail-soft wrapper, same discipline as `ads.js`.
- `config.js` gains `leaderboard.projectId` / `highestFloorId`; the project ID
  is **duplicated** in `strings.xml` because the SDK reads it from the manifest
  at startup. Same trap as the AdMob app id — a scripted check confirms the two
  match.
- Boot: the leaderboard is a **third isolated `bootStep`**, so it cannot delay
  or break billing or ads.
- Score is submitted as `Save.data.bestFloor` (lifetime best, not the run's
  floor) so a player who was offline for their best run still gets ranked.

**Verified on an emulator:** `Registering plugin instance: Leaderboard`, and
`pluginId: Leaderboard, methodName: signIn` fires at boot. Critically,
`AdMob.initialize`, `Purchases.configure` and `Purchases.getCustomerInfo` all
still run — adding the leaderboard did not disturb the other SDKs. Sign-in
fails on the emulator (no Google account) and degrades silently with no crash,
which is the intended behaviour. Suite: **42 passed, 0 failed.**

### PGS setup — FINISHED 2026-08-10, project is Published

All console work is done. The checklist reads **4 of 5**; the only open item is
*"Add the Play Games services SDK to your APK"*, which Google ticks off once it
sees the SDK in an uploaded build — that is build `6`.

**OAuth client** (Google Cloud → `frost-tower` → Clients):

| Thing | Value |
|---|---|
| Name / type | `Frost Tower`, **Android** |
| Client ID | `198265567595-a1e4he8ckk9vsa7m8fuctcbva5ubshi1.apps.googleusercontent.com` |
| SHA-1 | `FE:31:44:26:31:56:DD:DA:06:84:2C:5F:45:85:C3:E2:93:43:CA:5E` |
| Package | `com.ahmadessam.frosttower` |

That SHA-1 is the **app signing** fingerprint, not the upload key. Play App
Signing re-signs every build, so an OAuth client bound to the upload
fingerprint authenticates nothing and `signIn()` fails silently on real
devices. Play Console pre-fills the correct value on the Add-credential page —
copy it from there rather than from `keytool` on the local keystore.

**Publishing the PGS project needed four more fields** that are not part of the
setup checklist and only surface when you press *Review and publish*:
Description, Game category (**Arcade**, matching the store listing), Game icon
(512×512) and Feature graphic (1024×500). `play-assets/play-icon-512.png` and
`play-assets/feature-graphic.png` were reused as-is. Until those four are
filled the **Publish** button is greyed out with only a vague *"Some items need
your attention before publishing"* line to explain why.

> Publishing is partly irreversible: achievements, events and leaderboards
> **cannot be deleted** afterwards, and *Saved games* cannot be turned off.
> Saved games was deliberately left **Off** — the game has no cloud save.

---

## 2026-08-10 — credentials valid, products Published, test device registered

The purchase failure after build 4 was exactly the predicted one: Play accepted
the purchase, then RevenueCat could not validate it because it had no Google
service account credentials. The player-visible symptom was a red toast reading
"credentials issue" — RevenueCat's *developer* message shown to a customer.

**Service account, built from scratch for this app:**

| Thing | Value |
|---|---|
| GCP project | `frost-tower` (new — only HomeKept and Investment Tracker existed) |
| APIs enabled | `androidpublisher.googleapis.com`, `pubsub.googleapis.com` |
| Service account | `revenuecat-play@frost-tower.iam.gserviceaccount.com` |
| Play access | Active, never expires, **account-level** (covers all apps) |
| Permissions | View app info · View app quality · View financial data · Manage orders and subscriptions |

> **A shortcut that was deliberately not taken:** `revenuecat-play@homekept-503903`
> already had account-wide access, so its key would have worked for Frost Tower
> immediately. The owner chose a dedicated account — correct, because rotating
> or revoking HomeKept's credentials would otherwise silently break this app.

**Result, verified:** the credentials badge went from *Credentials need
attention* to **Valid credentials**, and all four products flipped from
`Could not check` to **Published**. Propagation took minutes, not the ~24h
Google warns about — but do not rely on that.

**AdMob test device registered:** `Ahmad phone (Frost Tower testing)`, Android,
advertising ID `9da360bf-…`. That device now gets test ads against the real ad
units, so taps on it are safe. The AdMob console route needs the raw
**advertising ID** (Settings → Google → All services → Ads on the phone); the
in-code `testDeviceIds` route needs the *hashed* value from logcat. They are
different values and mixing them up silently does nothing.

**Build 5 shipped** with the human-readable purchase errors.

### The near-miss worth remembering

The downloaded service account JSON landed in the **repo root** —
`frost-tower-3ca7be6e54e8.json` — untracked but **not** gitignored. This repo is
public, and `git add -A` (used throughout these sessions) would have committed
and pushed a private key with access to the Play account's financial data.
Caught before any commit; verified 0 occurrences across all history. `.gitignore`
now covers the Google download pattern for every project on this account.

**Do not download credentials into the project folder.** Google's Cloud console
defaults to the browser download directory; if that is the repo, the key lands
one `git add` away from being public.

### Gotcha: "Save" on the release review page can produce a *draft*

Build 5's Save created `Draft release: 5 (1.0.0)` instead of staging it, and
Publishing overview showed **nothing pending** — which looks exactly like a
successful submit. The fix is Edit release → Next → Save. **Always confirm the
track shows the build as staged rather than "Draft release" before believing a
submit worked.**

---

## 2026-08-09 — THE bug: one TypeError killed both purchases AND ads

Reported symptom was "in-game purchases not working, can't click the buttons".
Root cause found on an emulator in one log line:

```
[boot] TypeError: Purchases.configure(...).then is not a function
```

**`PurchasesPlugin.kt:94` annotates `configure` as `RETURN_NONE`**, so it
returns `undefined`, not a promise. `billing.js` chained `.then()` off it,
which threw *synchronously* inside `init()` and rejected the whole boot chain
in `game.js`. Consequences:

- `Billing.state` never moved off its initial `'unavailable'`, so
  `shop.js:143` (`btn.disabled = !Billing.isReady()`) disabled every premium
  button. The shop was working exactly as designed; nothing had configured it.
- **`Ads.init()` never ran at all** — it sat after billing in the same chain.
  So there were no ads either, of any kind, in builds 1, 2 and 3.

Checked every plugin method the app calls: `configure` is the **only**
`RETURN_NONE` one. Everything else is `RETURN_PROMISE`.

### Three fixes

1. **billing.js** — `configure()` is now called synchronously, and
   `getCustomerInfo()` is the readiness probe. Deliberately *not* `refresh()`,
   which swallows its own errors and would report `ready` against an
   unreachable store, breaking the fail-closed guarantee.
2. **game.js** — the two SDKs now start with `Promise.all` and never wait on
   each other. Isolation alone was not enough: on an offline device
   `getOfferings()` never settles, so ads stayed dead behind a *slow* billing
   call even with errors caught. They had to be decoupled in time, not just
   in error handling.
3. **A self-inflicted one.** The boot helper was first written as
   `function step(label, fn)` — but `game.js:157` already defines
   `function step(dt)`, the physics step called by the game loop. The second
   declaration wins the hoist, so **the game loop called the boot helper and
   the climber never moved**. Renamed to `bootStep`. Caught only because the
   suite's climb assertion failed; bisecting against stashed baseline proved
   it was mine.

### The e2e suite was broken, and it was the harness

Every run died with `Navigation timeout of 30000ms exceeded` — including on
**unmodified baseline code**, which is what proved it was not the change. A
throwaway probe with an identical Puppeteer launch showed the app booting fine
with **zero pending requests**.

Cause: `waitUntil: 'networkidle0'` simply stopped firing on this machine.
`'load'` hung too. Switched the `goto` and all three `page.reload()` calls to
`domcontentloaded` plus a fixed settle. `index.html` pulls only local scripts
and no external subresources, so this is both sufficient and deterministic.
Suite restored: **42 passed, 0 failed.**

> Filtering test output through `grep -E "FAIL|passed|HARNESS"` hid that the
> suite was actually progressing further after each fix. The reload timeout at
> line 196 was invisible for several iterations because the PASS lines were
> filtered out. Read the tail of the real output.

### Verified on device, not assumed

| Claim | Evidence |
|---|---|
| configure no longer throws | logcat shows `pluginId: Purchases, methodName: getCustomerInfo` — never reached before |
| billing reaches `ready` | `getOfferings` is called, and `loadPrices()` only runs after `state='ready'` |
| ads no longer blocked | logcat shows `pluginId: AdMob, methodName: initialize` — absent in every earlier run |
| fixes are in the shipped AAB | read `billing.js`/`game.js` back out of the AAB zip |

Shipped as **build 4 (1.0.0)**, submitted for review.

**Emulator caveats:** `Pixel_Play` has no network (`ping` → *Network is
unreachable*), so `ready` was reached without a live RevenueCat round-trip,
and purchases themselves still cannot be exercised there — Play Billing needs
an app installed *by Play* under a licensed tester account. Also, leaving the
emulator running starves the timing-sensitive physics test; shut it down
before running `npm test`.

---

## 2026-08-08 (later still) — test-device support, and a real ad-rating bug

Wiring test devices meant reading the plugin source, which turned up a bug
that had been latent since the ads were written.

### `maxAdContentRating: 'G'` was silently doing nothing

`ads.js` passed `'G'`. The plugin's enum is
`General | ParentalGuidance | Teen | MatureAudience`, and the Android switch
(`AdMob.java` `setRequestConfiguration`) has no `'G'` case, so it fell through
and left `MAX_AD_CONTENT_RATING_UNSPECIFIED`. **Every ad request from this
Everyone / PEGI 3 game carried no content-rating cap.**

It never showed because Google's test ad units always serve the same benign
house ads — so this was invisible for as long as `isTest` was true, and became
real the moment the live ad units shipped in build 2. Fixed to `'General'`.

> Build **2** is in review carrying the bug. Practical exposure is low because
> the AdMob app is still "Requires review" and probably will not fill, but the
> fix should go out with the next build rather than waiting.

### Test devices

- `config.js` gains `admob.testDeviceIds: []`.
- `ads.js` computes `testDevices` and sets
  `initializeForTesting: !!isTest || testDevices.length > 0`, passing
  `testingDevices`.

**The flag is not optional.** `AdMob.java` reads
`initializeForTesting ? call.getArray("testingDevices") : EMPTY_TESTING_DEVICES`,
so a device list with the flag off is discarded. Verified in the Android source
before writing the change, because the obvious worry — that the flag forces
*every* device into test mode — is wrong: all it does is feed
`RequestConfiguration.setTestDeviceIds()`.

**The two routes use different values.** The AdMob console wants the raw
**advertising ID**; `testDeviceIds` wants the **hashed** form the SDK prints to
logcat (`adb logcat | grep -i setTestDeviceIds`). Mixing them up silently does
nothing.

Route A (AdMob console) needs no rebuild and protects the currently-submitted
build 2; Route B ships with the next build. Suite still `42 passed, 0 failed`.

---

## 2026-08-08 (later) — AdMob live, real ad IDs shipped in build 2

Owner created the AdMob account. Everything below followed.

**AdMob app + ad units created:**

| Thing | Value |
|---|---|
| App | `Frost Tower`, Android, AdMob ref `4844848706` |
| App ID | `ca-app-pub-7898882561225435~4844848706` |
| Interstitial | `ca-app-pub-7898882561225435/8592522025` (`frost-tower-interstitial`) |
| Rewarded | `ca-app-pub-7898882561225435/3593290870` (`frost-tower-rewarded`, reward **50 / snowflakes**) |

**The app had to be registered as NOT listed on a store.** AdMob's "Yes, the
app is listed on a supported app store" search cannot find
`com.ahmadessam.frosttower` — that search reads the *public* Play listing, and
the app is closed-testing only. Registered it unlisted instead; link it to the
Play listing once it reaches production.

**Four edits + a versionCode bump, then rebuilt and uploaded:**

- `www/js/config.js` — real `appId`, `interstitialId`, `rewardedId`, and
  `isTest: false`.
- `android/app/src/main/AndroidManifest.xml` — same app ID in
  `com.google.android.gms.ads.APPLICATION_ID`. **Verified the two match with a
  scripted diff** rather than by eye; a mismatch crashes the app at launch.
- `android/app/build.gradle` — `versionCode` 1 → **2**.
- `npx cap sync android`, then `gradlew bundleRelease`.

**Verification actually run, not assumed:**

| Claim | Check | Result |
|---|---|---|
| Suite still passes | `npm test` | `42 passed, 0 failed` |
| App IDs match | scripted compare of both files | identical |
| Synced assets carry real IDs | grep `android/app/src/main/assets/public/js/config.js` | 3 real IDs, `isTest: false` |
| AAB is signed | list `META-INF/*.{SF,RSA}` in the AAB zip | `UPLOAD.SF`, `UPLOAD.RSA` |
| Real IDs reached the bundle | read `config.js` out of the AAB zip | 3 real IDs, `isTest: false`, RC key present |
| Merged manifest | grep release merged manifest | real app ID |
| AAB size / hash | `Get-FileHash` | 10,017,899 bytes, SHA-256 starts `FBA8F655755F1F22` |

Release `2 (1.0.0)` uploaded, release notes written, **submitted for review**.
Device support unchanged (0 lost, 0 gained); size delta +137 B. The only
warning is the expected "no deobfuscation file" one — `minifyEnabled false` is
deliberate.

> **The owner was warned and chose to ship real ad IDs to the closed test
> anyway.** The risk is real: the AdMob app shows **"Requires review"** and
> cannot be reviewed until there is a public store listing, so ads will
> probably not fill; and any tester who taps an ad generates invalid traffic,
> which is the classic way to get an AdMob account suspended. The release notes
> tell testers not to tap ads. **Register your own device as a test device in
> AdMob before installing this build.**

### Gotchas

- **Release notes are capped at 500 characters per language.** A 649-char note
  silently disables both `Next` and `Save as draft` and the only tell is a
  small red `Release note for en-US is too long` under the textarea.
- **The Angular textarea still needs a real keystroke.** Setting `.value` via
  the native setter plus an `input` event leaves the field valid-looking but
  the buttons stay disabled; clicking in, pressing `ctrl+End`, typing a space
  and backspacing it releases them.
- **`taskkill` by image name did not stop `test/serve.js`.** The stray server
  kept port 8123, and the next `node test/serve.js` died with `EADDRINUSE`
  *after* the suite had already passed against the old instance — which was
  harmless only because the server reads from disk per request. Kill it by port
  instead: `Get-NetTCPConnection -LocalPort 8123 -State Listen` → `Stop-Process`.
- **AdMob's payment profile is a separate blocker** from account creation:
  "Any apps in review will remain unreviewed until you add your payment
  information."

---

## 2026-08-08 — IARC done, 16 changes submitted, closed test LIVE, products + RevenueCat wired

The owner explicitly authorised accepting IARC's Terms of Use on their behalf,
which unblocked everything the previous session was stuck behind.

**Content rating — submitted.** Category `Game`, contact
`ahmadessam1997@gmail.com`. Every content question answered **No** except
"purchase or sale of digital goods" = **Yes** → sub-checkbox *Purchases of
digital goods* only (not cash-convertible rewards, not NFTs), loot boxes
**No**, player-to-player trading **No**. Resulting ratings:

| Authority | Rating |
|---|---|
| ESRB | Everyone |
| PEGI | PEGI 3 |
| USK | All ages |
| ACB (Australia) | General |
| GRAC (Korea) | All ages |
| Google Play / IARC Generic | Rated for 3+ |
| **ClassInd (Brazil)** | **Rated 14+** |

Brazil's 14+ is purely for in-game purchases, not content. Every authority
tags "Interactive elements: In-game purchases". This matches what
`store-listing.md` predicted (Everyone / PEGI 3).

**Publishing overview — 16 changes submitted and published.** The batch was
the closed-testing release `1 (1.0.0)`, 177 countries, the tester list and
feedback channel, the en-US store listing, content rating, target audience
13+, privacy policy URL, ads declaration, data safety, health apps, app
category (Arcade), and a **Google Play Games on PC opt-in** that was on by
default (left as-is — harmless for an arcade game, but worth knowing it is on).
Play ran ~14 minutes of "quick checks" first and sent the batch automatically
when they passed. Verified afterwards: Publishing overview has **no pending
changes**, and Closed testing - Alpha reads **Active, Latest release 1 (1.0.0),
177 countries/regions**.

**All four one-time products created and Active** (Play Console → Monetise →
Products → One-time products, which unlocked the moment the BILLING build was
on a track):

| Product ID | Purchase option ID | Name | Price | Regions |
|---|---|---|---|---|
| `remove_ads` | `remove-ads` | Remove Ads | $2.99 | 173 |
| `skin_aurora` | `skin-aurora` | Aurora climber | $1.99 | 173 |
| `skin_golden` | `skin-golden` | Golden Crown climber | $2.99 | 173 |
| `skin_void` | `skin-void` | Void Walker climber | $2.99 | 173 |

All are purchase type **Buy**, non-consumable by construction, priced in USD
with Play auto-converting per region (e.g. $2.99 → AUD 4.69 / EUR 3.09 /
DZD 400). 173 pricing regions, not 177 — pricing regions and distribution
countries are different lists; this is normal.

**Licence testing** — account-level, Settings → Licence testing. Added the
`HomeKept Closed Testers` list alongside the existing Investment Tracker list,
response `RESPOND_NORMALLY`. Verified by reload. That list contains the
owner's published contact address plus one personal alt, so the owner can make
test purchases without being charged.

**RevenueCat — fully wired** (project `c9b2848b`, app `appb1be81e0e7`):

- Four products created by hand as **Non-consumable**, Google product
  identifiers matching Play exactly. `Import Products` was not used — it needs
  Play API credentials that do not exist yet.
- Four entitlements with the **same ids** as the products, one product
  attached to each.
- Offering `default` ("Frost Tower shop") with **4 packages**, each a *Custom*
  identifier equal to its product id, each pointing at the matching Play
  product.
- Every product shows **`Store Status: Could not check`**. That is expected:
  RevenueCat has no Google service account JSON, so it cannot query Play.
  It does not stop the SDK from working, but real transactions are not
  server-verified until the JSON is attached.

### Gotchas from this session

- **On the IARC questionnaire, `Next` stays disabled until you click `Save`.**
  Every section read `Completed`, every radio group was answered, and `Next`
  was still greyed out. Clicking the form-level **Save** ("Your changes have
  been saved") enabled it immediately. Do not go hunting for a missing answer.
- **Programmatically clicking a radio can silently drop the answer.** After
  answering the loot-box question and clicking Next, that group came back
  *unselected* while its neighbours kept their answers. Re-check every group
  (`checked` on both inputs of each pair) before clicking Next, and target the
  **last unanswered group**, not the last radio with a matching label — the
  questionnaire appends questions to the same page, so "last matching label"
  drifts onto an already-answered question.
- **Play Console's account-level Save opens a confirmation dialog** —
  "Save changes? These changes will affect all of your apps". Three saves
  appeared to succeed and silently didn't because the dialog was never
  confirmed. `element.click()` from JS does *not* open that dialog at all;
  only a real mouse click does. Use the computer tool for Save on
  Licence testing.
- **RevenueCat's New Product form resets on first interaction after a
  navigation.** Typing straight after `navigate` lands nowhere and the product
  type snaps back to Subscription. Take a screenshot first (which forces a
  sync), then click, then type — and verify with
  `[...document.querySelectorAll('input')].map(e=>e.value)` before submitting.
- **On the RevenueCat offering form, `+ New Package` inserts the empty package
  at the TOP and scrolls the page.** Fixed coordinates then land on the
  *previous* package: one round of typing appended `skin_golden` onto the
  aurora package's identifier, producing `skin_auroraskin_golden`. Re-read the
  input values after every field, and fix mistakes with `triple_click` +
  retype (a plain click leaves the old text in place).
- **Play Console pricing bulk-edit**: `Set prices` → `Bulk edit pricing` →
  header select-all → `Continue` → a *Set price* dialog. The first click into
  that dialog's price field only focuses the dialog; the text lands on the
  second click. Always screenshot to confirm the field is non-empty before
  clicking Apply.
- The pricing table's row checkboxes are **virtualised** — the select-all
  header checkbox is the only checkbox in the DOM until rows are scrolled into
  view, so `document.querySelectorAll('input[type=checkbox]')` returns 1.
- `Page.captureScreenshot` timed out on roughly every third call on both
  sites. Retrying once always worked. One retry after a `zoom` returned a
  garbled tiled image; a fresh navigation cleared it.

---

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
