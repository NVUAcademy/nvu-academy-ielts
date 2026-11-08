# NVU Academy IELTS: hướng dẫn làm việc cho Claude

Web học IELTS của thầy Nam (Lê Viết Hoài Nam). Triển khai trên Vercel từ nhánh `main`, dữ liệu ở Supabase (project `sxnxbbosfyapmmkrhcdj`).

## Quy tắc làm việc (bắt buộc)

- Trả lời bằng tiếng Việt, ngắn gọn. Chữ hiển thị trong web giữ tiếng Việt; hướng dẫn trong bài tập (exercise instructions) viết tiếng Anh.
- Đọc file trước khi sửa. Sửa xong thì tóm tắt thay đổi và chờ thầy gõ "commit". Chỉ commit và push khi thầy gõ "commit". Hook nhắc commit thì từ chối cho đến khi thầy gõ.
- Không chạy SQL ghi, sửa hoặc xóa dữ liệu khi chưa được thầy đồng ý. Đọc dữ liệu (SELECT) thì được. Không đổi cấu trúc bảng đang có; chỉ được thêm bảng mới khi thầy đồng ý.
- Không hiện và không hỏi API key trong chat. Khóa nằm ở biến môi trường trên Vercel.
- Kiểm tra bằng tài khoản Tester (Tester 1, 2, 3), không dùng học sinh thật.
- Không dán dữ liệu cá nhân của học sinh (ngày sinh, email) vào nơi công khai hoặc commit.
- Khi báo kết quả: nói rõ cái gì đã kiểm tra thật, cái gì chưa kiểm tra được.

## Cấu trúc

- Trang học sinh: `index.html` (Hôm nay cần làm, Meow, nhận xét của thầy), `daily-practice.html`, `weekly-quiz.html`, `errors.html` (nhật ký lỗi), `speaking.html`, `writing.html`, `listening.html`, `reading.html`, `ranking.html`, ba trang Vocab Quest (`Vocab_Quest_Inter.html` cho IELTS14, `Vocab_Quest_Pre.html` cho IELTS13, `Foundation_Vocab_Quest.html`), `login.html`.
- Trang giáo viên: `teacher-dashboard.html` (tab Ghi âm: quét bản ghi im lặng, chấm AI hàng loạt, nhận xét), `tro-giang.html` (trợ giảng).
- Bài Daily Practice: `daily-w{tuần}-{thứ}-{lớp}.json`, đăng ký trong `daily-index.json` (id, file, date, class_codes). Bước bài: `fill`, `mcq`, `open`, `voice`; đáp án chấp nhận thêm ở `accept`; nghe bằng `audio` (file mp3 hoặc `lines` để web tự tạo giọng).
- API (thư mục `api/`, đã đủ 12 hàm của gói Hobby, không thêm file mới; thêm tính năng bằng cách thêm `action` vào hàm có sẵn): `submit-daily`, `submit-weekly`, `draft`, `speaking-feedback`, `writing-feedback`, `error-voice`, `review-error`, `listening-audio`, `vq-progress`, `voice-reply`, `skill-history`, `export-recordings` (cron: xuất Drive, báo cáo email, tự chấm Meow).
- Dùng chung: `wav.js` (đổi WAV 16 kHz, đo bản ghi im lặng), `violation-guard.js` (chống rời bài: rời 30 giây trở lên hoặc đóng trình duyệt tính 1 lần, 3 lần thì khóa), `lib/meow-auto.js`.

## Lớp

`IELTS13` (Pre-IELTS 13), `IELTS14` (Inter 14), `FOUNDATION11`, `FOUNDATION12`, `LYTHUYET3`. AI chấm nói và viết chỉ mở cho IELTS13 và IELTS14 (biến `AI_CLASSES`). Học sinh đăng nhập bằng Gmail ghi trong `student_emails`; thêm học sinh = thêm `students`, `student_emails`, `student_profiles` (ngày sinh).

## Quy ước

- Ghi âm tối đa 5 phút; bản ghi dài được cắt đoạn ~60 giây và chép lời song song; bản ghi im lặng (đỉnh dưới 0,02) bị từ chối.
- Điểm bài Daily có thể là 0/0 nếu bài không có câu chấm tự động.
- Nhận xét AI dùng OpenAI chat (`OPENAI_CHAT_MODEL`, mặc định `gpt-4o-mini`), chép lời bằng Whisper, phát âm bằng Azure, giọng đọc bài nghe bằng ElevenLabs (hoặc Azure/Gemini nếu đặt `TTS_PROVIDER`).
- Lớp IELTS13 và IELTS14: mục nhận xét trên trang chủ ghi "Nhận xét của thầy"; các lớp khác ghi "Nhận xét từ trợ giảng".
- Mở một ngày Vocab Quest riêng cho một học sinh: thêm `unlock: {"w1d6": true}` vào `vocab_progress.prog` của học sinh đó.

## Biến môi trường trên Vercel (chỉ liệt kê tên)

`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `WHISPER_MODEL`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `ELEVENLABS_API_KEY`, `TTS_PROVIDER`, `GEMINI_API_KEY`, `AI_CLASSES`, `DAILY_LIMIT`, `WRITING_LIMIT`, `VOICE_DAILY_LIMIT`, `CRON_SECRET`, `GOOGLE_SA_JSON`, `DRIVE_FOLDERS`, `TEACHER_EMAILS`, `SITE_URL`, `RESEND_API_KEY` và `REPORT_TO`, `REPORT_FROM` (báo cáo email, hiện chưa đặt).

## Lưu ý kỹ thuật

- Nhật ký chạy của Vercel gói Hobby chỉ giữ 1 giờ; xem sớm khi có lỗi.
- Hàm chạy tối đa 60 giây; nhận xét AI phải xong trong thời gian đó.
- Supabase MCP hỏi xác nhận trước câu lệnh `DELETE`; hộp hỏi chỉ chờ 60 giây. Khi cần xóa, nếu không kịp xác nhận thì đổi mã bài thành `...-cu` để "cất" thay vì xóa.
