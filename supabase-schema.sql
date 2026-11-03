-- NVU Academy IELTS Platform — Supabase Schema (mô tả)
-- Phản ánh cấu trúc database thật của project "nvu-academy" tại thời điểm cập nhật: 2026-11-03.
-- File này chỉ để tham khảo, KHÔNG chạy lại trên database đang dùng (các bảng đã tồn tại).
-- Phần RLS policy bên dưới là bản cũ, chưa đối chiếu với database — kiểm tra trên Supabase Dashboard.

-- =============================================
-- 1. CLASSES (lớp học)
-- =============================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_code TEXT UNIQUE NOT NULL,        -- ví dụ "FOUNDATION11", "IELTS13"
  class_name TEXT NOT NULL,               -- ví dụ "Foundation 11"
  teacher_id UUID,                        -- chưa có khoá ngoại
  created_at TIMESTAMPTZ DEFAULT NOW(),
  meow_enabled BOOLEAN DEFAULT FALSE      -- bật/tắt tính năng "meow" cho lớp
);

-- =============================================
-- 2. TEACHERS (giáo viên)
-- =============================================
-- Liên kết với auth.users. Lưu ý: đăng nhập giáo viên và trợ giảng
-- kiểm tra email trong bảng staff_emails, không dựa vào bảng này.
-- Bảng hiện đang rỗng — đây là bình thường.
CREATE TABLE IF NOT EXISTS teachers (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. STUDENTS (học sinh)
-- =============================================
-- Học sinh đăng nhập bằng tên + class_code (không dùng Supabase Auth).
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  class_code TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🎓',
  total_score INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (full_name, class_code)          -- tên + lớp là duy nhất (đã kiểm tra trên DB)
);

-- =============================================
-- 4. STUDENT PROFILES / EMAILS (thông tin mở rộng)
-- =============================================
CREATE TABLE IF NOT EXISTS student_profiles (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  birth_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_emails (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. STAFF EMAILS (giáo viên và trợ giảng được phép đăng nhập)
-- =============================================
CREATE TABLE IF NOT EXISTS staff_emails (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'assistant',
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. DAILY PRACTICE SCORES (điểm luyện tập hàng ngày)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  practice_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,              -- 'monday', 'tuesday', ...
  section TEXT NOT NULL,                  -- 'vocab', 'grammar', 'listening', ...
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 10,
  time_taken_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answers JSONB,
  practice_id TEXT,                       -- id bài luyện tập (ví dụ w2-mon-ielts13)
  voice_path TEXT,                        -- đường dẫn file ghi âm (nếu có)
  teacher_comment TEXT,
  UNIQUE (student_id, practice_date, section)  -- đã kiểm tra trên DB
);

-- =============================================
-- 7. WEEKLY QUIZ RESULTS (kết quả quiz tuần, /30)
-- =============================================
CREATE TABLE IF NOT EXISTS weekly_quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  quiz_date DATE NOT NULL,
  week_number INTEGER NOT NULL,
  part_a_score INTEGER DEFAULT 0,
  part_b_score INTEGER DEFAULT 0,
  part_c_score INTEGER DEFAULT 0,
  part_d_score INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,          -- /30
  max_score INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answers JSONB,
  part_seconds JSONB,
  quiz_id TEXT
);

-- =============================================
-- 8. ERROR LOGS (nhật ký lỗi của học sinh)
-- =============================================
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,               -- 'vocabulary', 'grammar', 'pronunciation', 'listening'
  error_content TEXT NOT NULL,
  correct_answer TEXT,
  context TEXT,
  source TEXT,                            -- 'daily_practice', 'weekly_quiz', 'writing', 'speaking'
  practice_date DATE DEFAULT CURRENT_DATE,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  review_streak INTEGER NOT NULL DEFAULT 0,
  last_review DATE,
  resolved_at TIMESTAMPTZ
);

-- =============================================
-- 9. ERROR VOICE ATTEMPTS (học sinh luyện đọc lại lỗi bằng giọng nói)
-- =============================================
CREATE TABLE IF NOT EXISTS error_voice_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  error_id UUID REFERENCES error_logs(id) ON DELETE CASCADE,
  target TEXT,
  path TEXT,
  verdict TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. WRITING SUBMISSIONS (bài writing nộp, điểm AI theo 4 tiêu chí)
-- =============================================
CREATE TABLE IF NOT EXISTS writing_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  essay TEXT NOT NULL,
  task_type TEXT DEFAULT 'task2',         -- 'task1' hoặc 'task2'
  tr_score NUMERIC(3,1),                  -- Task Response
  cc_score NUMERIC(3,1),                  -- Coherence & Cohesion
  lr_score NUMERIC(3,1),                  -- Lexical Resource
  gra_score NUMERIC(3,1),                 -- Grammatical Range & Accuracy
  overall_band NUMERIC(3,1),
  feedback_json JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. WRITING FEEDBACK (nhận xét writing theo từng mục luyện tập)
