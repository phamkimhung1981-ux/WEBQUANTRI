export interface SystemRelease {
  version: string;
  releaseDate: string;
  title: string;
  modulesModified: string[];
  changes: string[];
}

export const CURRENT_SYSTEM_VERSION = 'v1.3.4';
export const LAST_UPDATED = '2026-10-29';

export const SYSTEM_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
export const SYSTEM_COMMIT_SHA = typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'dev';
export const SYSTEM_ENV = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__ : 'development';

export const RELEASE_HISTORY: SystemRelease[] = [
  {
    version: 'v1.3.4',
    releaseDate: '2026-10-29',
    title: 'Khắc phục hoàn toàn lỗi khóa phiếu KPI 3 cấp khi xuất bản website',
    modulesModified: [
      'src/components/kpiVc/KpiVcDocumentModal.tsx',
      'src/pages/KpiTeacherStaff.tsx',
      'src/lib/kpiTargetAudienceUtils.ts',
      'src/store/AppContext.tsx',
      'src/data/canonical51Forms.json',
      'src/data/canonical51Forms.ts'
    ],
    changes: [
      'Tách biệt cơ chế khóa độc lập cho 3 cấp: Cấp 1 (Giáo viên tự chấm), Cấp 2 (TTCM đánh giá), Cấp 3 (Ban Giám hiệu phê duyệt)',
      'Sửa lỗi read-only sai: Khi mở phiếu từ danh sách (click dòng hoặc biểu tượng mắt), hệ thống tự động nhận diện quyền và giai đoạn để mở quyền chấm tương ứng thay vì khóa cưỡng bức',
      'Thanh chuyển đổi vai trò nhanh (Role Simulator) trên đầu phiếu: Cho phép chuyển đổi tức thì giữa Tự động / Giáo viên / TTCM / BGH / Admin với quyền nhập điểm và gửi kết quả tức thì',
      'Chuẩn hóa phân quyền TTCM theo tổ chuyên môn: Nguyễn Trung Kiên (Tổ Hóa-Sinh), Đặng Xuân Thành (Tổ Văn-Sử), Hà Thị Thu Hương (Tổ Toán-Lý), Nguyễn Quang Sáng (Tổ Văn phòng/BGH)',
      'Bổ sung nút hành động "Chấm BGH" trên bảng danh sách và nút tiện ích "⚡ Đồng ý điểm tự chấm / TTCM" giúp chuyển cấp nhanh chóng',
      'Bảo toàn 100% dữ liệu 51 giáo viên và điểm số đã đánh giá, không bị reset hay mất mát dữ liệu'
    ]
  },
  {
    version: 'v1.3.3',
    releaseDate: '2026-10-29',
    title: 'Khắc phục triệt để lỗi điểm KPI giáo viên không đồng bộ khi xuất bản website',
    modulesModified: ['KPI Giáo viên & Viên chức', 'Dữ liệu chuẩn 51 phiếu', 'Deduplication Service', 'Bảo toàn điểm số & trạng thái'],
    changes: [
      'Khôi phục và đồng bộ 100% dữ liệu đánh giá KPI của 51 giáo viên/nhân viên, bao gồm phiếu của giáo viên Trần Xuân Quỳnh (100 điểm, Đã tự chấm).',
      'Loại bỏ hoàn toàn logic ép điểm 100 về 0 và trạng thái "Chưa chấm" sai lệch trên giao diện hiển thị bảng KPI.',
      'Nâng cấp thuật toán deduplicateVcForms ưu tiên các phiếu có điểm chấm thực tế, có kết quả đánh giá TTCM/BGH thay vì phụ thuộc mốc thời gian của bản nháp trống.',
      'Cập nhật chuẩn hóa trạng thái quy trình: "Chưa chấm", "Đã tự chấm", "TTCM đã chấm", "BGH đã chấm" theo đúng tiến độ thực tế.',
      'Tích hợp cơ chế thông báo trạng thái kết nối Firestore và bảo toàn dữ liệu bằng bộ nhớ cache an toàn khi xảy ra giới hạn hạn mức truy vấn.'
    ]
  },
  {
    version: 'v1.3.2',
    releaseDate: '2026-10-28',
    title: 'Khắc phục triệt để lỗi đồng bộ dữ liệu giữa Google AI Studio và Website Vercel',
    modulesModified: ['Kết nối Firebase Firestore', 'Đồng bộ Cache', 'Theo dõi thi đua', 'KPI Giáo viên & Nhân viên', 'Cài đặt hệ thống'],
    changes: [
      'Đồng bộ kết nối cơ sở dữ liệu dùng chung (Named Database: ai-studio-hthngqunlgiovint-0d69b880-7502-4902-b08f-94cb8fcead53) bảo đảm nhất quán 100% giữa Google AI Studio và Vercel Production.',
      'Bổ sung nút "Đồng bộ máy chủ & Dọn sạch bộ nhớ đệm" trong mục Cài đặt giúp loại bỏ toàn bộ dữ liệu cache cũ trên trình duyệt và kéo dữ liệu mới nhất từ Firestore.',
      'Sửa triệt để lỗi ghi đè điểm đánh giá KPI của giáo viên, ưu tiên mốc thời gian updatedAt mới nhất.',
      'Khắc phục lỗi điểm KPI 100/100 bị reset về 0, đảm bảo tính toán chính xác tổng điểm thi đua và KPI.',
      'Tích hợp bảng thông số chẩn đoán kết nối cơ sở dữ liệu trực tiếp trong giao diện Cài đặt.'
    ]
  },
  {
    version: 'v1.3.1',
    releaseDate: '2026-10-16',
    title: 'Khắc phục triệt để lỗi đồng bộ xuất Web & Tích hợp cơ chế nhận diện phiên bản trực tiếp',
    modulesModified: ['Cấu hình Build & Deploy', 'Vite Config', 'Nhận diện phiên bản', 'Xóa cache Service Worker', 'Bảo vệ dữ liệu Firestore'],
    changes: [
      'Tự động tiêm thông số __BUILD_TIME__, __COMMIT_SHA__, __APP_ENV__ vào mã nguồn build để nhận diện phiên bản thực tế.',
      'Bổ sung nút "Kiểm tra & Cập nhật phiên bản" trên giao diện quản trị giúp làm mới cache trình duyệt tức thì khi Vercel có build mới.',
      'Thêm cơ chế tự động hủy Service Worker cũ đệm từ các bản xuất cũ trên trình duyệt người dùng.',
      'Cấu hình HTTP no-cache headers trong index.html và vercel.json chống trình duyệt cache lại tệp HTML gốc.',
      'Bảo vệ dữ liệu Firestore thực của nhà trường, ngăn chặn việc ghi đè hoặc khởi tạo lại dữ liệu mẫu khi cập nhật.'
    ]
  },
  {
    version: 'v1.3.0',
    releaseDate: '2026-10-16',
    title: 'Đồng bộ hóa toàn diện mã nguồn & dữ liệu đệm sản xuất (Cache-Control & Realtime Firestore)',
    modulesModified: ['Cấu hình Vercel', 'Xác thực & Môi trường', 'Quản lý Học sinh & Chủ nhiệm', 'Đánh giá KPI', 'Cài đặt hệ thống'],
    changes: [
      'Cấu hình Cache-Control chống lưu đệm vĩnh viễn trong vercel.json (force revalidate /index.html trên Vercel Production).',
      'Đồng bộ hóa dữ liệu danh sách học sinh từ Firestore real-time mà không ghi đè dữ liệu thực bằng dữ liệu mẫu.',
      'Sửa điều kiện lọc kích thước dữ liệu học sinh trong homeroomService để luôn ưu tiên nạp từ Firestore.',
      'Hiển thị badge nhận diện phiên bản hệ thống v1.3.0 và trạng thái kết nối trực tiếp trên giao diện quản trị.',
      'Tích hợp điều kiện môi trường import.meta.env.DEV giúp bảo mật giao diện phát triển AI Studio khi xuất bản.'
    ]
  },
  {
    version: 'v1.2.3',
    releaseDate: '2026-09-29',
    title: 'Sửa triệt để chức năng XẾP A–B–C và Lưu kết quả bền vững vào Database',
    modulesModified: ['Quản lý học sinh & GVCN', 'Dữ liệu học sinh', 'Sắp xếp danh sách'],
    changes: [
      'Nút "XẾP A–B–C" thực hiện đồng thời: Xếp A–B–C theo tên tiếng Việt -> Cập nhật STT và Xếp loại -> Lưu trực tiếp vào Firestore Database.',
      'Lưu kết quả theo từng học sinh duy nhất (dựa trên ID) và theo đúng lớp.',
      'Tự động khôi phục kết quả đã lưu khi reload trang, đổi lớp, đóng mở module hoặc đăng nhập lại.',
      'Bổ sung trạng thái Đang lưu / Đã lưu ✓ trên nút bấm để chống bấm liên tục.'
    ]
  },
  {
    version: 'v1.2.2',
    releaseDate: '2026-09-29',
    title: 'Tự động lưu dữ liệu (Auto-save) ngay khi chỉnh sửa trên web',
    modulesModified: ['Lịch giao việc tổ CM', 'Lịch công việc trường'],
    changes: [
      'Kích hoạt auto-save tức thì khi nhập liệu lịch công việc trường và tổ chuyên môn.'
    ]
  },
  {
    version: 'v1.2.1',
    releaseDate: '2026-09-29',
    title: 'Sửa triệt để hiển thị nội dung giao việc (Auto-resize textarea & Bỏ thanh cuộn trong ô)',
    modulesModified: ['Lịch giao việc tổ CM', 'Lịch công việc trường', 'Giao việc'],
    changes: [
      'Xây dựng AutoResizeTextarea tự động co giãn chiều cao theo nội dung thực tế (scrollHeight).',
      'Loại bỏ hoàn toàn thanh cuộn dọc (scrollbar) bên trong các ô Sáng, Chiều, Lãnh đạo trực/đánh giá, Ghi chú.',
      'Hiển thị 100% nội dung phân công nhiều dòng, dấu gạch đầu dòng và khoảng cách dòng.',
      'Hàng của bảng tự động cao lên tương ứng mà không che khuất hay cắt bớt dữ liệu.'
    ]
  },
  {
    version: 'v1.2.0',
    releaseDate: '2026-09-29',
    title: 'Bổ sung module Lịch công việc trường & tính năng Tải file từ Word',
    modulesModified: ['Lịch công việc trường', 'Thanh điều hướng', 'Giao diện bảng'],
    changes: [
      'Tạo module Lịch công việc trường THPT Sơn Lương (/school-work-schedule) đúng 5 cột theo file mẫu.',
      'Kẻ viền ô rõ nét, tương phản cao, hỗ trợ Lãnh đạo nhập nhận xét và đánh giá trực tiếp.',
      'Tích hợp tính năng Tải file từ Word (.docx) và Xuất Word/Excel chuẩn văn bản.',
      'Cấu hình vercel.json chống cache stale và hỗ trợ SPA routing cho production.'
    ]
  },
  {
    version: 'v1.1.0',
    releaseDate: '2026-09-27',
    title: 'Nâng cấp Lịch giao việc tổ CM và hệ thống KPI',
    modulesModified: ['Lịch giao việc tổ CM', 'KPI CBQL', 'KPI Giáo viên', 'KPI Nhân viên'],
    changes: [
      'Hoàn thiện hệ thống đánh giá KPI CBQL, GV, NV theo tháng/học kỳ.',
      'Tích hợp lịch giao việc tổ chuyên môn và đồng bộ dữ liệu giáo viên.'
    ]
  },
  {
    version: 'v1.0.0',
    releaseDate: '2026-09-20',
    title: 'Khởi tạo Hệ thống Quản lý Giáo viên THPT Sơn Lương',
    modulesModified: ['Toàn bộ hệ thống'],
    changes: [
      'Quản lý danh sách CBGVNV, phân quyền BGH, TTCM, Giáo viên, Nhân viên.',
      'Quản lý văn bản, nghỉ phép, nền nếp nội quy và báo cáo thống kê.'
    ]
  }
];
