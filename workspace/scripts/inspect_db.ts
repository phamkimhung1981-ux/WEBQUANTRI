import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function inspect() {
  const snap = await getDocs(collection(db, 'kpi_staff_forms'));
  console.log('RESULT_COUNT:', snap.size);
  snap.docs.forEach((d, i) => {
    if (i < 10) {
      const data = d.data();
      console.log(`  [${i}] ID: ${d.id}, name: ${data.employeeName}, period: ${data.periodId}, year: ${data.academicYear}`);
    }
  });
}

inspect().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
