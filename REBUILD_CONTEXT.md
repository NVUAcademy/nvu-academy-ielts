# IELTS Studio — Context đầy đủ để rebuild

## Tổng quan dự án

Website học IELTS cho lớp "IELTS Foundation" của thầy Quý (Thanh Hóa).  
Có **2 phiên bản** được build từ cùng một codebase:

### Phiên bản 1: ielts-studio.html (full app, chạy trên claude.ai Artifact)
- Dùng `window.claude.use('db')`, `window.claude.use('user')`, `window.claude.use('assets')` để lưu dữ liệu, đăng nhập, upload video.
- Được publish tại: https://claude.ai/artifact/VBWsov21Ey1gvX38J3eKvi (private)
- Giáo viên truy cập bằng tài khoản Claude của mình; học sinh cần được share link + có tài khoản Claude hoặc guest access.

### Phiên bản 2: export/site/ (self-host, dùng Firebase thay thế Claude APIs)
- `export/site/claude-adapter.js` tạo lại đúng interface của `window.claude` bằng Firebase Firestore + Auth + Storage.
- Cấu hình Firebase điền vào `export/site/firebase-config.js`.
- Deploy bằng Firebase Hosting hoặc bất kỳ static host nào.

### Phiên bản 3: Foundation_Vocab_Quest.html (vocab-only, login-free)
- Chỉ có phần học từ vựng (20 từ/ngày × 6 màn chơi).
- Không cần đăng nhập; tiến độ lưu localStorage.
- Học sinh chụp màn hình phiếu tổng kết gửi Zalo cho thầy.
- Build từ vocab-quest/ bằng build.py.

---

## Cấu trúc file gốc

```
/home/claude/
├── ielts-studio.html          # Source chính (HTML + CSS + JS, ~185KB, 1748 dòng)
├── build_selfhost.py          # Script tạo export/ từ ielts-studio.html
├── Foundation_Vocab_Quest.html # Vocab-only standalone
├── Week1_100_tu_vung.tsv      # 100 từ vựng tuần 1
├── vocab-quest/
│   ├── core.js                # Logic app vocab quest (477 dòng)
│   ├── extra.css              # CSS bổ sung (55 dòng)
│   ├── build.py               # Build script
│   └── artifact.html          # Fragment đã build (dùng để publish artifact)
└── export/
    ├── HUONG-DAN.md           # Hướng dẫn deploy tiếng Việt
    ├── firebase.json
    ├── firestore.rules
    ├── storage.rules
    └── site/
        ├── index.html         # App chạy được (clone của ielts-studio + Firebase)
        ├── claude-adapter.js  # Firebase adapter (~200 dòng)
        ├── firebase-config.js # Điền firebaseConfig ở đây
        ├── assets/            # Heroes + foes JPG
        └── data/seed.json     # Dữ liệu khởi đầu
```

---

## Tech stack

- **Vanilla JS** (ES2020), không framework
- **Single-file app**: mọi HTML/CSS/JS trong 1 file, re-render bằng `render()` + string templates
- **Event delegation**: click handler trên document, dùng `data-*` attributes
- **State**: module-level `S` object, serialised vào localStorage
- **Styling**: CSS custom properties (`--primary`, `--bg`, v.v.), responsive, dark mode
- **TTS**: `speechSynthesis` API, mỗi nhân vật dùng voice khác nhau
- **No build tools**: chỉ Python script để inject config/assets

---

## Tính năng chính của ielts-studio.html

### Cổng học sinh
1. **Flashcard từ vựng** — lật 2 mặt (EN↔VI), có audio TTS
2. **Quiz từ vựng** — trắc nghiệm 4 đáp án, chọn cùng词性 làm distractor
3. **Fill the gap** — điền từ vào chỗ trống trong câu ví dụ
4. **Spelling** — nghe TTS rồi gõ lại từ
5. **Knight's Quest (Word Battle)** — đánh quái vật bằng cách trả lời câu hỏi từ vựng; 10 câu, 15 giây/câu (25 giây cho Ranger); hero abilities; HP, damage, boss
6. **Sound Duel** — nghe audio TTS rồi chọn từ đúng (phân biệt phát âm)
7. **Nhân vật** — 5 hero: Knight, Princess, Prince, Ranger, Sorceress; chọn 1 khi đăng ký; mỗi nhân vật có voice và ability riêng
8. **Tiến độ game** — mỗi từ có miss counter; "mastered" nếu ≤1 miss trong ngày
9. **Phiếu tổng kết / Certificate** — hiện sau khi qua hết 6 màn: số từ thuộc, điểm từng màn, trạng thái từng từ, timestamp, mã 5 ký tự, nút copy Zalo

### Cổng giáo viên (teacher dashboard)
- Xem danh sách học sinh, tiến độ, điểm số
- Thêm/sửa bài học, từ vựng, đề Speaking
- Error log (ghi lại các câu học sinh trả lời sai nhiều nhất)
- Quản lý lớp, mã lớp
- Import starter data

### Hệ thống dữ liệu (khi dùng Firebase)
```
Firestore collections:
- classes/{classId}     — thông tin lớp
- lessons/{lessonId}    — bài học, wordlist
- words/{wordId}        — từ vựng (word, ipa, vi, example, type)
- students/{uid}        — tên, lớp, nhân vật
- subs/{uid}            — bài nộp, progress, error log, game stats
```

---

