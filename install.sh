#!/usr/bin/env bash
# install.sh — Cài đặt git-team-tools vào repo hiện tại
# Usage: bash install.sh (chạy từ thư mục gốc của repo)

set -e

TOOLS_REPO_URL="${TOOLS_REPO_URL:-https://github.com/matech03/weekly-report-tools.git}"
TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(pwd)"
GIT_HOOKS_DIR="$REPO_DIR/.git/hooks"
SCRIPTS_TARGET="$REPO_DIR/.team-tools"
CODEX_SKILL_TARGET="$REPO_DIR/.codex/skills/weekly-report"
CLAUDE_SKILL_TARGET="$REPO_DIR/.claude/skills/weekly-report"
CLAUDE_COMMANDS_TARGET="$REPO_DIR/.claude/commands"
TMP_TOOLS_DIR=""

GREEN="\033[92m"
YELLOW="\033[93m"
RED="\033[91m"
CYAN="\033[96m"
BOLD="\033[1m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗"
echo -e "║     🛠️   git-team-tools installer       ║"
echo -e "╚══════════════════════════════════════════╝${RESET}"
echo ""

cleanup() {
    if [ -n "$TMP_TOOLS_DIR" ] && [ -d "$TMP_TOOLS_DIR" ]; then
        rm -rf "$TMP_TOOLS_DIR"
    fi
}
trap cleanup EXIT

# Kiểm tra git repo
if [ ! -d "$REPO_DIR/.git" ]; then
    echo -e "${RED}❌  Không phải git repo. Chạy lại từ thư mục gốc của project.${RESET}"
    exit 1
fi

if [ ! -f "$TOOLS_DIR/scripts/suggest_commit.py" ] || \
   [ ! -f "$TOOLS_DIR/hooks/commit-msg" ] || \
   [ ! -f "$TOOLS_DIR/codex-skills/weekly-report/SKILL.md" ] || \
   [ ! -f "$TOOLS_DIR/claude-skills/weekly-report/SKILL.md" ] || \
   [ ! -f "$TOOLS_DIR/claude-commands/report.md" ]; then
    echo -e "${YELLOW}📦  Đang chuẩn bị download tools"

    if ! command -v git >/dev/null 2>&1; then
        echo -e "${RED}❌  Cần cài git để installer tự tải bộ tool.${RESET}"
        exit 1
    fi

    TMP_TOOLS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/weekly-report-tools.XXXXXX")"
    git clone --depth 1 "$TOOLS_REPO_URL" "$TMP_TOOLS_DIR" >/dev/null 2>&1 || {
        echo -e "${RED}❌  Không clone được weekly-report-tools từ GitHub.${RESET}"
        echo "   Kiểm tra kết nối mạng hoặc đặt lại TOOLS_REPO_URL."
        exit 1
    }
    TOOLS_DIR="$TMP_TOOLS_DIR"
fi

# Copy scripts vào repo
echo -e "📁  Tạo thư mục .team-tools/..."
mkdir -p "$SCRIPTS_TARGET"
cp "$TOOLS_DIR/scripts/suggest_commit.py" "$SCRIPTS_TARGET/"
cp "$TOOLS_DIR/scripts/report.py" "$SCRIPTS_TARGET/"

# Cài Codex skill local trong project
echo -e "🤖  Cài đặt Codex skill local..."
mkdir -p "$CODEX_SKILL_TARGET"
cp "$TOOLS_DIR/codex-skills/weekly-report/SKILL.md" "$CODEX_SKILL_TARGET/SKILL.md"

# Cài Claude skill và slash command local trong project
echo -e "🧠  Cài đặt Claude skill local..."
mkdir -p "$CLAUDE_SKILL_TARGET" "$CLAUDE_COMMANDS_TARGET"
cp "$TOOLS_DIR/claude-skills/weekly-report/SKILL.md" "$CLAUDE_SKILL_TARGET/SKILL.md"
cp "$TOOLS_DIR/claude-commands/report.md" "$CLAUDE_COMMANDS_TARGET/report.md"

# Cài commit-msg hook
echo -e "🔗  Cài đặt commit-msg hook..."
if [ -f "$GIT_HOOKS_DIR/commit-msg" ] && ! cmp -s "$TOOLS_DIR/hooks/commit-msg" "$GIT_HOOKS_DIR/commit-msg"; then
    BACKUP="$GIT_HOOKS_DIR/commit-msg.backup.$(date +%Y%m%d%H%M%S)"
    cp "$GIT_HOOKS_DIR/commit-msg" "$BACKUP"
    echo -e "${YELLOW}   Hook cũ đã được backup: $BACKUP${RESET}"
fi
cp "$TOOLS_DIR/hooks/commit-msg" "$GIT_HOOKS_DIR/commit-msg"
chmod +x "$GIT_HOOKS_DIR/commit-msg"

# Tạo file .env nếu chưa có
if [ ! -f "$SCRIPTS_TARGET/.env" ]; then
    echo -e "⚙️   Tạo file .env..."
    cat > "$SCRIPTS_TARGET/.env" << 'EOF'
# ── git-team-tools config ──────────────────────────────────
# Tên của bạn (override git config user.name)
# REPORT_AUTHOR="Nguyen Van A"

# Google Apps Script Web App
SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycbzIJt8MeIWavTEM_d0oY3ZOQJ7SLldIvJE9Xf87RyGlOIewD_A0S2XUaBOpOv8SvVxY/exec"

# Optional: đặt cùng giá trị với REPORT_SECRET trong Apps Script
# REPORT_SECRET="change-me"

EOF
fi

# Thêm .team-tools/ vào .gitignore
touch "$REPO_DIR/.gitignore"
if ! grep -q "^.team-tools/$" "$REPO_DIR/.gitignore"; then
    echo "" >> "$REPO_DIR/.gitignore"
    echo "# git-team-tools" >> "$REPO_DIR/.gitignore"
    echo ".team-tools/" >> "$REPO_DIR/.gitignore"
    echo -e "🙈  Đã thêm .team-tools/ vào .gitignore"
fi

# Tạo alias gợi ý
echo ""
echo -e "${GREEN}${BOLD}✅  Cài đặt hoàn tất!${RESET}"
echo ""
echo -e "${CYAN}CÁCH SỬ DỤNG:${RESET}"
echo ""
echo -e "  ${BOLD}Gợi ý commit message:${RESET}"
echo -e "    git add <files>"
echo -e "    python .team-tools/suggest_commit.py"
echo ""
echo -e "  ${BOLD}Commit (tự động validate format):${RESET}"
echo -e "    git commit -m \"TASK: Mô tả công việc\""
echo -e "    git commit -m \"BUG: Sửa lỗi gì đó\""
echo ""
echo -e "  ${BOLD}Tạo báo cáo tuần:${RESET}"
echo -e "    python .team-tools/report.py             # gửi lên Google Sheets"
echo -e "    python .team-tools/report.py --dry-run   # preview/xem trước, không gửi"
echo ""
echo -e "  ${BOLD}Codex skill local:${RESET}"
echo -e "    Gõ lệnh: report                  # gửi luôn"
echo -e "    Gõ lệnh: preview report          # chỉ xem trước"
echo ""
echo -e "  ${BOLD}Claude local:${RESET}"
echo -e "    Gõ lệnh: report                  # gửi luôn"
echo -e "    Gõ lệnh: preview report          # chỉ xem trước"
echo -e "    Hoặc dùng slash command: /report"
echo ""
