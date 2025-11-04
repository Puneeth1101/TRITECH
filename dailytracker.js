/* dailytracker.js
   - calendar/chart logic
   - greeting (time-based)
   - Reflection (daily notes + view past)
   - Habit Garden bloom
   - Lucky Spin wheel + challenges
   - confetti on win
   - uses localStorage only
*/

(() => {
  // constants
  const NAME_FALLBACK = "User";
  const BADGE_THRESHOLDS = [7,14,30];
  const CAL_KEY = "completedDays_byMonth";
  const BADGES_KEY = "unlockedBadges";
  const HABITS_PREFIXES = ["habits_morning","habits_afternoon","habits_night"];
  const HABITS_FALLBACK_KEY = "habits";
  const THEME_KEY = "theme";

  // DOM refs
  const monthYearEl = document.getElementById("monthYear");
  const calendarGrid = document.getElementById("calendarGrid");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");
  const monthSelect = document.getElementById("monthSelect");
  const yearSelect = document.getElementById("yearSelect");
  const completedCountEl = document.getElementById("completedCount");
  const monthPercentEl = document.getElementById("monthPercent");
  const longestStreakEl = document.getElementById("longestStreak");
  const motivationText = document.getElementById("motivationText");
  const insightText = document.getElementById("insightText");
  const badgesContainer = document.getElementById("badgesContainer");
  const goBackBtn = document.getElementById("goBackBtn");
  const trendCanvasEl = document.getElementById("trendChart");
  // keep both canvas element and 2D context available
  const trendCanvasCtx = trendCanvasEl ? trendCanvasEl.getContext("2d") : null;
  const view7Btn = document.getElementById("view7");
  const view30Btn = document.getElementById("view30");
  const claimRewardBtn = document.getElementById("claimReward");
  const rewardMsg = document.getElementById("rewardMsg");
  const dailyQuoteEl = document.getElementById("dailyQuote");
  const greetingEl = document.getElementById("greeting");
  const darkToggle = document.getElementById("darkModeToggle");

  // reflection DOM
  const reflectionDateLabel = document.getElementById("reflectionDateLabel");
  const reflectionText = document.getElementById("reflectionText");
  const saveReflectionBtn = document.getElementById("saveReflection");
  const clearReflectionBtn = document.getElementById("clearReflection");
  const viewPastBtn = document.getElementById("viewPastReflections");
  const modal = document.getElementById("pastReflectionsModal");
  const closeModal = document.getElementById("closeModal");
  const pastNotesList = document.getElementById("pastNotesList");

  // garden DOM
  const gardenEl = document.getElementById("garden");
  const bloomNowBtn = document.getElementById("bloomNow");
  const resetGardenBtn = document.getElementById("resetGarden");

  // wheel DOM
  const wheelCanvas = document.getElementById("wheelCanvas");
  const spinBtn = document.getElementById("spinWheel");
  const wheelResult = document.getElementById("wheelResult");

  // challenges list
  const challengesListEl = document.getElementById("challengesList");

  // state
  let today = new Date();
  let viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  let completedStore = JSON.parse(localStorage.getItem(CAL_KEY) || "{}");
  let unlockedBadges = JSON.parse(localStorage.getItem(BADGES_KEY) || "[]");
  let trendChart = null;
  let currentViewDays = 7;

  // challenges data
  const challenges = [
    "No sugar after 7 PM",
    "15-minute walk after lunch",
    "Read 20 pages tonight",
    "30-minute screen-free time",
    "Hydrate: 8 glasses today",
    "Try a new healthy recipe",
    "Write 3 things you're grateful for",
    "Do 10 push-ups right now"
  ];

  // theme
  (function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark") document.body.classList.add("dark-mode");
    if (darkToggle) {
      darkToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
      darkToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const mode = document.body.classList.contains("dark-mode") ? "dark" : "light";
        localStorage.setItem(THEME_KEY, mode);
        darkToggle.textContent = mode === "dark" ? "☀️" : "🌙";
        renderChart();
      });
    }
  })();

  // ---------- Utilities & normalization ----------
  // Ensure store arrays are arrays of numbers (no strings), unique & sorted
  function normalizeCompletedStore(store) {
    const normalized = {};
    Object.keys(store || {}).forEach(k => {
      const raw = store[k] || [];
      if (!Array.isArray(raw)) return;
      const nums = raw.map(x => Number(x)).filter(n => Number.isFinite(n));
      const uniq = Array.from(new Set(nums)).sort((a,b) => a - b);
      normalized[k] = uniq;
    });
    return normalized;
  }

  function readCompleted(){
    const raw = JSON.parse(localStorage.getItem(CAL_KEY) || "{}");
    completedStore = normalizeCompletedStore(raw);
    return completedStore;
  }
  function writeCompleted(){
    // store normalized
    completedStore = normalizeCompletedStore(completedStore);
    localStorage.setItem(CAL_KEY, JSON.stringify(completedStore));
  }

  function monthKey(dt) { return `${dt.getFullYear()}-${dt.getMonth()+1}`; } // keep 1-based month as key (consistent)

  // greeting (simple static as requested)
  function updateGreeting(){
    const name = localStorage.getItem("userName") || NAME_FALLBACK;
    if (greetingEl) greetingEl.textContent = `Good Day, ${name} 👋`;
    if (dailyQuoteEl) dailyQuoteEl.textContent = "Stay consistent — small steps win.";
  }

  // month selectors
  function populateMonthYearSelectors(){
    if (!monthSelect || !yearSelect) return;
    monthSelect.innerHTML = "";
    for (let i=0;i<12;i++){
      const opt = document.createElement("option");
      opt.value = i;
      opt.text = new Date(0,i).toLocaleString('default',{month:'long'});
      if (i === viewDate.getMonth()) opt.selected = true;
      monthSelect.appendChild(opt);
    }
    yearSelect.innerHTML = "";
    const cy = new Date().getFullYear();
    for (let y = cy-2; y<= cy+2; y++){
      const opt = document.createElement("option");
      opt.value = y; opt.text = y;
      if (y === viewDate.getFullYear()) opt.selected = true;
      yearSelect.appendChild(opt);
    }
    monthSelect.onchange = ()=>{ viewDate.setMonth(parseInt(monthSelect.value,10)); renderCalendar(); };
    yearSelect.onchange = ()=>{ viewDate.setFullYear(parseInt(yearSelect.value,10)); renderCalendar(); };
  }

  // calendar render
  function renderCalendar(){
    if (!monthYearEl || !calendarGrid) return;
    monthYearEl.textContent = viewDate.toLocaleString('default',{month:'long', year:'numeric'});
    calendarGrid.innerHTML = "";
    readCompleted();
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();

    for (let i=0;i<firstDayIndex;i++){
      const cellEmpty = document.createElement("div");
      cellEmpty.className = "calendar-cell";
      cellEmpty.style.background = "transparent";
      calendarGrid.appendChild(cellEmpty);
    }

    const key = `${year}-${month+1}`;
    const completedDays = (completedStore[key] || []).map(Number);

    for (let d=1; d<=daysInMonth; d++){
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      const dayNum = document.createElement("div"); dayNum.className = "day-number"; dayNum.textContent = d; cell.appendChild(dayNum);

      const info = document.createElement("div"); info.className="cell-info"; info.style.marginTop="8px"; info.style.fontSize="0.85rem";
      if (completedDays.includes(d)) { cell.classList.add("cell-completed"); info.textContent = "All done"; } else info.textContent = "";
      cell.appendChild(info);

      cell.addEventListener("click", ()=> toggleDayCompletion(year, month+1, d));

      const isToday = (new Date().getFullYear() === today.getFullYear() && new Date().getMonth() === today.getMonth() && d === today.getDate() && month === today.getMonth());
      if (isToday) cell.style.outline = "2px solid rgba(255,255,255,0.14)";

      calendarGrid.appendChild(cell);
    }

    updateMonthlySummary();
    renderChart();
    renderBadges();
    loadReflectionForDate(today);
    syncGardenWithProgress();
  }

  function toggleDayCompletion(year, month, day){
    const key = `${year}-${month}`;
    readCompleted();
    completedStore[key] = completedStore[key] || [];
    const numDay = Number(day);
    const idx = completedStore[key].indexOf(numDay);
    if (idx > -1) completedStore[key].splice(idx,1);
    else completedStore[key].push(numDay);
    writeCompleted();
    if (idx === -1) { handleCompletionForDay(new Date(year, month-1, day)); }
    renderCalendar();
  }

  // habit auto-check (keeps compatibility with other code)
  function areAllHabitsDoneToday(){
    for (const prefix of HABITS_PREFIXES){
      try {
        const arr = JSON.parse(localStorage.getItem(prefix) || "null");
        if (Array.isArray(arr) && arr.length>0 && arr.some(h=>!h.done)) return false;
      } catch(e){}
    }
    try {
      const fallback = JSON.parse(localStorage.getItem(HABITS_FALLBACK_KEY) || "null");
      if (Array.isArray(fallback) && fallback.some(h=>!h.done)) return false;
    } catch(e){}
    // if none found -> false; if found and none undone -> true
    const anyFound = HABITS_PREFIXES.some(p => {
      try { const arr = JSON.parse(localStorage.getItem(p) || "null"); return Array.isArray(arr) && arr.length>0; } catch(e){ return false; }
    }) || (function(){ try { const f=JSON.parse(localStorage.getItem(HABITS_FALLBACK_KEY)||"null"); return Array.isArray(f)&&f.length>0; } catch(e){return false;} })();
    return anyFound && true;
  }

  function autoCompleteTodayIfAllHabitsDone(){
    if (!areAllHabitsDoneToday()) return;
    const key = monthKey(today);
    readCompleted();
    completedStore[key] = completedStore[key] || [];
    const d = today.getDate();
    if (!completedStore[key].includes(d)) { completedStore[key].push(d); writeCompleted(); handleCompletionForDay(today); renderCalendar(); }
  }

  // badges & confetti
  // robust streak: always compare numbers
  function getConsecutiveStreakUpTo(dateObj){
    readCompleted();
    let count=0;
    let d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()); // clone
    while(true){
      const k = `${d.getFullYear()}-${d.getMonth()+1}`; // month 1..12
      const arr = (completedStore[k] || []).map(Number);
      if (arr.includes(d.getDate())) { count++; d.setDate(d.getDate()-1); } else break;
    }
    return count;
  }

  function handleCompletionForDay(dateObj){
    unlockedBadges = JSON.parse(localStorage.getItem(BADGES_KEY) || "[]");
    const streak = getConsecutiveStreakUpTo(dateObj);
    const newlyUnlocked = [];
    BADGE_THRESHOLDS.forEach(t => { if (streak >= t && !unlockedBadges.includes(t)) { unlockedBadges.push(t); newlyUnlocked.push(t); } });
    localStorage.setItem(BADGES_KEY, JSON.stringify(unlockedBadges));
    renderBadges();
    if (newlyUnlocked.length) {
      showConfetti();
      if (rewardMsg) rewardMsg.textContent = `Badge(s) unlocked: ${newlyUnlocked.join(", ")} days! 🎉`;
    } else {
      showConfetti(0.6);
      if (rewardMsg) rewardMsg.textContent = `Nice! You completed all habits for today. Keep the streak!`;
      setTimeout(()=>{ if (rewardMsg) rewardMsg.textContent = ""; },3500);
    }
    bloomGarden();
  }

  function showConfetti(force = 1){
    try {
      const duration = 1000 * force;
      const end = Date.now() + duration;
      (function frame(){
        confetti({ particleCount: 8 + Math.floor(25*force), startVelocity: 30, spread: 360, origin: { x: Math.random(), y: Math.random() * 0.6 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    } catch(e){ console.warn("confetti not available", e); }
  }

  function renderBadges(){
    if (!badgesContainer) return;
    badgesContainer.innerHTML = "";
    unlockedBadges = JSON.parse(localStorage.getItem(BADGES_KEY) || "[]");
    unlockedBadges.sort((a,b)=>a-b).forEach(th => {
      const el = document.createElement("div"); el.className = "badge"; el.title = `${th}-day streak badge`; el.textContent = th;
      badgesContainer.appendChild(el);
    });
  }

  // -------- Chart: improved clarity --------
  function renderChart(daysWindow = currentViewDays){
    if (!trendCanvasEl || !trendCanvasCtx) return;
    readCompleted();
    const now = new Date();
    const labels = [], data = [];
    for (let i = daysWindow - 1; i >= 0; i--){
      const dd = new Date(now);
      dd.setDate(now.getDate()-i);
      labels.push(`${dd.getDate()}/${dd.getMonth()+1}`);
      const ky = `${dd.getFullYear()}-${dd.getMonth()+1}`;
      const arr = (completedStore[ky] || []).map(Number);
      data.push(arr.includes(dd.getDate()) ? 100 : 0);
    }

    // create gradient for fill & stroke for better clarity
    let borderColor = '#6b61ff';
    let bgColor = 'rgba(123,97,255,0.12)';
    if (document.body.classList.contains("dark-mode")) {
      borderColor = '#00c6ff';
      bgColor = 'rgba(0,198,255,0.12)';
    }
    // gradient (vertical)
    const grad = trendCanvasCtx.createLinearGradient(0,0,0,trendCanvasEl.height || 200);
    grad.addColorStop(0, hexToRgba(borderColor, 0.32));
    grad.addColorStop(1, hexToRgba(borderColor, 0.04));

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(trendCanvasCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Completion %',
          data,
          borderColor: borderColor,
          backgroundColor: grad,
          tension: 0.28,
          fill: true,
          pointRadius: 6,
          pointHoverRadius: 8,
          borderWidth: 3,
          pointStyle: 'circle'
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function(context) {
                return context.parsed.y === 100 ? 'Completed' : 'Not completed';
              }
            }
          }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            ticks: {
              color: document.body.classList.contains("dark-mode") ? "#cfefff" : "#123",
              maxRotation: daysWindow > 14 ? 45 : 0,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: daysWindow > 14 ? 10 : daysWindow
            },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            min: 0,
            max: 100,
            ticks: {
              color: document.body.classList.contains("dark-mode") ? "#cfefff" : "#123",
              stepSize: 25,
              callback: (v) => (v === 100 ? 'Done' : (v === 0 ? 'None' : v + '%'))
            },
            grid: { color: 'rgba(255,255,255,0.04)' }
          }
        },
        maintainAspectRatio: false,
        responsive: true
      }
    });
  }

  // tiny helper to convert hex or color name to rgba string with alpha fallback
  function hexToRgba(hex, alpha) {
    // if already rgba-like, just use alpha
    if (hex.startsWith('rgba')) return hex.replace(/rgba\(.+,\s*[\d.]+\)/, `rgba(0,0,0,${alpha})`);
    if (hex.startsWith('rgb')) return hex.replace(/rgb\(([^)]+)\)/, (m, g) => `rgba(${g},${alpha})`);
    // simple hex parsing (#rrggbb)
    const h = hex.replace('#','');
    if (h.length === 6) {
      const r = parseInt(h.substring(0,2),16);
      const g = parseInt(h.substring(2,4),16);
      const b = parseInt(h.substring(4,6),16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    // fallback
    return `rgba(107,97,255,${alpha})`;
  }

  // monthly summary
  function updateMonthlySummary(){
    const key = monthKey(viewDate);
    const days = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 0).getDate();
    readCompleted();
    const arr = completedStore[key] || [];
    const completedCount = arr.length;
    const percent = days ? Math.round((completedCount / days) * 100) : 0;
    if (completedCountEl) completedCountEl.textContent = completedCount;
    if (monthPercentEl) monthPercentEl.textContent = `${percent}%`;
    let longest = 0, cur = 0;
    for (let d=1; d<=days; d++){
      if (arr.includes(d)) { cur++; longest = Math.max(longest, cur); } else cur = 0;
    }
    if (longestStreakEl) longestStreakEl.textContent = longest;
    const allCompletedDaysArr = Object.values(completedStore).flat().map(Number);
    const totalCompleted = allCompletedDaysArr.length;
    const totalDaysRecorded = Object.keys(completedStore).reduce((sum,k) => {
      const dt = k.split("-"); const y = parseInt(dt[0],10), m = parseInt(dt[1],10);
      const daysInM = new Date(y,m,0).getDate(); return sum + daysInM;
    }, 0) || 1;
    const consistency = Math.round((totalCompleted / totalDaysRecorded) * 100);
    const consistencyEl = document.getElementById("consistencyRate"); if (consistencyEl) consistencyEl.textContent = `${consistency}%`;
    const currSt = getConsecutiveStreakUpTo(today); const currStEl = document.getElementById("currentStreak"); if (currStEl) currStEl.textContent = currSt;
    const top = determineTopHabit(); const topHabitEl = document.getElementById("topHabit"); if (topHabitEl) topHabitEl.textContent = top || "—";
  }

  function determineTopHabit(){
    const counts = {}; const keysToCheck = HABITS_PREFIXES.concat([HABITS_FALLBACK_KEY]); let any=false;
    keysToCheck.forEach(k => {
      try {
        const arr = JSON.parse(localStorage.getItem(k) || "null");
        if (Array.isArray(arr)) { any=true; arr.forEach(h => { const name = h.habit || h.title || "Unnamed"; if (!counts[name]) counts[name] = 0; if (h.done) counts[name]++; }); }
      } catch(e){}
    });
    if (!any) return null;
    const sorted = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
    return sorted[0] || null;
  }

  // -------- Reflection features --------
  function reflectionKey(dateObj){
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth()+1).padStart(2,'0');
    const d = String(dateObj.getDate()).padStart(2,'0');
    return `reflection_${y}-${m}-${d}`;
  }

  function loadReflectionForDate(dateObj){
    if (!reflectionDateLabel || !reflectionText) return;
    reflectionDateLabel.textContent = dateObj.toLocaleDateString();
    const key = reflectionKey(dateObj);
    reflectionText.value = localStorage.getItem(key) || "";
  }

  if (saveReflectionBtn) {
    saveReflectionBtn.addEventListener("click", () => {
      const key = reflectionKey(today);
      localStorage.setItem(key, (reflectionText.value || "").trim());
      if (rewardMsg) rewardMsg.textContent = "Reflection saved ✅";
      setTimeout(()=> { if (rewardMsg) rewardMsg.textContent = ""; }, 1800);
    });
  }
  if (clearReflectionBtn) {
    clearReflectionBtn.addEventListener("click", () => {
      const key = reflectionKey(today);
      localStorage.removeItem(key);
      if (reflectionText) reflectionText.value = "";
    });
  }

  // past reflections modal
  if (viewPastBtn) viewPastBtn.addEventListener("click", () => {
    if (!pastNotesList || !modal) return;
    pastNotesList.innerHTML = "";
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith("reflection_"));
    if (allKeys.length === 0) {
      pastNotesList.innerHTML = "<p>No reflections saved yet.</p>";
    } else {
      allKeys.sort().reverse().forEach(key => {
        const note = localStorage.getItem(key) || "";
        const date = key.replace("reflection_","");
        const div = document.createElement("div");
        div.style.background = "rgba(255,255,255,0.02)";
        div.style.padding = "10px";
        div.style.borderRadius = "8px";
        div.innerHTML = `<strong>${date}</strong><div style="margin-top:8px;white-space:pre-wrap">${note || "(empty)"}</div>`;
        pastNotesList.appendChild(div);
      });
    }
    modal.style.display = "flex";
  });

  if (closeModal) closeModal.addEventListener("click", ()=> { if (modal) modal.style.display = "none"; });
  window.addEventListener("click", (e)=> { if (e.target === modal) modal.style.display = "none"; });

  // -------- Garden --------
  function bloomGarden(){
    if (!gardenEl) return;
    const flowers = Array.from(gardenEl.querySelectorAll(".flower"));
    const next = flowers.find(f => !f.classList.contains("bloomed"));
    if (next) next.classList.add("bloomed");
    else {
      // restart bloom animation
      flowers.forEach((f, i) => { f.classList.remove("bloomed"); setTimeout(()=> f.classList.add("bloomed"), 120*i); });
    }
    // persist count
    const bloomed = Array.from(gardenEl.querySelectorAll(".flower.bloomed")).length;
    localStorage.setItem("garden_bloomed", String(bloomed));
  }
  function resetGarden(){
    if (!gardenEl) return;
    gardenEl.querySelectorAll(".flower").forEach(f => f.classList.remove("bloomed"));
    localStorage.removeItem("garden_bloomed");
  }
  function syncGardenWithProgress(){
    if (!gardenEl) return;
    const flowers = Array.from(gardenEl.querySelectorAll(".flower"));
    const saved = parseInt(localStorage.getItem("garden_bloomed") || "0", 10);
    flowers.forEach((f,i) => { if (i < saved) f.classList.add("bloomed"); else f.classList.remove("bloomed"); });
  }
  if (bloomNowBtn) bloomNowBtn.addEventListener("click", ()=> { bloomGarden(); showConfetti(0.6); });
  if (resetGardenBtn) resetGardenBtn.addEventListener("click", ()=> resetGarden());

  // -------- Wheel (draw + spin) --------
  function drawWheel(ctx){
    const seg = 2*Math.PI / challenges.length;
    const r = ctx.canvas.width/2;
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    ctx.save(); ctx.translate(r,r);
    const colors = ["#FFD86B","#FF7AA2","#7B61FF","#00C6FF","#7AF2C0","#FFC6C6","#E0C9FF","#FFD7A6"];
    for (let i=0;i<challenges.length;i++){
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.arc(0,0,r, i*seg, (i+1)*seg);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      // label
      ctx.save();
      ctx.rotate((i+0.5)*seg);
      ctx.translate(r*0.58, 0);
      ctx.rotate(Math.PI/2);
      ctx.fillStyle = "#111";
      ctx.font = "11px Poppins, sans-serif";
      const txt = challenges[i];
      const short = txt.length > 24 ? txt.slice(0,24) + "…" : txt;
      ctx.fillText(short, -ctx.measureText(short).width/2, 0);
      ctx.restore();
    }
    // center
    ctx.beginPath(); ctx.arc(0,0,26,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill();
    ctx.restore();
  }

  function initWheel(){
    if (!wheelCanvas) return;
    const ctx = wheelCanvas.getContext("2d");
    drawWheel(ctx);
    let spinning = false;
    spinBtn && spinBtn.addEventListener("click", ()=>{
      if (spinning) return;
      spinning = true;
      wheelResult.textContent = "";
      const pick = Math.floor(Math.random()*challenges.length);
      const seg = 2*Math.PI / challenges.length;
      const spins = Math.floor(Math.random()*3)+4;
      const target = -((pick + 0.5) * seg) + (2*Math.PI*spins) + (Math.random()*seg - seg/2);
      const duration = 2200 + Math.random()*800;
      const start = performance.now();
      const startAngle = 0;
      function animate(now){
        const t = Math.min(1, (now - start) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        const angle = startAngle + (target - startAngle) * ease;
        wheelCanvas.style.transform = `rotate(${angle}rad)`;
        if (t < 1) requestAnimationFrame(animate);
        else {
          spinning = false;
          wheelResult.textContent = `👉 ${challenges[pick]}`;
          showConfetti(0.6);
        }
      }
      requestAnimationFrame(animate);
    });
  }

  // populate challenges list
  function renderChallengesList(){
    if (!challengesListEl) return;
    challengesListEl.innerHTML = "";
    challenges.forEach((c, idx) => {
      const div = document.createElement("div"); div.className = "challenge";
      div.innerHTML = `<strong>Challenge ${idx+1}:</strong> ${c}`;
      challengesListEl.appendChild(div);
    });
  }

  // UI event bindings
  prevMonthBtn && prevMonthBtn.addEventListener("click", ()=> { viewDate.setMonth(viewDate.getMonth()-1); populateMonthYearSelectors(); renderCalendar(); });
  nextMonthBtn && nextMonthBtn.addEventListener("click", ()=> { viewDate.setMonth(viewDate.getMonth()+1); populateMonthYearSelectors(); renderCalendar(); });
  goBackBtn && goBackBtn.addEventListener("click", ()=> window.location.href = "dashboard.html");
  view7Btn && view7Btn.addEventListener("click", ()=> { currentViewDays = 7; view7Btn.classList.add("active"); view30Btn && view30Btn.classList.remove("active"); renderChart(); });
  view30Btn && view30Btn.addEventListener("click", ()=> { currentViewDays = 30; view30Btn.classList.add("active"); view7Btn && view7Btn.classList.remove("active"); renderChart(); });
  claimRewardBtn && claimRewardBtn.addEventListener("click", ()=> { if (rewardMsg) rewardMsg.textContent = "Virtual reward claimed — congrats! 🎉"; setTimeout(()=> { if (rewardMsg) rewardMsg.textContent = ""; }, 2000); });

  // auto-check on load
  function onLoadAutoCompleteCheck(){
    readCompleted();
    const key = monthKey(today);
    const day = today.getDate();
    const already = (completedStore[key] || []).map(Number).includes(day);
    if (!already && areAllHabitsDoneToday()){
      completedStore[key] = completedStore[key] || []; completedStore[key].push(day); writeCompleted(); handleCompletionForDay(today);
    }
    unlockedBadges = JSON.parse(localStorage.getItem(BADGES_KEY) || "[]");
    if (unlockedBadges.length) showConfetti(0.5);
  }

  // update motivation text
  function updateMotivationAndInsights(){
    const messages = ["Keep the momentum! One habit at a time.","Small wins add up — well done!","A streak is built day by day — you got this!","Consistency > intensity. Keep going."];
    if (motivationText) motivationText.textContent = messages[new Date().getDate() % messages.length];
    const avg = (() => { readCompleted(); const flat = Object.values(completedStore).flat().map(Number); if (!flat.length) return 0; const totalDays = flat.length; const doneDays = flat.filter(Boolean).length; return Math.round((doneDays/totalDays)*100); })();
    if (insightText) insightText.textContent = `Your current streak: ${getConsecutiveStreakUpTo(today)} days • Consistency score: ${avg}%`;
  }

  // load today's reflection into input (for startup)
  function loadTodayReflection(){
    loadReflectionForDate(today);
  }

  // startup
  function startup(){
    populateMonthYearSelectors();
    updateGreeting();
    setInterval(updateGreeting, 60*1000);
    onLoadAutoCompleteCheck();
    renderCalendar();
    renderBadges();
    updateMonthlySummary();
    renderChart();
    updateMotivationAndInsights();
    renderChallengesList();
    initWheel();
    syncGardenWithProgress();
    loadTodayReflection();
  }

  // final run
  startup();

})();

