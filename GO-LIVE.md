# Frost Tower — go-live runbook

Ordered, because each step feeds the next. Written 2026-07-31, after the game
gained skins, a coin economy, AdMob ads and four one-time purchases.

Fixed values used throughout:

| Thing | Value |
|---|---|
| Play developer account | `ahmadessam1997` — account ID `7599532919585116115` |
| Play app ID | `4973059284762378472` (created 2026-07-31, **Draft**) |
| Play console URL | https://play.google.com/console/u/0/developers/7599532919585116115/app/4973059284762378472/app-dashboard |
| Store listing name | `Frost Tower: Climb or Freeze` · Game · Free · en-US |
| Android package | `com.ahmadessam.frosttower` |
| Version | 1.0.0, versionCode 1 (bump versionCode on EVERY upload) |
| Play products | `remove_ads`, `skin_aurora`, `skin_golden`, `skin_void` — all one-time **non-consumable** |
| RevenueCat entitlements | one per product, **same ids** |
| Ads | AdMob interstitial (every 3rd run, 90s cooldown) + rewarded (revive / coins) |
| Java for builds | **21** — `C:\Program Files\Android\Android Studio\jbr` (JDK 17 fails: "invalid source release: 21") |

**Current state (updated 2026-08-08):** the **closed test is live** — release
`1 (1.0.0)` is Active on Closed testing - Alpha in 177 countries, app content
is 11 of 11, all four products are Active, and RevenueCat is fully configured.
The only remaining work is **12+ real testers** and **AdMob** (step 1), both of
which need the owner.

Done on 2026-08-05:

| Thing | Value |
|---|---|
| Upload keystore | `android/frosttower-upload.jks`, alias `upload`, SHA-1 `8A:24:2C:C5:75:D8:B1:14:9B:4C:46:29:29:90:0B:1E:DE:1B:E8:4F`. Password is in `android/keystore.properties` (gitignored). **BACK BOTH UP OFF-MACHINE.** |
| GitHub repo | https://github.com/ahmadessam1997/frost-tower (public) — the project is now a git repo |
| Privacy policy URL | https://ahmadessam1997.github.io/frost-tower/privacy-policy.html (live, HTTP 200) |
| Data deletion URL | https://ahmadessam1997.github.io/frost-tower/delete-data.html (live, HTTP 200) |
| RevenueCat project | `Frost Tower`, project `c9b2848b`, app `appb1be81e0e7` (Play Store, Capacitor) |
| RevenueCat public key | `goog_AmTMmpCjnxrMXGguNLpiuVCsEJG` — in `www/js/config.js` and in the built AAB |

App content declarations **saved**: privacy policy, ads = YES, sign-in details =
No, target audience 13-15/16-17/18+, advertising ID = YES (analytics +
advertising + fraud prevention), government apps = No, financial features = none,
health features = none.

Done on 2026-08-06: **Data safety — submitted** (all 5 steps, all six data types
answered; verified by reload). **App category** = Game / Arcade. **Store Listing
contact details** = `ahmadessam1997@gmail.com` + the GitHub Pages site, no phone.

**App content is now 10 of 11 complete, and Closed testing is unlocked.**

Also done on 2026-08-06: the **AAB is uploaded** to Closed testing - Alpha
(build `1 (1.0.0)`), **177 countries** targeted, testers set to the
`HomeKept Closed Testers` list, feedback channel set.

Done on 2026-08-08 — **the closed test is live**:

| Thing | State |
|---|---|
| Content rating (IARC) | **Submitted.** ESRB Everyone · PEGI 3 · USK All ages · ACB General · GRAC All ages · Google Play 3+ · ClassInd 14+ (Brazil rates in-game purchases 14+) |
| App content | **11 of 11** — nothing needs attention |
| Publishing overview | **16 changes submitted and published**; no pending changes |
| Closed testing - Alpha | **Active**, release `1 (1.0.0)`, 177 countries/regions |
| One-time products | **All four created and Active**, 173 pricing regions each |
| Licence testing | `HomeKept Closed Testers` added, `RESPOND_NORMALLY` |
| RevenueCat | 4 products + 4 entitlements (ids match) + `default` offering with 4 packages |

