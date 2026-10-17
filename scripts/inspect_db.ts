import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkCounts() {
  const vcSnap = await getDocs(collection(db, 'kpi_vc_forms'));
  console.log('KPI Teacher Forms (kpi_vc_forms):', vcSnap.size);

  const staffSnap = await getDocs(collection(db, 'kpi_staff_forms'));
  console.log('KPI Staff Forms (kpi_staff_forms):', staffSnap.size);
}

checkCounts().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
