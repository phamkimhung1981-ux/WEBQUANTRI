import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { DEFAULT_VC_PERIODS, getEligibleVcTeachers } from '../src/lib/kpiVcData';
import { cleanFirestoreData } from '../src/services/kpiVcService';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkAndSeed() {
  const vcSnap = await getDocs(collection(db, 'kpi_vc_forms'));
  console.log('FIRESTORE kpi_vc_forms count:', vcSnap.size);

  const staffSnap = await getDocs(collection(db, 'kpi_staff_forms'));
  console.log('FIRESTORE kpi_staff_forms count:', staffSnap.size);

  const teachersSnap = await getDocs(collection(db, 'teachers'));
  const teachers = teachersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const eligibleVc = getEligibleVcTeachers(teachers);
  console.log('Eligible VC teachers count:', eligibleVc.length);

  // If kpi_vc_forms is empty or small (e.g. 0), seed forms for eligible VC teachers for Sep 2026 / period
  if (vcSnap.size < 40 && eligibleVc.length > 0) {
    console.log('Seeding VC forms into Firestore...');
    const period = DEFAULT_VC_PERIODS.find(p => p.id === 'vc_period_2026_2027_m09') || DEFAULT_VC_PERIODS[0];
    
    // We can fetch criteria snapshot or use default criteria items
    for (const t of eligibleVc) {
      const formId = `vc_form_${t.id}_${period.id}`;
      const formPayload = {
        id: formId,
        employeeId: t.id,
        employeeName: t.name || 'Giáo viên',
        employeeCode: t.code || `GV_${t.id}`,
        employeeUsername: t.username || '',
        position: t.position || 'Giáo viên',
        department: t.departmentName || 'Trường THPT Sơn Lương',
        departmentId: t.departmentId || null,
        periodId: period.id,
        periodName: period.name,
        academicYear: period.academicYear,
        totalScore: 0,
        maxTotalScore: 100,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system_sync'
      };
      await setDoc(doc(db, 'kpi_vc_forms', formId), cleanFirestoreData(formPayload), { merge: true });
    }
    const newVcSnap = await getDocs(collection(db, 'kpi_vc_forms'));
    console.log('FINAL FIRESTORE kpi_vc_forms count:', newVcSnap.size);
  }
}

checkAndSeed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