## Vocab Quest (vocab-only version)

### Game flow
```
Welcome → Chọn tên → Home (chọn ngày) → Day view (6 stages) → Summary
```

### Stages (phải qua theo thứ tự)
| # | Tên | Yêu cầu pass |
|---|-----|-------------|
| 1 | Learn | Lật hết 20 thẻ |
| 2 | Quiz | ≥80% (16/20) |
| 3 | Fill the gap | ≥80% (≤10 câu) |
| 4 | Spelling | ≥80% (≤10 câu) |
| 5 | Word Battle | Đánh bại quái vật |
| 6 | Sound Duel | Đánh bại quái vật (âm thanh) |

### Config (CFG object, inject bởi build.py)
```js
const CFG = {
  id: "foundation",          // unique id, dùng làm localStorage key prefix
  cls: "IELTS Foundation",   // tên lớp
  title: "Foundation Vocab", // hiển thị
  perDay: 20,                // từ mỗi ngày
  pass: 0.8,                 // tỉ lệ pass
  lockByDate: true,          // chỉ mở ngày tiếp theo vào hôm sau
  weeks: [
    { week: 1, tsv: "...base64 encoded TSV content..." }
  ],
  img: { hero_knight: "data:image/jpeg;base64,...", ... }
}
```

### TSV format (từ vựng)
```
word\tipa\tvi_meaning\texample_sentence\tpart_of_speech
pronunciation\t/prəˌnʌnsiˈeɪʃən/\tcách phát âm\tGood pronunciation helps...\tn
```
(tab-separated, dòng đầu là header, 5 cột)

### localStorage keys
```
vq:{id}:profiles  — JSON array [{name, hero, created}]
vq:{id}:last      — string (tên học sinh đang dùng)
vq:{id}:prog:{nameKey}  — JSON {days: {w1d1: {fin, stages, words}, ...}}
```

### build.py usage
```bash
python3 build.py \
  --id foundation \
  --cls "IELTS Foundation" \
  --title "Foundation Vocab" \
  --week 1=../Week1_100_tu_vung.tsv \
  --week 2=../Week2_100_tu_vung.tsv \  # thêm tuần mới
  --out out.html \
  --per-day 20 \
  --pass-rate 0.8 \
  # --no-date-lock   # bỏ khoá theo ngày (dùng khi test)
  # --wrap           # tạo full HTML document thay vì fragment
```
Phụ thuộc vào: ielts-studio.html (lấy template) + assets/*.jpg (embed base64)

---

## Các điểm kỹ thuật quan trọng

### Hero abilities (Word Battle)
- Knight: +2 HP, double damage nếu streak ≥ 3
- Princess: hồi 2 HP sau mỗi câu đúng
- Prince: +3 HP, bỏ qua 1 câu sai/ngày
- Ranger: 25 giây thay vì 15 giây, có thể tấn công từ xa
- Sorceress: linh hồn trợ giúp, xem gợi ý 1 lần/ngày

### Distractor logic (Quiz)
- Ưu tiên chọn 3 từ cùng part-of-speech làm đáp án sai
- Nếu không đủ, lấy random từ dayWords()

### Miss counter → Mastered
- Mỗi lần trả lời sai: `word.miss++`
- Mastered: `word.miss <= 1` sau khi qua hết stage
- Từ miss cao được ưu tiên hỏi lại trong các stage sau

### Certificate code (5 ký tự)
- djb2 hash của `name|week|day|timestamp|masteredCount`
- Chỉ là dấu hiệu nhẹ, không verify được server-side

### TTS voices
- Knight: `en-GB` male
- Princess: `en-US` female, pitch cao
- Prince: `en-US` male
- Ranger: `en-AU` male
- Sorceress: `en-GB` female, pitch thấp

---

## Thư viện ngoài

Không có npm dependency. CDN dùng trong artifact:
- Google Fonts (Nunito) — thường bị block trong sandbox, fallback về system font
- Không có thư viện JS nào khác

---

## Để rebuild trong chat Claude mới

### Option A: Rebuild vocab quest từ đầu
1. Cung cấp file TSV từ vựng
2. Yêu cầu: "Tạo vocab quest app, 20 từ/ngày, 6 stages (learn→quiz→gap→spell→battle→sound), login-free localStorage, certificate cuối ngày, nút copy Zalo"
3. Tham khảo cấu trúc và config ở trên

### Option B: Sửa/thêm tính năng
- Đưa file `ielts-studio.html` (185KB) vào chat mới làm attachment
- Mô tả thay đổi cần làm

### Option C: Thêm tuần từ vựng mới
- Cung cấp file TSV tuần mới (format như Week1_100_tu_vung.tsv)
- Yêu cầu rebuild với `--week 2=new_file.tsv`
- Build script giữ nguyên progress key tuần cũ

### Option D: Deploy Firebase (website tổng)
- Cung cấp export/ folder
- Theo HUONG-DAN.md
- Điền firebaseConfig vào firebase-config.js

---

## Liên hệ / context
- Giáo viên: Quý, lớp IELTS Foundation, Thanh Hóa
- Email: uav.levietquy@gmail.com
- Quản lý và chấm bài học sinh qua Zalo
- Mục tiêu: 0 → 7.0 IELTS trong 2 năm
- Lộ trình: khóa Foundation 30 buổi (xem project doc: Khoa_Foundation_Lo_trinh_30_buoi.md)
