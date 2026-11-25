import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installReactDomExtensionGuard } from './utils/domSafety';
import { installGlobalErrorListeners } from './utils/errorLogger';

// Bảo vệ vòng đời React DOM trước các tiện ích mở rộng / trình dịch tự động can thiệp DOM
installReactDomExtensionGuard();
// Ghi nhận lỗi JavaScript có cấu trúc (không chứa mật khẩu/token/PII) và xử lý lỗi tải chunk cũ
installGlobalErrorListeners();

// Gỡ bỏ các Service Worker cũ và xóa Cache Storage cũ (nếu có) để luôn đồng bộ đúng bản build mới nhất
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      if (registrations.length > 0) {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {});
        });
        if ('caches' in window) {
          window.caches
            .keys()
            .then((cacheNames) => Promise.all(cacheNames.map((name) => window.caches.delete(name))))
            .catch(() => {});
        }
      }
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