**Still open — all three need the owner, because all three are either creating
an account, accepting a third party's terms, or handling a private key:**

| # | Item | Why it needs you | Blocks what |
|---|---|---|---|
| 1 | **12+ testers** (step 8) | Real people's email addresses | **The launch date.** The 14-day clock is not running. |
| 2 | **AdMob account** (step 1) | Creates an account, accepts AdSense ToS, fixes a payment country permanently | Revenue only. App ships test ad IDs and works fine. |
| 3 | **RevenueCat service account** (step 4.2) | Produces a private key with access to your Play financial data | Server-side purchase verification only. |

Item 1 is the critical path — 2 and 3 can happen any time before production.
Steps 1C/1D and the Play Console half of 4.2 are mechanical and can be done for
you the moment you hand over the IDs / the service account email.

**Verified 2026-08-08:** `npm test` → **42 passed, 0 failed**.

---

## 1. AdMob

**This step needs the owner.** Signup creates an account in your name, accepts
the AdSense Terms of Service, and fixes a payment country Google says cannot be
changed later. Do parts A and B yourself; part C is a mechanical edit anyone
can run once the three IDs exist.

### A. Create the account and the app (owner)

1. admob.google.com → Apps → Add app → Android → the app **is** on Google Play
   now, so you can link it to `com.ahmadessam.frosttower` directly.
2. Name it **Frost Tower**. Copy the **App ID** (`ca-app-pub-…~…`).

### B. Create the two ad units (owner)

- **Interstitial**, name `frost-tower-interstitial` → copy the unit ID.
- **Rewarded**, name `frost-tower-rewarded` → copy the unit ID. Set the reward
  to **50 / snowflakes** to match the in-app copy.

### C. Wire them in — exactly four edits

| # | File | What changes |
|---|---|---|
| 1 | `www/js/config.js` line 32 | `admob.appId` → real `ca-app-pub-…~…` |
| 2 | `www/js/config.js` lines 33–34 | `interstitialId`, `rewardedId` → real unit IDs |
| 3 | `www/js/config.js` line 36 | `isTest: true` → **`false`** |
| 4 | `android/app/src/main/AndroidManifest.xml` line 37 | `android:value` → the **same** app ID as edit 1 |

Edits 1 and 4 must match exactly. The SDK throws at startup if the manifest one
is missing or malformed, which **crashes the app on launch**.

### D. Rebuild and re-upload

A build is already live on the closed track, so this is an *update*:

1. **Bump `versionCode` to `2`** in `android/app/build.gradle` line 22. Play
   rejects a duplicate versionCode outright.
2. `npx cap sync android` — **without this the AAB ships stale JS** and the new
   ad IDs will not be in it.
3. `export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"` then
   `cd android && ./gradlew bundleRelease`.
4. Upload the new AAB to Closed testing - Alpha and submit for review.

> **Never test real ad units on your own phone.** Clicking your own live ads is
> the fastest way to get an AdMob account banned. Register your device as a test
> device in AdMob first.

## 2. Play Console — app, listing, and the FIRST upload

1. ~~Create app~~ **DONE 2026-07-31.** App exists as a Draft; both declarations
   (Developer Programme Policies, US export laws) accepted at creation.
2. ~~Store listing~~ **DONE 2026-07-31.** App name, short description (76/80),
   full description (1571/4000), app icon (512²), feature graphic (1024×500) and
   six phone screenshots (1080×1920) are all uploaded and saved. Screenshots were
   regenerated by `test/gen-screenshots.js` so they show the shop and the skins;
   re-run it after any UI change and re-upload.
