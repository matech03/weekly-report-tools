---
name: weekly-report
description: Use when the user asks for a weekly report with phrases like "report", "bao cao tuan", "báo cáo tuần", "bc tuần", "bct", "weekly report", "nộp báo cáo tuần", "gửi report tuần", or wants to submit or preview a weekly git commit report to Google Sheets using this repository's weekly-report-tools workflow. Default behavior is to submit; preview only when explicitly requested.
---

# Weekly Report

Use this skill to run the weekly commit report workflow for a project that has
weekly-report-tools installed.

## Trigger phrases

Treat these as requests to use this skill:

- `report`
- `report báo cáo tuần`
- `report tuần`
- `report tuan`
- `tạo report`
- `tao report`
- `làm report`
- `lam report`
- `xem trước report`
- `xem truoc report`
- `xem thử report`
- `xem thu report`
- `xem report`
- `preview report`
- `dry-run report`
- `báo cáo tuần`
- `bao cao tuan`
- `báo cáo`
- `bao cao`
- `tạo báo cáo tuần`
- `tao bao cao tuan`
- `làm báo cáo tuần`
- `lam bao cao tuan`
- `xem trước báo cáo tuần`
- `xem truoc bao cao tuan`
- `xem thử báo cáo tuần`
- `xem thu bao cao tuan`
- `xem báo cáo tuần`
- `xem bao cao tuan`
- `báo cáo tuần này`
- `bao cao tuan nay`
- `báo cáo tuần hiện tại`
- `bao cao tuan hien tai`
- `bc tuần`
- `bc tuan`
- `bct`
- `bctuan`
- `weekly`
- `weekly report`
- `create weekly report`
- `generate weekly report`
- `preview weekly report`
- `submit weekly report`
- `nộp báo cáo tuần`
- `nop bao cao tuan`
- `gửi báo cáo tuần`
- `gui bao cao tuan`
- `gửi report tuần`
- `gui report tuan`
- `submit report`

## Required prompt structure

AI report submissions must use exactly 3 non-empty prompt lines:

```text
report
Vấn đề 1; Vấn đề 2
Plan 1; Plan 2
```

Meaning:

1. Line 1 is the report command used to map this skill. It can also contain week,
   author, or preview words, for example `preview report W24 của dev3`.
2. Line 2 is `Vấn đề`. If there are multiple issue items, separate them with
   semicolons (`;`) on this line.
3. Line 3 is `Plan tuần tới`. If there are multiple plan items, separate them
   with semicolons (`;`) on this line.

If the prompt is missing line 2 or line 3, has more than 3 non-empty lines, or has
an empty issue/plan line, ask the user to resend the prompt in the required
structure and do not run `report.py`.

Save the original valid 3-line prompt to the summary/performance temporary file.
`report.py` and Google Apps Script will parse it into:

```text
Vấn đề:
- ý 1
- ý 2

Plan tuần tới:
- ý 1
- ý 2
```

## Workflow

1. Confirm the current directory is the target project repository.
2. Check that `.team-tools/report.py` exists.
   - If it does not exist, explain that weekly-report-tools is not installed in
     this project and point to the install command in this repository README.
3. Validate that the user supplied exactly the 3-line prompt structure above.
   - If valid, save the original 3-line prompt to a temporary text file and pass
     it with `--performance-file` so it becomes the formatted `Summary` value.
   - If invalid, ask the user to resend the 3-line prompt and stop.
4. For a normal report request, submit immediately and pass the prompt file:

   ```bash
   python .team-tools/report.py --performance-file /path/to/summary.txt
   ```

5. Only preview when the user explicitly asks with words such as `preview`,
   `xem trước`, `xem truoc`, `xem thử`, `xem thu`, or `dry-run`:

   ```bash
   python .team-tools/report.py --dry-run --performance-file /path/to/summary.txt
   ```

6. If the user specifies a week on the first line, pass it through as ISO week (`YYYY-Www`) or week number (`Www`). Week numbers without a year use the current ISO year:

   ```bash
   python .team-tools/report.py --week YYYY-Www --performance-file /path/to/summary.txt
   python .team-tools/report.py --week YYYY-Www --dry-run --performance-file /path/to/summary.txt
   python .team-tools/report.py --week Www --performance-file /path/to/summary.txt
   python .team-tools/report.py --week Www --dry-run --performance-file /path/to/summary.txt
   ```

7. If the user specifies an author on the first line, pass it through. Treat phrases such as
   `báo cáo tuần của dev3`, `report của dev3`, or `weekly report for dev3` as
   author-specific report requests:

   ```bash
   python .team-tools/report.py --author "Author Name" --performance-file /path/to/summary.txt
   python .team-tools/report.py --author "Author Name" --dry-run --performance-file /path/to/summary.txt
   ```

## Safety

- A plain `report` request still requires the 3-line prompt structure before
  submitting to Google Sheets.
- The report excludes merge commits with `--no-merges`.
- If the selected author/week has no commits, the script exits without
  submitting anything; report that result to the user.
- Use `--dry-run` only when the request explicitly asks to preview or view
  before sending.
- Do not auto-generate replacement summary notes when the required 3-line prompt
  is missing or invalid.
- If `SHEETS_WEBHOOK_URL` is missing, invalid, or the Apps Script endpoint
  returns an auth/deployment error, summarize the exact error and the next
  configuration step.
- Report the important command output back to the user because command output is
  not visible to them.
