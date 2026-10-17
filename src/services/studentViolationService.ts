import { youthDisciplineService } from './youthDisciplineService';
import { classificationService } from './classificationService';
import { YouthViolationRecord } from '../types/youthDiscipline';
import { Student, TeacherAssessment } from '../types/homeroom';
import { getWeeksForMonth, isWeekInMonth, getWeekInfoByNumber, parseStartYear } from '../utils/schoolWeekUtils';

export interface StudentViolationSummary {
  studentId: string;
  studentName: string;
  studentCode?: string;
  className: string;
  classId: string;
  violationCount: number;
  totalDeduction: number;
  trainingScore: number;
  classification: string;
  classificationColor?: string;
  badgeStyle?: string;
  violations: YouthViolationRecord[];
}

export interface WeeklyConductBreakdownItem {
  weekNumber: number;
  weekLabel: string;
  timeRangeStr: string;
  rating: string;
  deduction: number;
  violationCount: number;
  violations: YouthViolationRecord[];
  teacherAssessment?: TeacherAssessment | null;
}

export interface MonthlyConductSummary {
  studentId: string;
  studentName: string;
  studentCode?: string;
  className: string;
  classId: string;
  schoolYear: string;
  monthNumber: number;
  monthLabel: string;
  totalWeeksInMonth: number;
  evaluatedWeeksCount: number;
  weeklyResults: WeeklyConductBreakdownItem[];
  totalViolationPoints: number;
  totalDeduction: number;
  trainingScore: number;
  monthlyResult: string;
  classificationColor: string;
  badgeStyle: string;
}

/**
 * Chuẩn hóa và trích xuất thông tin ngày vi phạm (hỗ trợ DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, timestamp ISO)
 */
export function parseViolationDateInfo(dateStr?: string): {
  isoDate: string; // YYYY-MM-DD
  day: number;
  month: number;
  year: number;
} | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // Format 1: DD/MM/YYYY hoặc DD-MM-YYYY (VD: 03/10/2026 hoặc 15-10-2026)
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { isoDate, day, month, year };
  }

  // Format 2: YYYY-MM-DD hoặc YYYY/MM/DD (VD: 2026-10-03 hoặc 2026-10-03T07:15:00)
  const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { isoDate, day, month, year };
  }

  // Fallback qua JS Date
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { isoDate, day, month, year };
    }
  } catch (e) {}

  return null;
}

/**
 * Chuẩn hóa chuỗi tên hoặc ID lớp học để so sánh
 */
export function normalizeClassStr(s?: string): string {
  if (!s) return '';
  return s.toLowerCase().replace(/^(lớp|lop|class|c_|c-)\s*/i, '').replace(/[^a-z0-9]/g, '');
}

/**
 * Kiểm tra xem lớp của bản ghi vi phạm có khớp với lớp của học sinh không
 */
export function isClassMatch(vClassId?: string, vClassName?: string, sClassId?: string, sClassName?: string): boolean {
  if (!vClassId && !vClassName) return false;
  if (!sClassId && !sClassName) return false;

  if (vClassId && sClassId && vClassId.trim().toLowerCase() === sClassId.trim().toLowerCase()) return true;

  const vNormName = normalizeClassStr(vClassName);
  const sNormName = normalizeClassStr(sClassName);
  if (vNormName && sNormName && vNormName === sNormName) return true;

  const vNormId = normalizeClassStr(vClassId);
  const sNormId = normalizeClassStr(sClassId);
  if (vNormId && sNormId && vNormId === sNormId) return true;
  if (vNormName && sNormId && vNormName === sNormId) return true;
  if (vNormId && sNormName && vNormId === sNormName) return true;

  return false;
}

/**
 * Kiểm tra xem bản ghi vi phạm có thuộc về học sinh hay không.
 * BẮT BUỘC KHỚP LỚP HỌC (classId / className) để tránh vi phạm của học sinh lớp này bị gán sang học sinh trùng mã/STT (HS001, HS002...) ở các lớp khác.
 */
