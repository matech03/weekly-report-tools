# weekly-report-tools

Bộ tool nhẹ để chuẩn hóa commit message và gửi báo cáo commit hằng tuần lên Google Sheets.

## Cấu trúc project

```text
weekly-report-tools/
├── report-tools-installer.sh        # Script cài tool vào project đích
├── hooks/
│   └── commit-msg                   # Git hook validate commit message
├── scripts/
│   └── report.py                    # Script tổng hợp commit và gửi report
├── google-apps-script/
│   └── Code.gs                      # Webhook ghi dữ liệu vào Google Sheets
├── claude-commands/
│   └── report.md                    # Slash command /report cho Claude Code
├── claude-skills/
│   └── weekly-report/SKILL.md       # Skill report cho Claude Code
└── codex-skills/
    └── weekly-report/SKILL.md       # Skill report cho Codex
```

## Tính năng

### Commit rule

Hook `commit-msg` chỉ cho phép commit message có prefix:

| Prefix | Ý nghĩa |
|--------|---------|
| `TASK:` | Tính năng mới, task mới, công việc chính |
| `BUG:` | Sửa lỗi, hotfix, regression |
| `UPDATE:` | Cập nhật, cải tiến, refactor, thay đổi không phải bug |

Rule đang enforce:

- Dòng đầu phải bắt đầu bằng `TASK:`, `BUG:`, hoặc `UPDATE:`
- Dòng đầu tối đa **100 ký tự**
- Mô tả sau prefix cần ít nhất **3 từ** và **7 ký tự không tính khoảng trắng**
- Reject message quá chung chung như `update code`, `fix bug`, `cleanup`, `misc`
- Bỏ qua validate cho `Merge`, `Revert`, `fixup!`, `squash!`

Ví dụ hợp lệ:

```text
TASK: Thêm bộ lọc báo cáo theo tuần
BUG: Sửa lỗi gửi payload khi webhook lỗi
UPDATE: Cập nhật định dạng báo cáo tuần
```

### Weekly report

`report.py` tổng hợp commit theo author và tuần, sau đó gửi lên Google Sheets.

Report gồm 3 sheet:

- `Summary`: tổng hợp theo tuần/member/repository
- `Weeks`: mapping ISO week với ngày bắt đầu/kết thúc
- `Commits`: chi tiết từng commit

Cột count trong `Summary`:

| Cột | Cách tính |
|-----|----------|
| `Total Commits` | Tổng số commit |
| `Tasks` | Số commit prefix `TASK:` |
| `Others` | Số commit `BUG:`, `UPDATE:`, hoặc commit khác format |

Nếu Google Sheet đang có layout cũ với cột `Bugs` và `Updates`, Apps Script sẽ tự migrate:

```text
Others = Bugs + Updates + Other cũ
```

Cột `Note` thủ công trong Google Sheets sẽ được giữ lại khi submit lại cùng tuần/member/repository.

### Claude/Codex report skill

Sau khi cài đặt, có thể gọi report bằng:

```text
report
preview report
/report
```

Mặc định `report` sẽ gửi lên Google Sheets. Chỉ chạy preview khi prompt có ý rõ như `preview`, `xem trước`, `dry-run`.

## Cài đặt

### Yêu cầu

- Git 2.x
- Python 3.7+
- Google Apps Script Web App URL kết thúc bằng `/exec`

### Dành cho leader

Leader chuẩn bị Google Sheet và webhook dùng chung cho team:

1. Mở Google Sheet nhận report.
2. Vào `Extensions` > `Apps Script`.
3. Paste nội dung `google-apps-script/Code.gs`.
4. Kiểm tra `SPREADSHEET_ID` trong `Code.gs`.
5. Deploy dạng `Web app`:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
6. Copy Web App URL kết thúc bằng `/exec`.
7. Gửi Web App URL cho các thành viên để cấu hình `SHEETS_WEBHOOK_URL`.

Nếu cần bảo vệ webhook, leader đặt `REPORT_SECRET` trong `Code.gs` và gửi cùng giá trị đó cho thành viên.

