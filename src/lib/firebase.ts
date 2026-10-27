import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
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
  // Ưu tiên sử dụng persistentLocalCache (IndexedDB) trên trình duyệt để lưu bền vững dữ liệu, chống mất điểm khi tải lại trang hoặc mất mạng
  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalAutoDetectLongPolling: true,
    }, firestoreDbId);
  } else {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    }, firestoreDbId);
  }
} catch (e) {
  try {
    db = getFirestore(app, firestoreDbId);
  } catch (err) {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    }, firestoreDbId);
  }
}

// Initialize Auth
const auth = getAuth(app);

export { app, db, auth };
