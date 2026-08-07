# FOOD DATA AUDIT V50

## Mục tiêu
Đồng bộ tuyệt đối dữ liệu hiển thị tại trang **Thực phẩm** với bộ nhận diện món được nhập từ Google Sheet/Excel.

## Quy tắc đã khóa
1. Mỗi tên món đang hiển thị được chuyển thành một hồ sơ nhận diện ưu tiên cao nhất, dùng đúng calo, đạm, carb, fat và khẩu phần của bảng.
2. Bí danh phổ biến được chuẩn hóa: mì/mỳ, bánh mì/bánh mỳ, heo/lợn, đậu hũ/đậu phụ, tên tiếng Anh và các tên rút gọn thường nhập.
3. Khối lượng `g`, thể tích `ml`, cùng các đơn vị bát, cốc, lon, miếng, cái, suất, đĩa, gói… được quy đổi theo khẩu phần ghi trên bảng.
4. Món không nhận diện **không được tự đoán**. Ngày đó chuyển sang trạng thái chưa đủ dữ liệu và chỉ rõ món cần bổ sung.
5. Dữ liệu từ USDA/Open Food Facts chỉ bổ sung cho món lạ khi có kết nối; không được ghi đè hồ sơ nội bộ đã chuẩn hóa.

## Kiểm tra dữ liệu chuẩn hóa
- 142 hồ sơ ưu tiên do người dùng lựa chọn.
- Không trùng ID.
- Không trùng tên chuẩn.
- Không thiếu calo, đạm, carb, fat, khẩu phần hoặc icon.
- Không có hồ sơ ngoài đồ uống có sai lệch năng lượng macro lớn hơn 22% so với công thức 4-4-9.

## Cách nhập khuyến nghị
- `150g Ức gà phi lê không da`
- `200 g Cơm gạo trắng`
- `1 bát Phở bò`
- `1 miếng Pizza BBQ chicken`
- `1 lon Coca`

Món ngoài hàng vẫn là giá trị tham chiếu theo khẩu phần chuẩn vì công thức, lượng dầu, topping và kích thước thực tế có thể thay đổi.
