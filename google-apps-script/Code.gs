/**
 * Google Apps Script — Weekly Report Receiver
 * 
 * HƯỚNG DẪN SETUP:
 * 1. Mở Google Sheets → Extensions → Apps Script
 * 2. Xoá code mặc định, paste toàn bộ file này vào
 * 3. Đổi SPREADSHEET_ID bên dưới thành ID của sheet bạn
 * 4. Deploy: Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy Web App URL → điền vào SHEETS_WEBHOOK_URL trong .env
 */

// ── CẤU HÌNH ────────────────────────────────────────────────
// Lấy từ URL của Google Sheets:
// https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
const SPREADSHEET_ID = "1Ols200WF7hVMxEzZMpJo8kYpQSfjWueW72U1nsa3CGY";
const REPORT_SECRET = ""; // Optional: nếu đặt, payload phải gửi cùng secret.

const SHEET_SUMMARY  = "Summary";   // Sheet tổng hợp theo tuần
const SHEET_COMMITS  = "Commits";   // Sheet chi tiết từng commit
const SHEET_WEEKS    = "Weeks";     // Sheet đối chiếu ISO week với ngày
const SUMMARY_HEADERS = [
  "Week", "Submitted At", "Member", "Repository",
  "Total Commits", "Tasks", "Others", "Summary", "Note"
];
const COMMIT_HEADERS = [
  "Week", "Member", "Repository", "Type", "Commit Date", "Hash", "Commit Message"
];
const WEEK_HEADERS = [
  "Week", "Start Date", "End Date", "Date Range"
];
const HEADER_BG = "#1F2937";
const HEADER_TEXT = "#FFFFFF";
const BORDER = "#E5E7EB";
const TASK_BG = "#ECFDF5";
const BUG_BG = "#FEF2F2";
const UPDATE_BG = "#EFF6FF";
const OTHER_BG = "#F9FAFB";
const EVEN_ROW_BG = "#F9FAFB";
const WHITE = "#FFFFFF";
// ─────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (REPORT_SECRET && data.secret !== REPORT_SECRET) {
      throw new Error("Unauthorized");
    }
    
    ensureSheetsExist();
    const weekRow = writeWeekRow(data);
    const summaryRow = writeSummaryRow(data);
    const commitRows = writeCommitRows(data);
    formatChangedRows(summaryRow, commitRows, weekRow);

    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "ok", 
        message: `Recorded ${data.commits.length} commits for ${data.author}` 
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Cho phép test thủ công bằng GET
function doGet(e) {
  return ContentService
    .createTextOutput("Weekly Report webhook is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function ensureSheetsExist() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.setSpreadsheetLocale("en_US");

  if (!ss.getSheetByName(SHEET_SUMMARY)) {
    const s = ss.insertSheet(SHEET_SUMMARY);
    s.setFrozenRows(1);
  }
  const summary = ss.getSheetByName(SHEET_SUMMARY);
  migrateSummarySheet(summary);
  ensureColumnCount(summary, SUMMARY_HEADERS.length);
  summary.getRange(1, 1, 1, SUMMARY_HEADERS.length).setValues([SUMMARY_HEADERS]);

  if (!ss.getSheetByName(SHEET_COMMITS)) {
    const s = ss.insertSheet(SHEET_COMMITS);
    s.setFrozenRows(1);
  }
  const commits = ss.getSheetByName(SHEET_COMMITS);
  ensureColumnCount(commits, COMMIT_HEADERS.length);
  commits.getRange(1, 1, 1, COMMIT_HEADERS.length).setValues([COMMIT_HEADERS]);

  if (!ss.getSheetByName(SHEET_WEEKS)) {
    const s = ss.insertSheet(SHEET_WEEKS);
    s.setFrozenRows(1);
  }
  const weeks = ss.getSheetByName(SHEET_WEEKS);
  ensureColumnCount(weeks, WEEK_HEADERS.length);
  weeks.getRange(1, 1, 1, WEEK_HEADERS.length).setValues([WEEK_HEADERS]);
}

function migrateSummarySheet(sheet) {
  const headerColCount = Math.max(sheet.getLastColumn(), SUMMARY_HEADERS.length);
  const headers = sheet.getRange(1, 1, 1, headerColCount).getValues()[0];
  const hasOldCountColumns = headers[6] === "Bugs" && headers[7] === "Updates";
  if (!hasOldCountColumns && sheet.getMaxColumns() <= SUMMARY_HEADERS.length) return;

  const values = sheet.getDataRange().getValues();
  if (!values.length) return;

  const rows = values.map((row, index) => {
    if (index === 0) return SUMMARY_HEADERS;

    if (hasOldCountColumns) {
      const bugs = Number(row[6]) || 0;
      const updates = Number(row[7]) || 0;
      const oldOther = Number(row[8]) || 0;
      return [
        row[0] || "", row[1] || "", row[2] || "", row[3] || "",
        row[4] || 0, row[5] || 0, bugs + updates + oldOther,
        row[9] || "", row[10] || ""
      ];
    }

    return [
      row[0] || "", row[1] || "", row[2] || "", row[3] || "",
      row[4] || 0, row[5] || 0, row[6] || 0,
      row[7] || "", row[8] || ""
    ];
  });

  sheet.clearContents();
  ensureColumnCount(sheet, SUMMARY_HEADERS.length);
  sheet.getRange(1, 1, rows.length, SUMMARY_HEADERS.length).setValues(rows);

  const extraColumns = sheet.getMaxColumns() - SUMMARY_HEADERS.length;
  if (extraColumns > 0) {
    sheet.deleteColumns(SUMMARY_HEADERS.length + 1, extraColumns);
  }
}

function ensureColumnCount(sheet, count) {
  const missing = count - sheet.getMaxColumns();
  if (missing > 0) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), missing);
  }
}