3. App content:
   - **Privacy policy** → the hosted URL from step 5.
   - **Data deletion** → the hosted delete-data URL from step 5.
   - **Ads: contains ads = YES.**
   - **Data safety** → the exact table in `store-listing.md`. It must not
     contradict the privacy policy, or the release is rejected.
   - **Content rating** → IARC questionnaire; answer *yes* to ads and to digital
     purchases. Expect Everyone / PEGI 3.
   - **Target audience → 13+.** Do **not** join the Families programme; it forbids
     the advertising ID this AdMob setup uses.
4. Build a signed AAB (step 6) and upload it to **Closed testing** — not Internal;
   internal does not count toward the 12-tester rule.

## 3. Play Console — products — ~~TODO~~ **DONE 2026-08-08**

All four exist and are **Active** under Monetise → Products →
**One-time products** (the page unlocked once the BILLING build was on a track):

| Product ID | Purchase option ID | Name | Price |
|---|---|---|---|
| `remove_ads` | `remove-ads` | Remove Ads | $2.99 |
| `skin_aurora` | `skin-aurora` | Aurora climber | $1.99 |
| `skin_golden` | `skin-golden` | Golden Crown climber | $2.99 |
| `skin_void` | `skin-void` | Void Walker climber | $2.99 |

Purchase type **Buy**, priced in USD with Play auto-converting into 173 pricing
regions. (173, not 177 — pricing regions and distribution countries are
different lists.)

**Licence testing** is set: Settings → Licence testing now includes the
`HomeKept Closed Testers` list (which contains `ahmadessam1997@gmail.com`),
response `RESPOND_NORMALLY`. That Save opens a *"these changes will affect all
of your apps"* confirmation — it must be confirmed or the change silently
reverts.

## 4. RevenueCat — ~~TODO~~ **DONE 2026-08-08 except the service account**

1. ~~Project + app~~ **DONE** — project `c9b2848b`, app `appb1be81e0e7`.
2. **STILL TODO.** RevenueCat needs a Google service account with Play access.
   Until it exists every RevenueCat product reads
   **`Store Status: Could not check`** and real transactions are not
   server-verified. The SDK still works, so this does not block the closed test.

   **Owner does this part** — it produces a private key:
   - Google Cloud Console → the project behind this Play account → IAM &
     Admin → Service Accounts → **Create service account**.
   - Keys → Add key → **JSON** → download it. *This file is a credential: it
     grants access to your Play financial data. Do not commit it, do not paste
     it into chat.*
   - RevenueCat → Project settings → Apps → Frost Tower (Play Store) → upload
     that JSON.

   **The Play Console half can be done for you** once you have the service
   account's email address (`…@….iam.gserviceaccount.com`): Play Console →
   **Users and permissions** → Invite user → that email → grant *View app
   information*, *View financial data*, *Manage orders and subscriptions*.
   (On a sibling project the "API access" page never loaded and bounced to the
   app list — Users and permissions worked instead.)

   Google takes up to ~24h to propagate the permissions before RevenueCat
   stops erroring.
3. ~~Import products~~ **DONE** — created by hand as **Non-consumable** with
   Google product identifiers matching Play exactly. `Import Products` was not
   usable: it needs the credentials from step 2.
4. ~~Four entitlements~~ **DONE** — `remove_ads`, `skin_aurora`, `skin_golden`,
   `skin_void`, one matching product attached to each.
5. ~~Offering~~ **DONE** — `default` ("Frost Tower shop"), 4 packages, each a
   *Custom* identifier equal to its product id.
6. ~~API key~~ **DONE** — `goog_AmTMmpCjnxrMXGguNLpiuVCsEJG` is already in
   `www/js/config.js` and verified inside the built AAB.

> The app also falls back to `allPurchasedProductIdentifiers`, so a forgotten
> entitlement degrades to "still owned" rather than silently revoking a paid
> unlock. Do not rely on that — wire the entitlements properly.

**Check:** on device, `FTBilling.state` should be `'ready'`, not `'unavailable'`.

## 5. Host the legal pages — ~~TODO~~ **DONE 2026-08-05**

