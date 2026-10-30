# 🎓 NVU Academy — Hướng dẫn bàn giao dự án

> Tài liệu này giúp Claude session mới (hoặc developer khác) hiểu toàn bộ dự án và tiếp tục phát triển.

---

## 1. TỔNG QUAN DỰ ÁN

**Tên:** NVU Academy IELTS Learning Platform  
**Chủ:** Mr. Nam (Lê Việt Hoài Nam) — giáo viên IELTS  
**Mục tiêu:** Website học IELTS tích hợp AI cho học sinh của Mr. Nam  

### Stack công nghệ
| Thành phần | Dịch vụ | Ghi chú |
|---|---|---|
| Hosting code | GitHub | `github.com/NVUAcademy/nvu-academy-ielts` |
| Deploy website | Vercel | Auto-deploy khi push GitHub |
| Database + Auth | Supabase | Project `nvu-academy` |
| AI Writing | Claude API | Chấm essay theo 4 tiêu chí IELTS |
| AI Speaking | Whisper + Claude | Transcribe audio → chấm band |
| Frontend | Vanilla JS + HTML | Không dùng framework |

### URL quan trọng
- **Website live:** https://nvu-academy-ielts.vercel.app
- **GitHub repo:** https://github.com/NVUAcademy/nvu-academy-ielts
- **Supabase dashboard:** https://supabase.com/dashboard/project/sxnxbbosfyapmmkrhcdj
- **Supabase URL:** `https://sxnxbbosfyapmmkrhcdj.supabase.co`
- **Supabase Publishable Key:** `sb_publishable_OMyiSjOVcKOfRdZO9JwSZg_8XogOYkZ`

---

## 2. CẤU TRÚC FILE

```
nvu-academy-ielts/
├── index.html                  # Trang chủ — 6 feature cards
├── login.html                  # Login: Student gate + Teacher gate
├── Foundation_Vocab_Quest.html # Game học từ vựng (đã hoàn thiện)
├── supabase-schema.sql         # Schema database Supabase
├── core.js                     # Logic Vocab Quest
├── extra.css                   # CSS bổ sung
├── claude-adapter.js           # Firebase adapter cũ (đang thay bằng Supabase)
├── Week1_100_tu_vung.tsv       # Dữ liệu từ vựng tuần 1
├── REBUILD_CONTEXT.md          # Context website cũ (Firebase)
└── HANDOVER_GUIDE.md           # File này
```

---

## 3. DATABASE SUPABASE

### Các bảng đã tạo
```
classes             — Danh sách lớp (Foundation11, IELTS13, v.v.)
teachers            — Giáo viên (link với Supabase Auth)
students            — Học sinh (login bằng tên + class code)
daily_scores        — Điểm luyện tập hàng ngày (Thứ 2–5)
weekly_quiz_results — Kết quả quiz cuối tuần /30
error_logs          — Nhật ký lỗi từng học sinh
writing_submissions — Bài writing nộp + điểm AI
speaking_submissions— Bài speaking + transcript + điểm AI
```

### Các lớp đã seed
- `FOUNDATION11` — Foundation 11
- `FOUNDATION12` — Foundation 12
- `PREIELTS12` — Pre-IELTS 12
- `IELTS13` — IELTS 13
- `LYTHUYET3` — Lý thuyết 3

### Kết nối Supabase trong code
```javascript
const SUPABASE_URL = 'https://sxnxbbosfyapmmkrhcdj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OMyiSjOVcKOfRdZO9JwSZg_8XogOYkZ';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

---

## 4. HỆ THỐNG LOGIN

### Student login (không cần tài khoản)
- Nhập **tên** + chọn **lớp** → tự động tạo/tìm record trong bảng `students`
- Session lưu vào `localStorage` với key `nvu_student`
- Format: `{ id, name, classCode, avatar }`

### Teacher login (Supabase Auth)
- Email + Password → `db.auth.signInWithPassword()`
- Session lưu vào `localStorage` với key `nvu_teacher`
- Cần tạo tài khoản teacher trong Supabase: Authentication → Users → Add user

---

## 5. THIẾT KẾ GIAO DIỆN

### Design system
- **Màu chủ:** Pastel kem `#f5f0eb`, xanh lá nhạt, hồng nhạt
- **Font:** Playfair Display (serif, tiêu đề) + Cormorant Garamond (italic) + Inter (body)
- **Style:** Sang trọng, học thuật — giống IELTS Studio (`ielts-with-nam.web.app`)
- **Card shape:** Hình vòm (border-radius lớn ở trên)

