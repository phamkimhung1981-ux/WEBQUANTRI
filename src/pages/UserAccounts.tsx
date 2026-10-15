import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { Badge } from '../components/ui/Badge';
import Avatar from '../components/ui/Avatar';
import BackButton from '../components/ui/BackButton';
import { 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Users, 
  KeyRound, 
  Lock, 
  Unlock, 
  Plus, 
  Download, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Eye, 
  EyeOff, 
  Copy, 
  ShieldCheck, 
  Sparkles,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { Teacher, Role } from '../types';
import * as XLSX from 'xlsx';
import { canEditOrDelete } from '../utils/envUtils';

// Helper to remove Vietnamese accents for clean auto-generated usernames
function removeAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Generate suggested username based on full name or email or teacher code
function generateSuggestedUsername(teacher: Teacher, existingUsernames: Set<string>): string {
  let base = '';
  if (teacher.email && teacher.email.includes('@')) {
    base = teacher.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
  }
  if (!base && teacher.name) {
    const parts = teacher.name.trim().split(/\s+/);
    if (parts.length > 0) {
      // e.g. "Nguyễn Văn An" -> "an" + "nv" or "nguyenvanan"
      const firstName = removeAccents(parts[parts.length - 1]);
      const initials = parts.slice(0, parts.length - 1).map(p => removeAccents(p)[0] || '').join('');
      base = `${firstName}.${initials}`;
      if (!base || base.length < 3) {
        base = removeAccents(teacher.name);
      }
    }
  }
  if (!base && teacher.code) {
    base = teacher.code.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  if (!base) {
    base = `user_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  let username = base;
  let counter = 1;
  while (existingUsernames.has(username.toLowerCase())) {
    username = `${base}${counter}`;
    counter++;
  }
  return username;
}

// Determine default system role from teacher position or current role
function getSuggestedRole(teacher: Teacher): Role {
  if (teacher.role === 'admin' || teacher.role === 'ADMIN') return 'admin';
  if (teacher.role === 'BGH') return 'BGH';
  if (teacher.role === 'TTCM') return 'TTCM';
  
  const pos = (teacher.position || teacher.role || '').toLowerCase();
  if (pos.includes('hiệu trưởng') || pos.includes('hieu truong') || pos.includes('bgh')) return 'BGH';
  if (pos.includes('tổ trưởng') || pos.includes('to truong') || pos.includes('ttcm')) return 'TTCM';
  if (pos.includes('nhân viên') || pos.includes('nhan vien') || pos.includes('nv')) return 'NHAN_VIEN';
  return 'GIAO_VIEN';
}

export default function UserAccounts() {
  const { teachers, departments, updateTeacher } = useAppContext();
  const { user: currentUser, isAdmin } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Modals state
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  
  // Selected teacher for editing / password reset / lock toggle
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Form states for Single Account Modal
  const [formUsername, setFormUsername] = useState('');
  const [formRole, setFormRole] = useState<Role>('GIAO_VIEN');
  const [formPassword, setFormPassword] = useState('SonLuong@2026');
  const [formStatus, setFormStatus] = useState<'Chưa có tài khoản' | 'Đang hoạt động' | 'Đã khóa'>('Đang hoạt động');
  const [formEmail, setFormEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form state for Batch Account Modal
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [batchDefaultPassword, setBatchDefaultPassword] = useState('SonLuong@2026');
  const [batchUsernames, setBatchUsernames] = useState<Record<string, string>>({});
  const [batchRoles, setBatchRoles] = useState<Record<string, Role>>({});

  // Toast / Notification banner state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Existing usernames set (including 'admin')
  const existingUsernames = useMemo(() => {
    const set = new Set<string>(['admin']);
    teachers.forEach(t => {
      if (t.username) set.add(t.username.toLowerCase());
    });
    return set;
  }, [teachers]);

  // Derive account status for teachers (default to 'Chưa có tài khoản' if not set)
  const processedTeachers = useMemo(() => {
    return teachers.map(t => {
      let status = t.accountStatus;
      if (!status) {
        if (t.username || t.hasAccount) {
          status = 'Đang hoạt động';
        } else {
          status = 'Chưa có tài khoản';
        }
      }
      return {
        ...t,
        accountStatus: status
      };
    });
  }, [teachers]);

  // Statistics
  const totalCount = processedTeachers.length;
  const activeCount = processedTeachers.filter(t => t.accountStatus === 'Đang hoạt động').length;
  const pendingCount = processedTeachers.filter(t => t.accountStatus === 'Chưa có tài khoản').length;
  const lockedCount = processedTeachers.filter(t => t.accountStatus === 'Đã khóa').length;

  // Filtered list
  const filteredTeachers = useMemo(() => {
    return processedTeachers.filter(t => {
      const matchSearch = 
        (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = filterDept === 'All' || t.departmentId === filterDept;
      
      const teacherRole = t.accountRole || t.role;
      const matchRole = filterRole === 'All' || teacherRole === filterRole;

      const matchStatus = filterStatus === 'All' || t.accountStatus === filterStatus;

      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }, [processedTeachers, searchTerm, filterDept, filterRole, filterStatus]);

  // Open Create/Edit Single Account Modal
  const handleOpenSingleModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setFormEmail(teacher.email || '');

    if (teacher.username) {
      setFormUsername(teacher.username);
      setFormRole(teacher.accountRole || teacher.role || getSuggestedRole(teacher));
      setFormStatus(teacher.accountStatus || 'Đang hoạt động');
      setFormPassword(''); // empty means keep unchanged unless filled
    } else {
      const suggested = generateSuggestedUsername(teacher, existingUsernames);
      setFormUsername(suggested);
      setFormRole(getSuggestedRole(teacher));
      setFormStatus('Đang hoạt động');
      setFormPassword('SonLuong@2026');
    }
    setShowPassword(false);
    setIsSingleModalOpen(true);
  };

  // Save Single Account
  const handleSaveSingleAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    const cleanUsername = formUsername.trim().toLowerCase();
    if (!cleanUsername) {
      showToast('Vui lòng nhập tên đăng nhập.', 'error');
      return;
    }

    // Check duplicate username if changed
    const otherUsernames = new Set<string>(['admin']);
    teachers.forEach(t => {
      if (t.id !== selectedTeacher.id && t.username) {
        otherUsernames.add(t.username.toLowerCase());
      }
    });

    if (otherUsernames.has(cleanUsername)) {
      showToast(`Tên đăng nhập "${cleanUsername}" đã tồn tại trên hệ thống. Vui lòng chọn tên khác.`, 'error');
      return;
    }

    const updates: Partial<Teacher> = {
      username: cleanUsername,
      role: formRole,
      accountRole: formRole,
      accountStatus: formStatus,
      hasAccount: formStatus !== 'Chưa có tài khoản',
      email: formEmail,
      accountUpdatedAt: new Date().toISOString()
    };

    if (formPassword) {
      updates.password = formPassword;
      updates.accountPassword = formPassword;
    }

    if (!selectedTeacher.username) {
      updates.accountCreatedAt = new Date().toISOString();
    }

    updateTeacher(selectedTeacher.id, updates);
    setIsSingleModalOpen(false);
    showToast(`Đã ${selectedTeacher.username ? 'cập nhật' : 'tạo'} tài khoản thành công cho ${selectedTeacher.name}!`);
  };

  // Open Batch Account Modal
  const handleOpenBatchModal = () => {
    const pendingList = processedTeachers.filter(t => t.accountStatus === 'Chưa có tài khoản');
    const selectedIds = pendingList.map(t => t.id);
    setBatchSelectedIds(selectedIds);

    const usernames: Record<string, string> = {};
    const roles: Record<string, Role> = {};
    const tempUsed = new Set<string>(existingUsernames);

    pendingList.forEach(t => {
      const suggestedName = generateSuggestedUsername(t, tempUsed);
      tempUsed.add(suggestedName.toLowerCase());
      usernames[t.id] = suggestedName;
      roles[t.id] = getSuggestedRole(t);
    });

    setBatchUsernames(usernames);
    setBatchRoles(roles);
    setIsBatchModalOpen(true);
  };

  // Execute Batch Account Creation
  const handleExecuteBatchCreation = () => {
    if (batchSelectedIds.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 cán bộ giáo viên để tạo tài khoản.', 'error');
      return;
    }

    let successCount = 0;
    batchSelectedIds.forEach(id => {
      const teacher = teachers.find(t => t.id === id);
      if (teacher) {
        const username = batchUsernames[id] || generateSuggestedUsername(teacher, existingUsernames);
        const role = batchRoles[id] || getSuggestedRole(teacher);

        updateTeacher(id, {
          username: username.toLowerCase().trim(),
          role: role,
          accountRole: role,
          accountStatus: 'Đang hoạt động',
          hasAccount: true,
          password: batchDefaultPassword,
          accountPassword: batchDefaultPassword,
          accountCreatedAt: new Date().toISOString()
        });
        successCount++;
      }
    });

    setIsBatchModalOpen(false);
    showToast(`Đã tạo thành công ${successCount} tài khoản mới với mật khẩu mặc định "${batchDefaultPassword}"!`);
  };

  // Toggle Lock / Unlock Account
  const handleToggleLockAccount = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsLockModalOpen(true);
  };

  const handleConfirmLockToggle = () => {
    if (!selectedTeacher) return;
    const newStatus = selectedTeacher.accountStatus === 'Đã khóa' ? 'Đang hoạt động' : 'Đã khóa';
    
    updateTeacher(selectedTeacher.id, {
      accountStatus: newStatus,
      accountLockedAt: newStatus === 'Đã khóa' ? new Date().toISOString() : undefined
    });

    setIsLockModalOpen(false);
    showToast(`Đã ${newStatus === 'Đã khóa' ? 'khóa' : 'mở khóa'} tài khoản của ${selectedTeacher.name}!`);
  };

  // Open Reset Password Modal
  const handleOpenResetPasswordModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setFormPassword('SonLuong@2026');
    setCopiedNotice(false);
    setIsPasswordModalOpen(true);
  };

  // Confirm Reset Password
  const handleConfirmResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    if (!formPassword) {
      showToast('Vui lòng nhập mật khẩu mới.', 'error');
      return;
    }

    updateTeacher(selectedTeacher.id, {
      password: formPassword,
      accountPassword: formPassword,
      accountUpdatedAt: new Date().toISOString()
    });

    setIsPasswordModalOpen(false);
    showToast(`Đã cấp lại mật khẩu thành công cho tài khoản ${selectedTeacher.username}!`);
  };

  // Remove Account
  const handleRemoveAccount = (teacher: Teacher) => {
    if (window.confirm(`Bạn có chắc chắn muốn gỡ tài khoản đăng nhập của ${teacher.name}? Thao tác này sẽ đặt trạng thái về "Chưa có tài khoản".`)) {
      updateTeacher(teacher.id, {
        username: '',
        hasAccount: false,
        accountStatus: 'Chưa có tài khoản',
        password: '',
        accountPassword: ''
      });
      showToast(`Đã gỡ tài khoản của ${teacher.name}.`);
    }
  };

  // Export Account List to Excel (without passwords)
  const handleExportExcel = () => {
    const data = filteredTeachers.map((t, idx) => {
      const dept = departments.find(d => d.id === t.departmentId)?.name || 'Chưa phân tổ';
      let roleText = 'Giáo viên';
      const r = t.accountRole || t.role;
      if (r === 'admin' || r === 'ADMIN') roleText = 'Quản trị viên';
      else if (r === 'BGH') roleText = 'Ban Giám hiệu';
      else if (r === 'TTCM') roleText = 'Tổ trưởng chuyên môn';
      else if (r === 'NHAN_VIEN') roleText = 'Nhân viên';

      return {
        'STT': idx + 1,
        'Mã GV': t.code || '',
        'Họ và tên': t.name || '',
        'Chức vụ / Vị trí': t.position || t.role || '',
        'Tổ chuyên môn': dept,
        'Tên đăng nhập': t.username || 'Chưa tạo',
        'Vai trò hệ thống': roleText,
        'Trạng thái tài khoản': t.accountStatus || 'Chưa có tài khoản',
        'Email': t.email || '',
        'Số điện thoại': t.phone || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-fit column widths
    const wscols = [
      { wch: 6 },  // STT
      { wch: 12 }, // Mã GV
      { wch: 26 }, // Họ tên
      { wch: 18 }, // Chức vụ
      { wch: 28 }, // Tổ CM
      { wch: 20 }, // Tên đăng nhập
      { wch: 22 }, // Vai trò
      { wch: 20 }, // Trạng thái
      { wch: 28 }, // Email
      { wch: 15 }  // SĐT
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DSTaiKhoan_THPTSonLuong");
    XLSX.writeFile(wb, "DanhSachTaiKhoan_THPTSonLuong.xlsx");
    showToast('Đã xuất thành công file Excel danh sách tài khoản!');
  };

  // Copy password to clipboard
  const handleCopyPassword = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 font-sans">
      {/* Toast message */}
      {toastMessage && (
        <div className={`fixed top-20 right-6 z-[300] px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 transition-all animate-bounce ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-600 text-white border-emerald-500' 
            : 'bg-rose-600 text-white border-rose-500'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-3">
            <BackButton fallbackPath="/" />
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-black uppercase rounded-full tracking-wider border border-blue-400/30">
              Quản trị hệ thống
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-blue-400" />
            Quản Lý Tài Khoản Đăng Nhập
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm font-medium">
            Tạo và quản lý tài khoản truy cập hệ thống cho cán bộ quản lý, giáo viên và nhân viên THPT Sơn Lương
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          <button
            onClick={handleOpenBatchModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg transition-all cursor-pointer active:scale-95"
            title="Tạo tài khoản hàng loạt cho tất cả giáo viên chưa có tài khoản"
          >
            <Sparkles size={18} />
            <span>Tạo tài khoản hàng loạt ({pendingCount})</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer backdrop-blur-md"
            title="Xuất danh sách tài khoản ra file Excel"
          >
            <Download size={18} />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* STATS SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng nhân sự</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{totalCount}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Toàn trường</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Đang hoạt động</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">{activeCount}</p>
            <p className="text-[11px] text-emerald-600/80 font-medium mt-0.5">Đã có tài khoản</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Chưa có tài khoản</p>
            <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">{pendingCount}</p>
            <p className="text-[11px] text-amber-600/80 font-medium mt-0.5">Cần tạo tài khoản</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <UserX size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Đã khóa</p>
            <p className="text-2xl sm:text-3xl font-black text-rose-700 mt-1">{lockedCount}</p>
            <p className="text-[11px] text-rose-600/80 font-medium mt-0.5">Tạm dừng truy cập</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Lock size={24} />
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo họ tên, mã GV, tên đăng nhập, email, SĐT..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </div>

          {/* Filter Department */}
          <div className="md:col-span-3">
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">Tất cả Tổ chuyên môn</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Role */}
          <div className="md:col-span-2">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">Tất cả Vai trò</option>
              <option value="BGH">Ban Giám hiệu</option>
              <option value="TTCM">Tổ trưởng CM</option>
              <option value="GIAO_VIEN">Giáo viên</option>
              <option value="NHAN_VIEN">Nhân viên</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>

          {/* Filter Account Status */}
          <div className="md:col-span-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">Tất cả Trạng thái tài khoản</option>
              <option value="Đang hoạt động">Đang hoạt động</option>
              <option value="Chưa có tài khoản">Chưa có tài khoản</option>
              <option value="Đã khóa">Đã khóa</option>
            </select>
          </div>
        </div>

        {/* Results counter indicator */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-1 border-t border-slate-100">
          <span>Hiển thị <strong className="text-slate-800">{filteredTeachers.length}</strong> / {totalCount} cán bộ giáo viên</span>
          {(searchTerm || filterDept !== 'All' || filterRole !== 'All' || filterStatus !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterDept('All');
                setFilterRole('All');
                setFilterStatus('All');
              }}
              className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* MAIN DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600 tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">STT</th>
                <th className="py-3.5 px-4 min-w-[220px]">Cán bộ / Giáo viên / Nhân viên</th>
                <th className="py-3.5 px-4 min-w-[180px]">Tổ chuyên môn & Chức vụ</th>
                <th className="py-3.5 px-4 min-w-[160px]">Tên đăng nhập</th>
                <th className="py-3.5 px-4 min-w-[150px]">Vai trò hệ thống</th>
                <th className="py-3.5 px-4 min-w-[150px]">Trạng thái tài khoản</th>
                <th className="py-3.5 px-4 min-w-[190px] text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium text-slate-700">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    Không tìm thấy nhân sự phù hợp với điều kiện lọc.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher, idx) => {
                  const dept = departments.find(d => d.id === teacher.departmentId);
                  const isLocked = teacher.accountStatus === 'Đã khóa';
                  const hasAcc = teacher.accountStatus === 'Đang hoạt động';

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={teacher.name} src={teacher.avatar} size="md" />
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              {teacher.name}
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {teacher.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {teacher.email ? teacher.email : (teacher.phone || 'Chưa có email/SĐT')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department & Position */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {dept?.name || 'Chưa phân tổ'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {teacher.position || teacher.role || 'Giáo viên'}
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4">
                        {teacher.username ? (
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60 inline-block">
                            {teacher.username}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-normal text-xs">
                            Chưa khởi tạo
                          </span>
                        )}
                      </td>

                      {/* System Role */}
                      <td className="py-3.5 px-4">
                        {teacher.role === 'admin' || teacher.role === 'ADMIN' ? (
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-700 font-bold rounded-lg text-xs inline-flex items-center gap-1 border border-purple-200">
                            <ShieldCheck size={12} /> Quản trị viên
                          </span>
                        ) : teacher.role === 'BGH' ? (
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-bold rounded-lg text-xs inline-block border border-blue-200">
                            Ban Giám hiệu
                          </span>
                        ) : teacher.role === 'TTCM' ? (
                          <span className="px-2.5 py-1 bg-teal-100 text-teal-800 font-bold rounded-lg text-xs inline-block border border-teal-200">
                            Tổ trưởng CM
                          </span>
                        ) : teacher.role === 'NHAN_VIEN' ? (
                          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-lg text-xs inline-block border border-indigo-200">
                            Nhân viên
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs inline-block border border-slate-200">
                            Giáo viên
                          </span>
                        )}
                      </td>

                      {/* Account Status Badge */}
                      <td className="py-3.5 px-4">
                        {isLocked ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-700 font-bold rounded-full text-xs inline-flex items-center gap-1 border border-rose-200">
                            <Lock size={12} /> Đã khóa
                          </span>
                        ) : hasAcc ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-full text-xs inline-flex items-center gap-1 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-full text-xs inline-flex items-center gap-1 border border-amber-200">
                            <UserX size={12} /> Chưa có tài khoản
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {!teacher.username ? (
                          <button
                            onClick={() => handleOpenSingleModal(teacher)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={14} />
                            Tạo tài khoản
                          </button>
                        ) : (
                          <>
                            {canEditOrDelete() && (
                              <>
                                <button
                                  onClick={() => handleOpenSingleModal(teacher)}
                                  className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                  title="Sửa thông tin / Đổi vai trò"
                                >
                                  <Edit3 size={15} />
                                </button>

                                <button
                                  onClick={() => handleOpenResetPasswordModal(teacher)}
                                  className="p-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-600 rounded-lg transition-colors cursor-pointer"
                                  title="Cấp lại mật khẩu"
                                >
                                  <KeyRound size={15} />
                                </button>

                                <button
                                  onClick={() => handleToggleLockAccount(teacher)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isLocked 
                                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' 
                                      : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                                  }`}
                                  title={isLocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                                >
                                  {isLocked ? <Unlock size={15} /> : <Lock size={15} />}
                                </button>

                                <button
                                  onClick={() => handleRemoveAccount(teacher)}
                                  className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                                  title="Gỡ tài khoản"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: SINGLE ACCOUNT CREATION / EDIT */}
      {isSingleModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {selectedTeacher.username ? 'Sửa thông tin tài khoản' : 'Tạo tài khoản đăng nhập'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Gắn tài khoản cho cán bộ: <strong className="text-slate-800">{selectedTeacher.name}</strong> ({selectedTeacher.code})
                </p>
              </div>
              <button
                onClick={() => setIsSingleModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSingleAccount} className="space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên đăng nhập <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/30"
                  placeholder="VD: nguyenvana"
                />
                <p className="text-[11px] text-slate-400 mt-1">Chữ cái viết liền không dấu, có thể kèm dấu chấm hoặc gạch dưới.</p>
              </div>

              {/* System Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vai trò hệ thống <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="GIAO_VIEN">Giáo viên</option>
                  <option value="TTCM">Tổ trưởng chuyên môn (TTCM)</option>
                  <option value="BGH">Ban Giám hiệu (BGH)</option>
                  <option value="NHAN_VIEN">Nhân viên hành chính</option>
                  <option value="admin">Quản trị viên hệ thống (Admin)</option>
                </select>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email liên hệ
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: gv.nguyenvana@thptsonluong.edu.vn"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu {selectedTeacher.username ? '(Để trống nếu không đổi)' : <span className="text-rose-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={selectedTeacher.username ? "Nhập mật khẩu mới nếu muốn đổi" : "VD: SonLuong@2026"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trạng thái tài khoản
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('Đang hoạt động')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      formStatus === 'Đang hoạt động' 
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Đang hoạt động
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('Đã khóa')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      formStatus === 'Đã khóa' 
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Đã khóa
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BATCH ACCOUNT CREATION */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  Tạo tài khoản hàng loạt cho cán bộ giáo viên
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Hệ thống tự động đề xuất tên đăng nhập chuẩn và gắn vai trò phù hợp theo chức vụ
                </p>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Default Password Configuration */}
            <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Mật khẩu khởi tạo mặc định:</span>
                <p className="text-xs text-emerald-700 font-medium">Toàn bộ tài khoản khởi tạo đợt này sẽ nhận mật khẩu khởi tạo này.</p>
              </div>
              <input
                type="text"
                value={batchDefaultPassword}
                onChange={(e) => setBatchDefaultPassword(e.target.value)}
                className="px-3.5 py-2 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-900 bg-white w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Teacher Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 uppercase font-black text-slate-500 text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={batchSelectedIds.length > 0 && batchSelectedIds.length === processedTeachers.filter(t => t.accountStatus === 'Chưa có tài khoản').length}
                        onChange={(e) => {
                          const pendingList = processedTeachers.filter(t => t.accountStatus === 'Chưa có tài khoản');
                          if (e.target.checked) {
                            setBatchSelectedIds(pendingList.map(t => t.id));
                          } else {
                            setBatchSelectedIds([]);
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="py-3 px-3">Họ và tên & Mã GV</th>
                    <th className="py-3 px-3">Tổ chuyên môn</th>
                    <th className="py-3 px-3">Tên đăng nhập đề xuất</th>
                    <th className="py-3 px-3">Vai trò phân gán</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedTeachers.filter(t => t.accountStatus === 'Chưa có tài khoản').length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                        Tất cả cán bộ giáo viên nhà trường đều đã có tài khoản đăng nhập!
                      </td>
                    </tr>
                  ) : (
                    processedTeachers.filter(t => t.accountStatus === 'Chưa có tài khoản').map((t) => {
                      const isChecked = batchSelectedIds.includes(t.id);
                      const dept = departments.find(d => d.id === t.departmentId);

                      return (
                        <tr key={t.id} className={isChecked ? 'bg-blue-50/30' : 'opacity-60'}>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBatchSelectedIds([...batchSelectedIds, t.id]);
                                } else {
                                  setBatchSelectedIds(batchSelectedIds.filter(id => id !== t.id));
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{t.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{t.code} • {t.position || t.role}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {dept?.name || 'Chưa phân tổ'}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={batchUsernames[t.id] || ''}
                              onChange={(e) => {
                                setBatchUsernames({ ...batchUsernames, [t.id]: e.target.value });
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={batchRoles[t.id] || 'GIAO_VIEN'}
                              onChange={(e) => {
                                setBatchRoles({ ...batchRoles, [t.id]: e.target.value as Role });
                              }}
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
                            >
                              <option value="GIAO_VIEN">Giáo viên</option>
                              <option value="TTCM">Tổ trưởng CM</option>
                              <option value="BGH">Ban Giám hiệu</option>
                              <option value="NHAN_VIEN">Nhân viên</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-600">
                Đã chọn <strong className="text-blue-600">{batchSelectedIds.length}</strong> cán bộ giáo viên
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatchCreation}
                  disabled={batchSelectedIds.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2"
                >
                  <Sparkles size={16} />
                  Xác nhận khởi tạo ({batchSelectedIds.length}) tài khoản
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET PASSWORD */}
      {isPasswordModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-500" />
                  Cấp lại mật khẩu tài khoản
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tài khoản: <strong className="text-blue-700 font-mono">{selectedTeacher.username}</strong> ({selectedTeacher.name})
                </p>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-20 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/20"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyPassword(formPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Copy size={12} />
                    {copiedNotice ? 'Đã chép!' : 'Sao chép'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Mật khẩu mặc định hệ thống: <strong className="text-slate-700">SonLuong@2026</strong></p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Lưu mật khẩu mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRM LOCK / UNLOCK */}
      {isLockModalOpen && selectedTeacher && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-4 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {selectedTeacher.accountStatus === 'Đã khóa' ? 'Mở khóa tài khoản' : 'Xác nhận khóa tài khoản'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Cán bộ: <strong className="text-slate-800">{selectedTeacher.name}</strong> ({selectedTeacher.username})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {selectedTeacher.accountStatus === 'Đã khóa'
                ? "Sau khi mở khóa, tài khoản này có thể tiếp tục đăng nhập vào hệ thống Quản lý giáo viên THPT Sơn Lương."
                : "Sau khi khóa, tài khoản này sẽ ngay lập tức bị từ chối truy cập khi đăng nhập cho đến khi được mở khóa trở lại."}
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsLockModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmLockToggle}
                className={`px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer ${
                  selectedTeacher.accountStatus === 'Đã khóa'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {selectedTeacher.accountStatus === 'Đã khóa' ? 'Mở khóa ngay' : 'Khóa tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
