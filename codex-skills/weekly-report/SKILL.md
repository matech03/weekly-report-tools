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

## Workflow

1. Confirm the current directory is the target project repository.
2. Check that `.team-tools/report.py` exists.
   - If it does not exist, explain that weekly-report-tools is not installed in
     this project and point to the install command in this repository README.
3. If the user's prompt has multiple lines, treat only the first line as the
   report request, for example `báo cáo tuần`, `report weekly`, or
   `báo cáo tuần W30`. Treat every line from the second line onward as the
   content for the Google Sheets `Note` column.
   - Preserve the note content as user-written; do not summarize, rewrite, or
     merge it into the `Summary` notes.
   - Save the note content to a temporary text file and pass it with
     `--note-file /path/to/note.txt`.
   - If the prompt has only one line, omit `--note-file` so an existing manual
     `Note` value in Google Sheets is preserved on resubmit.
4. Before running the report, inspect the weekly commits and code changes as the
   current agent. Use commands such as:

   ```bash
   git log --author="<author>" --since="<week start>" --until="<week end>" --no-merges --all --stat
   git show --stat --patch <commit>
   ```

   Summarize 2-5 concise Vietnamese notes about what the developer worked on
   in the project. Save the notes to a temporary text file.
   - Use bullet lines starting with `- `.
   - Keep each bullet under 90 characters.
   - Make each bullet easy to scan; avoid paragraphs and long explanations.

5. For a normal report request, submit immediately and pass the agent-generated
   summary notes. Include `--note-file` when the user supplied note content:

   ```bash
   python .team-tools/report.py --performance-file /path/to/summary.txt
   python .team-tools/report.py --performance-file /path/to/summary.txt --note-file /path/to/note.txt
   ```

   The script sends the `Summary` notes to Google Sheets. If the agent
   cannot analyze the changes, omit `--performance-file`; the Summary field
   will be left blank.

6. Only preview when the user explicitly asks with words such as `preview`,
   `xem trước`, `xem truoc`, `xem thử`, `xem thu`, or `dry-run`:

   ```bash
   python .team-tools/report.py --dry-run --performance-file /path/to/summary.txt
   python .team-tools/report.py --dry-run --performance-file /path/to/summary.txt --note-file /path/to/note.txt
   ```

7. If the user specifies a week on the first line, pass it through as ISO week (`YYYY-Www`) or week number (`Www`). Week numbers without a year use the current ISO year:

   ```bash
   python .team-tools/report.py --week YYYY-Www --performance-file /path/to/summary.txt
   python .team-tools/report.py --week YYYY-Www --dry-run --performance-file /path/to/summary.txt
   python .team-tools/report.py --week Www --performance-file /path/to/summary.txt
   python .team-tools/report.py --week Www --dry-run --performance-file /path/to/summary.txt
   ```

8. If the user specifies an author on the first line, pass it through. Treat phrases such as
   `báo cáo tuần của dev3`, `report của dev3`, or `weekly report for dev3` as
   author-specific report requests:

   ```bash
   python .team-tools/report.py --author "Author Name" --performance-file /path/to/summary.txt
   python .team-tools/report.py --author "Author Name" --dry-run --performance-file /path/to/summary.txt
   ```

## Safety

- A plain `report` request means submit to Google Sheets.
- The report excludes merge commits with `--no-merges`.
- If the selected author/week has no commits, the script exits without
  submitting anything; report that result to the user.
- Use `--dry-run` only when the request explicitly asks to preview or view
  before sending.
- User-written note content belongs only in the `Note` column. Do not include it
  in the generated `Summary` column.
- Summary analysis is best-effort. The current agent should do it before
  running `report.py`. Do not block the report if the agent cannot analyze the
  changes; omit `--performance-file` and submit with a blank Summary field.
- If `SHEETS_WEBHOOK_URL` is missing, invalid, or the Apps Script endpoint
  returns an auth/deployment error, summarize the exact error and the next
  configuration step.
- Report the important command output back to the user because command output is
  not visible to them.
