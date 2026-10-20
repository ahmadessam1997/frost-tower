# Frost Tower — iOS release: what is ready and what is left

Prepared 2026-10-14 on Windows (no Mac). The iOS project has never been opened
in Xcode; the first Codemagic build is the real compile check. **The three
Swift files below were written without a compiler** against current GameKit,
StoreKit and Capacitor 8 APIs: if the first build fails, look there first.

Goal: the iOS game is feature-for-feature the Android game. The only
differences are the platform services underneath (Game Center instead of Play
Games, Apple's review sheet instead of the custom rating dialog, App Store
links instead of Play links).

## Ready in this folder

| What | Where |
|---|---|
| Xcode project (Capacitor 8, Swift Package Manager, no CocoaPods) | `ios/` (`npx cap add ios`, `@capacitor/ios` added to package.json) |
| Bundle id `com.ahmadessam.frosttower`, version 1.2.2, iPhone only, portrait | `ios/App/App.xcodeproj/project.pbxproj`, `ios/App/App/Info.plist` |
| App icon 1024 (no alpha, square) and splash (background `#0a1030`) | `ios/App/App/Assets.xcassets` (source: `ios-assets/`, regenerate with `npx capacitor-assets generate --ios --assetPath ios-assets`) |
| Info.plist: AdMob app id, ATT prompt text, 45 SKAdNetwork ids, `ITSAppUsesNonExemptEncryption = NO`, `itms-apps` query scheme | `ios/App/App/Info.plist` |
| Optional Firebase: a build phase bundles `ios/App/App/GoogleService-Info.plist` only if it exists | pbxproj phase "Copy GoogleService-Info.plist if present" |
| **Global leaderboard on Game Center**: Swift plugin registered under the same JS name `Leaderboard`, same methods (`signIn`, `isSignedIn`, `submitScore`, `showLeaderboard`) and the same `{ok, error?}` results as `LeaderboardPlugin.java`, all resolving and never rejecting. Boot only checks sign-in silently; the Game Center login sheet appears only from the GLOBAL RANKING tap, as on Android. | `ios/App/App/LeaderboardPlugin.swift`; `www/js/leaderboard.js` picks the board id per platform; `www/js/config.js` `leaderboard.ios` |
| Game Center capability | `ios/App/App/App.entitlements` (`com.apple.developer.game-center`), wired with `CODE_SIGN_ENTITLEMENTS` in both App configs |
| **Rating at the same moment as Android**: same count and back-off, but on iOS the system review sheet is requested instead of the custom dialog (App Store Review Guideline 5.6.1 forbids custom review prompts). Each request counts as a "Later" for the back-off; Apple itself caps the sheet at 3 per year. After the request the player returns to the game-over card, like "Rate now" on Android. | `ios/App/App/StoreReviewPlugin.swift` (JS `StoreReview.requestReview`), `www/js/rate.js`, `www/js/game.js` |
| Plugin registration (the iOS counterpart of `MainActivity.registerPlugin`) | `ios/App/App/MainViewController.swift` (`capacitorDidLoad` → `registerPluginInstance`). Used by `SceneDelegate.swift` (it builds the root view controller in code, so this edit is the one that matters) and by `Main.storyboard` (customClass `MainViewController`, module App). All three Swift files are in the pbxproj (file refs, App group, Sources phase). |
| Per-platform config: iOS ad units, iOS RevenueCat key, App Store ids, store links/names, Game Center board id | `www/js/config.js` (`admob.ios`, `revenueCat.iosApiKey`, `appStoreIds`, `leaderboard.ios`, `adUnit()`, `revenueCatKey()`, `storeUrl()`, `storeName()`) |
| ATT request after UMP consent and before AdMob init (iOS only) | `www/js/ads.js` `_requestTracking` |
| "More games" uses App Store links on iOS; each game hidden until its App Store id is known (button hidden while none are) | `www/js/game.js` `liveGames()` / `openListing()` |
| Wording: "Sign in to Game Center to rank", "Free on the App Store", purchases "tied to your Apple Account" | `www/js/game.js`, `www/js/shop.js`, `www/index.html` |
| Native ad formats | Nothing to port: Frost has no native-ad plugin on Android (banner, interstitial, rewarded, rewarded interstitial all come from the AdMob plugin on both platforms). |
| Cloud build + TestFlight upload | `codemagic.yaml` |
| Store icon, 6.9" and 6.5" screenshots, listing text, IAP table | `app-store/` |

Android is unchanged (every file under `android/` byte-identical before and
after): features-sim 141, e2e 42, rate 24 all pass. A simulated-iOS browser
check (fake Capacitor platform, stub plugins) confirms the ranking button,
board ids, Game Center wording and the native review path.

## Placeholders to fill (search for `IOS_TODO`)

