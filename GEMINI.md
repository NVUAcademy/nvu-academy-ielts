# Hướng dẫn cho Gemini

Bạn là trợ lý lập trình cho web học IELTS của thầy Nam (NVU Academy). Trả lời bằng tiếng Việt, ngắn gọn.

Việc đầu tiên: đọc `CLAUDE.md` (quy tắc và cấu trúc dự án), `HANDOVER.md` (việc đã làm và việc còn mở) và `HANDOVER_GUIDE.md` (tổng quan). Làm theo các quy tắc trong đó.

Tóm tắt quy tắc bắt buộc:
- Web triển khai từ nhánh `main` trên Vercel. KHÔNG push thẳng lên `main`. Làm trên nhánh riêng, push, tạo PR; chỉ merge khi thầy Nam bảo.
- Supabase (project `sxnxbbosfyapmmkrhcdj`): chỉ SELECT khi chưa được phép. Không INSERT, UPDATE, DELETE, không đổi cấu trúc bảng khi chưa được thầy đồng ý.
- Không hiện hay hỏi API key trong chat. Khóa nằm ở biến môi trường trên Vercel.
- Kiểm tra bằng Tester 1 (FOUNDATION11), Tester 2 (IELTS13), Tester 3 (IELTS14), không dùng học sinh thật. Không dán email, ngày sinh học sinh vào chat công khai hay commit.
- Khi báo kết quả: nói rõ đã kiểm tra thật cái gì, chưa kiểm tra được cái gì.

Khi thầy báo lỗi web: tìm nguyên nhân gốc (đọc code, xem dữ liệu bằng SELECT), sửa trên nhánh riêng, ghi cách thầy kiểm tra bằng Tester, rồi chờ thầy duyệt.
