import { initializeApp } from 'firebase/app';
import { initializeFirestore, getFirestore, memoryLocalCache } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

console.log('Testing initializeFirestore with databaseId:');
try {
  const db1 = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
  console.log('db1 databaseId:', (db1 as any)._databaseId?.database || (db1 as any).databaseId);
} catch (e: any) {
  console.error('db1 failed:', e.message);
}

try {
  const db2 = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  console.log('db2 databaseId:', (db2 as any)._databaseId?.database || (db2 as any).databaseId);
} catch (e: any) {
  console.error('db2 failed:', e.message);
}
