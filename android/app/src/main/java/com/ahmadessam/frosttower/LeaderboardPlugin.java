package com.ahmadessam.frosttower;

import android.app.Activity;
import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.LeaderboardsClient;

/**
 * Minimal Play Games Services bridge — submit a score and show the
 * leaderboard UI. Written in-house rather than pulling a third-party plugin:
 * the only Capacitor 8 option on npm was a 0.2.x package with one maintainer,
 * and a bad native plugin is exactly what killed both ads and purchases in
 * builds 1-3 (see SESSION-NOTES 2026-08-09).
 *
 * Every method resolves rather than rejecting. A leaderboard is a nice-to-have
 * on top of a game that must keep working offline, signed out, or on a device
 * with no Play Games at all — it must never be able to break a run.
 *
 * NOTE: methods are declared RETURN_PROMISE explicitly. The RevenueCat plugin
 * declares configure() as RETURN_NONE, which returns undefined to JS, and
 * chaining .then() off it threw a TypeError that took down the whole boot
 * chain. Being explicit here means the JS side can trust what it gets back.
 */
@CapacitorPlugin(name = "Leaderboard")
public class LeaderboardPlugin extends Plugin {

    /** Set once we know sign-in succeeded, so submit/show can fail fast. */
    private boolean signedIn = false;

    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void signIn(final PluginCall call) {
        try {
            GamesSignInClient client = PlayGames.getGamesSignInClient(getActivity());
            client.isAuthenticated().addOnCompleteListener(task -> {
                boolean ok = task.isSuccessful()
                        && task.getResult() != null
                        && task.getResult().isAuthenticated();
                if (ok) {
                    signedIn = true;
                    call.resolve(result(true, null));
                    return;
                }
                // Not authenticated yet — ask once. PGS v2 shows its own UI and
                // will not prompt again if the player declines, so this cannot
                // turn into a nag loop.
                client.signIn().addOnCompleteListener(t2 -> {
                    signedIn = t2.isSuccessful()
                            && t2.getResult() != null
                            && t2.getResult().isAuthenticated();
                    call.resolve(result(signedIn, signedIn ? null : "not signed in"));
                });
            });
        } catch (Throwable e) {
            // No Play Games on the device, or the SDK failed to initialise.
            call.resolve(result(false, String.valueOf(e.getMessage())));
        }
    }

    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void isSignedIn(final PluginCall call) {
        try {
            PlayGames.getGamesSignInClient(getActivity())
                    .isAuthenticated()
                    .addOnCompleteListener(task -> {
                        boolean ok = task.isSuccessful()
                                && task.getResult() != null
                                && task.getResult().isAuthenticated();
                        signedIn = ok;
                        call.resolve(result(ok, null));
                    });
        } catch (Throwable e) {
            call.resolve(result(false, String.valueOf(e.getMessage())));
        }
    }

    /**
     * Submit a score. Play Games keeps only the player's best for a
     * "largest first" board, so submitting a lower score is harmless and we
     * do not need to track a local high-water mark.
     */
    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void submitScore(final PluginCall call) {
        String id = call.getString("leaderboardId");
        Integer score = call.getInt("score");
        if (id == null || id.isEmpty() || score == null) {
            call.resolve(result(false, "missing leaderboardId or score"));
            return;
        }
        try {
            LeaderboardsClient lb = PlayGames.getLeaderboardsClient(getActivity());
            lb.submitScore(id, score.longValue());
            call.resolve(result(true, null));
        } catch (Throwable e) {
            call.resolve(result(false, String.valueOf(e.getMessage())));
        }
    }

    /** Opens the native Play Games leaderboard screen. */
    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void showLeaderboard(final PluginCall call) {
        String id = call.getString("leaderboardId");
        if (id == null || id.isEmpty()) {
            call.resolve(result(false, "missing leaderboardId"));
            return;
        }
        try {
            PlayGames.getLeaderboardsClient(getActivity())
                    .getLeaderboardIntent(id)
                    .addOnSuccessListener(intent -> {
                        try {
                            startActivityForResult(call, intent, "leaderboardClosed");
                        } catch (Throwable e) {
                            call.resolve(result(false, String.valueOf(e.getMessage())));
                        }
                    })
                    .addOnFailureListener(e ->
                            call.resolve(result(false, String.valueOf(e.getMessage()))));
        } catch (Throwable e) {
            call.resolve(result(false, String.valueOf(e.getMessage())));
        }
    }

    @ActivityCallback
    private void leaderboardClosed(PluginCall call, ActivityResult res) {
        if (call == null) return;
        call.resolve(result(true, null));
    }

    private JSObject result(boolean ok, String error) {
        JSObject o = new JSObject();
        o.put("ok", ok);
        if (error != null) o.put("error", error);
        return o;
    }
}