export function isStudentMatch(v: YouthViolationRecord, student: Student): boolean {
  // 1. Vi phạm tập thể lớp KHÔNG PHẢI là vi phạm cá nhân của từng học sinh
  if (v.isWholeClass || (v as any).is_whole_class || v.studentId === 'ALL_CLASS' || (v as any).student_id === 'ALL_CLASS') {
    return false;
  }
  const vStdName = (v.studentName || (v as any).student_name || '').trim().toLowerCase();
  if (vStdName.includes('tập thể') || vStdName.includes('toàn trường') || vStdName.includes('cả lớp')) {
    return false;
  }

  // 2. Không bao giờ match bản ghi sample cho học sinh thật
  if (v.id && String(v.id).startsWith('yv_sample_')) {
    if (!student.id || v.studentId !== student.id) return false;
  }

  const vId = (v.studentId || (v as any).student_id || '').trim();
  const sId = (student.id || '').trim();

  // 3. Nếu cả 2 đều có ID học sinh Firestore dạng std_ và khác nhau -> KHÔNG MATCH
  if (vId && sId && vId.startsWith('std_') && sId.startsWith('std_') && vId !== sId) {
    return false;
  }

  // 4. Nếu có cùng ID duy nhất Firestore dạng std_ -> Đã là cùng một học sinh
  if (vId && sId && vId.startsWith('std_') && vId === sId) {
    return true;
  }

  // 5. Đối soát lớp học BẮT BUỘC: Nếu không khớp lớp -> KHÔNG MATCH
  const vClassId = v.classId || (v as any).class_id;
  const vClassName = v.className || (v as any).class_name;
  const sClassId = student.classId || (student as any).class_id;
  const sClassName = student.className || (student as any).class_name;

  if (!isClassMatch(vClassId, vClassName, sClassId, sClassName)) {
    return false;
  }

  // 6. Sau khi LỚP ĐÃ KHỚP CHÍNH XÁC:
  if (vId && sId && vId === sId) {
    return true;
  }

  const sName = (student.fullName || student.name || '').trim().toLowerCase();
  const vCode = (v.studentCode || (v as any).student_code || '').trim().toLowerCase();
  const sCode = (student.code || '').trim().toLowerCase();

  // Khớp qua mã học sinh trong cùng lớp (chỉ khi tên không mâu thuẫn hoàn toàn)
  if (vCode && sCode && vCode === sCode) {
    if (!vStdName || !sName || vStdName === sName) {
      return true;
    }
    // Nếu tên khác nhau hoàn toàn trong cùng 1 lớp (ví dụ gõ nhầm mã), không tự tiện match
    return false;
  }

  // Khớp qua họ và tên trong cùng lớp
  if (vStdName && sName && vStdName === sName) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra xem năm học có khớp nhau (chuẩn hóa các loại dấu gạch ngang)
 */
export function isSchoolYearMatch(vYear?: string, targetYear?: string): boolean {
  if (!vYear || !targetYear || targetYear === 'All') return true;
  const normV = vYear.replace(/[\u2010-\u2015]/g, '-').replace(/\s/g, '').trim();
  const normT = targetYear.replace(/[\u2010-\u2015]/g, '-').replace(/\s/g, '').trim();
  if (!normV || !normT) return true;
  return normV === normT;
}

/**
 * Lấy giá trị điểm trừ dạng số dương tuyệt đối (Math.abs)
 */
export function getViolationMinusPoints(v: YouthViolationRecord): number {
  const val = v.minusPoints !== undefined ? v.minusPoints :
              (v as any).pointsDeducted !== undefined ? (v as any).pointsDeducted :
              (v as any).point !== undefined ? (v as any).point :
              (v as any).diemTru !== undefined ? (v as any).diemTru : 0;
  return Math.abs(Number(val) || 0);
}

export const studentViolationService = {
  // 1. TÍNH ĐIỂM TRỪ THÁNG CHÍNH XÁC - CHỈ TỔNG HỢP VI PHẠM THUỘC ĐÚNG THÁNG ĐÓ
  getMonthlyDeduction(
    student: Student | string,
    schoolYear: string = '2026–2027',
    monthNumber: number = 10,
    violations: YouthViolationRecord[] = []
  ): { totalDeduction: number; violations: YouthViolationRecord[] } {
    const studentObj: Student = typeof student === 'string'
      ? { id: student, code: student, name: student, fullName: student, className: '', classId: '', gender: 'Nam', dob: '' }
      : student;

    const monthlyViolations = violations.filter(v => {
      if (v.status === 'TU_CHOI') return false;
      // Exclude sample records unless explicitly matching student id
      if (v.id && String(v.id).startsWith('yv_sample_')) {
        if (!studentObj.id || v.studentId !== studentObj.id) return false;
      }

      // 1. Lọc theo học sinh (bắt buộc kiểm tra khớp lớp học và danh tính)
      if (!isStudentMatch(v, studentObj)) return false;

      // 2. Lọc theo năm học
      if (!isSchoolYearMatch(v.schoolYear, schoolYear)) return false;

      // 3. Lọc theo tháng: Phải thuộc đúng tháng đang đánh giá
      const dInfo = parseViolationDateInfo(v.violationDate || (v as any).violation_date);
      if (dInfo) {
        return dInfo.month === monthNumber;
      }

      const mNum = Number(v.monthNumber || (v as any).month_number);
      if (mNum && mNum === monthNumber) return true;

      return false;
    });

    // Deduplicate by violation id (mỗi bản ghi chỉ được tính một lần duy nhất)
    const seenIds = new Set<string>();
    const deduplicatedViolations: YouthViolationRecord[] = [];
    for (const v of monthlyViolations) {
      const vKey = v.id || `${v.violationDate}_${v.studentId}_${v.criterionId}`;
      if (!seenIds.has(vKey)) {
        seenIds.add(vKey);
        deduplicatedViolations.push(v);
      }
    }

    const totalDeduction = deduplicatedViolations.reduce((sum, v) => sum + getViolationMinusPoints(v), 0);

    return { totalDeduction, violations: deduplicatedViolations };
  },

  // 2. TÍNH ĐIỂM TRỪ TUẦN CHÍNH XÁC - CHỈ DÙNG KHI CHỌN CHẾ ĐỘ TUẦN
  getWeeklyDeduction(
    student: Student | string,
    schoolYear: string = '2026–2027',
    weekNumber: number = 4,
    violations: YouthViolationRecord[] = []
  ): { totalDeduction: number; violations: YouthViolationRecord[] } {
    const studentObj: Student = typeof student === 'string'
      ? { id: student, code: student, name: student, fullName: student, className: '', classId: '', gender: 'Nam', dob: '' }
      : student;

    const wInfo = getWeekInfoByNumber(weekNumber, schoolYear);

    const weeklyViolations = violations.filter(v => {
      if (v.status === 'TU_CHOI') return false;
      if (v.id && String(v.id).startsWith('yv_sample_')) {
        if (!studentObj.id || v.studentId !== studentObj.id) return false;
      }
      if (!isStudentMatch(v, studentObj)) return false;
      if (!isSchoolYearMatch(v.schoolYear, schoolYear)) return false;

      const dInfo = parseViolationDateInfo(v.violationDate || (v as any).violation_date);
      if (dInfo) {
        return dInfo.isoDate >= wInfo.startDateIso && dInfo.isoDate <= wInfo.endDateIso;
      }
      return Number(v.weekNumber || (v as any).week_number) === Number(weekNumber);
    });

    // Deduplicate by violation id
    const seenIds = new Set<string>();
    const deduplicatedViolations: YouthViolationRecord[] = [];
    for (const v of weeklyViolations) {
      const vKey = v.id || `${v.violationDate}_${v.studentId}_${v.criterionId}`;
      if (!seenIds.has(vKey)) {
        seenIds.add(vKey);
        deduplicatedViolations.push(v);
      }
    }

    const totalDeduction = deduplicatedViolations.reduce((sum, v) => sum + getViolationMinusPoints(v), 0);

    return { totalDeduction, violations: deduplicatedViolations };
  },

  // 3. TÍNH ĐIỂM TRỪ CẢ NĂM HỌC
  getYearlyDeduction(
    student: Student | string,
    schoolYear: string = '2026–2027',
    violations: YouthViolationRecord[] = []
  ): { totalDeduction: number; violations: YouthViolationRecord[] } {
    const studentObj: Student = typeof student === 'string'
      ? { id: student, code: student, name: student, fullName: student, className: '', classId: '', gender: 'Nam', dob: '' }
      : student;

    const yearlyViolations = violations.filter(v => {
      if (v.status === 'TU_CHOI') return false;
      if (v.id && String(v.id).startsWith('yv_sample_')) {
        if (!studentObj.id || v.studentId !== studentObj.id) return false;
      }
      if (!isStudentMatch(v, studentObj)) return false;
      if (!isSchoolYearMatch(v.schoolYear, schoolYear)) return false;
      return true;
    });

    // Deduplicate by violation id
    const seenIds = new Set<string>();
    const deduplicatedViolations: YouthViolationRecord[] = [];
    for (const v of yearlyViolations) {
      const vKey = v.id || `${v.violationDate}_${v.studentId}_${v.criterionId}`;
      if (!seenIds.has(vKey)) {
        seenIds.add(vKey);
        deduplicatedViolations.push(v);
      }
    }

    const totalDeduction = deduplicatedViolations.reduce((sum, v) => sum + getViolationMinusPoints(v), 0);

    return { totalDeduction, violations: deduplicatedViolations };
  },

  // Helper tương thích cũ
  getMonthlyViolationDeduction(
    studentId: string,
    monthNumber: number,
    academicYear: string = '2026–2027',
    violations: YouthViolationRecord[] = []
  ): { totalDeduction: number; violations: YouthViolationRecord[] } {
    return this.getMonthlyDeduction(studentId, academicYear, monthNumber, violations);
  },

  // 4. Tổng hợp điểm rèn luyện & xếp loại học sinh theo phạm vi được chọn (Tuần / Tháng / Năm)
  getStudentViolationSummary(
    student: Student,
    violations: YouthViolationRecord[],
    academicYear: string = '2026–2027',
    periodScope: 'week' | 'month' | 'year' = 'month',
    weekNumber?: number,
    monthNumber?: number
  ): StudentViolationSummary {
    let targetViolations: YouthViolationRecord[] = [];
    let totalDeduction = 0;

    if (periodScope === 'month') {
      const res = this.getMonthlyDeduction(student, academicYear, monthNumber || 10, violations);
      targetViolations = res.violations;
      totalDeduction = res.totalDeduction;

      // Debug log theo yêu cầu
      if (targetViolations.length > 0 || student.code?.includes('07781') || student.id.includes('07781')) {
        console.log("=== MONTHLY DEDUCTION DEBUG ===");
        console.log("Evaluation mode:", periodScope);
        console.log("Selected month:", monthNumber);
        console.log("Selected week:", weekNumber);
        console.log("Student:", student.id, student.fullName || student.name);
        console.log("Monthly violations:", targetViolations.map(v => ({
          date: v.violationDate,
          points: -getViolationMinusPoints(v),
          criterion: v.criterionName
        })));
        console.log("Monthly deduction:", -totalDeduction);
      }
    } else if (periodScope === 'week') {
      const res = this.getWeeklyDeduction(student, academicYear, weekNumber || 4, violations);
      targetViolations = res.violations;
      totalDeduction = res.totalDeduction;
    } else {
      const res = this.getYearlyDeduction(student, academicYear, violations);
      targetViolations = res.violations;
      totalDeduction = res.totalDeduction;
    }

    const trainingScore = Math.max(0, 100 - totalDeduction);

    // Xếp loại theo thang điểm rèn luyện
    const classifMatch = classificationService.getClassificationByScore(
      trainingScore,
      academicYear || '2026–2027'
    );

    const classification =
      classifMatch?.name ||
      (trainingScore >= 90
        ? 'Tốt'
        : trainingScore >= 80
        ? 'Khá'
        : trainingScore >= 65
        ? 'Đạt'
        : 'Chưa đạt');

    const classificationColor =
      classifMatch?.color ||
      (classification === 'Tốt'
        ? '#10B981'
        : classification === 'Khá'
        ? '#3B82F6'
        : classification === 'Đạt'
        ? '#F59E0B'
        : '#EF4444');

    const badgeStyle =
      classification === 'Tốt'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
        : classification === 'Khá'
        ? 'bg-blue-100 text-blue-800 border-blue-300'
        : classification === 'Đạt'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-rose-100 text-rose-800 border-rose-300';

    return {
      studentId: student.id,
      studentName: student.fullName || student.name,
      studentCode: student.code,
      className: student.className || '',
      classId: student.classId || '',
      violationCount: targetViolations.length,
      totalDeduction,
      trainingScore,
      classification,
      classificationColor,
      badgeStyle,
      violations: targetViolations.sort((a, b) => {
        const da = parseViolationDateInfo(a.violationDate)?.isoDate || a.violationDate || '';
        const db = parseViolationDateInfo(b.violationDate)?.isoDate || b.violationDate || '';
        return db.localeCompare(da);
      })
    };
  },

  // 2. Aggregate weekly conduct results for 1 student across all weeks of a month
  getMonthlyConductSummaryForStudent(
    student: Student,
    violations: YouthViolationRecord[],
    teacherAssessments: TeacherAssessment[] = [],
    academicYear: string = '2026–2027',
    monthNumber: number = 9
  ): MonthlyConductSummary {
    const targetWeeks = getWeeksForMonth(monthNumber, academicYear);
    // Fallback if targetWeeks empty
    const weeksToUse = targetWeeks.length > 0 ? targetWeeks : [1, 2, 3, 4];

    // Filter student violations for the entire month
    const monthViolationSummary = this.getStudentViolationSummary(
      student,
      violations,
      academicYear,
      'month',
      undefined,
      monthNumber
    );

    const weeklyResults: WeeklyConductBreakdownItem[] = [];
    let evaluatedWeeksCount = 0;

    for (const w of weeksToUse) {
      const wInfo = getWeekInfoByNumber(w, academicYear);
      // Violations in week w from monthViolationSummary
      const wViolationsRaw = monthViolationSummary.violations.filter(
        v => Number(v.weekNumber) === w || (v.violationDate && v.violationDate >= wInfo.startDateIso && v.violationDate <= wInfo.endDateIso)
      );
      const seenW = new Set<string>();
      const wViolations = wViolationsRaw.filter(v => {
        const k = v.id || `${v.violationDate}_${v.studentId}_${v.criterionId}`;
        if (seenW.has(k)) return false;
        seenW.add(k);
        return true;
      });
      const wDeduction = wViolations.reduce((sum, v) => sum + getViolationMinusPoints(v), 0);

      // Find teacher / Đoàn TN assessment for week w
      const wAssessment = teacherAssessments.find(a =>
        (a.studentId === student.id || (a.studentCode && student.code && a.studentCode === student.code)) &&
        (a.schoolYear || '').replace(/[\u2010-\u2015]/g, '-').trim() === academicYear.replace(/[\u2010-\u2015]/g, '-').trim() &&
        (Number((a as any).weekNumber) === w || (a as any).period === `Tuần ${String(w).padStart(2, '0')}`)
      );

      let rating = 'Chưa đánh giá';
      if (wAssessment && (wAssessment.levelRating || wAssessment.teacherProposedRating)) {
        rating = wAssessment.levelRating || wAssessment.teacherProposedRating || 'Tốt';
        evaluatedWeeksCount++;
      } else if (wViolations.length > 0) {
        const wScore = Math.max(0, 100 - wDeduction);
        const match = classificationService.getClassificationByScore(wScore, academicYear);
        rating = match?.name || (wScore >= 90 ? 'Tốt' : wScore >= 80 ? 'Khá' : wScore >= 65 ? 'Đạt' : 'Chưa đạt');
        evaluatedWeeksCount++;
      } else {
        rating = 'Tốt'; // Mặc định khi không có vi phạm
        evaluatedWeeksCount++;
      }

      weeklyResults.push({
        weekNumber: w,
        weekLabel: `Tuần ${String(w).padStart(2, '0')}`,
        timeRangeStr: wInfo.timeRangeStr,
        rating,
        deduction: wDeduction,
        violationCount: wViolations.length,
        violations: wViolations,
        teacherAssessment: wAssessment || null
      });
    }

    const totalDeduction = monthViolationSummary.totalDeduction;
    const totalViolationPoints = -totalDeduction;
    const trainingScore = monthViolationSummary.trainingScore;
    const monthlyResult = monthViolationSummary.classification;
    const classificationColor = monthViolationSummary.classificationColor || '#10B981';
    const badgeStyle = monthViolationSummary.badgeStyle || 'bg-emerald-100 text-emerald-800 border-emerald-300';

    return {
      studentId: student.id,
      studentName: student.fullName || student.name,
      studentCode: student.code,
      className: student.className || '',
      classId: student.classId || '',
      schoolYear: academicYear,
      monthNumber,
      monthLabel: `Tháng ${String(monthNumber).padStart(2, '0')}`,
      totalWeeksInMonth: weeksToUse.length,
      evaluatedWeeksCount,
      weeklyResults,
      totalViolationPoints,
      totalDeduction,
      trainingScore,
      monthlyResult,
      classificationColor,
      badgeStyle
    };
  },

  // 3. Calculate training score for 1 student
  calculateStudentTrainingScore(
    student: Student,
    violations: YouthViolationRecord[],
    academicYear?: string,
    periodScope?: 'week' | 'month' | 'year',
    weekNumber?: number,
    monthNumber?: number
  ) {
    const summary = this.getStudentViolationSummary(
      student,
      violations,
      academicYear,
      periodScope,
      weekNumber,
      monthNumber
    );

    return {
      studentId: student.id,
      totalDeduction: summary.totalDeduction,
      trainingScore: summary.trainingScore,
      classification: summary.classification,
      classificationColor: summary.classificationColor,
      violationCount: summary.violationCount,
      violations: summary.violations
    };
  },

  // 4. Calculate for all students in a class
  calculateClassStudentEvaluations(
    students: Student[],
    violations: YouthViolationRecord[],
    academicYear?: string,
    periodScope?: 'week' | 'month' | 'year',
    weekNumber?: number,
    monthNumber?: number
  ): Map<string, StudentViolationSummary> {
    const map = new Map<string, StudentViolationSummary>();

    students.forEach(st => {
      const summary = this.getStudentViolationSummary(
        st,
        violations,
        academicYear,
        periodScope,
        weekNumber,
        monthNumber
      );
      map.set(st.id, summary);
    });

    return map;
  }
};
