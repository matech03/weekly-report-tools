#!/usr/bin/env python3
"""
suggest_commit.py — Gợi ý commit message từ git diff dùng Claude AI
Usage: python suggest_commit.py
"""

import subprocess
import sys
import os
import shlex

try:
    import anthropic
except ImportError:
    print("❌  Thiếu thư viện: pip install anthropic")
    sys.exit(1)

SYSTEM_PROMPT = """Bạn là trợ lý hỗ trợ lập trình viên viết commit message chuyên nghiệp.

QUY TẮC FORMAT (bắt buộc):
- Task mới / tính năng mới / cải tiến: TASK: <mô tả ngắn gọn>
- Sửa lỗi / bugfix: BUG: <mô tả ngắn gọn>
- Mỗi dòng tối đa 72 ký tự
- Viết tiếng Việt hoặc tiếng Anh tùy theo ngôn ngữ trong code/comment
- Mô tả WHAT (làm gì) và WHY (tại sao) — không mô tả HOW

VÍ DỤ HỢP LỆ:
  TASK: Thêm màn hình đăng nhập bằng Google OAuth
  BUG: Sửa lỗi crash khi mở app lần đầu trên Android 12
  TASK: Tối ưu query tải danh sách bài viết
  BUG: Fix null pointer exception khi user chưa đăng nhập

OUTPUT: Chỉ trả về 1-3 commit message gợi ý, mỗi dòng một message. Không giải thích thêm."""

def get_staged_diff():
    result = subprocess.run(
        ["git", "diff", "--cached", "--stat"],
        capture_output=True, text=True
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None, None

    diff = subprocess.run(
        ["git", "diff", "--cached"],
        capture_output=True, text=True
    )
    if diff.returncode != 0:
        return result.stdout.strip(), ""
    # Giới hạn 4000 ký tự để tránh tốn token
    return result.stdout.strip(), diff.stdout[:4000]

def suggest(stat, diff):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌  Thiếu ANTHROPIC_API_KEY trong environment variables")
        print("   Thêm vào ~/.zshrc hoặc ~/.bashrc:")
        print('   export ANTHROPIC_API_KEY="sk-ant-..."')
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    user_message = f"""Đây là thay đổi trong staged files:

=== STATS ===
{stat}

=== DIFF ===
{diff}

Gợi ý commit message phù hợp với format TASK:/BUG:"""

    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    try:
        message = client.messages.create(
            model=model,
            max_tokens=300,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}]
        )
    except Exception as exc:
        print(f"❌  Không gọi được Anthropic API: {exc}")
        sys.exit(1)
    return message.content[0].text.strip()

def main():
    stat, diff = get_staged_diff()

    if not stat:
        print("⚠️  Không có file nào trong staging area.")
        print("   Chạy: git add <files> trước, rồi thử lại.")
        sys.exit(0)

    print("🔍  Đang phân tích thay đổi...\n")
    print(f"📄  Files thay đổi:\n{stat}\n")

    suggestions = suggest(stat, diff)

    print("✨  Gợi ý commit message:\n")
    lines = [l.strip() for l in suggestions.split("\n") if l.strip()]
    if not lines:
        print("❌  AI không trả về gợi ý nào. Thử chạy lại hoặc tự viết commit message.")
        sys.exit(1)
    for i, line in enumerate(lines, 1):
        print(f"  [{i}] {line}")

    print()
    print("💡  Để dùng một trong các gợi ý trên:")
    print(f"    git commit -m {shlex.quote(lines[0])}")
    print()
    print("   Hoặc chỉnh sửa tùy ý rồi commit bình thường.")

if __name__ == "__main__":
    main()
