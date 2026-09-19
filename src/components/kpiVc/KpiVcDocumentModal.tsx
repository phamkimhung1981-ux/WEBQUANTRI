import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  CheckCircle2, 
  Printer, 
  Lock, 
  Unlock, 
  AlertCircle, 
  FileText, 
  Info,
  Calendar,
  User,
  ShieldCheck,
  Building,
  Award,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { 
  KpiVcForm, 
  KpiVcPeriod, 
  KpiVcCriterion, 
  KpiVcCriteriaGroup, 
  KpiVcScoreItem,
  KpiVcFormStatus
} from '../../types/kpiVc';
import { Teacher, Department } from '../../types';
import { 
  getEligibleVcTeachers,
  resolveVcTeacherPosition,
  resolveVcTeacherDepartment,
  calculateVcTotals,
  calculateVcManagerTotals,
  resolveVcClassification,
  createCriteriaSnapshot,
  initializeVcScoreItems,
  DEFAULT_VC_GROUPS,
  DEFAULT_VC_CRITERIA
} from '../../lib/kpiVcData';
import { getEligibleEvaluators } from '../../lib/kpiTargetAudienceUtils';
import { 
  createVcForm, 
  updateVcForm, 
  toggleLockVcForm, 
  cleanFirestoreData 
} from '../../services/kpiVcService';
import { useAuth } from '../../store/AuthContext';
import { exportVcFormToWord } from '../../utils/kpiWordExport';

interface KpiVcDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: KpiVcForm | null;
  mode: 'create' | 'edit' | 'self_eval' | 'leader_eval' | 'view';
  teachers: Teacher[];
  departments: Department[];
  periods: KpiVcPeriod[];
  criteria: KpiVcCriterion[];
  groups: KpiVcCriteriaGroup[];
  onSaved?: (formId: string) => void;
  onPrintRequest?: (form: KpiVcForm) => void;
}

