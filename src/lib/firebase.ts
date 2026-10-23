import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  memoryLocalCache,
  getFirestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;

let db: any;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  }, firestoreDbId);
} catch (e) {
  try {
    db = getFirestore(app, firestoreDbId);
  } catch (err) {
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    }, firestoreDbId);
  }
}

// Initialize Auth
const auth = getAuth(app);

export { app, db, auth };
