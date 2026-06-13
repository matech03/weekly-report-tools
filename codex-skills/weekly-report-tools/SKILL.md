---
name: weekly-report-tools
description: Install, configure, review, or debug the Matech weekly-report-tools system for small development teams. Use when Codex is asked to set up commit message suggestions, install the TASK/BUG commit-msg hook, generate weekly git reports, troubleshoot Google Sheets Apps Script webhook errors, update the weekly-report-tools repo, or explain how team members should use the public installer.
---

# Weekly Report Tools

## Overview

Use this skill to work with the Matech weekly-report-tools repo and projects that have it installed. The tools enforce `TASK:` / `BUG:` commit messages, suggest commit messages from staged diffs with Anthropic Claude, and send weekly git commit summaries to Google Sheets.

## Canonical Repository

- Public repo: `https://github.com/matech03/weekly-report-tools`
- SSH remote: `git@github.com:matech03/weekly-report-tools.git`
- One-file installer URL: `https://raw.githubusercontent.com/matech03/weekly-report-tools/main/install.sh`

## Install In A Project

When a user wants to install the tools into an existing project repo, run from that project root:

```bash
curl -fsSL https://raw.githubusercontent.com/matech03/weekly-report-tools/main/install.sh -o install-weekly-report-tools.sh
bash install-weekly-report-tools.sh
rm install-weekly-report-tools.sh
```

The installer:

- Copies `suggest_commit.py` and `report.py` into `.team-tools/`
- Installs `.git/hooks/commit-msg`
- Backs up an existing `commit-msg` hook before replacing it
- Creates `.team-tools/.env` if missing
- Adds `.team-tools/.env` to the target repo `.gitignore`
- If run as a standalone file, clones the public repo into a temporary directory and removes that clone on exit

Do not leave the temporary installer file in the target repo unless the user asks to keep it.

## Daily Commands

Suggest a commit message from staged files:

```bash
git add <files>
python .team-tools/suggest_commit.py
```

Commit with the required format:

```bash
git commit -m "TASK: Add Google sign-in flow"
git commit -m "BUG: Fix crash when loading profile"
```

Preview weekly report:

```bash
python .team-tools/report.py --dry-run
```

Submit weekly report:

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

## Configuration

Project config lives in `.team-tools/.env`:

```env
# Optional: override git config user.name
# REPORT_AUTHOR="Nguyen Van A"

SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"

# Optional: must match REPORT_SECRET in Google Apps Script
# REPORT_SECRET="change-me"
```

Environment variables override `.env`:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `SHEETS_WEBHOOK_URL`
- `REPORT_AUTHOR`
- `REPORT_SECRET`

## Commit Format

Valid prefixes:

- `TASK:` for features, improvements, refactors, and non-bug work
- `BUG:` for fixes, crashes, regressions, and hotfixes

The hook rejects vague messages such as `update code`, `fix bug`, `cleanup`, `misc`, and very short descriptions. Merge, revert, fixup, and squash commits are allowed through.

## Google Sheets Troubleshooting

For report submission failures:

- Confirm `.team-tools/.env` uses a Web App URL ending with `/exec`.
- Reject `/macros/library/d/...` URLs; those are Apps Script Library URLs, not webhooks.
- For HTTP 401 or 403, check Apps Script deployment:
  - `Execute as`: `Me`
  - `Who has access`: `Anyone`
- If Workspace policy blocks public web apps, local unauthenticated report submission will still fail even with the UI set to `Anyone`.
- If Apps Script returns `Unauthorized`, verify `REPORT_SECRET` matches in `.team-tools/.env` and `google-apps-script/Code.gs`.
- If no commits appear, check `git config user.name` and retry with `--author`.

## Maintaining The Tool Repo

When editing the weekly-report-tools repo:

- Keep `install.sh` usable both from a full clone and as a standalone downloaded file.
- Test shell syntax with `bash -n install.sh`.
- Test Python syntax with `PYTHONPYCACHEPREFIX=/private/tmp/weekly-report-pycache python3 -m py_compile scripts/suggest_commit.py scripts/report.py hooks/commit-msg`.
- Test Apps Script syntax with `node --check --input-type=commonjs < google-apps-script/Code.gs`.
- Use commit messages that satisfy the repo's own convention, for example `TASK: Update installer bootstrap`.
