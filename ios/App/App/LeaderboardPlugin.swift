import Foundation
import UIKit
import GameKit
import Capacitor

/**
 * Game Center twin of android/.../LeaderboardPlugin.java (Google Play Games).
 * Same JS name ("Leaderboard"), same four methods, same resolve shape
 * { ok: Bool, error?: String }, so www/js/leaderboard.js runs unchanged on
 * both platforms.
 *
 * Every method RESOLVES, never rejects: a leaderboard is decoration on top
 * of a game that must keep working offline, signed out, or with Game Center
 * switched off — it must never be able to break a run.
 *
 * Sign-in mirrors Android: isSignedIn() (called at boot) installs GameKit's
 * authenticateHandler, which signs a returning player in silently. If
 * GameKit hands back a login view controller it is only STORED here, never
 * presented at boot; signIn() (called from the GLOBAL RANKING tap) is the
 * one place it is shown.
 *
 * Registered in MainViewController.capacitorDidLoad(). Written on Windows
 * without a compiler; the first Codemagic build is its compile check.
 */
@objc(LeaderboardPlugin)
public class LeaderboardPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "LeaderboardPlugin"
    public let jsName = "Leaderboard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSignedIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise)
    ]

    // All state below is only touched on the main thread.
    private var handlerInstalled = false
    /** True once authenticateHandler has reported at least once. */
    private var authResolved = false
    /** The login UI GameKit offered and nobody has shown yet. */
    private var pendingLoginVC: UIViewController?
    /** isSignedIn() calls waiting for the first handler report. */
    private var statusCalls: [CAPPluginCall] = []
    /** signIn() calls waiting for the login UI to finish. */
    private var signInCalls: [CAPPluginCall] = []
    /** The showLeaderboard() call whose Game Center screen is open. */
    private var showCall: CAPPluginCall?

    // MARK: - JS methods

    @objc func isSignedIn(_ call: CAPPluginCall) {
        Task { @MainActor in
            if self.authResolved {
                call.resolve(self.result(GKLocalPlayer.local.isAuthenticated, nil))
                return
            }
            self.statusCalls.append(call)
            self.installHandlerIfNeeded()
            // The handler always reports, but boot must never hang on it.
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                guard let self = self, !self.statusCalls.isEmpty else { return }
                let calls = self.statusCalls
                self.statusCalls = []
                let ok = GKLocalPlayer.local.isAuthenticated
                for c in calls { c.resolve(self.result(ok, ok ? nil : "not signed in")) }
            }
        }
    }

    @objc func signIn(_ call: CAPPluginCall) {
        Task { @MainActor in
            if GKLocalPlayer.local.isAuthenticated {
                call.resolve(self.result(true, nil))
                return
            }
            if !self.handlerInstalled || !self.authResolved {
                // First report not in yet: handleAuth() presents the login
                // UI for this call if GameKit offers one.
                self.signInCalls.append(call)
                self.installHandlerIfNeeded()
                return
            }
            if let vc = self.pendingLoginVC {
                self.pendingLoginVC = nil
                self.signInCalls.append(call)
                if !self.presentOnTop(vc) { self.finishSignIn(false) }
                return
            }
            // No login UI on offer: the player cancelled Game Center earlier
            // (GameKit will not ask again this session) or it is disabled.
            call.resolve(self.result(false, "not signed in"))
        }
    }

    /**
     * Game Center keeps only the player's best on a "high score first"
     * board, so re-submitting a lower number is harmless.
     */
    @objc func submitScore(_ call: CAPPluginCall) {
        guard let id = call.getString("leaderboardId"), !id.isEmpty,
              let score = call.getInt("score") else {
            call.resolve(result(false, "missing leaderboardId or score"))
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(result(false, "not signed in"))
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                  leaderboardIDs: [id]) { error in
            if let e = error {
                call.resolve(["ok": false, "error": e.localizedDescription])
            } else {
                call.resolve(["ok": true])
            }
        }
    }

    /** Opens the native Game Center leaderboard screen. */
    @objc func showLeaderboard(_ call: CAPPluginCall) {
        guard let id = call.getString("leaderboardId"), !id.isEmpty else {
            call.resolve(result(false, "missing leaderboardId"))
            return
        }
        Task { @MainActor in
            guard GKLocalPlayer.local.isAuthenticated else {
                call.resolve(self.result(false, "not signed in"))
                return
            }
            if let old = self.showCall {
                self.showCall = nil
                old.resolve(self.result(false, "superseded"))
            }
            let vc = GKGameCenterViewController(leaderboardID: id,
                                                playerScope: .global,
                                                timeScope: .allTime)
            vc.gameCenterDelegate = self
            self.showCall = call
            if !self.presentOnTop(vc) {
                self.showCall = nil
                call.resolve(self.result(false, "no view controller to present from"))
            }
        }
    }

    // MARK: - GKGameCenterControllerDelegate

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        Task { @MainActor in
            gameCenterViewController.dismiss(animated: true) {
                guard let c = self.showCall else { return }
                self.showCall = nil
                c.resolve(self.result(true, nil))
            }
        }
    }

    // MARK: - Authentication

    private func installHandlerIfNeeded() {
        if handlerInstalled { return }
        handlerInstalled = true
        // Setting the handler starts authentication. GameKit calls it again
        // whenever the state changes (e.g. after the login UI closes).
        GKLocalPlayer.local.authenticateHandler = { [weak self] vc, error in
            Task { @MainActor in self?.handleAuth(vc, error) }
        }
    }

    private func handleAuth(_ vc: UIViewController?, _ error: Error?) {
        authResolved = true
        if let vc = vc {
            // Login needed. Report "signed out" to boot; show the UI only if
            // the player has asked to sign in (GLOBAL RANKING tap).
            flushStatus(false)
            if signInCalls.isEmpty {
                pendingLoginVC = vc
            } else {
                pendingLoginVC = nil
                if !presentOnTop(vc) { finishSignIn(false) }
            }
            return
        }
        pendingLoginVC = nil
        let ok = GKLocalPlayer.local.isAuthenticated
        if !ok, let e = error {
            print("[Leaderboard] Game Center: \(e.localizedDescription)")
        }
        flushStatus(ok)
        finishSignIn(ok)
    }

    private func flushStatus(_ ok: Bool) {
        let calls = statusCalls
        statusCalls = []
        for c in calls { c.resolve(result(ok, ok ? nil : "not signed in")) }
    }

    private func finishSignIn(_ ok: Bool) {
        let calls = signInCalls
        signInCalls = []
        for c in calls { c.resolve(result(ok, ok ? nil : "not signed in")) }
    }

    // MARK: - Helpers

    /** Presents over whatever is on top (an ad may be showing). */
    private func presentOnTop(_ vc: UIViewController) -> Bool {
        guard var top = bridge?.viewController else { return false }
        while let next = top.presentedViewController { top = next }
        top.present(vc, animated: true, completion: nil)
        return true
    }

    private func result(_ ok: Bool, _ error: String?) -> [String: Any] {
        var o: [String: Any] = ["ok": ok]
        if let e = error { o["error"] = e }
        return o
    }
}
