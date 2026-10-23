import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const collectionsToInspect = [
  'teachers',
  'departments',
  'classes',
  'students',
  'homeroom_assignments',
  'conduct_records',
  'conduct_evaluations',
  'teacher_assessments',
  'youth_discipline_violations',
  'youth_discipline_criteria',
  'kpi_vc_forms',
  'kpi_staff_forms',
  'kpi_cbql_forms',
  'kpiRecords',
  'kpis',
  'workAssignments',
  'schoolWorkSchedules',
  'facility_damage_reports',
  'leaves'
];

async function run() {
  console.log('--- FIRESTORE COLLECTIONS AUDIT ---');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Database ID:', firebaseConfig.firestoreDatabaseId);

  for (const colName of collectionsToInspect) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`[${colName}]: ${snap.size} documents`);
    } catch (e: any) {
      console.error(`[${colName}] ERROR:`, e.message);
    }
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
