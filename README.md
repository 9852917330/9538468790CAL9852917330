# In / Out Calorie PWA — UI Stability v19

## Đã sửa

- Giữ nguyên trạng thái mở/đóng của **“Xem từng món và cách tính”** khi dashboard tự đồng bộ hoặc nhận diện bổ sung món ăn; không còn tự đóng sau vài giây.
- Thêm nút **“↻ Cập nhật ngay”** trực tiếp trên sticky menu, dùng được ở mọi trang.
- Tăng khoảng cách giữa số giờ đi bộ dốc và dòng giải thích phía dưới.
- Sửa tương phản hai ô **“Calo vào mỗi ngày”** và **“Cân nặng lý thuyết tại mốc”** trong theme tối.
- Tăng Service Worker cache lên `in-and-out-pwa-2026-07-31-v19` để thiết bị nhận đúng bản mới.

## Cách cập nhật

1. Giải nén ZIP.
2. Upload toàn bộ file bên trong vào thư mục gốc repository và ghi đè file cũ.
3. Đóng hẳn PWA/trình duyệt rồi mở lại.
4. Nếu vẫn thấy bản cũ, xóa dữ liệu trang hoặc gỡ PWA và cài lại một lần để xóa cache cũ.


## V20
- Thêm mục **Thực phẩm** trên navigation.
- Thêm bảng 38 thực phẩm thường ăn theo 100 g, có tìm kiếm nhanh.
- Nhúng cơ sở dữ liệu Nutrition+ từ kientran.ca/food bên dưới bảng.
- Nâng cache PWA lên V20.


## V21
- Mở rộng bảng **Thực phẩm thường ăn** lên 121 món.
- Thêm icon cho từng món và icon cho 4 nhóm.
- Chia theo thứ tự: **Protein → Carb → Fat → Hoa quả**.
- Đồ ăn dùng đơn vị 100 g; đồ uống dùng 100 ml.
- Bổ sung đủ Protein, Carb, Fat, Calo và cột hiệu suất macro trên 100 kcal.
- Tự động sắp xếp trong từng nhóm theo macro/calo giảm dần, sau đó calo tăng dần.
- Giữ tìm kiếm không dấu, tối ưu bảng trên điện thoại và theme tối.
- Nâng cache PWA lên V21.


## V22
- Tối giản mỗi bảng còn **Thực phẩm + macro trội + Calo**.
- Nhóm Protein hiển thị **Đạm**, nhóm Carb và Hoa quả hiển thị **Carb**, nhóm Fat hiển thị **Fat**.
- Gộp trạng thái và đơn vị 100 g/100 ml xuống dưới tên món; bỏ các cột Protein/Carb/Fat dư thừa, Đơn vị và Hiệu suất.
- Bảng tự co vừa màn hình điện thoại, không còn phải cuộn ngang.
- Giữ nguyên thứ tự sắp xếp macro cao / calo thấp.
- Nâng cache PWA lên V22.


## V23
- Sửa đúng cột macro theo từng nhóm: Protein hiển thị Đạm, Carb hiển thị Carb, Fat hiển thị Fat.
- Cố định tỷ lệ cột bằng colgroup để bảng khớp màn hình điện thoại, không tràn ngang.
- Bỏ “(g)” khỏi tiêu đề để cột số liệu gọn hơn.
- Tăng cơ chế chống cache cũ của PWA.


## V24 – Cột tỷ lệ thực phẩm
- Thêm cột **Tỷ lệ** cho từng bảng, tính bằng gram macro trội trên 100 kcal.
- Cố định bảng 4 cột: Thực phẩm, macro trội, Calo, Tỷ lệ.
- Tối ưu tỷ lệ chiều rộng cột và typography để toàn bộ bảng vừa một màn hình điện thoại, không có thanh cuộn ngang.

- V25: Chuyển cột **Tỷ lệ** xuống cuối mỗi bảng; giữ nguyên bố cục vừa màn hình, không cuộn ngang.

## V26 – Bổ sung các loại ốc
- Thêm **Thịt ốc bươu**: 11,1 g đạm và 84 kcal trên 100 g phần ăn được.
- Thêm **Thịt ốc hương**: 17 g đạm và 95 kcal trên 100 g phần ăn được.
- Hai món được xếp tự động trong nhóm **Trội về Protein** theo tỷ lệ đạm trên 100 kcal.
- Nâng cache PWA lên V26.


## V32
Bổ sung hoa quả, thịt/nội tạng, giò/chả, nấm, sữa đặc, bơ/đồ phết và nhóm đường–sốt–gia vị.


## V34
- Sửa Hạt hướng dương về nhóm Hạt & quả hạch.
- Bỏ iframe Nutrition+ và thêm trang Tra cứu native dùng USDA FoodData Central + Open Food Facts.


## V41 – Danh mục thực phẩm phẳng
- Bỏ toàn bộ nhóm con và nút mũi tên mở/đóng.
- Bấm Thịt, Cá, Trứng, Bơ sữa... sẽ hiện ngay toàn bộ danh sách của danh mục đó.
- Thịt, Cá, Trứng và Bơ sữa xếp theo mật độ đạm/calo từ cao xuống thấp.
- Các danh mục còn lại xếp theo calo từ thấp lên cao.
- Nâng cache PWA lên V41.


