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

## Prompt structure

The user may provide a 3-line report prompt for the Google Sheets `Summary` column:

```text
report
Vấn đề 1; Vấn đề 2
Plan 1; Plan 2
```

- Line 1 is the report command used to map the skill. It may include week,
  author, or preview words, for example `preview report W24 của dev3`.
- Line 2 is `Vấn đề`; multiple issue items are separated by `;` on the same line.
- Line 3 is `Plan tuần tới`; multiple plan items are separated by `;` on the same line.

If line 2 and line 3 are present, save the original 3-line prompt to the summary
file and pass it to `report.py`. `report.py`/Google Apps Script will format it as:

```text
Vấn đề:
- ý 1
- ý 2

Plan tuần tới:
- ý 1
- ý 2
```

User-provided issue/plan lines take priority over agent-generated summary notes.
If the prompt has multiple lines but does not match the 3-line summary structure,
treat the first line as the report request and every line from the second line
onward as the Google Sheets `Note` column content. Preserve that note exactly as
user-written, save it to a temporary text file, and pass it with
`--note-file /path/to/note.txt`. Do not merge this user note into the generated
`Summary` notes.

Before running `report.py`, verify `.team-tools/report.py` exists. If it is
missing, explain that weekly-report-tools has not been installed in this project.

If the user did not supply the 3-line prompt structure, inspect the weekly
commits and code changes as the current agent. Use `git log --no-merges --stat`
and `git show --stat --patch <commit>` for the selected author/week. Summarize
2-5 concise Vietnamese notes about what the developer worked on in the project
and save them to a temporary text file.
Use bullet lines starting with `- `, keep each bullet under 90 characters, and
avoid paragraphs or long explanations.

- If the user asks for `report`, `báo cáo tuần`, or `weekly report`, run:

  ```bash
  python .team-tools/report.py --performance-file /path/to/summary.txt
  python .team-tools/report.py --performance-file /path/to/summary.txt --note-file /path/to/note.txt
  ```

  If neither user-provided issue/plan notes nor agent summary notes are
  available, omit `--performance-file`; the Summary field will be left blank.

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

Summary analysis is best-effort. Do not block the report if the current agent
cannot analyze the changes; omit `--performance-file` and submit with a blank
Summary field. User-written note content belongs only in the `Note` column unless
it matches the 3-line issue/plan summary structure above.

The report excludes merge commits. If the selected author/week has no commits,
the script exits without submitting anything; report that result to the user.

Summarize the important command output back to the user.
