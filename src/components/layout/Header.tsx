import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Bell, 
  LogOut, 
  ChevronDown, 
  Home, 
  CalendarDays,
  BarChart3, 
  Users, 
  FileText, 
  GraduationCap, 
  TrendingUp, 
  Settings as SettingsIcon,
  Camera,
  UserCheck,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useAppContext } from '../../store/AppContext';
import { usePermission } from '../../hooks/usePermission';
import { ModuleCode } from '../../types/permission';
import { accountService } from '../../services/accountService';
import Avatar from '../ui/Avatar';
import AvatarModal from '../profile/AvatarModal';
import BackToHomeButton from '../ui/BackToHomeButton';
import { CURRENT_SYSTEM_VERSION, SYSTEM_BUILD_TIME, SYSTEM_COMMIT_SHA, SYSTEM_ENV } from '../../version';

import { subscribeQuotaStatus } from '../../services/homeroomService';

interface HeaderProps {
  onMenuClick: () => void;
  isDashboard?: boolean;
}

export default function Header({ onMenuClick, isDashboard }: HeaderProps) {
  const { user, logout, updateUser } = useAuth();
  const { notifications, updateTeacher } = useAppContext();
  const { canAccessModule, isAdmin } = usePermission();
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Change password modal state
  const [isChangePassModalOpen, setIsChangePassModalOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSuccess, setCpSuccess] = useState<string | null>(null);

  const [isQuota, setIsQuota] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubQuota = subscribeQuotaStatus(setIsQuota);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubQuota();
    };
  }, []);
  
  const location = useLocation();
  const navigate = useNavigate();

  // Đóng user menu khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead && (n.userId === user?.id || !n.userId)).length || 3;

  const handleSaveAvatar = async (newAvatarUrl: string) => {
    await updateUser({ avatar: newAvatarUrl });
    if (user?.id && user.id !== 'admin') {
      updateTeacher(user.id, { avatar: newAvatarUrl });
    }
  };

  const navMenuItems: { name: string; path: string; icon: any; matchPaths: string[]; moduleCode: ModuleCode }[] = [
    { name: 'Trang chủ', path: '/', icon: Home, matchPaths: ['/'], moduleCode: 'home' },
    { name: 'Lịch công tác', path: '/calendar', icon: CalendarDays, matchPaths: ['/calendar'], moduleCode: 'calendar' },
    { name: 'CBGVNV', path: '/teachers', icon: Users, matchPaths: ['/teachers'], moduleCode: 'teachers' },
    { name: 'KPI Giáo viên', path: '/kpi-gvnv', icon: GraduationCap, matchPaths: ['/kpi-gvnv'], moduleCode: 'kpi_gvnv' },
    { name: 'KPI Nhân viên', path: '/kpi-nv', icon: UserCheck, matchPaths: ['/kpi-nv', '/kpi-nhan-vien', '/kpi-staff'], moduleCode: 'kpi_nv' },
    { name: 'Thống kê', path: '/reports', icon: TrendingUp, matchPaths: ['/reports', '/analytics'], moduleCode: 'reports' },
  ];

  const visibleNavMenuItems = navMenuItems.filter(item => {
    if (isAdmin) return true;
    return canAccessModule(item.moduleCode);
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCpError(null);
    setCpSuccess(null);

    if (!currentPass) {
      setCpError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPass || newPass.length < 6) {
      setCpError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPass !== confirmPass) {
      setCpError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setCpLoading(true);
    try {
      const res = await accountService.changePassword(
        user.username,
        currentPass,
        newPass,
        user.name
      );
      setCpSuccess(res.message || 'Đổi mật khẩu thành công!');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setCpError(err?.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setCpLoading(false);
    }
  };

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'BGH': return 'Hiệu trưởng';
      case 'TTCM': return 'Tổ trưởng CM';
      case 'GIAO_VU': return 'Giáo vụ';
      case 'NHAN_SU': return 'Nhân sự';
      case 'GIAO_VIEN': return 'Giáo viên';
      default: return 'Hiệu trưởng';
    }
  };

  return (
    <>
      <header 
        id="app-main-header"
        className="main-header sticky top-0 z-[200] h-[60px] w-full bg-white/80 backdrop-blur-md border-b border-white/60 shadow-sm px-4 sm:px-6 lg:px-8 transition-all duration-300 flex items-center justify-between"
      >
        {/* BÊN TRÁI: LOGO & TÊN TRƯỜNG */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            id="mobile-menu-btn"
            className="text-[#0B3FA8] hover:text-[#1457D9] focus:outline-none lg:hidden p-2 rounded-xl hover:bg-blue-50/80 transition-colors"
            onClick={onMenuClick}
            title="Mở menu điều hướng"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            {/* LOGO TRƯỜNG THPT SƠN LƯƠNG */}
            <div className="relative w-11 h-11 rounded-full p-0.5 bg-white border border-[#3B82F6]/30 shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img 
                src="/logo.jpg" 
                alt="Logo THPT Sơn Lương" 
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            <div className="flex flex-col">
              <span className="font-extrabold text-[#123B78] text-sm lg:text-[15px] tracking-tight uppercase leading-tight group-hover:text-[#1457D9] transition-colors">
                TRƯỜNG THPT SƠN LƯƠNG
              </span>
              <span className="text-[9.5px] lg:text-[10.5px] font-bold text-[#1457D9] tracking-wider uppercase leading-tight">
                TRI THỨC - NHÂN CÁCH - TƯƠNG LAI
              </span>
            </div>
          </div>

          {/* Connection / Sync Status Indicator & System Version Badge */}
          <div className="hidden md:flex items-center gap-2 text-[10.5px] font-bold">
            <button 
              type="button"
              onClick={() => navigate('/settings')}
              className="px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs font-extrabold transition-colors flex items-center gap-1 cursor-pointer"
              title={`Phiên bản: ${CURRENT_SYSTEM_VERSION} | Build: ${SYSTEM_BUILD_TIME.substring(0, 16).replace('T', ' ')} UTC | Commit: ${SYSTEM_COMMIT_SHA} | Env: ${SYSTEM_ENV}`}
            >
              <span>{CURRENT_SYSTEM_VERSION}</span>
              <span className="text-[9px] opacity-75 font-mono">({SYSTEM_COMMIT_SHA.substring(0, 6)})</span>
            </button>
            {!isOnline ? (
              <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> Ngoại tuyến
              </span>
            ) : isQuota ? (
              <span className="flex items-center gap-1.5 text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-full shadow-2xs" title="Cơ sở dữ liệu chạm hạn ngạch đọc miễn phí hàng ngày, ứng dụng tự động hiển thị mượt mà từ bộ nhớ đệm dự phòng">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Cache Mode (Quota)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Trực tuyến
              </span>
            )}
          </div>
        </div>

        {/* MENU CHÍNH (CENTER) */}
        <nav 
          id="main-nav-bar"
          className="hidden xl:flex items-center gap-1.5 bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-white/70 shadow-sm"
        >
          {visibleNavMenuItems.map((item) => {
            const isActive = item.matchPaths.some(p => 
              p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
            );
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                id={`nav-item-${item.path.replace('/', '') || 'home'}`}
                onClick={() => navigate(item.path)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] font-bold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1457D9] text-white shadow-md shadow-[#1457D9]/25 scale-[1.02]'
                    : 'text-[#123B78] hover:text-[#1457D9] hover:bg-blue-50/70'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-white' : 'text-[#1457D9]'} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* BÊN PHẢI: NÚT QUAY LẠI GIAO DIỆN CHÍNH (NẾU Ở MODULE CON), THÔNG BÁO, AVATAR, USER INFO */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {!isDashboard && (
            <BackToHomeButton variant="header" className="hidden lg:inline-flex" />
          )}

          {/* Thông báo */}
          <button 
            id="notifications-bell-btn"
            onClick={() => navigate('/notifications')}
            className="relative p-2.5 text-[#1457D9] bg-white/90 border border-slate-200/80 shadow-sm rounded-xl hover:shadow-md hover:bg-blue-50/70 hover:-translate-y-0.5 transition-all"
            title="Thông báo hệ thống"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[11px] font-extrabold text-white shadow-sm ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Account Menu */}
          <div className="relative" ref={userMenuRef}>
            <button 
              id="user-profile-menu-btn"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2.5 bg-white/90 border border-slate-200/80 shadow-sm hover:shadow-md pl-1.5 pr-3 py-1.5 rounded-2xl transition-all hover:-translate-y-0.5 text-left"
            >
              <Avatar
                src={user?.avatar}
                name={user?.name || 'Nguyễn Văn A'}
                size="sm"
                className="ring-2 ring-blue-100"
              />
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="text-[13.5px] font-bold text-[#123B78]">
                  {user?.name || 'Nguyễn Văn A'}
                </span>
                <span className="text-[11px] font-semibold text-[#1457D9]">
                  {getRoleDisplayName(user?.role)}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-[#64748B] transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Menu Dropdown */}
            {isUserMenuOpen && (
              <div 
                id="user-account-dropdown"
                className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400">Đang đăng nhập với</p>
                  <p className="text-sm font-bold text-[#123B78] truncate">{user?.name || 'Nguyễn Văn A'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-[#1457D9] border border-blue-200/60">
                    {getRoleDisplayName(user?.role)}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsAvatarModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#1457D9] transition-colors cursor-pointer"
                  >
                    <Camera size={15} className="text-slate-500" />
                    <span>Đổi ảnh đại diện</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setCurrentPass('');
                      setNewPass('');
                      setConfirmPass('');
                      setCpError(null);
                      setCpSuccess(null);
                      setIsChangePassModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#1457D9] transition-colors cursor-pointer"
                  >
                    <KeyRound size={15} className="text-slate-500" />
                    <span>Đổi mật khẩu</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#1457D9] transition-colors cursor-pointer"
                  >
                    <SettingsIcon size={15} className="text-slate-500" />
                    <span>Cài đặt & Hồ sơ</span>
                  </button>

                  {(isAdmin || canAccessModule('accounts')) && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/accounts');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <Users size={15} className="text-blue-600" />
                      <span>Quản lý tài khoản</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-1 mt-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <LogOut size={15} className="text-rose-500" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <AvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatar={user?.avatar}
        userName={user?.name || 'Nguyễn Văn A'}
        onSave={handleSaveAvatar}
      />

      {/* Change Password Modal */}
      {isChangePassModalOpen && (
        <div className="fixed inset-0 z-500 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm">ĐỔI MẬT KHẨU TÀI KHOẢN</h3>
                  <p className="text-[11px] text-blue-100">Cập nhật mật khẩu cho {user?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePassModalOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-3.5 text-xs font-semibold">
              {cpError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{cpError}</span>
                </div>
              )}

              {cpSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{cpSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mật khẩu hiện tại *</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-semibold"
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mật khẩu mới (tối thiểu 6 ký tự) *</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-semibold"
                    placeholder="Nhập mật khẩu mới"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-semibold"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangePassModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-bold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={cpLoading}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-md transition-all font-black flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {cpLoading ? "Đang xử lý..." : "Lưu mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
