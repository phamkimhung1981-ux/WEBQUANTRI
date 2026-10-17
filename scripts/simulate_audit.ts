import * as fs from 'fs';
import { studentViolationService, parseViolationDateInfo, isStudentMatch, isSchoolYearMatch, getViolationMinusPoints } from '../src/services/studentViolationService';

const summary = JSON.parse(fs.readFileSync('scripts/db_summary.json', 'utf8'));
const violations = summary.violations;
const conductRecords = summary.conductRecords;

// We also need the students from Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function runAudit() {
  const stdSnap = await getDocs(collection(db, 'students'));
  const students = stdSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  console.log(`Loaded ${students.length} students from Firestore.`);

  for (const m of [9, 10]) {
    console.log(`\n================== AUDIT FOR MONTH ${m} ==================`);
    const studentsWithDeductions: any[] = [];

    students.forEach(st => {
      const { totalDeduction, violations: matchedVios } = studentViolationService.getMonthlyDeduction(
        st,
        '2026–2027',
        m,
        violations
      );

      // Also check conduct_records for this student in month m
      const matchingConductRecords = conductRecords.filter((r: any) => {
        if (r.studentId !== st.id) return false;
        const rMonth = Number(r.monthNumber) || (r.recordDate ? new Date(r.recordDate).getMonth() + 1 : null);
        return rMonth === m;
      });
      const conductRecordsMinus = matchingConductRecords.reduce((sum: number, r: any) => {
        if (r.recordType === 'TICH_CUC' || r.point >= 0) return sum;
        return sum + Math.abs(Number(r.point) || 0);
      }, 0);

      if (totalDeduction > 0 || matchingConductRecords.length > 0 || conductRecordsMinus > 0) {
        studentsWithDeductions.push({
          studentId: st.id,
          studentCode: st.code,
          studentName: st.fullName || st.name,
          className: st.className,
          classId: st.classId,
          totalDeductionFromYouthVios: totalDeduction,
          matchedYouthViosCount: matchedVios.length,
          matchedYouthVios: matchedVios.map((v: any) => ({
            id: v.id,
            date: v.violationDate,
            month: v.monthNumber,
            week: v.weekNumber,
            minusPoints: v.minusPoints,
            criterion: v.criterionName,
            status: v.status,
            recordedBy: v.recordedByName || v.recordedBy,
            studentNameOnVio: v.studentName,
            studentCodeOnVio: v.studentCode,
            classNameOnVio: v.className
          })),
          conductRecordsMinus,
          conductRecordsCount: matchingConductRecords.length,
          matchingConductRecords: matchingConductRecords.map((r: any) => ({
            id: r.id,
            date: r.recordDate,
            point: r.point,
            criterionName: r.criterionName,
            type: r.recordType
          }))
        });
      }
    });

    console.log(`Found ${studentsWithDeductions.length} students with deductions in Month ${m}.`);
    studentsWithDeductions.sort((a, b) => b.totalDeductionFromYouthVios - a.totalDeductionFromYouthVios);
    studentsWithDeductions.forEach(s => {
      console.log(`\nHS: ${s.studentName} (${s.studentCode}) - Lớp: ${s.className}`);
      console.log(`   YouthVio Deduction: ${s.totalDeductionFromYouthVios} (Vios count: ${s.matchedYouthViosCount})`);
      s.matchedYouthVios.forEach((v: any) => {
        console.log(`      [YOUTH VIO] ${v.id}: ${v.date} (W${v.week}, M${v.month}) | ${v.criterion} | -${v.minusPoints}đ | status: ${v.status} | HS on record: ${v.studentNameOnVio} (${v.studentCodeOnVio}, ${v.classNameOnVio})`);
      });
      if (s.conductRecordsCount > 0) {
        console.log(`   ConductRecords Deduction: ${s.conductRecordsMinus} (Records count: ${s.conductRecordsCount})`);
        s.matchingConductRecords.forEach((r: any) => {
          console.log(`      [CONDUCT REC] ${r.id}: ${r.date} | ${r.criterionName} | ${r.point}đ`);
        });
      }
    });
  }
  process.exit(0);
}

runAudit().catch(e => { console.error(e); process.exit(1); });
