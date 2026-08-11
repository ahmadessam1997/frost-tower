/* =====================================================================
   Frost Tower — global leaderboard (Google Play Games Services)
   ---------------------------------------------------------------------
   Ranks players by the highest floor they have ever reached.

   Every entry point RESOLVES, never rejects, and every failure is silent
   from the game's point of view. A leaderboard is decoration on top of a
   game that has to keep working offline, signed out, on a device with no
   Play Games, and in a browser. It must never be able to interrupt a run
   or block the boot chain — that is exactly what billing.js did to ads.

   The native side is our own plugin (android/.../LeaderboardPlugin.java)
   rather than a third-party package; see SESSION-NOTES 2026-08-10.
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.FTConfig;

  var Leaderboard = {
    available: false,
    signedIn: false,
    lastError: null,
    _submittedBest: 0,

    init: function () {
      var self = this;
      if (!Cfg.isNative()) {
        console.info('[leaderboard] Browser preview — leaderboard disabled.');
        return Promise.resolve(false);
      }
      var P = global.Capacitor && global.Capacitor.Plugins &&
              global.Capacitor.Plugins.Leaderboard;
      if (!P) {
        self.lastError = 'Leaderboard plugin missing';
        console.warn('[leaderboard] plugin not registered. Capacitor.Plugins =',
                     Object.keys((global.Capacitor && global.Capacitor.Plugins) || {}).join(','));
        return Promise.resolve(false);
      }
      self._p = P;
      self.available = true;

      /* Sign-in is attempted once at boot. PGS v2 is zero-click for players
         who already use Play Games and shows nothing at all for those who
         declined before, so this is not a prompt the player has to fight. */
      return P.signIn()
        .then(function (r) {
          self.signedIn = !!(r && r.ok);
          if (!self.signedIn) self.lastError = (r && r.error) || 'not signed in';
          console.info('[leaderboard] signedIn=' + self.signedIn +
                       (self.lastError ? ' (' + self.lastError + ')' : ''));
          return self.signedIn;
        })
        .catch(function (e) {
          self.signedIn = false;
          self.lastError = (e && e.message) || 'sign-in failed';
          console.warn('[leaderboard] signIn:', e);
          return false;
        });
    },

    /* Called after every run. Play keeps only the player's best on a
       "largest first" board, so re-submitting a lower number is harmless —
       but we skip it anyway to avoid pointless native calls mid-session. */
    submitFloor: function (floor) {
      var self = this;
      if (!self.available || !self.signedIn || !self._p) return Promise.resolve(false);
      if (!(floor > 0) || floor <= self._submittedBest) return Promise.resolve(false);
      self._submittedBest = floor;
      return self._p.submitScore({
        leaderboardId: Cfg.leaderboard.highestFloorId,
        score: floor
      }).then(function (r) {
        if (!(r && r.ok)) console.warn('[leaderboard] submit:', r && r.error);
        return !!(r && r.ok);
      }).catch(function (e) {
        console.warn('[leaderboard] submit threw:', e);
        return false;
      });
    },

    /* Opens the native Play Games leaderboard. Resolves {ok} either way so
       the caller can show a toast rather than nothing at all. */
    show: function () {
      var self = this;
      if (!self.available || !self._p) {
        return Promise.resolve({ ok: false, error: 'unavailable' });
      }
      var open = function () {
        return self._p.showLeaderboard({ leaderboardId: Cfg.leaderboard.highestFloorId })
          .then(function (r) { return r || { ok: false }; })
          .catch(function (e) { return { ok: false, error: (e && e.message) || 'failed' }; });
      };
      // A player who declined sign-in at boot may want in now that they have
      // actively asked to see the board, so try once more before giving up.
      if (self.signedIn) return open();
      return self._p.signIn().then(function (r) {
        self.signedIn = !!(r && r.ok);
        if (!self.signedIn) return { ok: false, error: 'not signed in' };
        return open();
      }).catch(function () {
        return { ok: false, error: 'not signed in' };
      });
    }
  };

  global.FTLeaderboard = Leaderboard;
})(window);
