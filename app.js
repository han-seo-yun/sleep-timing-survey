const $ = (id) => document.getElementById(id);
const form = $("survey");
const fields = ["participant","date","caffeineMg","lastCaffeine","napMinutes","napEnd","exerciseMinutes","exerciseEnd","fatigue","steps","heartRate","alarmTime","firstCommitment","examTomorrow","alcohol","illness"];
const storageKey = "sleep-study-checkins-v1";
const sharedEndpoint = String(window.SLEEPWELL_SHARED_ENDPOINT || "").trim();
let sharedRecords = null;
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = today();

function today() { return new Date().toISOString().slice(0,10); }
function isoDate(date) { return date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0"); }
function radio(name) { return form.querySelector('input[name="' + name + '"]:checked')?.value || ""; }
function timeToMinutes(value) { if (!value) return null; const bits = value.split(":").map(Number); return bits[0]*60+bits[1]; }
function formatDuration(mins) { if (mins === null || Number.isNaN(mins)) return "미입력"; const sign = mins < 0 ? "-" : ""; mins = Math.abs(Math.round(mins)); return sign + Math.floor(mins/60) + "시간 " + mins%60 + "분"; }
function val(id) { return $(id).type === "checkbox" ? $(id).checked : $(id).value; }
function localRecords() { try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; } }
function activeRecords() { return sharedRecords || localRecords(); }

