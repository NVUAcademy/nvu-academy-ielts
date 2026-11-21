# Bàn giao công việc (cập nhật 21/11/2026)

Đọc CLAUDE.md trước. File này ghi các việc đã làm gần đây và việc còn mở. Hướng dẫn tổng quan nằm ở HANDOVER_GUIDE.md.

## Quy tắc đã thỏa thuận
- Tự commit và push lên nhánh làm việc, chỉ hỏi thầy khi lỗi. Tạo PR và merge vào `main` chỉ khi thầy bảo.
- SQL ghi, sửa, xóa dữ liệu phải được thầy đồng ý trước. SELECT thì được.
- Không dán ngày sinh, email học sinh ra ngoài hoặc vào commit.
- Kiểm tra bằng Tester 1 (FOUNDATION11), Tester 2 (IELTS13), Tester 3 (IELTS14).

## Hiểu biết kỹ thuật dễ vấp
1. Danh sách bài Daily Practice của học sinh lấy từ bảng `schedule` (class_code, day, practice_id) trong Supabase, không chỉ từ `daily-index.json`. Lớp đã có dòng trong `schedule` thì web chỉ hiện các bài có dòng đó. Thêm bài mới phải: (a) thêm file `daily-w{tuần}-{thứ}-{lớp}.json`, (b) đăng ký trong `daily-index.json`, (c) INSERT dòng vào `schedule` (cần thầy đồng ý).
2. Gia hạn hạn nộp: sửa `DEADLINE_EXTEND_CLASS` ở cả `lib/meow-auto.js` và `meow.js`, giữ hai nơi giống nhau. Hạn mặc định: IELTS13 23:30, IELTS14 0:00 hôm sau, lớp khác 23:00.
3. Khoá "rời bài" (`violation-guard.js`) lưu ở `daily_drafts.answers._v` theo từng bài, không phải khoá cả tài khoản. Mở khoá = xóa trường `_v` của bài đó.
4. Mở Vocab Quest ngày bị khoá cho một học sinh: thêm `unlock: {"w1d6": true}` vào `vocab_progress.prog`.
5. Đăng nhập học sinh chỉ lưu `localStorage` khóa `nvu_student` (id, name, classCode, avatar). Khi kiểm tra bằng Playwright có thể đặt khóa này để vào bằng Tester.
6. Môi trường cloud chặn host lạ. Môi trường riêng "nvu-academy-ielts" cho phép `nvu-academy-ielts.vercel.app`, `cdn.jsdelivr.net`, `sxnxbbosfyapmmkrhcdj.supabase.co` để chạy thử bản đã triển khai.

## Đã hoàn thành (đã vào main)
- Sửa audio bị cắt khi chọn đáp án (`daily-practice.html` giữ khung `.audio-box` khi vẽ lại).
- Watermark "© NVU Academy" và tên học sinh, dòng bản quyền (`watermark.js`, gắn vào 14 trang học sinh).
- Foundation 11 tuần 6: bài bù thứ Sáu 20/11 và thứ Bảy 21/11, thêm dòng `schedule`, gia hạn bài thứ Sáu đến 23:00 ngày 21/11.
- IELTS14 tuần 4: bài bù thứ Sáu 20/11, thứ Bảy 21/11, Chủ nhật 22/11, thêm dòng `schedule`, gia hạn bài thứ Sáu đến 0:00 ngày 22/11.
- Đã kiểm tra bằng Tester 1 và Tester 3 trên bản triển khai: danh sách hiện đủ bài; Tester 3 làm và nộp `w4-fri-ielts14` được 10/10, điểm lưu đúng.

## Việc còn mở
1. Meow: sáng 22/11 xem Meow bài thứ Sáu của Foundation 11 và IELTS14 có tính đúng không (cron chấm sau hạn). Chưa kiểm tra được.
2. Nhận xét AI về bài viết của `w4-fri-ielts14` (Tester 3) chưa xác nhận hoàn tất. Bài nộp thử của Tester 3 vẫn nằm trong dữ liệu (xóa cần thầy đồng ý).
3. Mỗi tuần mới: kiểm tra từng lớp có đủ file bài, mục trong `daily-index.json` và dòng `schedule` trước ngày học.
4. Bảng xếp hạng (`ranking.html`): chưa xác nhận có ẩn Tester không.
5. Nếu có người ngoài dùng thử bằng link chính: xem lại `DAILY_LIMIT`, `WRITING_LIMIT`.
6. Một học sinh IELTS13 báo "Track 29 nghe hơi giống anh ấn". File `audio/mindset-l1-unit3-speaking-p1.mp3` đúng là Track 29 (thầy xác nhận), chưa rõ ý học sinh.
7. Chống sao chép: giao diện web không thể chống sao chép hoàn toàn. Hướng đã thống nhất: giữ phần quý ở API và Supabase, watermark (đã làm), thỏa thuận bảo mật bằng văn bản. Thầy chọn không làm link demo riêng.
