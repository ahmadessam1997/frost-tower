import UIKit
import Capacitor

/**
 * The app's bridge view controller. Exists only to register the two
 * in-app (non-npm) plugins, the iOS counterpart of MainActivity.java's
 * registerPlugin(LeaderboardPlugin.class):
 *   - LeaderboardPlugin  -> JS "Leaderboard" (Game Center)
 *   - StoreReviewPlugin  -> JS "StoreReview" (system review request)
 *
 * Used by SceneDelegate (which builds the root view controller in code) and
 * by Main.storyboard (customClass MainViewController, module App).
 */
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LeaderboardPlugin())
        bridge?.registerPluginInstance(StoreReviewPlugin())
    }
}
