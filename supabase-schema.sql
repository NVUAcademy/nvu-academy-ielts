-- NVU Academy IELTS Platform — Supabase Schema
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. CLASSES (lớp học)
-- =============================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_code TEXT UNIQUE NOT NULL,        -- e.g. "FOUNDATION11", "IELTS13"
  class_name TEXT NOT NULL,               -- e.g. "Foundation 11"
  teacher_id UUID,                        -- linked to teachers table
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. TEACHERS (giáo viên)
-- =============================================
-- Teachers use Supabase Auth (email + password)
-- This table extends auth.users with profile info
CREATE TABLE IF NOT EXISTS teachers (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. STUDENTS (học sinh)
-- =============================================
-- Students login with name + class_code (no Auth needed)
-- We generate a session token manually
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
  UNIQUE(full_name, class_code)            -- tên + lớp là unique
);

-- =============================================
-- 4. DAILY PRACTICE SCORES (điểm luyện tập hàng ngày)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  practice_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,              -- 'monday', 'tuesday', etc.
  section TEXT NOT NULL,                  -- 'vocab', 'grammar', 'listening'
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 10,
  time_taken_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, practice_date, section)
);

-- =============================================
-- 5. WEEKLY QUIZ RESULTS (kết quả quiz tuần)
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
  UNIQUE(student_id, week_number)
);

-- =============================================
-- 6. ERROR LOGS (nhật ký lỗi của học sinh)
-- =============================================
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,               -- 'vocabulary', 'grammar', 'pronunciation', 'listening'
  error_content TEXT NOT NULL,            -- từ/câu bị sai
  correct_answer TEXT,                    -- đáp án đúng
  context TEXT,                           -- ngữ cảnh câu hỏi
  source TEXT,                            -- 'daily_practice', 'weekly_quiz', 'writing', 'speaking'
  practice_date DATE DEFAULT CURRENT_DATE,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. WRITING SUBMISSIONS (bài writing nộp)
-- =============================================
CREATE TABLE IF NOT EXISTS writing_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,                   -- đề bài
  essay TEXT NOT NULL,                    -- bài viết
  task_type TEXT DEFAULT 'task2',         -- 'task1' or 'task2'
  -- AI scores (0-9 each)
  tr_score NUMERIC(3,1),                  -- Task Response
  cc_score NUMERIC(3,1),                  -- Coherence & Cohesion
  lr_score NUMERIC(3,1),                  -- Lexical Resource
  gra_score NUMERIC(3,1),                 -- Grammatical Range & Accuracy
  overall_band NUMERIC(3,1),
  feedback_json JSONB,                    -- detailed AI feedback
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. SPEAKING SUBMISSIONS (bài speaking nộp)
-- =============================================
CREATE TABLE IF NOT EXISTS speaking_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  transcript TEXT,                        -- từ Whisper
  audio_url TEXT,                         -- Supabase Storage URL
  -- AI scores
  fluency_score NUMERIC(3,1),
  pronunciation_score NUMERIC(3,1),
  vocabulary_score NUMERIC(3,1),
  grammar_score NUMERIC(3,1),
  overall_band NUMERIC(3,1),
  feedback_json JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaking_submissions ENABLE ROW LEVEL SECURITY;

-- Allow public read for leaderboard
CREATE POLICY "Public can read students" ON students FOR SELECT USING (true);
CREATE POLICY "Public can read daily_scores" ON daily_scores FOR SELECT USING (true);
CREATE POLICY "Public can read weekly_quiz_results" ON weekly_quiz_results FOR SELECT USING (true);

-- Allow insert/update for students (by matching student session)
CREATE POLICY "Anyone can insert students" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update their score" ON daily_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert quiz results" ON weekly_quiz_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert error logs" ON error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert writing" ON writing_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert speaking" ON speaking_submissions FOR INSERT WITH CHECK (true);

-- Teachers can read everything
CREATE POLICY "Teachers read all" ON error_logs FOR SELECT USING (true);
CREATE POLICY "Teachers read writing" ON writing_submissions FOR SELECT USING (true);
CREATE POLICY "Teachers read speaking" ON speaking_submissions FOR SELECT USING (true);

-- =============================================
-- SEED DATA — Classes của Mr. Nam
-- =============================================
INSERT INTO classes (class_code, class_name) VALUES
  ('FOUNDATION11', 'Foundation 11'),
  ('FOUNDATION12', 'Foundation 12'),
  ('PREIELTS12', 'Pre-IELTS 12'),
  ('IELTS13', 'IELTS 13'),
  ('LYTHUYET3', 'Lý thuyết 3')
ON CONFLICT (class_code) DO NOTHING;
