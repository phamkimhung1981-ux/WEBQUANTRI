import React, { useState, useEffect } from 'react';
import {
  Users,
  PlusCircle,
  Zap,
  Star,
  Settings,
  BarChart3,
  FileSpreadsheet,
  Calendar,
  AlertTriangle,
  Award,
  Search,
  Filter,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Sliders,
  Printer,
  RefreshCw,
  Info,
  School,
  UserPlus,
  Download,
  AlertCircle
} from 'lucide-react';
import {
  ClassInfo,
  Student,
  ConductCategory,
  ConductCriterion,
  ConductRecord,
  ConductEvaluation,
  ConductSettings,
  HomeroomAssignment
} from '../types/homeroom';
import { homeroomService } from '../services/homeroomService';
import { calculateConductScore } from '../lib/homeroomData';
import { exportHomeroomToExcel } from '../utils/homeroomExport';
import { exportStudentListToExcel } from '../utils/studentExcel';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../store/AppContext';
import BackButton from '../components/ui/BackButton';

// Import Modals
import StudentProfileModal from '../components/homeroom/StudentProfileModal';
import RecordModal from '../components/homeroom/RecordModal';
import QuickRecordModal from '../components/homeroom/QuickRecordModal';
import BonusPointModal from '../components/homeroom/BonusPointModal';
import CriteriaManagerModal from '../components/homeroom/CriteriaManagerModal';
import EvaluationModal from '../components/homeroom/EvaluationModal';
import ConductSettingsModal from '../components/homeroom/ConductSettingsModal';
import HomeroomReportModal from '../components/homeroom/HomeroomReportModal';
import ClassManagerModal from '../components/homeroom/ClassManagerModal';
import StudentManagerModal from '../components/homeroom/StudentManagerModal';

