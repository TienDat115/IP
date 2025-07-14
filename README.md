# Ứng dụng Gửi Tin Nhắn Đa Nền Tảng

Ứng dụng web cho phép gửi tin nhắn qua nhiều nền tảng khác nhau như Discord và Telegram một cách dễ dàng và thuận tiện.

## Tính năng chính

- Đăng nhập và xác thực người dùng qua Firebase Authentication
- Gửi tin nhắn đến Discord qua webhook
- Gửi tin nhắn đến Telegram qua bot
- Giao diện người dùng thân thiện, dễ sử dụng
- Hỗ trợ đa nền tảng, có thể truy cập từ mọi thiết bị có trình duyệt web

## Công nghệ sử dụng

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Firebase Authentication
- **Thư viện**: 
  - Bootstrap 5.1.3 cho giao diện người dùng
  - Firebase SDK 9.0.0 cho xác thực người dùng

## Cài đặt

1. Clone repository này về máy tính của bạn:
   ```bash
   git clone [đường-dẫn-đến-repository]
   ```

2. Mở file `js/firebase-config.js` và cập nhật cấu hình Firebase của bạn:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

3. Mở file `index.html` trên trình duyệt web hoặc sử dụng một máy chủ web cục bộ.

## Hướng dẫn sử dụng

1. **Đăng nhập**:
   - Mở trang web và đăng nhập bằng tài khoản của bạn.

2. **Chọn dịch vụ gửi tin nhắn**:
   - Chọn nền tảng bạn muốn gửi tin nhắn (Discord hoặc Telegram).
   - Nhập nội dung tin nhắn và các thông tin cần thiết.
   - Nhấn nút gửi để hoàn tất.

## Cấu trúc thư mục

```
.
├── chatbot/                 # Thư mục chứa các trang gửi tin nhắn
│   ├── css/                # File CSS tùy chỉnh
│   ├── js/                 # File JavaScript tùy chỉnh
│   ├── image/              # Hình ảnh sử dụng trong ứng dụng
│   ├── SendDiscordMessage.html  # Trang gửi tin nhắn Discord
│   └── SendTelegramMessage.html # Trang gửi tin nhắn Telegram
├── dashboard/              # Trang quản trị (nếu có)
├── js/                     # File JavaScript chung
├── jxm/                    # Thư viện bổ sung (nếu có)
├── index.html              # Trang chủ
└── login.html              # Trang đăng nhập
```

## Bảo mật

- Mọi thông tin đăng nhập và dữ liệu người dùng đều được bảo mật thông qua Firebase Authentication.
- Không lưu trữ mật khẩu dưới dạng văn bản thuần túy.
- Sử dụng HTTPS để đảm bảo kết nối an toàn.

## Đóng góp

Nếu bạn muốn đóng góp cho dự án, vui lòng tạo một pull request. Mọi đóng góp đều được hoan nghênh!

## Giấy phép

Dự án này được phát hành dưới giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.

---

© 2025 Ứng dụng Gửi Tin Nhắn Đa Nền Tảng. Đã đăng ký bản quyền.