| Placeholder | Where | Get it from |
|---|---|---|
| `admob.ios.*` (Google TEST ids now) + `GADApplicationIdentifier` | `www/js/config.js`, `ios/App/App/Info.plist` | AdMob → Apps → Add app → iOS → "Frost Tower"; create banner, interstitial, rewarded, rewarded interstitial. **Do not release to the App Store with the test ids: they earn nothing.** The plist app id and `admob.ios.appId` must match. |
| `IOS_TODO_RC_IOS_KEY` | `www/js/config.js` `revenueCat.iosApiKey` | RevenueCat → project "Frost Tower" → Apps → + App Store app (bundle id above, App Store Connect in-app purchase key) → public key `appl_…`. Until set, the iOS shop says "Store unavailable" (fails closed) and Restore purchases is hidden. |
| `IOS_TODO_APP_STORE_ID_*` | `www/js/config.js` `appStoreIds` | App Store Connect → each app → App Information → Apple ID (digits). Sibling games appear in "More games" once their ids are filled. (The rating request does not need it.) |
| `IOS_TODO_CODEMAGIC_ASC_INTEGRATION_NAME` | `codemagic.yaml` | Codemagic → Team settings → Integrations → App Store Connect → the key's name |
| GoogleService-Info.plist (optional) | Codemagic env group `firebase_ios`, var `GOOGLE_SERVICE_INFO_PLIST` (base64) | Firebase → project → Add app → iOS → bundle id above |

## Game Center leaderboards to create in App Store Connect

App Store Connect → Frost Tower → Services → Game Center → Leaderboards → +
(Classic). The id must match `config.js` exactly.

| Leaderboard ID | Name | Score format | Sort order | Submission | Android twin |
|---|---|---|---|---|---|
| `frosttower.best_floor` | Highest Floor | Integer | High to Low ("High Score First") | Best Score | Play Games `CgkI6_KxzOIFEAIQAA` "Highest Floor", largest first |

Add an English localization (e.g. name "Highest Floor", format suffix
" floors"). Then enable Game Center on the app version page ("Game Center"
section → add the leaderboard) before submitting. As on Android, only floors
CLIMBED count (a head start never reaches the board).

## Console steps, in order

1. Apple Developer Program membership (US$99/yr) and the Paid Apps agreement + tax/banking in App Store Connect (needed for in-app purchases).
2. Certificates, Identifiers & Profiles → register App ID `com.ahmadessam.frosttower` with the **Game Center** capability ticked (it is on by default for App Store App IDs; confirm it). App Store Connect → Apps → + New App: iOS, name "Frost Tower", SKU = bundle id.
3. In-app purchases, all Non-Consumable: `frosttower_remove_ads`, `skin_aurora`, `skin_golden`, `skin_void`. Details in `app-store/LISTING.md` §11. Remove Ads cannot be `remove_ads` on iOS: App Store product ids are unique across the developer account and Trap Jam owns it. The app still calls it `remove_ads` everywhere (save, shop, analytics); `config.js` `iosProductIds` + `storeProductId()` / `productIdFromStore()` translate at the billing boundary on iOS only (Android sends `remove_ads` as before).
4. Game Center leaderboard from the table above.
5. RevenueCat: add the App Store app, import all four products, attach entitlements with the same ids, add them to the `default` offering; put the `appl_` key in config.js. **Attach `frosttower_remove_ads` to entitlement `remove_ads`** (the same entitlement the Play product uses).
6. AdMob iOS app and units; update config.js and Info.plist. Create the UMP consent message for iOS too (Privacy & messaging), plus an IDFA explainer message.
7. App Store Connect API key (Users and Access → Integrations → Team key, App Manager role) → add to Codemagic.
8. Commit and push this repo (github.com/ahmadessam1997/frost-tower is the one Codemagic builds; `ios/`, `ios-assets/` and `codemagic.yaml` must be in it, and so must `www/js/rate.js`, `missions.js`, `analytics.js` and `www/img/`, which are currently untracked). Only public ids are in these files.
9. Codemagic → add the repo → run workflow `ios-app-store` → the build lands in TestFlight. If the provisioning profile Codemagic fetches lacks Game Center, signing fails on the entitlement: re-check step 2.
10. Fill the listing from `app-store/LISTING.md` (update its "no Game Center in this release" note: Game Center is now in), upload `app-store/screenshots/iphone-6.9` (and 6.5), App Privacy answers (add Game Center: Gameplay Content / player id if asked), age rating, submit for review.

## Test in TestFlight before submitting

- First launch: UMP consent (in EEA/UK), then the iOS tracking prompt, then ads load (test ads until real ids). Banner only on the menu and game-over card, never during a climb.
- Game Center: a player already signed in to Game Center sees the "Welcome back" banner and GLOBAL RANKING opens the Highest Floor board. A signed-out player is never prompted at launch; tapping GLOBAL RANKING shows the Game Center login, and cancelling it shows "Sign in to Game Center to rank". A new best floor appears on the board (sandbox boards can lag a few minutes).
- Rating: after 2 finished runs, tapping CLIMB AGAIN shows Apple's review sheet (TestFlight never shows the real sheet — Apple suppresses it there; in a debug build it always appears), then the game-over card.
- Shop: products load with local prices (Remove Ads priced from `frosttower_remove_ads`), buy Remove Ads and a skin with a Sandbox tester, **Restore purchases** (shop → Upgrades) brings them back on a reinstall.
- Claim a daily mission → notification permission prompt → reminder arrives ~24 h later.
- No "Google Play" or "Play Games" text anywhere.
- "More games" button hidden until sibling App Store ids exist.
- Safe areas: notch / Dynamic Island and home indicator do not cover buttons or the HUD.

## Notes

- TestFlight never displays `requestReview` sheets, so the rating path can only be confirmed visually in a Debug build from Xcode or after release.
- If the Swift plugins ever do not register, the JS degrades safely: no plugin means GLOBAL RANKING stays hidden and no rating request is made (the custom dialog never appears on iOS).
