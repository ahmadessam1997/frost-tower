# Frost Tower — App Store Connect listing (iOS)

Everything App Store Connect asks for, with the answer decided. Adapted from
`store-listing.md`, `play-listing-1.2.0-ready.txt` and `docs/privacy-policy.html`
(the Google Play sources) on 2026-10-14. Character counts are the PowerShell
`.Length` of the exact text in each block (line breaks count as 1).

Prices appear in this internal document only — never in customer-facing copy.

---

## 1. Identity

| Field | Value |
|---|---|
| Bundle ID | `com.ahmadessam.frosttower` |
| Version | `1.2.2` |
| Build | `1` |
| SKU | `com.ahmadessam.frosttower` |
| Primary language | English (U.S.) — `en-US` |
| Primary category | Games → **Arcade** |
| Secondary category | Games → **Casual** |
| Price | Free (tier 0), with in-app purchases |
| Devices | **iPhone only** (untick iPad in Xcode: `TARGETED_DEVICE_FAMILY = 1`) |
| Availability | All territories |
| Contact email | ahmadessam1997@gmail.com |
| Copyright | `2026 Ahmad Essam` |

---

## 2. App name (≤30) — 28 chars

```text
Frost Tower: Climb or Freeze
```

Same as the Play title.

## 3. Subtitle (≤30) — 29 chars

```text
One-thumb endless ice climber
```

## 4. Promotional text (≤170) — 150 chars

```text
Your run speed becomes your jump height. Sprint, rebound off the walls, skip whole floors and chain combos before the rising frost swallows the tower.
```

Promotional text can be changed at any time without a new build.

## 5. Description (≤4000) — 1801 chars

```text
The frost is rising. Climb. ❄️

FROST TOWER is a one-thumb endless climber in the spirit of the arcade classics: you bounce automatically — your RUN SPEED becomes your JUMP HEIGHT. Sprint, rebound off the walls, skip whole floors, and keep climbing before the frost swallows the tower.

SPEED = HEIGHT
• Hold left or right to sprint — release into a bounce and fly
• Rebound off walls without losing speed
• Skip 2+ floors in one leap to ignite combo chains ×5, ×12, ×20…
• The higher you climb, the narrower the ice — and the faster the frost

A TOWER WITH MOODS
• Ice platforms, moving platforms, cracking planks that crumble underfoot
• An aurora sky that shifts as you rise past floor markers
• A little frost sprite with a scarf who deserves better than freezing

NINE CLIMBERS TO COLLECT
• Earn snowflakes every run and spend them on new climbers
• Ember and Midnight unlock by climbing — no payment, just skill
• Mint Chip, Cocoa and Glacier cost snowflakes you earn in game
• Aurora, Golden Crown and Void Walker are optional premium unlocks

A NEW MISSION EVERY DAY
• One daily mission with a snowflake reward
• Claim on consecutive days to build a streak bonus
• Spend snowflakes on a Shield or a Head start for your next run

CHASE YOUR CROWN
• Score for every floor, big bonuses for combos
• Your best climb is saved on your iPhone — beat it, then beat it again
• Climb the global ranking with Game Center

PERFECT FOR ONE HAND
• Free to play, works fully offline
• No account, no sign-up — Game Center is optional
• Play a run in 30 seconds or lose an evening chasing floor 100
• Pause any time
• Tiny download

Frost Tower is free and supported by ads shown between climbs. Prefer silence? A single Remove Ads purchase turns every ad off for good.

How high before the frost catches you?
```

iOS edits vs. Play: "Google Play Games" → "Game Center" in the ranking line (iOS
has the same Highest Floor board, `frosttower.best_floor`); "No account, no
sign-up, no personal details" → "No account, no sign-up — Game Center is
optional"; "Icy-Tower style" removed (third-party game name); "saved on-device" → "saved on
your iPhone"; "Pause any time" added (1.2.0 feature); section emoji removed (one
kept). No price, no store name.

## 6. Keywords (≤100) — 99 chars

```text
climber,jump,arcade,endless,ice,bounce,combo,platformer,one hand,casual,offline,snow,winter,ranking
```

Comma-separated, no spaces after commas, no words from the app name (`frost`,
`tower`, `climb`, `freeze`), no competitor names. `runner` swapped for `ranking`
now that the Game Center board ships.

## 7. URLs

| Field | URL | Status |
|---|---|---|
| Support URL | https://ahmadessam1997.github.io/frost-tower/ | live (GitHub Pages `docs/`) |
| Marketing URL | https://ahmadessam1997.github.io/frost-tower/ | live |
| Privacy Policy URL | https://ahmadessam1997.github.io/frost-tower/privacy-policy.html | live — **text needs an iOS pass** (see checklist step 2) |
| Data deletion (for reference) | https://ahmadessam1997.github.io/frost-tower/delete-data.html | live |

