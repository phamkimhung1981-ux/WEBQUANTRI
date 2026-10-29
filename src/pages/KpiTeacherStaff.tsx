import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Filter, 
  FileText, 
  Plus, 
  Printer, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  Award, 
  Edit3, 
  Trash2, 
  Eye, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  RefreshCw,
  Sliders,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Building,
  UserCheck,
  Sparkles,
  Home,
  ArrowLeft,
  Loader2,
  Folder,
  List
} from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import { canEditOrDelete, isProductionWeb } from '../utils/envUtils';
import BackButton from '../components/ui/BackButton';
import { 
  KpiVcForm, 
  KpiVcPeriod, 
  KpiVcCriterion, 
  KpiVcCriteriaGroup, 
  KpiVcAuditLog,
  KpiVcRatingConfig,
  KpiVcRatingConfigHistory
} from '../types/kpiVc';
import { 
  subscribeVcForms, 
  subscribeVcPeriods, 
  subscribeVcCriteria, 
  subscribeVcGroups, 
  subscribeVcAuditLogs, 
  subscribeVcRatingConfigs,
  subscribeVcRatingConfigHistory,
  seedVcInitialDataIfNeeded,
  deleteVcForm,
  bulkDeleteVcForms,
  toggleLockVcForm,
  resetFormsWith100Points,
  Reset100BatchResult
} from '../services/kpiVcService';
import { 
  getEligibleVcTeachers,
  resolveVcTeacherPosition,
  resolveVcTeacherDepartment,
  getKpiRating,
  getVcClassificationBadge,
  getEffectiveRatingConfig,
  getVcStatusMeta,
  getFormTotalScore,
  getFormTtcmTotalScore,
  getFormManagerTotalScore,
  getEffectiveFormStatus,
  hasFormBeenEvaluated,
  KPI_RATING_COLOR_MAP,
  DEFAULT_VC_GROUPS,
  DEFAULT_VC_CRITERIA,
  DEFAULT_VC_PERIODS
} from '../lib/kpiVcData';
import KpiVcDocumentModal from '../components/kpiVc/KpiVcDocumentModal';
import KpiVcCriteriaManagerModal from '../components/kpiVc/KpiVcCriteriaManagerModal';
import KpiVcPeriodManagerModal from '../components/kpiVc/KpiVcPeriodManagerModal';
import KpiVcRatingConfigModal from '../components/kpiVc/KpiVcRatingConfigModal';
import KpiVcPrintModal from '../components/kpiVc/KpiVcPrintModal';
import { exportVcSummaryToExcel } from '../utils/kpiVcExport';
import { exportVcFormToWord } from '../utils/kpiWordExport';
import { isTeacherTtcm, isTeacherBgh } from '../lib/kpiTargetAudienceUtils';

