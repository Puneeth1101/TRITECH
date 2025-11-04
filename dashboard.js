/* dashboard.js
 - stores habits per period in localStorage key: "habits_<period>"
 - each habit object: { id, habit, time, done, isDefault }
 - notifications use Notification API (falls back to alert)
 - progress is live and saved; default habits are created only if not present
*/

(() => {
  const PERIODS = ["morning", "afternoon", "night"];
  const STORAGE_PREFIX = "habits_"; // habits_morning, habits_afternoon, habits_night
  const NOTIFIED_KEY = "notified_"; // notified_YYYY-MM-DD => { habitId: true }

  // default sets (IDs constant so editing default modifies stored copy)
  const DEFAULTS = {
    morning: [
      { id: "d-m-1", habit: "Drink Water 💧", time: "07:00", done: false, isDefault: true },
      { id: "d-m-2", habit: "Stretch / Yoga 🧘", time: "07:15", done: false, isDefault: true },
      { id: "d-m-3", habit: "Plan Today 🗓", time: "07:30", done: false, isDefault: true },
      { id: "d-m-4", habit: "Read 10 Pages 📖", time: "08:00", done: false, isDefault: true }
    ],
    afternoon: [
      { id: "d-a-1", habit: "Eat Healthy Lunch 🥗", time: "13:00", done: false, isDefault: true },
      { id: "d-a-2", habit: "Short Walk 🚶‍♀", time: "14:00", done: false, isDefault: true },
      { id: "d-a-3", habit: "Drink Water Again 💦", time: "15:00", done: false, isDefault: true },
      { id: "d-a-4", habit: "Avoid Distractions 🚫", time: "16:00", done: false, isDefault: true }
    ],
    night: [
      { id: "d-n-1", habit: "Reflect on the Day ✨", time: "21:00", done: false, isDefault: true },
      { id: "d-n-2", habit: "Journal / Gratitude 📔", time: "21:15", done: false, isDefault: true },
      { id: "d-n-3", habit: "Prep for Tomorrow 🎒", time: "21:30", done: false, isDefault: true },
      { id: "d-n-4", habit: "Sleep Early 😴", time: "22:00", done: false, isDefault: true }
    ]
  };

  // helpers
  const todayKey = () => new Date().toISOString().slice(0,10);
  const read = (k, fallback) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fallback; } catch { return fallback; } };
  const write = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

  // initialize storage if missing
  function ensureInitialized() {
    PERIODS.forEach(p => {
      const key = STORAGE_PREFIX + p;
      if (!localStorage.getItem(key)) {
        write(key, DEFAULTS[p].map(x => Object.assign({}, x))); // copy defaults
      } else {
        // ensure objects have id/isDefault/done
        let arr = read(key, []);
        let changed = false;
        arr = arr.map(item => {
          if (!item.id) { item.id = uid(); changed = true; }
          if (typeof item.done === "undefined") { item.done = false; changed = true; }
          if (typeof item.isDefault === "undefined") item.isDefault = false;
          return item;
        });
        if (changed) write(key, arr);
      }
    });
  }

  // render a period list
  function render() {
    PERIODS.forEach(period => {
      const el = document.getElementById(period + "List");
      if (!el) return;
      el.innerHTML = "";
      const items = read(STORAGE_PREFIX + period, []);
      items.forEach((h, idx) => {
        const li = document.createElement("li");
        li.className = "li-row";
        li.dataset.id = h.id;
        li.innerHTML = `
          <div class="left">
            <input type="checkbox" class="habit-checkbox" ${h.done ? "checked" : ""}>
            <span class="habit-title"></span>
            <small class="habit-time"></small>
            <input type="time" class="inline-time" value="${h.time}">
          </div>
          <div class="actions">
            <button class="btn-icon edit">✏️</button>
            <button class="btn-icon del">🗑️</button>
          </div>
        `;
        li.querySelector(".habit-title").textContent = h.habit;
        li.querySelector(".habit-time").textContent = formatTimeForDisplay(h.time);
        // checkbox change
        li.querySelector(".habit-checkbox").addEventListener("change", (ev) => {
          h.done = ev.target.checked;
          savePeriod(period, items);
          updateTrackerUI();
        });
        // time change
        li.querySelector(".inline-time").addEventListener("change", (ev) => {
          h.time = ev.target.value;
          li.querySelector(".habit-time").textContent = formatTimeForDisplay(h.time);
          savePeriod(period, items);
        });
        // edit
        li.querySelector(".edit").addEventListener("click", () => {
          const newName = prompt("Edit habit name:", h.habit);
          if (newName === null) return;
          const newTime = prompt("Enter time (HH:MM):", h.time);
          if (newTime === null) return;
          h.habit = newName.trim() || h.habit;
          h.time = normalizeTime(newTime) || h.time;
          savePeriod(period, items);
          render();
          updateTrackerUI();
        });
        // delete
        li.querySelector(".del").addEventListener("click", () => {
          if (h.isDefault) {
            // allow deleting default? user wanted edit default; they previously asked default editable. We'll allow delete but warn.
            if (!confirm("Are you sure you want to delete this default habit?")) return;
          } else {
            if (!confirm("Delete this habit?")) return;
          }
          items.splice(idx,1);
          savePeriod(period, items);
          render();
          updateTrackerUI();
        });

        el.appendChild(li);
      });
    });

    updateTrackerUI();
  }

  // save period array
  function savePeriod(period, arr) { write(STORAGE_PREFIX + period, arr); }

  // add new habit from inputs
  function addNew(period) {
    const textEl = document.getElementById(period + "NewText");
    const timeEl = document.getElementById(period + "NewTime");
    const name = textEl.value.trim();
    const time = timeEl.value;
    if (!name) return alert("Enter habit name");
    // allow empty time? we'll require time for reminders
    if (!time) return alert("Please select time for reminder");
    const arr = read(STORAGE_PREFIX + period, []);
    const obj = { id: uid(), habit: name, time: time, done: false, isDefault: false };
    arr.push(obj);
    savePeriod(period, arr);
    textEl.value = ""; timeEl.value = "";
    render();
  }

  // normalize time input if user typed like "7:00 AM" (attempt)
  function normalizeTime(s) {
    if (!s) return "";
    s = s.trim();
    if (/^\d{1,2}:\d{2}$/.test(s)) {
      const [hh, mm] = s.split(":").map(x=>x.padStart(2,'0'));
      return `${hh}:${mm}`;
    }
    const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
    if (m) {
      let h = parseInt(m[1],10);
      const mm = m[2];
      const ap = m[3] ? m[3].toLowerCase() : null;
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2,'0')}:${mm}`;
    }
    return null;
  }

  // format HH:MM -> 12-hour string
  function formatTimeForDisplay(t) {
    if (!t) return "";
    const [hh, mm] = t.split(":").map(x => parseInt(x,10));
    if (Number.isNaN(hh)) return t;
    const ampm = hh >= 12 ? "PM" : "AM";
    let hour = ((hh + 11) % 12) + 1;
    return `${hour}:${String(mm).padStart(2,'0')} ${ampm}`;
  }

  // update tracker UI (progress)
  function updateTrackerUI() {
    let total = 0, done = 0;
    PERIODS.forEach(p => {
      const arr = read(STORAGE_PREFIX + p, []);
      total += arr.length;
      done += arr.filter(x => x.done).length;
    });
    const pct = total ? Math.round((done/total)*100) : 0;
    const fill = document.getElementById("progressFill");
    const text = document.getElementById("progressText");
    if (fill) fill.style.width = pct + "%";
    if (text) text.textContent = `${done} / ${total} habits completed — ${pct}%`;
    // daily quote change daily + by pct
    const quote = pickDailyQuote();
    const mood = pct >= 90 ? "celebrate" : pct >= 50 ? "encourage" : "motivate";
    const daily = document.getElementById("dailyQuote");
    if (daily) {
      daily.textContent = `${quote} ${moodText(mood)}`;
    }
  }

  // daily rotating quote
  const QUOTES = [
    "Small habits make big changes.",
    "Consistency compounds — keep going.",
    "One small win today beats a plan tomorrow.",
    "Build momentum — one habit at a time.",
    "You’re closer than you think."
  ];
  function pickDailyQuote() {
    const d = new Date();
    const idx = (d.getFullYear() + d.getMonth() + d.getDate()) % QUOTES.length;
    return QUOTES[idx];
  }
  function moodText(mood) {
    if (mood === "celebrate") return "— Outstanding! You crushed it today! 🎉";
    if (mood === "encourage") return "— Great work! Keep the momentum 💪";
    return "— Small steps — big results. Start with one habit ✨";
  }

  // notifications
  function notify(title, msg) {
    try {
      if (Notification && Notification.permission === "granted") {
        new Notification(title, { body: msg, icon: "https://cdn-icons-png.flaticon.com/512/1048/1048953.png" });
      } else {
        // fallback alert
        alert(`${title}\n\n${msg}`);
      }
    } catch (e) {
      alert(`${title}\n\n${msg}`);
    }
  }

  // check reminders once per minute; ensure only one alert per habit per day
  function checkReminders() {
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const today = todayKey();
    const notified = read(NOTIFIED_KEY + today, {});
    PERIODS.forEach(p => {
      const arr = read(STORAGE_PREFIX + p, []);
      arr.forEach(h => {
        if (h.time === current && !notified[h.id]) {
          // notify only if not done
          if (!h.done) {
            notify("⏰ Habit Reminder", `${h.habit} — ${formatTimeForDisplay(h.time)}`);
          }
          notified[h.id] = true;
        }
      });
    });
    write(NOTIFIED_KEY + today, notified);
  }

  // reset today's done flags
  function resetToday() {
    PERIODS.forEach(p => {
      const arr = read(STORAGE_PREFIX + p, []);
      arr.forEach(h => { h.done = false; });
      write(STORAGE_PREFIX + p, arr);
    });
    // clear today's notified map
    localStorage.removeItem(NOTIFIED_KEY + todayKey());
    render();
  }

  // event wiring
  function wireUI() {
    // top buttons
    document.getElementById("logoutBtn").addEventListener("click", () => {
      window.location.href = "index.html";
    });
    document.getElementById("dailyTrackerBtn").addEventListener("click", () => {
      window.location.href = "dailytracker.html";
    });
    // add buttons
    document.querySelectorAll(".add-btn").forEach(btn => {
      btn.addEventListener("click", () => addNew(btn.dataset.period));
    });
    // reset today
    document.getElementById("resetToday").addEventListener("click", () => {
      if (confirm("Reset today's completions?")) resetToday();
    });
    // open daily tracker page (button)
    document.getElementById("goDailyTracker").addEventListener("click", () => {
      window.location.href = "dailytracker.html";
    });
  }

  // render + init
  function render() { renderCalled = true; renderUI(); }
  function renderUI() { render(); } // placeholder to maintain function names
  function renderCalledFunc() {
    // Not used
  }

  // actual render wrapper
  function render() {
    renderPeriodLists();
    updateTrackerUI();
  }

  function renderPeriodLists() {
    PERIODS.forEach(period => {
      const el = document.getElementById(period + "List");
      el.innerHTML = "";
      const arr = read(STORAGE_PREFIX + period, []);
      arr.forEach(h => {
        const li = document.createElement("li");
        li.className = "li-row";
        li.dataset.id = h.id;
        li.innerHTML = `
          <div class="left">
            <input type="checkbox" class="habit-checkbox" ${h.done ? "checked" : ""}>
            <span class="habit-title"></span>
            <small class="habit-time"></small>
            <input type="time" class="inline-time" value="${h.time}">
          </div>
          <div class="actions">
            <button class="btn-icon edit">✏️</button>
            <button class="btn-icon del">🗑️</button>
          </div>
        `;
        li.querySelector(".habit-title").textContent = h.habit;
        li.querySelector(".habit-time").textContent = formatTimeForDisplay(h.time);
        // checkbox
        li.querySelector(".habit-checkbox").addEventListener("change", (e) => {
          h.done = e.target.checked;
          savePeriod(period, arr);
          updateTrackerUI();
        });
        // time change
        li.querySelector(".inline-time").addEventListener("change", (e) => {
          h.time = e.target.value;
          li.querySelector(".habit-time").textContent = formatTimeForDisplay(h.time);
          savePeriod(period, arr);
        });
        // edit
        li.querySelector(".edit").addEventListener("click", () => {
          const newName = prompt("Edit habit name:", h.habit);
          if (newName === null) return;
          const newTime = prompt("Edit time (HH:MM):", h.time);
          if (newTime === null) return;
          h.habit = newName.trim() || h.habit;
          h.time = normalizeTime(newTime) || h.time;
          savePeriod(period, arr);
          render();
          updateTrackerUI();
        });
        // delete
        li.querySelector(".del").addEventListener("click", () => {
          if (!confirm("Delete this habit?")) return;
          const idx = arr.findIndex(x=>x.id===h.id);
          if (idx > -1) arr.splice(idx,1);
          savePeriod(period, arr);
          render();
          updateTrackerUI();
        });

        el.appendChild(li);
      });
    });
  }

  // init
  function init() {
    ensureInitialized();
    wireUI();
    render();
    // request notification permission
    try { if (Notification && Notification.permission !== "granted") Notification.requestPermission(); } catch(e){}
    // reminders every minute
    checkReminders();
    setInterval(checkReminders, 60*1000);
    // update tracker UI frequently (live)
    setInterval(updateTrackerUI, 2000);
  }

  // kick off
  init();

})();
