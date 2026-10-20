/* =====================================================================
   Frost Tower — analytics (Firebase Analytics)
   ---------------------------------------------------------------------
   One function, log(name, params), in front of
   @capacitor-firebase/analytics. Firebase itself was already linked
   natively (build.gradle + google-services.json) for AdMob's user
   metrics; this adds the custom events that say what players DO.

   Fire-and-forget, like ads.js: it never throws and never returns
   anything worth awaiting, so no call site can be broken by it. In the
   browser and in the test suites there is no plugin, and events only
   land in _log (newest last, capped) so a test can assert on them.

   Firebase's limits, enforced here rather than trusted to callers:
   event and param names are [a-zA-Z0-9_], at most 40 chars; string
   values at most 100 chars; at most 25 params per event. Booleans are
   sent as 0/1 — the native side would stringify them otherwise and a
   "true"/"false" dimension cannot be summed.
   ===================================================================== */
(function (global) {
  'use strict';

  var MAX_LOG = 200;

  function plugin() {
    try {
      var C = global.Capacitor;
      if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
      return (C.Plugins && C.Plugins.FirebaseAnalytics) || null;
    } catch (e) { return null; }
  }

  function clean(params) {
    var out = {}, n = 0;
    if (!params) return out;
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || n >= 25) return;
      if (typeof v === 'boolean') v = v ? 1 : 0;
      else if (typeof v === 'number') { if (!isFinite(v)) return; }
      else v = String(v).slice(0, 100);
      out[String(k).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40)] = v;
      n++;
    });
    return out;
  }

  var Analytics = {
    _log: [],

    log: function (name, params) {
      try {
        var ev = { name: String(name).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40),
                   params: clean(params) };
        this._log.push(ev);
        if (this._log.length > MAX_LOG) this._log.shift();
        var P = plugin();
        if (!P || !P.logEvent) return;
        var r = P.logEvent(ev);
        if (r && r.catch) r.catch(function (e) {
          console.warn('[analytics] ' + ev.name + ':', e && (e.message || e));
        });
      } catch (e) {
        console.warn('[analytics] log threw:', e && (e.message || e));
      }
    },

    /* Test helper: every logged event with this name. */
    _named: function (name) {
      return this._log.filter(function (e) { return e.name === name; });
    }
  };

  global.FTAnalytics = Analytics;
})(window);
