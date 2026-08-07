# In / Out Calorie PWA — Smart Food Input v19

Bản v19 tập trung vào nhận diện món và ưu tiên dữ liệu người dùng nhập:

- Nếu nhập tổng kcal/protein/carb/fat trực tiếp, các số đó là dữ liệu chuẩn và không bị engine tự thay đổi.
- `20g đạm` / `50g protein` không còn bị hiểu nhầm là 20 g / 50 g khối lượng món.
- Tên món được đối chiếu trước với toàn bộ cơ sở dữ liệu thực phẩm nội bộ của web.
- Bổ sung `Rau / vegetables` và `Cá cơm khô / dried anchovies` vào CSDL ưu tiên offline.
- Giữ cơ chế lookup nền cho món thực sự chưa có dữ liệu.
- Service Worker cache: `in-and-out-pwa-2026-08-07-v19`.
