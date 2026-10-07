/** SleepWell 취침 전 설문조사 공용 저장소 */
const SPREADSHEET_ID = '1o2Cu2nkmiyiNo1lsz8VNBrly43EltYo0UmHMKC0Nuds';
const SHEET_NAME = '설문기록';
const PARTICIPANTS = ['신혜지', '정채윤', '최소빈', '한서윤', 'Test'];
const HEADERS = ['recordId', 'participant', 'date', 'caffeineMg', 'lastCaffeine', 'napMinutes', 'napEnd', 'exerciseMinutes', 'exerciseEnd', 'fatigue', 'steps', 'heartRate', 'alarmTime', 'firstCommitment', 'examTomorrow', 'alcohol', 'illness', 'caffeineUsed', 'exerciseIntensity', 'savedAt'];

function doGet(e) {
  const payload = { ok: true, records: statusRecords_() };
  const callback = (e && e.parameter && e.parameter.callback) || '';
  if (callback && !/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) return json_({ ok: false, error: 'invalid_callback' });
  if (callback) return ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  return json_(payload);
}

function doPost(e) {
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) throw new Error('payload가 없습니다.');
    const item = JSON.parse(raw);
    validate_(item);
    upsert_(item);
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`시트 탭을 찾을 수 없습니다: ${SHEET_NAME}`);
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (existing.join('|') !== HEADERS.join('|')) { sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]); sheet.setFrozenRows(1); }
  return sheet;
}

function validate_(item) {
  if (!PARTICIPANTS.includes(item.participant)) throw new Error('허용되지 않은 참여자 코드입니다.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ''))) throw new Error('날짜 형식이 올바르지 않습니다.');
  HEADERS.forEach(key => { if (String(item[key] == null ? '' : item[key]).length > 300) throw new Error(`${key} 값이 너무 깁니다.`); });
}

function upsert_(item) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20_000);
  try {
    const sheet = sheet_();
    const normalized = Object.assign({}, item, { recordId: `${item.participant}-${item.date}`, savedAt: new Date().toISOString() });
    const lastRow = sheet.getLastRow();
    let targetRow = 0;
    if (lastRow > 1) {
      const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      const index = keys.findIndex(row => row[0] === normalized.recordId);
      if (index >= 0) targetRow = index + 2;
    }
    const row = HEADERS.map(key => normalized[key] == null ? '' : normalized[key]);
    if (targetRow) sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([row]); else sheet.appendRow(row);
  } finally { lock.releaseLock(); }
}

function statusRecords_() {
  const sheet = sheet_(), lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const position = Object.fromEntries(HEADERS.map((name, index) => [name, index]));
  return values.filter(row => PARTICIPANTS.includes(row[position.participant]) && /^\d{4}-\d{2}-\d{2}$/.test(String(row[position.date]))).map(row => ({ participant: row[position.participant], date: row[position.date], savedAt: row[position.savedAt] }));
}

function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
