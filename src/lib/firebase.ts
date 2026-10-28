import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  memoryLocalCache,
  getFirestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase as singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;

let db: any;
try {
  // Sử dụng memoryLocalCache() để đảm bảo ổn định 100% trên mọi trình duyệt (Chrome, Cốc Cốc, Safari, iFrames Vercel)
  // Loại bỏ hoàn toàn IndexedDB multi-tab lock deadlocks và FIRESTORE INTERNAL ASSERTION FAILED (ID: b815)
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  }, firestoreDbId);
} catch (e) {
  try {
    db = getFirestore(app, firestoreDbId);
  } catch (err) {
    db = initializeFirestore(app, {}, firestoreDbId);
  }
}

// Initialize Auth
const auth = getAuth(app);

export { app, db, auth };
