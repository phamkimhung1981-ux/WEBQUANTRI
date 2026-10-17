import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  memoryLocalCache 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with memoryLocalCache to eliminate QuotaExceededError and IndexedDB ID: b815 assertion errors on Vercel
let db: any;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  }, (firebaseConfig as any).firestoreDatabaseId);
} catch (e) {
  console.warn('initializeFirestore with memoryLocalCache failed, falling back to default:', e);
  try {
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    }, (firebaseConfig as any).firestoreDatabaseId);
  } catch (err) {
    db = initializeFirestore(app, {});
  }
}

// Initialize Auth
const auth = getAuth(app);

export { app, db, auth };
