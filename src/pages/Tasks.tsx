import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';
import TaskEvaluationModal from "../components/evaluations/TaskEvaluationModal";
import TaskEvaluationsHistory from "../components/evaluations/TaskEvaluationsHistory";
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { 
  Search, Plus, Filter, Calendar as CalendarIcon, Download, Printer, 
  CheckCircle, AlertCircle, Edit, Trash2, Eye, Play, Check, 
  MoreVertical, LayoutList, Users, Calculator, FlaskConical, 
  BookOpen, Briefcase, Building2, UserCheck, ChevronRight,
  ArrowRight, ShieldCheck, CheckSquare, Sparkles, Edit3, AlertTriangle, Clock
} from 'lucide-react';
import { WorkAssignment, Teacher, TaskEvaluation, Department, ExecutionResult } from '../types';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { safeFormatLocale, safeParseDate } from '../utils/dateUtils';
import BackButton from '../components/ui/BackButton';

const WEEKS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Cả tuần', 'Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'];

export interface DepartmentConfig {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  groupToken: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
  subjects: string[];
  color: {
    border: string;
    bg: string;
    badge: string;
    text: string;
    activeTab: string;
    light: string;
    ring: string;
  };
}

export const PRESET_DEPARTMENTS: DepartmentConfig[] = [
  {
    id: 'd_toan_ly_tin_cn',
    slug: 'toan-ly-tin-cn',
    name: 'Tổ Toán-Lý-Tin-CN',
    shortName: 'Toán-Lý-Tin-CN',
    groupToken: 'GROUP_TOAN_LY_TIN_CN',
    icon: Calculator,
    description: 'Chuyên môn bộ môn Toán, Vật lý, Tin học và Công nghệ',
    subjects: ['Toán', 'Vật lý', 'Tin học', 'Công nghệ'],
    color: {
      border: 'border-blue-200',
      bg: 'bg-blue-600',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      text: 'text-blue-700',
      activeTab: 'bg-blue-600 text-white shadow-md shadow-blue-500/20',
      light: 'bg-blue-50/70',
      ring: 'focus:ring-blue-500 focus:border-blue-500'
    }
  },
  {
    id: 'd_hoa_ly_sinh_gdqpan_nn',
    slug: 'hoa-ly-sinh-gdqpan-nn',
    name: 'Tổ Hóa-Lý-Sinh-GDQPAN-NN',
    shortName: 'Hóa-Lý-Sinh-GDQPAN-NN',
    groupToken: 'GROUP_HOA_LY_SINH_GDQPAN_NN',
    icon: FlaskConical,
    description: 'Chuyên môn bộ môn Hóa học, Sinh học, GDQP-AN, Ngoại ngữ (Tiếng Anh) & Thể dục',
    subjects: ['Hóa học', 'Sinh học', 'GDQP-AN', 'Tiếng Anh', 'Ngoại ngữ', 'Thể dục'],
    color: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-600',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      text: 'text-emerald-700',
      activeTab: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20',
      light: 'bg-emerald-50/70',
      ring: 'focus:ring-emerald-500 focus:border-emerald-500'
    }
  },
  {
    id: 'd_van_su_dia_gdkt_pl_an',
    slug: 'van-su-dia-gdkt-pl-an',
    name: 'Tổ Văn-Sử-Địa-GDKT&PL-AN',
    shortName: 'Văn-Sử-Địa-GDKT&PL-AN',
    groupToken: 'GROUP_VAN_SU_DIA_GDKT_PL_AN',
    icon: BookOpen,
    description: 'Chuyên môn bộ môn Ngữ văn, Lịch sử, Địa lí, GDKT&PL và Âm nhạc / Nghệ thuật',
    subjects: ['Ngữ văn', 'Lịch sử', 'Địa lí', 'GDKT&PL', 'Âm nhạc', 'Mĩ thuật', 'GDCD'],
    color: {
      border: 'border-amber-200',
      bg: 'bg-amber-600',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      text: 'text-amber-800',
      activeTab: 'bg-amber-600 text-white shadow-md shadow-amber-500/20',
      light: 'bg-amber-50/70',
      ring: 'focus:ring-amber-500 focus:border-amber-500'
    }
  },
  {
    id: 'd_van_phong',
    slug: 'van-phong',
    name: 'Tổ Văn phòng',
    shortName: 'Văn phòng',
    groupToken: 'GROUP_VAN_PHONG',
    icon: Briefcase,
    description: 'Bộ phận Văn thư, Kế toán, Thủ quỹ, Y tế, Thư viện và Thiết bị trường học',
    subjects: ['Văn thư', 'Kế toán', 'Thủ quỹ', 'Y tế', 'Thư viện', 'Thiết bị', 'Hành chính'],
    color: {
      border: 'border-purple-200',
      bg: 'bg-purple-600',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      text: 'text-purple-700',
      activeTab: 'bg-purple-600 text-white shadow-md shadow-purple-500/20',
      light: 'bg-purple-50/70',
      ring: 'focus:ring-purple-500 focus:border-purple-500'
    }
  }
];

