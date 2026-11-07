import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { accountService } from '../services/accountService';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  KeyRound, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  X,
  GraduationCap
} from 'lucide-react';

import { useAppContext } from '../store/AppContext';

export default function Login() {
  const { login, error, clearError } = useAuth();
  const { clearError: clearAppError } = useAppContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Change Password Modal state
  const [isChangePassModalOpen, setIsChangePassModalOpen] = useState(false);
  const [cpUsername, setCpUsername] = useState('');
  const [cpCurrentPass, setCpCurrentPass] = useState('');
  const [cpNewPass, setCpNewPass] = useState('');
  const [cpConfirmPass, setCpConfirmPass] = useState('');
  const [showCpCurrent, setShowCpCurrent] = useState(false);
  const [showCpNew, setShowCpNew] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSuccess, setCpSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    clearAppError();
    setLoading(true);
    await login(username, password);
    setLoading(false);
  };

  const handleOpenChangePass = () => {
    setCpUsername(username);
    setCpCurrentPass('');
    setCpNewPass('');
    setCpConfirmPass('');
    setCpError(null);
    setCpSuccess(null);
    setIsChangePassModalOpen(true);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError(null);
    setCpSuccess(null);

    if (!cpUsername.trim()) {
      setCpError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!cpCurrentPass) {
      setCpError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!cpNewPass || cpNewPass.length < 6) {
      setCpError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (cpNewPass !== cpConfirmPass) {
      setCpError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setCpLoading(true);
    try {
      const newP = cpNewPass.trim();
      const res = await accountService.changePassword(
        cpUsername.trim(),
        cpCurrentPass,
        newP,
        cpUsername.trim()
      );
      setCpSuccess(res.message || 'Đổi mật khẩu thành công! Bạn có thể dùng mật khẩu mới để đăng nhập.');
      setUsername(cpUsername.trim());
      setPassword(newP);
      setCpCurrentPass('');
      setCpNewPass('');
      setCpConfirmPass('');
    } catch (err: any) {
      setCpError(err?.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setCpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans relative overflow-hidden select-none">
      {/* Background Image & Ambient Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="/hhhh.jpg"
          className="w-full h-full object-cover object-center opacity-30 scale-105 filter blur-[1px]"
          alt="Trường THPT Sơn Lương"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-blue-950/70" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
        {/* School Crest / Logo */}
        <div className="flex justify-center mb-3">
          <div className="w-20 h-20 rounded-full bg-white shadow-2xl border-2 border-blue-400/80 flex items-center justify-center p-1.5 ring-4 ring-blue-500/20 backdrop-blur-md">
            <img 
              src="/logo.jpg" 
              alt="Logo THPT Sơn Lương" 
              className="w-full h-full object-contain rounded-full" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase drop-shadow-md">
          TRƯỜNG THPT SƠN LƯƠNG
        </h1>
        <p className="text-xs font-extrabold text-blue-300 tracking-widest uppercase mt-0.5">
          Tri thức – Nhân cách – Tương lai
        </p>
        <p className="mt-2 text-xs text-slate-300 font-medium max-w-sm mx-auto">
          Cổng thông tin quản lý nội bộ, đánh giá thi đua và phân quyền CBGVNV
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-white/95 backdrop-blur-xl py-7 px-6 sm:px-8 shadow-2xl rounded-3xl border border-white/60">
          <div className="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Đăng nhập hệ thống</h2>
              <p className="text-xs text-slate-500 font-medium">Nhập tài khoản được cấp để tiếp tục</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-700">
              <ShieldCheck size={20} />
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên đăng nhập
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) clearError();
                  }}
                  className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-xs font-semibold text-slate-800 transition-all placeholder:text-slate-400"
                  placeholder="Nhập tên đăng nhập (VD: admin, hungpk...)"
                />
              </div>
            </div>

            {/* Password Input with Show/Hide toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={handleOpenChangePass}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  Đổi mật khẩu?
                </button>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) clearError();
                  }}
                  className="block w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-xs font-semibold text-slate-800 transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-xs font-black text-white bg-blue-700 hover:bg-blue-800 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={15} />
                    <span>ĐĂNG NHẬP</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security & Support Note */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-600" />
              Bảo mật phân quyền RBAC
            </span>
            <button
              type="button"
              onClick={handleOpenChangePass}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Tự đổi mật khẩu
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-4 font-semibold">
          Hệ thống Quản lý Giáo dục THPT Sơn Lương © 2026. Mọi quyền được bảo lưu.
        </p>
      </div>

      {/* MODAL: ĐỔI MẬT KHẨU TỰ PHỤC VỤ */}
      {isChangePassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm">ĐỔI MẬT KHẨU TÀI KHOẢN</h3>
                  <p className="text-[11px] text-blue-100">Cập nhật mật khẩu bảo mật cá nhân</p>
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

            <form onSubmit={handleChangePasswordSubmit} className="p-6 space-y-3.5 text-xs font-semibold">
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
                <label className="block text-slate-700 font-bold mb-1">Tên đăng nhập *</label>
                <input
                  type="text"
                  required
                  value={cpUsername}
                  onChange={(e) => setCpUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-semibold"
                  placeholder="Nhập tên đăng nhập của bạn"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mật khẩu hiện tại *</label>
                <div className="relative">
                  <input
                    type={showCpCurrent ? 'text' : 'password'}
                    required
                    value={cpCurrentPass}
                    onChange={(e) => setCpCurrentPass(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-semibold"
                    placeholder="Mật khẩu hiện tại"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCpCurrent(!showCpCurrent)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCpCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mật khẩu mới (tối thiểu 6 ký tự) *</label>
                <div className="relative">
                  <input
                    type={showCpNew ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={cpNewPass}
                    onChange={(e) => setCpNewPass(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-semibold"
                    placeholder="Nhập mật khẩu mới"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCpNew(!showCpNew)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCpNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={cpConfirmPass}
                  onChange={(e) => setCpConfirmPass(e.target.value)}
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
                  {cpLoading ? "Đang xử lý..." : "Xác nhận đổi mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
