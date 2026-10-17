import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { DEFAULT_STAFF_PERIODS, getEligibleStaffMembers, createInitialStaffForm } from '../src/lib/kpiStaffData';
import { cleanFirestoreData } from '../src/services/kpiStaffService';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function seed() {
  const teachersSnap = await getDocs(collection(db, 'teachers'));
  const teachers = teachersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  console.log('Total teachers in Firestore:', teachers.length);

  const period = DEFAULT_STAFF_PERIODS.find(p => p.id === 'period_staff_m09_2026') || DEFAULT_STAFF_PERIODS[0];
  const eligible = getEligibleStaffMembers(teachers as any);
  console.log('Eligible staff members count:', eligible.length);

  for (const t of eligible) {
    const form = createInitialStaffForm(t as any, period);
    const docRef = doc(db, 'kpi_staff_forms', form.id);
    await setDoc(docRef, cleanFirestoreData(form), { merge: true });
  }

  const formsSnap = await getDocs(collection(db, 'kpi_staff_forms'));
  console.log('FINAL FIRESTORE kpi_staff_forms count:', formsSnap.size);
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