export default function Tasks() {
  const { deptSlug: urlDeptSlug } = useParams<{ deptSlug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { workAssignments, teachers, departments, addWorkAssignment, updateWorkAssignment, deleteWorkAssignment } = useAppContext();
  const { user } = useAuth();
  
  // Selected department tab: 'all' | 'toan-ly-tin-cn' | 'hoa-ly-sinh-gdqpan-nn' | 'van-su-dia-gdkt-pl-an' | 'van-phong'
  const [activeTab, setActiveTab] = useState<string>('all');
  const [mainView, setMainView] = useState<'list' | 'history'>('list');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<WorkAssignment | null>(null);
  const [evaluatingAssignment, setEvaluatingAssignment] = useState<WorkAssignment | null>(null);
  const [evaluatingAssigneeId, setEvaluatingAssigneeId] = useState<string | undefined>(undefined);

  // Form Data
  const [formData, setFormData] = useState<Partial<WorkAssignment>>({
    departmentId: 'global',
    weekLabel: 'Thứ 2',
    workDate: new Date().toISOString().split('T')[0],
    deadline: new Date().toISOString().split('T')[0],
    status: 'Chưa thực hiện',
    assigneeIds: [],
    assigneeId: '', 
    note: '',
    completedAssigneeIds: [],
    overdueAssigneeIds: [],
    incompleteAssigneeIds: []
  });

  const [showCrossDeptTeachers, setShowCrossDeptTeachers] = useState(false);

  // Evaluation state
  const [evaluationsMap, setEvaluationsMap] = useState<Record<string, TaskEvaluation>>({});
  const [, setSelectedAssigneeForEval] = useState<string>('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [expandedAssignmentIds, setExpandedAssignmentIds] = useState<Record<string, boolean>>({});

  // Sync tab with URL
  useEffect(() => {
    const slug = urlDeptSlug || searchParams.get('dept');
    if (slug) {
      const matched = PRESET_DEPARTMENTS.find(d => 
        d.slug === slug || 
        d.id === slug || 
        (slug.includes('toan') && d.slug === 'toan-ly-tin-cn') ||
        (slug.includes('hoa') && d.slug === 'hoa-ly-sinh-gdqpan-nn') ||
        (slug.includes('van-su') && d.slug === 'van-su-dia-gdkt-pl-an') ||
        (slug.includes('phong') && d.slug === 'van-phong')
      );
      if (matched) {
        setActiveTab(matched.slug);
      }
    }
  }, [urlDeptSlug, searchParams]);

  // Permissions
  const isAdmin = user?.role === 'BGH';
  const isHead = user?.role === 'TTCM';
  const canManageTasks = isAdmin || isHead;

  // --- HELPER FUNCTIONS (declared as hoisted functions before any hooks or callbacks to prevent Temporal Dead Zone errors) ---
  function findDeptConfig(deptIdOrNameOrSlug?: string): DepartmentConfig | undefined {
    if (!deptIdOrNameOrSlug) return undefined;
    const lower = deptIdOrNameOrSlug.toLowerCase();
    return PRESET_DEPARTMENTS.find(d => 
      d.id === deptIdOrNameOrSlug ||
      d.slug === deptIdOrNameOrSlug ||
      d.name.toLowerCase() === lower ||
      (lower.includes('toán') || lower.includes('toan') || lower.includes('lý') || lower.includes('tin') || lower.includes('cn')) && d.slug === 'toan-ly-tin-cn' ||
      (lower.includes('hóa') || lower.includes('hoa') || lower.includes('sinh') || lower.includes('gdqpan') || lower.includes('nn')) && d.slug === 'hoa-ly-sinh-gdqpan-nn' ||
      (lower.includes('văn') || lower.includes('van') || lower.includes('sử') || lower.includes('su') || lower.includes('địa') || lower.includes('dia') || lower.includes('gdkt')) && d.slug === 'van-su-dia-gdkt-pl-an' ||
      (lower.includes('văn phòng') || lower.includes('van phong') || lower.includes('hành chính') || lower.includes('phòng')) && d.slug === 'van-phong'
    );
  }

  function isTeacherInDept(teacher: Teacher, deptConfig: DepartmentConfig): boolean {
    if (teacher.departmentId === deptConfig.id) return true;
    const actualDept = departments.find(d => d.id === teacher.departmentId);
    if (actualDept && findDeptConfig(actualDept.name)?.slug === deptConfig.slug) return true;
    if (teacher.departmentName && findDeptConfig(teacher.departmentName)?.slug === deptConfig.slug) return true;
    if (teacher.subject) {
      const s = teacher.subject.toLowerCase();
      return deptConfig.subjects.some(sub => s.includes(sub.toLowerCase()));
    }
    return false;
  }

  function isDeptSpecificTask(wa: WorkAssignment): boolean {
    // 1. Explicit scope
    if (wa.scope === 'department') return true;
    if (wa.scope === 'school') return false;

    // 2. Explicit departmentId pointing to a department (not global / all / empty)
    if (wa.departmentId && wa.departmentId !== 'global' && wa.departmentId !== 'all') {
      return true;
    }

    // 3. Assigned specifically to a department group token (e.g. GROUP_TOAN_LY_TIN_CN)
    if (wa.assigneeIds && PRESET_DEPARTMENTS.some(d => wa.assigneeIds?.includes(d.groupToken))) {
      return true;
    }

    return false;
  }

  function isSchoolWideTask(wa: WorkAssignment): boolean {
    return !isDeptSpecificTask(wa);
  }

  function isAssignmentInDept(wa: WorkAssignment, deptConfig: DepartmentConfig): boolean {
    // If wa is explicitly assigned to a DIFFERENT department, do not match this department
    if (wa.departmentId && wa.departmentId !== 'global' && wa.departmentId !== 'all') {
      if (wa.departmentId === deptConfig.id) return true;
      const deptObj = departments.find(d => d.id === wa.departmentId);
      if (deptObj && findDeptConfig(deptObj.name)?.slug === deptConfig.slug) return true;
      
      const otherDept = PRESET_DEPARTMENTS.find(d => d.id === wa.departmentId);
      if (otherDept && otherDept.slug !== deptConfig.slug) {
        return false;
      }
    }

    // 1. Direct departmentId match
    if (wa.departmentId === deptConfig.id) return true;
    const deptObj = departments.find(d => d.id === wa.departmentId);
    if (deptObj && findDeptConfig(deptObj.name)?.slug === deptConfig.slug) return true;

    // 2. Group token match
    if (wa.assigneeIds?.includes(deptConfig.groupToken)) return true;

    // 3. For tasks scoped to department (or without direct matching ID), check member assignments
    if (isDeptSpecificTask(wa)) {
      const assignedIds = wa.assigneeIds && wa.assigneeIds.length > 0 ? wa.assigneeIds : (wa.assigneeId ? [wa.assigneeId] : []);
      const hasMember = assignedIds.some(aid => {
        const t = teachers.find(teach => teach.id === aid);
        return t && isTeacherInDept(t, deptConfig);
      });
      if (hasMember) return true;

      // 4. Content keyword match if it is a department task
      if (wa.content.toLowerCase().includes(deptConfig.shortName.toLowerCase())) return true;
    }

    return false;
  }

  // Helper to resolve actual assigned teachers for an assignment (supports individual IDs and group tokens)
  function getResolvedAssigneeTeachers(assignment: WorkAssignment): Teacher[] {
    const ids = assignment.assigneeIds && assignment.assigneeIds.length > 0 
      ? assignment.assigneeIds 
      : (assignment.assigneeId ? [assignment.assigneeId] : []);
    
    if (ids.length === 0) return [];
    
    if (ids.includes('GROUP_ALL')) {
      return teachers;
    }
    if (ids.includes('GROUP_GVCN')) {
      return teachers.filter(t => t.isHomeroom || (t.position || '').toLowerCase().includes('gvcn') || (t.position || '').toLowerCase().includes('chủ nhiệm'));
    }
    
    for (const dept of PRESET_DEPARTMENTS) {
      if (ids.includes(dept.groupToken)) {
        return teachers.filter(t => isTeacherInDept(t, dept));
      }
    }
    
    return teachers.filter(t => ids.includes(t.id));
  }

  function isUserAnAssignee(assignment: WorkAssignment, userId?: string): boolean {
    if (!userId) return false;
    const assignedTeachers = getResolvedAssigneeTeachers(assignment);
    return assignedTeachers.some(t => t.id === userId);
  }

  function checkIsPastDeadline(deadlineStr: string): boolean {
    const d = safeParseDate(deadlineStr);
    if (!d) return false;
    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);
    return new Date().getTime() > endOfDay.getTime();
  }

  function canEvaluateTask(assignment: WorkAssignment): boolean {
    return Boolean(canManageTasks || user?.id === assignment.evaluatorId || user?.id === assignment.createdBy);
  }

  function renderResultBadge(res?: string) {
    if (res === 'Hoàn thành tốt') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          ✓ Hoàn thành tốt
        </span>
      );
    }
    if (res === 'Quá hạn (Chậm muộn)') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
          ⚠ Quá hạn (Chậm muộn)
        </span>
      );
    }
    return null;
  }

  // Lấy danh sách các CBGVNV THỰC SỰ ĐÃ CÓ BẢN GHI ĐÁNH GIÁ ĐÃ LƯU TRONG DATABASE
  function getEvaluatedAssignees(assignment: WorkAssignment): { id: string; name: string; result: ExecutionResult }[] {
    const list: { id: string; name: string; result: ExecutionResult }[] = [];
    const results = assignment.assigneeResults || {};

    // 1. Duyệt qua assigneeResults đã lưu
    Object.entries(results).forEach(([tId, res]) => {
      if (res === 'Hoàn thành tốt' || res === 'Quá hạn (Chậm muộn)') {
        const t = teachers.find(teach => teach.id === tId);
        list.push({
          id: tId,
          name: t ? t.name : (getTeacherName(tId) || 'CBGVNV'),
          result: res
        });
      }
    });

    // 2. Fallback nếu có evaluations
    if (list.length === 0 && assignment.evaluations) {
      Object.entries(assignment.evaluations).forEach(([tId, ev]) => {
        const rawRes = ev?.result as string | undefined;
        let mappedRes: ExecutionResult | null = null;
        if (rawRes === 'Hoàn thành tốt' || rawRes === 'Hoàn thành') {
          mappedRes = 'Hoàn thành tốt';
        } else if (rawRes === 'Quá hạn (Chậm muộn)' || rawRes === 'Chậm/muộn') {
          mappedRes = 'Quá hạn (Chậm muộn)';
        }

        if (mappedRes) {
          const t = teachers.find(teach => teach.id === tId);
          list.push({
            id: tId,
            name: t ? t.name : (getTeacherName(tId) || 'CBGVNV'),
            result: mappedRes
          });
        }
      });
    }

    return list;
  }

  function getTeacherNames(assignment: WorkAssignment): string {
    const ids = assignment.assigneeIds && assignment.assigneeIds.length > 0 
      ? assignment.assigneeIds 
      : (assignment.assigneeId ? [assignment.assigneeId] : []);
    
    if (ids.length === 0) return 'Không xác định';
    
    const names = ids.map(id => {
      if (id === 'GROUP_ALL') return 'Toàn thể CBGVNV';
      if (id === 'GROUP_GVCN') return 'Giáo viên chủ nhiệm (GVCN)';
      const deptConf = PRESET_DEPARTMENTS.find(d => d.groupToken === id);
      if (deptConf) return `Toàn bộ ${deptConf.name}`;
      const t = teachers.find(t => t.id === id);
      return t ? t.name : 'CBGVNV';
    });

    return names.join(', ');
  }

  function getTeacherName(id?: string): string {
    if (!id) return '';
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) return '';
    return teacher.name;
  }

  function getAssignmentDepartment(assignment: WorkAssignment): DepartmentConfig | null {
    if (isSchoolWideTask(assignment)) return null;
    for (const d of PRESET_DEPARTMENTS) {
      if (isAssignmentInDept(assignment, d)) {
        return d;
      }
    }
    return null;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'Đã đánh giá': return 'purple';
      case 'Đã hoàn thành': return 'success';
      case 'Đang thực hiện': return 'info';
      case 'Chưa thực hiện': return 'default';
      case 'Quá hạn': return 'danger';
      default: return 'default';
    }
  }

  function openEvalModal(assignment: WorkAssignment, specificAssigneeId?: string): void {
    setActiveMenu(null);
    setEvaluatingAssignment(assignment);
    setEvaluatingAssigneeId(specificAssigneeId);
    setIsEvalModalOpen(true);
  }

  function openResultModal(assignment: WorkAssignment, assigneeId: string): void {
    openEvalModal(assignment, assigneeId);
  }

  // Department config for logged-in TTCM or teacher
  const userDeptConfig = useMemo(() => {
    if (user?.departmentId) {
      const conf = findDeptConfig(user.departmentId);
      if (conf) return conf;
    }
    const userTeacher = teachers.find(t => t.id === user?.id);
    if (userTeacher) {
      if (userTeacher.departmentId) {
        const conf = findDeptConfig(userTeacher.departmentId);
        if (conf) return conf;
      }
      const found = PRESET_DEPARTMENTS.find(d => isTeacherInDept(userTeacher, d));
      if (found) return found;
    }
    const deptLeading = departments.find(d => d.headId === user?.id);
    if (deptLeading) {
      return findDeptConfig(deptLeading.id) || findDeptConfig(deptLeading.name);
    }
    return undefined;
  }, [user, teachers, departments]);

  // Current active department config (if in a department tab)
  const activeDeptConfig = useMemo(() => {
    if (activeTab === 'all') return null;
    return PRESET_DEPARTMENTS.find(d => d.slug === activeTab) || null;
  }, [activeTab]);

  // Current active department entity
  const activeDeptEntity = useMemo(() => {
    if (!activeDeptConfig) return null;
    return departments.find(d => d.id === activeDeptConfig.id || findDeptConfig(d.name)?.slug === activeDeptConfig.slug) || null;
  }, [activeDeptConfig, departments]);

  // Teachers in active department
  const activeDeptTeachers = useMemo(() => {
    if (!activeDeptConfig) return [];
    return teachers.filter(t => isTeacherInDept(t, activeDeptConfig));
  }, [activeDeptConfig, teachers]);

  // Department Head
  const activeDeptHead = useMemo(() => {
    if (!activeDeptConfig) return null;
    if (activeDeptEntity?.headId) {
      const head = teachers.find(t => t.id === activeDeptEntity.headId);
      if (head) return head;
    }
    // Fallback: check position or role
    return activeDeptTeachers.find(t => 
      (t.role || '').includes('TTCM') || 
      (t.position || '').toLowerCase().includes('tổ trưởng') ||
      (t.position || '').toLowerCase().includes('to truong')
    ) || activeDeptTeachers[0] || null;
  }, [activeDeptConfig, activeDeptEntity, activeDeptTeachers, teachers]);

  // Visible assignments based on role & department tab
  const visibleAssignments = useMemo(() => {
    let list = workAssignments;
    
    // If not BGH, limit visibility according to user role
    if (!isAdmin) {
      if (isHead) {
        // TTCM can see:
        // 1. School-wide tasks (Chung toàn trường)
        // 2. Tasks of their own department
        // 3. Tasks where they are an assignee, creator, or evaluator
        const userDeptId = userDeptConfig?.id || user?.departmentId;
        list = list.filter(wa => 
          isSchoolWideTask(wa) ||
          wa.departmentId === userDeptId || 
          wa.evaluatorId === user?.id ||
          wa.createdBy === user?.id ||
          wa.assigneeId === user?.id || 
          (wa.assigneeIds && wa.assigneeIds.includes(user?.id || '')) ||
          (userDeptConfig && isAssignmentInDept(wa, userDeptConfig))
        );
      } else {
        // Regular teacher can see:
        // 1. School-wide tasks (Chung toàn trường)
        // 2. Tasks where they are assigned directly or via group
        const userTeacher = teachers.find(t => t.id === user?.id);
        const userDept = userTeacher ? PRESET_DEPARTMENTS.find(d => isTeacherInDept(userTeacher, d)) : null;

        list = list.filter(wa => 
          isSchoolWideTask(wa) ||
          wa.assigneeId === user?.id || 
          (wa.assigneeIds && wa.assigneeIds.includes(user?.id || '')) ||
          wa.assigneeIds?.includes('GROUP_ALL') ||
          (userTeacher?.isHomeroom && wa.assigneeIds?.includes('GROUP_GVCN')) ||
          (userDept && wa.assigneeIds?.includes(userDept.groupToken))
        );
      }
    }

    // Filter strictly by active tab:
    // When on "Chung toàn trường" tab ('all'): ONLY show school-wide tasks!
    // Department-assigned tasks MUST NOT appear in "Chung toàn trường".
    if (activeTab === 'all') {
      list = list.filter(wa => isSchoolWideTask(wa));
    } else if (activeDeptConfig) {
      // When on a department tab: ONLY show tasks belonging to this department!
      list = list.filter(wa => isAssignmentInDept(wa, activeDeptConfig));
    }

    // Sort by workDate ascending, then by createdAt
    return [...list].sort((a, b) => {
      if (a.workDate === b.workDate) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return new Date(a.workDate).getTime() - new Date(b.workDate).getTime();
    });
  }, [workAssignments, isAdmin, isHead, user, activeTab, activeDeptConfig, userDeptConfig, teachers, departments]);

  // Filtered assignments based on search & filters
  const filteredAssignments = useMemo(() => {
    return visibleAssignments.filter(wa => {
      const matchSearch = wa.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (wa.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          getTeacherNames(wa).toLowerCase().includes(searchTerm.toLowerCase());
      const matchWeek = filterWeek ? wa.weekLabel === filterWeek : true;
      
      let matchStatus = true;
      if (filterStatus) {
        const assignedTeachers = getResolvedAssigneeTeachers(wa);
        if (filterStatus === 'Chưa đánh giá' || filterStatus === 'Chưa cập nhật') {
          if (filterAssignee) {
            matchStatus = !wa.assigneeResults?.[filterAssignee];
          } else {
            matchStatus = assignedTeachers.length === 0 || assignedTeachers.some(t => !wa.assigneeResults?.[t.id]);
          }
        } else {
          if (filterAssignee) {
            matchStatus = wa.assigneeResults?.[filterAssignee] === filterStatus;
          } else {
            matchStatus = Object.values(wa.assigneeResults || {}).includes(filterStatus as ExecutionResult);
          }
        }
      }
      
      let matchAssignee = true;
      if (filterAssignee) {
        if (wa.assigneeIds && wa.assigneeIds.length > 0) {
          matchAssignee = wa.assigneeIds.includes(filterAssignee);
        } else {
          matchAssignee = wa.assigneeId === filterAssignee;
        }
      }

      let matchTarget = true;
      if (activeTab === 'all' && filterDepartment !== 'all') {
        if (filterDepartment === 'group_all') {
          matchTarget = wa.assigneeIds?.includes('GROUP_ALL') || false;
        } else if (filterDepartment === 'group_gvcn') {
          matchTarget = wa.assigneeIds?.includes('GROUP_GVCN') || false;
        }
      }
      
      return matchSearch && matchWeek && matchStatus && matchAssignee && matchTarget;
    });
  }, [visibleAssignments, searchTerm, filterWeek, filterStatus, filterAssignee, activeTab, filterDepartment]);

  // Summary Statistics for Execution Results (Requirement 8)
  const summaryStats = useMemo(() => {
    let totalAssigneeCount = 0;
    let evaluatedCount = 0;
    let goodCount = 0;
    let overdueCount = 0;

    filteredAssignments.forEach(wa => {
      const assignedTeachers = getResolvedAssigneeTeachers(wa);
      if (assignedTeachers.length === 0) {
        totalAssigneeCount += 1;
        const res = wa.assigneeId ? wa.assigneeResults?.[wa.assigneeId] : undefined;
        if (res === 'Hoàn thành tốt') {
          evaluatedCount += 1;
          goodCount += 1;
        } else if (res === 'Quá hạn (Chậm muộn)') {
          evaluatedCount += 1;
          overdueCount += 1;
        }
      } else {
        assignedTeachers.forEach(t => {
          totalAssigneeCount += 1;
          const res = wa.assigneeResults?.[t.id];
          if (res === 'Hoàn thành tốt') {
            evaluatedCount += 1;
            goodCount += 1;
          } else if (res === 'Quá hạn (Chậm muộn)') {
            evaluatedCount += 1;
            overdueCount += 1;
          }
        });
      }
    });

    const notEvaluatedCount = Math.max(0, totalAssigneeCount - evaluatedCount);

    return {
      total: totalAssigneeCount,
      evaluated: evaluatedCount,
      notEvaluated: notEvaluatedCount,
      good: goodCount,
      overdue: overdueCount,
    };
  }, [filteredAssignments, teachers]);

  // Department Statistics for active department
  const deptStats = useMemo(() => {
    const total = visibleAssignments.length;
    const completed = visibleAssignments.filter(w => {
      if (w.assigneeResults && Object.values(w.assigneeResults).some(r => r === 'Hoàn thành tốt' || r === 'Quá hạn (Chậm muộn)')) {
        return true;
      }
      return w.status === 'Đã hoàn thành' || w.status === 'Đã đánh giá';
    }).length;
    const inProgress = visibleAssignments.filter(w => w.status === 'Đang thực hiện').length;
    const notStarted = visibleAssignments.filter(w => w.status === 'Chưa thực hiện').length;
    const overdue = visibleAssignments.filter(w => {
      if (w.assigneeResults && Object.values(w.assigneeResults).includes('Quá hạn (Chậm muộn)')) {
        return true;
      }
      const d = safeParseDate(w.deadline);
      return d ? d < new Date() && w.status !== 'Đã hoàn thành' && w.status !== 'Đã đánh giá' : false;
    }).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, notStarted, overdue, rate };
  }, [visibleAssignments]);

  // Overall counts for tabs
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { 
      all: workAssignments.filter(wa => isSchoolWideTask(wa)).length 
    };
    PRESET_DEPARTMENTS.forEach(dept => {
      counts[dept.slug] = workAssignments.filter(wa => isAssignmentInDept(wa, dept)).length;
    });
    return counts;
  }, [workAssignments, teachers, departments]);

  // Export to Excel
  const handleExportExcel = () => {
    const titleHeader = activeDeptConfig 
      ? `LỊCH GIAO VIỆC - ${activeDeptConfig.name.toUpperCase()}`
      : 'LỊCH GIAO VIỆC CHUNG TOÀN TRƯỜNG';

    const data = filteredAssignments.map(wa => {
      const dept = getAssignmentDepartment(wa);
      const evaluatedList = getEvaluatedAssignees(wa);
      const executionResultText = evaluatedList.length === 0 
        ? '' 
        : evaluatedList.map(item => `${item.name}: ${item.result}`).join('; ');

      return {
        'Thứ/Tuần': wa.weekLabel,
        'Ngày giao': safeFormatLocale(wa.workDate, 'toLocaleDateString', 'Chưa cập nhật'),
        'Tổ / Đơn vị': dept ? dept.shortName : 'Toàn trường',
        'Nội dung công việc': wa.content,
        'Người thực hiện': getTeacherNames(wa),
        'Thời hạn hoàn thành': safeFormatLocale(wa.deadline, 'toLocaleDateString', 'Chưa cập nhật'),
        'Người đánh giá': getTeacherName(wa.evaluatorId),
        'Kết quả thực hiện': executionResultText,
        'Ghi chú': wa.note || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const sheetName = activeDeptConfig ? activeDeptConfig.shortName.replace(/[^a-zA-Z0-9]/g, '_') : 'Giao_viec_Chung';
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 30));
    
    const fileName = activeDeptConfig
      ? `Lich_giao_viec_${sheetName}_Tuan_${filterWeek || 'Tat_ca'}.xlsx`
      : `Lich_giao_viec_Toan_Truong_Tuan_${filterWeek || 'Tat_ca'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  // Open Create Modal (prefilled for current department if in department tab or if user is TTCM)
  const openCreateModal = (specificDeptSlug?: string) => {
    setEditingAssignment(null);
    setShowCrossDeptTeachers(false);

    // If user is TTCM, prioritize their own department
    let targetDeptSlug = specificDeptSlug || (activeTab !== 'all' ? activeTab : 'all');
    if (isHead && !isAdmin && userDeptConfig) {
      targetDeptSlug = userDeptConfig.slug;
    }
    const targetDeptConfig = PRESET_DEPARTMENTS.find(d => d.slug === targetDeptSlug);

    // Default evaluator: Dept head if available, otherwise current user or BGH
    let defaultEvaluator = user?.id || '';
    if (targetDeptConfig) {
      const deptTeachers = teachers.filter(t => isTeacherInDept(t, targetDeptConfig));
      const head = deptTeachers.find(t => 
        (t.role || '').includes('TTCM') || 
        (t.position || '').toLowerCase().includes('tổ trưởng') ||
        (t.position || '').toLowerCase().includes('to truong')
      );
      if (head) {
        defaultEvaluator = head.id;
      }
    }

    const defaultDeptId = targetDeptConfig 
      ? targetDeptConfig.id 
      : (isHead && userDeptConfig ? userDeptConfig.id : 'global');

    setFormData({
      departmentId: defaultDeptId,
      scope: defaultDeptId === 'global' ? 'school' : 'department',
      weekLabel: filterWeek || 'Thứ 2',
      workDate: new Date().toISOString().split('T')[0],
      deadline: new Date().toISOString().split('T')[0],
      status: 'Chưa thực hiện',
      assigneeIds: [],
      assigneeId: '',
      evaluatorId: defaultEvaluator,
      note: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (assignment: WorkAssignment) => {
    setEditingAssignment(assignment);
    setActiveMenu(null);
    setShowCrossDeptTeachers(false);
    setFormData({
      departmentId: assignment.departmentId || 'global',
      scope: assignment.scope || ((assignment.departmentId && assignment.departmentId !== 'global' && assignment.departmentId !== 'all') ? 'department' : 'school'),
      weekLabel: assignment.weekLabel,
      workDate: assignment.workDate,
      content: assignment.content,
      assigneeIds: assignment.assigneeIds || (assignment.assigneeId ? [assignment.assigneeId] : []),
      deadline: assignment.deadline,
      evaluatorId: assignment.evaluatorId,
      status: assignment.status,
      note: assignment.note || '',
      completedAssigneeIds: assignment.completedAssigneeIds || [],
      overdueAssigneeIds: assignment.overdueAssigneeIds || [],
      incompleteAssigneeIds: assignment.incompleteAssigneeIds || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setActiveMenu(null);
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteWorkAssignment(deletingId);
      setDeletingId(null);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content || !formData.evaluatorId) {
      alert('Vui lòng nhập đầy đủ Nội dung công việc và Người đánh giá.');
      return;
    }
    
    if (!formData.assigneeIds || formData.assigneeIds.length === 0) {
      alert('Vui lòng chọn ít nhất một Người thực hiện hoặc chọn Cả tổ.');
      return;
    }

    if (new Date(formData.deadline!) < new Date(formData.workDate!)) {
      alert('Thời hạn hoàn thành không được trước ngày giao việc.');
      return;
    }

    // Set first assignee as fallback
    const fallbackAssigneeId = formData.assigneeIds[0];
    const isDeptScope = formData.departmentId && formData.departmentId !== 'global' && formData.departmentId !== 'all';
    const scope = isDeptScope ? 'department' : 'school';

    if (editingAssignment) {
      updateWorkAssignment(editingAssignment.id, {
        ...formData,
        departmentId: formData.departmentId || 'global',
        scope,
        assigneeId: fallbackAssigneeId,
        updatedAt: new Date().toISOString(),
      });
    } else {
      addWorkAssignment({
        id: `wa_${Date.now()}`,
        departmentId: formData.departmentId || 'global',
        scope,
        weekLabel: formData.weekLabel!,
        workDate: formData.workDate!,
        content: formData.content!,
        assigneeIds: formData.assigneeIds,
        assigneeId: fallbackAssigneeId,
        deadline: formData.deadline!,
        evaluatorId: formData.evaluatorId!,
        status: formData.status! as any,
        note: formData.note,
        createdBy: user?.id || 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setIsModalOpen(false);
  };

  const handleUpdateStatus = (id: string, newStatus: string) => {
    setActiveMenu(null);
    updateWorkAssignment(id, {
      status: newStatus as any,
      completionDate: newStatus === 'Đã hoàn thành' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  // Toggle multi-select assignee
  const toggleAssignee = (id: string) => {
    const currentIds = formData.assigneeIds || [];
    if (currentIds.includes(id)) {
      setFormData({ ...formData, assigneeIds: currentIds.filter(x => x !== id) });
    } else {
      setFormData({ ...formData, assigneeIds: [...currentIds, id] });
    }
  };

  // Quick select all teachers in selected department
  const selectAllDeptTeachers = (deptConfig: DepartmentConfig) => {
    const deptTeachers = teachers.filter(t => isTeacherInDept(t, deptConfig));
    const deptIds = deptTeachers.map(t => t.id);
    // Combine with group token
    const uniqueIds = Array.from(new Set([...(formData.assigneeIds || []), ...deptIds]));
    setFormData({ ...formData, assigneeIds: uniqueIds });
  };

  // Quick deselect all teachers in selected department
  const deselectDeptTeachers = (deptConfig: DepartmentConfig) => {
    const deptTeachers = teachers.filter(t => isTeacherInDept(t, deptConfig));
    const deptIds = deptTeachers.map(t => t.id);
    const filtered = (formData.assigneeIds || []).filter(id => !deptIds.includes(id) && id !== deptConfig.groupToken);
    setFormData({ ...formData, assigneeIds: filtered });
  };

  // Current department in form modal
  const formDeptConfig = useMemo(() => {
    if (!formData.departmentId || formData.departmentId === 'global') return null;
    return PRESET_DEPARTMENTS.find(d => d.id === formData.departmentId) || null;
  }, [formData.departmentId]);

  // Teachers for the modal based on selected department
  const formDeptTeachers = useMemo(() => {
    if (!formDeptConfig) return teachers;
    return teachers.filter(t => isTeacherInDept(t, formDeptConfig));
  }, [formDeptConfig, teachers]);

  const otherDeptTeachers = useMemo(() => {
    if (!formDeptConfig) return [];
    return teachers.filter(t => !isTeacherInDept(t, formDeptConfig));
  }, [formDeptConfig, teachers]);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6 pb-12 font-sans">
      <div className="flex items-center no-print">
        <BackButton />
      </div>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #print-area, #print-area * {
              visibility: visible;
            }
            #print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
          }
          .print-only {
            display: none;
          }
        `}
      </style>

      {/* HEADER SECTION */}
      <div className="space-y-4 no-print">
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-[20px] border border-white/40 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <LayoutList className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-wide">
                  Quản lý Giao việc
                </h1>
                {activeDeptConfig && (
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", activeDeptConfig.color.badge)}>
                    {activeDeptConfig.shortName}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                Phân công công việc chung toàn trường và 4 tổ chuyên môn: Toán-Lý-Tin-CN, Hóa-Lý-Sinh-GDQPAN-NN, Văn-Sử-Địa-GDKT&PL-AN, Văn phòng
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {canManageTasks && (
              <button 
                onClick={() => openCreateModal(activeDeptConfig?.slug)}
                className={cn(
                  "inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-[13px] font-bold text-white transition-all shadow-md",
                  activeDeptConfig ? activeDeptConfig.color.bg : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                )}
              >
                <Plus className="mr-2 h-4 w-4" />
                {activeDeptConfig ? `Giao việc ${activeDeptConfig.shortName}` : 'Giao việc mới'}
              </button>
            )}
          </div>
        </div>

        {/* PRIMARY DEPARTMENT TABS / NAVIGATION */}
        <div className="bg-white/90 backdrop-blur-xl p-2 rounded-[20px] border border-white/40 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
            {/* All Tasks Tab */}
            <button
              onClick={() => {
                setActiveTab('all');
                navigate('/tasks');
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'all'
                  ? "bg-slate-800 text-white shadow-md shadow-slate-800/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Building2 size={16} />
              <span>Chung toàn trường</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[11px] font-extrabold",
                activeTab === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              )}>
                {tabCounts.all}
              </span>
            </button>

            {/* 4 Prescribed Departments */}
            {PRESET_DEPARTMENTS.map(dept => {
              const IconComp = dept.icon;
              const isSelected = activeTab === dept.slug;
              const count = tabCounts[dept.slug] || 0;

              return (
                <button
                  key={dept.id}
                  onClick={() => {
                    setActiveTab(dept.slug);
                    navigate(`/tasks/${dept.slug}`);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
                    isSelected
                      ? dept.color.activeTab
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <IconComp size={16} />
                  <span>{dept.shortName}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-extrabold",
                    isSelected ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* History Tab */}
            <button
              onClick={() => setMainView(mainView === 'history' ? 'list' : 'history')}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ml-auto",
                mainView === 'history'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-indigo-600 hover:bg-indigo-50"
              )}
            >
              <CheckSquare size={16} />
              <span>Lịch sử đánh giá</span>
            </button>
          </div>
        </div>

        {/* DEPARTMENT BANNER (Visible when a specific department is chosen) */}
        {activeDeptConfig && (
          <div className={cn(
            "p-5 rounded-[20px] border shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] transition-all",
            activeDeptConfig.color.light,
            activeDeptConfig.color.border
          )}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 mt-0.5",
                  activeDeptConfig.color.bg
                )}>
                  <activeDeptConfig.icon size={24} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg font-extrabold text-slate-900 uppercase">
                      Giao việc: {activeDeptConfig.name}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-white border rounded-full text-xs font-bold text-slate-700 shadow-2xs">
                      {activeDeptTeachers.length} Giáo viên / Nhân viên
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    {activeDeptConfig.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">
                      <UserCheck size={14} className={activeDeptConfig.color.text} />
                      Tổ trưởng: <strong className="text-slate-800">{activeDeptHead?.name || 'Chưa phân công'}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">
                      <Sparkles size={14} className="text-amber-500" />
                      Bộ môn: {activeDeptConfig.subjects.slice(0, 4).join(', ')}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Department Progress & Quick Stats */}
              <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto bg-white/80 p-3 rounded-2xl border border-slate-200/60">
                <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
                  <div className="text-center">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase">Tổng việc</span>
                    <span className="text-lg font-extrabold text-slate-800">{deptStats.total}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-bold text-emerald-600 block uppercase">Đã xong</span>
                    <span className="text-lg font-extrabold text-emerald-600">{deptStats.completed}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-bold text-blue-600 block uppercase">Đang làm</span>
                    <span className="text-lg font-extrabold text-blue-600">{deptStats.inProgress}</span>
                  </div>
                  {deptStats.overdue > 0 && (
                    <div className="text-center">
                      <span className="text-[11px] font-bold text-rose-600 block uppercase">Quá hạn</span>
                      <span className="text-lg font-extrabold text-rose-600">{deptStats.overdue}</span>
                    </div>
                  )}
                </div>

                <div className="min-w-[130px]">
                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-slate-600">Hoàn thành</span>
                    <span className={activeDeptConfig.color.text}>{deptStats.rate}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-500", activeDeptConfig.color.bg)} 
                      style={{ width: `${deptStats.rate}%` }}
                    />
                  </div>
                </div>

                {canManageTasks && (
                  <button
                    onClick={() => openCreateModal(activeDeptConfig.slug)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-sm ml-auto",
                      activeDeptConfig.color.bg
                    )}
                  >
                    <Plus size={14} /> Giao việc tổ này
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAIN VIEW: HISTORY OR LIST */}
      {mainView === 'history' ? (
        <TaskEvaluationsHistory />
      ) : (
        <div className="space-y-6">
          {/* SEARCH & FILTER BAR */}
          <div className="bg-white/90 backdrop-blur-xl p-4 rounded-[20px] border border-white/40 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] flex flex-col md:flex-row gap-3 items-center no-print">
            {/* Week filter */}
            <select 
              className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none w-full md:w-auto font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white" 
              value={filterWeek} 
              onChange={e => setFilterWeek(e.target.value)}
            >
              <option value="">Tất cả tuần / thứ</option>
              {WEEKS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>

            {/* Filter target in 'all' tab */}
            {activeTab === 'all' && (
              <select 
                className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none w-full md:w-auto focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white font-medium"
                value={filterDepartment} 
                onChange={e => setFilterDepartment(e.target.value)}
              >
                <option value="all">Tất cả đối tượng chung</option>
                <option value="group_all">Toàn thể CBGVNV</option>
                <option value="group_gvcn">Giáo viên chủ nhiệm (GVCN)</option>
              </select>
            )}

            {/* Assignee filter: in dept tab, only show teachers of this dept */}
            <select 
              className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none w-full md:w-auto focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white" 
              value={filterAssignee} 
              onChange={e => setFilterAssignee(e.target.value)}
            >
              <option value="">
                {activeDeptConfig ? `Lọc giáo viên ${activeDeptConfig.shortName}` : 'Lọc theo người thực hiện'}
              </option>
              {(activeDeptConfig ? activeDeptTeachers : teachers).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.subject ? `(${t.subject})` : ''}
                </option>
              ))}
            </select>

            {/* Status / Execution Result filter */}
            <select 
              className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none w-full md:w-auto focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white" 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">Lọc kết quả thực hiện</option>
              <option value="Chưa đánh giá">Chưa đánh giá (—)</option>
              <option value="Hoàn thành tốt">Hoàn thành tốt</option>
              <option value="Quá hạn (Chậm muộn)">Quá hạn (Chậm muộn)</option>
            </select>

            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Tìm kiếm nội dung công việc..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none bg-white"
              />
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={handlePrint}
                title="In lịch giao việc"
                className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Printer size={18} />
              </button>
              <button 
                onClick={handleExportExcel}
                title="Xuất bảng Excel"
                className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-emerald-600 text-white px-3 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
              >
                <Download size={18} />
                <span className="text-xs font-bold hidden xl:inline">Xuất Excel</span>
              </button>
            </div>
          </div>

          {/* THỐNG KÊ TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ (YÊU CẦU 8) */}
          <div className="bg-white p-3.5 sm:p-4 rounded-[18px] border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <CheckCircle size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Tổng hợp đánh giá kết quả thực hiện {activeDeptConfig ? `(${activeDeptConfig.shortName})` : ''}
                </div>
                <div className="text-[11px] text-slate-500">Số liệu thực tế từ danh sách công việc đang lọc</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
              {/* Đã đánh giá */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 shadow-2xs font-semibold">
                <span>Đã đánh giá:</span>
                <span className="font-extrabold text-indigo-700 text-sm">
                  {summaryStats.evaluated}/{summaryStats.total}
                </span>
              </div>

              {/* Chưa đánh giá */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs font-semibold">
                <span>Chưa đánh giá:</span>
                <span className="font-extrabold text-slate-800 text-sm">
                  {summaryStats.notEvaluated}/{summaryStats.total}
                </span>
              </div>

              {/* Hoàn thành tốt */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span>Hoàn thành tốt:</span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  {summaryStats.good}
                </span>
              </div>

              {/* Quá hạn (Chậm muộn) */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 shadow-2xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                <span>Quá hạn (Chậm muộn):</span>
                <span className="font-extrabold text-rose-700 text-sm">
                  {summaryStats.overdue}
                </span>
              </div>
            </div>
          </div>

          {/* PRINT AREA */}
          <div id="print-area">
            <div className="print-only mb-6 text-center">
              <h2 className="text-xl font-bold uppercase">
                {activeDeptConfig ? `LỊCH GIAO VIỆC - ${activeDeptConfig.name.toUpperCase()}` : 'LỊCH GIAO VIỆC CHUNG'}
              </h2>
              <h3 className="text-lg font-bold uppercase">TRƯỜNG THPT SƠN LƯƠNG</h3>
              <p className="mt-1 text-sm text-slate-600">
                {activeDeptConfig && `Tổ trưởng: ${activeDeptHead?.name || 'Chưa cập nhật'} | `}
                Tuần: {filterWeek || 'Tất cả các tuần'} | Ngày in: {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>

            <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-none sm:rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-400">
                  <thead>
                    <tr className="bg-blue-50/80 text-sm font-bold text-slate-800 text-center">
                      <th className="px-3 py-3 border border-slate-400 w-24">Thứ/Tuần</th>
                      <th className="px-3 py-3 border border-slate-400 w-28">Ngày giao</th>
                      {activeTab === 'all' && (
                        <th className="px-3 py-3 border border-slate-400 w-36 text-center">Phạm vi</th>
                      )}
                      <th className="px-4 py-3 border border-slate-400 text-left min-w-[260px]">Nội dung công việc</th>
                      <th className="px-3 py-3 border border-slate-400 w-48">Người thực hiện</th>
                      <th className="px-3 py-3 border border-slate-400 w-28">Thời hạn</th>
                      <th className="px-3 py-3 border border-slate-400 w-36">Người đánh giá</th>
                      <th className="px-3 py-3 border border-slate-400 w-48 text-center no-print">Kết quả thực hiện</th>
                      <th className="px-3 py-3 border border-slate-400 w-16 no-print">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredAssignments.length === 0 ? (
                      <tr>
                        <td 
                          colSpan={activeTab === 'all' ? 9 : 8} 
                          className="px-4 py-12 text-center border border-slate-400 text-slate-500 bg-slate-50"
                        >
                          <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                              <LayoutList size={24} />
                            </div>
                            <p className="font-bold text-slate-700">
                              {activeDeptConfig 
                                ? `Chưa có công việc nào thuộc ${activeDeptConfig.name}.`
                                : 'Không tìm thấy công việc nào phù hợp với bộ lọc.'
                              }
                            </p>
                            {canManageTasks && activeDeptConfig && (
                              <button
                                onClick={() => openCreateModal(activeDeptConfig.slug)}
                                className={cn("px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2", activeDeptConfig.color.bg)}
                              >
                                <Plus size={14} /> Giao việc ngay cho {activeDeptConfig.shortName}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAssignments.map((assignment) => {
                        const isOverdue = (() => { 
                          const d = safeParseDate(assignment.deadline); 
                          return d ? d < new Date() && assignment.status !== 'Đã hoàn thành' && assignment.status !== 'Đã đánh giá' : false; 
                        })();
                        const isAssignee = isUserAnAssignee(assignment, user?.id);
                        const resolvedAssignees = getResolvedAssigneeTeachers(assignment);
                        const dept = getAssignmentDepartment(assignment);

                        return (
                          <tr key={assignment.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-3 py-3 border border-slate-400 text-center text-sm text-slate-800 font-semibold">
                              {assignment.weekLabel}
                            </td>
                            <td className="px-3 py-3 border border-slate-400 text-center text-sm text-slate-800">
                              {safeFormatLocale(assignment.workDate, 'toLocaleDateString', 'Chưa cập nhật')}
                            </td>
                            
                            {/* Scope Badge in 'All' Tab */}
                            {activeTab === 'all' && (
                              <td className="px-3 py-3 border border-slate-400 text-center align-top">
                                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 block text-center">
                                  Toàn trường
                                </span>
                              </td>
                            )}

                            <td className="px-4 py-3 border border-slate-400 text-sm text-slate-800 text-left align-top">
                              <div className="whitespace-pre-wrap leading-relaxed font-medium">{assignment.content}</div>
                              {assignment.note && (
                                <div className="mt-2 text-xs text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                                  <span className="font-semibold mr-1">Ghi chú:</span> {assignment.note}
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-3 border border-slate-400 text-center text-sm text-slate-800 align-top">
                              <div className="flex flex-col gap-1 items-center">
                                {getTeacherNames(assignment).split(', ').map((name, i) => (
                                  <div 
                                    key={i} 
                                    className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-xs w-full text-center truncate font-medium text-slate-700" 
                                    title={name}
                                  >
                                    {name}
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td className="px-3 py-3 border border-slate-400 text-center text-sm text-slate-800 align-top">
                              <div className={cn("font-semibold", isOverdue ? "text-rose-600" : "text-slate-700")}>
                                {safeFormatLocale(assignment.deadline, 'toLocaleDateString', 'Chưa cập nhật')}
                              </div>
                            </td>

                            <td className="px-3 py-3 border border-slate-400 text-center text-sm text-slate-800 align-top">
                              <div className="font-medium text-slate-700">
                                {getTeacherName(assignment.evaluatorId)}
                              </div>
                            </td>

                            {/* CỘT KẾT QUẢ THỰC HIỆN: CHỈ HIỂN THỊ KẾT QUẢ ĐÃ ĐƯỢC LƯU TRONG DATABASE */}
                            <td className="px-3 py-3 border border-slate-400 text-left align-top no-print">
                              {(() => {
                                const evaluatedList = getEvaluatedAssignees(assignment);
                                // TRẠNG THÁI BAN ĐẦU: Chưa có đánh giá nào -> TRỐNG HOÀN TOÀN
                                if (evaluatedList.length === 0) {
                                  return null;
                                }

                                // ĐÃ CÓ ĐÁNH GIÁ: CHỈ hiển thị những CBGVNV ĐÃ CÓ KẾT QUẢ ĐÁNH GIÁ ĐÃ LƯU
                                return (
                                  <div className="space-y-1.5 py-0.5">
                                    {evaluatedList.map(item => (
                                      <div 
                                        key={item.id} 
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                                      >
                                        <span className="font-semibold text-slate-800 truncate max-w-[130px]" title={item.name}>
                                          {item.name}:
                                        </span>
                                        <div className="shrink-0">
                                          {renderResultBadge(item.result)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </td>

                            <td className="px-3 py-3 border border-slate-400 text-center align-top no-print relative">
                              <div className="flex items-center justify-center gap-1">
                                {canEvaluateTask(assignment) && (
                                  (() => {
                                    const allAssigned = resolvedAssignees;
                                    const allEvaluated = allAssigned.length > 0 && allAssigned.every(t => {
                                      const r = assignment.assigneeResults?.[t.id];
                                      return r === 'Hoàn thành tốt' || r === 'Quá hạn (Chậm muộn)';
                                    });
                                    return (
                                      <button 
                                        onClick={() => openEvalModal(assignment)}
                                        className={cn(
                                          "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all shadow-2xs cursor-pointer",
                                          allEvaluated 
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" 
                                            : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                        )}
                                        title={allEvaluated ? "Đã đánh giá tất cả CBGVNV (bấm để xem lại/sửa)" : "Đánh giá công việc"}
                                      >
                                        {allEvaluated ? (
                                          <>
                                            <Check size={12} className="stroke-[3]" />
                                            <span>Đã đánh giá</span>
                                          </>
                                        ) : (
                                          <span>Đánh giá</span>
                                        )}
                                      </button>
                                    );
                                  })()
                                )}
                                <button 
                                  onClick={() => setActiveMenu(activeMenu === assignment.id ? null : assignment.id)}
                                  className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors"
                                  title="Tùy chọn khác"
                                >
                                  <MoreVertical size={16} />
                                </button>
                              </div>
                              
                              {activeMenu === assignment.id && (
                                <div className="absolute right-8 top-2 bg-white border border-slate-200 shadow-xl rounded-xl py-1.5 z-20 w-56 text-left">
                                  {/* Detail / Evaluation */}
                                  <button 
                                    onClick={() => { setActiveMenu(null); openEvalModal(assignment); }} 
                                    className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left flex items-center gap-2"
                                  >
                                    <Eye size={16} className="text-slate-500" /> Xem chi tiết / Đánh giá
                                  </button>

                                  {/* Manager operations */}
                                  {canManageTasks && (
                                    <>
                                      <div className="h-px bg-slate-100 my-1"></div>
                                      <button 
                                        onClick={() => openEditModal(assignment)} 
                                        className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left flex items-center gap-2"
                                      >
                                        <Edit size={16} className="text-slate-500" /> Sửa công việc
                                      </button>
                                      <button 
                                        onClick={() => handleDelete(assignment.id)} 
                                        className="w-full px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 text-left flex items-center gap-2"
                                      >
                                        <Trash2 size={16} /> Xóa công việc
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[24px] shadow-2xl border border-white/50 w-full max-w-3xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {editingAssignment 
                    ? 'Chỉnh sửa thông tin công việc' 
                    : formDeptConfig 
                      ? `Giao việc mới cho ${formDeptConfig.name}` 
                      : 'Giao việc chung toàn trường'
                  }
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân công nhiệm vụ, thời hạn và chỉ định người theo dõi đánh giá
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-200/50 transition-colors"
              >
                <Trash2 size={0} /> {/* Spacer */}
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* SELECT TARGET DEPARTMENT */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                  <span>Phạm vi giao việc / Đơn vị thực hiện <span className="text-rose-500">*</span></span>
                  {formDeptConfig && (
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-md border", formDeptConfig.color.badge)}>
                      {formDeptConfig.shortName}
                    </span>
                  )}
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, departmentId: 'global', scope: 'school' })}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1",
                        formData.departmentId === 'global' || !formData.departmentId
                          ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <Building2 size={16} />
                      <span>Chung toàn trường</span>
                    </button>
                  )}

                  {PRESET_DEPARTMENTS.map(dept => {
                    const isSelected = formData.departmentId === dept.id;
                    const IconComp = dept.icon;
                    // If user is TTCM and not admin, only allow their department
                    if (!isAdmin && isHead && userDeptConfig && userDeptConfig.id !== dept.id) {
                      return null;
                    }
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, departmentId: dept.id, scope: 'department' });
                          // Auto suggest head as evaluator if current evaluator is empty
                          const deptHead = teachers.find(t => 
                            isTeacherInDept(t, dept) && 
                            ((t.role || '').includes('TTCM') || (t.position || '').toLowerCase().includes('tổ trưởng'))
                          );
                          if (deptHead && !formData.evaluatorId) {
                            setFormData(prev => ({ ...prev, departmentId: dept.id, scope: 'department', evaluatorId: deptHead.id }));
                          }
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1",
                          isSelected
                            ? cn(dept.color.bg, "text-white border-transparent shadow-sm")
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        <IconComp size={16} />
                        <span className="truncate w-full">{dept.shortName}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 italic mt-1">
                  {formData.departmentId === 'global' || !formData.departmentId
                    ? '• Công việc chung toàn trường sẽ hiển thị tại danh mục "Chung toàn trường".'
                    : '• Khi tổ chuyên môn giao việc, nội dung công việc chỉ hiển thị trong tổ chuyên môn, không hiển thị lên công việc chung toàn trường.'}
                </p>
              </div>

              {/* DATE & TIME */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Thứ / Tuần học <span className="text-rose-500">*</span></label>
                  <select 
                    required
                    value={formData.weekLabel || ''}
                    onChange={e => setFormData({...formData, weekLabel: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    {WEEKS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ngày giao việc <span className="text-rose-500">*</span></label>
                  <input 
                    required
                    type="date" 
                    value={formData.workDate}
                    onChange={e => setFormData({...formData, workDate: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* CONTENT */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Nội dung công việc <span className="text-rose-500">*</span></label>
                <textarea 
                  required
                  rows={3}
                  value={formData.content || ''}
                  onChange={e => setFormData({...formData, content: e.target.value})}
                  placeholder="Nhập nội dung chi tiết công việc cần thực hiện..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>

              {/* ASSIGNEES SELECTION */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Người thực hiện (Chọn một hoặc nhiều) <span className="text-rose-500">*</span>
                  </label>
                  
                  {/* Department Quick Helpers */}
                  {formDeptConfig && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => selectAllDeptTeachers(formDeptConfig)}
                        className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-bold transition-colors"
                      >
                        ✓ Chọn tất cả {formDeptConfig.shortName}
                      </button>
                      <button
                        type="button"
                        onClick={() => deselectDeptTeachers(formDeptConfig)}
                        className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md font-medium transition-colors"
                      >
                        ✕ Bỏ chọn
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-full max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1 custom-scrollbar">
                  {/* Whole Department Group Token */}
                  {formDeptConfig && (
                    <label className={cn(
                      "flex items-center gap-3 p-2 rounded cursor-pointer mb-1 border font-bold text-sm transition-colors",
                      formDeptConfig.color.badge
                    )}>
                      <input 
                        type="checkbox" 
                        checked={formData.assigneeIds?.includes(formDeptConfig.groupToken) || false}
                        onChange={() => toggleAssignee(formDeptConfig.groupToken)}
                        className="w-4 h-4 rounded border-slate-300 focus:ring-2"
                      />
                      <span>Toàn thể thành viên {formDeptConfig.name}</span>
                    </label>
                  )}

                  {/* School-wide groups if in global scope */}
                  {(!formDeptConfig || formData.departmentId === 'global') && (
                    <>
                      <label className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer bg-blue-50/50 border border-blue-100 mb-1">
                        <input 
                          type="checkbox" 
                          checked={formData.assigneeIds?.includes('GROUP_ALL') || false}
                          onChange={() => toggleAssignee('GROUP_ALL')}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-blue-800 font-bold">Toàn thể CBGVNV</span>
                      </label>
                      <label className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer bg-emerald-50/50 border border-emerald-100 mb-2">
                        <input 
                          type="checkbox" 
                          checked={formData.assigneeIds?.includes('GROUP_GVCN') || false}
                          onChange={() => toggleAssignee('GROUP_GVCN')}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-emerald-800 font-bold">Giáo viên chủ nhiệm (GVCN)</span>
                      </label>
                    </>
                  )}

                  {/* Teachers in target department */}
                  {formDeptTeachers.map(t => {
                    const isChecked = formData.assigneeIds?.includes(t.id) || false;
                    const deptObj = departments.find(d => d.id === t.departmentId);
                    const isHeadTeacher = (t.role || '').includes('TTCM') || (t.position || '').toLowerCase().includes('tổ trưởng');

                    return (
                      <label 
                        key={t.id} 
                        className={cn(
                          "flex items-center justify-between p-2 rounded cursor-pointer transition-colors",
                          isChecked ? "bg-blue-50/70 border border-blue-100" : "hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => toggleAssignee(t.id)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-800 font-medium">{t.name}</span>
                          {t.subject && (
                            <span className="text-xs px-2 py-0.5 bg-slate-200/60 rounded text-slate-600 font-medium">
                              Môn {t.subject}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isHeadTeacher && (
                            <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                              Tổ trưởng
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {deptObj?.name || 'Tổ chuyên môn'}
                          </span>
                        </div>
                      </label>
                    );
                  })}

                  {/* Cross-Department Expansion */}
                  {formDeptConfig && otherDeptTeachers.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowCrossDeptTeachers(!showCrossDeptTeachers)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 mb-1"
                      >
                        <ChevronRight size={14} className={cn("transition-transform", showCrossDeptTeachers && "rotate-90")} />
                        {showCrossDeptTeachers ? 'Ẩn giáo viên các tổ khác' : '+ Thêm giáo viên các tổ khác (Nếu phối hợp liên tổ)'}
                      </button>

                      {showCrossDeptTeachers && otherDeptTeachers.map(t => {
                        const isChecked = formData.assigneeIds?.includes(t.id) || false;
                        const deptObj = departments.find(d => d.id === t.departmentId);
                        return (
                          <label key={t.id} className="flex items-center justify-between p-2 hover:bg-slate-100 rounded cursor-pointer text-xs">
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={() => toggleAssignee(t.id)}
                                className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                              />
                              <span className="font-medium text-slate-800">{t.name}</span>
                              {t.subject && <span className="text-slate-500">({t.subject})</span>}
                            </div>
                            <span className="text-slate-400">{deptObj?.name || ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              {/* DEADLINE & EVALUATOR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Thời hạn hoàn thành <span className="text-rose-500">*</span></label>
                  <input 
                    required
                    type="date" 
                    value={formData.deadline}
                    min={formData.workDate}
                    onChange={e => setFormData({...formData, deadline: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Người đánh giá <span className="text-rose-500">*</span></label>
                  <select 
                    required
                    value={formData.evaluatorId || ''}
                    onChange={e => setFormData({...formData, evaluatorId: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="" disabled>-- Chọn Người đánh giá --</option>
                    {(() => {
                      const evaluators = teachers.filter(t => {
                        const r = (t.role || '').toUpperCase();
                        const p = (t.position || '').toUpperCase();
                        const n = (t.name || '').toUpperCase();
                        return r.includes('BGH') || r.includes('HIỆU TRƯỞNG') || r.includes('HIEU TRUONG') || 
                               r.includes('TTCM') || r.includes('TỔ TRƯỞNG') || r.includes('TO TRUONG') || 
                               r.includes('PHT') || r.includes('HT') ||
                               p.includes('BÍ THƯ') || r.includes('BÍ THƯ') || n.includes('BÍ THƯ');
                      });
                      
                      const listToShow = evaluators.length > 0 ? evaluators : teachers;

                      return listToShow.map(t => {
                        const r = (t.role || '').toUpperCase();
                        const roleName = (r.includes('BGH') || r.includes('HIỆU TRƯỞNG') || r.includes('HIEU TRUONG') || r.includes('PHT') || r.includes('HT')) ? 'Ban Giám hiệu' : 
                                         (r.includes('TTCM') || r.includes('TỔ TRƯỞNG') || r.includes('TO TRUONG')) ? 'Tổ trưởng' : 
                                         t.position || t.role || 'Giáo viên';
                        return (
                          <option key={t.id} value={t.id}>{t.name} - {roleName}</option>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>

              {/* NOTES */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Ghi chú bổ sung</label>
                <input 
                  type="text" 
                  value={formData.note || ''}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                  placeholder="Ghi chú thêm nếu có..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              {/* KẾT QUẢ THỰC HIỆN CÔNG VIỆC (Người quản lý chỉ xem) */}
              {editingAssignment && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Kết quả thực hiện của người được giao:
                    </label>
                    <span className="text-xs text-slate-500 italic">Người quản lý chỉ xem kết quả</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    {(() => {
                      const evaluatedList = getEvaluatedAssignees(editingAssignment);
                      if (evaluatedList.length === 0) {
                        return <div className="text-xs text-slate-500 italic">Chưa có kết quả đánh giá nào</div>;
                      }
                      return evaluatedList.map(item => (
                        <div key={item.id} className="flex items-center justify-between py-1 border-b border-slate-200/60 last:border-b-0 text-xs">
                          <span className="font-semibold text-slate-800">{item.name}:</span>
                          <div className="shrink-0">{renderResultBadge(item.result)}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* MODAL FOOTER */}
              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className={cn(
                    "px-5 py-2.5 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm",
                    formDeptConfig ? formDeptConfig.color.bg : "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  <CheckCircle size={16} />
                  {editingAssignment ? 'Lưu thay đổi' : 'Giao việc ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVALUATION / DETAIL MODAL */}
      {isEvalModalOpen && evaluatingAssignment && (
        <TaskEvaluationModal 
          assignment={evaluatingAssignment} 
          initialAssigneeId={evaluatingAssigneeId}
          onClose={() => {
            setIsEvalModalOpen(false);
            setEvaluatingAssignment(null);
            setEvaluatingAssigneeId(undefined);
          }} 
          onSave={async (id, updates) => {
            await updateWorkAssignment(id, { ...updates, updatedAt: new Date().toISOString() });
            setIsEvalModalOpen(false);
            setEvaluatingAssignment(null);
            setEvaluatingAssigneeId(undefined);
          }} 
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-2xl rounded-[24px] shadow-2xl border border-white/50 w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Xóa công việc</h3>
              <p className="text-sm text-slate-500">Bạn có chắc chắn muốn xóa công việc này? Dữ liệu lịch sử sẽ bị mất và không thể khôi phục.</p>
            </div>
            <div className="flex bg-slate-50 p-4 gap-3 justify-end">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