## 8. What's New in This Version (≤4000) — 223 chars

```text
Frost Tower arrives on iPhone: one-thumb climbing where speed becomes height, nine climbers to collect, a daily mission with a streak bonus, Shield and Head start power-ups, and a Game Center ranking for your highest floor.
```

App Store Connect hides this field for an app's very first version; keep the text
for the first update.

---

## 9. Age rating questionnaire

| Section | Question | Answer |
|---|---|---|
| In-app controls | Parental controls | No |
| In-app controls | Age assurance | No |
| Capabilities | Unrestricted web access | No |
| Capabilities | User-generated content | No |
| Capabilities | Messaging and chat | No |
| Capabilities | Advertising | **Yes** (AdMob; ad requests capped to G-rated content) |
| Mature themes | Profanity or crude humor | None |
| Mature themes | Horror/fear themes | None |
| Mature themes | Alcohol, tobacco, or drug use or references | None |
| Medical or wellness | Medical or treatment information | No |
| Medical or wellness | Health or wellness topics | No |
| Sexuality or nudity | Mature or suggestive themes | None |
| Sexuality or nudity | Sexual content or nudity | None |
| Sexuality or nudity | Graphic sexual content and nudity | None |
| Violence | Cartoon or fantasy violence | None (falling off-screen / being overtaken by frost ends the run; no combat) |
| Violence | Realistic violence | None |
| Violence | Prolonged graphic or sadistic realistic violence | None |
| Violence | Guns or other weapons | None |
| Chance-based activities | Simulated gambling | None |
| Chance-based activities | Contests | None |
| Chance-based activities | Gambling | No |
| Chance-based activities | Loot boxes | No (every climber is bought or unlocked directly; no random rewards) |
| Made for Kids | Made for Kids | **No** (uses the IDFA; not directed at children under 13) |

**Expected rating: 4+.** A cute arcade platformer with no combat, scary,
sexual or chance-based content; ads are filtered to G. Matches the Play
Everyone / PEGI 3 rating.

---

## 10. App Privacy (nutrition label)

Answer **"Yes, we collect data from this app"**. The data below is collected by
the SDKs (Google AdMob, Google Analytics for Firebase, RevenueCat). Scores,
snowflakes, skins, power-ups and mission progress stay on the device and are not
collected.

**Game Center (Highest Floor leaderboard):** the best floor of a player who opts
in is submitted to Apple's Game Center, which Apple processes under its own
privacy policy. Per Apple's App Privacy guidance, data that Apple's Game Center
handles is not collected by the developer, so it is not declared here — the app
sends the score through GameKit only and never receives or stores the player's
Game Center ID or scores on any developer server. **Gameplay Content** and
**User ID** therefore stay *Not collected*; declare them only if a future build
copies Game Center data to Firebase or another developer-controlled service.

