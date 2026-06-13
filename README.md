# git-team-tools

Lightweight commit and weekly reporting tools for a small development team.

The toolkit helps the team keep commit messages consistent, generate commit
message suggestions from staged changes, and submit weekly commit summaries to
Google Sheets.

## Tools

| Tool | Purpose |
|------|---------|
| `scripts/suggest_commit.py` | Uses Anthropic Claude to suggest `TASK:` or `BUG:` commit messages from staged git diff. |
| `hooks/commit-msg` | Git hook that rejects vague or invalid commit messages before they are committed. |
| `scripts/report.py` | Collects weekly commits by author and sends a structured report to Google Sheets. |
| `google-apps-script/Code.gs` | Google Apps Script webhook that receives report data and writes it into Sheets. |

## Repository Structure

```text
git-team-tools/
├── install.sh
├── hooks/
│   └── commit-msg
├── scripts/
│   ├── suggest_commit.py
│   └── report.py
└── google-apps-script/
    └── Code.gs
```

## Requirements

- Git 2.x
- Python 3.7+
- Anthropic Python SDK
- `ANTHROPIC_API_KEY` environment variable
- A deployed Google Apps Script Web App for report submission

Install the Python dependency:

```bash
pip install anthropic
```

Configure Anthropic:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Optional model override:

```bash
export ANTHROPIC_MODEL="claude-sonnet-4-6"
```

## Install Into a Project Repository

Recommended one-file install:

```bash
cd /path/to/your-project
curl -fsSL https://raw.githubusercontent.com/matech03/weekly-report-tools/main/install.sh -o install-weekly-report-tools.sh
bash install-weekly-report-tools.sh
rm install-weekly-report-tools.sh
```

The downloaded `install.sh` is enough. If the full tool files are not available
beside it, the installer clones this public repository into a temporary
directory and continues the installation from there.

If you already cloned this repository locally, you can also install from that
local copy:

```bash
cd /path/to/your-project
bash /path/to/git-team-tools/install.sh
```

The installer will:

- Copy `suggest_commit.py` and `report.py` into `.team-tools/`
- Install `hooks/commit-msg` into `.git/hooks/commit-msg`
- Back up an existing `commit-msg` hook before replacing it
- Create `.team-tools/.env` if it does not exist
- Add `.team-tools/.env` to the project `.gitignore`

Advanced: override the source repository used by the bootstrap installer:

```bash
TOOLS_REPO_URL="https://github.com/matech03/weekly-report-tools.git" bash install-weekly-report-tools.sh
```

## Configuration

The installer creates `.team-tools/.env` in each project repository.

```env
# Optional: override git config user.name
# REPORT_AUTHOR="Nguyen Van A"

# Google Apps Script Web App endpoint
SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"

# Optional: must match REPORT_SECRET in google-apps-script/Code.gs
# REPORT_SECRET="change-me"
```

Important: `SHEETS_WEBHOOK_URL` must be a Web App URL ending with `/exec`.
Apps Script Library URLs such as `/macros/library/d/...` are not valid webhook
endpoints.

Environment variables override values from `.team-tools/.env`:

```bash
export SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"
export REPORT_AUTHOR="Nguyen Van A"
export REPORT_SECRET="change-me"
```

## Google Sheets Setup

The included Apps Script is already configured with the team spreadsheet ID in
`google-apps-script/Code.gs`.

To deploy or update the webhook:

1. Open the target Google Sheet.
2. Go to `Extensions` > `Apps Script`.
3. Paste or update the content from `google-apps-script/Code.gs`.
4. Save the script.
5. Go to `Deploy` > `New deployment` or `Manage deployments`.
6. Select type `Web app`.
7. Use:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
8. Deploy and copy the Web App URL.
9. Put that URL in `.team-tools/.env` as `SHEETS_WEBHOOK_URL`.

If the domain policy blocks public Apps Script web apps, the local report script
will receive HTTP 401 or 403 even when the deployment UI appears correct.

## Daily Workflow

