package com.ahmadessam.frosttower;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.games.PlayGamesSdk;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register before super.onCreate() — Capacitor builds its plugin
        // registry during BridgeActivity.onCreate(), so a plugin added after
        // that call never reaches window.Capacitor.Plugins.
        registerPlugin(LeaderboardPlugin.class);
        super.onCreate(savedInstanceState);

        // PGS v2 needs one-time initialisation. Wrapped because a device
        // without Play Games must still boot the game normally — the
        // leaderboard is optional, the game is not.
        try {
            PlayGamesSdk.initialize(this);
        } catch (Throwable e) {
            android.util.Log.w("FrostTower", "PlayGamesSdk.initialize failed: " + e.getMessage());
        }
    }
}