export default function KpiVcDocumentModal({
  isOpen,
  onClose,
  form,
  mode,
  teachers,
  departments,
  periods,
  criteria,
  groups,
  onSaved,
  onPrintRequest
}: KpiVcDocumentModalProps) {
  const { user } = useAuth();

  // Admin permission
  const isAdmin = user?.id === 'admin' || user?.role === 'BGH' || (user?.position || '').toLowerCase().includes('hiệu trưởng');

  // Eligible teacher list (Teachers and Staff, NOT BGH)
  const eligibleTeachers = useMemo(() => {
    return getEligibleVcTeachers(teachers);
  }, [teachers]);

  // Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState<string>('');
  
  // Evaluation Date & Sign
  const [selfDate, setSelfDate] = useState<string>('');
  const [selfClassification, setSelfClassification] = useState<string>('Hoàn thành tốt nhiệm vụ');
  const [selfComment, setSelfComment] = useState<string>('');

  // Leader Assessment
  const [leaderClassification, setLeaderClassification] = useState<string>('Hoàn thành tốt nhiệm vụ');
  const [leaderComment, setLeaderComment] = useState<string>('');
  const [leaderDate, setLeaderDate] = useState<string>('');
  const [leaderSignName, setLeaderSignName] = useState<string>('Hiệu trưởng / Ban Giám hiệu');
  const [managerGeneralComment, setManagerGeneralComment] = useState<string>('');

  // Current selected teacher object
  const selectedTeacher = useMemo(() => {
    return eligibleTeachers.find(t => t.id === selectedTeacherId) || 
      teachers.find(t => t.id === selectedTeacherId) || null;
  }, [eligibleTeachers, teachers, selectedTeacherId]);

  // Compute eligible evaluators strictly according to position rules and department
  const eligibleEvaluatorsResult = useMemo(() => {
    return getEligibleEvaluators(selectedTeacher, teachers, departments);
  }, [selectedTeacher, teachers, departments]);

  const recommendedEvaluators = useMemo(() => {
    return eligibleEvaluatorsResult.evaluators || [];
  }, [eligibleEvaluatorsResult]);

  // List of all CBQL / BGH / TTCM / Department Heads in the school
  const allCbqlEvaluators = useMemo(() => {
    const list = teachers.filter(t => {
      const roleStr = String(t.role || '');
      const posStr = String(t.position || '').toLowerCase();
      const isHead = departments.some(d => d.headId === t.id);
      return (
        roleStr === 'BGH' ||
        roleStr === 'TTCM' ||
        roleStr === 'NHAN_SU' ||
        roleStr === 'admin' ||
        roleStr === 'manager' ||
        Boolean((t as any).isManager) ||
        posStr.includes('hiệu trưởng') ||
        posStr.includes('phó hiệu trưởng') ||
        posStr.includes('tổ trưởng') ||
        posStr.includes('bgh') ||
        posStr.includes('quản lý') ||
        posStr.includes('trưởng') ||
        posStr.includes('lãnh đạo') ||
        isHead
      );
    });
    return list.length > 0 ? list : teachers;
  }, [teachers, departments]);

  // Other CBQLs not in recommended list
  const otherCbqlList = useMemo(() => {
    return allCbqlEvaluators.filter(t => !recommendedEvaluators.some(r => r.id === t.id));
  }, [allCbqlEvaluators, recommendedEvaluators]);

  const selectedEvaluator = useMemo(() => {
    return teachers.find(t => t.id === selectedEvaluatorId) || null;
  }, [teachers, selectedEvaluatorId]);

  const handleEvaluatorChange = (evaluatorId: string) => {
    setSelectedEvaluatorId(evaluatorId);
    const ev = teachers.find(t => t.id === evaluatorId);
    if (ev) {
      setLeaderSignName(ev.name);
    }
  };

  const handleTeacherChange = (newTeacherId: string) => {
    setSelectedTeacherId(newTeacherId);
    const newTeacher = teachers.find(t => t.id === newTeacherId);
    if (newTeacher) {
      const res = getEligibleEvaluators(newTeacher, teachers, departments);
      let defaultEvalId = res.defaultEvaluatorId;
      if (user && res.evaluators.some(e => e.id === user.id)) {
        defaultEvalId = user.id;
      }
      if (defaultEvalId) {
        setSelectedEvaluatorId(defaultEvalId);
        const ev = teachers.find(t => t.id === defaultEvalId);
        if (ev) {
          setLeaderSignName(ev.name);
        }
      }
    }
  };

  // Items State (list of scored criteria)
  const [scoreItems, setScoreItems] = useState<KpiVcScoreItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const lastInitializedKey = useRef<string | null>(null);

  // Initialize data on open
  useEffect(() => {
    if (!isOpen) {
      lastInitializedKey.current = null;
      return;
    }

    const currentKey = `${form?.id || 'new'}_${mode}_${isOpen}`;
    if (lastInitializedKey.current === currentKey) {
      return;
    }
    lastInitializedKey.current = currentKey;

    setErrorMsg(null);
    setSuccessMsg(null);

    const todayStr = new Date().toLocaleDateString('vi-VN');

    if (form) {
      // EDIT / VIEW / LEADER_EVAL MODE
      setSelectedTeacherId(form.employeeId);
      setSelectedPeriodId(form.periodId);
      
      const empTeacher = teachers.find(t => t.id === form.employeeId);
      const evalRes = getEligibleEvaluators(empTeacher, teachers, departments);
      
      let matchedEvalId = form.evaluatorId || '';
      if (!matchedEvalId && form.evaluatorName) {
        const foundObj = teachers.find(t => t.name.trim().toLowerCase() === form.evaluatorName.trim().toLowerCase());
        if (foundObj) matchedEvalId = foundObj.id;
      }
      if (!matchedEvalId) {
        matchedEvalId = evalRes.defaultEvaluatorId;
      }

      setSelectedEvaluatorId(matchedEvalId);
      setScoreItems(form.items || []);
      setSelfClassification(form.selfClassification || resolveVcClassification(form.totalScore));
      setSelfDate(form.selfDate || todayStr);
      setSelfComment(form.selfComment || '');
      setLeaderClassification(form.leaderClassification || form.selfClassification || 'Hoàn thành tốt nhiệm vụ');
      setLeaderComment(form.leaderComment || '');
      setLeaderDate(form.leaderDate || todayStr);
      setLeaderSignName(form.leaderSignName || form.evaluatorName || teachers.find(t => t.id === matchedEvalId)?.name || 'Hiệu trưởng');
      setManagerGeneralComment(form.managerGeneralComment || '');
    } else {
      // CREATE MODE
      const defaultPeriod = periods.find(p => p.status === 'active') || periods[0];
      setSelectedPeriodId(defaultPeriod?.id || '');

      // Pick default teacher: current user if regular teacher, or first eligible teacher
      let targetTeacherId = '';
      if (user && eligibleTeachers.some(t => t.id === user.id)) {
        targetTeacherId = user.id;
      } else if (eligibleTeachers.length > 0) {
        targetTeacherId = eligibleTeachers[0].id;
      }
      setSelectedTeacherId(targetTeacherId);

      // Default Evaluator selection for this target teacher
      const targetTeacherObj = teachers.find(t => t.id === targetTeacherId);
      const evalRes = getEligibleEvaluators(targetTeacherObj, teachers, departments);
      
      let defaultEvalId = evalRes.defaultEvaluatorId;
      if (user && evalRes.evaluators.some(e => e.id === user.id)) {
        defaultEvalId = user.id;
      }
      setSelectedEvaluatorId(defaultEvalId);
      const defaultEvalObj = teachers.find(t => t.id === defaultEvalId);
      setLeaderSignName(defaultEvalObj?.name || 'Hiệu trưởng');

      // Initialize default items from current active criteria
      const activeCriteria = criteria.length > 0 ? criteria : DEFAULT_VC_CRITERIA;
      const initialItems = initializeVcScoreItems(activeCriteria);
      setScoreItems(initialItems);

      const totals = calculateVcTotals(initialItems);
      setSelfClassification(resolveVcClassification(totals.totalScore));
      setSelfDate(todayStr);
      setSelfComment('');
      setLeaderClassification('Hoàn thành tốt nhiệm vụ');
      setLeaderComment('');
      setLeaderDate(todayStr);
      setManagerGeneralComment('');
    }
  }, [isOpen, form, mode, periods, eligibleTeachers, teachers, departments, criteria, user]);

  // Ensure selected teacher and period are populated if loaded asynchronously
  useEffect(() => {
    if (isOpen && (mode === 'create' || !form)) {
      if (!selectedTeacherId && eligibleTeachers.length > 0) {
        const initTeacherId = (user && eligibleTeachers.some(t => t.id === user.id)) ? user.id : eligibleTeachers[0].id;
        handleTeacherChange(initTeacherId);
      }
      if (!selectedPeriodId && periods.length > 0) {
        const defaultPeriod = periods.find(p => p.status === 'active') || periods[0];
        setSelectedPeriodId(defaultPeriod?.id || '');
      }
    }
  }, [isOpen, mode, form, eligibleTeachers, periods, user, selectedTeacherId, selectedPeriodId]);

  // Current selected period object
  const selectedPeriod = useMemo(() => {
    return periods.find(p => p.id === selectedPeriodId) || null;
  }, [periods, selectedPeriodId]);

  // Resolved Position & Department
  const resolvedPosition = useMemo(() => {
    return form ? form.position : resolveVcTeacherPosition(selectedTeacher, departments);
  }, [form, selectedTeacher, departments]);

  const resolvedDepartment = useMemo(() => {
    return form ? form.department : resolveVcTeacherDepartment(selectedTeacher, departments);
  }, [form, selectedTeacher, departments]);

  // Real-time calculations of group and total scores
  const { groupScores, totalScore } = useMemo(() => {
    return calculateVcTotals(scoreItems);
  }, [scoreItems]);

  // Auto-sync classification on totalScore change if user hasn't typed a custom one
  useEffect(() => {
    if (!form || mode === 'create') {
      setSelfClassification(resolveVcClassification(totalScore));
    }
  }, [totalScore, form, mode]);

  // Handle score change for input criteria
  const handleScoreChange = (criterionId: string, valStr: string, maxScore: number) => {
    let numVal = parseFloat(valStr);
    if (isNaN(numVal)) {
      numVal = 0;
    }
    // Constrain: 0 <= score <= maxScore
    if (numVal < 0) numVal = 0;
    if (numVal > maxScore) numVal = maxScore;

    setScoreItems(prev => prev.map(item => {
      if (item.criterionId === criterionId) {
        return {
          ...item,
          selfScore: numVal
        };
      }
      return item;
    }));
  };

  // Handle level change for select_level criteria (Group III.2)
  const handleLevelSelect = (criterionId: string, levelCode: string, levelName: string, levelScore: number) => {
    setScoreItems(prev => prev.map(item => {
      if (item.criterionId === criterionId) {
        return {
          ...item,
          selectedLevelCode: levelCode,
          selectedLevelName: levelName,
          selfScore: levelScore
        };
      }
      return item;
    }));
  };

  // Check read-only state
  const isLocked = form?.status === 'locked';
  const isReadOnly = mode === 'view' || (isLocked && !isAdmin);

  // Manager evaluation permissions

  const canEditManager = isAdmin || user?.role === 'BGH' || user?.role === 'CBQL' || 
    (user?.position || '').toLowerCase().includes('hiệu trưởng') || 
    (user?.position || '').toLowerCase().includes('phó hiệu trưởng') || 
    (user?.position || '').toLowerCase().includes('tổ trưởng') || 
    mode === 'leader_eval';

  // Handle manager score change
  const handleManagerScoreChange = (criterionId: string, valStr: string, maxScore: number) => {
    let numVal = parseFloat(valStr);
    if (isNaN(numVal)) {
      numVal = 0;
    }
    if (numVal < 0) numVal = 0;
    if (numVal > maxScore) {
      numVal = maxScore;
      setErrorMsg('Điểm đánh giá của CBQL không được vượt quá điểm tối đa.');
    } else {
      setErrorMsg(null);
    }

    setScoreItems(prev => prev.map(item => {
      if (item.criterionId === criterionId) {
        return {
          ...item,
          managerScore: numVal
        };
      }
      return item;
    }));
  };

  // Handle manager comment change
  const handleManagerCommentChange = (criterionId: string, comment: string) => {
    setScoreItems(prev => prev.map(item => {
      if (item.criterionId === criterionId) {
        return {
          ...item,
          managerComment: comment
        };
      }
      return item;
    }));
  };

  // Real-time calculations of manager scores and ratio
  const { managerGroupScores, managerTotalScore, evaluatedCount, ratio } = useMemo(() => {
    return calculateVcManagerTotals(scoreItems);
  }, [scoreItems]);

  const hasAnyManagerScore = evaluatedCount > 0;

  // Active Groups to render in table
  const activeGroups = useMemo(() => {
    const list = groups.length > 0 ? groups : DEFAULT_VC_GROUPS;
    return list.filter(g => g.isActive).sort((a, b) => a.order - b.order);
  }, [groups]);

  // Active Criteria
  const activeCriteria = useMemo(() => {
    if (form?.criteriaSnapshot?.criteria && form.criteriaSnapshot.criteria.length > 0) {
      return form.criteriaSnapshot.criteria;
    }
    const list = criteria.length > 0 ? criteria : DEFAULT_VC_CRITERIA;
    return list.filter(c => c.isActive).sort((a, b) => a.order - b.order);
  }, [form, criteria]);

  // Form Save Handler
  const handleSaveForm = async (targetStatus: KpiVcFormStatus = 'draft') => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Determine final status
    const finalStatus: KpiVcFormStatus = targetStatus;

    const currentTeacher = selectedTeacher || (form ? {
      id: form.employeeId,
      name: form.employeeName,
      code: form.employeeCode,
      username: form.employeeUsername,
      avatar: form.employeeAvatar,
      departmentId: form.departmentId
    } as any : null);

    const currentPeriod = selectedPeriod || (form ? {
      id: form.periodId,
      name: form.periodName,
      academicYear: form.academicYear
    } as any : null);

    if (!currentTeacher && (mode === 'create' || !form)) {
      setErrorMsg('Vui lòng chọn cán bộ, giáo viên hoặc nhân viên.');
      return;
    }

    if (!currentPeriod && (mode === 'create' || !form)) {
      setErrorMsg('Vui lòng chọn kỳ đánh giá.');
      return;
    }

    try {
      setIsSubmitting(true);

      const actor = {
        id: user?.id || 'admin',
        name: user?.name || 'Quản trị viên',
        role: user?.role
      };

      if (mode === 'create' || !form) {
        // CREATE / INITIAL SAVE
        const snapshot = createCriteriaSnapshot(
          groups.length > 0 ? groups : DEFAULT_VC_GROUPS,
          criteria.length > 0 ? criteria : DEFAULT_VC_CRITERIA
        );

        const evaluatorObj = selectedEvaluator || teachers.find(t => t.id === selectedEvaluatorId) || null;
        const evaluatorNameResolved = evaluatorObj?.name || leaderSignName || user?.name || 'CBQL';
        const evaluatorRoleResolved = evaluatorObj ? resolveVcTeacherPosition(evaluatorObj, departments) : (user?.role || 'CBQL');
        const evaluatorIdResolved = selectedEvaluatorId || evaluatorObj?.id || user?.id || 'admin';

        const newFormData: Omit<KpiVcForm, 'id' | 'createdAt' | 'updatedAt'> = {
          employeeId: currentTeacher!.id,
          employeeName: currentTeacher!.name,
          employeeCode: currentTeacher!.code || `GV_${currentTeacher!.id}`,
          employeeUsername: currentTeacher!.username || '',
          employeeAvatar: currentTeacher!.avatar || null,
          position: resolvedPosition || 'Giáo viên',
          department: resolvedDepartment || 'Trường THPT Sơn Lương',
          departmentId: currentTeacher!.departmentId || null,

          periodId: currentPeriod!.id,
          periodName: currentPeriod!.name,
          academicYear: currentPeriod!.academicYear || '2025-2026',

          criteriaSnapshot: snapshot,
          items: scoreItems,

          groupScores,
          managerGroupScores,
          totalScore,
          managerTotalScore: hasAnyManagerScore ? managerTotalScore : null,
          maxTotalScore: 100,

          selfClassification: selfClassification || 'Hoàn thành tốt nhiệm vụ',
          selfDate: selfDate || new Date().toLocaleDateString('vi-VN'),
          selfSignName: currentTeacher!.name || '',
          selfComment: selfComment || '',

          leaderClassification: leaderClassification || 'Hoàn thành tốt nhiệm vụ',
          leaderComment: leaderComment || '',
          leaderDate: leaderDate || new Date().toLocaleDateString('vi-VN'),
          leaderSignName: leaderSignName || evaluatorNameResolved,
          managerGeneralComment: managerGeneralComment || '',
          evaluatorId: evaluatorIdResolved,
          evaluatorName: evaluatorNameResolved,
          evaluatorRole: evaluatorRoleResolved,
          managerEvaluatedAt: hasAnyManagerScore ? new Date().toLocaleDateString('vi-VN') : null,

          status: finalStatus,
          createdBy: actor.name
        };

        const formId = await createVcForm(newFormData, actor);
        setSuccessMsg(finalStatus === 'completed' ? 'Đã hoàn thành và lưu phiếu đánh giá thành công!' : 'Đã lưu phiếu đánh giá thành công!');
        
        if (onSaved) onSaved(formId);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        // UPDATE EXISTING FORM
        const formId = form.id;
        const evaluatorObj = selectedEvaluator || teachers.find(t => t.id === selectedEvaluatorId) || null;
        const evaluatorNameResolved = evaluatorObj?.name || leaderSignName || form.evaluatorName || user?.name || 'CBQL';
        const evaluatorRoleResolved = evaluatorObj ? resolveVcTeacherPosition(evaluatorObj, departments) : (form.evaluatorRole || user?.role || 'CBQL');
        const evaluatorIdResolved = selectedEvaluatorId || evaluatorObj?.id || form.evaluatorId || user?.id || 'admin';

        const updatePayload: Partial<KpiVcForm> = {
          employeeId: form.employeeId,
          employeeName: form.employeeName,
          periodId: form.periodId,
          periodName: form.periodName,
          academicYear: form.academicYear,
          position: form.position || resolvedPosition,
          department: form.department || resolvedDepartment,
          items: scoreItems,
          groupScores,
          managerGroupScores,
          totalScore,
          managerTotalScore: hasAnyManagerScore ? managerTotalScore : null,
          selfClassification: selfClassification || 'Hoàn thành tốt nhiệm vụ',
          selfDate: selfDate || new Date().toLocaleDateString('vi-VN'),
          selfComment: selfComment || '',
          leaderClassification: leaderClassification || 'Hoàn thành tốt nhiệm vụ',
          leaderComment: leaderComment || '',
          leaderDate: leaderDate || new Date().toLocaleDateString('vi-VN'),
          leaderSignName: leaderSignName || evaluatorNameResolved,
          managerGeneralComment: managerGeneralComment || '',
          evaluatorId: evaluatorIdResolved,
          evaluatorName: evaluatorNameResolved,
          evaluatorRole: evaluatorRoleResolved,
          managerEvaluatedAt: hasAnyManagerScore ? new Date().toLocaleDateString('vi-VN') : (form.managerEvaluatedAt || null),
          status: isLocked ? 'locked' : finalStatus
        };

        await updateVcForm(formId, updatePayload, actor);
        setSuccessMsg(finalStatus === 'completed' ? 'Đã hoàn thành và chốt lưu phiếu đánh giá thành công!' : 'Đã cập nhật phiếu đánh giá thành công!');
        
        if (onSaved) onSaved(formId);
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      console.error('Error saving VC form:', err);
      setErrorMsg(err.message || 'Lỗi khi lưu phiếu đánh giá.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      
      {/* Container phiếu */}
      <div 
        id="kpi-vc-document-modal" 
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col my-auto max-h-[96vh] overflow-hidden border border-slate-200"
      >
        
        {/* MODAL ACTION BAR TRÊN CÙNG */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                {mode === 'create' && 'TẠO PHIẾU ĐÁNH GIÁ KPI GIÁO VIÊN - NHÂN VIÊN'}
                {mode === 'edit' && `CHỈNH SỬA PHIẾU KPI: ${form?.employeeName}`}
                {mode === 'self_eval' && `TỰ CHẤM ĐIỂM KPI: ${form?.employeeName}`}
                {mode === 'leader_eval' && `Ý KIẾN ĐÁNH GIÁ CỦA LÃNH ĐẠO: ${form?.employeeName}`}
                {mode === 'view' && `XEM CHI TIẾT PHIẾU ĐÁNH GIÁ: ${form?.employeeName}`}
                
                {isLocked && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
                    <Lock size={12} /> Đã khóa
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-blue-200">
                Trường THPT Sơn Lương • Mẫu chuẩn viên chức không giữ chức vụ quản lý
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {form && onPrintRequest && (
              <button
                type="button"
                onClick={() => onPrintRequest(form)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Printer size={15} /> In phiếu
              </button>
            )}

            {isAdmin && form && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`Bạn có chắc chắn muốn ${isLocked ? 'mở khóa' : 'khóa'} phiếu đánh giá này?`)) {
                    await toggleLockVcForm(form.id, !isLocked, {
                      id: user?.id || 'admin',
                      name: user?.name || 'Admin',
                      role: user?.role
                    });
                    if (onSaved) onSaved(form.id);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  isLocked 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                {isLocked ? 'Mở khóa' : 'Khóa phiếu'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* REALTIME SCORE BAR (STICKY COUNTER) */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>Nhóm I (Tư tưởng, đạo đức):</span>
              <span className="font-extrabold text-blue-700">{groupScores.group_I || 0} / 15</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>Nhóm II (Tác phong, kỷ luật):</span>
              <span className="font-extrabold text-indigo-700">{groupScores.group_II || 0} / 15</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Nhóm III (Kết quả thực hiện):</span>
              <span className="font-extrabold text-emerald-700">{groupScores.group_III || 0} / 70</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white border-2 border-blue-600/30 rounded-xl px-3 py-1 shadow-xs flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[10px] font-extrabold">TỔNG ĐIỂM:</span>
              <span className="text-base font-black text-blue-900">
                {totalScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </span>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1 text-blue-900 font-bold text-[11px]">
              {selfClassification}
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* NỘI DUNG VĂN BẢN TRANG A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 custom-scrollbar">
          
          <div className="bg-white border border-slate-300 rounded-xl p-6 sm:p-10 shadow-sm max-w-4xl mx-auto text-slate-900 font-sans text-xs sm:text-sm">
            
            {/* 1. HEADER CƠ QUAN VÀ QUỐC HIỆU */}
            <div className="flex justify-between items-start text-center mb-6">
              <div className="w-5/12 text-center">
                <p className="text-xs sm:text-[13px] uppercase font-semibold">SỞ GD&ĐT TỈNH PHÚ THỌ</p>
                <p className="text-xs sm:text-sm uppercase font-bold text-slate-900">TRƯỜNG THPT SƠN LƯƠNG</p>
                <div className="w-24 h-[1px] bg-slate-800 mx-auto mt-1" />
              </div>

              <div className="w-6/12 text-center">
                <p className="text-xs sm:text-[13px] uppercase font-bold tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="text-xs sm:text-[13px] font-bold underline">Độc lập – Tự do – Hạnh phúc</p>
              </div>
            </div>

            {/* 2. TIÊU ĐỀ PHIẾU */}
            <div className="text-center my-6">
              <h1 className="text-base sm:text-lg font-extrabold uppercase text-slate-900 leading-tight tracking-wide">
                PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM NĂM HỌC {form ? form.academicYear : (selectedPeriod?.academicYear || '2025-2026')}
              </h1>
              <p className="text-xs sm:text-sm font-semibold italic text-slate-800 mt-1">
                (Áp dụng đối với viên chức không giữ chức vụ lãnh đạo, quản lý)
              </p>
              <p className="text-xs font-semibold text-blue-900 mt-1">
                Kỳ đánh giá: {form ? form.periodName : (selectedPeriod?.name || 'Kỳ đánh giá')} (Năm học: {form ? form.academicYear : (selectedPeriod?.academicYear || '2025-2026')})
              </p>
            </div>

            {/* 3. THÔNG TIN VIÊN CHỨC */}
            <div className="border border-slate-300 bg-slate-50/50 rounded-xl p-4 mb-6 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Họ và tên */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Họ và tên viên chức: <span className="text-rose-500">*</span>
                  </label>
                  {mode === 'create' ? (
                    <div className="space-y-1">
                      <select
                        id="select-vc-employee"
                        value={selectedTeacherId}
                        onChange={(e) => handleTeacherChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {!selectedTeacherId && (
                          <option value="">-- Chọn cán bộ, giáo viên, nhân viên --</option>
                        )}
                        <optgroup label="📋 Danh sách Giáo viên & Nhân viên (Viên chức)">
                          {eligibleTeachers.map(t => {
                            const pos = resolveVcTeacherPosition(t, departments);
                            const dept = resolveVcTeacherDepartment(t, departments);
                            return (
                              <option key={t.id} value={t.id}>
                                [{pos}] {t.name} — {dept} ({t.code || t.username})
                              </option>
                            );
                          })}
                        </optgroup>
                      </select>
                      <p className="text-[10.5px] text-slate-500 italic">
                        * Tự động lấy họ tên, chức vụ, đơn vị và tài khoản từ hệ thống hồ sơ.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 text-sm flex items-center justify-between">
                      <div>
                        <span>{form?.employeeName}</span>
                        {form?.employeeCode && (
                          <span className="text-xs text-slate-500 font-normal ml-2">
                            ({form.employeeCode})
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                        {resolvedPosition}
                      </span>
                    </div>
                  )}
                </div>

                {/* Chức vụ */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Chức vụ:
                  </label>
                  <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs sm:text-sm">
                    {resolvedPosition}
                  </div>
                </div>

                {/* Đơn vị công tác */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Đơn vị công tác:
                  </label>
                  <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs sm:text-sm">
                    {resolvedDepartment}
                  </div>
                </div>

                {/* Kỳ đánh giá */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Kỳ đánh giá: <span className="text-rose-500">*</span>
                  </label>
                  {mode === 'create' ? (
                    <select
                      id="select-vc-period"
                      value={selectedPeriodId}
                      onChange={(e) => setSelectedPeriodId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.academicYear}) {p.status === 'locked' ? '🔒 Đã khóa' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs sm:text-sm">
                      {form?.periodName} ({form?.academicYear})
                    </div>
                  )}
                </div>

                {/* Cán bộ quản lý (CBQL) đánh giá */}
                <div className="col-span-1 md:col-span-2 border-t border-slate-200 pt-3 mt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-1">
                    <label htmlFor="select-vc-evaluator" className="font-bold text-amber-900 flex items-center gap-1.5 text-xs sm:text-sm">
                      <span>👑 Cán bộ quản lý (CBQL) đánh giá:</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    {eligibleEvaluatorsResult.explanation && (
                      <span className="text-[11px] text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 font-medium">
                        💡 {eligibleEvaluatorsResult.explanation}
                      </span>
                    )}
                  </div>

                  {!isReadOnly || canEditManager ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        id="select-vc-evaluator"
                        value={selectedEvaluatorId}
                        onChange={(e) => handleEvaluatorChange(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs sm:text-sm font-bold bg-amber-50/80 text-amber-950 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        {!selectedEvaluatorId && (
                          <option value="">-- Chọn Cán bộ quản lý đánh giá --</option>
                        )}
                        {recommendedEvaluators.length > 0 && (
                          <optgroup label="⭐ Người đánh giá đúng thẩm quyền (Theo quy định đối tượng & tổ chuyên môn)">
                            {recommendedEvaluators.map(ev => {
                              const pos = resolveVcTeacherPosition(ev, departments);
                              const dept = resolveVcTeacherDepartment(ev, departments);
                              return (
                                <option key={ev.id} value={ev.id}>
                                  {ev.name} — [{pos}] ({dept})
                                </option>
                              );
                            })}
                          </optgroup>
                        )}

                        {otherCbqlList.length > 0 && (
                          <optgroup label="📋 Danh sách Ban Giám hiệu & Cán bộ quản lý khác">
                            {otherCbqlList.map(ev => {
                              const pos = resolveVcTeacherPosition(ev, departments);
                              const dept = resolveVcTeacherDepartment(ev, departments);
                              return (
                                <option key={ev.id} value={ev.id}>
                                  {ev.name} — [{pos}] ({dept})
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </select>
                      {selectedEvaluator && (
                        <span className="px-3 py-2 bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold shrink-0 border border-amber-200">
                          {resolveVcTeacherPosition(selectedEvaluator, departments)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-950 text-xs sm:text-sm flex items-center justify-between">
                      <span>{selectedEvaluator?.name || form?.evaluatorName || leaderSignName || 'Chưa phân công CBQL'}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                        {selectedEvaluator ? resolveVcTeacherPosition(selectedEvaluator, departments) : (form?.evaluatorRole || 'CBQL')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. TIÊU ĐỀ PHẦN A. NỘI DUNG CHẤM ĐIỂM */}
            <div className="my-5">
              <h2 className="text-sm sm:text-base font-extrabold uppercase text-slate-900 tracking-wide">
                A. NỘI DUNG CHẤM ĐIỂM
              </h2>
            </div>

            {/* 5. BẢNG CHẤM ĐIỂM CHUẨN */}
            <div className="border border-slate-400 rounded-lg overflow-hidden mb-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200/90 text-slate-900 border-b border-slate-400 font-bold text-center">
                    <th className="p-2.5 border-r border-slate-400 w-12 sm:w-14">Stt</th>
                    <th className="p-2.5 border-r border-slate-400 text-left">Nội dung đánh giá</th>
                    <th className="p-2.5 border-r border-slate-400 w-20 sm:w-24">Điểm tối đa</th>
                    <th className="p-2.5 border-r border-slate-400 bg-blue-50/70 text-blue-950 font-extrabold w-32 sm:w-40">
                      Điểm cá nhân tự chấm
                    </th>
                    <th className="p-2.5 bg-amber-50/70 text-amber-950 font-extrabold w-36 sm:w-44">
                      Lãnh đạo (CBQL) đánh giá
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-300">
                  {/* LẶP QUA TỪNG NHÓM I, II, III */}
                  {activeGroups.map((group) => {
                    const groupCriteria = activeCriteria.filter(c => c.groupId === group.id);
                    const groupScore = groupScores[group.id] || 0;
                    const groupMgrScore = managerGroupScores[group.id] || 0;

                    return (
                      <React.Fragment key={group.id}>
                        {/* HÀNG TIÊU ĐỀ NHÓM */}
                        <tr className="bg-slate-100/95 font-extrabold text-slate-900 border-y border-slate-400">
                          <td className="p-2.5 text-center font-bold border-r border-slate-400 uppercase">
                            {group.code}
                          </td>
                          <td className="p-2.5 border-r border-slate-400 uppercase font-bold text-blue-950">
                            {group.name}
                          </td>
                          <td className="p-2.5 text-center border-r border-slate-400 font-bold text-slate-900">
                            {group.maxScore}
                          </td>
                          <td className="p-2.5 text-center border-r border-slate-400 bg-blue-50/50 font-extrabold text-blue-900">
                            {groupScore} / {group.maxScore}
                          </td>
                          <td className="p-2.5 text-center bg-amber-50/50 font-extrabold text-amber-900">
                            {hasAnyManagerScore || canEditManager ? `${groupMgrScore} / ${group.maxScore}` : '---'}
                          </td>
                        </tr>

                        {/* LẶP TIÊU CHÍ TRONG NHÓM */}
                        {groupCriteria.map((criterion, cIdx) => {
                          const itemScore = scoreItems.find(it => it.criterionId === criterion.id);
                          const currentScore = itemScore?.selfScore ?? criterion.maxScore;

                          // Tiêu chí dạng chọn mức (III.2)
                          if (criterion.scoreType === 'select_level') {
                            const levels = criterion.levels || [];

                            return (
                              <React.Fragment key={criterion.id}>
                                <tr className="hover:bg-slate-50/60 transition-colors">
                                  <td className="p-2.5 text-center font-semibold border-r border-slate-300 align-top">
                                    {criterion.code.includes('.') ? criterion.code.split('.')[1] : `${cIdx + 1}`}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-300 align-top" colSpan={2}>
                                    <div className="font-bold text-slate-900 mb-2">
                                      {criterion.content}
                                    </div>

                                    {/* 5 Mức chọn lựa */}
                                    <div className="space-y-2 mt-2">
                                      {levels.map(level => {
                                        const isSelected = itemScore?.selectedLevelCode === level.code || 
                                          (!itemScore?.selectedLevelCode && level.code === '2.1' && currentScore === 60);

                                        return (
                                          <label
                                            key={level.id}
                                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                              isSelected
                                                ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                                                : 'bg-white border-slate-200 hover:bg-slate-50'
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              name={`level_${criterion.id}`}
                                              disabled={isReadOnly}
                                              checked={isSelected}
                                              onChange={() => handleLevelSelect(criterion.id, level.code, level.name, level.score)}
                                              className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                                            />
                                            <div className="flex-1">
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="font-extrabold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded text-xs">
                                                  {level.name} (Tối đa {level.score} điểm)
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">
                                                  {level.score} điểm
                                                </span>
                                              </div>
                                              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                                                {level.description}
                                              </p>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </td>

                                  {/* Cột cá nhân tự chấm mức điểm */}
                                  <td className="p-2.5 text-center border-r border-slate-300 bg-blue-50/30 align-top font-extrabold text-blue-900">
                                    {currentScore} điểm
                                  </td>

                                  {/* Cột Lãnh đạo đánh giá */}
                                  <td className="p-2.5 text-center bg-amber-50/30 align-top">
                                    {canEditManager && !isReadOnly ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <input
                                          type="number"
                                          min={0}
                                          max={criterion.maxScore}
                                          step={0.5}
                                          value={itemScore?.managerScore ?? ''}
                                          placeholder={String(currentScore)}
                                          onChange={(e) => handleManagerScoreChange(criterion.id, e.target.value, criterion.maxScore)}
                                          className="w-20 px-2 py-1 text-center font-bold text-amber-900 bg-white border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-amber-700">
                                          (0 - {criterion.maxScore})
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="font-extrabold text-amber-900 text-sm">
                                        {itemScore?.managerScore !== undefined ? `${itemScore.managerScore} điểm` : '---'}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          }

                          // Tiêu chí thông thường (Nhập điểm)
                          return (
                            <tr key={criterion.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-2.5 text-center font-medium border-r border-slate-300 align-top">
                                {criterion.code.includes('.') ? criterion.code.split('.')[1] : `${cIdx + 1}`}
                              </td>

                              <td className="p-2.5 border-r border-slate-300 align-top leading-relaxed whitespace-pre-line text-slate-800">
                                {criterion.content}
                              </td>

                              <td className="p-2.5 text-center border-r border-slate-300 align-top font-semibold text-slate-700">
                                {criterion.maxScore}
                              </td>

                              <td className="p-2.5 text-center border-r border-slate-300 bg-blue-50/30 align-top">
                                {isReadOnly ? (
                                  <div className="font-extrabold text-blue-900 text-sm">
                                    {currentScore}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={criterion.maxScore}
                                      step={0.5}
                                      value={currentScore}
                                      onChange={(e) => handleScoreChange(criterion.id, e.target.value, criterion.maxScore)}
                                      className="w-20 px-2 py-1 text-center font-bold text-blue-900 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-slate-500">
                                      (0 - {criterion.maxScore})
                                    </span>
                                  </div>
                                )}
                              </td>

                              <td className="p-2.5 text-center bg-amber-50/30 align-top">
                                {canEditManager && !isReadOnly ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={criterion.maxScore}
                                      step={0.5}
                                      value={itemScore?.managerScore ?? ''}
                                      placeholder={String(currentScore)}
                                      onChange={(e) => handleManagerScoreChange(criterion.id, e.target.value, criterion.maxScore)}
                                      className="w-20 px-2 py-1 text-center font-bold text-amber-900 bg-white border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-amber-700">
                                      (0 - {criterion.maxScore})
                                    </span>
                                  </div>
                                ) : (
                                  <div className="font-extrabold text-amber-900 text-sm">
                                    {itemScore?.managerScore !== undefined ? itemScore.managerScore : '---'}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* TỔNG ĐIỂM TOÀN BẢNG */}
                  <tr className="bg-slate-200/90 font-black text-slate-900 border-t-2 border-slate-400">
                    <td className="p-3 text-center uppercase" colSpan={2}>
                      TỔNG ĐIỂM
                    </td>
                    <td className="p-3 text-center border-r border-slate-400 font-extrabold">
                      100
                    </td>
                    <td className="p-3 text-center border-r border-slate-400 bg-blue-100 text-blue-950 font-black text-base">
                      {totalScore}
                    </td>
                    <td className="p-3 text-center bg-amber-100 text-amber-950 font-black text-base">
                      {hasAnyManagerScore ? managerTotalScore : 'Chưa đánh giá'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* TỔNG KẾT & TỶ LỆ ĐÁNH GIÁ CBQL */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Tổng điểm tối đa</p>
                <p className="text-lg font-black text-slate-900">100 điểm</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-bold uppercase">Cá nhân tự chấm</p>
                <p className="text-lg font-black text-blue-900">{totalScore} điểm</p>
              </div>
              <div>
                <p className="text-xs text-amber-700 font-bold uppercase">CBQL đánh giá</p>
                <p className="text-lg font-black text-amber-900">{hasAnyManagerScore ? `${managerTotalScore} điểm` : 'Chưa đánh giá'}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700 font-bold uppercase">Tỷ lệ CBQL</p>
                <p className="text-lg font-black text-emerald-900">{hasAnyManagerScore ? `${ratio}%` : '---'}</p>
              </div>
            </div>

            {/* NHẬN XÉT CHUNG CỦA CBQL */}
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 mb-6 space-y-2">
              <label className="block font-extrabold text-amber-950 text-xs sm:text-sm uppercase tracking-wide">
                Nhận xét chung của CBQL (Ưu điểm, hạn chế, kết quả thực hiện, kiến nghị):
              </label>
              {canEditManager && !isReadOnly ? (
                <textarea
                  rows={3}
                  value={managerGeneralComment}
                  onChange={(e) => setManagerGeneralComment(e.target.value)}
                  placeholder="Nhập nhận xét chung của Cán bộ quản lý đối với viên chức trong kỳ đánh giá..."
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-900"
                />
              ) : (
                <p className="p-3 bg-white border border-amber-200 rounded-lg text-slate-800 italic text-xs sm:text-sm">
                  {managerGeneralComment || 'Chưa có nhận xét chung từ CBQL.'}
                </p>
              )}
            </div>

            {/* 6. PHẦN KẾT LUẬN & KÝ TÊN CÁ NHÂN */}
            <div className="space-y-6 pt-2">
              
              {/* Xếp loại */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="font-bold text-slate-800">Cá nhân tự xếp loại:</span>
                {isReadOnly ? (
                  <span className="font-extrabold text-blue-900 underline decoration-blue-500 underline-offset-4">
                    {selfClassification}
                  </span>
                ) : (
                  <select
                    value={selfClassification}
                    onChange={(e) => setSelfClassification(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-blue-900 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Hoàn thành xuất sắc nhiệm vụ">Hoàn thành xuất sắc nhiệm vụ (90 - 100 điểm)</option>
                    <option value="Hoàn thành tốt nhiệm vụ">Hoàn thành tốt nhiệm vụ (70 - 89.5 điểm)</option>
                    <option value="Hoàn thành nhiệm vụ">Hoàn thành nhiệm vụ (50 - 69.5 điểm)</option>
                    <option value="Không hoàn thành nhiệm vụ">Không hoàn thành nhiệm vụ (&lt; 50 điểm)</option>
                  </select>
                )}
              </div>

              {/* Ý kiến tự nhận xét thêm (nếu có) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">
                  Ý kiến tự nhận xét, kiến nghị (nếu có):
                </label>
                {isReadOnly ? (
                  <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic">
                    {selfComment || 'Không có ý kiến bổ sung.'}
                  </p>
                ) : (
                  <textarea
                    rows={2}
                    value={selfComment}
                    onChange={(e) => setSelfComment(e.target.value)}
                    placeholder="Ghi chú thêm về thành tích, kết quả nổi bật trong kỳ..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Chữ ký người tự chấm */}
              <div className="flex justify-end pt-2 text-center">
                <div className="w-64 space-y-1">
                  <p className="italic text-xs text-slate-700">
                    Sơn Lương, ngày {selfDate ? selfDate.split('/')[0] : '...'} tháng {selfDate ? selfDate.split('/')[1] : '...'} năm {selfDate ? selfDate.split('/')[2] : '...'}
                  </p>
                  <p className="font-bold uppercase text-slate-900">Người đánh giá</p>
                  <p className="text-[11px] italic text-slate-500">(Ký và ghi rõ họ tên)</p>
                  <div className="h-16 flex items-center justify-center">
                    <span className="text-slate-300 italic text-xs">[Đã xác nhận tự chấm]</span>
                  </div>
                  <p className="font-bold text-slate-900">
                    {form ? form.employeeName : (selectedTeacher?.name || 'Họ và tên')}
                  </p>
                </div>
              </div>

              {/* PHẦN B: B. Ý KIẾN NHẬN XÉT, ĐÁNH GIÁ (Phần dành cho người đứng đầu đơn vị) */}
              <div className="border-t-2 border-slate-300 pt-6 mt-8 space-y-4">
                <h3 className="font-extrabold uppercase text-slate-900 text-sm">
                  B. Ý KIẾN NHẬN XÉT, ĐÁNH GIÁ <span className="font-normal normal-case text-xs italic text-slate-600">(Phần dành cho người đứng đầu đơn vị)</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Mức xếp loại của Thủ trưởng:
                    </label>
                    {isAdmin || mode === 'leader_eval' ? (
                      <select
                        value={leaderClassification}
                        onChange={(e) => setLeaderClassification(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-blue-900 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Hoàn thành xuất sắc nhiệm vụ">Hoàn thành xuất sắc nhiệm vụ</option>
                        <option value="Hoàn thành tốt nhiệm vụ">Hoàn thành tốt nhiệm vụ</option>
                        <option value="Hoàn thành nhiệm vụ">Hoàn thành nhiệm vụ</option>
                        <option value="Không hoàn thành nhiệm vụ">Không hoàn thành nhiệm vụ</option>
                      </select>
                    ) : (
                      <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800">
                        {leaderClassification || 'Chờ Thủ trưởng đơn vị xếp loại'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nhận xét của Thủ trưởng:
                    </label>
                    {isAdmin || mode === 'leader_eval' ? (
                      <input
                        type="text"
                        value={leaderComment}
                        onChange={(e) => setLeaderComment(e.target.value)}
                        placeholder="Nhất trí với kết quả tự đánh giá / Lưu ý thêm..."
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    ) : (
                      <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 italic">
                        {leaderComment || 'Chưa có ý kiến nhận xét'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ký tên của người đứng đầu đơn vị */}
                <div className="flex justify-end pt-4 text-center">
                  <div className="w-72 space-y-1">
                    <p className="italic text-xs text-slate-700">
                      Sơn Lương, ngày {leaderDate ? leaderDate.split('/')[0] : '...'} tháng {leaderDate ? leaderDate.split('/')[1] : '...'} năm {leaderDate ? leaderDate.split('/')[2] : '...'}
                    </p>
                    <p className="font-extrabold uppercase text-slate-900">NGƯỜI NHẬN XÉT, ĐÁNH GIÁ</p>
                    <p className="text-[11px] italic text-slate-500">(Ký, ghi rõ họ tên; đóng dấu)</p>
                    <div className="h-16 flex items-center justify-center">
                      <span className="text-slate-300 italic text-xs">[Đóng dấu trường]</span>
                    </div>
                    <p className="font-bold text-slate-900">
                      {leaderSignName}
                    </p>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* MODAL FOOTER BUTTONS */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={() => {
                if (form && form.id) {
                  exportVcFormToWord(form);
                } else {
                  alert('Vui lòng lưu phiếu trước khi xuất Word.');
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <FileText size={15} /> Xuất Word (.doc)
            </button>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveForm('draft')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Save size={15} /> Lưu bản nháp
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveForm('completed')}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} /> Hoàn thành & Lưu phiếu
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
