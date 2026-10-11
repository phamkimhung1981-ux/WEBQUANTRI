import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { ThreeDIcon } from '../components/ui/ThreeDIcon';

export default function Login() {
  const { login, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(username);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900/10 flex flex-col justify-center py-8 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="/hhhh.jpg"
          className="w-full h-full object-cover object-center opacity-40"
          alt="Trường THPT Sơn Lương"
        />
      </div>
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px] pointer-events-none"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-sm relative z-10 text-center">
        <div className="flex justify-center mb-2">
          <div className="w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-md border border-blue-200/80 shadow-md flex items-center justify-center p-1">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain rounded-xl" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        </div>
        <h2 className="text-center text-xl sm:text-2xl font-black text-slate-900 tracking-tight drop-shadow-md">
          Hệ Thống Quản Lý
          <br />
          <span className="text-blue-700">Giáo Viên THPT Sơn Lương</span>
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-slate-700 drop-shadow">
          Đăng nhập để truy cập hệ thống
        </p>
      </div>

      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-sm relative z-10 px-4 sm:px-0">
        <div className="bg-white/85 backdrop-blur-md py-6 px-6 shadow-xl rounded-2xl border border-white/80">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên đăng nhập
              </label>
              <div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300/80 rounded-xl shadow-xs bg-white/90 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold"
                  placeholder="VD: admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu
              </label>
              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300/80 rounded-xl shadow-xs bg-white/90 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50"
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </div>
            
            <div className="mt-3 text-[11px] text-slate-600 text-center space-y-0.5">
              <p className="font-semibold">Hệ thống đã kết nối Database thật.</p>
              <p>Tài khoản khởi tạo: <strong className="text-slate-800">admin</strong></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
