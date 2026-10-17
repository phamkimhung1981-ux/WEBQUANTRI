import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const violationsSnap = await getDocs(collection(db, 'youth_discipline_violations'));
  const violations = violationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const conductRecsSnap = await getDocs(collection(db, 'conduct_records'));
  const conductRecs = conductRecsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const conductEvalsSnap = await getDocs(collection(db, 'conduct_evaluations'));
  const conductEvals = conductEvalsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const steSnap = await getDocs(collection(db, 'student_training_evaluations'));
  const ste = steSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const summary = {
    violationsCount: violations.length,
    violations,
    conductRecordsCount: conductRecs.length,
    conductRecords: conductRecs,
    conductEvaluationsCount: conductEvals.length,
    conductEvaluations: conductEvals,
    studentTrainingEvaluationsCount: ste.length,
    studentTrainingEvaluations: ste
  };

  fs.writeFileSync('scripts/db_summary.json', JSON.stringify(summary, null, 2), 'utf8');
  console.log('Saved to scripts/db_summary.json successfully!');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
