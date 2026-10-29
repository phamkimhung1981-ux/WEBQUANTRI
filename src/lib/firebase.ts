import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  memoryLocalCache,
  getFirestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfigFile from '../../firebase-applet-config.json';

// Cấu hình Firebase thống nhất hỗ trợ đồng bộ giữa Google AI Studio, Localhost và Vercel
const activeConfig = {
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || firebaseConfigFile.projectId || 'windy-system-q9v0l',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || firebaseConfigFile.appId || '1:321892479741:web:505faffb1d2617c4518494',
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || firebaseConfigFile.apiKey || 'AIzaSyDCgc-PUxKCviTEI1DVAb5ozBTzGy7qHnQ',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFile.authDomain || 'windy-system-q9v0l.firebaseapp.com',
  firestoreDatabaseId: (import.meta as any).env?.VITE_FIREBASE_DATABASE_ID || (firebaseConfigFile as any).firestoreDatabaseId || 'ai-studio-hthngqunlgiovint-0d69b880-7502-4902-b08f-94cb8fcead53',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFile.storageBucket || 'windy-system-q9v0l.firebasestorage.app',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFile.messagingSenderId || '321892479741'
};

// Initialize Firebase as singleton
const app = getApps().length > 0 ? getApp() : initializeApp(activeConfig);

const firestoreDbId = activeConfig.firestoreDatabaseId;

let db: any;
try {
  // Sử dụng memoryLocalCache() để đảm bảo ổn định 100% trên mọi trình duyệt (Chrome, Cốc Cốc, Safari, iFrames Vercel)
  // Loại bỏ hoàn toàn IndexedDB multi-tab lock deadlocks và FIRESTORE INTERNAL ASSERTION FAILED
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

export const getFirebaseConfigDetails = () => ({
  projectId: activeConfig.projectId,
  firestoreDatabaseId: firestoreDbId,
  authDomain: activeConfig.authDomain,
  isProduction: Boolean((import.meta as any).env?.PROD)
});

export { app, db, auth };
