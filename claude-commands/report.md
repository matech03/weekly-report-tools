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
  ```

  The script sends the `Summary` notes to Google Sheets. If the current
  agent cannot analyze the changes, omit `--performance-file`; the script will
  try a best-effort fallback and leave the field blank if that also fails.

- If the user explicitly asks to `preview`, `xem trước`, `xem truoc`,
  `xem thử`, `xem thu`, or `dry-run`, run:

  ```bash
  python .team-tools/report.py --dry-run --performance-file /path/to/summary.txt
  ```

- If the user provides an ISO week, include it and keep the same submit/preview
  decision:

  ```bash
  python .team-tools/report.py --week YYYY-Www --performance-file /path/to/summary.txt
  ```

- If the user provides an author, including phrases such as `báo cáo tuần của
  dev3`, `report của dev3`, or `weekly report for dev3`, include it and keep
  the same submit/preview decision:

  ```bash
  python .team-tools/report.py --author "Author Name" --performance-file /path/to/summary.txt
  ```

Before running, verify `.team-tools/report.py` exists. If it is missing, explain
that weekly-report-tools has not been installed in this project.

Summary analysis is best-effort. The current agent should do it first. Do
not block the report if the agent cannot analyze the changes, the fallback AI
dependency/API key is unavailable, or the analysis call fails.

The report excludes merge commits. If the selected author/week has no commits,
the script exits without submitting anything; report that result to the user.

Summarize the important command output back to the user.
