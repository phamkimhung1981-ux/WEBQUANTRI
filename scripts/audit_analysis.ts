import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/db_summary.json', 'utf8'));

console.log('=== DATA SUMMARY ===');
console.log('violationsCount:', data.violationsCount);
console.log('conductRecordsCount:', data.conductRecordsCount);
console.log('conductEvaluationsCount:', data.conductEvaluationsCount);
console.log('studentTrainingEvaluationsCount:', data.studentTrainingEvaluationsCount);

// Print all conduct_records
console.log('\n--- ALL CONDUCT RECORDS ---');
data.conductRecords.forEach((r: any) => {
  console.log(`[REC] ID: ${r.id}, std: ${r.studentId} (${r.studentName}), class: ${r.className} (${r.classId}), point: ${r.point}, type: ${r.recordType}, date: ${r.recordDate}, week: ${r.weekNumber}, month: ${r.monthNumber}, notes: ${r.notes || r.content}`);
});

// Print all conduct_evaluations
console.log('\n--- ALL CONDUCT EVALUATIONS ---');
data.conductEvaluations.forEach((e: any) => {
  console.log(`[EVAL] ID: ${e.id}, std: ${e.studentId}, class: ${e.classId}, totalScore: ${e.totalScore}, totalMinus: ${e.totalMinus}, period: ${e.period}, rating: ${e.rating}`);
});

// Group violations by student
const vioByStudent = new Map<string, any[]>();
data.violations.forEach((v: any) => {
  const key = `${v.studentId || v.student_id || 'NO_ID'} | ${v.studentName || v.student_name || 'NO_NAME'} | ${v.className || v.class_name || 'NO_CLASS'}`;
  if (!vioByStudent.has(key)) vioByStudent.set(key, []);
  vioByStudent.get(key)!.push(v);
});

console.log('\n--- VIOLATIONS GROUPED BY STUDENT ---');
vioByStudent.forEach((vList, key) => {
  const totalMinus = vList.reduce((sum, v) => sum + (Number(v.minusPoints || v.minus_points) || 0), 0);
  console.log(`\nStudent: ${key} -> Count: ${vList.length}, TotalMinus: ${totalMinus}`);
  vList.forEach(v => {
    console.log(`   - Date: ${v.violationDate || v.violation_date}, Week: ${v.weekNumber || v.week_number}, Month: ${v.monthNumber || v.month_number}, Status: ${v.status}, Minus: ${v.minusPoints || v.minus_points}, Crit: [${v.criterionCode || v.criterion_code}] ${v.criterionName || v.criterion_name}, Content: ${v.content}`);
  });
});
