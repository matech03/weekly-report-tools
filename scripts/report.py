#!/usr/bin/env python3
"""
report.py — Tổng hợp commit cá nhân trong tuần → Google Sheets
Usage: python report.py [--week YYYY-WW] [--author "Ten Nguoi"]

Config: Đặt SHEETS_WEBHOOK_URL trong file .env cùng thư mục script
hoặc environment variable
"""

import subprocess
import sys
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta
import argparse

try:
    import anthropic
except ImportError:
    anthropic = None

# ── Màu terminal ─────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

PERFORMANCE_SYSTEM_PROMPT = """Bạn là trợ lý tổng hợp báo cáo tuần cho lập trình viên.

Nhiệm vụ: đọc commit messages, stats và diff rút gọn để tóm tắt dev đã làm gì
trong dự án trong tuần.

Yêu cầu output:
- Viết tiếng Việt.
- 2-5 bullet, mỗi bullet một dòng.
- Mỗi bullet tối đa 90 ký tự.
- Tập trung vào kết quả/công việc chính, dễ nắm thông tin khi đọc lướt.
- Mở đầu mỗi dòng bằng "- ".
- Không đánh giá năng lực cá nhân, không chấm điểm.
- Không bịa thông tin ngoài nội dung commit/diff.
- Chỉ trả về nội dung để ghi vào một ô Google Sheets, không giải thích thêm."""

def load_config():
    """Load config từ file .env cùng thư mục script, hoặc env var."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    config = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    config[k.strip()] = v.strip().strip('"').strip("'")

    # env var override
    config["SHEETS_WEBHOOK_URL"] = os.environ.get(
        "SHEETS_WEBHOOK_URL", config.get("SHEETS_WEBHOOK_URL", "")
    )
    config["AUTHOR"] = os.environ.get(
        "REPORT_AUTHOR", config.get("REPORT_AUTHOR", "")
    )
    config["REPORT_SECRET"] = os.environ.get(
        "REPORT_SECRET", config.get("REPORT_SECRET", "")
    )
    config["ANTHROPIC_API_KEY"] = os.environ.get(
        "ANTHROPIC_API_KEY", config.get("ANTHROPIC_API_KEY", "")
    )
    config["ANTHROPIC_MODEL"] = os.environ.get(
        "ANTHROPIC_MODEL", config.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    )
    return config

def get_week_range(week_str=None):
    """Trả về (start_date, end_date) của tuần. Default = tuần hiện tại."""
    if week_str:
        try:
            year, week = map(int, week_str.split("-W"))
            # ISO week: Monday = 1, Sunday = 7.
            start = datetime.strptime(f"{year}-W{week:02d}-1", "%G-W%V-%u")
        except ValueError:
            print(f"{RED}❌  Tuần không hợp lệ: {week_str}{RESET}")
            print("   Format đúng: YYYY-Www, ví dụ 2025-W24")
            sys.exit(1)
    else:
        today = datetime.today()
        start = today - timedelta(days=today.weekday())  # Thứ 2
    end = start + timedelta(days=6)  # Chủ nhật
    return start, end

def get_week_id(start):
    """Trả về ISO week id dạng YYYY-Www."""
    iso_year, iso_week, _ = start.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"

def get_git_author():
    """Lấy tên tác giả từ git config."""
    result = subprocess.run(
        ["git", "config", "user.name"],
        capture_output=True, text=True
    )
    return result.stdout.strip() if result.returncode == 0 else ""

def get_repo_name():
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        return os.path.basename(result.stdout.strip())
    return "unknown-repo"

def fetch_commits(author, since, until):
    """Lấy danh sách commit của author trong khoảng thời gian."""
    since_str = since.strftime("%Y-%m-%d 00:00:00")
    until_str = until.strftime("%Y-%m-%d 23:59:59")

    result = subprocess.run(
        [
            "git", "log",
            f"--author={author}",
            f"--since={since_str}",
            f"--until={until_str}",
            "--no-merges",
            "--pretty=format:%H|%ad|%s",
            "--date=format:%Y-%m-%d %H:%M",
            "--all"
        ],
        capture_output=True, text=True
    )

    commits = []
    if result.returncode != 0:
        print(f"{RED}❌  Không đọc được git log.{RESET}")
        if result.stderr.strip():
            print(f"   {result.stderr.strip()}")
        return commits

    if not result.stdout.strip():
        return commits

    for line in result.stdout.strip().split("\n"):
        parts = line.split("|", 2)
        if len(parts) == 3:
            hash_, date, msg = parts
            commit_type = "TASK" if msg.startswith("TASK:") else \
                          "BUG"  if msg.startswith("BUG:")  else "OTHER"
            commits.append({
                "hash": hash_[:7],
                "full_hash": hash_,
                "date": date,
                "message": msg.strip(),
                "type": commit_type
            })

    return commits

def get_commit_change_context(commits, max_chars=12000, per_commit_chars=2500):
    """Lấy diff rút gọn của các commit để AI tổng hợp performance."""
    chunks = []
    remaining = max_chars

    for commit in commits:
        if remaining <= 0:
            break

        full_hash = commit.get("full_hash") or commit.get("hash")
        result = subprocess.run(
            [
                "git", "show",
                "--stat",
                "--patch",
                "--find-renames",
                "--find-copies",
                "--no-ext-diff",
                "--unified=3",
                "--format=commit %H%nDate: %ad%nMessage: %s",
                "--date=format:%Y-%m-%d %H:%M",
                full_hash,
            ],
            capture_output=True,
            text=True,
            errors="replace"
        )
        if result.returncode != 0 or not result.stdout.strip():
            continue

        text = result.stdout.strip()
        if len(text) > per_commit_chars:
            text = text[:per_commit_chars] + "\n...[diff truncated]"
        if len(text) > remaining:
            text = text[:remaining] + "\n...[weekly context truncated]"

        chunks.append(text)
        remaining -= len(text)

    return "\n\n---\n\n".join(chunks)

def normalize_performance_notes(text, max_lines=5, max_line_chars=90):
    """Chuẩn hóa summary notes thành các ý ngắn, dễ đọc trong một cell."""
    if not text:
        return ""

    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        line = line.lstrip("-*•0123456789. )\t").strip()
        if not line:
            continue
        if len(line) > max_line_chars:
            line = line[:max_line_chars - 1].rstrip(" ,.;:-") + "..."
        lines.append(f"- {line}")
        if len(lines) >= max_lines:
            break

    return "\n".join(lines)

def analyze_performance(config, author, repo, week_label, commits):
    """Tổng hợp một vài note công việc trong tuần. Lỗi thì trả về chuỗi rỗng."""
    api_key = config.get("ANTHROPIC_API_KEY", "")
    if not api_key or anthropic is None:
        return ""

    change_context = get_commit_change_context(commits)
    if not change_context:
        return ""

    commit_lines = "\n".join(
        f"- [{c['hash']}] {c['date']} {c['type']}: {c['message']}"
        for c in commits
    )
    user_message = f"""Author: {author}
