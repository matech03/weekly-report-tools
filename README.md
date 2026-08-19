# weekly-report-tools

Bộ tool nhẹ để chuẩn hóa commit message và gửi báo cáo commit hằng tuần lên Google Sheets.

**Mục lục:** [Tổng quan](#tổng-quan) · [Leader](#leader) · [Dev](#dev)

## Tổng quan

### Cấu trúc project

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

### Tính năng

#### Commit rule

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

#### Weekly report

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

Cột `Note` trong Google Sheets có thể nhập từ prompt nhiều dòng khi dùng Claude/Codex. Nếu không gửi note mới, giá trị `Note` hiện có sẽ được giữ lại khi submit lại cùng tuần/member/repository.

#### Claude/Codex report skill

Sau khi cài đặt, có thể gọi report bằng:

```text
report
preview report
/report
```

Mặc định `report` sẽ gửi lên Google Sheets. Chỉ chạy preview khi prompt có ý rõ như `preview`, `xem trước`, `dry-run`.

Prompt report có thể dùng cấu trúc 3 dòng để điền cột `Summary`:

```text
report
Vấn đề 1; Vấn đề 2
Plan 1; Plan 2
```

- Dòng 1 là câu lệnh report để mapping skill.
- Dòng 2 là `Vấn đề`; nếu có nhiều ý thì cách nhau bằng dấu `;` trên cùng dòng.
- Dòng 3 là `Plan tuần tới`; nếu có nhiều ý thì cách nhau bằng dấu `;` trên cùng dòng.

`report.py` và Google Apps Script sẽ tự parse dòng 2/3 thành:

```text
Vấn đề:
- ý 1
- ý 2

Plan tuần tới:
- ý 1
- ý 2
```

Nếu prompt nhiều dòng nhưng không theo cấu trúc 3 dòng trên, dòng đầu là yêu cầu báo cáo; từ dòng thứ 2 trở đi là nội dung cột `Note` và có thể ghi bất kỳ:

```text
báo cáo tuần W30
Kế hoạch tuần tới: hoàn thiện flow thanh toán
Vấn đề trong tuần: chờ API từ backend
```

### Yêu cầu

- Git 2.x
- Python 3.7+
- Google Apps Script Web App URL kết thúc bằng `/exec`

## Leader

Leader chuẩn bị Google Sheet và webhook dùng chung cho team:

1. Mở Google Sheet nhận report.
2. Vào `Extensions` > `Apps Script`.
3. Paste nội dung `google-apps-script/Code.gs`.
4. Kiểm tra `SPREADSHEET_ID` trong `Code.gs`.
5. Deploy dạng `Web app`:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
6. Copy Web App URL kết thúc bằng `/exec`.
7. Cập nhật URL này vào cấu hình mặc định của installer nếu webhook thay đổi.

Nếu cần bảo vệ webhook, leader đặt `REPORT_SECRET` trong `Code.gs` và cấu hình cùng giá trị đó trong installer.

## Dev

### 1. Cài đặt 1 lần

Chạy trong thư mục root của project cần dùng report:

```bash
curl -fsSL https://raw.githubusercontent.com/matech03/weekly-report-tools/main/report-tools-installer.sh -o report-tools-installer.sh
bash report-tools-installer.sh
rm report-tools-installer.sh
```

Installer sẽ tự cài hook commit, tool report, Claude/Codex skill và cấu hình report mặc định.

### 2. Commit hằng ngày

Commit theo đúng prefix để cuối tuần report tự phân loại:

```bash
git commit -m "TASK: Thêm bộ lọc báo cáo theo tuần"
git commit -m "BUG: Sửa lỗi gửi payload khi webhook lỗi"
git commit -m "UPDATE: Cập nhật định dạng báo cáo tuần"
```

Các message quá chung chung sẽ bị reject:

```bash
git commit -m "update code"
git commit -m "BUG: fix bug"
git commit -m "TASK: sửa lỗi"
```

### 3. Cuối tuần report

Gửi report tuần hiện tại:

```bash
python .team-tools/report.py
```

Xem trước, chưa gửi lên Google Sheets:

```bash
python .team-tools/report.py --dry-run
```

Report tuần cụ thể:

```bash
python .team-tools/report.py --week 2026-W24
python .team-tools/report.py --week W24
```

Report cho author cụ thể:

```bash
python .team-tools/report.py --author "Nguyen Van A"
```

Gửi nội dung cột `Note` trực tiếp:

```bash
python .team-tools/report.py --note "Kế hoạch tuần tới: hoàn thiện flow thanh toán"
python .team-tools/report.py --note-file /path/to/note.txt
```

Có thể kết hợp nhiều option:

```bash
python .team-tools/report.py --week W24 --author "Nguyen Van A" --dry-run
python .team-tools/report.py --week W24 --note-file /path/to/note.txt
```

Dùng Claude/Codex:

```text
report
báo cáo tuần
/report
preview report
xem trước report
report W24
báo cáo tuần W24 của dev3
báo cáo tuần W30
Kế hoạch tuần tới: hoàn thiện flow thanh toán
Vấn đề trong tuần: chờ API từ backend
```

Nếu muốn gửi kèm vấn đề và plan tuần tới vào cột `Summary`, nhập 3 dòng:

```text
report
Không có blocker; Cần chờ review API
Hoàn tất màn hình report; Bổ sung test webhook
```

Google Sheets sẽ lưu vào cột `Summary` theo dạng:

```text
Vấn đề:
- Không có blocker
- Cần chờ review API

Plan tuần tới:
- Hoàn tất màn hình report
- Bổ sung test webhook
```

Nếu muốn gửi nội dung cột `Note`, dùng prompt nhiều dòng không theo cấu trúc summary 3 dòng, hoặc dùng `--note`/`--note-file`.
Nếu không truyền summary notes, cột `Summary` sẽ để trống nhưng report vẫn gửi bình thường. Nếu không truyền note, cột `Note` hiện có trên Google Sheets sẽ được giữ nguyên khi submit lại.

### Troubleshooting nhanh

Kiểm tra author hiện tại:

```bash
git config user.name
```

Chạy report với author chính xác:

```bash
python .team-tools/report.py --author "Exact Git Author Name" --dry-run
```

Nếu gặp HTTP 401/403 từ Apps Script, leader kiểm tra lại deployment:

- `Execute as`: `Me`
- `Who has access`: `Anyone`
- Web App URL trong cấu hình mặc định phải kết thúc bằng `/exec`

Nếu gặp `Unauthorized`, leader kiểm tra `REPORT_SECRET` trong `Code.gs` và cấu hình mặc định của installer.