### Dành cho thành viên

Chạy trong thư mục root của project cần dùng report.

Bước 1: download installer về project:

```bash
curl -fsSL https://raw.githubusercontent.com/matech03/weekly-report-tools/main/report-tools-installer.sh -o report-tools-installer.sh
```

Bước 2: chạy installer:

```bash
bash report-tools-installer.sh
```

Bước 3: xoá file installer sau khi cài xong:

```bash
rm report-tools-installer.sh
```

Installer sẽ:

- Copy `scripts/report.py` vào `.team-tools/report.py`
- Cài `hooks/commit-msg` vào `.git/hooks/commit-msg`
- Copy Claude/Codex weekly report skill vào project
- Tạo `.team-tools/.env` nếu chưa có
- Thêm `.team-tools/` vào `.gitignore`
- Backup hook cũ nếu `.git/hooks/commit-msg` đã tồn tại

### Cấu hình `.team-tools/.env`

Thành viên điền Web App URL do leader cung cấp vào `.team-tools/.env`:

```env
# Optional: override git config user.name
# REPORT_AUTHOR="Nguyen Van A"

# Google Apps Script Web App endpoint
SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"

# Optional: nếu leader có bật REPORT_SECRET trong Code.gs
# REPORT_SECRET="change-me"
```

Environment variables có thể override `.env`:

```bash
export SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"
export REPORT_AUTHOR="Nguyen Van A"
export REPORT_SECRET="change-me"
```

## Cách sử dụng

### Commit

```bash
git commit -m "TASK: Thêm bộ lọc báo cáo theo tuần"
git commit -m "BUG: Sửa lỗi gửi payload khi webhook lỗi"
git commit -m "UPDATE: Cập nhật định dạng báo cáo tuần"
```

Các message sau sẽ bị reject:

```bash
git commit -m "update code"
git commit -m "BUG: fix bug"
git commit -m "TASK: sửa lỗi"
```

### Preview report

```bash
python .team-tools/report.py --dry-run
```

### Gửi report tuần hiện tại

```bash
python .team-tools/report.py
```

### Gửi report cho tuần cụ thể

Dùng ISO week đầy đủ:

```bash
python .team-tools/report.py --week 2026-W24
```

Hoặc chỉ truyền số tuần, tool sẽ dùng ISO year hiện tại:

```bash
python .team-tools/report.py --week W24
```

### Gửi report cho author cụ thể

```bash
python .team-tools/report.py --author "Nguyen Van A"
```

Có thể kết hợp nhiều option:

```bash
python .team-tools/report.py --week W24 --author "Nguyen Van A" --dry-run
```

### Thêm summary notes

```bash
python .team-tools/report.py --performance-file /tmp/performance.txt
```

File summary nên gồm 2-5 bullet ngắn:

```text
- Hoàn thiện rule commit cho team
- Cập nhật weekly report gửi Google Sheets
- Bổ sung migrate dữ liệu Bugs/Updates sang Others
```

Nếu không truyền summary notes, cột `Summary` sẽ để trống nhưng report vẫn gửi bình thường.

### Dùng bằng Claude/Codex skill

Submit report:

```text
report
báo cáo tuần
/report
```

Preview report:

```text
preview report
xem trước report
```

Report tuần cụ thể:

```text
report W24
báo cáo tuần W24 của dev3
```

### Troubleshooting nhanh

Kiểm tra author hiện tại:

```bash
git config user.name
```

Chạy report với author chính xác:

```bash
python .team-tools/report.py --author "Exact Git Author Name" --dry-run
```

Nếu gặp HTTP 401/403 từ Apps Script, kiểm tra lại deployment:

- `Execute as`: `Me`
- `Who has access`: `Anyone`
- URL trong `.env` phải là Web App URL kết thúc bằng `/exec`

Nếu gặp `Unauthorized`, đảm bảo `REPORT_SECRET` trong `.env` giống với `REPORT_SECRET` trong `Code.gs`.
