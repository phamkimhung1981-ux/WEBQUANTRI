import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function inspect() {
  const violationsSnap = await getDocs(collection(db, 'youth_discipline_violations'));
  console.log(`\n>>> youth_discipline_violations count: ${violationsSnap.size}`);
  violationsSnap.docs.forEach(d => {
    console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 2));
  });

  const conductRecsSnap = await getDocs(collection(db, 'conduct_records'));
  console.log(`\n>>> conduct_records count: ${conductRecsSnap.size}`);
  conductRecsSnap.docs.forEach(d => {
    console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 2));
  });

  const conductEvalsSnap = await getDocs(collection(db, 'conduct_evaluations'));
  console.log(`\n>>> conduct_evaluations count: ${conductEvalsSnap.size}`);
  conductEvalsSnap.docs.forEach(d => {
    console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 2));
  });

  const teacherAssessmentsSnap = await getDocs(collection(db, 'teacher_assessments'));
  console.log(`\n>>> teacher_assessments count: ${teacherAssessmentsSnap.size}`);
  teacherAssessmentsSnap.docs.forEach(d => {
    console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 2));
  });

  const steSnap = await getDocs(collection(db, 'student_training_evaluations'));
  console.log(`\n>>> student_training_evaluations count: ${steSnap.size}`);
  steSnap.docs.forEach(d => {
    console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 2));
  });
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