Stage the files you want to commit:

```bash
git add src/LoginScreen.kt
```

Generate commit message suggestions:

```bash
python .team-tools/suggest_commit.py
```

Example output:

```text
[1] TASK: Thêm màn hình đăng nhập bằng Google OAuth
[2] TASK: Implement Google sign-in flow
[3] TASK: Tích hợp Google OAuth vào luồng đăng nhập
```

Commit with one of the accepted prefixes:

```bash
git commit -m "TASK: Thêm màn hình đăng nhập bằng Google OAuth"
git commit -m "BUG: Sửa crash khi mở app lần đầu"
```

Invalid or vague messages are rejected by the hook:

```bash
git commit -m "update code"
git commit -m "BUG: fix bug"
```

## Commit Message Format

Allowed prefixes:

| Prefix | Use for |
|--------|---------|
| `TASK:` | New work, features, improvements, refactors, non-bug changes |
| `BUG:` | Bug fixes, crashes, regressions, hotfixes |

Rules enforced by the hook:

- First line must start with `TASK:` or `BUG:`
- First line must be 72 characters or less
- Description must not be too short
- Vague messages such as `update code`, `fix bug`, `cleanup`, or `misc` are rejected
- Merge, revert, fixup, and squash commits are allowed through

Good examples:

```text
TASK: Thêm màn hình chọn theme cá nhân hoá
TASK: Tối ưu query tải danh sách bài viết
BUG: Sửa crash khi mở app lần đầu trên Android 12
BUG: Fix null pointer khi user chưa đăng nhập
```

## Weekly Report

Preview report data without sending it:

```bash
python .team-tools/report.py --dry-run
```

Submit the current week to Google Sheets:

```bash
python .team-tools/report.py
```

Submit a specific ISO week:

```bash
python .team-tools/report.py --week 2025-W24
```

Override author:

```bash
python .team-tools/report.py --author "Nguyen Van A"
```

The report script reads commits from all refs with:

```text
git log --author=<author> --since=<week start> --until=<week end> --all
```

## Google Sheets Output

The Apps Script writes two sheets.

### Summary

| Week | Submitted At | Member | Repository | Total Commits | Tasks | Bugs | Other |
|------|--------------|--------|------------|---------------|-------|------|-------|
| 09/06 - 15/06/2025 | 2025-06-13 17:30 | Nguyen Van A | mobile-app | 8 | 6 | 2 | 0 |

### Commits

| Week | Member | Repository | Type | Commit Date | Hash | Commit Message |
|------|--------|------------|------|-------------|------|----------------|
| 09/06 - 15/06/2025 | Nguyen Van A | mobile-app | TASK | 2025-06-10 09:15 | a1b2c3d | TASK: Thêm màn hình login |

Type values are plain text: `TASK`, `BUG`, or `OTHER`.

## Troubleshooting

### No staged files

Run `git add <files>` before `suggest_commit.py`.

### Missing Anthropic SDK

Install the dependency:

```bash
pip install anthropic
```

### Missing Anthropic API key

Set `ANTHROPIC_API_KEY` in your shell environment.

### Report cannot find commits

Check the author name:

```bash
git config user.name
python .team-tools/report.py --author "Exact Git Author Name" --dry-run
```

### Apps Script returns HTTP 401 or 403

Confirm that the Web App deployment uses:

- `Execute as`: `Me`
- `Who has access`: `Anyone`

Also confirm that `.team-tools/.env` uses a Web App URL ending with `/exec`, not
an Apps Script Library URL.

### Apps Script returns `Unauthorized`

If `REPORT_SECRET` is set in `Code.gs`, the same value must be set in
`.team-tools/.env` or in the `REPORT_SECRET` environment variable.

## Preparing a GitHub Remote

After initializing this repository, add your GitHub remote and push:

```bash
git remote add origin git@github.com:<org-or-user>/git-team-tools.git
git add .
git commit -m "TASK: Add git team reporting tools"
git branch -M main
git push -u origin main
```