| Apple data type | Collected | Linked to user | Used for tracking | Purposes |
|---|---|---|---|---|
| Purchases (Purchase history) | Yes | Yes (RevenueCat anonymous app user ID) | No | App Functionality |
| Coarse Location (IP-derived, AdMob) | Yes | No | No | Third-Party Advertising |
| Email Address | No | — | — | — |
| Name | No | — | — | — |
| User ID | No | — | — | — (no account; RevenueCat's ID is anonymous and device-scoped; the Game Center player ID is handled by Apple) |
| Gameplay Content | No | — | — | — (the Game Center score is handled by Apple, not the developer) |
| Device ID (IDFA, IDFV, Firebase app-instance ID) | Yes | Yes | **Yes** | Third-Party Advertising; Analytics; App Functionality (fraud prevention) |
| Product Interaction | Yes | Yes | No | Analytics; Third-Party Advertising |
| Advertising Data | Yes | Yes | **Yes** | Third-Party Advertising |
| Crash Data | Yes | No | No | App Functionality |
| Performance Data | Yes | No | No | App Functionality |
| Other Diagnostic Data | Yes | No | No | App Functionality |
| Photos or Videos | No | — | — | — |

All other Apple data types (Contacts, Health, Financial Info, Precise Location,
Sensitive Info, Search/Browsing History, User Content, Audio, etc.): **Not collected**.

- **Tracking:** Yes — this app tracks (Device ID + Advertising Data, for
  Third-Party Advertising). Therefore App Tracking Transparency is required.
- **IDFA question**: *Yes, this app uses the Advertising Identifier* — to serve
  advertisements within the app and to attribute ad actions. It is requested
  only after the ATT prompt is granted.
- **`NSUserTrackingUsageDescription`** (Info.plist):

```text
This lets us show ads that are more relevant to you and keep the game free.
```

- `SKAdNetworkItems`: include Google's SKAdNetwork identifier list in Info.plist (AdMob requirement).

---

## 11. In-App Purchases and Game Center for App Store Connect

App Store Connect → this app → Monetization → In-App Purchases. Product IDs are
the same as Play **except Remove Ads**: App Store product ids are unique across
the whole developer account and Trap Jam already owns `remove_ads`, so here it
is `frosttower_remove_ads` (already created). The app maps it to `remove_ads`
in `www/js/config.js` (`iosProductIds`). RevenueCat entitlements keep the Play
ids: attach `frosttower_remove_ads` to entitlement `remove_ads`. All four are
**Non-Consumable** — never consumable, or a reinstall would lose the unlock.

| Reference name | Product ID | Type | USD price (Play match) | Display name (≤30) | Description (≤45) |
|---|---|---|---|---|---|
| Remove Ads | `frosttower_remove_ads` | Non-Consumable | $2.99 | Remove Ads (10) | Turns off every ad for good, videos included. (45) |
| Aurora climber | `skin_aurora` | Non-Consumable | $1.99 | Aurora Climber (14) | Unlocks the Aurora climber skin. (32) |
| Golden Crown climber | `skin_golden` | Non-Consumable | $2.99 | Golden Crown Climber (20) | Unlocks the Golden Crown climber skin. (38) |
| Void Walker climber | `skin_void` | Non-Consumable | $2.99 | Void Walker Climber (19) | Unlocks the Void Walker climber skin. (37) |

- Snowflakes and power-ups (Shield, Head start) are earned in-game currency and
  items, not IAPs — nothing to create for them.
- All four are restorable — the shop has a **Restore purchases** button
  (SHOP & SKINS).
- **Review screenshot** (required per product, any accepted iPhone size): a
  capture of the *SHOP & SKINS* screen with the product visible (the skin row for
  the three skins; the Remove Ads row for `frosttower_remove_ads`). Review note per product:
  "Purchased from SHOP & SKINS on the main menu."
- First IAPs must be submitted **with** the app version (select them on the
  version page under "In-App Purchases and Subscriptions").
- Paid Apps Agreement, banking and tax must be active, or products stay
  unavailable in review.

### Game Center leaderboards to create

App Store Connect → this app → Services → Game Center → Leaderboards. One
**Classic** board, mirroring the Play Games "Highest Floor" board; the id must
match the one the iOS build submits to.

| Reference name | Leaderboard ID | Type | Score format | Sort order | Submission type | Display name (en-US) |
|---|---|---|---|---|---|---|
| Highest Floor | `frosttower.best_floor` | Classic | Integer | High to Low | Best score | Highest Floor |

- Score format suffix (optional, en-US): " floors" / singular " floor".
- Add the en-US localization (display name, optional 512×512 image) or the board
  cannot be attached to the version.
- On the version page, tick **Game Center** and add the board, so it goes live
  with the release.

---

## 12. App Review notes (≤4000) — 2601 chars

```text
Frost Tower is a single-player, offline one-thumb arcade climber. There is no account and no login; every feature is available from the first launch. Game Center is optional. No demo account is needed.

FIRST LAUNCH
• The App Tracking Transparency prompt is shown before any ad is requested (EEA/UK users also see Google's consent form). Either answer works; declining only makes ads non-personalised.

HOW TO REACH EACH FEATURE
• Play: tap CLIMB! on the main menu. Hold the left or right side of the screen to run; the climber bounces automatically. The pause button (II) is top of screen during a run.
• Game over card: CLIMB AGAIN, optional "Watch ad · Revive" and "Watch ad · Double" reward videos, and SHOP & SKINS.
• Daily mission: the DAILY MISSION tile on the main menu; the reward is claimed there or on the game over card. The first time a mission reward is claimed, the app asks for notification permission for one local reminder (no push server is used).
• Shop: SHOP & SKINS on the main menu — nine climbers (two unlock by climbing, three cost earned snowflakes, three are in-app purchases), Shield and Head start power-ups bought with snowflakes, an optional "Watch an ad · +50" video, Remove Ads, a Restore purchases button and Privacy choices (ad consent). Purchases can be tested with any Sandbox Apple ID.

LEADERBOARDS (Game Center)
• One Game Center leaderboard, Highest Floor, holds each player's best floor. Open it with the GLOBAL RANKING button on the main menu.
• Game Center sign-in is optional and is never requested at launch: the app asks only when the player taps GLOBAL RANKING. A signed-out player then sees the Game Center sign-in sheet; cancelling it shows "Sign in to Game Center to rank" and the rest of the game is unaffected. A player already signed in to Game Center on the device just sees Apple's "Welcome back" banner. A new best floor is submitted to the board after a run.

ADS (Google AdMob)
• Banner on the main menu and game over card only (never during a run); a full-screen interstitial at most every third run with a 90-second cooldown, every third of which is a rewarded interstitial that grants snowflakes; optional rewarded videos (revive, double snowflakes, +50 snowflakes). Ad requests are capped to G-rated content. Remove Ads silences every format, reward videos included.

DATA
Game progress is stored only on the device. Firebase Analytics receives gameplay events; RevenueCat handles purchase restoration; Game Center (Apple) holds leaderboard scores for players who sign in. All traffic is standard HTTPS.

Contact: ahmadessam1997@gmail.com
```

Sign-in details in App Store Connect: **untick "Sign-in required"**.

---

## 13. Export compliance

Standard HTTPS only (AdMob, Firebase, RevenueCat). No custom or proprietary
encryption. Set in Info.plist:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

App Store Connect answer: "None of the algorithms mentioned above" / exempt.
No export compliance documents needed.

## 14. Content rights

"Does your app contain, show, or access third-party content?" → **No.** All
art, climbers, levels, text and audio are original work by Ahmad Essam. (Ads are
served by AdMob and are not app content.)

---

## 15. Ordered checklist — App Store Connect

1. Apple Developer → Identifiers: register App ID `com.ahmadessam.frosttower` (capabilities: In-App Purchase and **Game Center** — confirm Game Center is ticked, the build's `App.entitlements` carries `com.apple.developer.game-center` and signing fails without it; Push not needed — the reminder is local).
2. Update `docs/privacy-policy.html` for iOS **before** submitting: add App Store billing (Apple handles payment and refunds), the IDFA and the ATT prompt, "Settings → Privacy & Security → Tracking" for opting out, iOS notification settings, and describe the global ranking as Google Play Games on Android and Game Center (Apple) on iOS. Same URL. Push to GitHub Pages.
3. AdMob: add an **iOS** app "Frost Tower" and create iOS ad units for the four formats (banner, interstitial, rewarded, rewarded interstitial). Put the iOS app ID in Info.plist `GADApplicationIdentifier`. Add the iOS app to the UMP / Privacy & messaging consent form (and an IDFA explainer message if wanted).
4. Firebase: add an iOS app with the bundle id; download `GoogleService-Info.plist` into the Xcode project.
5. RevenueCat: add an App Store app to the project, upload the In-App Purchase key (.p8) and App Store Connect API key, put the `appl_…` public key in `config.js` for iOS, attach the four products to the same-id entitlements and the offering (except `frosttower_remove_ads` → entitlement `remove_ads`).
6. App Store Connect → My Apps → **+ New App**: platform iOS, name `Frost Tower: Climb or Freeze`, language English (U.S.), bundle id, SKU `com.ahmadessam.frosttower`, full access.
7. App Information: subtitle, categories (Games → Arcade; Casual), content rights (No), age rating questionnaire (section 9), privacy policy URL.
8. Pricing and Availability: Free, all territories.
9. App Privacy: enter the label (section 10) and publish it.
10. Agreements, Tax and Banking: Paid Apps agreement active.
11. In-App Purchases: create `frosttower_remove_ads`, `skin_aurora`, `skin_golden`, `skin_void` (section 11) with display name, description, price, review screenshot.
12. Game Center: Services → Game Center → create the `frosttower.best_floor` leaderboard (section 11 table) with its en-US localization **before** submitting for review.
13. Build: set version 1.2.2 / build 1, Info.plist keys (`NSUserTrackingUsageDescription`, `GADApplicationIdentifier`, `SKAdNetworkItems`, `ITSAppUsesNonExemptEncryption = NO`), Game Center entitlement present, archive and upload; answer export compliance.
14. TestFlight: internal test on a real iPhone — ATT prompt appears before ads, Sandbox purchase + Restore purchases work, notification permission only on the first mission claim, no Game Center prompt at launch, GLOBAL RANKING asks for Game Center sign-in and opens the Highest Floor board, a new best floor reaches the board. (TestFlight never shows the native review sheet; confirm that path in a Debug build.)
15. Version page: screenshots (6.9" iPhone, 1320×2868 or 1290×2796; plus 6.5" if required — include a shop/skins shot), promotional text, description, keywords, support + marketing URLs, copyright, select the build, attach all four IAPs, enable the **Game Center** switch and add the Highest Floor leaderboard, App Review contact + notes (section 12), sign-in not required.
16. Submit for review; release manually after approval.
