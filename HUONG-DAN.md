# IELTS Studio — hướng dẫn đưa lên tên miền riêng

Trang học của lớp IELTS Foundation: cổng giáo viên và cổng học sinh, bài tập, flashcard có phát âm, trò chơi Knight's Quest và Sound Duel, nhân vật, lesson hub, error log, điểm thưởng và học phí.

## Trong file zip có gì

| Thư mục / file | Dùng để làm gì |
|---|---|
| `site/` | **Toàn bộ website để đưa lên tên miền.** |
| `site/index.html` | Trang web, một file duy nhất gồm HTML, CSS và JS. |
| `site/claude-adapter.js` | Lớp kết nối Firebase: đăng nhập, cơ sở dữ liệu, upload video. |
| `site/firebase-config.js` | **Chỗ duy nhất cần điền cấu hình.** |
| `site/assets/` | 5 tranh nhân vật và 5 tranh quái vật. |
| `site/data/seed.json` | Dữ liệu khởi đầu: 2 lớp, 4 bài học, 128 từ vựng (gồm 100 từ Week 1), đề Speaking, bài mẫu, bài tập. |
| `firestore.rules`, `storage.rules` | Quy tắc bảo mật: ai được đọc và ghi dữ liệu nào. |
| `firebase.json` | Cấu hình Firebase Hosting. |
| `claude-artifact-version/` | Bản gốc đang chạy trên claude.ai, để tham khảo, **không dùng để host**. |

## Vì sao cần Firebase

Bản gốc chạy trong claude.ai và dùng `window.claude.use('db' | 'user' | 'assets')` của Claude để lưu dữ liệu và nhận biết người dùng. Ra ngoài claude.ai thì không còn các API đó, nên `claude-adapter.js` tạo lại đúng giao diện đó bằng Firebase:

- `db` → **Cloud Firestore**. Trang dùng `doc() / collection() / onSnapshot() / set() / delete()`, trùng với API Firestore bản compat, nên gần như không phải sửa gì.
- `user` → **Firebase Authentication**. Học sinh tự tạo tài khoản bằng email và mật khẩu, hoặc đăng nhập Google.
- `assets` → **Cloud Storage**, chỉ để học sinh upload video bài nói.

Không cần server riêng. Với một lớp 8 người, gói miễn phí (Spark) đủ dùng cho Hosting, Auth và Firestore. Theo chính sách hiện tại của Firebase, **Cloud Storage có thể yêu cầu nâng lên gói Blaze** (trả theo mức dùng; với lớp nhỏ thường gần như 0đ). Nếu không muốn bật Storage, trang vẫn chạy bình thường: học sinh nộp video bằng link Google Drive hoặc YouTube.

## Các bước triển khai (khoảng 20–30 phút)

1. **Tạo project** tại https://console.firebase.google.com
2. **Authentication** → Sign-in method → bật **Email/Password** và **Google**.
   Vào **Settings → Authorized domains** → thêm tên miền mới (ví dụ `ielts.tenmien.vn`).
3. **Firestore Database** → Create database (chọn vùng `asia-southeast1`, Singapore).
4. *(Tuỳ chọn)* **Storage** → Get started, nếu muốn cho upload video.
5. **Project settings → Your apps → Web app (`</>`)** → copy đoạn `firebaseConfig` vào `site/firebase-config.js`.
6. Cài Firebase CLI và đưa lên mạng:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add          # chọn project vừa tạo
   firebase deploy             # deploy hosting + firestore.rules (+ storage.rules nếu đã bật Storage)
   ```
   Nếu chưa bật Storage, dùng `firebase deploy --only hosting,firestore`.
7. **Thiết lập giáo viên:**
   - Anh Quý mở trang, tạo tài khoản và đăng nhập. Góc phải màn hình sẽ hiện **user id**.
   - Dán id đó vào 3 chỗ: `TEACHER_UID` trong `site/firebase-config.js`, và `TEACHER_UID_HERE` trong `firestore.rules` và `storage.rules`.
   - Chạy lại `firebase deploy`.
8. **Nhập dữ liệu khởi đầu:** giáo viên tải lại trang, bấm **Import starter data** (chỉ hiện khi database còn trống).
9. **Gắn tên miền:** Hosting → **Add custom domain** → làm theo hướng dẫn thêm bản ghi DNS (A/TXT) ở nơi mua tên miền. Firebase tự cấp HTTPS.

Muốn chạy trên hosting khác (Netlify, Vercel, cPanel…) thì chỉ cần upload thư mục `site/` lên. Firestore, Auth và Storage vẫn dùng của Firebase, và vẫn phải deploy `firestore.rules` bằng CLI hoặc dán vào Firebase console.

## Phân quyền

| Dữ liệu | Học sinh | Giáo viên |
|---|---|---|
| Lớp, bài học, từ vựng, đề, bài mẫu, bài tập, cài đặt giao diện | đọc | đọc + ghi |
| `students/{uid}`: tên, lớp, nhân vật | đọc tất cả, ghi của mình | đọc + ghi |
| `subs/{uid}`: bài nộp, từ đã thuộc, error log, tiến độ game | chỉ của mình | tất cả |
| `chat/{uid}`: bình luận lesson hub | đọc tất cả, ghi của mình | tất cả |
| `grades/{uid}`: điểm, nhận xét, điểm thưởng | đọc của mình | đọc + ghi |
| `data/users/{uid}/fees`: học phí | không | chỉ giáo viên |

Học sinh vào lớp bằng **mã lớp** (lớp thật hiện là `FOUNDATION`). Giáo viên đổi mã trong cổng giáo viên → Classes.

## Ghi chú kỹ thuật

- Phát âm dùng `speechSynthesis` của trình duyệt, nên miễn phí nhưng giọng phụ thuộc thiết bị.
- Font tải từ Google Fonts. Firebase SDK tải từ `gstatic.com` (bản compat 10.12.2).
- Mọi file nộp lên được lưu dưới dạng download URL đầy đủ (`blobUrl()` trong `index.html` nhận cả URL lẫn id kiểu claude.ai cũ).
- Dữ liệu học sinh thử nghiệm trên bản claude.ai **không** có trong `seed.json`. Học sinh thật sẽ đăng ký lại từ đầu trên tên miền mới.
- Tranh nhân vật hiện là 200×200 px. Có thể thay bằng ảnh nét hơn cùng tên file trong `site/assets/`.
