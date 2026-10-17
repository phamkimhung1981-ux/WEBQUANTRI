import * as fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { parseViolationDateInfo, getViolationMinusPoints, isSchoolYearMatch } from '../src/services/studentViolationService';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

function normalizeClass(nameOrId?: string): string {
  if (!nameOrId) return '';
  return nameOrId.toLowerCase().replace(/^(lớp|lop|class|c_|c-)\s*/i, '').replace(/[^a-z0-9]/g, '');
}

function isClassMatch(vClassId?: string, vClassName?: string, sClassId?: string, sClassName?: string): boolean {
  if (!vClassId && !vClassName) return true;
  if (!sClassId && !sClassName) return true;

  if (vClassId && sClassId && vClassId === sClassId) return true;

  const vNormName = normalizeClass(vClassName);
  const sNormName = normalizeClass(sClassName);
  if (vNormName && sNormName && vNormName === sNormName) return true;

  const vNormId = normalizeClass(vClassId);
  const sNormId = normalizeClass(sClassId);
  if (vNormId && sNormId && vNormId === sNormId) return true;
  if (vNormName && sNormId && vNormName === sNormId) return true;
  if (vNormId && sNormName && vNormId === sNormName) return true;

  return false;
}

function isStudentMatchFixed(v: any, student: any): boolean {
  // Collective class violation is never an individual student violation
  if (v.isWholeClass || v.is_whole_class || v.studentId === 'ALL_CLASS' || v.student_id === 'ALL_CLASS') {
    return false;
  }
  const vStdName = (v.studentName || v.student_name || '').trim().toLowerCase();
  if (vStdName.includes('tập thể') || vStdName.includes('toàn trường') || vStdName.includes('cả lớp')) {
    return false;
  }

  // Never match sample records
  if (v.id && String(v.id).startsWith('yv_sample_')) {
    if (!student.id || v.studentId !== student.id) return false;
  }

  const vClassId = v.classId || v.class_id;
  const vClassName = v.className || v.class_name;
  const sClassId = student.classId || student.class_id;
  const sClassName = student.className || student.class_name;

  // Strict Class Match check
  const classMatches = isClassMatch(vClassId, vClassName, sClassId, sClassName);
  if (!classMatches) {
    return false;
  }

  const vId = v.studentId || v.student_id;
  const sId = student.id;

  // If both have explicit student IDs
  if (vId && sId) {
    if (vId === sId) return true;
    // If both have different std_ IDs, they are different students
    if (vId.startsWith('std_') && sId.startsWith('std_') && vId !== sId) {
      return false;
    }
  }

  // Check code (with class match guaranteed)
  const vCode = (v.studentCode || v.student_code || '').trim();
  const sCode = (student.code || '').trim();
  if (vCode && sCode && vCode === sCode) {
    return true;
  }

  // Check full name (with class match guaranteed)
  const sName = (student.fullName || student.name || '').trim().toLowerCase();
  if (vStdName && sName && vStdName === sName) {
    return true;
  }

  return false;
}

function getMonthlyDeductionFixed(student: any, schoolYear: string, monthNumber: number, violations: any[]) {
  const matched = violations.filter(v => {
    if (v.status === 'TU_CHOI') return false;

    // 1. Student match
    if (!isStudentMatchFixed(v, student)) return false;

    // 2. School year match
    if (!isSchoolYearMatch(v.schoolYear || v.school_year, schoolYear)) return false;

    // 3. Month match: strictly belong to this month
    const dInfo = parseViolationDateInfo(v.violationDate || v.violation_date);
    if (dInfo) {
      return dInfo.month === monthNumber;
    }

    // Fallback to monthNumber on record
    const mNum = Number(v.monthNumber || v.month_number);
    if (mNum && mNum === monthNumber) return true;

    return false;
  });

  // Deduplicate violations by violation id
  const seenIds = new Set<string>();
  const uniqueViolations: any[] = [];
  for (const v of matched) {
    if (!seenIds.has(v.id)) {
      seenIds.add(v.id);
      uniqueViolations.push(v);
    }
  }

  const totalDeduction = uniqueViolations.reduce((sum, v) => sum + getViolationMinusPoints(v), 0);
  return { totalDeduction, violations: uniqueViolations };
}

async function run() {
  const summary = JSON.parse(fs.readFileSync('scripts/db_summary.json', 'utf8'));
  const violations = summary.violations;

  const stdSnap = await getDocs(collection(db, 'students'));
  const students = stdSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  console.log(`Auditing ${students.length} students with FIXED logic...`);

  for (const m of [9, 10]) {
    console.log(`\n=== FIXED RESULTS FOR MONTH ${m} ===`);
    const results: any[] = [];
    students.forEach(st => {
      const res = getMonthlyDeductionFixed(st, '2026–2027', m, violations);
      if (res.totalDeduction > 0) {
        results.push({
          student: st,
          totalDeduction: res.totalDeduction,
          violations: res.violations
        });
      }
    });

    console.log(`Total students with deductions in Month ${m}: ${results.length}`);
    results.sort((a, b) => b.totalDeduction - a.totalDeduction);
    results.forEach(r => {
      console.log(`- ${r.student.fullName || r.student.name} (${r.student.code}) [${r.student.className}]: -${r.totalDeduction}đ (${r.violations.length} vi phạm)`);
      r.violations.forEach((v: any) => {
        console.log(`    * [${v.violationDate || v.violation_date}] ${v.criterionName || v.criterion_name}: -${v.minusPoints || v.minus_points}đ (Record HS: ${v.studentName}, Class: ${v.className})`);
      });
    });
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
