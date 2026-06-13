# CLAUDE.md

This repository contains Matech's weekly report tooling for small development teams.

## Purpose

The tools install into other git repositories and provide:

- AI commit message suggestions from staged diffs
- A `commit-msg` hook enforcing `TASK:` and `BUG:` commit prefixes
- Weekly git commit reports sent to Google Sheets through Apps Script

## Important Files

- `install.sh`: bootstrap installer. It must work when run from a full clone and when downloaded as a standalone file.
- `scripts/suggest_commit.py`: uses Anthropic Claude to suggest commit messages from staged changes.
- `hooks/commit-msg`: validates commit message format and rejects vague messages.
- `scripts/report.py`: collects weekly commits and POSTs them to Apps Script.
- `google-apps-script/Code.gs`: webhook receiver that writes Summary and Commits sheets.
- `codex-skills/weekly-report-tools/SKILL.md`: Codex skill instructions for this tool.

## Install Command For Team Members

Run from the target project repository:

```bash
curl -fsSL https://raw.githubusercontent.com/matech03/weekly-report-tools/main/install.sh -o install-weekly-report-tools.sh
bash install-weekly-report-tools.sh
rm install-weekly-report-tools.sh
```

The installer clones this public repo only into a temporary directory when needed, then removes that temporary clone on exit.

## Commit Convention

Use only these prefixes:

- `TASK:` for features, improvements, refactors, and non-bug work
- `BUG:` for fixes, crashes, regressions, and hotfixes

Examples:

```text
TASK: Support standalone installer bootstrap
BUG: Fix webhook URL validation for Apps Script
```

## Validation Commands

Before committing changes to this repo, run:

```bash
bash -n install.sh
PYTHONPYCACHEPREFIX=/private/tmp/weekly-report-pycache python3 -m py_compile scripts/suggest_commit.py scripts/report.py hooks/commit-msg
node --check --input-type=commonjs < google-apps-script/Code.gs
python3 /Users/macos/.codex/skills/.system/skill-creator/scripts/quick_validate.py codex-skills/weekly-report-tools
```

## Google Sheets Notes

`SHEETS_WEBHOOK_URL` must be an Apps Script Web App URL ending with `/exec`.
Do not use Apps Script Library URLs such as `/macros/library/d/...`.

For HTTP 401 or 403, check the Apps Script deployment:

- `Execute as`: `Me`
- `Who has access`: `Anyone`

If the Workspace admin blocks public web apps, unauthenticated local report submission can still fail even when the deployment UI appears correct.