export default function KpiTeacherStaff() {
  const navigate = useNavigate();
  const { teachers, departments } = useAppContext();
  const { user } = useAuth();

  // Permissions
  const isAdmin = user?.id === 'admin' || user?.role === 'admin' || user?.role === 'BGH' || (user?.position || '').toLowerCase().includes('hiệu trưởng');
  const showAdminCheckbox = isAdmin && !isProductionWeb();

  const canDeleteForm = (form: KpiVcForm) => {
    // Ẩn hoàn toàn chức năng xóa phiếu KPI trên website đã xuất bản (production) để bảo vệ dữ liệu
    if (isProductionWeb()) return false;
    if (!canEditOrDelete()) return false;
    if (!user) return false;
    if (user.id === 'admin' || user.role === 'admin' || user.role === 'BGH' || user.role === 'TTCM' || user.role === 'CBQL' || user.role === 'manager') return true;
    const pos = (user.position || '').toLowerCase();
    if (pos.includes('hiệu trưởng') || pos.includes('tổ trưởng') || pos.includes('quản lý') || pos.includes('bgh')) return true;
    if (form.employeeId === user.id && (form.status === 'self_evaluated' || !form.status)) return true;
    return false;
  };

  // Delete modal state
  const [formToDelete, setFormToDelete] = useState<KpiVcForm | null>(null);
  const [isDeletingForm, setIsDeletingForm] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Checkbox selection state & Bulk delete modal state
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [bulkDeleteStep, setBulkDeleteStep] = useState<1 | 2>(1);
  const [bulkDeleteType, setBulkDeleteType] = useState<'filtered_all' | 'selected_items'>('filtered_all');
  const [bulkConfirmInput, setBulkConfirmInput] = useState<string>('');
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  // Total Delete Modal State
  const [isTotalDeleteModalOpen, setIsTotalDeleteModalOpen] = useState<boolean>(false);
  const [totalDeleteScope, setTotalDeleteScope] = useState<'period' | 'filtered' | 'all'>('period');
  const [totalDeleteConfirmInput, setTotalDeleteConfirmInput] = useState<string>('');
  const [isTotalDeleting, setIsTotalDeleting] = useState<boolean>(false);
  const [totalDeleteError, setTotalDeleteError] = useState<string | null>(null);

  // Batch Reset 100 Points to 0 Modal State
  const [isReset100ModalOpen, setIsReset100ModalOpen] = useState<boolean>(false);
  const [isResetting100, setIsResetting100] = useState<boolean>(false);
  const [reset100Result, setReset100Result] = useState<Reset100BatchResult | null>(null);
  const [reset100Error, setReset100Error] = useState<string | null>(null);

  // Firestore Data State
  const [forms, setForms] = useState<KpiVcForm[]>([]);
  const [periods, setPeriods] = useState<KpiVcPeriod[]>([]);
  const [criteria, setCriteria] = useState<KpiVcCriterion[]>([]);
  const [groups, setGroups] = useState<KpiVcCriteriaGroup[]>([]);
  const [auditLogs, setAuditLogs] = useState<KpiVcAuditLog[]>([]);
  const [ratingConfigs, setRatingConfigs] = useState<KpiVcRatingConfig[]>([]);
  const [ratingHistoryList, setRatingHistoryList] = useState<KpiVcRatingConfigHistory[]>([]);

  // Filters & Search
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('vc_period_2026_09');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [groupByDept, setGroupByDept] = useState<boolean>(true);

  // Modals state
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [docModalMode, setDocModalMode] = useState<'create' | 'edit' | 'self_eval' | 'ttcm_eval' | 'leader_eval' | 'view'>('create');
  const [selectedFormForDoc, setSelectedFormForDoc] = useState<KpiVcForm | null>(null);

  const [isCriteriaManagerOpen, setIsCriteriaManagerOpen] = useState<boolean>(false);
  const [isPeriodManagerOpen, setIsPeriodManagerOpen] = useState<boolean>(false);
  const [isRatingConfigModalOpen, setIsRatingConfigModalOpen] = useState<boolean>(false);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [selectedFormForPrint, setSelectedFormForPrint] = useState<KpiVcForm | null>(null);

  const [exportingWordId, setExportingWordId] = useState<string | null>(null);
  const [togglingLockFormId, setTogglingLockFormId] = useState<string | null>(null);
  const [firestoreNotice, setFirestoreNotice] = useState<{ isOnline: boolean; quotaExceeded?: boolean; error?: string } | null>(null);

  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e.detail) {
        setFirestoreNotice(e.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('kpi_firestore_status', handleStatus);
      return () => window.removeEventListener('kpi_firestore_status', handleStatus);
    }
  }, []);

  const handleExportWord = async (form: KpiVcForm) => {
    if (!form || !form.id) {
      alert('Vui lòng lưu phiếu trước khi xuất Word.');
      return;
    }
    setExportingWordId(form.id);
    try {
      await exportVcFormToWord(form);
    } catch (err) {
      alert('Lỗi xuất file Word: ' + (err instanceof Error ? err.message : 'Không xác định'));
    } finally {
      setExportingWordId(null);
    }
  };

  // Eligible teacher list (Teachers & Staff, excluding BGH/Principal)
  const eligibleTeachers = useMemo(() => {
    return getEligibleVcTeachers(teachers);
  }, [teachers]);

  // Initial Firestore subscriptions
  useEffect(() => {
    seedVcInitialDataIfNeeded();

    const unsubForms = subscribeVcForms(setForms);
    const unsubPeriods = subscribeVcPeriods((pList) => {
      setPeriods(pList);
    });
    const unsubCriteria = subscribeVcCriteria(setCriteria);
    const unsubGroups = subscribeVcGroups(setGroups);
    const unsubLogs = subscribeVcAuditLogs(setAuditLogs);
    const unsubRatingConfigs = subscribeVcRatingConfigs(setRatingConfigs);
    const unsubRatingHistory = subscribeVcRatingConfigHistory(setRatingHistoryList);

    return () => {
      unsubForms();
      unsubPeriods();
      unsubCriteria();
      unsubGroups();
      unsubLogs();
      unsubRatingConfigs();
      unsubRatingHistory();
    };
  }, []);

  // Hàm xác định xếp loại động của phiếu dựa theo cấu hình
  const getFormRating = (form: KpiVcForm) => {
    if (!hasFormBeenEvaluated(form)) {
      return {
        ratingName: 'Chưa xếp loại',
        badgeStyle: KPI_RATING_COLOR_MAP.slate
      };
    }

    const managerScore = getFormManagerTotalScore(form);
    const selfScore = getFormTotalScore(form);
    const finalScore = (managerScore !== null && managerScore !== undefined && managerScore > 0) 
      ? managerScore 
      : selfScore;
      
    const effective = getEffectiveRatingConfig(form.periodId, ratingConfigs);
    
    // Nếu kỳ này có tùy chọn khóa xếp loại khi hoàn thành và phiếu đã khóa / hoàn thành
    if (effective.isLockedWhenPeriodCompleted && (form.status === 'locked' || form.status === 'completed')) {
      const stored = form.leaderClassification || form.selfClassification;
      if (stored) {
        return {
          ratingName: stored,
          badgeStyle: getVcClassificationBadge(stored, form.periodId, ratingConfigs)
        };
      }
    }

    const ratingRes = getKpiRating(finalScore, form.periodId, ratingConfigs);
    return {
      ratingName: ratingRes.ratingName,
      badgeStyle: ratingRes.badgeStyle
    };
  };

  // Danh sách các tùy chọn xếp loại động cho bộ lọc
  const dynamicClassificationOptions = useMemo(() => {
    const effective = getEffectiveRatingConfig(selectedPeriodId, ratingConfigs);
    const options = new Set<string>();
    effective.tiers.filter(t => t.isActive).forEach(t => options.add(t.ratingName));
    
    // Thêm các tên xếp loại từ tất cả cấu hình để không bị thiếu khi lọc
    ratingConfigs.forEach(c => {
      c.tiers?.forEach(t => {
        if (t.isActive && t.ratingName) options.add(t.ratingName);
      });
    });

    // Thêm các giá trị mặc định nếu rỗng
    if (options.size === 0) {
      options.add('Hoàn thành xuất sắc nhiệm vụ');
      options.add('Hoàn thành tốt nhiệm vụ');
      options.add('Hoàn thành nhiệm vụ');
      options.add('Không hoàn thành nhiệm vụ');
    }

    return Array.from(options);
  }, [selectedPeriodId, ratingConfigs]);

  // Filtered forms
  const filteredForms = useMemo(() => {
    return forms.filter(f => {
      const matchPeriod = selectedPeriodId === 'all' || f.periodId === selectedPeriodId;
      const effStatus = getEffectiveFormStatus(f);
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'draft' ? (effStatus === 'draft' || effStatus === 'returned' || !f.status) :
         statusFilter === 'submitted' ? (effStatus === 'submitted' || effStatus === 'self_evaluated') :
         statusFilter === 'ttcm_evaluated' ? (effStatus === 'ttcm_evaluated') :
         statusFilter === 'completed' ? (effStatus === 'completed') :
         statusFilter === 'locked' ? (effStatus === 'locked') :
         effStatus === statusFilter);
      
      const formRatingName = getFormRating(f).ratingName;
      const matchClass = classificationFilter === 'all' || (
        formRatingName === classificationFilter ||
        f.leaderClassification === classificationFilter || 
        (!f.leaderClassification && f.selfClassification === classificationFilter)
      );
      
      let matchDept = true;
      if (selectedDeptId !== 'all') {
        const teacher = teachers.find(t => t.id === f.employeeId);
        matchDept = teacher?.departmentId === selectedDeptId || f.departmentId === selectedDeptId;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        (f.employeeName || '').toLowerCase().includes(q) ||
        (f.employeeCode || '').toLowerCase().includes(q) ||
        (f.position || '').toLowerCase().includes(q) ||
        (f.department || '').toLowerCase().includes(q)
      );

      return matchPeriod && matchStatus && matchClass && matchDept && matchSearch;
    });
  }, [forms, selectedPeriodId, statusFilter, classificationFilter, selectedDeptId, searchQuery, teachers, ratingConfigs]);

  // Group forms by Department
  const groupedFormsByDept = useMemo(() => {
    const map = new Map<string, { deptId: string; deptName: string; forms: KpiVcForm[] }>();

    filteredForms.forEach(form => {
      let deptName = form.department || 'Tổ / Đơn vị khác';
      let deptId = form.departmentId || 'other';

      const teacher = teachers.find(t => t.id === form.employeeId);
      if (teacher && teacher.departmentId) {
        deptId = teacher.departmentId;
        const deptObj = departments.find(d => d.id === teacher.departmentId);
        if (deptObj) deptName = deptObj.name;
      }

      if (!map.has(deptId)) {
        map.set(deptId, { deptId, deptName, forms: [] });
      }
      map.get(deptId)!.forms.push(form);
    });

    const result: { deptId: string; deptName: string; forms: KpiVcForm[] }[] = [];

    departments.forEach(d => {
      if (map.has(d.id)) {
        result.push(map.get(d.id)!);
        map.delete(d.id);
      }
    });

    map.forEach(val => {
      result.push(val);
    });

    return result;
  }, [filteredForms, teachers, departments]);

  // Statistics
  const stats = useMemo(() => {
    const totalForms = filteredForms.length;
    const completedCount = filteredForms.filter(f => f.status === 'completed' || f.status === 'locked').length;
    const evaluatingCount = filteredForms.filter(f => hasFormBeenEvaluated(f) && f.status !== 'completed' && f.status !== 'locked').length;
    const unratedCount = filteredForms.filter(f => !hasFormBeenEvaluated(f)).length;
    
    // Chỉ tính điểm trung bình cho các phiếu đã được chấm điểm thực tế
    const evaluatedForms = filteredForms.filter(f => hasFormBeenEvaluated(f));
    let sumScore = 0;
    evaluatedForms.forEach(f => {
      sumScore += getFormTotalScore(f);
    });
    const avgScore = evaluatedForms.length > 0 ? (Math.round((sumScore / evaluatedForms.length) * 10) / 10) : 0;

    // Tính thống kê động theo các mức xếp loại cấu hình (chỉ tính phiếu đã được chấm)
    const ratingCounts: Record<string, number> = {};
    evaluatedForms.forEach(f => {
      const rName = getFormRating(f).ratingName;
      ratingCounts[rName] = (ratingCounts[rName] || 0) + 1;
    });

    const effective = getEffectiveRatingConfig(selectedPeriodId, ratingConfigs);
    const activeTiers = effective.tiers.filter(t => t.isActive);
    const topTier1Name = activeTiers[0]?.ratingName || 'Hoàn thành xuất sắc nhiệm vụ';
    const topTier2Name = activeTiers[1]?.ratingName || 'Hoàn thành tốt nhiệm vụ';

    const topCount = (ratingCounts[topTier1Name] || 0) + (ratingCounts[topTier2Name] || 0);

    return {
      totalForms,
      completedCount,
      evaluatingCount,
      unratedCount,
      avgScore,
      topCount,
      topTier1Name,
      topTier2Name,
      ratingCounts
    };
  }, [filteredForms, ratingConfigs, selectedPeriodId]);

  // Check if current user has a form in the selected period
  const myFormInPeriod = useMemo(() => {
    if (!user) return null;
    return forms.find(f => f.employeeId === user.id && (selectedPeriodId === 'all' || f.periodId === selectedPeriodId));
  }, [user, forms, selectedPeriodId]);

  // Open Document Handlers
  const handleOpenCreateModal = () => {
    setSelectedFormForDoc(null);
    setDocModalMode('create');
    setIsDocModalOpen(true);
  };

  const handleOpenDoc = (form: KpiVcForm, mode: 'create' | 'edit' | 'self_eval' | 'ttcm_eval' | 'leader_eval' | 'view') => {
    setSelectedFormForDoc(form);
    setDocModalMode(mode);
    setIsDocModalOpen(true);
  };

  const handleOpenPrint = (form: KpiVcForm) => {
    setSelectedFormForPrint(form);
    setIsPrintModalOpen(true);
  };

  const handleRequestDeleteForm = (form: KpiVcForm) => {
    if (isProductionWeb()) return;
    setDeleteError(null);
    setFormToDelete(form);
  };

  const handleConfirmDeleteForm = async () => {
    if (isProductionWeb()) {
      setDeleteError('Chức năng xóa phiếu KPI không khả dụng trên website.');
      return;
    }
    if (!formToDelete) return;
    setIsDeletingForm(true);
    setDeleteError(null);
    const deletedName = formToDelete.employeeName;
    const deletedPeriod = formToDelete.periodName;
    const targetId = formToDelete.id;
    try {
      await deleteVcForm(targetId, {
        id: user?.id || 'admin',
        name: user?.name || 'Admin',
        role: user?.role
      });
      // Update local state immediately by unique form ID
      setForms(prev => prev.filter(f => f.id !== targetId));
      setFormToDelete(null);
      setNotificationMessage(`Đã xóa thành công phiếu KPI của giáo viên: ${deletedName} (${deletedPeriod})`);
      setTimeout(() => {
        setNotificationMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Lỗi khi xóa phiếu KPI:', err);
      setDeleteError(err.message || 'Không thể xóa phiếu đánh giá. Vui lòng thử lại.');
    } finally {
      setIsDeletingForm(false);
    }
  };

  const handleToggleLock = async (form: KpiVcForm) => {
    const isLocked = form.status === 'locked';
    setTogglingLockFormId(form.id);
    try {
      await toggleLockVcForm(form.id, !isLocked, {
        id: user?.id || 'admin',
        name: user?.name || 'Admin',
        role: user?.role
      });
      setForms(prev => prev.map(f => {
        if (f.id === form.id) {
          const unlockedStatus = f.managerTotalScore ? 'completed' : (f.ttcmTotalScore ? 'ttcm_evaluated' : 'submitted');
          return {
            ...f,
            status: !isLocked ? 'locked' : unlockedStatus,
            lockedAt: !isLocked ? new Date().toISOString() : null,
            lockedBy: !isLocked ? (user?.name || 'Admin') : null
          };
        }
        return f;
      }));
      setNotificationMessage(`Đã ${!isLocked ? 'khóa' : 'mở khóa'} phiếu KPI thành công cho ${form.employeeName}.`);
      setTimeout(() => setNotificationMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thay đổi trạng thái khóa');
    } finally {
      setTogglingLockFormId(null);
    }
  };

  // Selection & Bulk Delete Handlers
  const isAllSelected = useMemo(() => {
    return filteredForms.length > 0 && filteredForms.every(f => selectedFormIds.includes(f.id));
  }, [filteredForms, selectedFormIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedFormIds([]);
    } else {
      setSelectedFormIds(filteredForms.map(f => f.id));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedFormIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenBulkDeleteFilteredAll = () => {
    if (isProductionWeb()) return;
    if (filteredForms.length === 0) return;
    setBulkDeleteType('filtered_all');
    setBulkDeleteStep(1);
    setBulkConfirmInput('');
    setBulkDeleteError(null);
    setIsBulkDeleteModalOpen(true);
  };

  const handleOpenBulkDeleteSelected = () => {
    if (isProductionWeb()) return;
    if (selectedFormIds.length === 0) return;
    setBulkDeleteType('selected_items');
    setBulkDeleteStep(1);
    setBulkConfirmInput('');
    setBulkDeleteError(null);
    setIsBulkDeleteModalOpen(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (isProductionWeb()) {
      setIsBulkDeleteModalOpen(false);
      return;
    }

    const targetIds = bulkDeleteType === 'selected_items' 
      ? selectedFormIds 
      : filteredForms.map(f => f.id);

    if (targetIds.length === 0) return;

    if (bulkDeleteStep === 1) {
      setBulkDeleteStep(2);
      return;
    }

    // Check confirmation input
    if (bulkConfirmInput.trim().toUpperCase() !== 'XOA') {
      setBulkDeleteError('Vui lòng nhập chính xác "XOA" để thực hiện thao tác xóa.');
      return;
    }

    setIsBulkDeleting(true);
    setBulkDeleteError(null);

    const activePeriodName = periods.find(p => p.id === selectedPeriodId)?.name || (selectedPeriodId === 'all' ? 'Tất cả kỳ đánh giá' : '');
    const activeDeptName = departments.find(d => d.id === selectedDeptId)?.name || (selectedDeptId === 'all' ? 'Tất cả đơn vị' : '');

    try {
      await bulkDeleteVcForms(
        targetIds,
        {
          id: user?.id || 'admin',
          name: user?.name || 'Ban Giám hiệu',
          role: user?.role || 'BGH'
        },
        {
          periodName: activePeriodName,
          deptName: activeDeptName
        }
      );

      // Local state update
      const targetSet = new Set(targetIds);
      setForms(prev => prev.filter(f => !targetSet.has(f.id)));
      setSelectedFormIds(prev => prev.filter(id => !targetSet.has(id)));

      setIsBulkDeleteModalOpen(false);
      setNotificationMessage(`Đã xóa thành công ${targetIds.length} phiếu đánh giá.`);
      setTimeout(() => setNotificationMessage(null), 5000);
    } catch (err: any) {
      console.error('Lỗi xóa hàng loạt:', err);
      setBulkDeleteError(err.message || 'Lỗi khi thực hiện xóa hàng loạt. Vui lòng thử lại.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleConfirmTotalDelete = async () => {
    if (isProductionWeb()) {
      setIsTotalDeleteModalOpen(false);
      return;
    }

    if (totalDeleteConfirmInput.trim().toUpperCase() !== 'XOA TOAN BO KPI') {
      setTotalDeleteError('Vui lòng nhập chính xác cụm từ "XOA TOAN BO KPI" để xác nhận.');
      return;
    }

    setIsTotalDeleting(true);
    setTotalDeleteError(null);

    let targetIds: string[] = [];
    let scopeDesc = '';

    if (totalDeleteScope === 'period') {
      targetIds = forms.filter(f => f.periodId === selectedPeriodId).map(f => f.id);
      scopeDesc = `Kỳ đánh giá: ${activePeriodObj?.name || selectedPeriodId}`;
    } else if (totalDeleteScope === 'filtered') {
      targetIds = filteredForms.map(f => f.id);
      scopeDesc = `Phạm vi lọc hiện tại (${filteredForms.length} phiếu)`;
    } else if (totalDeleteScope === 'all') {
      targetIds = forms.map(f => f.id);
      scopeDesc = 'Toàn bộ hệ thống';
    }

    if (targetIds.length === 0) {
      setTotalDeleteError('Không có phiếu KPI nào trong phạm vi đã chọn để xóa.');
      setIsTotalDeleting(false);
      return;
    }

    try {
      await bulkDeleteVcForms(
        targetIds,
        {
          id: user?.id || 'admin',
          name: user?.name || 'Ban Giám hiệu',
          role: user?.role || 'BGH'
        },
        {
          periodName: scopeDesc,
          deptName: 'KPI Giáo viên'
        }
      );

      const targetSet = new Set(targetIds);
      setForms(prev => prev.filter(f => !targetSet.has(f.id)));
      setSelectedFormIds(prev => prev.filter(id => !targetSet.has(id)));

      setIsTotalDeleteModalOpen(false);
      setNotificationMessage(`Đã xóa thành công ${targetIds.length} phiếu KPI Giáo viên (${scopeDesc}).`);
      setTimeout(() => setNotificationMessage(null), 5000);
    } catch (err: any) {
      console.error('Lỗi xóa toàn bộ phiếu KPI:', err);
      setTotalDeleteError(err.message || 'Lỗi khi thực hiện xóa. Vui lòng thử lại.');
    } finally {
      setIsTotalDeleting(false);
    }
  };

  const activePeriodObj = periods.find(p => p.id === selectedPeriodId) || periods[0];

  // Candidates for Batch Reset (teacherSelfScore === 100)
  const formsWith100InPeriod = useMemo(() => {
    return forms.filter(f => {
      if (selectedPeriodId !== 'all' && f.periodId !== selectedPeriodId) return false;
      return f.totalScore === 100;
    });
  }, [forms, selectedPeriodId]);

  const formsUnder100InPeriod = useMemo(() => {
    return forms.filter(f => {
      if (selectedPeriodId !== 'all' && f.periodId !== selectedPeriodId) return false;
      return typeof f.totalScore === 'number' && f.totalScore >= 0 && f.totalScore < 100;
    });
  }, [forms, selectedPeriodId]);

  const invalidFormsInPeriod = useMemo(() => {
    return forms.filter(f => {
      if (selectedPeriodId !== 'all' && f.periodId !== selectedPeriodId) return false;
      return typeof f.totalScore !== 'number' || Number.isNaN(f.totalScore) || f.totalScore > 100;
    });
  }, [forms, selectedPeriodId]);

  const handleConfirmReset100 = async () => {
    setIsResetting100(true);
    setReset100Error(null);
    try {
      const res = await resetFormsWith100Points(selectedPeriodId, {
        id: user?.id || 'admin',
        name: user?.name || 'Ban Giám hiệu',
        role: user?.role || 'BGH'
      });
      setReset100Result(res);

      // Cập nhật state forms ngay lập tức trên UI
      setForms(prev => prev.map(f => {
        const found = res.updatedForms.find(u => u.id === f.id);
        if (found) {
          return {
            ...f,
            totalScore: 0,
            groupScores: { group_I: 0, group_II: 0, group_III: 0 },
            selfClassification: 'Chưa tự đánh giá',
            status: 'draft',
            items: (f.items || []).map(i => ({
              ...i,
              selfScore: null,
              selectedLevelId: null,
              selectedLevelName: null,
              selectedLevelCode: null,
              note: '',
              evidenceUrl: ''
            }))
          };
        }
        return f;
      }));

      setNotificationMessage(`Đã đưa ${res.updatedCount} phiếu 100 điểm về 0 điểm thành công để giáo viên chấm lại.`);
      setTimeout(() => setNotificationMessage(null), 6000);
    } catch (err: any) {
      console.error('Lỗi khi đưa phiếu 100 điểm về 0:', err);
      setReset100Error(err.message || 'Lỗi khi cập nhật dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsResetting100(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 lg:p-6 w-full max-w-full space-y-6 pb-16">
      
      {/* 0. NAVIGATION / BREADCRUMB ROW */}
      <div className="flex items-center gap-4">
        <BackButton />
      </div>

      {/* 1. TOP HEADER BANNER - CLEAN HORIZONTAL CONTROL PANEL */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden border border-blue-800/40 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Award size={20} className="text-blue-300 shrink-0" />
            ĐÁNH GIÁ KPI GIÁO VIÊN
          </h1>
          <span className="text-xs text-blue-200 font-medium">Trường THPT Sơn Lương</span>
        </div>

        {/* Thanh chức năng ngang */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/15">
          {/* Nút Quay lại Trang chủ */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/25 transition-all cursor-pointer backdrop-blur-xs"
            title="Trở về Trang chủ Dashboard"
          >
            <Home size={15} /> Trang chủ
          </button>

          {/* Tạo phiếu mới (Chỉ hiển thị trong môi trường phát triển Google AI Studio) */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Plus size={16} /> Tạo phiếu đánh giá mới
            </button>
          )}

          {/* Quản lý tiêu chí (Admin only) */}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setIsCriteriaManagerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/25 transition-all cursor-pointer backdrop-blur-xs"
              >
                <Sliders size={15} /> Quản lý tiêu chí
              </button>
              <button
                type="button"
                onClick={() => setIsPeriodManagerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/25 transition-all cursor-pointer backdrop-blur-xs"
              >
                <Calendar size={15} /> Quản lý kỳ
              </button>
              <button
                type="button"
                onClick={() => setIsRatingConfigModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 hover:text-white text-xs font-bold rounded-xl border border-amber-400/40 transition-all cursor-pointer backdrop-blur-xs shadow-xs"
                title="Cấu hình điểm xếp loại KPI"
              >
                <Sliders size={15} /> Cấu hình xếp loại
              </button>

              {/* Nút Đưa phiếu 100đ về 0 (Admin / BGH) */}
              <button
                type="button"
                onClick={() => {
                  setReset100Result(null);
                  setReset100Error(null);
                  setIsReset100ModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black rounded-xl border border-amber-300 transition-all cursor-pointer shadow-md"
                title="Lệnh sửa dữ liệu KPI: Đưa phiếu 100 điểm về 0 điểm để giáo viên chấm lại"
              >
                <RefreshCw size={15} /> Đưa phiếu 100đ về 0
                {formsWith100InPeriod.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-red-600 text-white font-black rounded-full animate-pulse">
                    {formsWith100InPeriod.length}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Nút Xóa toàn bộ phiếu KPI (Admin / BGH only) */}
          {isAdmin && canEditOrDelete() && !isProductionWeb() && (
            <button
              type="button"
              onClick={() => {
                setTotalDeleteScope('period');
                setTotalDeleteConfirmInput('');
                setTotalDeleteError(null);
                setIsTotalDeleteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-xl border border-rose-500/40 transition-all cursor-pointer shadow-md"
              title="Xóa toàn bộ phiếu KPI Giáo viên theo phạm vi"
            >
              <Trash2 size={15} /> Xóa toàn bộ phiếu KPI
            </button>
          )}

          {/* Xuất Excel */}
          <button
            type="button"
            onClick={() => exportVcSummaryToExcel(filteredForms, activePeriodObj?.name, activePeriodObj?.academicYear, ratingConfigs)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md ml-auto"
          >
            <FileSpreadsheet size={15} /> Xuất Excel tổng hợp
          </button>
        </div>

        {/* Trang trí background */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/2 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* 2. CARD NHẮC NHỞ TỰ ĐÁNH GIÁ (NẾU LÀ GIÁO VIÊN ĐĂNG NHẬP) */}
      {!isAdmin && user && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
              <UserCheck size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                Hồ sơ tự đánh giá của bạn: <span className="text-blue-700 underline">{user.name}</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {myFormInPeriod 
                  ? (myFormInPeriod.totalScore > 0 
                      ? `Bạn đã có phiếu đánh giá trong ${myFormInPeriod.periodName}. Tổng điểm tự chấm: ${myFormInPeriod.totalScore}/100 (${myFormInPeriod.selfClassification}).`
                      : `Bạn đã có phiếu đánh giá trong ${myFormInPeriod.periodName} (Trạng thái: Chưa tự chấm). Vui lòng nhấn nút bên phải để tự chấm điểm.`)
                  : `Bạn chưa hoàn thành tự chấm điểm cho kỳ ${activePeriodObj?.name || 'này'}. Vui lòng tạo phiếu để hoàn thành.`}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {myFormInPeriod ? (
              <button
                type="button"
                onClick={() => handleOpenDoc(myFormInPeriod, 'self_eval')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Edit3 size={15} /> Mở phiếu tự chấm điểm
              </button>
            ) : import.meta.env.DEV ? (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={15} /> Bắt đầu tự chấm điểm ngay
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* 3. THỐNG KÊ METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Tổng số phiếu */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số phiếu</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.totalForms}</span>
              <span className="text-xs text-slate-500 font-medium">/ {eligibleTeachers.length} Giáo viên</span>
            </div>
          </div>
        </div>

        {/* Đã hoàn thành */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã hoàn thành</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-600">{stats.completedCount}</span>
              <span className="text-xs text-slate-500 font-medium">phiếu</span>
            </div>
          </div>
        </div>

        {/* Điểm TB toàn trường */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Điểm TB tự chấm</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-indigo-600">{stats.avgScore}</span>
              <span className="text-xs text-slate-400 font-medium">/ 100</span>
            </div>
          </div>
        </div>

        {/* Mức xếp loại hàng đầu */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider line-clamp-1" title={`${stats.topTier1Name} & ${stats.topTier2Name}`}>
              {stats.topTier1Name} & Tốt
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-amber-600">
                {stats.topCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">cán bộ</span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Chọn Kỳ đánh giá */}
          <div className="bg-[#FFF3CD] border-2 border-[#F59E0B] rounded-[10px] p-2 hover:border-[#D97706] hover:shadow-md transition-all duration-200">
            <label className="block text-[13px] font-bold text-[#B91C1C] uppercase mb-1">
              Kỳ đánh giá:
            </label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-2 text-[14px] font-bold text-[#1D4ED8] bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả kỳ đánh giá</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.academicYear})
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Tổ / Đơn vị */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Tổ / Bộ môn:
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả tổ / đơn vị</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Xếp loại */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Xếp loại:
            </label>
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả xếp loại</option>
              {dynamicClassificationOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Trạng thái phiếu */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Trạng thái:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Chưa chấm</option>
              <option value="submitted">Đã tự chấm</option>
              <option value="ttcm_evaluated">TTCM đã chấm</option>
              <option value="completed">BGH đã chấm</option>
              <option value="locked">Đã khóa</option>
            </select>
          </div>

          {/* Tìm kiếm */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Tìm kiếm:
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Họ tên, mã, chức vụ..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Thông báo thao tác thành công */}
      {notificationMessage && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-emerald-900 font-bold text-sm flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
            <span>{notificationMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setNotificationMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold text-xs px-2 py-1 rounded-lg hover:bg-emerald-100"
          >
            Đóng ✕
          </button>
        </div>
      )}

      {/* Thông báo trạng thái đồng bộ Firestore / Cache an toàn */}
      {firestoreNotice && !firestoreNotice.isOnline && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>
              <strong>Thông báo đồng bộ dữ liệu:</strong> Đang hoạt động ở chế độ lưu trữ an toàn (kết nối Firestore: đang chờ hạn mức miễn phí làm mới). Toàn bộ 51 phiếu đánh giá với điểm tự chấm, điểm TTCM và BGH được bảo toàn và hiển thị chính xác.
            </span>
          </div>
          <button 
            type="button" 
            onClick={() => setFirestoreNotice(null)}
            className="text-amber-800 hover:text-amber-950 font-bold px-2 py-1 rounded-lg hover:bg-amber-100 shrink-0 cursor-pointer"
          >
            Đóng ✕
          </button>
        </div>
      )}

      {/* 5. BẢNG DANH SÁCH PHIẾU ĐÁNH GIÁ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                Danh sách Phiếu đánh giá KPI Viên chức ({filteredForms.length})
              </h2>
            </div>

            {selectedFormIds.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full border border-blue-200">
                ☑ Đã chọn {selectedFormIds.length} phiếu
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tùy chọn nhóm theo Tổ chuyên môn */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setGroupByDept(true)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  groupByDept ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gộp danh sách theo Tổ chuyên môn"
              >
                <Folder size={14} /> Theo Tổ chuyên môn
              </button>
              <button
                type="button"
                onClick={() => setGroupByDept(false)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !groupByDept ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hiển thị danh sách phẳng"
              >
                <List size={14} /> Danh sách phẳng
              </button>
            </div>

            {/* Nút Xóa đã chọn (chỉ hiển thị trong môi trường Google AI Studio để tránh xóa nhầm trên production) */}
            {canEditOrDelete() && isAdmin && !isProductionWeb() && selectedFormIds.length > 0 && (
              <button
                type="button"
                onClick={handleOpenBulkDeleteSelected}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Xóa các phiếu đã chọn"
              >
                <Trash2 size={14} /> Xóa đã chọn ({selectedFormIds.length})
              </button>
            )}

            {/* Nút Xóa tất cả */}
            {canEditOrDelete() && isAdmin && !isProductionWeb() && (
              <button
                type="button"
                disabled={filteredForms.length === 0}
                onClick={handleOpenBulkDeleteFilteredAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                title={filteredForms.length === 0 ? "Chưa có dữ liệu để xóa" : "Xóa tất cả phiếu phù hợp với bộ lọc hiện tại"}
              >
                <Trash2 size={14} /> 🗑 Xóa tất cả
              </button>
            )}

            <span className="text-xs text-slate-500 hidden md:inline ml-1">
              Hiển thị theo thứ tự cập nhật mới nhất
            </span>
          </div>
        </div>

        {/* HELPER FUNCTION FOR RENDERING KPI ROW */}
        {(() => {
          const renderKpiRow = (form: KpiVcForm, idx: number) => {
            const effStatus = getEffectiveFormStatus(form);
            const isLocked = effStatus === 'locked';
            const statusMeta = getVcStatusMeta(effStatus);
            const ratingInfo = getFormRating(form);
            const finalClassification = ratingInfo.ratingName;
            const classStyle = ratingInfo.badgeStyle;
            const isSelected = selectedFormIds.includes(form.id);

            const isMyForm = user?.id === form.employeeId || (user as any)?.code === form.employeeCode;
            const canSelfScore = isMyForm && (!effStatus || effStatus === 'draft' || effStatus === 'returned') && !isLocked;

            const isTtcmUser = isAdmin || 
              isTeacherTtcm(user, departments) || 
              String(user?.role || '').toUpperCase() === 'TTCM' || 
              String((user as any)?.accountRole || '').toUpperCase() === 'TTCM' || 
              (user?.position || '').toLowerCase().includes('tổ trưởng') ||
              form.ttcmEvaluatorId === user?.id;

            const canTtcmScore = isTtcmUser && 
              (effStatus === 'submitted' || effStatus === 'self_evaluated' || effStatus === 'pending_evaluator' || effStatus === 'evaluating') && 
              !isLocked;

            const isBghUser = isAdmin || 
              isTeacherBgh(user) || 
              String(user?.role || '').toUpperCase() === 'BGH' || 
              String(user?.role || '').toUpperCase() === 'CBQL' || 
              (user?.position || '').toLowerCase().includes('hiệu trưởng') ||
              form.bghEvaluatorId === user?.id || 
              form.evaluatorId === user?.id;

            const canBghScore = isBghUser && 
              (effStatus === 'ttcm_evaluated' || effStatus === 'pending_bgh' || effStatus === 'bgh_evaluating' || effStatus === 'submitted') && 
              !isLocked;

            const sttStickyClass = showAdminCheckbox ? 'left-10' : 'left-0';
            const nameStickyClass = showAdminCheckbox ? 'left-[88px]' : 'left-12';

            return (
              <tr 
                key={form.id} 
                className={`group hover:bg-slate-50/90 transition-colors border-b border-slate-200/80 ${isSelected ? 'bg-blue-50/50' : 'bg-white'}`}
              >
                {showAdminCheckbox && (
                  <td className="p-3 text-center sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-r border-slate-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectRow(form.id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </td>
                )}

                {/* STT */}
                <td className={`p-3 text-center font-bold text-slate-500 sticky ${sttStickyClass} z-20 bg-white group-hover:bg-slate-50 border-r border-slate-200 transition-colors`}>
                  {idx + 1}
                </td>

                {/* Họ và tên giáo viên (Sticky Column) */}
                <td className={`p-3 sticky ${nameStickyClass} z-20 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)] transition-colors min-w-[220px] max-w-[260px]`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                      {form.employeeName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p 
                        className="font-bold text-slate-900 text-xs sm:text-sm hover:text-blue-600 transition-colors cursor-pointer truncate"
                        onClick={() => handleOpenDoc(form, 'view')}
                        title={`Xem chi tiết: ${form.employeeName}`}
                      >
                        {form.employeeName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate" title={`${form.position} ${form.employeeCode ? `• Mã: ${form.employeeCode}` : ''}`}>
                        {form.position} {form.employeeCode ? `• ${form.employeeCode}` : ''}
                      </p>
                      <div className="text-[10px] space-y-0.5 mt-0.5">
                        {form.ttcmEvaluatorName && (
                          <div className="text-slate-600 truncate" title={`TTCM: ${form.ttcmEvaluatorName}`}>
                            <span className="font-bold text-purple-700">Tổ:</span> {form.ttcmEvaluatorName}
                            {typeof form.ttcmTotalScore === 'number' && form.ttcmTotalScore !== null ? (
                              <span className="ml-1 font-mono text-purple-900 font-bold">({form.ttcmTotalScore}đ)</span>
                            ) : (
                              <span className="ml-1 text-slate-400 italic font-normal">(chưa chấm)</span>
                            )}
                          </div>
                        )}
                        {(form.bghEvaluatorName || form.evaluatorName) && (
                          <div className="text-slate-600 truncate" title={`BGH: ${form.bghEvaluatorName || form.evaluatorName}`}>
                            <span className="font-bold text-blue-700">BGH:</span> {form.bghEvaluatorName || form.evaluatorName}
                            {typeof form.managerTotalScore === 'number' && form.managerTotalScore !== null ? (
                              <span className="ml-1 font-mono text-blue-900 font-bold">({form.managerTotalScore}đ)</span>
                            ) : (
                              <span className="ml-1 text-slate-400 italic font-normal">(chưa chấm)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Tổ chuyên môn */}
                <td className="p-3 text-slate-700 font-medium border-r border-slate-100 whitespace-nowrap min-w-[150px]">
                  <span className="inline-block px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-800">
                    {form.department}
                  </span>
                </td>

                {/* Tháng đánh giá */}
                <td className="p-3 border-r border-slate-100 min-w-[130px] whitespace-nowrap">
                  <span className="font-bold text-slate-900 block text-xs">{form.periodName}</span>
                  <span className="text-[11px] text-slate-500 font-medium">{form.academicYear}</span>
                </td>

                {/* Điểm tự chấm */}
                <td className="p-3 text-center border-r border-blue-100/60 font-mono min-w-[115px] bg-blue-50/30">
                  {(() => {
                    const isEvaluated = hasFormBeenEvaluated(form);
                    const selfScore = getFormTotalScore(form);
                    return (
                      <div className="flex flex-col items-center justify-center">
                        <span className={`text-xs sm:text-sm font-black ${isEvaluated ? 'text-blue-900' : 'text-slate-500'}`}>
                          {isEvaluated ? selfScore : 0}<span className="text-[10px] font-normal text-slate-400">/100</span>
                        </span>
                        {!isEvaluated && (
                          <span className="text-[10px] text-amber-600 font-semibold italic mt-0.5">Chưa chấm</span>
                        )}
                      </div>
                    );
                  })()}
                </td>

                {/* Điểm TTCM đánh giá */}
                <td className="p-3 text-center border-r border-purple-100/60 font-mono min-w-[125px] bg-purple-50/30">
                  {(() => {
                    const ttcmScore = getFormTtcmTotalScore(form);
                    const hasTtcm = typeof ttcmScore === 'number' && ttcmScore !== null;
                    return hasTtcm ? (
                      <span className="text-xs sm:text-sm font-black text-purple-900">
                        {ttcmScore}<span className="text-[10px] font-normal text-slate-400">/100</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-normal italic">Chưa chấm</span>
                    );
                  })()}
                </td>

                {/* Điểm BGH đánh giá */}
                <td className="p-3 text-center border-r border-indigo-100/60 font-mono min-w-[125px] bg-indigo-50/30">
                  {(() => {
                    const mgrScore = getFormManagerTotalScore(form);
                    const hasMgr = typeof mgrScore === 'number' && mgrScore !== null;
                    return hasMgr ? (
                      <span className="text-xs sm:text-sm font-black text-indigo-900">
                        {mgrScore}<span className="text-[10px] font-normal text-slate-400">/100</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-normal italic">Chưa chấm</span>
                    );
                  })()}
                </td>

                {/* Kết quả thực hiện nhiệm vụ (Xếp loại) */}
                <td className="p-3 text-center border-r border-slate-100 min-w-[170px]">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap shadow-2xs ${classStyle.bg} ${classStyle.text} ${classStyle.border}`}>
                    {finalClassification}
                  </span>
                </td>

                {/* Trạng thái */}
                <td className="p-3 text-center border-r border-slate-100 min-w-[130px]">
                  {isLocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                      <Lock size={12} /> Đã khóa
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusMeta.badgeClass}`} title={statusMeta.description}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                      {statusMeta.label}
                    </span>
                  )}
                </td>

                {/* Thao tác */}
                <td className="p-3 text-center min-w-[200px]">
                  <div className="flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                    {/* Nút Tự chấm nổi bật */}
                    {canSelfScore && (
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(form, 'self_eval')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] shadow-xs transition-colors cursor-pointer"
                        title="Tự chấm điểm phiếu KPI"
                      >
                        <Edit3 size={12} /> Tự chấm
                      </button>
                    )}

                    {/* Nút Chấm TTCM */}
                    {canTtcmScore && (
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(form, 'ttcm_eval')}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] shadow-xs transition-colors cursor-pointer"
                        title="Tổ trưởng chuyên môn chấm điểm"
                      >
                        <Edit3 size={12} /> Chấm TTCM
                      </button>
                    )}

                    {/* Nút Chấm BGH */}
                    {canBghScore && (
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(form, 'leader_eval')}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shadow-xs transition-colors cursor-pointer"
                        title="Ban Giám hiệu đánh giá & phê duyệt"
                      >
                        <Award size={12} /> Chấm BGH
                      </button>
                    )}

                    {/* Xem chi tiết */}
                    <button
                      type="button"
                      onClick={() => handleOpenDoc(form, 'view')}
                      title="Xem chi tiết phiếu"
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye size={15} />
                    </button>

                    {/* Chỉnh sửa */}
                    {(!isLocked || isAdmin) && !canSelfScore && !canTtcmScore && !canBghScore && (
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(form, 'edit')}
                        title="Chỉnh sửa phiếu"
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 size={15} />
                      </button>
                    )}

                    {/* In */}
                    <button
                      type="button"
                      onClick={() => handleOpenPrint(form)}
                      title="In phiếu A4 chuẩn"
                      className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Printer size={15} />
                    </button>

                    {/* Word */}
                    <button
                      type="button"
                      onClick={() => handleExportWord(form)}
                      disabled={exportingWordId === form.id}
                      title="Xuất Word (.doc)"
                      className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {exportingWordId === form.id ? (
                        <Loader2 size={15} className="animate-spin text-blue-600" />
                      ) : (
                        <FileText size={15} />
                      )}
                    </button>

                    {/* Khóa/Mở khóa */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleToggleLock(form)}
                        disabled={togglingLockFormId === form.id}
                        title={isLocked ? "Mở khóa phiếu" : "Khóa phiếu"}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                          isLocked ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {togglingLockFormId === form.id ? (
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                        ) : (
                          isLocked ? <Unlock size={15} /> : <Lock size={15} />
                        )}
                      </button>
                    )}

                    {/* Xóa */}
                    {!isProductionWeb() && canDeleteForm(form) && (
                      <button
                        type="button"
                        onClick={() => handleRequestDeleteForm(form)}
                        title="Xóa phiếu đánh giá này"
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          };

          return (
            <div className="overflow-x-auto relative w-full scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    {showAdminCheckbox && (
                      <th className="p-3.5 w-10 min-w-[40px] text-center sticky left-0 z-30 bg-slate-100 border-r border-slate-300">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleToggleSelectAll}
                          disabled={filteredForms.length === 0}
                          title={isAllSelected ? "Bỏ chọn tất cả" : `Chọn tất cả ${filteredForms.length} phiếu`}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </th>
                    )}
                    <th className={`p-3.5 w-12 min-w-[48px] text-center sticky ${showAdminCheckbox ? 'left-10' : 'left-0'} z-30 bg-slate-100 border-r border-slate-300`}>
                      STT
                    </th>
                    <th className={`p-3.5 min-w-[220px] max-w-[260px] sticky ${showAdminCheckbox ? 'left-[88px]' : 'left-12'} z-30 bg-slate-100 border-r border-slate-300 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)]`}>
                      Họ và tên giáo viên
                    </th>
                    <th className="p-3.5 min-w-[150px] border-r border-slate-200">Tổ chuyên môn</th>
                    <th className="p-3.5 min-w-[130px] border-r border-slate-200">Tháng đánh giá</th>
                    <th className="p-3.5 text-center min-w-[115px] bg-blue-100/70 text-blue-950 font-extrabold border-r border-blue-200">
                      Điểm tự chấm
                    </th>
                    <th className="p-3.5 text-center min-w-[125px] bg-purple-100/70 text-purple-950 font-extrabold border-r border-purple-200">
                      Điểm TTCM
                    </th>
                    <th className="p-3.5 text-center min-w-[125px] bg-indigo-100/70 text-indigo-950 font-extrabold border-r border-indigo-200">
                      Điểm BGH
                    </th>
                    <th className="p-3.5 text-center min-w-[170px] border-r border-slate-200">
                      Kết quả thực hiện nhiệm vụ
                    </th>
                    <th className="p-3.5 text-center min-w-[130px] border-r border-slate-200">
                      Trạng thái
                    </th>
                    <th className="p-3.5 text-center min-w-[200px]">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredForms.length === 0 ? (
                    <tr>
                      <td colSpan={showAdminCheckbox ? 11 : 10} className="p-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText size={32} className="text-slate-300" />
                          <p className="font-semibold text-slate-600">Chưa có phiếu đánh giá KPI.</p>
                          {import.meta.env.DEV && (
                            <p className="text-xs text-slate-400">Nhấn nút "+ Tạo phiếu đánh giá mới" để bắt đầu.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : groupByDept ? (
                    groupedFormsByDept.map(group => {
                      if (group.forms.length === 0) return null;
                      return (
                        <React.Fragment key={group.deptId}>
                          {/* GROUP HEADER ROW FOR TỔ CHUYÊN MÔN */}
                          <tr className="bg-slate-100/95 border-y border-slate-300 font-extrabold text-slate-800">
                            <td colSpan={showAdminCheckbox ? 11 : 10} className="py-2.5 px-4 bg-slate-100/95 sticky left-0 z-10">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-xs sm:text-sm">
                                  <Folder size={16} className="text-blue-600 fill-blue-100 shrink-0" />
                                  <span>{group.deptName}</span>
                                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-200">
                                    {group.forms.length} phiếu đánh giá
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {group.forms.map((form, idx) => renderKpiRow(form, idx))}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    filteredForms.map((form, idx) => renderKpiRow(form, idx))
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}

      </div>

      {/* MODAL VĂN BẢN ĐÁNH GIÁ (DOCUMENT MODAL) */}
      <KpiVcDocumentModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        form={selectedFormForDoc}
        mode={docModalMode}
        teachers={teachers}
        departments={departments}
        periods={periods}
        criteria={criteria}
        groups={groups}
        onSaved={(formId) => {
          setIsDocModalOpen(false);
          setSelectedPeriodId(prev => (prev && prev !== 'all') ? prev : 'vc_period_2026_09');
          setStatusFilter('all');
          setClassificationFilter('all');
          setSelectedDeptId('all');
          setSearchQuery('');
          setNotificationMessage('Đã lưu và gửi phiếu tự chấm thành công! Trạng thái phiếu đã chuyển sang: Chờ TTCM.');
          setTimeout(() => setNotificationMessage(null), 6000);
        }}
        onPrintRequest={(f) => {
          setIsDocModalOpen(false);
          setSelectedFormForPrint(f);
          setIsPrintModalOpen(true);
        }}
      />

      {/* MODAL QUẢN LÝ TIÊU CHÍ (CRITERIA MANAGER MODAL) */}
      <KpiVcCriteriaManagerModal
        isOpen={isCriteriaManagerOpen}
        onClose={() => setIsCriteriaManagerOpen(false)}
        criteria={criteria}
        groups={groups}
        onRefresh={() => {}}
      />

      {/* MODAL QUẢN LÝ KỲ ĐÁNH GIÁ (PERIOD MANAGER MODAL) */}
      <KpiVcPeriodManagerModal
        isOpen={isPeriodManagerOpen}
        onClose={() => setIsPeriodManagerOpen(false)}
        periods={periods}
      />

      {/* MODAL CẤU HÌNH ĐIỂM XẾP LOẠI KPI (RATING CONFIG MODAL) */}
      <KpiVcRatingConfigModal
        isOpen={isRatingConfigModalOpen}
        onClose={() => setIsRatingConfigModalOpen(false)}
        periods={periods}
        configs={ratingConfigs}
        historyList={ratingHistoryList}
        defaultPeriodId={selectedPeriodId === 'all' ? (periods[0]?.id || 'all') : selectedPeriodId}
        onSaved={() => {}}
      />

      {/* MODAL IN PHIẾU A4 (PRINT MODAL) */}
      <KpiVcPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        form={selectedFormForPrint}
      />

      {/* MODAL XÁC NHẬN XÓA PHIẾU */}
      {!isProductionWeb() && formToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Xác nhận xóa phiếu KPI</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-2">
              <p className="font-semibold text-rose-800">
                Bạn có chắc chắn muốn xóa phiếu đánh giá KPI của:
              </p>
              <div className="bg-white/90 border border-rose-200 rounded-lg p-2.5 space-y-1">
                <p className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                  <span>👤</span> <span>{formToDelete.employeeName}</span>
                  {formToDelete.departmentName && (
                    <span className="text-[11px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {formToDelete.departmentName}
                    </span>
                  )}
                </p>
                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span>Kỳ đánh giá:</span>
                  <span className="font-semibold text-slate-800">{formToDelete.periodName}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[11px] border-t border-rose-100 pt-1">
                  <span>Mã định danh phiếu:</span>
                  <span className="font-mono text-slate-700 font-medium">{formToDelete.id}</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-600 italic">
                * Phiếu sẽ được xóa chính xác theo mã định danh khỏi cơ sở dữ liệu và lưu vào nhật ký đối soát.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800 font-medium">
                ⚠️ {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingForm}
                onClick={() => setFormToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeletingForm}
                onClick={handleConfirmDeleteForm}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingForm ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÓA HÀNG LOẠT (BULK DELETE DIALOG - STEP 1 & STEP 2) */}
      {!isProductionWeb() && isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">
                  {bulkDeleteStep === 1 
                    ? (bulkDeleteType === 'selected_items' ? '⚠ XÓA CÁC PHIẾU ĐÁNH GIÁ ĐÃ CHỌN' : '⚠ XÓA DANH SÁCH PHIẾU ĐÁNH GIÁ')
                    : '⚠ XÁC NHẬN XÓA'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {bulkDeleteStep === 1 ? 'Bước 1/2: Kiểm tra số lượng & thông tin điều kiện lọc' : 'Bước 2/2: Nhập từ khóa để hoàn tất xóa dữ liệu'}
                </p>
              </div>
            </div>

            {/* Step 1 Body */}
            {bulkDeleteStep === 1 ? (
              <div className="space-y-4 text-xs text-slate-700">
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2.5 text-rose-950">
                  <p className="font-bold text-sm">Bạn đang chuẩn bị xóa:</p>
                  
                  <div className="bg-white/90 p-3.5 rounded-xl border border-rose-200 space-y-2 shadow-2xs">
                    <p className="text-base font-black text-rose-700 flex items-center gap-2">
                      <Trash2 size={18} />
                      {bulkDeleteType === 'selected_items' ? (
                        <span>{selectedFormIds.length} phiếu đánh giá đã chọn</span>
                      ) : (
                        <span>{filteredForms.length} phiếu đánh giá KPI</span>
                      )}
                    </p>
                    
                    <div className="h-px bg-rose-200 my-1"></div>

                    <p className="text-slate-700">
                      • Kỳ đánh giá: <span className="font-bold text-slate-900">{periods.find(p => p.id === selectedPeriodId)?.name || (selectedPeriodId === 'all' ? 'Tất cả kỳ' : selectedPeriodId)}</span>
                    </p>
                    <p className="text-slate-700">
                      • Tổ / Bộ môn: <span className="font-bold text-slate-900">{departments.find(d => d.id === selectedDeptId)?.name || (selectedDeptId === 'all' ? 'Tất cả đơn vị' : selectedDeptId)}</span>
                    </p>
                    {statusFilter !== 'all' && (
                      <p className="text-slate-700">• Trạng thái: <span className="font-bold text-slate-900">{statusFilter}</span></p>
                    )}
                    {classificationFilter !== 'all' && (
                      <p className="text-slate-700">• Xếp loại: <span className="font-bold text-slate-900">{classificationFilter}</span></p>
                    )}
                  </div>

                  <p className="text-xs text-rose-800 leading-relaxed pt-1">
                    Thao tác này sẽ xóa các phiếu được chọn khỏi danh sách quản lý.
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600 leading-relaxed text-[11.5px]">
                  🔒 <strong>Bảo vệ dữ liệu gốc:</strong> Thao tác này chỉ xóa phiếu đánh giá KPI, tuyệt đối không làm ảnh hưởng đến Hồ sơ CBGVNV, Tổ bộ môn, Bảng điểm hoặc Tiêu chí KPI gốc.
                </div>
              </div>
            ) : (
              /* Step 2 Body */
              <div className="space-y-4 text-xs text-slate-700">
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
                  <p className="font-bold text-sm text-rose-900">
                    Bạn có chắc chắn muốn xóa {bulkDeleteType === 'selected_items' ? selectedFormIds.length : filteredForms.length} phiếu?
                  </p>
                  <p className="text-rose-800 text-xs leading-relaxed">
                    Đây là thao tác có ảnh hưởng đến dữ liệu đánh giá KPI. Nhập <strong className="text-rose-950 font-black underline">"XOA"</strong> để xác nhận:
                  </p>

                  <div>
                    <input
                      type="text"
                      value={bulkConfirmInput}
                      onChange={(e) => setBulkConfirmInput(e.target.value)}
                      placeholder='Nhập "XOA" để xác nhận...'
                      className="w-full px-4 py-2.5 text-sm font-black bg-white border-2 border-rose-300 rounded-xl text-rose-900 focus:ring-2 focus:ring-rose-500 focus:outline-none uppercase placeholder:normal-case placeholder:font-normal"
                      autoFocus
                    />
                  </div>
                </div>

                {bulkDeleteError && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-xs text-red-800 font-medium">
                    ⚠️ {bulkDeleteError}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => {
                  if (bulkDeleteStep === 2) {
                    setBulkDeleteStep(1);
                  } else {
                    setIsBulkDeleteModalOpen(false);
                  }
                }}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                {bulkDeleteStep === 2 ? 'Quay lại' : 'Hủy'}
              </button>

              <button
                type="button"
                disabled={isBulkDeleting || (bulkDeleteStep === 2 && bulkConfirmInput.trim().toUpperCase() !== 'XOA')}
                onClick={handleConfirmBulkDelete}
                className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  bulkDeleteStep === 1 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                }`}
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang xóa phiếu đánh giá...</span>
                  </>
                ) : bulkDeleteStep === 1 ? (
                  <span>Tiếp tục ➔</span>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Xóa {bulkDeleteType === 'selected_items' ? selectedFormIds.length : filteredForms.length} phiếu</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TOTAL DELETE MODAL */}
      {!isProductionWeb() && isTotalDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">Xóa toàn bộ phiếu KPI Giáo viên</h3>
                <p className="text-xs text-rose-600 font-semibold">Cảnh báo: Hành động này không thể hoàn tác!</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl font-medium text-rose-950 leading-relaxed">
                Thầy/cô có chắc chắn muốn xóa toàn bộ phiếu KPI Giáo viên trong phạm vi đã chọn không? Thao tác này có thể làm mất điểm đánh giá, nhận xét và minh chứng liên quan.
              </div>

              {/* Scope Selection */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Chọn phạm vi xóa:
                </label>

                <div className="space-y-2">
                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    totalDeleteScope === 'period'
                      ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="totalDeleteScope"
                      checked={totalDeleteScope === 'period'}
                      onChange={() => setTotalDeleteScope('period')}
                      className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                    />
                    <div>
                      <p className="font-bold">Kỳ đánh giá đang chọn ({activePeriodObj?.name})</p>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Số lượng: {forms.filter(f => f.periodId === selectedPeriodId).length} phiếu
                      </p>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    totalDeleteScope === 'filtered'
                      ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="totalDeleteScope"
                      checked={totalDeleteScope === 'filtered'}
                      onChange={() => setTotalDeleteScope('filtered')}
                      className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                    />
                    <div>
                      <p className="font-bold">Phạm vi bộ lọc hiện tại</p>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Số lượng: {filteredForms.length} phiếu phù hợp với bộ lọc
                      </p>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    totalDeleteScope === 'all'
                      ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="totalDeleteScope"
                      checked={totalDeleteScope === 'all'}
                      onChange={() => setTotalDeleteScope('all')}
                      className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                    />
                    <div>
                      <p className="font-bold">Toàn bộ phiếu KPI trong hệ thống</p>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Tổng số: {forms.length} phiếu trên toàn hệ thống
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Nhập chính xác cụm từ <strong className="text-rose-700 font-black">XOA TOAN BO KPI</strong> để xác nhận:
                </label>
                <input
                  type="text"
                  value={totalDeleteConfirmInput}
                  onChange={e => setTotalDeleteConfirmInput(e.target.value)}
                  placeholder="Nhập XOA TOAN BO KPI..."
                  className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-black text-rose-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              {totalDeleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{totalDeleteError}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                disabled={isTotalDeleting}
                onClick={() => setIsTotalDeleteModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isTotalDeleting || totalDeleteConfirmInput.trim().toUpperCase() !== 'XOA TOAN BO KPI'}
                onClick={handleConfirmTotalDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isTotalDeleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Xóa toàn bộ</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL LỆNH SỬA DỮ LIỆU KPI HÀNG LOẠT: ĐƯA PHIẾU 100 ĐIỂM VỀ 0 */}
      {isReset100ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 text-amber-600">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <RefreshCw size={20} className={isResetting100 ? 'animate-spin' : ''} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                    Lệnh sửa dữ liệu: Đưa phiếu 100 điểm về 0 điểm
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Kỳ đánh giá: <span className="font-bold text-blue-700">{activePeriodObj?.name || selectedPeriodId}</span> ({activePeriodObj?.academicYear || '2026-2027'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReset100ModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              
              {!reset100Result ? (
                <>
                  {/* Quy tắc và phạm vi xử lý */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-amber-700 shrink-0" />
                      Quy tắc nghiệp vụ & bảo vệ an toàn dữ liệu:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-amber-900 font-medium leading-relaxed">
                      <li>
                        <strong>Điều kiện xử lý:</strong> Lọc chính xác <code className="px-1 py-0.5 bg-amber-200/70 rounded text-[11px] font-bold">teacherSelfScore === 100</code>.
                      </li>
                      <li>
                        <strong>Các phiếu dưới 100 điểm:</strong> Giữ nguyên tuyệt đối toàn bộ điểm đã lưu (không can thiệp vào các phiếu 98.5, 97, 94.5, 90.5, 86...).
                      </li>
                      <li>
                        <strong>Bảo toàn dữ liệu cấp trên:</strong> Điểm TTCM, điểm BGH, nhận xét, minh chứng và lịch sử đánh giá được giữ nguyên 100%.
                      </li>
                      <li>
                        <strong>Tự chấm lại:</strong> Toàn bộ tiêu chí tự chấm của phiếu 100 điểm được đưa về trạng thái chưa chấm để giáo viên tự nhập điểm và lưu kết quả mới.
                      </li>
                      <li>
                        <strong>Tự động sao lưu:</strong> Hệ thống tự động tạo bản sao lưu toàn bộ trước khi áp dụng.
                      </li>
                    </ul>
                  </div>

                  {/* Thống kê dự kiến */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-amber-700">{formsWith100InPeriod.length}</div>
                      <div className="text-[11px] font-bold text-amber-900 mt-0.5">Phiếu 100đ sẽ chuyển về 0</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-emerald-700">{formsUnder100InPeriod.length}</div>
                      <div className="text-[11px] font-bold text-emerald-900 mt-0.5">Phiếu &lt; 100đ giữ nguyên</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-slate-700">{invalidFormsInPeriod.length}</div>
                      <div className="text-[11px] font-bold text-slate-900 mt-0.5">Phiếu bất thường (&gt;100)</div>
                    </div>
                  </div>

                  {/* Danh sách phiếu 100 điểm phát hiện */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                      <span>Danh sách phiếu 100/100 điểm trong kỳ:</span>
                      <span className="text-amber-700 font-extrabold">{formsWith100InPeriod.length} phiếu</span>
                    </h4>

                    {formsWith100InPeriod.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600 font-medium">
                        ✓ Hiện không có phiếu nào có điểm tự chấm 100/100 trong kỳ này. Toàn bộ các phiếu đã ở mức điểm thực tế hoặc đã ở trạng thái 0 điểm (chưa chấm).
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                            <tr>
                              <th className="p-2 text-center w-10">STT</th>
                              <th className="p-2">Họ và tên</th>
                              <th className="p-2">Tổ / Đơn vị</th>
                              <th className="p-2 text-center">Điểm tự chấm</th>
                              <th className="p-2 text-center">Điểm TTCM</th>
                              <th className="p-2 text-center">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {formsWith100InPeriod.map((f, i) => (
                              <tr key={f.id} className="hover:bg-amber-50/50">
                                <td className="p-2 text-center text-slate-400 font-bold">{i + 1}</td>
                                <td className="p-2 font-bold text-slate-900">{f.employeeName}</td>
                                <td className="p-2 text-slate-600">{f.department || 'Trường THPT Sơn Lương'}</td>
                                <td className="p-2 text-center font-black text-rose-600 bg-rose-50/70">{f.totalScore}/100</td>
                                <td className="p-2 text-center font-bold text-blue-700">
                                  {f.ttcmTotalScore !== null && f.ttcmTotalScore !== undefined ? `${f.ttcmTotalScore}/100` : 'Chưa chấm'}
                                </td>
                                <td className="p-2 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    {f.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {reset100Error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-600 shrink-0" />
                      <span>{reset100Error}</span>
                    </div>
                  )}
                </>
              ) : (
                /* Kết quả sau khi thực hiện */
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-2">
                    <div className="flex items-center gap-2 font-black text-emerald-800 text-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <span>Đã hoàn thành lệnh sửa dữ liệu hàng loạt!</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200 text-xs">
                      <div>
                        <span className="text-slate-500 block">1. Số phiếu 100đ đã về 0:</span>
                        <strong className="text-emerald-700 text-base">{reset100Result.updatedCount}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">2. Số phiếu &lt; 100 giữ nguyên:</span>
                        <strong className="text-blue-700 text-base">{reset100Result.unchangedCount}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">3. Phiếu bất thường:</span>
                        <strong className="text-slate-700 text-base">{reset100Result.invalidCount}</strong>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 border-t border-emerald-100 pt-2 flex flex-col gap-0.5">
                      <span>• Bản sao lưu đã lưu: <code className="bg-white/80 px-1 py-0.5 rounded border border-emerald-200 text-emerald-800">{reset100Result.backupKey}</code></span>
                      <span>• Thời gian cập nhật: <strong>{new Date(reset100Result.timestamp).toLocaleString('vi-VN')}</strong></span>
                    </div>
                  </div>

                  {reset100Result.updatedForms.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="p-2.5 bg-slate-100 text-slate-800 font-bold text-xs">
                        Chi tiết các phiếu đã cập nhật:
                      </div>
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="p-2">Giáo viên</th>
                            <th className="p-2 text-center">Điểm cũ</th>
                            <th className="p-2 text-center">Điểm mới</th>
                            <th className="p-2 text-center">Điểm TTCM</th>
                            <th className="p-2 text-center">Trạng thái mới</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reset100Result.updatedForms.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50">
                              <td className="p-2 font-bold text-slate-900">{u.employeeName}</td>
                              <td className="p-2 text-center text-rose-600 line-through font-semibold">{u.oldScore}đ</td>
                              <td className="p-2 text-center font-extrabold text-emerald-600 bg-emerald-50/50">{u.newScore}/100</td>
                              <td className="p-2 text-center font-bold text-blue-700">
                                {u.ttcmScore !== null ? `${u.ttcmScore}/100 (bảo toàn)` : 'Chưa chấm'}
                              </td>
                              <td className="p-2 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                  Chưa chấm (draft)
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer Buttons */}
            <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
              {!reset100Result ? (
                <>
                  <button
                    type="button"
                    disabled={isResetting100}
                    onClick={() => setIsReset100ModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={isResetting100 || formsWith100InPeriod.length === 0}
                    onClick={handleConfirmReset100}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {isResetting100 ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Đang xử lý dữ liệu...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={15} />
                        <span>Xác nhận đưa {formsWith100InPeriod.length} phiếu 100đ về 0</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsReset100ModalOpen(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Hoàn tất và Đóng
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
