import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function inspect() {
  const collections = ['kpi_staff_forms', 'kpi_cbql_forms', 'kpi_vc_forms'];
  for (const c of collections) {
    try {
      const snap = await getDocs(collection(db, c));
      console.log(`Collection "${c}": count = ${snap.size}`);
      snap.docs.forEach((d, idx) => {
        if (idx < 5) {
          const data = d.data();
          console.log(`  - doc ${d.id}: employeeId=${data.employeeId}, employeeName=${data.employeeName}, periodId=${data.periodId}`);
        }
      });
    } catch (e: any) {
      console.log(`Error querying ${c}:`, e.message);
    }
  }
}

inspect().then(() => process.exit(0));
