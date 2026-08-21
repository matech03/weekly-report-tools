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

The user must provide a 3-line report prompt for AI report submissions:

```text
report
Vấn đề 1; Vấn đề 2
Plan 1; Plan 2
```

- Line 1 is the report command used to map the skill. It may include week,
  author, or preview words, for example `preview report W24 của dev3`.
- Line 2 is `Vấn đề`; multiple issue items are separated by `;` on the same line.
- Line 3 is `Plan tuần tới`; multiple plan items are separated by `;` on the same line.

If the prompt does not have exactly 3 non-empty lines, ask the user to resend it
in the required structure and do not run `report.py`. Save the original valid
3-line prompt to the summary file and pass it to `report.py`. `report.py`/Google
Apps Script will format it as:

```text
Vấn đề:
- ý 1
- ý 2

Plan tuần tới:
- ý 1
- ý 2
```

Before running `report.py`, verify `.team-tools/report.py` exists. If it is
missing, explain that weekly-report-tools has not been installed in this project.

Do not auto-generate replacement summary notes when the 3-line prompt is missing
or invalid. Ask the user for the required prompt instead.

- If the user asks for `report`, `báo cáo tuần`, or `weekly report`, run:

  ```bash
  python .team-tools/report.py --performance-file /path/to/summary.txt
  ```

  Always include the saved 3-line prompt as `--performance-file`. Do not submit
  from an AI prompt that is missing line 2 or line 3.

- If the user explicitly asks to `preview`, `xem trước`, `xem truoc`,
  `xem thử`, `xem thu`, or `dry-run`, run:

  ```bash
  python .team-tools/report.py --dry-run --performance-file /path/to/summary.txt
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

The 3-line prompt structure is required for AI report submissions. If it is
missing or invalid, ask the user to resend the prompt instead of submitting a
blank or generated Summary.

The report excludes merge commits. If the selected author/week has no commits,
the script exits without submitting anything; report that result to the user.

Summarize the important command output back to the user.
