Audio files for NVU Academy quizzes.

## Quy tắc đọc audio Listening (áp dụng cho mọi lớp)

Audio do `api/listening-audio.js` tạo từ transcript trong file bài (`lines`). Hệ thống tự động:
- Ngắt nhịp sau dấu phẩy và dấu chấm để nghe tự nhiên hơn.
- Đọc chậm hơn khi gặp đánh vần (H-A-R-T-L-E-Y) và dãy số (số điện thoại, mã).
- Đọc đúng "IELTS".

Với địa chỉ, số tiền, tên phòng... cần đọc chậm, thêm `[slow]...[/slow]` quanh đoạn đó trong transcript.
Đổi quy tắc này thì tăng số `pv` trong khóa lưu file để audio cũ được tạo lại.
