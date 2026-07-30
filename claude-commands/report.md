# Weekly Report

Run the weekly-report-tools workflow for this project.

Treat these as weekly report requests: `report`, `report báo cáo tuần`,
`report tuần`, `báo cáo tuần`, `bao cao tuan`, `báo cáo`, `bao cao`,
`bc tuần`, `bc tuan`, `bct`, `bctuan`, `weekly`, `weekly report`,
`create weekly report`, `generate weekly report`, `preview weekly report`,
`tạo báo cáo tuần`, `tao bao cao tuan`, `làm báo cáo tuần`,
`lam bao cao tuan`, `xem trước báo cáo tuần`, `xem truoc bao cao tuan`,
`xem thử báo cáo tuần`, `xem thu bao cao tuan`, `xem báo cáo tuần`,
`xem bao cao tuan`.

Use the command arguments to decide whether this is a submission or preview.
Default to submission.

If the user prompt has multiple lines, treat the first line as the report
request, for example `báo cáo tuần`, `report weekly`, or `báo cáo tuần W30`.
Treat every line from the second line onward as the Google Sheets `Note` column
content. Preserve that note exactly as user-written, save it to a temporary
text file, and pass it with `--note-file /path/to/note.txt`. Do not merge this
user note into the generated `Summary` notes.

Before running `report.py`, inspect the weekly commits and code changes as the
current agent. Use `git log --no-merges --stat` and
`git show --stat --patch <commit>` for the selected author/week. Summarize 2-5
concise Vietnamese notes about what the developer worked on in the project and
save them to a temporary text file.
Use bullet lines starting with `- `, keep each bullet under 90 characters, and
avoid paragraphs or long explanations.

- If the user asks for `report`, `báo cáo tuần`, or `weekly report`, run:

  ```bash
  python .team-tools/report.py --performance-file /path/to/summary.txt
  python .team-tools/report.py --performance-file /path/to/summary.txt --note-file /path/to/note.txt
  ```

  The script sends the `Summary` notes to Google Sheets. If the current
  agent cannot analyze the changes, omit `--performance-file`; the Summary
  field will be left blank.

- If the user explicitly asks to `preview`, `xem trước`, `xem truoc`,
  `xem thử`, `xem thu`, or `dry-run`, run:

  ```bash
  python .team-tools/report.py --dry-run --performance-file /path/to/summary.txt
  python .team-tools/report.py --dry-run --performance-file /path/to/summary.txt --note-file /path/to/note.txt
  ```

- If the user provides an ISO week (`YYYY-Www`) or a week number (`Www`), include it and keep the same submit/preview
  decision. Week numbers without a year use the current ISO year:

  ```bash
  python .team-tools/report.py --week YYYY-Www --performance-file /path/to/summary.txt
  python .team-tools/report.py --week Www --performance-file /path/to/summary.txt
  ```

- If the user provides an author, including phrases such as `báo cáo tuần của
  dev3`, `report của dev3`, or `weekly report for dev3`, include it and keep
  the same submit/preview decision:

  ```bash
  python .team-tools/report.py --author "Author Name" --performance-file /path/to/summary.txt
  ```

Before running, verify `.team-tools/report.py` exists. If it is missing, explain
that weekly-report-tools has not been installed in this project.

Summary analysis is best-effort. The current agent should do it before running
`report.py`. Do not block the report if the agent cannot analyze the changes;
omit `--performance-file` and submit with a blank Summary field. User-written
note content belongs only in the `Note` column.

The report excludes merge commits. If the selected author/week has no commits,
the script exits without submitting anything; report that result to the user.

Summarize the important command output back to the user.
