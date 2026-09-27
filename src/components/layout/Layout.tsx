import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  return (
    <div className="app-layout font-sans text-[#123B78]">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} hideOnDesktop={false} />
      
      <div className="main-content flex flex-col min-w-0 h-screen overflow-y-auto custom-scrollbar">
        <Header onMenuClick={() => setSidebarOpen(true)} isDashboard={isDashboard} />
        
        <main className={`flex-1 relative z-0 focus:outline-none custom-scrollbar ${isDashboard ? 'p-0 overflow-x-hidden' : 'pb-8'}`}>
          {children}
          
          {/* Footer for non-dashboard pages */}
          {!isDashboard && (
            <footer className="w-full px-4 sm:px-6 lg:px-8 py-6 mt-8 border-t border-[#123B78]/10 text-center relative z-10">
              <div className="flex flex-col items-center justify-center space-y-2">
                <h3 className="font-bold text-[#123B78] uppercase drop-shadow-sm">Trường THPT Sơn Lương</h3>
                <p className="text-sm font-medium text-[#123B78] flex items-center justify-center gap-2">
                  <span className="text-[#3B82F6]">📍</span> Xã Sơn Lương, tỉnh Phú Thọ
                </p>
                <div className="w-16 h-0.5 bg-[#3B82F6]/30 my-2 rounded-full"></div>
                <p className="text-xs font-medium text-[#123B78]/80 italic mt-1">Kiến tạo tương lai từ hôm nay</p>
              </div>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
