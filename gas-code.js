// ========================================
// 古文単語315 SRS - GASコード v1.0
// 作成日時: 2026-03-26T22:00:00+09:00
// ベース: シス単SRS v5.1 GASコード（12列モデル）
// ========================================
// 定数3箇所のみ変更:
//   SPREADSHEET_ID → デプロイ時に自分のIDに置き換え
//   SHEET_NAME_DATA → KB_SRS_Data
//   SHEET_NAME_META → KB_SRS_Meta
// ========================================
// テスト関数 T-G01〜T-G11 を末尾に実装
// GASエディタから個別実行可能
// ========================================

// ========================================
// 定数定義
// ========================================

// スプレッドシートID（★デプロイ時に自分のIDに置き換えてください）
var SPREADSHEET_ID = "1DhD8My6gcJCxPtEecaWIXBxfgfNAvthjTEcjMBUfu9s";

// シート名（★古文単語315用。他教材と重複不可）
var SHEET_NAME_DATA = "KB_SRS_Data";
var SHEET_NAME_META = "KB_SRS_Meta";

// 列インデックス（0始まり）— シス単タイプ12列モデル
var COL = {
  ID: 0,           // A列: 語番号（数値）
  PHRASE: 1,       // B列: 古語（見出し語）
  MEANING: 2,      // C列: 現代語訳
  REPETITIONS: 3,  // D列: 復習回数
  INTERVAL: 4,     // E列: 復習間隔（日数）
  EASE_FACTOR: 5,  // F列: 難易度係数
  NEXT_REVIEW: 6,  // G列: 次回復習日
  LAST_REVIEW: 7,  // H列: 最終復習日
  LAST_QUALITY: 8, // I列: 最後の判定
  GRADUATED: 9,    // J列: 卒業フラグ
  CREATED: 10,     // K列: 作成日
  RESERVED: 11     // L列: 予備
};

// データ範囲
var DATA_START_ROW = 2;
var DATA_MAX_ROWS = 10000;
var DATA_COLS = 12;  // ★シス単タイプ: 12列

// ヘッダー行の内容
var HEADER_ROW = [
  "id", "phrase", "meaning",
  "repetitions", "interval", "easeFactor",
  "nextReviewDate", "lastReviewDate", "lastQuality",
  "graduated", "createdDate", "reserved"
];

// ========================================
// ヘルパー関数
// ========================================

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getDataSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_DATA);
    sheet.getRange(1, 1, 1, DATA_COLS).setValues([HEADER_ROW]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getMetaSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_META);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_META);
    sheet.getRange("A1").setValue(Date.now());
    sheet.getRange("B1").setValue("");
    sheet.getRange("C1").setValue("");
  }
  return sheet;
}

function getTimestamp() {
  var metaSheet = getMetaSheet();
  var ts = metaSheet.getRange("A1").getValue();
  return ts || Date.now();
}

function setTimestamp(timestamp) {
  var metaSheet = getMetaSheet();
  metaSheet.getRange("A1").setValue(timestamp);
}

function setLastRequestId(requestId) {
  var metaSheet = getMetaSheet();
  metaSheet.getRange("B1").setValue(requestId || "");
}

function saveSettings(settings) {
  if (!settings) return;
  var metaSheet = getMetaSheet();
  var toSave = {
    dailyLimit: settings.dailyLimit || 50,
    graduationDays: settings.graduationDays || 30
  };
  metaSheet.getRange("C1").setValue(JSON.stringify(toSave));
}

