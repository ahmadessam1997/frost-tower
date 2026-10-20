/* =====================================================================
   Frost Tower — daily mission, streak and the come-back reminder
   ---------------------------------------------------------------------
   One mission per calendar day (device local time), the same for every
   player, drawn from FTConfig.missions.list. A finished mission has to
   be CLAIMED; claiming on consecutive days builds a streak that adds a
   bonus to the reward.

   State is one object in the save file (FTSave.data.daily):
       day       local day number the mission belongs to
       id        mission id, so a config change cannot re-target progress
       progress  best-so-far (or count, for 'runs')
       done      goal reached
       claimed   reward paid
       streak    consecutive claimed days, as of lastClaim
       lastClaim day number of the last claim (-1 = never)
       asked     the notification permission question has been put

   The reminder is a single local notification, re-armed after every run
   for `reminderHours` after it, so it only ever fires for a player who
   has stayed away. Two rules, both deliberate:
     - the Android 13 permission dialog is raised from a CLAIM tap and
       from nowhere else. A dialog at launch is refused on reflex and can
       only be asked twice, ever;
     - nothing is scheduled until that first claim, on any Android
       version, so a reminder never arrives from a feature the player
       has not touched.

   Like ads.js, every native entry point resolves rather than rejects.
   In the browser there is no plugin and the reminder half no-ops.
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.FTConfig, Save = global.FTSave;
  var DAY_MS = 86400000;

  function track(name, params) {
    if (global.FTAnalytics) global.FTAnalytics.log(name, params);
  }

  /* Local calendar day as an integer. Built from the LOCAL y/m/d through
     Date.UTC so that consecutive calendar days are always exactly 1
     apart — dividing a local timestamp by 24h drifts across DST. */
  function dayNumber(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  }

  /* mulberry32 — a tiny seeded PRNG, enough to shuffle eight missions. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(n, cycle) {
    var order = [], i, j, tmp, r = rng(cycle * 2654435761 + 97);
    for (i = 0; i < n; i++) order.push(i);
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1));
      tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    return order;
  }

  /* Index into the mission list for a day. The list is dealt out in
     seeded-shuffled cycles — every mission once per cycle — so the order
     looks random but nothing can come up two days running: inside a
     cycle by construction, and across the seam by swapping the first
     two of a cycle whenever it would open with the previous one's last. */
  function indexFor(day, n) {
    if (n <= 1) return 0;
    var cycle = Math.floor(day / n), pos = ((day % n) + n) % n;
    var order = shuffled(n, cycle);
    if (n > 2) {
      var prev = shuffled(n, cycle - 1);
      if (order[0] === prev[n - 1]) { var t = order[0]; order[0] = order[1]; order[1] = t; }
    }
    return order[pos];
  }

  var Missions = {
    /* Tests replace this to move the calendar. */
    _now: function () { return new Date(); },

    dayNumber: dayNumber,
    today: function () { return dayNumber(this._now()); },

    missionFor: function (day) {
      var list = (Cfg.missions && Cfg.missions.list) || [];
      return list.length ? list[indexFor(day, list.length)] : null;
    },

    _def: function (id) {
      var list = (Cfg.missions && Cfg.missions.list) || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },

    /* Bonus on top of the base reward for a streak of `streak` days. */
    bonusFor: function (streak) {
      var per = Cfg.missions.streakBonusPerDay || 0, cap = Cfg.missions.streakBonusCap || 0;
      return Math.max(0, Math.min(cap, (streak - 1) * per));
    },

    /* What the streak becomes if a claim lands on `day`. */
    _nextStreak: function (d, day) {
      return (d.lastClaim === day - 1) ? (d.streak | 0) + 1 : 1;
    },

    /* Rolls the saved state over to today's mission. Returns
       {carried: n} when yesterday's finished-but-unclaimed mission was
       paid out on the way — losing a reward to midnight because the
       claim button was one tap away would be a poor way to end a day. */
    sync: function () {
      var day = this.today(), d = Save.data.daily, out = { carried: 0 };
      if (d && d.day === day && this._def(d.id)) return out;

      if (d && d.done && !d.claimed && this._def(d.id)) {
        out.carried = this._pay(d, d.day);
      }
      var m = this.missionFor(day);
      Save.data.daily = {
        day: day,
        id: m ? m.id : '',
        progress: 0,
        done: false,
        claimed: false,
        streak: d ? (d.streak | 0) : 0,
        lastClaim: (d && typeof d.lastClaim === 'number') ? d.lastClaim : -1,
        asked: !!(d && d.asked)
      };
      Save.save();
      return out;
    },

    /* Credits the reward for the mission in `d` as claimed on `day`. */
    _pay: function (d, day) {
      var def = this._def(d.id);
      if (!def) return 0;
      var streak = this._nextStreak(d, day);
      var total = def.reward + this.bonusFor(streak);
      d.streak = streak;
      d.lastClaim = day;
      d.claimed = true;
      Save.data.coins += total;
      track('mission_done', { mission: def.id, reward: total });
      track('streak_day', { streak: streak });
      return total;
    },

    /* Everything the UI needs, already rolled over to today. */
    view: function () {
      this.sync();
      var d = Save.data.daily, def = this._def(d.id);
      if (!def) return null;
      var day = this.today();
      var live = (d.lastClaim === day || d.lastClaim === day - 1) ? (d.streak | 0) : 0;
      var next = d.claimed ? d.streak : this._nextStreak(d, day);
      return {
        id: def.id,
        text: def.text,
        goal: def.goal,
        progress: Math.min(def.goal, d.progress | 0),
        done: !!d.done,
        claimed: !!d.claimed,
        streak: live,                       // what the player holds right now
        reward: def.reward,
        bonus: this.bonusFor(next),         // what claiming today adds
        total: def.reward + this.bonusFor(next)
      };
    },

    /* One finished run. run = {floor, coins, score, combo, counts}; counts
       is false for the second death of a revived run, which must not be
       a second "run played". Returns true when this run completed it. */
    noteRun: function (run) {
      this.sync();
      var d = Save.data.daily, def = this._def(d.id);
      if (!def || d.done) return false;
      var v;
      if (def.type === 'runs') v = (d.progress | 0) + (run.counts === false ? 0 : 1);
      else v = Math.max(d.progress | 0, Number(run[def.type]) || 0);
      d.progress = v;
      if (v >= def.goal) d.done = true;
      Save.save();
      return d.done;
    },

    /* Pays out today's finished mission. {ok, total, streak} */
    claim: function () {
      this.sync();
      var d = Save.data.daily;
      if (!d.done || d.claimed) return { ok: false };
      var total = this._pay(d, this.today());
      Save.save();
      return { ok: true, total: total, streak: d.streak };
    },

    /* ----------------------------------------------------------------
       Reminder
       ---------------------------------------------------------------- */
    _plugin: function () {
      try {
        if (!Cfg.isNative()) return null;
        return global.Capacitor.Plugins.LocalNotifications || null;
      } catch (e) { return null; }
    },

    /* Called from the claim tap, and only from there. Asks at most once;
       a refusal is final as far as this game is concerned. */
    askPermissionOnce: function () {
      var self = this, P = self._plugin(), d = Save.data.daily;
      if (!P || !d) return Promise.resolve(false);
      if (d.asked) return self.armReminder();
      d.asked = true;
      Save.save();
      return P.checkPermissions()
        .then(function (r) {
          if (r && r.display === 'granted') return r;
          return P.requestPermissions();
        })
        .then(function () { return self.armReminder(); })
        .catch(function (e) {
          console.warn('[missions] permission:', e && (e.message || e));
          return false;
        });
    },

    /* (Re)schedules the one reminder for reminderHours from now. Silent
       no-op until the player has claimed once, and whenever the
       permission is not granted — this never raises a dialog. */
    armReminder: function () {
      var self = this, P = self._plugin(), d = Save.data.daily;
      if (!P || !d || !d.asked) return Promise.resolve(false);
      var id = Cfg.missions.reminderId;
      var at = new Date(self._now().getTime() + (Cfg.missions.reminderHours || 24) * 3600000);
      var v = self.view();
      var body = (v && v.streak > 0)
        ? 'A new daily mission is waiting. Keep your ' + v.streak + '-day streak alive!'
        : 'A new daily mission is waiting. The frost is rising.';
      return P.checkPermissions()
        .then(function (r) {
          if (!r || r.display !== 'granted') return false;
          return P.cancel({ notifications: [{ id: id }] })
            .catch(function () {})
            .then(function () {
              return P.schedule({ notifications: [{
                id: id,
                title: 'Frost Tower',
                body: body,
                schedule: { at: at, allowWhileIdle: false },
                /* The plugin defaults this to TRUE, and on Android 12+ an
                   exact alarm without the special permission makes
                   schedule() open the system "Alarms & reminders" settings
                   page. A come-back nudge does not need to be on the
                   second, so it is inexact and that permission is
                   stripped from the manifest. */
                isExactNotification: false
              }] });
            })
            .then(function () { return true; });
        })
        .catch(function (e) {
          console.warn('[missions] reminder:', e && (e.message || e));
          return false;
        });
    }
  };

  global.FTMissions = Missions;
})(window);