Repository: {repo}
Week: {week_label}

=== COMMITS ===
{commit_lines}

=== CODE CHANGES ===
{change_context}

Hãy tổng hợp các điểm chính dev đã làm trong tuần để ghi vào cột Summary."""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=config.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            max_tokens=500,
            system=PERFORMANCE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}]
        )
        text = message.content[0].text.strip()
    except Exception:
        return ""

    return normalize_performance_notes(text)

def read_performance_override(args):
    """Nhận summary notes do agent đang chạy report tự tổng hợp."""
    if args.performance_file:
        try:
            with open(args.performance_file, "r", encoding="utf-8") as f:
                return normalize_performance_notes(f.read())
        except Exception:
            return ""

    if args.performance:
        return normalize_performance_notes(args.performance)

    return ""

def print_summary(author, repo, week_label, commits, performance=""):
    tasks = [c for c in commits if c["type"] == "TASK"]
    bugs  = [c for c in commits if c["type"] == "BUG"]
    other = [c for c in commits if c["type"] == "OTHER"]

    print(f"\n{BOLD}{CYAN}{'═'*58}{RESET}")
    print(f"{BOLD}  📋  WEEKLY REPORT{RESET}")
    print(f"{CYAN}{'═'*58}{RESET}")
    print(f"  👤  Author : {BOLD}{author}{RESET}")
    print(f"  📁  Repo   : {repo}")
    print(f"  📅  Tuần   : {week_label}")
    print(f"  📊  Tổng   : {len(commits)} commits  "
          f"({GREEN}{len(tasks)} TASK{RESET} / "
          f"{RED}{len(bugs)} BUG{RESET} / "
          f"{YELLOW}{len(other)} other{RESET})")
    print(f"{CYAN}{'─'*58}{RESET}")

    if tasks:
        print(f"\n{GREEN}{BOLD}  ✅ TASK ({len(tasks)}){RESET}")
        for c in tasks:
            print(f"     [{c['hash']}] {c['date']}  {c['message']}")

    if bugs:
        print(f"\n{RED}{BOLD}  🐛 BUG ({len(bugs)}){RESET}")
        for c in bugs:
            print(f"     [{c['hash']}] {c['date']}  {c['message']}")

    if other:
        print(f"\n{YELLOW}  ⚠️  OTHER (không đúng format) ({len(other)}){RESET}")
        for c in other:
            print(f"     [{c['hash']}] {c['date']}  {c['message']}")

    if performance:
        print(f"\n{CYAN}{BOLD}  📌 SUMMARY NOTES{RESET}")
        for line in performance.splitlines():
            if line.strip():
                print(f"     {line.strip()}")
    else:
        print(f"\n{YELLOW}  📌 SUMMARY NOTES: để trống (không phân tích được hoặc chưa cấu hình AI){RESET}")

    print(f"\n{CYAN}{'═'*58}{RESET}\n")

def send_to_sheets(webhook_url, payload):
    """Gửi data lên Google Sheets qua Apps Script Web App."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            try:
                response = json.loads(body)
                if response.get("status") == "error":
                    return False, response.get("message", body)
            except json.JSONDecodeError:
                pass
            return True, body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code in (401, 403) and (
            "ServiceLogin" in body
            or "accounts.google.com" in body
            or "Không thể mở tệp" in body
            or "Google Drive" in body
        ):
            return False, (
                f"HTTP {e.code}: Apps Script webhook đang yêu cầu đăng nhập. "
                "Redeploy Web App với Execute as = Me và Who has access = Anyone, "
                "rồi cập nhật lại SHEETS_WEBHOOK_URL nếu Google cấp URL mới."
            )
        return False, f"HTTP {e.code}: {body[:500]}"
    except Exception as e:
        return False, str(e)