function writeWeekRow(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_WEEKS);
  const values = sheet.getDataRange().getValues();
  const row = [
    data.week,
    data.week_start || "",
    data.week_end || "",
    data.week_range || ""
  ];

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.week) {
      const rowNumber = i + 1;
      sheet.getRange(rowNumber, 1, 1, WEEK_HEADERS.length).setValues([row]);
      return rowNumber;
    }
  }

  const rowNumber = sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, WEEK_HEADERS.length).setValues([row]);
  return rowNumber;
}

function buildSummaryNote(data) {
  const fallback = data.summary_note || data.performance || "";
  return parseStructuredReportPrompt(data.report_prompt) ||
    parseStructuredReportPrompt(fallback) || fallback;
}

function parseStructuredReportPrompt(text) {
  if (!text) return "";

  const lines = String(text)
    .split(/\r?\n/)
    .map(cleanPromptLine)
    .filter(Boolean);

  if (lines.length < 3 || !isReportCommand(lines[0])) return "";

  const issues = splitSemicolonItems(stripPromptSectionLabel(lines[1]));
  const plans = splitSemicolonItems(stripPromptSectionLabel(lines[2]));
  if (!issues.length && !plans.length) return "";

  const formatted = [];
  if (issues.length) {
    formatted.push("Vấn đề:");
    issues.forEach(item => formatted.push(`- ${item}`));
  }
  if (plans.length) {
    if (formatted.length) formatted.push("");
    formatted.push("Plan tuần tới:");
    plans.forEach(item => formatted.push(`- ${item}`));
  }
  return formatted.join("\n");
}

function cleanPromptLine(line) {
  return String(line || "")
    .trim()
    .replace(/^[-*•\d.\s)]+/, "")
    .trim();
}

function stripPromptSectionLabel(line) {
  return String(line || "")
    .replace(/^(vấn đề|van de|plan tuần tới|plan tuan toi)\s*[:：-]\s*/i, "")
    .trim();
}

function splitSemicolonItems(line) {
  return String(line || "")
    .split(";")
    .map(cleanPromptLine)
    .filter(Boolean);
}

function isReportCommand(line) {
  const command = cleanPromptLine(line).toLowerCase();
  return command.startsWith("/report") ||
    command.includes("report") ||
    command.includes("báo cáo") ||
    command.includes("bao cao") ||
    command.startsWith("bc tuần") ||
    command.startsWith("bc tuan") ||
    command.startsWith("bct") ||
    command.includes("weekly");
}

function writeSummaryRow(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SUMMARY);
  const otherCount = Number(data.summary.other || 0) +
    Number(data.summary.bug || 0) + Number(data.summary.update || 0);
  const summaryNote = buildSummaryNote(data);
  const noteProvided = Object.prototype.hasOwnProperty.call(data, "note");
  const incomingNote = noteProvided ? (data.note || "") : "";

  // Kiểm tra nếu đã có row của tuần+author này thì update
  const values = sheet.getDataRange().getValues();
  const row = [
    data.week, data.submitted_at, data.author, data.repo,
    data.summary.total, data.summary.task, otherCount,
    summaryNote, incomingNote
  ];

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.week && values[i][2] === data.author && values[i][3] === data.repo) {
      const rowNumber = i + 1;
      row[8] = noteProvided ? incomingNote : (values[i][8] || "");
      sheet.getRange(rowNumber, 1, 1, SUMMARY_HEADERS.length).setValues([row]);
      return rowNumber;
    }
  }

  const rowNumber = sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, SUMMARY_HEADERS.length).setValues([row]);
  return rowNumber;
}

