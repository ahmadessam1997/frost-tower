import Foundation
import UIKit
import StoreKit
import Capacitor

/**
 * iOS replacement for the custom rating prompt (www/js/rate.js). App Store
 * Review Guideline 5.6.1 forbids custom review dialogs, so at the exact
 * moment Android shows its prompt, iOS asks the system for its own review
 * sheet instead. Apple decides whether it actually appears (at most three
 * times a year per app), and never reports whether it did or what the
 * player chose, so this resolves { ok: true } once the request is made.
 *
 * Never rejects. Registered in MainViewController.capacitorDidLoad().
 * Written on Windows without a compiler; the first Codemagic build is its
 * compile check.
 */
@objc(StoreReviewPlugin)
public class StoreReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreReviewPlugin"
    public let jsName = "StoreReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    @objc func requestReview(_ call: CAPPluginCall) {
        Task { @MainActor in
            let scene = self.bridge?.viewController?.view.window?.windowScene
                ?? UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .first { $0.activationState == .foregroundActive }
            guard let windowScene = scene else {
                call.resolve(["ok": false, "error": "no active window scene"])
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: windowScene)
            } else {
                SKStoreReviewController.requestReview(in: windowScene)
            }
            call.resolve(["ok": true])
        }
    }
}
