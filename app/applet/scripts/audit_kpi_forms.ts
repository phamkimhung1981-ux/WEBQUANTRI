import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function auditForms() {
  const snapshot = await getDocs(collection(db, 'kpi_vc_forms'));
  console.log(`Total KPI teacher forms in Firestore: ${snapshot.size}`);

  let score100Count = 0;
  let score0Count = 0;
  let scoreOtherCount = 0;
  const score100Details: any[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const score = data.totalScore;
    const name = data.employeeName;
    const period = data.periodName || data.periodId;
    const status = data.status;

    if (score === 100) {
      score100Count++;
      score100Details.push({ id: docSnap.id, name, period, status, itemsCount: data.items?.length });
    } else if (score === 0 || score === null || score === undefined) {
      score0Count++;
    } else {
      scoreOtherCount++;
    }
  });

  console.log(`- Score = 100: ${score100Count}`);
  console.log(`- Score = 0 / null: ${score0Count}`);
  console.log(`- Score other (1-99): ${scoreOtherCount}`);

  if (score100Details.length > 0) {
    console.log('Forms with score 100:');
    score100Details.forEach(d => console.log(`  * [${d.id}] ${d.name} (${d.period}) - Status: ${d.status}`));
  }

  process.exit(0);
}

auditForms().catch(e => { console.error(e); process.exit(1); });