-- Đây là bảng mà writing.html và daily-practice.html đang dùng.
-- =============================================
CREATE TABLE IF NOT EXISTS writing_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  practice_id TEXT NOT NULL,
  practice_date DATE NOT NULL,
  item_id TEXT NOT NULL,
  text TEXT,
  feedback JSONB,
  overall NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. SPEAKING SUBMISSIONS (bài speaking nộp)
-- =============================================
CREATE TABLE IF NOT EXISTS speaking_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  transcript TEXT,                        -- từ Whisper
  audio_url TEXT,
  fluency_score NUMERIC(3,1),
  pronunciation_score NUMERIC(3,1),
  vocabulary_score NUMERIC(3,1),
  grammar_score NUMERIC(3,1),
  overall_band NUMERIC(3,1),
  feedback_json JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  task_type TEXT,
  target_text TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  parent_id UUID,
  teacher_comment TEXT,
  approved BOOLEAN NOT NULL DEFAULT FALSE
);

-- =============================================
-- 13. SCHEDULE (lịch học theo ngày của từng lớp)
-- =============================================
CREATE TABLE IF NOT EXISTS schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_code TEXT NOT NULL,
  day DATE NOT NULL,
  practice_id TEXT,
  vocab TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 14. MATERIALS (tài liệu của lớp — hiện chưa có dữ liệu)
-- =============================================
CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_code TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'slide',
  lesson_date DATE,
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime TEXT,
  size_bytes BIGINT,
  shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 15. MEOW (điểm meow của học sinh)
-- =============================================
CREATE TABLE IF NOT EXISTS meow_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('du', 'muon', 'nua', 'bu', 'khong')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meow_redeem (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  note TEXT,
  day DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 16. ATTENDANCE (điểm danh)
-- =============================================
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_code TEXT NOT NULL,
  day DATE NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_absent (
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  note TEXT,
  PRIMARY KEY (session_id, student_id)
);

-- =============================================
-- 17. VOCAB PROGRESS (tiến độ game từ vựng)
-- =============================================
CREATE TABLE IF NOT EXISTS vocab_progress (
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  days_done INTEGER NOT NULL DEFAULT 0,
  prog JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, game_id)
);

-- =============================================
-- 18. DAILY DRAFTS (bản nháp bài luyện tập đang làm dở)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_drafts (
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  practice_id TEXT NOT NULL,
  practice_date DATE NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, practice_id, practice_date)
);

-- =============================================
-- 19. RECORDING EXPORTS (xuất ghi âm sang Google Drive, chạy bằng cron)
-- =============================================
CREATE TABLE IF NOT EXISTS recording_exports (
  path TEXT PRIMARY KEY,
  class_code TEXT,
  drive_file_id TEXT,
  file_name TEXT,
  exported_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 20. VOICE REPLIES (phản hồi bằng giọng nói của giáo viên)
-- =============================================
CREATE TABLE IF NOT EXISTS voice_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  practice_id TEXT NOT NULL,
  practice_date DATE NOT NULL,
  section TEXT,
  path TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  comment TEXT
);

-- =============================================
-- 21. SKILL HISTORY (lịch sử làm đề theo kỹ năng)
-- =============================================
CREATE TABLE IF NOT EXISTS skill_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  skill TEXT NOT NULL CHECK (skill IN ('speaking', 'writing', 'reading', 'listening')),
  test_id TEXT NOT NULL,
  test_title TEXT,
  score NUMERIC,
  max_score NUMERIC,
  band NUMERIC,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- RLS đang BẬT trên tất cả bảng public (theo database).
-- Các policy dưới đây là bản cũ, chưa đối chiếu với database thật.
-- =============================================
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaking_submissions ENABLE ROW LEVEL SECURITY;

-- Public đọc bảng xếp hạng
CREATE POLICY "Public can read students" ON students FOR SELECT USING (true);
CREATE POLICY "Public can read daily_scores" ON daily_scores FOR SELECT USING (true);
CREATE POLICY "Public can read weekly_quiz_results" ON weekly_quiz_results FOR SELECT USING (true);

-- Học sinh ghi dữ liệu của mình
CREATE POLICY "Anyone can insert students" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update their score" ON daily_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert quiz results" ON weekly_quiz_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert error logs" ON error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert writing" ON writing_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert speaking" ON speaking_submissions FOR INSERT WITH CHECK (true);

-- Giáo viên đọc tất cả
CREATE POLICY "Teachers read all" ON error_logs FOR SELECT USING (true);
CREATE POLICY "Teachers read writing" ON writing_submissions FOR SELECT USING (true);
CREATE POLICY "Teachers read speaking" ON speaking_submissions FOR SELECT USING (true);

-- =============================================
-- SEED DATA — Classes của Mr. Nam (dữ liệu khởi đầu)
-- =============================================
INSERT INTO classes (class_code, class_name) VALUES
  ('FOUNDATION11', 'Foundation 11'),
  ('FOUNDATION12', 'Foundation 12'),
  ('PREIELTS12', 'Pre-IELTS 12'),
  ('IELTS13', 'IELTS 13'),
  ('LYTHUYET3', 'Lý thuyết 3')
ON CONFLICT (class_code) DO NOTHING;