function loadSettings() {
  var metaSheet = getMetaSheet();
  var raw = metaSheet.getRange("C1").getValue();
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  return { dailyLimit: 50, graduationDays: 30 };
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// データ変換関数（12列モデル）
// ========================================

function wordToRow(word) {
  return [
    Number(word.id) || 0,                               // A: id（数値）
    word.phrase || "",                                    // B: phrase（古語）
    word.meaning || "",                                   // C: meaning（現代語訳）
    word.repetitions || 0,                               // D: repetitions
    word.interval || 0,                                  // E: interval
    Number(word.easeFactor) || 2.5,                      // F: easeFactor
    formatDate(word.nextReviewDate) || "",                // G: nextReviewDate
    formatDate(word.lastReviewDate) || "",                // H: lastReviewDate
    word.lastQuality || "",                              // I: lastQuality
    word.graduated ? 1 : 0,                              // J: graduated
    formatDate(word.createdDate) || "",                   // K: createdDate
    ""                                                   // L: 予備
  ];
}

function rowToWord(row) {
  return {
    id: Number(row[COL.ID]) || 0,
    phrase: row[COL.PHRASE] || "",
    meaning: row[COL.MEANING] || "",
    repetitions: row[COL.REPETITIONS] || 0,
    interval: row[COL.INTERVAL] || 0,
    easeFactor: Number(row[COL.EASE_FACTOR]) || 2.5,
    nextReviewDate: parseDate(row[COL.NEXT_REVIEW]) || "",
    lastReviewDate: parseDate(row[COL.LAST_REVIEW]) || "",
    lastQuality: row[COL.LAST_QUALITY] || "",
    graduated: row[COL.GRADUATED] == 1,
    createdDate: parseDate(row[COL.CREATED]) || ""
  };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  dateStr = String(dateStr);
  if (/^\d{8}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.replace(/-/g, "");
  return "";
}

function parseDate(dateStr) {
  if (!dateStr) return "";
  dateStr = String(dateStr);
  if (/^\d{8}$/.test(dateStr)) {
    return dateStr.substring(0, 4) + "-" + dateStr.substring(4, 6) + "-" + dateStr.substring(6, 8);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return "";
}

// ========================================
// doGet / doPost
// ========================================

function doGet(e) {
  try {
    var sheet = getDataSheet();
    var lastRow = sheet.getLastRow();
    var numRows = Math.max(1, lastRow - 1);
    var range = sheet.getRange(DATA_START_ROW, 1, numRows, DATA_COLS);
    var values = range.getValues();
    var words = {};
    values.forEach(function(row) {
      var id = Number(row[COL.ID]);
      if (id > 0) { words[id] = rowToWord(row); }
    });
    var timestamp = getTimestamp();
    var settings = loadSettings();
    if (e && e.parameter && e.parameter.requestId) {
      setLastRequestId(e.parameter.requestId);
    }
    return createJsonResponse({ status: "ok", data: { words: words, settings: settings }, timestamp: timestamp });
  } catch (error) {
    return createJsonResponse({ status: "error", error: error.toString(), stack: error.stack });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = getDataSheet();
    var wordsData = (body.data && body.data.words) ? body.data.words : body.words;
    var settingsData = (body.data && body.data.settings) ? body.data.settings : body.settings;
    if (!wordsData || typeof wordsData !== "object") {
      return createJsonResponse({ status: "error", message: "wordsデータが見つかりません。" });
    }
    var currentTimestamp = getTimestamp();
    if (body.timestamp && body.timestamp < currentTimestamp) {
      return createJsonResponse({ status: "conflict", message: "別の端末で更新があります", currentTimestamp: currentTimestamp });
    }
    // 数値IDで昇順ソート
    var rows = [];
    var ids = Object.keys(wordsData).sort(function(a, b) { return Number(a) - Number(b); });
    ids.forEach(function(id) { rows.push(wordToRow(wordsData[id])); });
    if (rows.length > 0) {
      sheet.getRange(DATA_START_ROW, 1, rows.length, DATA_COLS).setValues(rows);
    }
    var lastRow = sheet.getLastRow();
    var newLastDataRow = DATA_START_ROW + rows.length - 1;
    if (lastRow > newLastDataRow) {
      sheet.getRange(newLastDataRow + 1, 1, lastRow - newLastDataRow, DATA_COLS).clearContent();
    }
    if (settingsData) { saveSettings(settingsData); }
    var newTimestamp = Date.now();
    setTimestamp(newTimestamp);
    if (body.requestId) { setLastRequestId(body.requestId); }
    return createJsonResponse({ status: "ok", timestamp: newTimestamp, rowsWritten: rows.length });
  } catch (error) {
    return createJsonResponse({ status: "error", error: error.toString(), stack: error.stack });
  }
}

// ========================================
// テスト関数 T-G01〜T-G11
// ========================================

function _clearDataSheet() {
  var sheet = getDataSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) { sheet.getRange(DATA_START_ROW, 1, lastRow - 1, DATA_COLS).clearContent(); }
}

function _simulatePost(wordsObj, settingsObj) {
  var payload = { timestamp: Date.now(), data: { words: wordsObj, settings: settingsObj || { dailyLimit: 50, graduationDays: 30 } }, requestId: "test_" + Date.now() };
  var e = { postData: { contents: JSON.stringify(payload) } };
  return JSON.parse(doPost(e).getContent());
}

function _simulateGet() {
  return JSON.parse(doGet({}).getContent());
}

function _makeTestWord(id, overrides) {
  var base = { id: Number(id), phrase: "テスト古語" + id, meaning: "テスト訳" + id, repetitions: 0, interval: 1, easeFactor: 2.5, nextReviewDate: "2026-04-01", lastReviewDate: "2026-03-25", lastQuality: "correct", graduated: false, createdDate: "2026-03-25" };
  if (overrides) { var keys = Object.keys(overrides); for (var i = 0; i < keys.length; i++) { base[keys[i]] = overrides[keys[i]]; } }
  return base;
}

function T_G01_testDoGet_empty() { _clearDataSheet(); var res = _simulateGet(); var pass = res.status === "ok" && Object.keys(res.data.words).length === 0; Logger.log("T-G01 testDoGet_empty: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G02_testDoPost_single() { _clearDataSheet(); var word = _makeTestWord(42); _simulatePost({ "42": word }); var res = _simulateGet(); var pass = res.data.words["42"] && res.data.words["42"].id === 42 && res.data.words["42"].phrase === "テスト古語42"; Logger.log("T-G02 testDoPost_single: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G03_testDoPost_overwrite() { _clearDataSheet(); _simulatePost({ "10": _makeTestWord(10), "20": _makeTestWord(20), "30": _makeTestWord(30) }); _simulatePost({ "10": _makeTestWord(10), "20": _makeTestWord(20) }); var res = _simulateGet(); var ids = Object.keys(res.data.words); var pass = ids.length === 2 && !res.data.words["30"]; Logger.log("T-G03 testDoPost_overwrite: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G04_testDoPost_conflict() { _clearDataSheet(); _simulatePost({ "1": _makeTestWord(1) }); var payload = { timestamp: 1, data: { words: { "2": _makeTestWord(2) }, settings: { dailyLimit: 50, graduationDays: 30 } } }; var e = { postData: { contents: JSON.stringify(payload) } }; var result = JSON.parse(doPost(e).getContent()); var pass = result.status === "conflict"; Logger.log("T-G04 testDoPost_conflict: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G05_testSettings_roundtrip() { saveSettings({ dailyLimit: 75, graduationDays: 45 }); var loaded = loadSettings(); var pass = loaded.dailyLimit === 75 && loaded.graduationDays === 45; saveSettings({ dailyLimit: 50, graduationDays: 30 }); Logger.log("T-G05 testSettings_roundtrip: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G06_testWordToRow_cols() { var row = wordToRow(_makeTestWord(42)); var pass = row.length === 12; if (!pass) Logger.log("FAIL: expected 12 cols, got " + row.length); Logger.log("T-G06 testWordToRow_cols: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G07_testRowToWord_roundtrip() { var original = _makeTestWord(42); var row1 = wordToRow(original); var reconstructed = rowToWord(row1); var row2 = wordToRow(reconstructed); var pass = true; for (var i = 0; i < row1.length; i++) { if (String(row1[i]) !== String(row2[i])) { Logger.log("FAIL: col " + i + " mismatch"); pass = false; } } Logger.log("T-G07 testRowToWord_roundtrip: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G08_testDateFormat() { var pass = true; if (parseDate(formatDate("2026-04-01")) !== "2026-04-01") pass = false; if (formatDate(parseDate("20260401")) !== "20260401") pass = false; if (formatDate("") !== "" || parseDate("") !== "") pass = false; Logger.log("T-G08 testDateFormat: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G09_testTimestamp_update() { _clearDataSheet(); var tsBefore = getTimestamp(); Utilities.sleep(50); _simulatePost({ "1": _makeTestWord(1) }); var pass = getTimestamp() > tsBefore; Logger.log("T-G09 testTimestamp_update: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G10_testPhraseAndMeaning() { _clearDataSheet(); var word = _makeTestWord(42, { phrase: "あはれなり", meaning: "しみじみ趣がある" }); _simulatePost({ "42": word }); var res = _simulateGet(); var w = res.data.words["42"]; var pass = w && w.phrase === "あはれなり" && w.meaning === "しみじみ趣がある"; Logger.log("T-G10 testPhraseAndMeaning: " + (pass ? "PASS" : "FAIL")); return pass; }

function T_G11_testNumericId_sort() { _clearDataSheet(); _simulatePost({ "30": _makeTestWord(30), "10": _makeTestWord(10), "20": _makeTestWord(20) }); var sheet = getDataSheet(); var r2 = Number(sheet.getRange(2, 1).getValue()); var r3 = Number(sheet.getRange(3, 1).getValue()); var r4 = Number(sheet.getRange(4, 1).getValue()); var pass = r2 === 10 && r3 === 20 && r4 === 30; Logger.log("T-G11 testNumericId_sort: " + (pass ? "PASS" : "FAIL")); return pass; }

function runAllTests() {
  Logger.log("========================================");
  Logger.log("古文単語315 SRS GAS テスト実行 - " + new Date().toISOString());
  Logger.log("========================================");
  var results = [];
  results.push({ id: "T-G01", pass: T_G01_testDoGet_empty() });
  results.push({ id: "T-G02", pass: T_G02_testDoPost_single() });
  results.push({ id: "T-G03", pass: T_G03_testDoPost_overwrite() });
  results.push({ id: "T-G04", pass: T_G04_testDoPost_conflict() });
  results.push({ id: "T-G05", pass: T_G05_testSettings_roundtrip() });
  results.push({ id: "T-G06", pass: T_G06_testWordToRow_cols() });
  results.push({ id: "T-G07", pass: T_G07_testRowToWord_roundtrip() });
  results.push({ id: "T-G08", pass: T_G08_testDateFormat() });
  results.push({ id: "T-G09", pass: T_G09_testTimestamp_update() });
  results.push({ id: "T-G10", pass: T_G10_testPhraseAndMeaning() });
  results.push({ id: "T-G11", pass: T_G11_testNumericId_sort() });
  Logger.log("========================================");
  var passCount = 0, failCount = 0;
  for (var i = 0; i < results.length; i++) { Logger.log("  " + results[i].id + ": " + (results[i].pass ? "PASS" : "*** FAIL ***")); if (results[i].pass) passCount++; else failCount++; }
  Logger.log("PASS: " + passCount + " / FAIL: " + failCount + " / TOTAL: " + results.length);
  Logger.log("========================================");
  return failCount === 0;
}

function checkDataStatus() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (sheet) { Logger.log("古文単語315 SRS: " + (sheet.getLastRow() - 1) + "行, ts=" + getTimestamp()); }
  else { Logger.log("シート '" + SHEET_NAME_DATA + "' が見つかりません"); }
}