def validate_webhook_url(webhook_url):
    if "/macros/library/" in webhook_url:
        return (
            False,
            "SHEETS_WEBHOOK_URL đang là Apps Script Library URL. "
            "Webhook phải là Web App URL dạng "
            "https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec"
        )
    if "script.google.com" in webhook_url and "/macros/s/" not in webhook_url:
        return (
            False,
            "SHEETS_WEBHOOK_URL không giống Web App URL. "
            "Vào Deploy > Manage deployments > Web app và copy URL kết thúc bằng /exec."
        )
    return True, ""

def main():
    parser = argparse.ArgumentParser(
        description="Tổng hợp commit tuần → Google Sheets"
    )
    parser.add_argument("--week", help="Tuần cụ thể: YYYY-WWW (vd: 2025-W24)")
    parser.add_argument("--author", help="Override tên tác giả")
    parser.add_argument("--dry-run", action="store_true",
                        help="Chỉ in ra màn hình, không gửi lên Sheets")
    parser.add_argument("--performance",
                        help="Summary notes do agent tổng hợp sẵn")
    parser.add_argument("--performance-file",
                        help="File chứa summary notes do agent tổng hợp sẵn")
    args = parser.parse_args()

    config = load_config()

    # Xác định author
    author = args.author or config.get("AUTHOR") or get_git_author()
    if not author:
        print(f"{RED}❌  Không tìm được tên tác giả.{RESET}")
        print("   Chạy: git config user.name 'Ten Cua Ban'")
        sys.exit(1)

    # Xác định tuần
    start, end = get_week_range(args.week)
    week_id = get_week_id(start)
    week_range = f"{start.strftime('%d/%m')} – {end.strftime('%d/%m/%Y')}"

    repo = get_repo_name()

    print(f"\n🔍  Đang lấy commits của {BOLD}{author}{RESET} "
          f"({week_id}: {week_range})...")

    commits = fetch_commits(author, start, end)

    if not commits:
        print(f"\n{YELLOW}⚠️  Không tìm thấy commit nào trong tuần này.{RESET}")
        print("   Kiểm tra lại: git log --author='<tên>' --since='7 days ago'")
        sys.exit(0)

    performance = read_performance_override(args)
    if performance:
        print(f"🧠  Summary notes: {GREEN}dùng nội dung do agent tổng hợp{RESET}")
    else:
        print(f"🧠  Đang phân tích thay đổi code để tổng hợp summary...", end=" ", flush=True)
        performance = analyze_performance(config, author, repo, week_id, commits)
        if performance:
            print(f"{GREEN}xong{RESET}")
        else:
            print(f"{YELLOW}bỏ qua{RESET}")

    print_summary(author, repo, f"{week_id} ({week_range})", commits, performance)

    # Gửi lên Sheets
    if args.dry_run:
        print(f"{YELLOW}[dry-run] Không gửi lên Google Sheets.{RESET}\n")
        return

    webhook_url = config.get("SHEETS_WEBHOOK_URL", "")
    if not webhook_url:
        print(f"{YELLOW}⚠️  Chưa cấu hình SHEETS_WEBHOOK_URL.{RESET}")
        print("   Xem README.md để hướng dẫn setup Google Sheets.\n")
        return
    valid_webhook, webhook_error = validate_webhook_url(webhook_url)
    if not valid_webhook:
        print(f"{RED}❌  {webhook_error}{RESET}\n")
        return

    print("📤  Đang gửi lên Google Sheets...", end=" ", flush=True)

    payload = {
        "author": author,
        "repo": repo,
        "week": week_id,
        "week_start": start.strftime("%Y-%m-%d"),
        "week_end": end.strftime("%Y-%m-%d"),
        "week_range": week_range,
        "submitted_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "secret": config.get("REPORT_SECRET", ""),
        "summary": {
            "total": len(commits),
            "task": len([c for c in commits if c["type"] == "TASK"]),
            "bug":  len([c for c in commits if c["type"] == "BUG"]),
            "other": len([c for c in commits if c["type"] == "OTHER"]),
        },
        "summary_note": performance,
        "performance": performance,
        "commits": commits
    }

    ok, msg = send_to_sheets(webhook_url, payload)
    if ok:
        print(f"{GREEN}✅  Thành công!{RESET}")
        print(f"   {msg}\n")
    else:
        print(f"{RED}❌  Lỗi: {msg}{RESET}")
        print("   Kiểm tra deployment Apps Script và SHEETS_WEBHOOK_URL trong file .env\n")

if __name__ == "__main__":
    main()
