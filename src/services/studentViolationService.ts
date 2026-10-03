import { youthDisciplineService } from './youthDisciplineService';
import { classificationService } from './classificationService';
import { YouthViolationRecord } from '../types/youthDiscipline';
import { Student } from '../types/homeroom';

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

export const studentViolationService = {
  // 1. Get student violation summary from violations array
  getStudentViolationSummary(
    student: Student,
    violations: YouthViolationRecord[],
    academicYear?: string,
    periodScope?: 'week' | 'month' | 'year',
    weekNumber?: number,
    monthNumber?: number
  ): StudentViolationSummary {
    const studentViolations = violations.filter(v => {
      if (v.status === 'TU_CHOI') return false;

      // Student match (by student.id or student.code)
      const matchesStudent =
        (v.studentId && student.id && v.studentId === student.id) ||
        (student.code && v.studentCode && v.studentCode === student.code) ||
        (v.studentId && student.code && v.studentId === student.code);

      if (!matchesStudent) return false;

      // Academic Year match
      if (academicYear && academicYear !== 'All') {
        const vY = (v.schoolYear || '').replace(/[\u2010-\u2015]/g, '-').trim();
        const aY = academicYear.replace(/[\u2010-\u2015]/g, '-').trim();
        if (vY && aY && vY !== aY) return false;
      }

      // Period Scope filter
      if (periodScope === 'week' && weekNumber !== undefined && weekNumber > 0) {
        if (v.weekNumber !== weekNumber) return false;
      } else if (periodScope === 'month' && monthNumber !== undefined && monthNumber > 0) {
        if (v.monthNumber !== monthNumber) return false;
      }

      return true;
    });

    const totalDeduction = studentViolations.reduce(
      (sum, v) => sum + Math.abs(Number(v.minusPoints) || 0),
      0
    );

    const trainingScore = Math.max(0, 100 - totalDeduction);

    // Get classification from classificationService
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
      violationCount: studentViolations.length,
      totalDeduction,
      trainingScore,
      classification,
      classificationColor,
      badgeStyle,
      violations: studentViolations.sort(
        (a, b) => new Date(b.violationDate).getTime() - new Date(a.violationDate).getTime()
      )
    };
  },

  // 2. Calculate training score for 1 student
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

  // 3. Calculate for all students in a class
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