export default function Homeroom() {
  const { user } = useAuth();
  const isBgh = user?.role?.toUpperCase() === 'BGH' || user?.role?.toUpperCase() === 'ADMIN' || user?.username === 'admin';
  const { teachers } = useAppContext();

  // State loaded from Firestore
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<HomeroomAssignment[]>([]);
  const [categories, setCategories] = useState<ConductCategory[]>([]);
  const [criteria, setCriteria] = useState<ConductCriterion[]>([]);
  const [records, setRecords] = useState<ConductRecord[]>([]);
  const [evaluations, setEvaluations] = useState<ConductEvaluation[]>([]);
  const [settings, setSettings] = useState<ConductSettings>({
    id: 'default_conduct_settings',
    schoolYear: '2026–2027',
    baseScore: 100,
    thresholds: { totMin: 90, khaMin: 70, datMin: 50 }
  });

  // Active Filters
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2026–2027');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<number>(3); // e.g. Tuần 3
  const [selectedMonth, setSelectedMonth] = useState<string>('Tháng 09');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'students' | 'weekly' | 'monthly' | 'ranking' | 'alerts' | 'evaluations'>('students');

  // Modal States
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isQuickRecordModalOpen, setIsQuickRecordModalOpen] = useState(false);
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [isCriteriaManagerOpen, setIsCriteriaManagerOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [isStudentManagerOpen, setIsStudentManagerOpen] = useState(false);

  // Selected entities for modals
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [selectedStudentForEval, setSelectedStudentForEval] = useState<Student | null>(null);
  const [defaultStudentForRecord, setDefaultStudentForRecord] = useState<string | undefined>(undefined);
  const [studentToDeleteFromDashboard, setStudentToDeleteFromDashboard] = useState<Student | null>(null);
  const [isDeletingFromDashboard, setIsDeletingFromDashboard] = useState(false);

  // Initial Firestore subscriptions
  useEffect(() => {
    homeroomService.seedIfEmpty();

    const unsubCls = homeroomService.subscribeClasses(setClasses);
    const unsubStd = homeroomService.subscribeStudents(setStudents);
    const unsubAssign = homeroomService.subscribeAssignments(setAssignments);
    const unsubCat = homeroomService.subscribeCategories(setCategories);
    const unsubCrit = homeroomService.subscribeCriteria(setCriteria);
    const unsubRec = homeroomService.subscribeRecords(setRecords);
    const unsubEval = homeroomService.subscribeEvaluations(setEvaluations);
    const unsubSet = homeroomService.subscribeSettings(setSettings);

    return () => {
      unsubCls();
      unsubStd();
      unsubAssign();
      unsubCat();
      unsubCrit();
      unsubRec();
      unsubEval();
      unsubSet();
    };
  }, []);

  // Set default class once loaded
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Derived filtered classes
  const filteredClasses = classes.filter(c => {
    if (selectedGrade !== 'all' && String(c.grade) !== selectedGrade) return false;
    return true;
  });

  const selectedClass = classes.find(c => c.id === selectedClassId) || filteredClasses[0] || null;

  // Derived students for selected class & search
  const classStudents = students
    .filter(s => !selectedClass || s.classId === selectedClass.id)
    .filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase()));

  // Derived records for selected class
  const classRecords = records.filter(r => !selectedClass || r.classId === selectedClass.id);

  // Homeroom assignment teacher
  const currentAssignment = assignments.find(a => a.classId === selectedClass?.id && a.status === 'active');
  const homeroomTeacherName = selectedClass?.homeroomTeacherName || currentAssignment?.teacherName || 'Chưa phân công';

  // Open modal handlers
  const handleOpenRecordForStudent = (studentId: string) => {
    setDefaultStudentForRecord(studentId);
    setIsRecordModalOpen(true);
  };

  const handleOpenProfile = (student: Student) => {
    setSelectedStudentForProfile(student);
    setIsProfileModalOpen(true);
  };

  const handleOpenEval = (student: Student) => {
    setSelectedStudentForEval(student);
    setIsEvaluationModalOpen(true);
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa ghi nhận này?')) {
      await homeroomService.deleteConductRecord(id);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center">
        <BackButton />
      </div>
      {/* 1. Header Title & Top Info Bar */}
      <div className="bg-gradient-to-r from-[#123B78] via-[#1457D9] to-[#123B78] text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
              <Users size={28} className="text-blue-200" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                CÔNG TÁC CHỦ NHIỆM & QUẢN LÝ NỀN NẾP
              </h1>
              <p className="text-xs sm:text-sm text-blue-100">
                Trường THPT Sơn Lương • Hệ thống theo dõi điểm rèn luyện & đánh giá học sinh điện tử
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isBgh && (
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 backdrop-blur-sm transition-all flex items-center gap-1.5"
            >
              <Sliders size={16} /> Ngưỡng điểm rèn luyện
            </button>
          )}
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
          >
            <BarChart3 size={16} /> Báo cáo & Bảng tổng hợp
          </button>
        </div>
      </div>

      {/* 2. Filter & Navigation Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* School Year */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Năm học:</span>
              <select
                value={selectedSchoolYear}
                onChange={(e) => setSelectedSchoolYear(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="2026–2027">2026–2027</option>
                <option value="2025–2026">2025–2026</option>
              </select>
            </div>

            {/* Grade Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Khối:</span>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="all">Tất cả khối</option>
                <option value="10">Khối 10</option>
                <option value="11">Khối 11</option>
                <option value="12">Khối 12</option>
              </select>
            </div>

            {/* Class Selector & Add Button */}
            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
              <span className="text-blue-600 font-bold">Lớp chủ nhiệm:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-transparent font-black text-blue-900 text-sm outline-none cursor-pointer"
              >
                {filteredClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.totalStudents} học sinh)</option>
                ))}
              </select>
              <button
                onClick={() => setIsClassManagerOpen(true)}
                className="ml-1 p-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm"
                title="Thêm hoặc quản lý danh sách lớp học"
              >
                <PlusCircle size={13} /> Thêm lớp
              </button>
            </div>

            {/* Week Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Tuần:</span>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {Array.from({ length: 36 }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>Tuần {String(w).padStart(2, '0')}</option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Tháng:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="Tháng 09">Tháng 09</option>
                <option value="Tháng 10">Tháng 10</option>
                <option value="Tháng 11">Tháng 11</option>
                <option value="Tháng 12">Tháng 12</option>
                <option value="Tháng 01">Tháng 01</option>
                <option value="Tháng 02">Tháng 02</option>
                <option value="Tháng 03">Tháng 03</option>
                <option value="Tháng 04">Tháng 04</option>
                <option value="Tháng 05">Tháng 05</option>
              </select>
            </div>
          </div>

          {/* Teacher Badge */}
          <div className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 border border-slate-200">
            <span>GVCN Lớp <strong>{selectedClass?.name}</strong>:</span>
            <strong className="text-blue-700">{homeroomTeacherName}</strong>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setDefaultStudentForRecord(undefined);
                setIsRecordModalOpen(true);
              }}
              className="px-4 py-2 bg-[#1457D9] hover:bg-[#123B78] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
            >
              <PlusCircle size={16} /> + GHI NHẬN NỀN NẾP
            </button>

            <button
              onClick={() => setIsQuickRecordModalOpen(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
            >
              <Zap size={16} className="fill-white" /> ⚡ GHI NHẬN NHANH
            </button>

            <button
              onClick={() => setIsBonusModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
            >
              <Star size={16} className="fill-white" /> ⭐ ĐIỂM TỐT
            </button>

            <button
              onClick={() => setIsClassManagerOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
            >
              <School size={16} /> QUẢN LÝ / THÊM LỚP
            </button>

            <button
              onClick={() => setIsStudentManagerOpen(true)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
            >
              <UserPlus size={16} /> QUẢN LÝ / NHẬP HS
            </button>

            {isBgh && (
              <button
                onClick={() => setIsCriteriaManagerOpen(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
              >
                <Settings size={15} /> QUẢN LÝ TIÊU CHÍ
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm học sinh theo tên, mã HS..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* 3. Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'students'
              ? 'bg-[#1457D9] text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users size={16} /> Danh sách học sinh ({classStudents.length})
        </button>

        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'weekly'
              ? 'bg-[#1457D9] text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar size={16} /> Theo dõi theo tuần
        </button>

        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'monthly'
              ? 'bg-[#1457D9] text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 size={16} /> Theo dõi theo tháng
        </button>

        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'ranking'
              ? 'bg-[#1457D9] text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Award size={16} /> Xếp hạng rèn luyện
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'alerts'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
          }`}
        >
          <AlertTriangle size={16} /> Cảnh báo rèn luyện
        </button>

        <button
          onClick={() => setActiveTab('evaluations')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'evaluations'
              ? 'bg-[#1457D9] text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckCircle2 size={16} /> Đánh giá & Duyệt BGH
        </button>
      </div>

      {/* 4. Tab Views */}

      {/* TAB 1: DANH SÁCH HỌC SINH */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header Action Bar */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-xs">Danh sách học sinh lớp {selectedClass?.name}:</span>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">{classStudents.length} học sinh</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsStudentManagerOpen(true)}
                className="px-3 py-1.5 bg-[#1457D9] hover:bg-[#123B78] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <UserPlus size={14} /> + THÊM / NHẬP EXCEL
              </button>
              <button
                onClick={() => exportStudentListToExcel(selectedClass?.name || '', selectedSchoolYear, classStudents)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <Download size={14} /> XUẤT FILE EXCEL
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 w-12 text-center">STT</th>
                  <th className="p-3.5">Mã HS</th>
                  <th className="p-3.5">Họ và tên</th>
                  <th className="p-3.5">Giới tính</th>
                  <th className="p-3.5 text-center">Điểm cộng</th>
                  <th className="p-3.5 text-center">Điểm trừ</th>
                  <th className="p-3.5 text-center">Điểm rèn luyện</th>
                  <th className="p-3.5 text-center">Xếp loại</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 text-sm">
                      Không tìm thấy học sinh nào thuộc lớp {selectedClass?.name}.
                    </td>
                  </tr>
                ) : (
                  classStudents.map((st, index) => {
                    const stRecords = classRecords.filter(r => r.studentId === st.id);
                    let totalPlus = 0;
                    let totalMinus = 0;
                    stRecords.forEach(r => {
                      if (r.pointType === 'plus') totalPlus += Math.abs(r.point);
                      else totalMinus += Math.abs(r.point);
                    });

                    const { totalScore, classification } = calculateConductScore(
                      settings.baseScore || 100,
                      totalPlus,
                      totalMinus,
                      settings.thresholds
                    );

                    const getBadgeStyle = (cls: string) => {
                      switch (cls) {
                        case 'Tốt': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
                        case 'Khá': return 'bg-blue-100 text-blue-800 border-blue-300';
                        case 'Đạt': return 'bg-amber-100 text-amber-800 border-amber-300';
                        default: return 'bg-rose-100 text-rose-800 border-rose-300';
                      }
                    };

                    return (
                      <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 text-center font-bold text-slate-500">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="p-3.5 font-mono text-slate-600 font-semibold">{st.code}</td>
                        <td className="p-3.5 font-bold text-slate-800">
                          <button
                            onClick={() => handleOpenProfile(st)}
                            className="hover:text-blue-700 hover:underline text-left"
                          >
                            {st.name}
                          </button>
                        </td>
                        <td className="p-3.5 text-slate-600">{st.gender}</td>
                        <td className="p-3.5 text-center font-bold text-emerald-600">
                          {totalPlus > 0 ? `+${totalPlus}` : '0'}
                        </td>
                        <td className="p-3.5 text-center font-bold text-rose-600">
                          {totalMinus > 0 ? `-${totalMinus}` : '0'}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="text-base font-black text-blue-800">{totalScore}</span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${getBadgeStyle(classification)}`}>
                            {classification}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => handleOpenProfile(st)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
                          >
                            Hồ sơ
                          </button>
                          <button
                            onClick={() => handleOpenRecordForStudent(st.id)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs"
                          >
                            + Vi phạm
                          </button>
                          <button
                            onClick={() => setStudentToDeleteFromDashboard(st)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-lg text-xs transition-colors"
                          >
                            Xóa
                          </button>
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

      {/* TAB 2: THEO DÕI TUẦN */}
      {activeTab === 'weekly' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={18} className="text-blue-600" />
              BẢNG THEO DÕI NỀN NẾP HẰNG NGÀY - TUẦN {String(selectedWeek).padStart(2, '0')} (LỚP {selectedClass?.name})
            </h3>
            <span className="text-xs text-slate-500 font-medium">Hiển thị vi phạm từ T2 đến T6</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3 text-center">Thứ 2</th>
                  <th className="p-3 text-center">Thứ 3</th>
                  <th className="p-3 text-center">Thứ 4</th>
                  <th className="p-3 text-center">Thứ 5</th>
                  <th className="p-3 text-center">Thứ 6</th>
                  <th className="p-3 text-center">Tổng vi phạm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStudents.map((st, idx) => {
                  const stWeekRecords = classRecords.filter(r => r.studentId === st.id && r.weekNumber === selectedWeek);
                  const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

                  return (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800">{st.name}</td>
                      {days.map((day, dIdx) => {
                        // Check if records fall on day of week
                        const dayRecords = stWeekRecords.filter(r => {
                          const dt = new Date(r.recordDate);
                          return dt.getDay() === dIdx + 1; // 1 = Mon, 5 = Fri
                        });

                        return (
                          <td key={dIdx} className="p-3 text-center">
                            {dayRecords.length === 0 ? (
                              <span className="text-slate-300">—</span>
                            ) : (
                              <div className="flex flex-col gap-1 items-center">
                                {dayRecords.map(r => (
                                  <span
                                    key={r.id}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      r.pointType === 'plus' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}
                                    title={r.criterionName}
                                  >
                                    {r.pointType === 'plus' ? `+${r.point}` : `${r.point}`}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center font-bold text-rose-700">
                        {stWeekRecords.filter(r => r.pointType === 'minus').length} lượt
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: THEO DÕI THÁNG */}
      {activeTab === 'monthly' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">
              TỔNG HỢP NỀN NẾP {selectedMonth.toUpperCase()} - LỚP {selectedClass?.name}
            </h3>
            <button
              onClick={() => exportHomeroomToExcel({
                className: selectedClass?.name || '10A1',
                schoolYear: selectedSchoolYear,
                periodLabel: selectedMonth,
                homeroomTeacherName,
                students: classStudents,
                records: classRecords,
                criteria,
                baseScore: settings.baseScore || 100
              })}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet size={15} /> Xuất bảng Excel tháng
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
              <span className="text-xs text-blue-600 font-bold block mb-1">Tổng học sinh</span>
              <span className="text-3xl font-black text-blue-900">{classStudents.length}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
              <span className="text-xs text-emerald-600 font-bold block mb-1">Học sinh xếp loại TỐT</span>
              <span className="text-3xl font-black text-emerald-700">
                {classStudents.filter(s => {
                  let plus = 0, minus = 0;
                  classRecords.filter(r => r.studentId === s.id).forEach(r => {
                    if (r.pointType === 'plus') plus += Math.abs(r.point);
                    else minus += Math.abs(r.point);
                  });
                  return calculateConductScore(100, plus, minus).classification === 'Tốt';
                }).length}
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
              <span className="text-xs text-amber-600 font-bold block mb-1">Học sinh xếp loại KHÁ/ĐẠT</span>
              <span className="text-3xl font-black text-amber-700">
                {classStudents.filter(s => {
                  let plus = 0, minus = 0;
                  classRecords.filter(r => r.studentId === s.id).forEach(r => {
                    if (r.pointType === 'plus') plus += Math.abs(r.point);
                    else minus += Math.abs(r.point);
                  });
                  const c = calculateConductScore(100, plus, minus).classification;
                  return c === 'Khá' || c === 'Đạt';
                }).length}
              </span>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center">
              <span className="text-xs text-rose-600 font-bold block mb-1">Cần phấn đấu / Cảnh báo</span>
              <span className="text-3xl font-black text-rose-700">
                {classStudents.filter(s => {
                  let plus = 0, minus = 0;
                  classRecords.filter(r => r.studentId === s.id).forEach(r => {
                    if (r.pointType === 'plus') plus += Math.abs(r.point);
                    else minus += Math.abs(r.point);
                  });
                  return calculateConductScore(100, plus, minus).classification === 'Chưa đạt';
                }).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: XẾP HẠNG RÈN LUYỆN (LEADERBOARD) */}
      {activeTab === 'ranking' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Award size={20} className="text-amber-500" />
              BẢNG XẾP HẠNG PHONG TRÀO THI ĐUA RÈN LUYỆN (LỚP {selectedClass?.name})
            </h3>

            {/* Top 3 Honor Podium */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
              {classStudents
                .map(st => {
                  let plus = 0, minus = 0;
                  classRecords.filter(r => r.studentId === st.id).forEach(r => {
                    if (r.pointType === 'plus') plus += Math.abs(r.point);
                    else minus += Math.abs(r.point);
                  });
                  return { student: st, ...calculateConductScore(100, plus, minus) };
                })
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 3)
                .map((item, idx) => (
                  <div key={item.student.id} className="bg-gradient-to-b from-amber-50 to-orange-50 border border-amber-200 p-5 rounded-2xl text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 text-3xl font-black text-amber-300/40">
                      #{idx + 1}
                    </div>
                    <div className="w-14 h-14 bg-amber-400 text-slate-900 rounded-full font-black text-xl flex items-center justify-center mx-auto mb-3 shadow-md border-2 border-white">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.student.name}</h4>
                    <span className="text-xs text-slate-500 block mb-2">{item.student.code}</span>
                    <div className="inline-block bg-white px-3 py-1 rounded-xl shadow-sm font-black text-amber-700 text-lg border border-amber-200">
                      {item.totalScore} điểm
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CẢNH BÁO */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-6 space-y-4">
          <h3 className="text-base font-bold text-rose-800 flex items-center gap-2">
            <ShieldAlert size={20} className="text-rose-600" />
            DANH SÁCH CẢNH BÁO RÈN LUYỆN NỀN NẾP
          </h3>
          <p className="text-xs text-slate-600">
            Các học sinh có điểm rèn luyện suy giảm hoặc vi phạm lỗi nghiêm trọng cần GVCN trực tiếp gặp mặt nhắc nhở và thông báo cho phụ huynh.
          </p>

          <div className="border border-rose-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50 border-b border-rose-200 text-rose-900 font-bold">
                <tr>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3 text-center">Điểm rèn luyện</th>
                  <th className="p-3 text-center">Xếp loại</th>
                  <th className="p-3 text-center">Số lượt vi phạm</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100">
                {classStudents.map(st => {
                  let plus = 0, minus = 0;
                  const stRecs = classRecords.filter(r => r.studentId === st.id);
                  stRecs.forEach(r => {
                    if (r.pointType === 'plus') plus += Math.abs(r.point);
                    else minus += Math.abs(r.point);
                  });
                  const { totalScore, classification } = calculateConductScore(100, plus, minus);
                  if (totalScore >= 80 && stRecs.filter(r => r.pointType === 'minus').length < 3) return null;

                  return (
                    <tr key={st.id} className="hover:bg-rose-50/50">
                      <td className="p-3 font-bold text-slate-800">{st.name} ({st.code})</td>
                      <td className="p-3 text-center font-black text-rose-700">{totalScore}</td>
                      <td className="p-3 text-center font-bold">{classification}</td>
                      <td className="p-3 text-center font-bold">{stRecs.filter(r => r.pointType === 'minus').length} lần</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenProfile(st)}
                          className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg text-xs hover:bg-rose-700"
                        >
                          Xử lý & Chi tiết
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

      {/* TAB 6: ĐÁNH GIÁ & DUYỆT BGH */}
      {activeTab === 'evaluations' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-blue-600" />
              TỔNG HỢP ĐÁNH GIÁ RÈN LUYỆN VÀ XÁC NHẬN CỦA BAN GIÁM HIỆU
            </h3>
            <span className="text-xs text-slate-500 font-medium">Thời gian: {selectedMonth}</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Họ và tên</th>
                  <th className="p-3 text-center">Điểm tổng</th>
                  <th className="p-3 text-center">Xếp loại đề xuất</th>
                  <th className="p-3 text-center">Trạng thái BGH duyệt</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStudents.map((st, idx) => {
                  let plus = 0, minus = 0;
                  classRecords.filter(r => r.studentId === st.id).forEach(r => {
                    if (r.pointType === 'plus') plus += Math.abs(r.point);
                    else minus += Math.abs(r.point);
                  });
                  const { totalScore, classification } = calculateConductScore(100, plus, minus);

                  const evalItem = evaluations.find(e => e.studentId === st.id && e.period === selectedMonth);
                  const status = evalItem?.confirmationStatus || 'Chờ GVCN đánh giá';

                  return (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800">{st.name} ({st.code})</td>
                      <td className="p-3 text-center font-black text-blue-700">{totalScore}</td>
                      <td className="p-3 text-center font-bold">{evalItem?.classification || classification}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          status === 'Đã xác nhận' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          status === 'Chờ BGH xác nhận' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          status === 'Yêu cầu điều chỉnh' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenEval(st)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
                        >
                          {evalItem ? 'Sửa / Xem phiếu' : 'Lập đánh giá'}
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

      {/* ALL MODALS */}
      {selectedStudentForProfile && (
        <StudentProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          student={selectedStudentForProfile}
          records={records}
          settings={settings}
          onDeleteRecord={handleDeleteRecord}
        />
      )}

      <RecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        selectedClass={selectedClass}
        students={classStudents}
        categories={categories}
        criteria={criteria}
        onSave={async (rec) => {
          await homeroomService.addConductRecord(rec);
        }}
        defaultStudentId={defaultStudentForRecord}
      />

      <QuickRecordModal
        isOpen={isQuickRecordModalOpen}
        onClose={() => setIsQuickRecordModalOpen(false)}
        selectedClass={selectedClass}
        students={classStudents}
        criteria={criteria}
        onSaveQuick={async (recs) => {
          for (const r of recs) {
            await homeroomService.addConductRecord(r);
          }
        }}
      />

      <BonusPointModal
        isOpen={isBonusModalOpen}
        onClose={() => setIsBonusModalOpen(false)}
        selectedClass={selectedClass}
        students={classStudents}
        criteria={criteria}
        onSaveBonus={async (rec) => {
          await homeroomService.addConductRecord(rec);
        }}
      />

      <CriteriaManagerModal
        isOpen={isCriteriaManagerOpen}
        onClose={() => setIsCriteriaManagerOpen(false)}
        categories={categories}
        criteria={criteria}
        onAddCriterion={async (crit) => {
          await homeroomService.addCriterion(crit);
        }}
        onUpdateCriterion={async (id, updates) => {
          await homeroomService.updateCriterion(id, updates);
        }}
        onDeleteCriterion={async (id) => {
          await homeroomService.deleteCriterion(id);
        }}
      />

      <ConductSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={async (s) => {
          await homeroomService.saveSettings(s);
        }}
      />

      <HomeroomReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedClass={selectedClass}
        students={classStudents}
        records={classRecords}
        criteria={criteria}
        settings={settings}
        periodLabel={selectedMonth}
      />

      <ClassManagerModal
        isOpen={isClassManagerOpen}
        onClose={() => setIsClassManagerOpen(false)}
        classes={classes}
        selectedSchoolYear={selectedSchoolYear}
        teachers={teachers}
        isBgh={isBgh}
        onAddClass={async (newClass) => {
          const created = await homeroomService.addClass(newClass);
          if (created?.id) {
            setSelectedGrade('all');
            setSelectedClassId(created.id);
          }
          return created;
        }}
        onAddClassesBulk={async (classesList) => {
          const createdList = await homeroomService.addClassesBulk(classesList);
          if (createdList.length > 0) {
            setSelectedGrade('all');
            setSelectedClassId(createdList[0].id);
          }
          return createdList;
        }}
        onUpdateClass={async (id, updates) => {
          await homeroomService.updateClass(id, updates);
        }}
        onDeleteClass={async (id) => {
          await homeroomService.deleteClass(id);
          if (selectedClassId === id) {
            const remaining = classes.filter(c => c.id !== id);
            setSelectedClassId(remaining.length > 0 ? remaining[0].id : '');
          }
        }}
      />

      <StudentManagerModal
        isOpen={isStudentManagerOpen}
        onClose={() => setIsStudentManagerOpen(false)}
        selectedClass={selectedClass}
        schoolYear={selectedSchoolYear}
        students={classStudents}
        onAddStudent={async (st) => {
          await homeroomService.addStudent(st);
          if (selectedClass) {
            await homeroomService.updateClass(selectedClass.id, {
              totalStudents: (selectedClass.totalStudents || 0) + 1
            });
          }
        }}
        onAddStudentsBulk={async (stList) => {
          await homeroomService.addStudentsBulk(stList);
          if (selectedClass) {
            await homeroomService.updateClass(selectedClass.id, {
              totalStudents: classStudents.length + stList.length
            });
          }
        }}
        onUpdateStudent={async (id, updates) => {
          await homeroomService.updateStudent(id, updates);
        }}
        onDeleteStudent={async (id) => {
          await homeroomService.deleteStudent(id);
          if (selectedClass) {
            await homeroomService.updateClass(selectedClass.id, {
              totalStudents: Math.max(0, (selectedClass.totalStudents || 1) - 1)
            });
          }
        }}
        onDeleteStudentsBulk={async (ids) => {
          await homeroomService.deleteStudentsBulk(ids);
          if (selectedClass) {
            await homeroomService.updateClass(selectedClass.id, {
              totalStudents: Math.max(0, (selectedClass.totalStudents || 0) - ids.length)
            });
          }
        }}
      />

      {selectedStudentForEval && (
        <EvaluationModal
          isOpen={isEvaluationModalOpen}
          onClose={() => setIsEvaluationModalOpen(false)}
          selectedClass={selectedClass}
          student={selectedStudentForEval}
          records={classRecords}
          existingEvaluation={evaluations.find(e => e.studentId === selectedStudentForEval.id && e.period === selectedMonth)}
          periodLabel={selectedMonth}
          onSaveEvaluation={async (ev) => {
            await homeroomService.saveEvaluation(ev);
          }}
          onUpdateStatus={async (id, updates) => {
            await homeroomService.updateEvaluationStatus(id, updates);
          }}
        />
      )}

      {studentToDeleteFromDashboard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Xác nhận xóa học sinh?</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Bạn có chắc chắn muốn xóa học sinh <strong className="text-rose-600">{studentToDeleteFromDashboard.name}</strong> (Mã: {studentToDeleteFromDashboard.code}) khỏi lớp {selectedClass?.name}? Mọi điểm số và rèn luyện liên kết với học sinh này trong lớp sẽ bị xóa vĩnh viễn.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentToDeleteFromDashboard(null)}
                  disabled={isDeletingFromDashboard}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setIsDeletingFromDashboard(true);
                      await homeroomService.deleteStudent(studentToDeleteFromDashboard.id);
                      if (selectedClass) {
                        await homeroomService.updateClass(selectedClass.id, {
                          totalStudents: Math.max(0, (selectedClass.totalStudents || 1) - 1)
                        });
                      }
                      setStudentToDeleteFromDashboard(null);
                    } catch (err: any) {
                      alert('Lỗi khi xóa học sinh: ' + (err.message || err));
                    } finally {
                      setIsDeletingFromDashboard(false);
                    }
                  }}
                  disabled={isDeletingFromDashboard}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg transition-colors"
                >
                  {isDeletingFromDashboard ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
