import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Key, 
  Lock, 
  Unlock, 
  Search, 
  Filter, 
  Plus, 
  FileSpreadsheet, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  History, 
  Grid, 
  Sliders, 
  UserX,
  X,
  Save,
  RotateCcw,
  Sparkles,
  Copy
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { 
  AccountRecord, 
  RoleGroupCode, 
  AccountStatus, 
  DEFAULT_ROLE_GROUPS, 
  SYSTEM_MODULES_LIST, 
  ACTION_LABELS, 
  PermissionAction, 
  ModuleCode, 
  ModulePermissionsMap, 
  AccountAuditLog,
  createEmptyModulePermissions
} from '../types/permission';
import { accountService } from '../services/accountService';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Teacher } from '../types';

export default function AccountManagement() {
  const { user } = useAuth();
  const { isAdmin, isBGH } = usePermission();

  const [activeTab, setActiveTab] = useState<'accounts' | 'matrix' | 'audit'>('accounts');
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [auditLogs, setAuditLogs] = useState<AccountAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Search & Filter state for Account List
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Password visibility map (accountId -> boolean)
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null);
  const [resetPassModalAccount, setResetPassModalAccount] = useState<AccountRecord | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [lockModalAccount, setLockModalAccount] = useState<AccountRecord | null>(null);
  const [lockReasonInput, setLockReasonInput] = useState('');
  const [deactivateModalAccount, setDeactivateModalAccount] = useState<AccountRecord | null>(null);
  const [deactivateReasonInput, setDeactivateReasonInput] = useState('');

  // Copy permissions modal state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyTargetAccount, setCopyTargetAccount] = useState<AccountRecord | null>(null);
  const [copySourceAccountId, setCopySourceAccountId] = useState<string>('');

  // Create form state
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('123456');
  const [formRoleGroup, setFormRoleGroup] = useState<RoleGroupCode>('TEACHER');
  const [formPosition, setFormPosition] = useState('Giáo viên');
  const [formDepartmentName, setFormDepartmentName] = useState('');
  const [formStatus, setFormStatus] = useState<AccountStatus>('Đang hoạt động');

  // Permission Matrix Tab state
  const [matrixTargetType, setMatrixTargetType] = useState<'role' | 'user'>('role');
  const [selectedRoleGroup, setSelectedRoleGroup] = useState<RoleGroupCode>('TEACHER');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [matrixPermissions, setMatrixPermissions] = useState<ModulePermissionsMap>(
    DEFAULT_ROLE_GROUPS.TEACHER.permissions
  );
  const [matrixIsDirty, setMatrixIsDirty] = useState(false);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load accounts and teachers
  const loadData = async () => {
    setLoading(true);
    try {
      const [accList, teachersSnap, logs] = await Promise.all([
        accountService.getAccounts(),
        getDocs(collection(db, 'teachers')),
        accountService.getAuditLogs(30)
      ]);

      setAccounts(accList);
      if (accList.length > 0) {
        setSelectedUserId(prev => {
          if (prev && accList.some(a => a.id === prev)) return prev;
          return accList[0].id;
        });
      }
      if (!teachersSnap.empty) {
        setTeachers(teachersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
      }
      setAuditLogs(logs);
    } catch (e: any) {
      console.error('Error loading account data:', e);
      showToast('Lỗi khi tải dữ liệu tài khoản: ' + e?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update matrix permissions when matrix target selection changes
  useEffect(() => {
    if (matrixTargetType === 'role') {
      const config = DEFAULT_ROLE_GROUPS[selectedRoleGroup];
      if (config) {
        setMatrixPermissions(JSON.parse(JSON.stringify(config.permissions)));
        setMatrixIsDirty(false);
      }
    } else if (matrixTargetType === 'user' && selectedUserId) {
      const targetAcc = accounts.find(a => a.id === selectedUserId);
      if (targetAcc) {
        const baseRolePerms = DEFAULT_ROLE_GROUPS[targetAcc.roleGroup]?.permissions || DEFAULT_ROLE_GROUPS.TEACHER.permissions;
        if (targetAcc.hasCustomPermissions && targetAcc.customPermissions) {
          // Merge custom over base
          const merged: ModulePermissionsMap = JSON.parse(JSON.stringify(baseRolePerms));
          SYSTEM_MODULES_LIST.forEach(m => {
            if (targetAcc.customPermissions && targetAcc.customPermissions[m.code]) {
              merged[m.code] = {
                ...merged[m.code],
                ...targetAcc.customPermissions[m.code]
              };
            }
          });
          setMatrixPermissions(merged);
        } else {
          setMatrixPermissions(JSON.parse(JSON.stringify(baseRolePerms)));
        }
        setMatrixIsDirty(false);
      }
    }
  }, [matrixTargetType, selectedRoleGroup, selectedUserId, accounts]);

  // Handle teacher dropdown change in Create Modal
  const handleTeacherSelect = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    if (!teacherId) {
      setFormFullName('');
      setFormUsername('');
      setFormPosition('Giáo viên');
      setFormDepartmentName('');
      setFormRoleGroup('TEACHER');
      return;
    }

    const t = teachers.find(item => item.id === teacherId);
    if (t) {
      setFormFullName(t.name);
      const suggestedUser = (t.username || t.code?.toLowerCase() || `gv_${t.id.slice(0, 5)}`).toLowerCase();
      setFormUsername(suggestedUser);
      setFormPosition(t.position || 'Giáo viên');
      setFormDepartmentName(t.departmentName || '');
      
      const pos = (t.position || '').toLowerCase();
      if (pos.includes('hiệu trưởng') || pos.includes('bgh')) setFormRoleGroup('BGH');
      else if (pos.includes('tổ trưởng') || pos.includes('tt') || pos.includes('ttpcm')) setFormRoleGroup('TTCM');
      else if (pos.includes('đoàn') || pos.includes('bí thư')) setFormRoleGroup('DOAN');
      else if (pos.includes('thư viện') || pos.includes('thiết bị') || pos.includes('văn thư') || pos.includes('kế toán')) setFormRoleGroup('STAFF');
      else setFormRoleGroup('TEACHER');
    }
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = acc.fullName?.toLowerCase().includes(q);
        const matchUser = acc.username?.toLowerCase().includes(q);
        const matchCode = acc.teacherCode?.toLowerCase().includes(q);
        const matchPos = acc.position?.toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchCode && !matchPos) return false;
      }
      // Role Filter
      if (filterRole !== 'ALL' && acc.roleGroup !== filterRole) return false;
      // Department Filter
      if (filterDepartment !== 'ALL' && acc.departmentName !== filterDepartment) return false;
      // Status Filter
      if (filterStatus !== 'ALL' && acc.status !== filterStatus) return false;

      return true;
    });
  }, [accounts, searchQuery, filterRole, filterDepartment, filterStatus]);

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach(a => {
      if (a.departmentName) set.add(a.departmentName);
    });
    return Array.from(set);
  }, [accounts]);

  // Stats summary
  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter(a => a.status === 'Đang hoạt động').length;
    const locked = accounts.filter(a => a.status === 'Đã khóa').length;
    const deactivated = accounts.filter(a => a.status === 'Vô hiệu hóa').length;
    const customPerms = accounts.filter(a => a.hasCustomPermissions).length;
    return { total, active, locked, deactivated, customPerms };
  }, [accounts]);

  // Unassigned teachers (who don't have an account yet)
  const unassignedTeachers = useMemo(() => {
    const assignedIds = new Set(accounts.map(a => a.teacherId || a.id));
    return teachers.filter(t => !assignedIds.has(t.id));
  }, [teachers, accounts]);

  // Actions
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await accountService.createAccount({
        teacherId: selectedTeacherId || undefined,
        teacherCode: teachers.find(t => t.id === selectedTeacherId)?.code,
        fullName: formFullName,
        username: formUsername,
        password: formPassword,
        position: formPosition,
        departmentName: formDepartmentName,
        roleGroup: formRoleGroup,
        status: formStatus,
        hasCustomPermissions: false
      }, user?.name || 'Quản trị viên');

      showToast(`Đã tạo tài khoản "${formUsername}" thành công!`, 'success');
      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi tạo tài khoản', 'error');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      await accountService.updateAccount(editingAccount.id, {
        fullName: formFullName,
        username: formUsername,
        position: formPosition,
        departmentName: formDepartmentName,
        roleGroup: formRoleGroup,
        status: formStatus
      }, user?.name || 'Quản trị viên');

      showToast(`Cập nhật tài khoản "${formUsername}" thành công!`, 'success');
      setEditingAccount(null);
      loadData();
    } catch (err: any) {
      showToast(err?.message || 'Lỗi cập nhật tài khoản', 'error');
    }
  };

  const handleBatchCreate = async () => {
    if (!confirm(`Hệ thống sẽ tự động quét và khởi tạo tài khoản cho tất cả Cán bộ, Giáo viên, Nhân viên chưa có tài khoản (${unassignedTeachers.length} người). Bạn có muốn tiếp tục?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await accountService.batchCreateFromTeachers(user?.name || 'Quản trị viên');
      showToast(`Đã khởi tạo thành công ${res.createdCount} tài khoản từ danh sách CBGVNV!`, 'success');
      await loadData();
    } catch (err: any) {
      showToast('Lỗi khi tạo tài khoản hàng loạt: ' + err?.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLockToggle = async (acc: AccountRecord) => {
    if (acc.status === 'Đang hoạt động') {
      setLockModalAccount(acc);
      setLockReasonInput('');
    } else if (acc.status === 'Đã khóa') {
      try {
        await accountService.unlockAccount(acc.id, user?.name || 'Quản trị viên');
        showToast(`Đã mở khóa tài khoản "${acc.username}"!`, 'success');
        loadData();
      } catch (err: any) {
        showToast('Lỗi khi mở khóa: ' + err?.message, 'error');
      }
    } else {
      // Vô hiệu hóa -> hỏi có kích hoạt lại không
      if (confirm(`Tài khoản "${acc.username}" đang bị vô hiệu hóa. Bạn có muốn kích hoạt lại thành Đang hoạt động?`)) {
        try {
          await accountService.unlockAccount(acc.id, user?.name || 'Quản trị viên');
          showToast(`Đã kích hoạt lại tài khoản "${acc.username}"!`, 'success');
          loadData();
        } catch (err: any) {
          showToast('Lỗi kích hoạt: ' + err?.message, 'error');
        }
      }
    }
  };

  const handleConfirmLock = async () => {
    if (!lockModalAccount) return;
    try {
      await accountService.lockAccount(lockModalAccount.id, lockReasonInput, user?.name || 'Quản trị viên');
      showToast(`Đã khóa tài khoản "${lockModalAccount.username}".`, 'success');
      setLockModalAccount(null);
      loadData();
    } catch (err: any) {
      showToast('Lỗi khi khóa tài khoản: ' + err?.message, 'error');
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateModalAccount) return;
    try {
      await accountService.deactivateAccount(deactivateModalAccount.id, deactivateReasonInput, user?.name || 'Quản trị viên');
      showToast(`Đã vô hiệu hóa tài khoản "${deactivateModalAccount.username}".`, 'success');
      setDeactivateModalAccount(null);
      loadData();
    } catch (err: any) {
      showToast('Lỗi khi vô hiệu hóa: ' + err?.message, 'error');
    }
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPassModalAccount) return;
    if (!newPasswordInput.trim()) {
      showToast('Vui lòng nhập mật khẩu mới.', 'error');
      return;
    }
    try {
      await accountService.resetPassword(resetPassModalAccount.id, newPasswordInput.trim(), user?.name || 'Quản trị viên');
      showToast(`Đã đặt lại mật khẩu cho "${resetPassModalAccount.username}" thành công!`, 'success');
      setResetPassModalAccount(null);
      loadData();
    } catch (err: any) {
      showToast('Lỗi khi đặt lại mật khẩu: ' + err?.message, 'error');
    }
  };

  const openEditModal = (acc: AccountRecord) => {
    setEditingAccount(acc);
    setFormFullName(acc.fullName);
    setFormUsername(acc.username);
    setFormPosition(acc.position);
    setFormDepartmentName(acc.departmentName || '');
    setFormRoleGroup(acc.roleGroup);
    setFormStatus(acc.status);
  };

  const openMatrixForUser = (acc: AccountRecord) => {
    setMatrixTargetType('user');
    setSelectedUserId(acc.id);
    setActiveTab('matrix');
  };

  // Matrix checkbox toggles
  const handleMatrixCellToggle = (moduleCode: ModuleCode, action: PermissionAction) => {
    setMatrixPermissions(prev => {
      const currentMod = prev[moduleCode] || createEmptyModulePermissions();
      return {
        ...prev,
        [moduleCode]: {
          ...currentMod,
          [action]: !currentMod[action]
        }
      };
    });
    setMatrixIsDirty(true);
  };

  const handleToggleRow = (moduleCode: ModuleCode) => {
    setMatrixPermissions(prev => {
      const current = prev[moduleCode] || createEmptyModulePermissions();
      const allSelected = Object.values(current).every(Boolean);
      return {
        ...prev,
        [moduleCode]: createEmptyModulePermissions(!allSelected)
      };
    });
    setMatrixIsDirty(true);
  };

  const handleToggleColumn = (action: PermissionAction) => {
    setMatrixPermissions(prev => {
      const allSelected = SYSTEM_MODULES_LIST.every(m => prev[m.code]?.[action]);
      const nextVal = !allSelected;
      const updated: ModulePermissionsMap = { ...prev };
      SYSTEM_MODULES_LIST.forEach(m => {
        updated[m.code] = {
          ...updated[m.code],
          [action]: nextVal
        };
      });
      return updated;
    });
    setMatrixIsDirty(true);
  };

  const handleSelectAllMatrix = (value: boolean) => {
    const updated: Partial<ModulePermissionsMap> = {};
    SYSTEM_MODULES_LIST.forEach(m => {
      updated[m.code] = createEmptyModulePermissions(value);
    });
    setMatrixPermissions(updated as ModulePermissionsMap);
    setMatrixIsDirty(true);
  };

  const handleSaveMatrix = async () => {
    setIsSavingMatrix(true);
    try {
      if (matrixTargetType === 'user') {
        const targetAccount = accounts.find(a => a.id === selectedUserId) || accounts[0];
        if (!targetAccount) {
          showToast('Vui lòng chọn tài khoản cần phân quyền!', 'error');
          setIsSavingMatrix(false);
          return;
        }

        const targetId = targetAccount.id;
        // 1. Write to Firestore
        await accountService.saveUserPermissions(targetId, matrixPermissions, user?.name || 'Quản trị viên');

        // 2. Optimistically update local accounts state so UI immediately retains changes
        setAccounts(prev => prev.map(acc => {
          if (acc.id === targetId) {
            return {
              ...acc,
              hasCustomPermissions: true,
              customPermissions: matrixPermissions
            };
          }
          return acc;
        }));

        setMatrixIsDirty(false);
        showToast(`Đã lưu thành công ma trận phân quyền cho ${targetAccount.fullName} (${targetAccount.username})!`, 'success');

        // 3. Reload from Firestore to ensure persistent consistency
        await loadData();
      } else {
        // Role group mode
        await accountService.saveRoleGroupPermissions(selectedRoleGroup, matrixPermissions, user?.name || 'Quản trị viên');
        setMatrixIsDirty(false);
        showToast(`Đã lưu thành công cấu hình phân quyền cho nhóm ${DEFAULT_ROLE_GROUPS[selectedRoleGroup]?.name || selectedRoleGroup}!`, 'success');
        await loadData();
      }
    } catch (err: any) {
      console.error('Lỗi khi lưu ma trận phân quyền:', err);
      showToast('Lỗi khi lưu ma trận phân quyền: ' + (err?.message || 'Vui lòng thử lại.'), 'error');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleResetUserToRoleGroup = async () => {
    const targetAccount = accounts.find(a => a.id === selectedUserId);
    if (!targetAccount) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa phân quyền tùy biến riêng của ${targetAccount.fullName} và khôi phục về quyền mặc định theo nhóm ${targetAccount.roleGroup}?`)) {
      return;
    }
    setIsSavingMatrix(true);
    try {
      await accountService.resetUserPermissionsToRoleGroup(targetAccount.id, user?.name || 'Quản trị viên');
      
      // Optimistically update
      setAccounts(prev => prev.map(acc => {
        if (acc.id === targetAccount.id) {
          return {
            ...acc,
            hasCustomPermissions: false,
            customPermissions: undefined
          };
        }
        return acc;
      }));

      // Reset matrix back to base role group permissions
      const basePerms = DEFAULT_ROLE_GROUPS[targetAccount.roleGroup]?.permissions || DEFAULT_ROLE_GROUPS.TEACHER.permissions;
      setMatrixPermissions(JSON.parse(JSON.stringify(basePerms)));
      setMatrixIsDirty(false);

      showToast(`Đã khôi phục phân quyền mặc định theo nhóm ${targetAccount.roleGroup} cho ${targetAccount.fullName}!`, 'success');
      await loadData();
    } catch (err: any) {
      console.error('Lỗi khi khôi phục quyền mặc định:', err);
      showToast('Lỗi khôi phục quyền: ' + (err?.message || 'Vui lòng thử lại.'), 'error');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleOpenCopyModal = (targetAcc?: AccountRecord) => {
    const target = targetAcc || accounts.find(a => a.id === selectedUserId) || accounts[0];
    if (!target) {
      showToast('Vui lòng chọn tài khoản cần sao chép quyền!', 'error');
      return;
    }
    setCopyTargetAccount(target);
    const candidate = accounts.find(a => a.id !== target.id);
    setCopySourceAccountId(candidate ? candidate.id : '');
    setIsCopyModalOpen(true);
  };

  const handleConfirmCopyPermissions = async () => {
    if (!copyTargetAccount || !copySourceAccountId) {
      showToast('Vui lòng chọn tài khoản nguồn để sao chép quyền!', 'error');
      return;
    }
    setIsSavingMatrix(true);
    try {
      const copiedPerms = await accountService.copyUserPermissions(
        copySourceAccountId,
        copyTargetAccount.id,
        user?.name || 'Quản trị viên'
      );
      showToast(`Đã sao chép thành công ma trận quyền sang ${copyTargetAccount.fullName}!`, 'success');
      setIsCopyModalOpen(false);

      if (selectedUserId === copyTargetAccount.id && matrixTargetType === 'user') {
        setMatrixPermissions(copiedPerms);
        setMatrixIsDirty(false);
      }
      await loadData();
    } catch (err: any) {
      showToast('Lỗi khi sao chép quyền: ' + (err?.message || 'Thất bại'), 'error');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleRevokeCustomPerms = async (acc: AccountRecord) => {
    if (!confirm(`Bạn có chắc muốn thu hồi quyền tùy biến riêng của ${acc.fullName} và khôi phục về mặc định nhóm ${acc.roleGroup}?`)) {
      return;
    }
    try {
      await accountService.resetUserPermissionsToRoleGroup(acc.id, user?.name || 'Quản trị viên');
      showToast(`Đã thu hồi quyền riêng cho ${acc.fullName}!`, 'success');
      await loadData();
    } catch (err: any) {
      showToast('Lỗi thu hồi quyền: ' + (err?.message || 'Thất bại'), 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-bold transition-all animate-bounce ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' :
          toastMessage.type === 'error' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 size={16} />}
          {toastMessage.type === 'error' && <AlertTriangle size={16} />}
          {toastMessage.type === 'info' && <Sparkles size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-white/5 transform skew-x-12 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 bg-white/15 backdrop-blur-md rounded-xl">
                <ShieldCheck className="w-6 h-6 text-blue-200" />
              </div>
              <span className="text-xs uppercase tracking-widest font-extrabold text-blue-200">
                Hệ Thống Phân Quyền THPT Sơn Lương
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight">
              QUẢN LÝ TÀI KHOẢN VÀ PHÂN QUYỀN
            </h1>
            <p className="text-xs lg:text-sm text-blue-100/90 mt-1 max-w-2xl font-medium">
              Cấp phát tài khoản đăng nhập cho toàn bộ CBGVNV, kiểm soát ma trận quyền 7 cấp trên 18 module và bảo mật hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBatchCreate}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-xl text-xs font-bold border border-white/20 transition-all shadow-sm cursor-pointer"
              title="Tự động tạo tài khoản cho tất cả giáo viên chưa có tài khoản"
            >
              <Sparkles size={15} className="text-amber-300" />
              <span>Đồng bộ từ CBGVNV</span>
              {unassignedTeachers.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-400 text-slate-900 rounded-full text-[10px] font-black">
                  +{unassignedTeachers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => accountService.exportAccountsToExcel(filteredAccounts)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Xuất Excel</span>
            </button>
            <button
              onClick={() => {
                setSelectedTeacherId('');
                setFormFullName('');
                setFormUsername('');
                setFormPassword('123456');
                setFormPosition('Giáo viên');
                setFormDepartmentName('');
                setFormRoleGroup('TEACHER');
                setFormStatus('Đang hoạt động');
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Tạo tài khoản mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng tài khoản</p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đang hoạt động</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đã khóa</p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{stats.locked}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Lock size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vô hiệu hóa</p>
            <p className="text-2xl font-black text-rose-600 mt-0.5">{stats.deactivated}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <UserX size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quyền tùy biến</p>
            <p className="text-2xl font-black text-purple-600 mt-0.5">{stats.customPerms}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Sliders size={20} />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors cursor-pointer ${
            activeTab === 'accounts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={16} />
          <span>Danh sách tài khoản ({accounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors cursor-pointer ${
            activeTab === 'matrix'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Grid size={16} />
          <span>Bảng ma trận phân quyền</span>
          {matrixIsDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <History size={16} />
          <span>Nhật ký thao tác ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: ACCOUNTS LIST */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-5 shadow-xs space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Tìm theo tên, username, mã..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">Tất cả nhóm quyền</option>
                {Object.keys(DEFAULT_ROLE_GROUPS).map(r => (
                  <option key={r} value={r}>
                    {DEFAULT_ROLE_GROUPS[r as RoleGroupCode]?.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">Tất cả tổ chuyên môn</option>
                {departmentsList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Đã khóa">Đã khóa</option>
                <option value="Vô hiệu hóa">Vô hiệu hóa</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-3.5 py-3 text-center w-12">STT</th>
                  <th className="px-4 py-3 text-left">Cán bộ / Giáo viên</th>
                  <th className="px-4 py-3 text-left">Tên đăng nhập</th>
                  <th className="px-4 py-3 text-left">Chức vụ & Tổ CM</th>
                  <th className="px-4 py-3 text-left">Nhóm quyền</th>
                  <th className="px-3.5 py-3 text-center">Phân quyền</th>
                  <th className="px-3.5 py-3 text-center">Trạng thái</th>
                  <th className="px-3.5 py-3 text-center">Đăng nhập cuối</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-medium">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      Không tìm thấy tài khoản nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc, index) => {
                    const roleCfg = DEFAULT_ROLE_GROUPS[acc.roleGroup] || DEFAULT_ROLE_GROUPS.TEACHER;
                    const isPwdVisible = !!showPasswordMap[acc.id];

                    return (
                      <tr key={acc.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-3.5 py-3 text-center text-slate-500 font-bold">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
                              {acc.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{acc.fullName}</p>
                              {acc.teacherCode && (
                                <p className="text-[10px] text-slate-500 font-semibold">{acc.teacherCode}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-blue-700 font-bold">
                              {acc.username}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{acc.position}</p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{acc.departmentName || '---'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10.5px] font-bold border ${roleCfg.badgeBg} ${roleCfg.badgeColor}`}>
                            {acc.roleGroup}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          {acc.hasCustomPermissions ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => openMatrixForUser(acc)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors cursor-pointer"
                                title="Nhấp để xem/chỉnh sửa phân quyền riêng"
                              >
                                <Sliders size={11} />
                                <span>Tùy biến riêng</span>
                              </button>
                              <button
                                onClick={() => handleRevokeCustomPerms(acc)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
                                title="Thu hồi quyền riêng, khôi phục theo nhóm"
                              >
                                <RotateCcw size={11} />
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Theo nhóm ({acc.roleGroup})
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          {acc.status === 'Đang hoạt động' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 size={12} />
                              <span>Hoạt động</span>
                            </span>
                          )}
                          {acc.status === 'Đã khóa' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800" title={acc.lockReason}>
                              <Lock size={12} />
                              <span>Đã khóa</span>
                            </span>
                          )}
                          {acc.status === 'Vô hiệu hóa' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-700" title={acc.deactivateReason}>
                              <UserX size={12} />
                              <span>Vô hiệu hóa</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-center text-slate-500 text-[11px]">
                          {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleDateString('vi-VN') : 'Chưa'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Matrix Perm Button */}
                            <button
                              onClick={() => openMatrixForUser(acc)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              title="Tùy biến ma trận phân quyền"
                            >
                              <Shield size={15} />
                            </button>

                            {/* Copy Permissions Button */}
                            <button
                              onClick={() => handleOpenCopyModal(acc)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Sao chép phân quyền từ tài khoản khác sang tài khoản này"
                            >
                              <Copy size={15} />
                            </button>

                            {/* Reset Password Button */}
                            <button
                              onClick={() => {
                                setResetPassModalAccount(acc);
                                setNewPasswordInput('123456');
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Đặt lại mật khẩu"
                            >
                              <Key size={15} />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => openEditModal(acc)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Chỉnh sửa thông tin"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Lock / Unlock Toggle Button & Deactivate (Protected for ADMIN) */}
                            {acc.username !== 'admin' && acc.id !== 'admin' ? (
                              <>
                                <button
                                  onClick={() => handleQuickLockToggle(acc)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    acc.status === 'Đang hoạt động' 
                                      ? 'text-amber-600 hover:bg-amber-50' 
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={acc.status === 'Đang hoạt động' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                >
                                  {acc.status === 'Đang hoạt động' ? <Lock size={15} /> : <Unlock size={15} />}
                                </button>

                                {acc.status !== 'Vô hiệu hóa' && (
                                  <button
                                    onClick={() => {
                                      setDeactivateModalAccount(acc);
                                      setDeactivateReasonInput('Chuyển công tác hoặc nghỉ việc');
                                    }}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Vô hiệu hóa tài khoản (chuyển công tác / nghỉ việc)"
                                  >
                                    <UserX size={15} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="p-1 text-emerald-600" title="Quản trị viên hệ thống tối cao">
                                <ShieldCheck size={16} />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PERMISSION MATRIX */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-5 shadow-xs space-y-5">
          {/* Matrix Target Selection Bar */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-extrabold text-slate-700 uppercase">Đối tượng phân quyền:</span>
              
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setMatrixTargetType('role')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    matrixTargetType === 'role' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo Nhóm Quyền Mẫu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMatrixTargetType('user');
                    if (!selectedUserId && accounts.length > 0) {
                      setSelectedUserId(accounts[0].id);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    matrixTargetType === 'user' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ghi đè riêng cho từng Cá nhân
                </button>
              </div>

              {matrixTargetType === 'role' ? (
                <select
                  value={selectedRoleGroup}
                  onChange={(e) => setSelectedRoleGroup(e.target.value as RoleGroupCode)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {Object.keys(DEFAULT_ROLE_GROUPS).map(rg => (
                    <option key={rg} value={rg}>
                      {DEFAULT_ROLE_GROUPS[rg as RoleGroupCode].name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-bold text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.fullName} ({acc.username}) - {acc.roleGroup}
                      </option>
                    ))}
                  </select>

                  {accounts.find(a => a.id === selectedUserId)?.hasCustomPermissions && (
                    <button
                      type="button"
                      onClick={handleResetUserToRoleGroup}
                      className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      title="Thu hồi quyền tùy biến riêng và khôi phục quyền mặc định theo nhóm"
                    >
                      <RotateCcw size={13} className="inline mr-1" />
                      Thu hồi quyền riêng
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenCopyModal()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                    title="Sao chép toàn bộ phân quyền từ tài khoản khác sang tài khoản này"
                  >
                    <Copy size={13} />
                    <span>Sao chép quyền</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick action buttons for matrix */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAllMatrix(true)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={() => handleSelectAllMatrix(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Bỏ chọn tất cả
              </button>
              <button
                type="button"
                onClick={handleSaveMatrix}
                disabled={isSavingMatrix}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={14} className={isSavingMatrix ? 'animate-spin' : ''} />
                <span>{isSavingMatrix ? 'Đang lưu ma trận...' : 'Lưu ma trận phân quyền'}</span>
              </button>
            </div>
          </div>

          {/* Target Info banner */}
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-blue-600 shrink-0" size={16} />
              <div>
                <span className="font-bold text-blue-900">
                  {matrixTargetType === 'role' 
                    ? `Đang xem cấu hình: ${DEFAULT_ROLE_GROUPS[selectedRoleGroup]?.name}`
                    : `Đang tùy biến quyền riêng cho: ${accounts.find(a => a.id === selectedUserId)?.fullName} (${accounts.find(a => a.id === selectedUserId)?.username})`
                  }
                </span>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  {matrixTargetType === 'role'
                    ? DEFAULT_ROLE_GROUPS[selectedRoleGroup]?.description
                    : `Tài khoản này thuộc nhóm ${accounts.find(a => a.id === selectedUserId)?.roleGroup}. Các quyền tick chọn bên dưới sẽ áp dụng trực tiếp cho cá nhân này.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-center w-10">STT</th>
                  <th className="px-4 py-3 text-left min-w-[220px]">Module Hệ thống (18 Modules)</th>
                  
                  {/* Actions columns with quick header click */}
                  {(['view', 'create', 'edit', 'delete', 'approve', 'export', 'lock'] as PermissionAction[]).map(act => (
                    <th 
                      key={act} 
                      className="px-2 py-3 text-center cursor-pointer hover:bg-blue-100/60 transition-colors"
                      onClick={() => handleToggleColumn(act)}
                      title={`Bấm để chọn/bỏ chọn toàn bộ cột ${ACTION_LABELS[act].label}`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-blue-700">{ACTION_LABELS[act].label}</span>
                        <span className="text-[9px] font-normal text-slate-500 lowercase">(chọn cột)</span>
                      </div>
                    </th>
                  ))}

                  <th className="px-3 py-3 text-center w-24">Cả dòng</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-medium">
                {SYSTEM_MODULES_LIST.map((mod, idx) => {
                  const modPerm = matrixPermissions[mod.code] || createEmptyModulePermissions();
                  const isAllRow = Object.values(modPerm).every(Boolean);

                  return (
                    <tr key={mod.code} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 text-center text-slate-500 font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-slate-800">{mod.title}</p>
                        <p className="text-[10.5px] text-slate-500">{mod.shortDesc}</p>
                      </td>

                      {(['view', 'create', 'edit', 'delete', 'approve', 'export', 'lock'] as PermissionAction[]).map(act => {
                        const isChecked = !!modPerm[act];
                        return (
                          <td key={act} className="px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleMatrixCellToggle(mod.code, act)}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              title={`${mod.title} - ${ACTION_LABELS[act].label}`}
                            />
                          </td>
                        );
                      })}

                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRow(mod.code)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            isAllRow ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {isAllRow ? 'Tất cả' : 'Bật/Tắt'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <History size={16} className="text-blue-600" />
              Lịch sử thao tác & kiểm toán phân quyền
            </h3>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Làm mới</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-center w-12">STT</th>
                  <th className="px-4 py-3 text-left">Thời gian</th>
                  <th className="px-4 py-3 text-left">Hành động</th>
                  <th className="px-4 py-3 text-left">Tài khoản tác động</th>
                  <th className="px-4 py-3 text-left">Người thực hiện</th>
                  <th className="px-4 py-3 text-left">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-medium">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Chưa có nhật ký thao tác nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-center text-slate-500 font-bold">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-slate-600 font-semibold">
                        {new Date(log.timestamp).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10.5px] font-black ${
                          log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                          log.action === 'LOCK' ? 'bg-amber-100 text-amber-800' :
                          log.action === 'UNLOCK' ? 'bg-blue-100 text-blue-800' :
                          log.action === 'RESET_PASSWORD' ? 'bg-cyan-100 text-cyan-800' :
                          log.action === 'DEACTIVATE' ? 'bg-rose-100 text-rose-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">
                        {log.targetFullName} ({log.targetUsername})
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 font-semibold">{log.performedBy}</td>
                      <td className="px-4 py-2.5 text-slate-700">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE ACCOUNT */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-200">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">KHỞI TẠO TÀI KHOẢN MỚI</h3>
                <p className="text-xs text-blue-100">Cấp tài khoản đăng nhập cho Cán bộ, Giáo viên, Nhân viên</p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs font-semibold">
              {/* Select from existing teachers */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Chọn từ danh sách CBGVNV chưa có tài khoản:
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => handleTeacherSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer text-xs font-bold"
                >
                  <option value="">-- Tạo tài khoản độc lập (hoặc chọn giáo viên) --</option>
                  {unassignedTeachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) - {t.position} - {t.departmentName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tên đăng nhập *</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="nguyenvana"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mật khẩu ban đầu *</label>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="123456"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nhóm quyền *</label>
                  <select
                    value={formRoleGroup}
                    onChange={(e) => setFormRoleGroup(e.target.value as RoleGroupCode)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer font-bold"
                  >
                    {Object.keys(DEFAULT_ROLE_GROUPS).map(r => (
                      <option key={r} value={r}>
                        {DEFAULT_ROLE_GROUPS[r as RoleGroupCode].name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Chức vụ</label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="Giáo viên"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tổ chuyên môn</label>
                  <input
                    type="text"
                    value={formDepartmentName}
                    onChange={(e) => setFormDepartmentName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="Tổ Toán - Tin"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-colors cursor-pointer"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ACCOUNT */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">CHỈNH SỬA THÔNG TIN TÀI KHOẢN</h3>
                <p className="text-xs text-blue-100">{editingAccount.fullName} ({editingAccount.username})</p>
              </div>
              <button 
                onClick={() => setEditingAccount(null)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tên đăng nhập *</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nhóm quyền *</label>
                  <select
                    value={formRoleGroup}
                    onChange={(e) => setFormRoleGroup(e.target.value as RoleGroupCode)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer font-bold"
                  >
                    {Object.keys(DEFAULT_ROLE_GROUPS).map(r => (
                      <option key={r} value={r}>
                        {DEFAULT_ROLE_GROUPS[r as RoleGroupCode].name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Trạng thái tài khoản *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer font-bold"
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Đã khóa">Đã khóa</option>
                    <option value="Vô hiệu hóa">Vô hiệu hóa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Chức vụ</label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tổ chuyên môn</label>
                  <input
                    type="text"
                    value={formDepartmentName}
                    onChange={(e) => setFormDepartmentName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-colors cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET PASSWORD */}
      {resetPassModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-blue-600">
              <Key size={22} />
              <h3 className="font-extrabold text-base text-slate-900">Đặt lại mật khẩu</h3>
            </div>
            <p className="text-xs text-slate-600">
              Đang đặt lại mật khẩu cho tài khoản: <strong className="text-slate-900">{resetPassModalAccount.username}</strong> ({resetPassModalAccount.fullName})
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới</label>
              <input
                type="text"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Gợi ý: Dùng mật khẩu dễ nhớ như 123456 hoặc ngày sinh.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetPassModalAccount(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Xác nhận đổi mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: LOCK ACCOUNT */}
      {lockModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <Lock size={22} />
              <h3 className="font-extrabold text-base text-slate-900">Khóa tài khoản</h3>
            </div>
            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn khóa tài khoản <strong className="text-slate-900">{lockModalAccount.username}</strong>? Người dùng sẽ không thể đăng nhập sau khi bị khóa.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lý do khóa (tùy chọn):</label>
              <input
                type="text"
                value={lockReasonInput}
                onChange={(e) => setLockReasonInput(e.target.value)}
                placeholder="VD: Nghỉ phép dài hạn, bảo mật..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLockModalAccount(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmLock}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Khóa tài khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DEACTIVATE ACCOUNT */}
      {deactivateModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <UserX size={22} />
              <h3 className="font-extrabold text-base text-slate-900">Vô hiệu hóa tài khoản</h3>
            </div>
            <p className="text-xs text-slate-600">
              Vô hiệu hóa tài khoản <strong className="text-slate-900">{deactivateModalAccount.username}</strong> ({deactivateModalAccount.fullName}) do chuyển công tác hoặc nghỉ việc.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lý do vô hiệu hóa:</label>
              <input
                type="text"
                value={deactivateReasonInput}
                onChange={(e) => setDeactivateReasonInput(e.target.value)}
                placeholder="VD: Chuyển công tác sang THPT Văn Chấn"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeactivateModalAccount(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                Xác nhận vô hiệu hóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: COPY PERMISSIONS */}
      {isCopyModalOpen && copyTargetAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <Copy size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm">SAO CHÉP PHÂN QUYỀN</h3>
                  <p className="text-[11px] text-indigo-100">Áp dụng ma trận quyền từ tài khoản khác</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-semibold">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                <p className="font-bold">Tài khoản đích nhận quyền:</p>
                <p className="text-sm font-black text-indigo-950 mt-0.5">
                  {copyTargetAccount.fullName} ({copyTargetAccount.username})
                </p>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  Chức vụ: {copyTargetAccount.position} - Nhóm: {copyTargetAccount.roleGroup}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Chọn tài khoản nguồn để sao chép quyền:
                </label>
                <select
                  value={copySourceAccountId}
                  onChange={(e) => setCopySourceAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">-- Chọn tài khoản mẫu nguồn --</option>
                  {accounts
                    .filter(a => a.id !== copyTargetAccount.id)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.fullName} ({a.username}) - {a.position} [{a.hasCustomPermissions ? 'Quyền riêng' : a.roleGroup}]
                      </option>
                    ))
                  }
                </select>
                <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed">
                  Lưu ý: Toàn bộ quyền trên 18 module và 7 cấp hành động của tài khoản nguồn sẽ được ghi đè sang tài khoản đích và lưu trực tiếp lên cơ sở dữ liệu Firestore.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSavingMatrix || !copySourceAccountId}
                  onClick={handleConfirmCopyPermissions}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingMatrix ? "Đang sao chép..." : "Xác nhận sao chép quyền"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
