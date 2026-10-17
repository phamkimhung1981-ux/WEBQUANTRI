import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function inspect() {
  console.log('Connecting to database:', firebaseConfig.firestoreDatabaseId);

  const collectionsToCheck = [
    'youth_discipline_violations',
    'conduct_records',
    'conduct_evaluations',
    'teacher_assessments',
    'students',
    'classes',
    'student_training_evaluations'
  ];

  for (const colName of collectionsToCheck) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`\n=== Collection: ${colName} (Count: ${snap.size}) ===`);
      snap.docs.forEach(d => {
        const data = d.data();
        if (colName === 'youth_discipline_violations') {
          console.log(`[VIO] ID: ${d.id}, std: ${data.studentId || data.student_id} (${data.studentName || data.student_name}), code: ${data.studentCode || data.student_code}, class: ${data.className || data.class_name}, minus: ${data.minusPoints ?? data.minus_points}, date: ${data.violationDate || data.violation_date}, week: ${data.weekNumber}, month: ${data.monthNumber}, status: ${data.status}, crit: ${data.criterionName || data.criterion_name}`);
        } else if (colName === 'conduct_records') {
          console.log(`[REC] ID: ${d.id}, std: ${data.studentId} (${data.studentName}), class: ${data.className}, point: ${data.point}, type: ${data.recordType}, date: ${data.recordDate}, week: ${data.weekNumber}, month: ${data.monthNumber}`);
        } else if (colName === 'conduct_evaluations') {
          console.log(`[EVAL] ID: ${d.id}, std: ${data.studentId}, class: ${data.classId}, totalScore: ${data.totalScore}, totalMinus: ${data.totalMinus}, period: ${data.period}`);
        } else if (colName === 'teacher_assessments') {
          console.log(`[TA] ID: ${d.id}, std: ${data.studentId} (${data.studentName}), class: ${data.className}, month: ${data.month}, week: ${data.weekNumber}, minusPoints: ${data.minusPoints}, rating: ${data.teacherProposedRating || data.levelRating}`);
        } else if (colName === 'students') {
          console.log(`[STD] ID: ${d.id}, name: ${data.fullName || data.name}, code: ${data.code}, class: ${data.className} (${data.classId})`);
        }
      });
    } catch (e: any) {
      console.error(`Error querying ${colName}:`, e.message);
    }
  }
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
