const $ = (id) => document.getElementById(id);
const form = $("survey");
const fields = ["participant","date","caffeineMg","lastCaffeine","napMinutes","napEnd","exerciseMinutes","exerciseEnd","fatigue","steps","heartRate","alarmTime","firstCommitment","examTomorrow","alcohol","illness"];
const storageKey = "sleep-study-checkins-v1";
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = today();

function today() { return new Date().toISOString().slice(0,10); }
$("date").value = today();

function radio(name) { return form.querySelector(`input[name="${name}"]:checked`)?.value || ""; }
function timeToMinutes(value) { if (!value) return null; const [h,m] = value.split(":").map(Number); return h*60+m; }
function formatDuration(mins) { if (mins === null || Number.isNaN(mins)) return "미입력"; const sign = mins < 0 ? "-" : ""; mins = Math.abs(Math.round(mins)); return `${sign}${Math.floor(mins/60)}시간 ${mins%60}분`; }
function val(id) { return $(id).type === "checkbox" ? $(id).checked : $(id).value; }

function toggleCaffeine() {
  const used = radio("caffeineUsed") === "yes";
  $("caffeineDetails").classList.toggle("hidden", !used);
  if (!used) { $("caffeineMg").value = ""; $("lastCaffeine").value = ""; }
  updateSummary();
}

function updateSummary() {
  $("fatigueValue").textContent = $("fatigue").value;
  const last = timeToMinutes($("lastCaffeine").value);
  const cutoff = 20*60;
  const caffGap = last === null ? null : cutoff-last;
  const rows = [
    ["카페인", radio("caffeineUsed") === "yes" ? `${$("caffeineMg").value || "미입력"} mg` : "없음"],
    ["20:00 전 마지막 카페인", caffGap === null ? "미입력" : `${formatDuration(caffGap)} 전`],
    ["낮잠", `${$("napMinutes").value || 0}분${$("napEnd").value ? ` · ${$("napEnd").value} 종료` : ""}`],
    ["운동", `${$("exerciseMinutes").value || 0}분 · ${radio("exerciseIntensity")}`],
    ["현재 피로도", `${$("fatigue").value}/7`],
    ["Watch 입력", `${$("steps").value || "걸음 미입력"} ${$("steps").value ? "걸음" : ""} · ${$("heartRate").value || "심박 미입력"}${$("heartRate").value ? " bpm" : ""}`],
    ["내일 제약", [$("alarmTime").value && `알람 ${$("alarmTime").value}`, $("firstCommitment").value && `첫 일정 ${$("firstCommitment").value}`].filter(Boolean).join(" · ") || "없음"]
  ];
  $("summary").innerHTML = rows.map(([a,b])=>`<div><span>${a}</span><strong>${b}</strong></div>`).join("");
}

function record() {
  const data = Object.fromEntries(fields.map(id => [id, val(id)]));
  data.caffeineUsed = radio("caffeineUsed");
  data.exerciseIntensity = radio("exerciseIntensity");
  data.savedAt = new Date().toISOString();
  return data;
}
function records() { try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; } }
function save() {
  if (!form.reportValidity()) return;
  const item = record(), all = records();
  const index = all.findIndex(x => x.participant === item.participant && x.date === item.date);
  if (index >= 0) all[index] = item; else all.push(item);
  localStorage.setItem(storageKey, JSON.stringify(all));
  $("status").textContent = `${item.date} 기록을 이 기기에 저장했습니다.`;
  selectedCalendarDate = item.date;
  calendarMonth = new Date(`${item.date}T00:00:00`);
  $("calendarPanel").classList.remove("hidden");
  renderCalendar();
}
function csvEscape(value) { const s = String(value ?? ""); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
function exportCsv() {
  const all = records();
  if (!all.length) { $("status").textContent = "내보낼 저장 기록이 없습니다."; return; }
  const headers = Object.keys(all[0]);
  const csv = [headers.join(","), ...all.map(row => headers.map(h=>csvEscape(row[h])).join(","))].join("\n");
  const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sleep-study-checkins.csv"; a.click(); URL.revokeObjectURL(a.href);
  $("status").textContent = `${all.length}건을 CSV로 내보냈습니다.`;
}
form.addEventListener("submit", e => { e.preventDefault(); save(); });
$("export").addEventListener("click", exportCsv);
$("showCalendar").addEventListener("click", () => {
  $("calendarPanel").classList.remove("hidden");
  renderCalendar();
  $("calendarPanel").scrollIntoView({behavior:"smooth", block:"start"});
});
$("prevMonth").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1, 1); renderCalendar(); });
$("nextMonth").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 1); renderCalendar(); });
form.addEventListener("input", updateSummary);
form.addEventListener("change", e => { if (e.target.name === "caffeineUsed") toggleCaffeine(); else updateSummary(); });
toggleCaffeine(); updateSummary();

function isoDate(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function renderCalendar() {
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
  $("monthTitle").textContent = `${year}년 ${month+1}월 기록`;
  const rows = records(), first = new Date(year, month, 1), lastDay = new Date(year, month+1, 0).getDate();
  let html = Array(first.getDay()).fill('<button class="calendar-day empty" type="button" tabindex="-1"></button>').join("");
  for (let day=1; day<=lastDay; day++) {
    const date = isoDate(new Date(year, month, day));
    const hasAny = rows.some(row => row.date === date);
    const selected = date === selectedCalendarDate;
    html += `<button class="calendar-day${hasAny ? " is-recorded" : ""}${selected ? " is-selected" : ""}${date === today() ? " is-today" : ""}" type="button" data-date="${date}">${day}${hasAny ? " ·" : ""}</button>`;
  }
  $("calendar").innerHTML = html;
  $("calendar").querySelectorAll("[data-date]").forEach(button => button.addEventListener("click", () => { selectedCalendarDate = button.dataset.date; renderCalendar(); }));
  showSelectedDay(selectedCalendarDate, rows);
}
function showSelectedDay(date, rows) {
  const selected = rows.filter(row => row.date === date);
  if (!selected.length) { $("selectedDay").innerHTML = `<strong>${date}</strong>에는 저장된 기록이 없습니다.`; return; }
  $("selectedDay").innerHTML = `<strong>${date}</strong> 저장 완료 · ${selected.map(row => `${row.participant} (${row.savedAt ? new Date(row.savedAt).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"}) : ""})`).join(", ")}`;
}
