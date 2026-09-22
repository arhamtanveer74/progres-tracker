/* ============================================================
   GrowthOS — script.js  ·  Phase 3: JavaScript foundation
   ------------------------------------------------------------
   - Central Store (state + subscribe) that drives every view
   - Data-driven rendering (ring, score, goals, streaks, charts...)
   - Score engine (today's % computed from your goals)
   - View routing, mobile sidebar, light/dark theme
   - Goal create / edit / update / delete via a modal
   NOTE: persistence (LocalStorage) lands in Phase 4 — for now the
   app runs from an in-memory seed and resets on refresh.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Small helpers ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const pct = (cur, tgt) =>
    tgt > 0 ? clamp(Math.round((cur / tgt) * 100), 0, 100) : 0;
  const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const initials = (name) =>
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  /* Persistence helpers */
  const STORAGE_KEY = "growthos.v1";
  const dateKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  function deepMerge(base, over) {
    if (!isObj(over)) return over === undefined ? base : over;
    const out = isObj(base) ? { ...base } : {};
    for (const k in over)
      out[k] =
        isObj(base?.[k]) && isObj(over[k])
          ? deepMerge(base[k], over[k])
          : over[k];
    return out;
  }
  function downloadFile(name, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* Gradients used for goal accent bars, keyed by colour name */
  const GRAD = {
    blue: "linear-gradient(135deg,#4f79ff,#33d9f2)",
    purple: "linear-gradient(135deg,#6a5bff,#a35bff)",
    cyan: "linear-gradient(135deg,#33d9f2,#4f79ff)",
    green: "linear-gradient(135deg,#37d39b,#2bd0c0)",
    amber: "linear-gradient(135deg,#f2a24b,#ff7a59)",
    pink: "linear-gradient(135deg,#f2597f,#a35bff)",
  };
  const AREA_COLOR = {
    health: "var(--green)",
    career: "var(--purple)",
    learning: "var(--cyan)",
    spirituality: "var(--amber)",
    finance: "var(--yellow)",
    relationships: "var(--pink)",
  };
  const CATEGORIES = [
    "Health",
    "Career",
    "Learning",
    "Finance",
    "Spirituality",
    "Relationships",
    "Discipline",
  ];
  const GOAL_TYPES = [
    { value: "checkbox", label: "Checkbox (done / not done)" },
    { value: "minutes", label: "Minutes" },
    { value: "count", label: "Count" },
    { value: "water", label: "Water (ml)" },
    { value: "percentage", label: "Percentage" },
    { value: "number", label: "Custom number" },
  ];
  const EMOJI_QUICK = [
    "🥤",
    "💧",
    "💻",
    "💼",
    "📖",
    "🏋️",
    "🏃",
    "🧘",
    "📚",
    "💡",
    "🎯",
    "🌅",
    "🙏",
    "✍️",
    "🎨",
    "💰",
  ];

  /* ---------- Default seed state ---------- */
  /* Starter demo data. The score, ring and comparison are all
     computed from these goals, so editing any goal updates them live. */
  const DEFAULT_STATE = {
    user: {
      name: "Arham Tanveer",
      level: 12,
      title: "Warrior",
      xp: 820,
      xpMax: 1200,
    },
    settings: { theme: "dark", accent: "aurora", animations: true },
    achievements: [],
    history: {},
    completions: {},   // { "YYYY-MM-DD": [goalId, ...] } — drives real streaks
    journal: {},       // { "YYYY-MM-DD": "text" }
    lastSeenDate: null,
    goals: [
      {
        id: "g1",
        emoji: "🥤",
        title: "Morning Shake",
        subtitle: "Drink your protein shake",
        type: "checkbox",
        unit: "",
        target: 1,
        current: 1,
        points: 10,
        category: "Health",
        color: "cyan",
      },
      {
        id: "g2",
        emoji: "💧",
        title: "Drink Water",
        subtitle: "Stay hydrated",
        type: "water",
        unit: "ml",
        target: 3000,
        current: 2400,
        points: 10,
        category: "Health",
        color: "blue",
      },
      {
        id: "g3",
        emoji: "💻",
        title: "Learn JavaScript",
        subtitle: "Coding practice",
        type: "minutes",
        unit: "min",
        target: 120,
        current: 105,
        points: 20,
        category: "Learning",
        color: "purple",
      },
      {
        id: "g4",
        emoji: "💼",
        title: "Apply to Jobs",
        subtitle: "Apply to at least 10 jobs",
        type: "count",
        unit: "",
        target: 10,
        current: 6,
        points: 15,
        category: "Career",
        color: "amber",
      },
      {
        id: "g5",
        emoji: "📖",
        title: "Study Islamiat",
        subtitle: "Study for knowledge",
        type: "minutes",
        unit: "min",
        target: 15,
        current: 13,
        points: 15,
        category: "Spirituality",
        color: "green",
      },
      {
        id: "g6",
        emoji: "🏋️",
        title: "Workout",
        subtitle: "45 minutes workout",
        type: "minutes",
        unit: "min",
        target: 45,
        current: 31,
        points: 30,
        category: "Health",
        color: "pink",
      },
    ],
    streaks: [
      { emoji: "🥤", name: "Morning Shake", count: 12 },
      { emoji: "💻", name: "Coding", count: 18 },
      { emoji: "🏋️", name: "Workout", count: 11 },
      { emoji: "📖", name: "Read Quran", count: 16 },
      { emoji: "💼", name: "Job Applications", count: 4 },
    ],
    weekly: [
      { day: "Mon", value: 72 },
      { day: "Tue", value: 58 },
      { day: "Wed", value: 41 },
      { day: "Thu", value: 60 },
      { day: "Fri", value: 83 },
      { day: "Sat", value: 90 },
      { day: "Sun", value: 68 },
    ],
    lifeAreas: [
      { key: "health", label: "Health", value: 75 },
      { key: "career", label: "Career", value: 65 },
      { key: "learning", label: "Learning", value: 80 },
      { key: "spirituality", label: "Spirituality", value: 70 },
      { key: "finance", label: "Finance", value: 60 },
      { key: "relationships", label: "Relationships", value: 50 },
    ],
    quote: "Discipline today. Freedom tomorrow.",
  };

  /* Pre-fill ~90 days of history so charts look alive from day one.
     Today's entry is overwritten with your real score on every save. */
  function seedHistory() {
    const h = {};
    const bias = { 0: 68, 1: 66, 2: 70, 3: 52, 4: 64, 5: 82, 6: 86 }; // Sun..Sat (Fri/Sat strong, Wed weak)
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const noise = Math.round((Math.sin(i * 1.7) + Math.cos(i * 0.6)) * 9);
      h[dateKey(d)] = clamp(bias[d.getDay()] + noise, 8, 100);
    }
    return h;
  }
  DEFAULT_STATE.history = seedHistory();

  /* Week helpers — Monday-based, offset 0 = this week, -1 = last week */
  const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function weekDates(offsetWeeks = 0) {
    const now = new Date();
    const mondayIdx = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayIdx + offsetWeeks * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }
  function weeklyData(offsetWeeks = 0) {
    const today = dateKey();
    return weekDates(offsetWeeks).map((d, i) => {
      const key = dateKey(d);
      return {
        day: WD[i],
        date: key,
        value: Store.state.history[key] ?? 0,
        future: key > today,
      };
    });
  }
  function weekdayAverages() {
    const sums = Array(7).fill(0),
      cnt = Array(7).fill(0);
    for (const [k, v] of Object.entries(Store.state.history)) {
      const d = new Date(k + "T00:00:00");
      const wd = (d.getDay() + 6) % 7;
      sums[wd] += v;
      cnt[wd]++;
    }
    return WD.map((label, i) => ({
      label,
      avg: cnt[i] ? Math.round(sums[i] / cnt[i]) : 0,
    }));
  }
  function lastNDays(n) {
    const out = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push({
        date: dateKey(d),
        value: Store.state.history[dateKey(d)] ?? 0,
      });
    }
    return out;
  }

  /* ---------- Store (single source of truth) ---------- */
  const Store = {
    state: structuredClone(DEFAULT_STATE),
    listeners: [],
    subscribe(fn) {
      this.listeners.push(fn);
    },
    emit({ recordToday = true } = {}) {
      this.save(recordToday);
      this.listeners.forEach((fn) => fn(this.state));
    },
    /* mutations */
    addGoal(goal) {
      this.state.goals.push({ ...goal, id: "g" + Date.now() });
      this.emit();
    },
    updateGoal(id, patch) {
      const g = this.state.goals.find((x) => x.id === id);
      if (g) Object.assign(g, patch);
      this.emit();
    },
    removeGoal(id) {
      this.state.goals = this.state.goals.filter((x) => x.id !== id);
      this.emit();
    },
    toggleGoal(id) {
      const g = this.state.goals.find((x) => x.id === id);
      if (!g) return;
      const done = g.current >= g.target;
      g.current = done ? 0 : g.target;
      this.emit();
    },
    setTheme(theme) {
      this.state.settings.theme = theme;
      this.emit();
    },
    setAccent(accent) {
      this.state.settings.accent = accent;
      this.emit();
    },
    setAnimations(on) {
      this.state.settings.animations = on;
      this.emit();
    },
    setUserName(name) {
      this.state.user.name = name;
      this.emit();
    },
    ensureDailyReset() {
      const today = dateKey();
      const lastSeen = this.state.lastSeenDate;

      if (!lastSeen) {
        this.state.lastSeenDate = today;
        return false;
      }

      if (lastSeen === today) return false;

      this.state.goals = this.state.goals.map((goal) => ({
        ...goal,
        current: 0,
      }));
      this.state.lastSeenDate = today;
      this.state.history[today] = 0;
      return true;
    },
    /* persistence */
    save(recordToday = true) {
      if (recordToday) {
        const k = dateKey();
        this.state.history[k] = todayScore(); // record today's score for charts/heatmap
        this.state.completions[k] = this.state.goals
          .filter((g) => pct(g.current, g.target) >= 100)
          .map((g) => g.id);              // record which goals were completed (for streaks)
      }
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ v: 1, state: this.state }),
        );
      } catch (e) {
        /* storage full / disabled */
      }
    },
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.state) {
          this.state = deepMerge(structuredClone(DEFAULT_STATE), parsed.state);
          if (parsed.state.history) this.state.history = parsed.state.history; // real history replaces seed
        }
      } catch (e) {
        /* corrupt data — keep defaults */
      }
    },
    replaceState(obj) {
      this.state = deepMerge(structuredClone(DEFAULT_STATE), obj);
      if (obj && obj.history) this.state.history = obj.history; // incoming history is authoritative
      this.emit();
    },
    reset() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      this.state = structuredClone(DEFAULT_STATE);
      this.emit();
    },
    startFresh() {
      const s = this.state;
      const areas =
        s.lifeAreas && s.lifeAreas.length
          ? s.lifeAreas
          : DEFAULT_STATE.lifeAreas;
      this.state = {
        user: {
          name: s.user.name,
          level: 1,
          xp: 0,
          xpMax: 1000,
          title: "Beginner",
        },
        settings: { ...s.settings },
        achievements: [],
        history: {},
        completions: {},
        journal: {},
        lastSeenDate: dateKey(),
        yesterdayScore: null,
        goals: [],
        streaks: [],
        weekly: [],
        lifeAreas: areas.map((a) => ({ ...a, value: 0 })),
        quote: s.quote || DEFAULT_STATE.quote,
      };
      this.emit({ recordToday: false });
      if (
        window.GrowthOS &&
        typeof window.GrowthOS.clearCloudData === "function"
      ) {
        window.GrowthOS.clearCloudData();
      }
    },
  };

  /* ---------- Derived values ---------- */
  function todayScore() {
    const goals = Store.state.goals;
    const totalPoints = goals.reduce((s, g) => s + (g.points || 0), 0);
    if (!totalPoints) return 0;
    const earned = goals.reduce(
      (s, g) => s + (g.points || 0) * (pct(g.current, g.target) / 100),
      0,
    );
    return Math.round((earned / totalPoints) * 100);
  }

  /* ---------- Derived: yesterday, streaks, XP, life areas ----------
     These are all COMPUTED from history/completions so they stay
     truthful over time instead of holding stale numbers. */

  const shiftDate = (d, days) => { const x = new Date(d); x.setDate(x.getDate() + days); return x; };

  /* Yesterday's score comes from the history log (null when untracked) */
  function yesterdayScore() {
    const k = dateKey(shiftDate(new Date(), -1));
    const v = Store.state.history[k];
    return typeof v === "number" ? v : null;
  }

  /* Streak = consecutive days a goal was completed, counting back from
     today (or yesterday, so an unfinished today doesn't break it) */
  function goalStreak(goalId) {
    const comp = Store.state.completions || {};
    const today = new Date();
    let cursor = (comp[dateKey(today)] || []).includes(goalId) ? today : shiftDate(today, -1);
    let count = 0;
    for (let i = 0; i < 800; i++) {
      const list = comp[dateKey(cursor)];
      if (!list || !list.includes(goalId)) break;
      count++;
      cursor = shiftDate(cursor, -1);
    }
    return count;
  }
  function computeStreaks() {
    return Store.state.goals
      .map((g) => ({ emoji: g.emoji || "🎯", name: g.title, count: goalStreak(g.id) }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /* XP grows with every tracked day's score; level every 1000 XP */
  const LEVEL_TITLES = ["Beginner", "Starter", "Builder", "Achiever", "Challenger", "Warrior", "Champion", "Master", "Legend"];
  function computeProgression() {
    const xpTotal = Object.values(Store.state.history).reduce((a, b) => a + (b || 0), 0);
    const level = Math.floor(xpTotal / 1000) + 1;
    return {
      level,
      title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
      xp: xpTotal % 1000,
      xpMax: 1000,
    };
  }

  /* Life areas = average completion of today's goals in each category */
  const AREA_KEYS = { health: "Health", career: "Career", learning: "Learning", spirituality: "Spirituality", finance: "Finance", relationships: "Relationships" };
  function computeLifeAreas() {
    return Object.entries(AREA_KEYS).map(([key, label]) => {
      const inArea = Store.state.goals.filter((g) => (g.category || "") === label);
      const value = inArea.length
        ? Math.round(inArea.reduce((s, g) => s + pct(g.current, g.target), 0) / inArea.length)
        : 0;
      return { key, label, value };
    });
  }

  /* ---------- Render: sidebar user + quote ---------- */
  function renderUser(s) {
    $(".greeting__title").innerHTML =
      `Good ${greetingWord()}, ${escapeHtml(s.user.name)} <span aria-hidden="true">👋</span>`;
    $(".avatar__initials").textContent = initials(s.user.name);
    const prog = computeProgression();
    $(".level-card__level").textContent = "Level " + prog.level;
    $(".level-card__title").textContent = prog.title;
    $(".level-card__xp-value").textContent =
      `${prog.xp} / ${prog.xpMax} XP`;
    const xpFill = $(".progress--xp .progress__fill");
    xpFill.style.setProperty("--_p", pct(prog.xp, prog.xpMax));
    $(".quote-card__text").innerHTML =
      `"${escapeHtml(s.quote)}" <span aria-hidden="true">⚡</span>`;
    document.title = `GrowthOS · ${s.user.name}`;
  }
  function greetingWord() {
    const h = new Date().getHours();
    return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  }

  /* ---------- Render: progress ring + score ---------- */
  function renderRing(score, { animate = false } = {}) {
    const ringVal = $(".ring__value");
    const percentEl = $(".ring__percent");
    const scoreEl = $(".card__foot strong");
    ringVal.style.setProperty("--_p", score);
    ringVal.parentElement.setAttribute(
      "aria-label",
      `Today's completion ${score} percent`,
    );
    $(".ring__caption").textContent = captionFor(score);
    if (animate && !reduceMotion()) {
      animateCount(percentEl, score, { suffix: "%" });
      animateCount(scoreEl, score, {});
    } else {
      percentEl.textContent = score + "%";
      scoreEl.textContent = score;
    }
  }
  function captionFor(score) {
    if (score >= 90) return "Outstanding! 🌟";
    if (score >= 70) return "Great job! 🚀";
    if (score >= 45) return "Keep pushing 💪";
    return "A fresh start 🌱";
  }

  /* ---------- Render: today vs yesterday ---------- */
  function renderCompare(score, s) {
    const card = $(".card--compare");
    const values = $$(".compare__value", card);
    const arrow = $(".compare__arrow", card);
    const deltaEl = $(".compare__delta", card);
    const yScore = yesterdayScore();
    const hasYest = typeof yScore === "number";
    values[0].textContent = hasYest ? yScore + "%" : "—";
    values[1].textContent = score + "%";
    if (!hasYest) {
      arrow.setAttribute("data-trend", "up");
      arrow.style.transform = "";
      arrow.style.color = "var(--txt-dim)";
      deltaEl.style.color = "var(--txt-dim)";
      deltaEl.textContent = "No data yet";
      $(".compare__message", card).textContent =
        "Your first day — let's build some momentum.";
      return;
    }
    const delta = score - yScore;
    const up = delta >= 0;
    arrow.setAttribute("data-trend", up ? "up" : "down");
    arrow.style.transform = up ? "" : "rotate(90deg)";
    arrow.style.color = up ? "var(--green)" : "var(--amber)";
    deltaEl.style.color = up ? "var(--green)" : "var(--amber)";
    deltaEl.innerHTML = up
      ? `<span aria-hidden="true">↑</span> ${delta}% Improvement`
      : `<span aria-hidden="true">◎</span> ${Math.abs(delta)}% to beat yesterday`;
    $(".compare__message", card).textContent = up
      ? "You're doing better than yesterday!"
      : `Yesterday you hit ${yScore}% — today is yours to claim.`;
  }

  /* ---------- Render: streaks ---------- */
  function renderStreaks(s) {
    const list = $(".streak-list");
    const streaks = computeStreaks();
    s.streaks = streaks;                 // keep state in sync for achievements/export
    if (!streaks.length) {
      list.innerHTML = `<li class="list-empty">No streaks yet — complete a goal today and it starts counting.</li>`;
      return;
    }
    list.innerHTML = streaks
      .slice(0, 6)
      .map(
        (st) => `
      <li class="streak">
        <span class="streak__icon" aria-hidden="true">${st.emoji}</span>
        <span class="streak__name">${escapeHtml(st.name)}</span>
        <span class="streak__count">${st.count} ${st.count === 1 ? "day" : "days"} <span aria-hidden="true">🔥</span></span>
      </li>`,
      )
      .join("");
  }

  /* ---------- Render: goals ---------- */
  function renderGoals(s) {
    const list = $(".goal-list");
    if (!s.goals.length) {
      list.innerHTML = `<li class="list-empty list-empty--goals">No goals yet.<br>Tap <strong>＋ Add Goal</strong> to add your first one and start tracking your day.</li>`;
      return;
    }
    list.innerHTML = s.goals.map(goalMarkup).join("");
    /* apply per-goal accent colour + progress fill */
    s.goals.forEach((g) => {
      const li = list.querySelector(`[data-id="${g.id}"]`);
      if (!li) return;
      const fill = li.querySelector(".progress__fill");
      if (fill) {
        fill.style.setProperty("--_p", pct(g.current, g.target));
        if (GRAD[g.color]) fill.style.background = GRAD[g.color];
      }
    });
  }
  function goalMarkup(g) {
    const p = pct(g.current, g.target);
    const done = p >= 100;
    const isCheckbox = g.type === "checkbox";
    const unit = g.unit ? " " + g.unit : "";
    const meter = isCheckbox
      ? `<div class="goal__meter"><span class="goal__status ${done ? "goal__status--done" : ""}">${done ? "Completed" : "Pending"}</span></div>`
      : `<div class="goal__meter">
           <span class="goal__amount">${g.current} / ${g.target}${unit}</span>
           <div class="progress" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
             <span class="progress__fill"></span>
           </div>
         </div>`;
    const percentCell = isCheckbox
      ? `<span class="goal__percent"></span>`
      : `<span class="goal__percent">${p}%</span>`;
    return `
      <li class="goal ${done ? "is-complete" : ""}" data-goal-type="${g.type}" data-id="${g.id}">
        <span class="goal__icon" aria-hidden="true">${g.emoji || "🎯"}</span>
        <div class="goal__info">
          <p class="goal__title">${escapeHtml(g.title)}</p>
          <p class="goal__subtitle">${escapeHtml(g.subtitle || g.category || "")}</p>
        </div>
        ${meter}
        ${percentCell}
        <button class="goal__check ${done ? "is-checked" : ""}" type="button"
                data-check="${g.id}" aria-label="Toggle ${escapeHtml(g.title)}"></button>
      </li>`;
  }

  /* ---------- Render: weekly chart ---------- */
  let weeklyOffset = 0; // 0 = this week, -1 = last week
  function renderWeekly() {
    const bars = $(".bars");
    const data = weeklyData(weeklyOffset);
    bars.innerHTML = data
      .map(
        (d) => `
      <li class="bar ${d.future ? "is-future" : ""}"><span class="bar__fill"></span><span class="bar__label">${d.day}</span></li>`,
      )
      .join("");
    data.forEach((d, i) => {
      const fill = bars.children[i].querySelector(".bar__fill");
      fill.style.transitionDelay = i * 55 + "ms";
      fill.style.setProperty("--_p", clamp(d.value, 0, 100));
    });
    const tracked = data.filter((d) => !d.future).map((d) => d.value);
    const avg = tracked.length
      ? Math.round(tracked.reduce((a, b) => a + b, 0) / tracked.length)
      : 0;
    const stats = $$(".card--weekly .stat-row__value");
    if (stats.length === 3) {
      stats[0].textContent = avg + "%";
      stats[1].textContent = (tracked.length ? Math.max(...tracked) : 0) + "%";
      stats[2].textContent = (tracked.length ? Math.min(...tracked) : 0) + "%";
    }
  }

  /* ---------- Render: life areas ---------- */
  function renderLife(s) {
    const grid = $(".life-grid");
    s.lifeAreas = computeLifeAreas();   // derived from goal categories
    grid.innerHTML = s.lifeAreas
      .map(
        (a) => `
      <li class="life">
        <div class="mini-ring" data-area="${a.key}"><span class="mini-ring__value">${a.value}%</span></div>
        <span class="life__label">${escapeHtml(a.label)}</span>
      </li>`,
      )
      .join("");
    s.lifeAreas.forEach((a) => {
      const ring = grid.querySelector(`[data-area="${a.key}"]`);
      ring.style.setProperty("--_p", clamp(a.value, 0, 100));
      ring.style.setProperty("--ring-c", AREA_COLOR[a.key] || "var(--blue)");
    });
  }

  /* ---------- Render: AI insight (basic rule-based) ---------- */
  function renderInsight(score, s) {
    if (!s.goals.length) {
      $(".insight__lead").innerHTML =
        `Add your first goal to start tracking your day <span aria-hidden="true">🌱</span>`;
      $(".insight__list").innerHTML = [
        "Your score, weekly chart, and heatmap fill in automatically as you go",
        "Come back daily to build streaks and unlock achievements",
      ]
        .map((b) => `<li>${b}</li>`)
        .join("");
      return;
    }
    const yScore2 = yesterdayScore();
    const hasYest = typeof yScore2 === "number";
    const delta = hasYest ? score - yScore2 : 0;
    const lead = !hasYest
      ? `You're off the mark — every goal you complete lifts today's score <span aria-hidden="true">🚀</span>`
      : delta >= 0
        ? `You improved your score by ${delta}% compared to yesterday <span aria-hidden="true">👏</span>`
        : `You're ${Math.abs(delta)}% behind yesterday — small steps add up <span aria-hidden="true">🌱</span>`;
    $(".insight__lead").innerHTML = lead;

    const bullets = [];
    const topStreak = computeStreaks()[0];
    if (topStreak)
      bullets.push(
        `${escapeHtml(topStreak.name)} streak is on fire — ${topStreak.count} days <span aria-hidden="true">🔥</span>`,
      );
    const scored = s.goals.map((g) => ({ g, p: pct(g.current, g.target) }));
    const lowest = scored.sort((a, b) => a.p - b.p)[0];
    if (lowest && lowest.p < 100)
      bullets.push(
        `${escapeHtml(lowest.g.title)} needs attention — ${lowest.p}% done`,
      );
    const doneCount = scored.filter((x) => x.p >= 100).length;
    bullets.push(
      `${doneCount} of ${s.goals.length} goals fully complete today`,
    );

    $(".insight__list").innerHTML = bullets
      .map((b) => `<li>${b}</li>`)
      .join("");
  }

  /* ---------- Analytics view ---------- */
  function computeAnalytics() {
    const last30 = lastNDays(30).map((d) => d.value);
    const tracked30 = last30.filter((v) => v > 0);
    const avg30 = tracked30.length
      ? Math.round(tracked30.reduce((a, b) => a + b, 0) / tracked30.length)
      : 0;
    const entries = Object.entries(Store.state.history);
    let best = { date: "—", value: 0 };
    entries.forEach(([k, v]) => {
      if (v > best.value) best = { date: k, value: v };
    });
    const thisW = weeklyData(0)
      .filter((d) => !d.future)
      .map((d) => d.value);
    const lastW = weeklyData(-1).map((d) => d.value);
    const wa = (arr) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return {
      avg30,
      best,
      daysTracked: entries.length,
      longestStreak: Math.max(0, ...Store.state.streaks.map((s) => s.count)),
      thisWeekAvg: wa(thisW),
      lastWeekAvg: wa(lastW),
    };
  }

  function buildAreaChart(values, { w = 720, h = 240, pad = 26 } = {}) {
    const n = values.length;
    const max = Math.max(100, ...values);
    const X = (i) => pad + (i / (n - 1)) * (w - 2 * pad);
    const Y = (v) => h - pad - (v / max) * (h - 2 * pad);
    const line = values
      .map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`)
      .join(" ");
    const area = `${line} L ${X(n - 1).toFixed(1)} ${h - pad} L ${X(0).toFixed(1)} ${h - pad} Z`;
    const grid = [0, 25, 50, 75, 100]
      .map(
        (g) =>
          `<line x1="${pad}" y1="${Y(g).toFixed(1)}" x2="${w - pad}" y2="${Y(g).toFixed(1)}" class="linechart__grid"/>`,
      )
      .join("");
    return `
      <svg class="linechart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="30 day score trend">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="var(--blue)"/><stop offset="0.5" stop-color="var(--cyan)"/><stop offset="1" stop-color="var(--purple)"/>
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--blue)" stop-opacity="0.30"/><stop offset="1" stop-color="var(--blue)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}
        <path class="linechart__area" d="${area}" fill="url(#areaGrad)"/>
        <path class="linechart__line" d="${line}" fill="none" stroke="url(#lineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  }

  function renderAnalytics() {
    const view = $("#view-analytics");
    const a = computeAnalytics();
    const wDelta = a.thisWeekAvg - a.lastWeekAvg;
    const wUp = wDelta >= 0;
    const wds = weekdayAverages();
    const strongest = [...wds].sort((x, y) => y.avg - x.avg)[0];
    const weakest = [...wds]
      .filter((d) => d.avg > 0)
      .sort((x, y) => x.avg - y.avg)[0];
    const maxWd = Math.max(1, ...wds.map((d) => d.avg));

    view.innerHTML = `
      <div class="analytics">
        <div class="stat-cards">
          <div class="card stat-card"><span class="stat-card__label">30-Day Average</span><span class="stat-card__value"><span class="js-count" data-to="${a.avg30}" data-suffix="%">0</span></span></div>
          <div class="card stat-card"><span class="stat-card__label">Best Day</span><span class="stat-card__value"><span class="js-count" data-to="${a.best.value}" data-suffix="%">0</span></span><span class="stat-card__sub">${a.best.date}</span></div>
          <div class="card stat-card"><span class="stat-card__label">Longest Streak</span><span class="stat-card__value"><span class="js-count" data-to="${a.longestStreak}">0</span><span class="stat-card__unit"> days</span></span></div>
          <div class="card stat-card"><span class="stat-card__label">Days Tracked</span><span class="stat-card__value"><span class="js-count" data-to="${a.daysTracked}">0</span></span></div>
        </div>

        <section class="card analytics__trend">
          <div class="card__head"><h2 class="card__title">30-Day Trend</h2>
            <span class="pill ${wUp ? "pill--up" : "pill--down"}">${wUp ? "↑" : "↓"} ${Math.abs(wDelta)}% vs last week</span>
          </div>
          <div class="linechart-wrap">${buildAreaChart(lastNDays(30).map((d) => d.value))}</div>
        </section>

        <section class="card analytics__weekday">
          <div class="card__head"><h2 class="card__title">By Weekday</h2></div>
          <ul class="wd-bars">
            ${wds
              .map(
                (d) => `
              <li class="wd-bar">
                <span class="wd-bar__track"><span class="wd-bar__fill" style="height:${Math.round((d.avg / maxWd) * 100)}%"></span></span>
                <span class="wd-bar__val">${d.avg}</span>
                <span class="wd-bar__label">${d.label}</span>
              </li>`,
              )
              .join("")}
          </ul>
          ${strongest && weakest ? `<p class="analytics__note">Your strongest day is <strong>${strongest.label}</strong> (${strongest.avg}% avg); <strong>${weakest.label}</strong> tends to dip (${weakest.avg}%).</p>` : ""}
        </section>
      </div>`;

    /* count up the stat cards */
    view
      .querySelectorAll(".js-count")
      .forEach((el) =>
        animateCount(el, +el.dataset.to, { suffix: el.dataset.suffix || "" }),
      );

    /* animate the trend line drawing in */
    const path = view.querySelector(".linechart__line");
    if (path && !reduceMotion()) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      requestAnimationFrame(() => {
        path.style.transition =
          "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)";
        path.style.strokeDashoffset = "0";
      });
    }
  }

  /* ---------- Activity heatmap ---------- */
  function scoreLevel(score) {
    if (score <= 0) return 0;
    if (score < 40) return 1;
    if (score < 60) return 2;
    if (score < 80) return 3;
    return 4;
  }
  function bandLabel(score) {
    if (score <= 0) return "No data";
    if (score < 40) return "Tough day";
    if (score < 60) return "Getting there";
    if (score < 80) return "Solid day";
    return "Excellent";
  }
  const LEVEL_COLOR = {
    0: "var(--txt-faint)",
    1: "var(--red)",
    2: "var(--amber)",
    3: "var(--green)",
    4: "var(--green)",
  };
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  function renderHeatmap() {
    const el = $(".heatmap");
    if (!el) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mondayIdx = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - mondayIdx - 52 * 7);
    const weeks = 53;

    let cells = "",
      months = "",
      lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const wkDate = new Date(start);
      wkDate.setDate(start.getDate() + w * 7);
      if (wkDate.getMonth() !== lastMonth) {
        months += `<span style="grid-column:${w + 1}">${MONTHS[wkDate.getMonth()]}</span>`;
        lastMonth = wkDate.getMonth();
      }
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        if (date > today) {
          cells += `<i class="heatcell is-empty" aria-hidden="true"></i>`;
          continue;
        }
        const key = dateKey(date);
        const score = Store.state.history[key] ?? 0;
        cells += `<button class="heatcell" type="button" data-date="${key}" data-score="${score}" data-level="${scoreLevel(score)}" aria-label="${key}: ${score}%"></button>`;
      }
    }
    el.innerHTML = `
      <div class="heatmap__side">
        <div class="heatmap__side-sp"></div>
        <div class="heatmap__daylabels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
      </div>
      <div class="heatmap__scroll">
        <div class="heatmap__months">${months}</div>
        <div class="heatmap__grid">${cells}</div>
      </div>`;
  }
  function updateHeatToday() {
    const cell = $(`.heatmap__grid [data-date="${dateKey()}"]`);
    if (cell) {
      const sc = todayScore();
      cell.dataset.score = sc;
      cell.dataset.level = scoreLevel(sc);
    }
  }
  function initHeatmap() {
    $(".heatmap").addEventListener("click", (e) => {
      const cell = e.target.closest(".heatcell[data-date]");
      if (cell) openDay(cell.dataset.date, +cell.dataset.score);
    });
  }

  /* day-detail popup */
  let dayOverlay;
  function buildDayModal() {
    dayOverlay = document.createElement("div");
    dayOverlay.className = "modal-overlay";
    dayOverlay.innerHTML = `
      <div class="modal modal--day" role="dialog" aria-modal="true" aria-labelledby="day-title">
        <div class="modal__head">
          <h2 class="modal__title" id="day-title">Day</h2>
          <button class="modal__close" type="button" data-close aria-label="Close">✕</button>
        </div>
        <div class="day-detail">
          <div class="day-detail__ring" id="day-ring"><span id="day-score">0%</span></div>
          <div class="day-detail__meta">
            <div class="day-detail__band" id="day-band">—</div>
            <div class="day-detail__hint">Daily completion score</div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(dayOverlay);
    dayOverlay.addEventListener("click", (e) => {
      if (e.target === dayOverlay || e.target.closest("[data-close]"))
        dayOverlay.classList.remove("is-open");
    });
  }
  function openDay(dateStr, score) {
    const d = new Date(dateStr + "T00:00:00");
    const lvl = scoreLevel(score);
    $("#day-title").textContent = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    $("#day-score").textContent = score + "%";
    $("#day-band").textContent = bandLabel(score);
    $("#day-band").style.color = LEVEL_COLOR[lvl];
    $("#day-ring").style.background =
      `conic-gradient(from -90deg, ${LEVEL_COLOR[lvl]} ${score}%, var(--track) 0)`;
    dayOverlay.classList.add("is-open");
  }

  /* ---------- Achievements ---------- */
  const A = {
    goals: () => Store.state.goals.length,
    maxStreak: () => Math.max(0, ...Store.state.streaks.map((s) => s.count)),
    streak: (name) =>
      (
        Store.state.streaks.find((s) =>
          s.name.toLowerCase().includes(name),
        ) || { count: 0 }
      ).count,
    daysTracked: () => Object.keys(Store.state.history).length,
    bestScore: () => Math.max(0, ...Object.values(Store.state.history), 0),
    bestRun: (thresh) => {
      const keys = Object.keys(Store.state.history).sort();
      let best = 0,
        cur = 0,
        prev = null;
      for (const k of keys) {
        const d = new Date(k + "T00:00:00");
        const consec = prev && Math.round((d - prev) / 86400000) === 1;
        if (Store.state.history[k] >= thresh) {
          cur = consec ? cur + 1 : 1;
          best = Math.max(best, cur);
        } else {
          cur = 0;
        }
        prev = d;
      }
      return best;
    },
  };
  const ACHIEVEMENTS = [
    {
      id: "first-goal",
      icon: "🎯",
      title: "First Goal",
      desc: "Create your first goal",
      check: () => A.goals() >= 1,
    },
    {
      id: "perfect-day",
      icon: "🌟",
      title: "Perfect Day",
      desc: "Hit 100% in a single day",
      check: () => A.bestScore() >= 100,
    },
    {
      id: "streak-7",
      icon: "🔥",
      title: "7-Day Streak",
      desc: "Keep a streak alive for 7 days",
      check: () => A.maxStreak() >= 7,
      prog: () => A.maxStreak() / 7,
    },
    {
      id: "streak-30",
      icon: "🏆",
      title: "30-Day Streak",
      desc: "Reach 30 days on one streak",
      check: () => A.maxStreak() >= 30,
      prog: () => A.maxStreak() / 30,
    },
    {
      id: "perfect-week",
      icon: "📅",
      title: "Perfect Week",
      desc: "7 days in a row above 80%",
      check: () => A.bestRun(80) >= 7,
      prog: () => A.bestRun(80) / 7,
    },
    {
      id: "perfect-month",
      icon: "👑",
      title: "Perfect Month",
      desc: "30 days in a row above 80%",
      check: () => A.bestRun(80) >= 30,
      prog: () => A.bestRun(80) / 30,
    },
    {
      id: "shake-master",
      icon: "🥤",
      title: "Shake Master",
      desc: "10-day Morning Shake streak",
      check: () => A.streak("shake") >= 10,
      prog: () => A.streak("shake") / 10,
    },
    {
      id: "coding-warrior",
      icon: "💻",
      title: "Coding Warrior",
      desc: "14-day Coding streak",
      check: () => A.streak("coding") >= 14,
      prog: () => A.streak("coding") / 14,
    },
    {
      id: "job-hunter",
      icon: "💼",
      title: "Job Hunter",
      desc: "5-day Job Applications streak",
      check: () => A.streak("job") >= 5,
      prog: () => A.streak("job") / 5,
    },
    {
      id: "consistent",
      icon: "📈",
      title: "Consistent",
      desc: "Track 30 different days",
      check: () => A.daysTracked() >= 30,
      prog: () => A.daysTracked() / 30,
    },
    {
      id: "centurion",
      icon: "💯",
      title: "Centurion",
      desc: "Track 100 different days",
      check: () => A.daysTracked() >= 100,
      prog: () => A.daysTracked() / 100,
    },
    {
      id: "goal-machine",
      icon: "⚙️",
      title: "Goal Machine",
      desc: "Have 8 or more active goals",
      check: () => A.goals() >= 8,
      prog: () => A.goals() / 8,
    },
  ];

  /* detect + record unlocks; silent=true skips the celebration (used for baseline) */
  function syncAchievements(silent) {
    const known = new Set(Store.state.achievements || []);
    const fresh = [];
    ACHIEVEMENTS.forEach((a) => {
      if (a.check() && !known.has(a.id)) {
        known.add(a.id);
        fresh.push(a);
      }
    });
    Store.state.achievements = [...known];
    if (!silent && fresh.length) fresh.forEach((a) => celebrate(a));
    if ($("#view-achievements").classList.contains("is-active"))
      renderAchievements();
  }
  function celebrate(a) {
    toast(`🏆 Unlocked: ${a.title}`);
    if (typeof window.burstConfetti === "function") window.burstConfetti(); // Phase 8; no-op until then
  }

  function renderAchievements() {
    const view = $("#view-achievements");
    const unlocked = new Set(Store.state.achievements || []);
    const count = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;
    view.innerHTML = `
      <div class="achievements">
        <div class="achievements__head">
          <div>
            <h2 class="achievements__title">Achievements</h2>
            <p class="achievements__sub">${count} of ${ACHIEVEMENTS.length} unlocked</p>
          </div>
          <div class="achievements__meter">
            <div class="progress"><span class="progress__fill" style="--_p:${Math.round((count / ACHIEVEMENTS.length) * 100)}"></span></div>
          </div>
        </div>
        <div class="badge-grid">
          ${ACHIEVEMENTS.map((a) => {
            const on = unlocked.has(a.id);
            const p =
              !on && a.prog ? clamp(Math.round(a.prog() * 100), 0, 99) : null;
            return `
              <div class="badge ${on ? "is-unlocked" : "is-locked"}">
                <div class="badge__icon">${a.icon}${on ? "" : `<span class="badge__lock">🔒</span>`}</div>
                <div class="badge__title">${a.title}</div>
                <div class="badge__desc">${a.desc}</div>
                ${p !== null ? `<div class="badge__prog"><div class="progress"><span class="progress__fill" style="--_p:${p}"></span></div><span class="badge__prog-txt">${p}%</span></div>` : ""}
                ${on ? `<div class="badge__earned">Earned ✓</div>` : ""}
              </div>`;
          }).join("")}
        </div>
      </div>`;
  }

  /* ---------- Master render ---------- */
  let firstPaint = true;
  let lastScore = null;
  function render() {
    const s = Store.state;
    const score = todayScore();
    renderUser(s);
    renderRing(score, { animate: firstPaint });
    renderCompare(score, s);
    renderStreaks(s);
    renderGoals(s);
    renderWeekly();
    renderLife(s);
    renderInsight(score, s);
    if (
      !firstPaint &&
      score === 100 &&
      lastScore !== 100 &&
      typeof window.burstConfetti === "function"
    )
      window.burstConfetti({ big: true });
    lastScore = score;
    firstPaint = false;
  }

  /* ---------- Count-up animation ---------- */
  function animateCount(el, to, { dur = 900, suffix = "", prefix = "" } = {}) {
    if (reduceMotion()) {
      el.textContent = prefix + to + suffix;
      return;
    }
    const start = performance.now();
    (function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(to * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  /* ---------- Navigation (view routing) ---------- */
  function route(view) {
    if (!view) view = "dashboard";
    $$(".view").forEach((v) => {
      const active = v.dataset.view === view;
      v.classList.toggle("is-active", active);
      v.hidden = !active;
    });
    $$(".nav__item").forEach((btn) =>
      btn.classList.toggle("is-active", btn.dataset.view === view),
    );
    if (view === "analytics") renderAnalytics();
    if (view === "achievements") renderAchievements();
    if (window.innerWidth <= 1024) closeSidebar();
    window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
  }
  function initNav() {
    $$(".nav__item").forEach((btn) => {
      btn.addEventListener("click", () => {
        location.hash = btn.dataset.view;
      });
    });
    window.addEventListener("hashchange", () =>
      route(location.hash.replace("#", "")),
    );
    route(location.hash.replace("#", "") || "dashboard");
  }

  /* ---------- Sidebar (mobile) ---------- */
  const app = $(".app");
  function openSidebar() {
    app.classList.add("nav-open");
  }
  function closeSidebar() {
    app.classList.remove("nav-open");
  }
  function initSidebar() {
    $('[data-action="toggle-sidebar"]').addEventListener("click", (e) => {
      e.stopPropagation();
      app.classList.toggle("nav-open");
    });
    document.addEventListener("click", (e) => {
      if (!app.classList.contains("nav-open")) return;
      if (
        e.target.closest(".sidebar") ||
        e.target.closest('[data-action="toggle-sidebar"]')
      )
        return;
      closeSidebar();
    });
  }

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }
  function applyAccent(accent) {
    document.documentElement.dataset.accent = accent || "aurora";
  }
  function applyAnimations(on) {
    document.documentElement.dataset.animations = on ? "on" : "off";
  }
  function applySettings(s) {
    applyTheme(s.settings.theme);
    applyAccent(s.settings.accent);
    applyAnimations(s.settings.animations);
  }
  function initTheme() {
    applyTheme(Store.state.settings.theme);
    $('[data-action="toggle-theme"]').addEventListener("click", () => {
      const next = Store.state.settings.theme === "dark" ? "light" : "dark";
      Store.setTheme(next);
      applyTheme(next);
      toast(next === "dark" ? "Dark mode" : "Light mode");
    });
  }

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1900);
  }

  /* ---------- Goal editor modal ---------- */
  let modalRoot;
  function buildModal() {
    modalRoot = document.createElement("div");
    modalRoot.className = "modal-overlay";
    modalRoot.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal__head">
          <h2 class="modal__title" id="modal-title">New Goal</h2>
          <button class="modal__close" type="button" data-close aria-label="Close">✕</button>
        </div>
        <div class="field">
          <label class="field__label" for="f-title">Title</label>
          <input class="input" id="f-title" type="text" placeholder="e.g. Read 20 pages" />
        </div>
        <div class="field">
          <label class="field__label" for="f-emoji">Emoji</label>
          <input class="input" id="f-emoji" type="text" maxlength="4" placeholder="🎯" />
          <div class="emoji-picks">${EMOJI_QUICK.map((e) => `<button class="emoji-pick" type="button" data-emoji="${e}">${e}</button>`).join("")}</div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="f-type">Type</label>
            <select id="f-type">${GOAL_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label class="field__label" for="f-category">Category</label>
            <select id="f-category">${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field-row" data-target-row>
          <div class="field">
            <label class="field__label" for="f-target">Target</label>
            <input class="input" id="f-target" type="number" min="1" value="1" />
          </div>
          <div class="field">
            <label class="field__label" for="f-unit">Unit</label>
            <input class="input" id="f-unit" type="text" placeholder="min / ml / pages" />
          </div>
        </div>
        <div class="field-row">
          <div class="field" data-current-field>
            <label class="field__label" for="f-current">Current progress</label>
            <input class="input" id="f-current" type="number" min="0" value="0" />
          </div>
          <div class="field">
            <label class="field__label" for="f-points">Points</label>
            <input class="input" id="f-points" type="number" min="0" value="10" />
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="f-notes">Notes (optional)</label>
          <textarea id="f-notes" placeholder="Anything to remember..."></textarea>
        </div>
        <div class="modal__foot">
          <button class="btn btn--danger is-hidden" type="button" data-delete>Delete</button>
          <button class="btn btn--ghost" type="button" data-close>Cancel</button>
          <button class="btn btn--primary" type="button" data-save>Save Goal</button>
        </div>
      </div>`;
    document.body.appendChild(modalRoot);

    /* modal events */
    modalRoot.addEventListener("click", (e) => {
      if (e.target === modalRoot || e.target.closest("[data-close]"))
        closeModal();
      const emoji = e.target.closest("[data-emoji]");
      if (emoji) $("#f-emoji", modalRoot).value = emoji.dataset.emoji;
      if (e.target.closest("[data-save]")) saveModal();
      if (e.target.closest("[data-delete]")) {
        Store.removeGoal(editingId);
        toast("Goal deleted");
        closeModal();
      }
    });
    $("#f-type", modalRoot).addEventListener("change", syncTypeFields);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  let editingId = null;
  function syncTypeFields() {
    const type = $("#f-type", modalRoot).value;
    const targetRow = $("[data-target-row]", modalRoot);
    targetRow.classList.toggle("is-hidden", type === "checkbox");
    if (type === "water" && !$("#f-unit", modalRoot).value)
      $("#f-unit", modalRoot).value = "ml";
    if (type === "minutes" && !$("#f-unit", modalRoot).value)
      $("#f-unit", modalRoot).value = "min";
  }
  function openModal(goal) {
    editingId = goal ? goal.id : null;
    $("#modal-title", modalRoot).textContent = goal ? "Edit Goal" : "New Goal";
    $("[data-delete]", modalRoot).classList.toggle("is-hidden", !goal);
    $("[data-current-field]", modalRoot).classList.toggle("is-hidden", !goal);
    $("#f-title", modalRoot).value = goal ? goal.title : "";
    $("#f-emoji", modalRoot).value = goal ? goal.emoji : "";
    $("#f-type", modalRoot).value = goal ? goal.type : "minutes";
    $("#f-category", modalRoot).value = goal ? goal.category : "Health";
    $("#f-target", modalRoot).value = goal ? goal.target : 1;
    $("#f-unit", modalRoot).value = goal ? goal.unit : "";
    $("#f-current", modalRoot).value = goal ? goal.current : 0;
    $("#f-points", modalRoot).value = goal ? goal.points : 10;
    $("#f-notes", modalRoot).value = goal ? goal.notes || "" : "";
    syncTypeFields();
    modalRoot.classList.add("is-open");
    setTimeout(() => $("#f-title", modalRoot).focus(), 60);
  }
  function closeModal() {
    modalRoot.classList.remove("is-open");
    editingId = null;
  }
  function saveModal() {
    const title = $("#f-title", modalRoot).value.trim();
    if (!title) {
      $("#f-title", modalRoot).focus();
      return toast("Give your goal a title");
    }
    const type = $("#f-type", modalRoot).value;
    const data = {
      title,
      emoji: $("#f-emoji", modalRoot).value.trim() || "🎯",
      type,
      category: $("#f-category", modalRoot).value,
      target:
        type === "checkbox"
          ? 1
          : Math.max(1, +$("#f-target", modalRoot).value || 1),
      unit: $("#f-unit", modalRoot).value.trim(),
      points: Math.max(0, +$("#f-points", modalRoot).value || 0),
      notes: $("#f-notes", modalRoot).value.trim(),
      subtitle: "",
    };
    if (editingId) {
      data.current = clamp(
        +$("#f-current", modalRoot).value || 0,
        0,
        data.target,
      );
      Store.updateGoal(editingId, data);
      toast("Goal updated");
    } else {
      data.current = 0;
      data.color = "blue";
      Store.addGoal(data);
      toast("Goal added");
    }
    closeModal();
  }

  /* ---------- Card shortcuts ("View all" / "View Full Report") ---------- */
  function initShortcuts() {
    const go = (sel, view) => { const el = $(sel); if (el) el.addEventListener("click", () => { location.hash = view; }); };
    go('[data-action="full-report"]', "analytics");
    go('[data-action="view-life-areas"]', "analytics");
    go('[data-action="view-streaks"]', "achievements");
  }

  /* ---------- Quick Journal (autosave + save button) ---------- */
  function initJournal() {
    const box = $("#quick-journal");
    const btn = $('[data-action="save-journal"]');
    if (!box) return;
    const key = () => dateKey();
    box.value = (Store.state.journal && Store.state.journal[key()]) || "";
    let t;
    const persist = (announce) => {
      Store.state.journal = Store.state.journal || {};
      Store.state.journal[key()] = box.value;
      Store.save();
      if (announce) toast("Journal saved ✓");
    };
    box.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => persist(false), 700); });
    if (btn) btn.addEventListener("click", () => persist(true));
  }

  /* ---------- Goal list interactions ---------- */
  function initGoalInteractions() {
    $(".goal-list").addEventListener("click", (e) => {
      const check = e.target.closest("[data-check]");
      if (check) {
        const id = check.dataset.check;
        Store.toggleGoal(id); // re-renders the list
        const fresh = $(`.goal[data-id="${id}"] .goal__check.is-checked`);
        if (fresh) popEl(fresh); // pop only when it became checked
        return;
      }
      const row = e.target.closest(".goal");
      if (row)
        openModal(Store.state.goals.find((g) => g.id === row.dataset.id));
    });
    $('[data-action="add-goal"]').addEventListener("click", () =>
      openModal(null),
    );
  }

  /* ---------- Misc guards ---------- */
  function escapeHtml(str) {
    return String(str).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  /* ---------- Settings view ---------- */
  const ACCENTS = [
    { key: "aurora", grad: "linear-gradient(135deg,#4f79ff,#33d9f2,#a35bff)" },
    { key: "sunset", grad: "linear-gradient(135deg,#ff7a59,#f2597f)" },
    { key: "emerald", grad: "linear-gradient(135deg,#22c9a0,#33e0c0)" },
    { key: "rose", grad: "linear-gradient(135deg,#f2597f,#c159ff)" },
    { key: "ocean", grad: "linear-gradient(135deg,#2b8fff,#33d9f2)" },
  ];
  let settingsBuilt = false;

  function initSettings() {
    const view = $("#view-settings");
    view.innerHTML = `
      <div class="settings">
        <section class="card settings__group">
          <h2 class="card__title">Profile</h2>
          <label class="field__label" for="set-name">Your name</label>
          <input class="input settings__name" id="set-name" type="text" placeholder="Your name" />
        </section>

        <section class="card settings__group">
          <h2 class="card__title">Appearance</h2>
          <div class="setting-row">
            <div><div class="setting-row__label">Theme</div><div class="setting-row__hint">Dark or light mode</div></div>
            <div class="seg" id="set-theme">
              <button type="button" data-theme-opt="dark">Dark</button>
              <button type="button" data-theme-opt="light">Light</button>
            </div>
          </div>
          <div class="setting-row">
            <div><div class="setting-row__label">Accent</div><div class="setting-row__hint">Colour palette</div></div>
            <div class="swatches" id="set-accent">
              ${ACCENTS.map((a) => `<button type="button" class="swatch" data-accent-opt="${a.key}" style="background:${a.grad}" aria-label="${a.key} accent"></button>`).join("")}
            </div>
          </div>
          <div class="setting-row">
            <div><div class="setting-row__label">Animations</div><div class="setting-row__hint">Motion &amp; transitions</div></div>
            <button type="button" class="switch" id="set-anim" role="switch" aria-label="Toggle animations"></button>
          </div>
        </section>

        <section class="card settings__group">
          <h2 class="card__title">Data</h2>
          <div class="setting-row__hint" style="margin-bottom:12px">Everything is stored locally in your browser.</div>
          <div class="settings__data-btns">
            <button class="btn btn--ghost" type="button" id="set-export">⬇ Export backup (JSON)</button>
            <button class="btn btn--ghost" type="button" id="set-import-btn">⬆ Import backup</button>
            <button class="btn btn--danger" type="button" id="set-fresh">✨ Start fresh — clear all data</button>
            <button class="btn btn--ghost" type="button" id="set-reset">Restore sample data</button>
          </div>
          <input type="file" id="set-import" accept="application/json,.json" class="is-hidden" />
        </section>
      </div>`;

    /* profile */
    $("#set-name").addEventListener("input", (e) =>
      Store.setUserName(e.target.value),
    );
    /* theme */
    $("#set-theme").addEventListener("click", (e) => {
      const b = e.target.closest("[data-theme-opt]");
      if (b) Store.setTheme(b.dataset.themeOpt);
    });
    /* accent */
    $("#set-accent").addEventListener("click", (e) => {
      const b = e.target.closest("[data-accent-opt]");
      if (b) {
        Store.setAccent(b.dataset.accentOpt);
        toast("Accent updated");
      }
    });
    /* animations */
    $("#set-anim").addEventListener("click", () =>
      Store.setAnimations(!Store.state.settings.animations),
    );
    /* data */
    $("#set-export").addEventListener("click", () => {
      downloadFile(
        `growthos-backup-${dateKey()}.json`,
        JSON.stringify(Store.state, null, 2),
      );
      toast("Backup exported");
    });
    $("#set-import-btn").addEventListener("click", () =>
      $("#set-import").click(),
    );
    $("#set-import").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (!obj || !Array.isArray(obj.goals)) throw new Error("bad file");
          Store.replaceState(obj);
          toast("Backup restored");
        } catch (err) {
          toast("Couldn't read that file");
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });
    $("#set-fresh").addEventListener("click", () => {
      if (
        confirm(
          "Clear everything and start fresh?\n\nThis removes all goals, streaks and history so you can begin your own tracking. Your name and settings are kept. This can't be undone.",
        )
      ) {
        Store.startFresh();
        location.hash = "dashboard";
        toast("Fresh start — add your first goal ✨");
      }
    });
    $("#set-reset").addEventListener("click", () => {
      if (confirm("Replace everything with the sample demo data?")) {
        Store.reset();
        toast("Sample data restored");
      }
    });

    settingsBuilt = true;
    syncSettingsControls();
  }

  function syncSettingsControls() {
    if (!settingsBuilt) return;
    const s = Store.state;
    const nameEl = $("#set-name");
    if (nameEl && document.activeElement !== nameEl) nameEl.value = s.user.name;
    $$("#set-theme [data-theme-opt]").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.themeOpt === s.settings.theme),
    );
    $$("#set-accent [data-accent-opt]").forEach((b) =>
      b.classList.toggle(
        "is-active",
        b.dataset.accentOpt === s.settings.accent,
      ),
    );
    const anim = $("#set-anim");
    if (anim) {
      anim.classList.toggle("is-on", !!s.settings.animations);
      anim.setAttribute("aria-checked", !!s.settings.animations);
    }
  }

  /* ---------- Charts init ---------- */
  function initCharts() {
    const sel = $(".card--weekly .select select");
    if (sel)
      sel.addEventListener("change", () => {
        weeklyOffset = sel.selectedIndex === 1 ? -1 : 0;
        renderWeekly();
      });
  }

  /* ---------- Confetti + micro-interactions (Phase 8) ---------- */
  function popEl(el) {
    if (reduceMotion() || Store.state.settings.animations === false) return;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  function initConfetti() {
    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let parts = [],
      raf = null;
    function resize() {
      canvas.width = innerWidth * DPR;
      canvas.height = innerHeight * DPR;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    const COLORS = [
      "#4f79ff",
      "#33d9f2",
      "#a35bff",
      "#37d39b",
      "#ffd15c",
      "#f2597f",
    ];
    function spawn(n, originX) {
      for (let i = 0; i < n; i++) {
        parts.push({
          x: originX,
          y: innerHeight * 0.28,
          vx: (Math.random() - 0.5) * 9,
          vy: Math.random() * -9 - 4,
          g: 0.22 + Math.random() * 0.16,
          size: 5 + Math.random() * 6,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: COLORS[i % COLORS.length],
          shape: Math.random() < 0.5 ? "rect" : "circle",
        });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function loop() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.rot += p.vr;
      });
      parts = parts.filter((p) => p.y < innerHeight + 40);
      parts.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "rect")
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      });
      if (parts.length) raf = requestAnimationFrame(loop);
      else {
        raf = null;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
      }
    }
    window.burstConfetti = (opts) => {
      opts = opts || {};
      if (reduceMotion() || Store.state.settings.animations === false) return;
      const n = opts.big ? 170 : 90;
      spawn(Math.round(n / 2), innerWidth * 0.34);
      spawn(Math.round(n / 2), innerWidth * 0.66);
    };
  }

  /* ---------- Init ---------- */
  function init() {
    Store.load(); // restore from localStorage (or keep seed)
    Store.ensureDailyReset();
    buildModal();
    buildDayModal();
    initConfetti();
    Store.subscribe(render);
    Store.subscribe(applySettings); // theme/accent/animations follow state
    Store.subscribe(syncSettingsControls);
    Store.subscribe(updateHeatToday); // keep today's heatmap cell in sync
    initTheme();
    initNav();
    initSidebar();
    initGoalInteractions();
    initJournal();
    initShortcuts();
    initCharts();
    initHeatmap();
    initSettings();
    applySettings(Store.state); // apply persisted appearance before paint
    syncAchievements(true); // baseline already-earned badges silently
    Store.save(); // persist history stamp + baseline badges
    const checkDayBoundary = () => {
      if (Store.ensureDailyReset()) {
        Store.emit();
      }
    };
    checkDayBoundary();
    window.setInterval(checkDayBoundary, 60000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkDayBoundary();
    });
    Store.subscribe(() => syncAchievements(false)); // celebrate new unlocks going forward
    render();
    renderHeatmap(); // build the year grid once from history
  }
  /* ---------- External bridge (used by firebase-sync.js) ---------- */
  window.GrowthOS = {
    get state() {
      return Store.state;
    },
    subscribe(fn) {
      Store.subscribe(fn);
    },
    replaceState(obj) {
      Store.replaceState(obj);
    },
    save() {
      Store.save();
    },
    dailyReset() {
      if (Store.ensureDailyReset()) Store.emit(); // roll a stale (e.g. cloud-restored) state to today
    },
    clearCloudData() {},
    notify(msg) {
      toast(msg);
    },
  };

  document.addEventListener("DOMContentLoaded", init);
})();