$("date").value = today();
function toggleCaffeine() {
  const used = radio("caffeineUsed") === "yes";
  $("caffeineDetails").classList.toggle("hidden", !used);
  if (!used) { $("caffeineMg").value = ""; $("lastCaffeine").value = ""; }
  updateSummary();
}
function updateSummary() {
  $("fatigueValue").textContent = $("fatigue").value;
  const last = timeToMinutes($("lastCaffeine").value), caffGap = last === null ? null : 1200-last;
  const rows = [
    ["카페인", radio("caffeineUsed") === "yes" ? ($("caffeineMg").value || "미입력") + " mg" : "없음"],
    ["20:00 전 마지막 카페인", caffGap === null ? "미입력" : formatDuration(caffGap) + " 전"],
    ["낮잠", ($("napMinutes").value || 0) + "분" + ($("napEnd").value ? " · " + $("napEnd").value + " 종료" : "")],
    ["운동", ($("exerciseMinutes").value || 0) + "분 · " + radio("exerciseIntensity")],
    ["현재 피로도", $("fatigue").value + "/7"],
    ["Watch 입력", ($("steps").value || "걸음 미입력") + ($("steps").value ? " 걸음" : "") + " · " + ($("heartRate").value || "심박 미입력") + ($("heartRate").value ? " bpm" : "")],
    ["내일 제약", [$("alarmTime").value && "알람 " + $("alarmTime").value, $("firstCommitment").value && "첫 일정 " + $("firstCommitment").value].filter(Boolean).join(" · ") || "없음"]
  ];
  $("summary").innerHTML = rows.map(pair => "<div><span>" + pair[0] + "</span><strong>" + pair[1] + "</strong></div>").join("");
}
function record() {
  const data = Object.fromEntries(fields.map(id => [id, val(id)]));
  data.caffeineUsed = radio("caffeineUsed");
  data.exerciseIntensity = radio("exerciseIntensity");
  data.savedAt = new Date().toISOString();
  return data;
}
function saveLocal(item) {
  const all = localRecords(), index = all.findIndex(x => x.participant === item.participant && x.date === item.date);
  if (index >= 0) all[index] = item; else all.push(item);
  localStorage.setItem(storageKey, JSON.stringify(all));
}
function postShared(item) {
  if (!sharedEndpoint) return false;
  const iframe = document.createElement("iframe");
  iframe.name = "sleepwell-post-" + Date.now();
  iframe.className = "hidden";
  document.body.appendChild(iframe);
  const post = document.createElement("form");
  post.method = "POST"; post.action = sharedEndpoint; post.target = iframe.name; post.className = "hidden";
  const payload = document.createElement("input");
  payload.name = "payload"; payload.value = JSON.stringify(item); post.appendChild(payload);
  document.body.appendChild(post); post.submit(); post.remove();
  window.setTimeout(() => iframe.remove(), 10000);
  return true;
}
function save() {
  if (!form.reportValidity()) return;
  const item = record();
  saveLocal(item);
  const shared = postShared(item);
  $("status").textContent = shared ? item.date + " 기록을 공용 시트에 저장 요청했습니다. 잠시 후 팀 현황을 갱신합니다." : item.date + " 기록을 이 기기에 저장했습니다.";
  selectedCalendarDate = item.date;
  calendarMonth = new Date(item.date + "T00:00:00");
  $("calendarPanel").classList.remove("hidden");
  renderCalendar();
  if (shared) window.setTimeout(loadSharedStatus, 2500);
}
function loadSharedStatus() {
  if (!sharedEndpoint) {
    $("sharedInfo").textContent = "현재 이 기기의 저장 기록만 표시합니다. 공용 서버 연결 전입니다.";
    renderCalendar();
    return;
  }
  const callback = "sleepwellStatus" + Date.now();
  const script = document.createElement("script");
  const timeout = window.setTimeout(fail, 10000);
  function cleanup() { window.clearTimeout(timeout); delete window[callback]; script.remove(); }
  function fail() { cleanup(); $("sharedInfo").textContent = "공용 기록을 불러오지 못했습니다. 네트워크를 확인해 주세요."; renderCalendar(); }
  window[callback] = (payload) => {
    cleanup();
    if (!payload || !payload.ok || !Array.isArray(payload.records)) { fail(); return; }
    sharedRecords = payload.records;
    $("sharedInfo").textContent = "공용 시트 연결됨 · 팀 전체 " + sharedRecords.length + "건";
    renderCalendar();
  };
  script.onerror = fail;
  script.src = sharedEndpoint + (sharedEndpoint.includes("?") ? "&" : "?") + "action=status&callback=" + callback;
  document.head.appendChild(script);
}
function csvEscape(value) { const s = String(value ?? ""); return /[",\n]/.test(s) ? '"' + s.replaceAll('"','""') + '"' : s; }
function exportCsv() {
  const all = localRecords();
  if (!all.length) { $("status").textContent = "이 기기에서 내보낼 저장 기록이 없습니다."; return; }
  const headers = Object.keys(all[0]);
  const csv = [headers.join(","), ...all.map(row => headers.map(h => csvEscape(row[h])).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sleep-study-checkins.csv"; a.click(); URL.revokeObjectURL(a.href);
  $("status").textContent = all.length + "건을 CSV로 내보냈습니다.";
}
function renderCalendar() {
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
  $("monthTitle").textContent = year + "년 " + (month+1) + "월 팀 기록";
  const rows = activeRecords(), first = new Date(year, month, 1), lastDay = new Date(year, month+1, 0).getDate();
  let html = Array(first.getDay()).fill('<button class="calendar-day empty" type="button" tabindex="-1"></button>').join("");
  for (let day=1; day<=lastDay; day++) {
    const date = isoDate(new Date(year, month, day)), hasAny = rows.some(row => row.date === date), selected = date === selectedCalendarDate;
    html += '<button class="calendar-day' + (hasAny ? " is-recorded" : "") + (selected ? " is-selected" : "") + (date === today() ? " is-today" : "") + '" type="button" data-date="' + date + '">' + day + (hasAny ? " ·" : "") + "</button>";
  }
  $("calendar").innerHTML = html;
  $("calendar").querySelectorAll("[data-date]").forEach(button => button.addEventListener("click", () => { selectedCalendarDate = button.dataset.date; renderCalendar(); }));
  showSelectedDay(selectedCalendarDate, rows);
}
function showSelectedDay(date, rows) {
  const selected = rows.filter(row => row.date === date);
  if (!selected.length) { $("selectedDay").innerHTML = "<strong>" + date + "</strong>에는 저장된 기록이 없습니다."; return; }
  $("selectedDay").innerHTML = "<strong>" + date + "</strong> 저장 완료 · " + selected.map(row => row.participant + (row.savedAt ? " (" + new Date(row.savedAt).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"}) + ")" : "")).join(", ");
}
form.addEventListener("submit", e => { e.preventDefault(); save(); });
$("export").addEventListener("click", exportCsv);
$("showCalendar").addEventListener("click", () => { $("calendarPanel").classList.remove("hidden"); loadSharedStatus(); $("calendarPanel").scrollIntoView({behavior:"smooth", block:"start"}); });
$("prevMonth").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1, 1); renderCalendar(); });
$("nextMonth").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 1); renderCalendar(); });
form.addEventListener("input", updateSummary);
form.addEventListener("change", e => { if (e.target.name === "caffeineUsed") toggleCaffeine(); else updateSummary(); });
toggleCaffeine(); updateSummary(); loadSharedStatus();
