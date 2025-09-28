June Bot
June Bot là một ứng dụng Node.js sử dụng Puppeteer để tự động hóa việc gửi tin nhắn chat trên nền tảng askjune.ai. Script hỗ trợ quản lý nhiều tài khoản, sử dụng cookies để đăng nhập, proxy để ẩn IP, và gửi các câu hỏi từ file ask.txt theo lịch hàng ngày.
Mục lục

Yêu cầu
Cài đặt
Cấu hình
Chạy script
Xử lý sự cố
Góp ý

Yêu cầu

Node.js: Phiên bản 18 trở lên.
Chrome/Chromium: Trình duyệt để chạy Puppeteer.
Hệ điều hành: Ubuntu, Windows, hoặc macOS.
File cấu hình:
.env: Chứa cookies và các biến môi trường.
ask.txt: Danh sách câu hỏi (prompts).
(Tùy chọn) proxies.txt: Danh sách proxy.



Cài đặt

Cài Node.js:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

Kiểm tra phiên bản:
node --version
npm --version


Cài Chrome/Chromium (trên Ubuntu):
sudo apt-get install -y chromium-browser


Tạo thư mục dự án:
mkdir june-bot
cd june-bot
npm init -y


Cài phụ thuộc:
npm install dotenv puppeteer puppeteer-extra puppeteer-extra-plugin-stealth https-proxy-agent


Tải code:

Sao chép file june.js vào thư mục june-bot.



Cấu hình

Tạo file .env:
touch .env

Thêm nội dung (thay thế giá trị phù hợp):
MODEL_ID=blockchain/qwen3-32b
DAILY_INTERVAL_HOURS=24
ASKS_PATH=./ask.txt
PROXIES_PATH=./proxies.txt
COOKIE_1=your_cookie_string_1
COOKIE_2=your_cookie_string_2


Lấy cookies:
Đăng nhập vào askjune.ai trên trình duyệt.
Mở Developer Tools (F12) > Application > Cookies > Sao chép chuỗi cookie của https://askjune.ai/.
Định dạng: key1=value1; key2=value2; ....




Tạo file ask.txt:
touch ask.txt

Thêm câu hỏi, mỗi dòng một câu:
Xu hướng mới nhất trong công nghệ blockchain là gì?
Làm thế nào để tối ưu danh mục đầu tư crypto bằng USD?
Giải thích hợp đồng thông minh một cách hài hước.


Dòng bắt đầu bằng # sẽ bị bỏ qua.


(Tùy chọn) Tạo file proxies.txt:
touch proxies.txt

Thêm proxy (mỗi dòng một proxy):
123.45.67.89:8080
user:pass@123.45.67.90:8080


Đảm bảo proxy hợp lệ và hỗ trợ HTTP.


Phân quyền thư mục:
mkdir june-profiles
chmod -R 755 june-profiles



Chạy script

Chạy lệnh:
node june.js


Nhập số lượng chat:

Script hỏi số lượng chat mỗi tài khoản mỗi ngày (mặc định: 5).
Nhập số hoặc nhấn Enter để dùng mặc định.


Theo dõi đầu ra:

Script hiển thị biểu ngữ, thông tin tài khoản/proxy, và tiến trình.
Chạy chat cho từng tài khoản, chờ 10 giây giữa các tài khoản, lặp lại sau DAILY_INTERVAL_HOURS.


Dừng script:

Nhấn Ctrl+C để dừng.



Xử lý sự cố

Lỗi: Không tìm thấy cookies:
Kiểm tra .env có chứa COOKIE_1, COOKIE_2, ... hợp lệ.


Lỗi: Không tìm thấy ask.txt:
Đảm bảo ask.txt tồn tại và có ít nhất một dòng không phải comment.


Lỗi khởi chạy trình duyệt:
Kiểm tra cài đặt Chrome/Chromium.
Đảm bảo đủ bộ nhớ và quyền truy cập.


Lỗi proxy:
Xác minh định dạng và kết nối proxy.
Chạy không proxy bằng cách xóa proxies.txt.


Lỗi chọn mô hình:
Kiểm tra MODEL_ID hợp lệ hoặc API trả về mô hình lành mạnh.


Phát hiện bot:
Cập nhật cookies hoặc proxy nếu trang chặn yêu cầu.



Góp ý

Mở issue trên GitHub để báo lỗi hoặc đề xuất cải tiến.
Liên hệ qua email@example.com để hỗ trợ.