## V42 – Ưu tiên Đạm/Calo theo danh mục
- Thịt, Cá, Trứng và Bơ sữa có thêm cột **Đạm/100K** (gram đạm trên 100 kcal).
- Bốn nhóm này nhấn mạnh trực quan **Đạm**, **Calo** và **tỷ lệ đạm/calo**; Carb và Fat chuyển xuống dòng thông tin phụ.
- Các danh mục còn lại đưa **Calo** thành chỉ số nổi bật nhất; Carb và Fat vẫn hiển thị nhưng giảm độ nhấn, Đạm nằm ở dòng phụ.
- Tối ưu lại độ rộng cột cho điện thoại và nâng cache PWA lên V42.

## V43 – Chỉ giữ nguyên liệu đơn lẻ
- Đổi tiêu đề cột **Đạm/100K** thành **Tỉ lệ**; giá trị vẫn là gram đạm trên 100 kcal.
- Loại toàn bộ món đã nấu, suất ăn hoàn chỉnh, fast food, đồ ăn vặt, bánh, thịt/cá khô và thực phẩm phối trộn khỏi bảng Thực phẩm.
- Chỉ giữ nguyên liệu đơn lẻ như thịt/cá sống, trứng, bơ sữa, gạo–ngũ cốc–củ–đậu, bún/phở/mì/miến trơn, rau củ, hoa quả, hạt và gia vị nền.
- Các danh mục không còn dữ liệu sau khi lọc sẽ tự ẩn để giao diện gọn hơn.
- Nâng cache PWA lên V43.

## V45 – Chuẩn hóa danh mục và tên thực phẩm
- Chuẩn hóa tên hiển thị: **Đậu hũ non**, **Trứng gà nguyên quả**, **Tôm bóc vỏ**; thay toàn bộ cách gọi “lợn” bằng “heo”.
- Cá tươi được mặc định tính theo phần **phi lê**, nhưng bỏ chữ “phi lê” lặp lại trong từng tên món.
- Tất cả các loại đậu hạt được tính ở trạng thái **hạt sống/khô, chưa nấu chín**; đưa hạt đác và hạt thốt nốt vào nhóm Hạt.
- Bỏ mục Thịt ba chỉ chung vì đã có Thịt ba chỉ heo và Thịt ba chỉ bò.
- Tách lại menu thành **Bánh ngọt**, **Chè**, **Ăn vặt**, **Fastfood** và **Món ăn ngoài**; bỏ mục Món ngọt cũ.
- Bổ sung các loại bánh ngọt, chè, đồ ăn vặt, món ngoài hàng và fastfood theo danh sách cập nhật; đưa kem vào Bơ sữa và thêm Cơm gạo trắng.
- Rà soát lại quy tắc gán biểu tượng theo từng nhóm và từng món để tránh dùng sai icon.
- Nâng cache PWA lên V45.


## V46 – Bổ sung tinh bột, hạt, pizza và tối giản chỉ số

- Đổi tên mục phô mai chung thành “Phô mai regular cheese (loại phô mai vẫn cho vào burger)”.
- Thêm cốm, xôi cốm, xôi khúc, xôi lạc, xôi đỗ xanh và xôi đỗ đen vào Tinh bột.
- Thêm hạt vừng vào Hạt.
- Đưa nem thính, nem tai, nem chua vào Ăn vặt.
- Thêm Pizza phô mai, Pizza BBQ chicken và Pizza bò bằm vào Fastfood.
- Các ô dinh dưỡng chỉ hiển thị số; tên chỉ số nằm tại header sticky.
- Nâng cache PWA lên V46.
## V47 – Chuẩn hóa khẩu phần và bổ sung thực phẩm

- Tteokbokki chuyển sang giá trị dinh dưỡng theo 100 g.
- Thêm bỏng ngô, caramel popcorn, Lipton Ice Tea và bánh trung thu.
- Bảo đảm Cốm nằm trong Tinh bột.
- Gộp “Thịt heo nạc/Thịt heo thăn” thành “Thịt thăn heo”.
- Mọi món tính theo cái, miếng, suất, đĩa, bát hoặc con đều ghi kèm trọng lượng tham chiếu.
- Ô Đạm/Calo/Tỉ lệ chỉ hiển thị số; Đạm có hậu tố g.
- Nâng cache PWA lên V47.



## V50 – Đồng bộ dữ liệu Thực phẩm và nhận diện Excel
- Bảng Thực phẩm là nguồn dữ liệu ưu tiên cao nhất cho bộ tính từ Google Sheet/Excel.
- Tên chuẩn và các bí danh phổ biến cùng trỏ về đúng một hồ sơ calo/macro.
- Món chưa nhận diện không còn bị ước lượng âm thầm; ngày đó được đánh dấu chưa đủ dữ liệu để tránh sai tổng.
- Khuyến nghị nhập: `150g Ức gà phi lê không da`, `1 bát Phở bò`, `1 miếng Big Mac`, hoặc đúng tên hiển thị trong danh mục.