The project is now a git repo pushed to
https://github.com/ahmadessam1997/frost-tower (public), with Pages serving
`/docs` from `main`. Both pages return HTTP 200:

- https://ahmadessam1997.github.io/frost-tower/privacy-policy.html
- https://ahmadessam1997.github.io/frost-tower/delete-data.html

Neither has been reviewed by a lawyer — read them.

`privacy-policy.md` (the superseded v1 "collects no data" policy) is in the repo
but **not** on Pages: Pages serves `/docs` only, and the file carries a loud
SUPERSEDED banner. Do not host it.

**Delete `privacy-policy.md` from any hosting.** It is the v1 "collects no data"
policy, now false, and is retained only as a historical record.

## 6. Build the release AAB — **WORKS**

```bash
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
npx cap sync android          # after ANY www/ change, or the AAB ships stale JS
cd android && ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`, ~10.0 MB,
signed with `META-INF/UPLOAD.{SF,RSA}`.

The keystore was created 2026-08-05 and `android/keystore.properties` is wired
in. **Back up `android/frosttower-upload.jks` and its password off-machine** —
this project signs locally, so the key really is unrecoverable if lost.

> **Gotcha that cost a build:** write `keystore.properties` **without a UTF-8
> BOM**. PowerShell's `Set-Content -Encoding utf8` adds one, Java's
> `Properties.load` reads it as part of the first key, and Gradle fails with
> `Cannot convert 'null' to File`. Use
> `[System.IO.File]::WriteAllText($p,$s,(New-Object System.Text.UTF8Encoding $false))`.

Opt in to **Play App Signing** at first upload: Google then holds the real app
signing key and your .jks is only the *upload* key, which can be reset if lost.

> **Do not repeat adaptive-chess's key confusion.** That project spent a session
> concluding its upload key was lost, then nearly reset it — the key was actually
> held by EAS in the cloud (the tell-tale was a completely blank certificate DN).
> Frost Tower builds locally with a local keystore, so *this* project's key really
> does live on disk and really is unrecoverable if lost. Record the SHA-1 of both
> the upload key and, after the first upload, the Play app-signing key from
> Play Console → App integrity.

## 7. Verify what the browser could not

Everything below is unproven so far — the e2e suite runs in Chromium, where the
ad SDK is absent and billing is the mock:

- An interstitial actually appearing after the 3rd run, and **not** after buying
  Remove Ads.
- A rewarded video paying out: +50 snowflakes in the shop, and the revive putting
  you back on the tower with the frost pushed down.
- A real purchase of each of the four products with a license-tester account.
- **Restore purchases** after uninstalling and reinstalling.
- Purchases only work on a build installed **from Play**, never a sideloaded one.

## 8. Closed test — **LIVE, but the clock has not started**

The track is Active with release `1 (1.0.0)` in 177 countries. What is missing
is people: personal Play accounts need **12+ testers opted in for 14 continuous
days** before production access, and the current list
(`HomeKept Closed Testers`) has **2**.

To start the clock: Play Console → Test and release → Testing → Closed testing
→ Manage track → **Testers**, or edit the email list at Settings → Email lists.
Add 12+ real addresses, then send them the opt-in link. A sibling project used
testerscommunity.com to find testers.

---

## Reference: what happens without the keys

| Config state | Behaviour |
|---|---|
| No RevenueCat key, on device | `FTBilling.state = 'unavailable'`, purchase buttons disabled and labelled "Store unavailable". **Never grants anything.** |
| Any state, in a browser | `FTBilling.state = 'mock'`, prices suffixed `· DEV`, purchases granted instantly. Gated on `Capacitor.isNativePlatform() === false`, so it cannot reach production. |
| Test ad unit IDs | Ads always fill, which is what the current config does. |
| AdMob app ID missing from the manifest | **App crashes on launch.** |

This fail-closed design is deliberate: HomeKept once shipped the opposite and its
dev mock handed out free lifetime access.
