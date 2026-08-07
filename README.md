# In / Out Calorie PWA — Fast Recognition v18

## Đã sửa

- Bổ sung nhận diện ưu tiên cho: **vịt quay**, **mì vịt quay**, **phở bò**, **bún ngan** và các cách nhập `1 bát`, `1 tô`, có/không dấu.
- Tạo chỉ mục món ăn một lần thay vì quét lại toàn bộ cơ sở dữ liệu ở từng phép tính; giảm đáng kể độ trễ và tình trạng đơ trên điện thoại.
- Việc tra món trực tuyến chuyển sang chạy nền, tối đa 3 món song song, timeout ngắn hơn; không còn chặn quá trình đồng bộ và hiển thị số liệu.
- Chặn nhiều lần cập nhật chạy chồng lên nhau khi bấm nút liên tục.
- Tăng Service Worker cache lên `in-and-out-pwa-2026-07-27-v18` để thiết bị nhận đúng bản mới.

## Cách cập nhật

1. Giải nén ZIP.
2. Upload toàn bộ file bên trong vào thư mục gốc repository và ghi đè file cũ.
3. Đóng hẳn PWA/trình duyệt rồi mở lại.
4. Nếu vẫn thấy bản cũ, xóa dữ liệu trang hoặc gỡ PWA và cài lại một lần để xóa cache cũ.