### Màu sắc
```css
background: #f5f0eb      /* kem nhạt */
student: #5a8a5a / #e8f0e8  /* xanh lá */
teacher: #2c2416 / #f0e8e8  /* nâu đậm / hồng nhạt */
gold accent: #8B6914     /* vàng gold */
text: #2c2416            /* nâu đậm */
muted: #8B7355           /* nâu nhạt */
```

---

## 6. NHỮNG GÌ ĐÃ LÀM XONG ✅

- [x] GitHub repo + Vercel deploy (auto-deploy)
- [x] Trang chủ `index.html` với 6 feature cards
- [x] Vocab Quest game (Foundation_Vocab_Quest.html) — hoàn chỉnh
- [x] Supabase database schema (8 bảng + RLS policies)
- [x] Login page với Student gate + Teacher gate (pastel style)
- [x] localStorage session management

---

## 7. VIỆC CẦN LÀM TIẾP ⏳

### Ưu tiên cao
- [ ] **Daily Practice pages** (Thứ 2–Thứ 5): Vocab + Grammar + Listening có timer
- [ ] **Weekly Quiz page**: /30 điểm, 4 parts A B C D
- [ ] **Teacher Dashboard**: xem điểm, error log, quản lý học sinh
- [ ] **Tạo tài khoản teacher** trong Supabase Auth cho Mr. Nam

### Ưu tiên trung
- [ ] **Bảng xếp hạng** (ranking real-time từ Supabase)
- [ ] **AI Writing checker** (cần Claude API key)
- [ ] **AI Speaking coach** (cần OpenAI Whisper API key)

### Ưu tiên thấp
- [ ] **Giao diện thi IELTS như thật** (Listening/Reading/Writing/Speaking full test)
- [ ] **Upload đề thi** bởi giáo viên
- [ ] **Error log dashboard** cho giáo viên

---

## 8. CÁCH PUSH CODE (Claude có quyền push)

Claude session đã được cấp quyền push lên `NVUAcademy/nvu-academy-ielts` qua GitHub connector. Chỉ cần:

```bash
cd /home/claude/nvu-academy-ielts
git add .
git commit -m "mô tả thay đổi"
git push origin main
# Vercel tự động deploy trong ~1 phút
```

---

## 9. YÊU CẦU VỀ PHONG CÁCH CỦA MR. NAM

- Giao diện **sang trọng, học thuật** — không flashy
- Giống phong cách website cũ: `ielts-with-nam.web.app`
- Font serif + màu pastel kem/xanh/hồng
- **Tiếng Việt** cho label và hướng dẫn, **Tiếng Anh** cho các thuật ngữ IELTS
- Học sinh đăng nhập **không cần tài khoản** (chỉ tên + lớp)
- Ngân sách AI: **5 triệu VND/tháng (~$200)**

---

## 10. CONTEXT BỔ SUNG

Website cũ (Firebase) đã có:
- IELTS Studio với teacher dashboard
- Vocab Quest game 6 vòng (Learn → Quiz → Gap → Spell → Battle → Sound)
- Daily practice artifacts (Thứ 2–Thứ 5) đã có nội dung
- Weekly quiz /30 đã có nội dung
- File `REBUILD_CONTEXT.md` trong repo có đầy đủ chi tiết kỹ thuật website cũ

Để đọc thêm: xem `REBUILD_CONTEXT.md` trong cùng thư mục.
