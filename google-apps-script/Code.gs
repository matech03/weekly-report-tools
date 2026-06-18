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
  "Total Commits", "Tasks", "Bugs", "Updates", "Other", "Summary", "Note"
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
    writeWeekRow(data);
    writeSummaryRow(data);
    writeCommitRows(data);
    formatWorkbook();
    
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
      sheet.getRange(i + 1, 1, 1, WEEK_HEADERS.length).setValues([row]);
      return;
    }
  }

  sheet.appendRow(row);
}

function writeSummaryRow(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SUMMARY);
  
  // Kiểm tra nếu đã có row của tuần+author này thì update
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.week && values[i][2] === data.author && values[i][3] === data.repo) {
      const note = values[i][10] !== undefined && values[i][10] !== "" ? values[i][10] :
        (typeof values[i][8] === "string" ? (values[i][9] || "") : "");
      sheet.getRange(i + 1, 1, 1, SUMMARY_HEADERS.length).setValues([[
        data.week, data.submitted_at, data.author, data.repo,
        data.summary.total, data.summary.task, data.summary.bug, data.summary.update || 0, data.summary.other,
        data.summary_note || data.performance || "", note
      ]]);
      return;
    }
  }

  // Thêm row mới
  sheet.appendRow([
    data.week, data.submitted_at, data.author, data.repo,
    data.summary.total, data.summary.task, data.summary.bug, data.summary.update || 0, data.summary.other,
    data.summary_note || data.performance || "", ""
  ]);
  
}

function writeCommitRows(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_COMMITS);
  
  // Xoá các commit cũ của author+repo+week này
  const values = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === data.week && values[i][1] === data.author && values[i][2] === data.repo) {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.forEach(r => sheet.deleteRow(r));
  
  // Ghi lại toàn bộ commits mới
  data.commits.forEach(commit => {
    const typeLabel = commit.type === "TASK"   ? "TASK" :
                      commit.type === "BUG"    ? "BUG" :
                      commit.type === "UPDATE" ? "UPDATE" : "OTHER";
    sheet.appendRow([
      data.week, data.author, data.repo,
      typeLabel, commit.date, commit.hash, commit.message
    ]);
  });
  
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
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 1, 150);
  sheet.setColumnWidths(2, 1, 160);
  sheet.setColumnWidths(3, 1, 180);
  sheet.setColumnWidths(4, 1, 180);
  sheet.setColumnWidths(5, 1, 130);
  sheet.setColumnWidths(6, 4, 90);
  sheet.setColumnWidths(10, 1, 520);
  sheet.setColumnWidths(11, 1, 360);
  sheet.setRowHeight(1, 38);

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = SUMMARY_HEADERS.length;
  formatHeader(sheet, lastCol);

  if (lastRow > 1) {
    const body = sheet.getRange(2, 1, lastRow - 1, lastCol);
    body
      .setFontFamily("Arial")
      .setFontSize(10)
      .setFontColor("#111827")
      .setVerticalAlignment("middle")
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);

    for (let row = 2; row <= lastRow; row++) {
      const bg = row % 2 === 0 ? EVEN_ROW_BG : WHITE;
      sheet.getRange(row, 1, 1, lastCol).setBackground(bg);
      sheet.setRowHeight(row, 32);
    }
    sheet.getRange(2, 5, lastRow - 1, 5).setHorizontalAlignment("center");
    sheet.getRange(2, 10, lastRow - 1, 2).setHorizontalAlignment("left");
  }

  applyFilter(sheet, lastCol);
}

function formatWeekSheet(sheet) {
  if (!sheet) return;
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 1, 120);
  sheet.setColumnWidths(2, 2, 130);
  sheet.setColumnWidths(4, 1, 180);
  sheet.setRowHeight(1, 38);

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = WEEK_HEADERS.length;
  formatHeader(sheet, lastCol);

  if (lastRow > 1) {
    const body = sheet.getRange(2, 1, lastRow - 1, lastCol);
    body
      .setFontFamily("Arial")
      .setFontSize(10)
      .setFontColor("#111827")
      .setVerticalAlignment("middle")
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);

    for (let row = 2; row <= lastRow; row++) {
      const bg = row % 2 === 0 ? EVEN_ROW_BG : WHITE;
      sheet.getRange(row, 1, 1, lastCol).setBackground(bg);
      sheet.setRowHeight(row, 32);
    }
    sheet.getRange(2, 1, lastRow - 1, 3).setHorizontalAlignment("center");
  }

  applyFilter(sheet, lastCol);
}

function formatCommitSheet(sheet) {
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

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = COMMIT_HEADERS.length;
  formatHeader(sheet, lastCol);

  if (lastRow > 1) {
    const body = sheet.getRange(2, 1, lastRow - 1, lastCol);
    body
      .setFontFamily("Arial")
      .setFontSize(10)
      .setFontColor("#111827")
      .setVerticalAlignment("top")
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);

    sheet.getRange(2, 4, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(2, 6, lastRow - 1, 1).setFontFamily("Courier New").setHorizontalAlignment("center");
    sheet.getRange(2, 7, lastRow - 1, 1).setHorizontalAlignment("left");
    applyCommitTypeColors(sheet, lastRow, lastCol);
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

function applyCommitTypeColors(sheet, lastRow, lastCol) {
  const allRows = sheet.getDataRange().getValues();
  for (let i = 1; i < allRows.length; i++) {
    const row = i + 1;
    if (allRows[i][3] === "BUG") {
      sheet.getRange(row, 1, 1, lastCol).setBackground(BUG_BG);
    } else if (allRows[i][3] === "TASK") {
      sheet.getRange(row, 1, 1, lastCol).setBackground(TASK_BG);
    } else if (allRows[i][3] === "UPDATE") {
      sheet.getRange(row, 1, 1, lastCol).setBackground(UPDATE_BG);
    } else {
      const bg = row % 2 === 0 ? OTHER_BG : WHITE;
      sheet.getRange(row, 1, 1, lastCol).setBackground(bg);
    }
    sheet.setRowHeight(row, 42);
  }
}

function applyFilter(sheet, lastCol) {
  const existingFilter = sheet.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }
  const lastRow = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, 1, lastRow, lastCol).createFilter();
}
