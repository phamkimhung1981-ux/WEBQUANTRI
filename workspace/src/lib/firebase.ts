import { initializeApp, getApps } from 'firebase/app';
import { 
  initializeFirestore, 
  getFirestore,
  memoryLocalCache 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase (singleton check)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore strictly with memoryLocalCache to eliminate QuotaExceededError and IndexedDB ID: b815 assertion errors on Vercel
let db: any;
const dbId = (firebaseConfig as any).firestoreDatabaseId;

try {
  db = dbId ? initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  }, dbId) : initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  });
} catch (e) {
  console.warn('initializeFirestore with memoryLocalCache failed, attempting getFirestore fallback:', e);
  try {
    db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (err) {
    try {
      db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
    } catch (err2) {
      console.error('All initializeFirestore attempts failed, using default getFirestore:', err2);
      db = getFirestore(app);
    }
  }
}

// Initialize Auth
const auth = getAuth(app);

export { app, db, auth };
