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
const SUMMARY_HEADERS = [
  "Week", "Submitted At", "Member", "Repository",
  "Total Commits", "Tasks", "Bugs", "Other"
];
const COMMIT_HEADERS = [
  "Week", "Member", "Repository", "Type", "Commit Date", "Hash", "Commit Message"
];
// ─────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (REPORT_SECRET && data.secret !== REPORT_SECRET) {
      throw new Error("Unauthorized");
    }
    
    ensureSheetsExist();
    writeSummaryRow(data);
    writeCommitRows(data);
    
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
  
  if (!ss.getSheetByName(SHEET_SUMMARY)) {
    const s = ss.insertSheet(SHEET_SUMMARY);
    s.setFrozenRows(1);
  }
  const summary = ss.getSheetByName(SHEET_SUMMARY);
  summary.getRange(1, 1, 1, SUMMARY_HEADERS.length).setValues([SUMMARY_HEADERS]);
  summary.getRange(1, 1, 1, SUMMARY_HEADERS.length).setFontWeight("bold").setBackground("#4A4FF5").setFontColor("#FFFFFF");
  
  if (!ss.getSheetByName(SHEET_COMMITS)) {
    const s = ss.insertSheet(SHEET_COMMITS);
    s.setFrozenRows(1);
    // Cột message rộng hơn
    s.setColumnWidth(7, 400);
  }
  const commits = ss.getSheetByName(SHEET_COMMITS);
  commits.getRange(1, 1, 1, COMMIT_HEADERS.length).setValues([COMMIT_HEADERS]);
  commits.getRange(1, 1, 1, COMMIT_HEADERS.length).setFontWeight("bold").setBackground("#4A4FF5").setFontColor("#FFFFFF");
  commits.setColumnWidth(7, 400);
}

function writeSummaryRow(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SUMMARY);
  
  // Kiểm tra nếu đã có row của tuần+author này thì update
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.week && values[i][2] === data.author && values[i][3] === data.repo) {
      sheet.getRange(i + 1, 1, 1, 8).setValues([[
        data.week, data.submitted_at, data.author, data.repo,
        data.summary.total, data.summary.task, data.summary.bug, data.summary.other
      ]]);
      return;
    }
  }
  
  // Thêm row mới
  sheet.appendRow([
    data.week, data.submitted_at, data.author, data.repo,
    data.summary.total, data.summary.task, data.summary.bug, data.summary.other
  ]);
  
  // Màu dòng xen kẽ
  const lastRow = sheet.getLastRow();
  if (lastRow % 2 === 0) {
    sheet.getRange(lastRow, 1, 1, 8).setBackground("#F0F0FF");
  }
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
    const typeLabel = commit.type === "TASK" ? "TASK" :
                      commit.type === "BUG"  ? "BUG"  : "OTHER";
    sheet.appendRow([
      data.week, data.author, data.repo,
      typeLabel, commit.date, commit.hash, commit.message
    ]);
  });
  
  // Highlight BUG rows màu đỏ nhạt
  const allRows = sheet.getDataRange().getValues();
  for (let i = 1; i < allRows.length; i++) {
    if (allRows[i][3] === "BUG") {
      sheet.getRange(i + 1, 1, 1, 7).setBackground("#FFF0F0");
    } else if (allRows[i][3] === "TASK") {
      sheet.getRange(i + 1, 1, 1, 7).setBackground("#F0FFF0");
    } else {
      sheet.getRange(i + 1, 1, 1, 7).setBackground("#FFFFFF");
    }
  }
}
