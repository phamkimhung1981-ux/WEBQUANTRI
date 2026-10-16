import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with fallback for quota / persistence errors
let db: any;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalAutoDetectLongPolling: true,
  }, (firebaseConfig as any).firestoreDatabaseId);
} catch (e) {
  console.warn('Persistent local cache failed (quota exceeded or un-supported environment), falling back to memory cache:', e);
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