function writeCommitRows(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_COMMITS);
  const values = sheet.getDataRange().getValues();
  const keptRows = values.slice(1)
    .filter(row => !(row[0] === data.week && row[1] === data.author && row[2] === data.repo))
    .map(row => row.slice(0, COMMIT_HEADERS.length));
  const newRows = (data.commits || []).map(commit => {
    const typeLabel = commit.type === "TASK"   ? "TASK" :
                      commit.type === "BUG"    ? "BUG" :
                      commit.type === "UPDATE" ? "UPDATE" : "OTHER";
    return [
      data.week, data.author, data.repo,
      typeLabel, commit.date, commit.hash, commit.message
    ];
  });
  const bodyRows = keptRows.concat(newRows);
  const previousBodyRows = Math.max(sheet.getLastRow() - 1, 0);

  sheet.getRange(1, 1, 1, COMMIT_HEADERS.length).setValues([COMMIT_HEADERS]);
  if (previousBodyRows > 0) {
    sheet.getRange(2, 1, previousBodyRows, COMMIT_HEADERS.length).clearContent();
  }
  if (bodyRows.length) {
    sheet.getRange(2, 1, bodyRows.length, COMMIT_HEADERS.length).setValues(bodyRows);
  }

  return {
    startRow: 2 + keptRows.length,
    rowCount: newRows.length,
    totalRows: bodyRows.length + 1
  };
}

function formatChangedRows(summaryRow, commitRows, weekRow) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.setSpreadsheetLocale("en_US");

  const summary = ss.getSheetByName(SHEET_SUMMARY);
  prepareSummaryLayout(summary);
  formatHeader(summary, SUMMARY_HEADERS.length);
  if (summaryRow > 1) {
    formatSummaryRows(summary, summaryRow, 1);
  }
  applyFilter(summary, SUMMARY_HEADERS.length);

  const commits = ss.getSheetByName(SHEET_COMMITS);
  prepareCommitLayout(commits);
  formatHeader(commits, COMMIT_HEADERS.length);
  if (commitRows && commitRows.rowCount > 0) {
    formatCommitRows(commits, commitRows.startRow, commitRows.rowCount);
  }
  applyFilter(commits, COMMIT_HEADERS.length);

  const weeks = ss.getSheetByName(SHEET_WEEKS);
  prepareWeekLayout(weeks);
  formatHeader(weeks, WEEK_HEADERS.length);
  if (weekRow > 1) {
    formatWeekRows(weeks, weekRow, 1);
  }
  applyFilter(weeks, WEEK_HEADERS.length);
}

function prepareSummaryLayout(sheet) {
  if (!sheet) return;
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 1, 150);
  sheet.setColumnWidths(2, 1, 160);
  sheet.setColumnWidths(3, 1, 180);
  sheet.setColumnWidths(4, 1, 180);
  sheet.setColumnWidths(5, 1, 130);
  sheet.setColumnWidths(6, 2, 90);
  sheet.setColumnWidths(8, 1, 520);
  sheet.setColumnWidths(9, 1, 360);
  sheet.setRowHeight(1, 38);
}

function prepareCommitLayout(sheet) {
  if (!sheet) return;
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 1, 150);
  sheet.setColumnWidths(2, 1, 180);
  sheet.setColumnWidths(3, 1, 180);
  sheet.setColumnWidths(4, 1, 90);
  sheet.setColumnWidths(5, 1, 150);
  sheet.setColumnWidths(6, 1, 90);
  sheet.setColumnWidths(7, 1, 560);
  sheet.setRowHeight(1, 38);
}

function prepareWeekLayout(sheet) {
  if (!sheet) return;
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 1, 120);
  sheet.setColumnWidths(2, 2, 130);
  sheet.setColumnWidths(4, 1, 180);
  sheet.setRowHeight(1, 38);
}

function formatSummaryRows(sheet, startRow, rowCount) {
  if (!sheet || rowCount <= 0) return;
  const lastCol = SUMMARY_HEADERS.length;
  const range = sheet.getRange(startRow, 1, rowCount, lastCol);
  range
    .setFontFamily("Arial")
    .setFontSize(10)
    .setFontColor("#111827")
    .setVerticalAlignment("middle")
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  range.setBackgrounds(buildAlternatingBackgrounds(startRow, rowCount, lastCol));
  sheet.setRowHeights(startRow, rowCount, 32);
  sheet.getRange(startRow, 5, rowCount, 3).setHorizontalAlignment("center");
  sheet.getRange(startRow, 8, rowCount, 2).setHorizontalAlignment("left");
}

