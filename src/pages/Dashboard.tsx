import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  BarChart3, 
  Users, 
  FileText, 
  GraduationCap, 
  CalendarCheck, 
  PieChart, 
  Settings,
  Calendar,
  BookOpen,
  Sparkles,
  School,
  Camera,
  RefreshCw,
  Award,
  ShieldCheck,
  UserCheck,
  Wrench
} from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { teachers, schoolStats, students, classes } = useAppContext();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Background image state: prioritize user's uploaded image if set in localStorage,
  // otherwise fallback to the provided school asset.
  const [bgImage, setBgImage] = useState<string>(() => {
    return localStorage.getItem('thpt_son_luong_custom_bg') || '/anh_truong_hung.png';
  });

  // Real-time Date and Time (system time)
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000 * 60); // update every minute
    return () => clearInterval(timer);
  }, []);

  // Format real-time date
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const currentDayName = dayNames[currentDate.getDay()];
  const formattedDayMonthYear = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;

  // Database dynamic statistics
  const totalTeachers = teachers && teachers.length > 0 ? teachers.length : (schoolStats?.totalTeachers || 57);
  const totalStudents = (schoolStats?.totalStudents || 1074).toLocaleString('vi-VN');
  const totalClasses = classes && classes.length > 0 ? classes.length : (schoolStats?.totalClasses || 24);
  const schoolYear = schoolStats?.schoolYear || '2026 - 2027';

  // Main Modules with icons, descriptions and corresponding app routes
  const modules = [
    {
      id: 'calendar',
      title: 'LỊCH CÔNG TÁC',
      desc: 'Lịch tuần & Sự kiện',
      icon: Calendar,
      route: '/calendar',
      gradient: 'from-blue-600 to-indigo-700',
      shadowColor: 'shadow-blue-500/30'
    },
    {
      id: 'school_work_schedule',
      title: 'LỊCH CÔNG VIỆC TRƯỜNG',
      desc: 'Phân công - Trực ban - Đánh giá',
      icon: CalendarCheck,
      route: '/school-work-schedule',
      gradient: 'from-blue-600 to-indigo-600',
      shadowColor: 'shadow-blue-500/30'
    },
    {
      id: 'kpi_cbql',
      title: 'KPI CBQL',
      desc: 'Đánh giá cán bộ QL',
      icon: Award,
      route: '/kpi-cbql',
      gradient: 'from-blue-700 to-indigo-800',
      shadowColor: 'shadow-blue-600/30'
    },
    {
      id: 'kpi_gvnv',
      title: 'KPI GIÁO VIÊN',
      desc: 'Đánh giá Giáo viên',
      icon: GraduationCap,
      route: '/kpi-gvnv',
      gradient: 'from-emerald-600 to-teal-700',
      shadowColor: 'shadow-emerald-500/30'
    },
    {
      id: 'kpi_nv',
      title: 'KPI NHÂN VIÊN',
      desc: 'Đánh giá Nhân viên hành chính',
      icon: UserCheck,
      route: '/kpi-nv',
      gradient: 'from-teal-600 to-emerald-800',
      shadowColor: 'shadow-teal-500/30'
    },
    {
      id: 'discipline',
      title: 'NỀN NẾP',
      desc: 'Nền nếp & Nội quy',
      icon: ShieldCheck,
      route: '/discipline',
      gradient: 'from-amber-500 to-orange-600',
      shadowColor: 'shadow-amber-500/30'
    },
    {
      id: 'teachers',
      title: 'CBGVNV',
      desc: 'Quản lý nhân sự',
      icon: Users,
      route: '/teachers',
      gradient: 'from-indigo-600 to-purple-600',
      shadowColor: 'shadow-indigo-500/30'
    },
    {
      id: 'departments',
      title: 'TỔ CHUYÊN MÔN',
      desc: 'Tổ bộ môn & Sinh hoạt',
      icon: School,
      route: '/departments',
      gradient: 'from-purple-600 to-pink-600',
      shadowColor: 'shadow-purple-500/30'
    },
    {
      id: 'facility_damage',
      title: 'BÁO HỎNG CSVC',
      desc: 'Báo cáo hỏng hóc & Sửa chữa',
      icon: Wrench,
      route: '/facility-damage',
      gradient: 'from-amber-600 to-orange-700',
      shadowColor: 'shadow-amber-500/30'
    },
    {
      id: 'reports',
      title: 'THỐNG KÊ',
      desc: 'Báo cáo & Tổng hợp',
      icon: PieChart,
      route: '/reports',
      gradient: 'from-teal-500 to-emerald-600',
      shadowColor: 'shadow-teal-500/30'
    }
  ];

  // Handle local background image change if user wants to select a file directly
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setBgImage(result);
          localStorage.setItem('thpt_son_luong_custom_bg', result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetBg = () => {
    localStorage.removeItem('thpt_son_luong_custom_bg');
    setBgImage('/anh_truong_hung.png');
  };

  return (
    <div 
      id="portal-home-container"
      className="relative min-h-[calc(100vh-60px)] w-full flex flex-col justify-between overflow-x-hidden select-none"
      style={{
        backgroundImage: `url("${bgImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Hidden file input for background selection */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleBgImageUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* LỚP OVERLAY NHẸ TRONG SUỐT BẢO VỆ ĐỘ TƯƠNG PHẢN NHƯNG GIỮ RÕ ẢNH NỀN */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-slate-900/30 pointer-events-none z-0" />

      {/* KHU VỰC PHÍA TRÊN: KHU VỰC TRUNG TÂM & THẺ NGÀY GIỜ */}
      <div className="relative z-10 w-full px-4 sm:px-6 pt-3 pb-1">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 relative">
          
          {/* Spacer for symmetrical centering on desktop */}
          <div className="hidden md:block w-40 shrink-0" />

          {/* 3. KHU VỰC TRUNG TÂM (THIẾT KẾ NHỎ GỌN TRONG SUỐT) */}
          <div 
            id="center-school-hero"
            className="flex flex-col items-center text-center animate-in fade-in duration-300"
          >
            {/* Logo Huy hiệu trường */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full p-0.5 bg-white/80 backdrop-blur-sm border border-[#1457D9]/30 shadow-md mb-1 flex items-center justify-center hover:scale-105 transition-transform">
              <img 
                src="/logo.jpg" 
                alt="THPT Sơn Lương" 
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Tên trường chính */}
            <h1 className="font-black text-xl sm:text-2xl lg:text-3xl text-[#0B3FA8] tracking-tight uppercase drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)] leading-tight">
              TRƯỜNG THPT SƠN LƯƠNG
            </h1>

            {/* Khẩu hiệu 3 giá trị cốt lõi & châm ngôn gộp gọn */}
            <div className="flex items-center gap-2 mt-0.5 text-xs sm:text-sm font-extrabold text-[#1457D9] tracking-wider uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
              <span>TRI THỨC</span>
              <span className="text-amber-500">•</span>
              <span>NHÂN CÁCH</span>
              <span className="text-amber-500">•</span>
              <span>TƯƠNG LAI</span>
            </div>
          </div>

          {/* 6. THẺ NGÀY GIỜ (NHỎ GỌN GÓC PHẢI) */}
          <div 
            id="realtime-date-card"
            className="w-full md:w-auto flex justify-center md:justify-end shrink-0"
          >
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/75 backdrop-blur-md border border-white/80 shadow-sm hover:shadow transition-all">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Calendar size={16} strokeWidth={2.2} />
              </div>
              <div className="flex flex-col text-left leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#1457D9] uppercase tracking-wider">
                    {currentDayName}
                  </span>
                  <span className="text-[10px] text-slate-400">|</span>
                  <span className="text-[11px] font-extrabold text-[#123B78]">
                    {formattedDayMonthYear}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">
                  Chào mừng bạn!
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* KHU VỰC THOÁNG RỘNG Ở GIỮA ĐỂ TÔN VINH KHUNG CẢNH TRƯỜNG HỌC */}
      <div className="flex-1 min-h-[220px] sm:min-h-[280px] lg:min-h-[350px]" />

      {/* KHU VỰC PHÍA DƯỚI: 9 MODULES XẾP HÀNG NGANG NHỎ GỌN & THỐNG KÊ NHANH */}
      <div className="relative z-10 w-full px-3 sm:px-6 pb-3 space-y-2.5">
        
        {/* 4. CÁC MODULE CHÍNH (THIẾT KẾ COMPACT 1 HÀNG TRÊN LG SCREEN) */}
        <div className="max-w-7xl mx-auto">
          <div 
            id="main-modules-grid"
            className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-2.5"
          >
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  id={`module-card-${mod.id}`}
                  onClick={() => navigate(mod.route)}
                  className="group relative flex flex-col items-center text-center p-2 sm:p-2.5 rounded-xl bg-white/75 hover:bg-white/95 backdrop-blur-md border border-white/70 hover:border-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 ease-out cursor-pointer"
                >
                  {/* Icon 3D / Gradient squircle nhỏ gọn */}
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr ${mod.gradient} text-white flex items-center justify-center shadow-sm ${mod.shadowColor} mb-1.5 group-hover:scale-105 transition-transform duration-200`}>
                    <Icon size={19} strokeWidth={2.2} />
                  </div>

                  {/* Tiêu đề ngắn gọn */}
                  <span className="font-extrabold text-[10.5px] sm:text-[11.5px] text-[#123B78] uppercase tracking-tight group-hover:text-[#1457D9] transition-colors leading-tight line-clamp-1">
                    {mod.title}
                  </span>

                  {/* Mô tả nhỏ bên dưới */}
                  <span className="text-[9px] font-medium text-slate-500 mt-0.5 leading-tight line-clamp-1 hidden sm:block">
                    {mod.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. THỐNG KÊ NHANH & THANH CHÂN TRANG TRONG SUỐT GỌN GÀNG */}
        <div className="max-w-7xl mx-auto">
          <div 
            id="quick-stats-footer"
            className="rounded-xl bg-white/75 backdrop-blur-md border border-white/70 shadow-sm px-3 sm:px-4 py-2 flex flex-col md:flex-row items-center justify-between gap-2"
          >
            {/* Bên trái: Thông điệp ý nghĩa */}
            <div className="flex items-center gap-2 text-center md:text-left">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/80 text-[#1457D9] flex items-center justify-center shrink-0">
                <BookOpen size={14} />
              </div>
              <div>
                <p className="text-[11px] sm:text-xs font-bold text-[#123B78] italic">
                  “Mỗi ngày đến trường là một ngày vui”
                </p>
                <p className="text-[9.5px] sm:text-[10px] font-semibold text-slate-500">
                  THPT Sơn Lương
                </p>
              </div>
            </div>

            {/* Bên phải: 4 Thẻ Thống kê nhanh gọn */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              {/* CBGVNV */}
              <div 
                id="stat-cbgvnv"
                onClick={() => navigate('/teachers')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-slate-200/70 shadow-xs transition-all cursor-pointer hover:-translate-y-0.5 text-xs"
                title="Xem danh sách CBGVNV"
              >
                <span>👥</span>
                <span className="font-semibold text-slate-600">CBGVNV:</span>
                <span className="font-extrabold text-[#1457D9]">{totalTeachers}</span>
              </div>

              {/* Học sinh */}
              <div 
                id="stat-students"
                onClick={() => navigate('/evaluations')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-slate-200/70 shadow-xs transition-all cursor-pointer hover:-translate-y-0.5 text-xs"
                title="Quản lý học sinh"
              >
                <span>🎓</span>
                <span className="font-semibold text-slate-600">Học sinh:</span>
                <span className="font-extrabold text-[#1457D9]">{totalStudents}</span>
              </div>

              {/* Lớp học */}
              <div 
                id="stat-classes"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/70 shadow-xs text-xs"
              >
                <span>🏫</span>
                <span className="font-semibold text-slate-600">Lớp:</span>
                <span className="font-extrabold text-[#1457D9]">{totalClasses}</span>
              </div>

              {/* Năm học */}
              <div 
                id="stat-schoolyear"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/70 shadow-xs text-xs"
              >
                <span>📅</span>
                <span className="font-semibold text-slate-600">Năm học:</span>
                <span className="font-extrabold text-[#123B78]">{schoolYear}</span>
              </div>

              {/* Nút thay đổi / khôi phục nền */}
              <button
                id="change-bg-btn"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50/80 hover:bg-blue-100 text-[#1457D9] border border-blue-200 text-xs font-semibold transition-all"
                title="Tải ảnh nền trường học từ máy tính"
              >
                <Camera size={13} />
                <span className="hidden sm:inline text-[10px]">Đổi nền</span>
              </button>

              <button
                onClick={handleResetBg}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-all"
                title="Đặt lại ảnh nền mặc định"
              >
                <RefreshCw size={13} />
                <span className="hidden sm:inline text-[10px]">Mặc định</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