function formatWeekRows(sheet, startRow, rowCount) {
  if (!sheet || rowCount <= 0) return;
  const lastCol = WEEK_HEADERS.length;
  const range = sheet.getRange(startRow, 1, rowCount, lastCol);
  range
    .setFontFamily("Arial")
    .setFontSize(10)
    .setFontColor("#111827")
    .setVerticalAlignment("middle")
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  range.setBackgrounds(buildAlternatingBackgrounds(startRow, rowCount, lastCol));
  sheet.setRowHeights(startRow, rowCount, 32);
  sheet.getRange(startRow, 1, rowCount, 3).setHorizontalAlignment("center");
}

function formatCommitRows(sheet, startRow, rowCount) {
  if (!sheet || rowCount <= 0) return;
  const lastCol = COMMIT_HEADERS.length;
  const range = sheet.getRange(startRow, 1, rowCount, lastCol);
  range
    .setFontFamily("Arial")
    .setFontSize(10)
    .setFontColor("#111827")
    .setVerticalAlignment("top")
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(startRow, 4, rowCount, 1).setHorizontalAlignment("center").setFontWeight("bold");
  sheet.getRange(startRow, 6, rowCount, 1).setFontFamily("Courier New").setHorizontalAlignment("center");
  sheet.getRange(startRow, 7, rowCount, 1).setHorizontalAlignment("left");
  applyCommitTypeColors(sheet, startRow, rowCount, lastCol);
}

function buildAlternatingBackgrounds(startRow, rowCount, colCount) {
  const backgrounds = [];
  for (let i = 0; i < rowCount; i++) {
    const row = startRow + i;
    backgrounds.push(Array(colCount).fill(row % 2 === 0 ? EVEN_ROW_BG : WHITE));
  }
  return backgrounds;
}

function formatWorkbook() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.setSpreadsheetLocale("en_US");
  formatSummarySheet(ss.getSheetByName(SHEET_SUMMARY));
  formatCommitSheet(ss.getSheetByName(SHEET_COMMITS));
  formatWeekSheet(ss.getSheetByName(SHEET_WEEKS));
}

function formatSummarySheet(sheet) {
  if (!sheet) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = SUMMARY_HEADERS.length;
  prepareSummaryLayout(sheet);
  formatHeader(sheet, lastCol);
  if (lastRow > 1) {
    formatSummaryRows(sheet, 2, lastRow - 1);
  }
  applyFilter(sheet, lastCol);
}

function formatWeekSheet(sheet) {
  if (!sheet) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = WEEK_HEADERS.length;
  prepareWeekLayout(sheet);
  formatHeader(sheet, lastCol);
  if (lastRow > 1) {
    formatWeekRows(sheet, 2, lastRow - 1);
  }
  applyFilter(sheet, lastCol);
}

function formatCommitSheet(sheet) {
  if (!sheet) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = COMMIT_HEADERS.length;
  prepareCommitLayout(sheet);
  formatHeader(sheet, lastCol);
  if (lastRow > 1) {
    formatCommitRows(sheet, 2, lastRow - 1);
  }
  applyFilter(sheet, lastCol);
}

function formatHeader(sheet, lastCol) {
  sheet.getRange(1, 1, 1, lastCol)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setFontWeight("bold")
    .setFontColor(HEADER_TEXT)
    .setBackground(HEADER_BG)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setBorder(true, true, true, true, true, true, HEADER_BG, SpreadsheetApp.BorderStyle.SOLID);
}

function applyCommitTypeColors(sheet, startRow, rowCount, lastCol) {
  const types = sheet.getRange(startRow, 4, rowCount, 1).getValues();
  const backgrounds = types.map((row, index) => {
    const rowNumber = startRow + index;
    const type = row[0];
    const bg = type === "BUG" ? BUG_BG :
               type === "TASK" ? TASK_BG :
               type === "UPDATE" ? UPDATE_BG :
               rowNumber % 2 === 0 ? OTHER_BG : WHITE;
    return Array(lastCol).fill(bg);
  });
  sheet.getRange(startRow, 1, rowCount, lastCol).setBackgrounds(backgrounds);
  sheet.setRowHeights(startRow, rowCount, 42);
}

function applyFilter(sheet, lastCol) {
  if (sheet.getFilter()) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, 1, lastRow, lastCol).createFilter();
}
