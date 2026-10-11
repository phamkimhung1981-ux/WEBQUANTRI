import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  KpiEvidenceFile, 
  ALLOWED_EVIDENCE_EXTENSIONS, 
  ALLOWED_EVIDENCE_MIME_TYPES, 
  MAX_EVIDENCE_FILE_SIZE 
} from '../types/kpiEvidence';
import { cleanFirestoreData } from './kpiVcService';

const COLLECTION_NAME = 'kpi_evidence_files';
const DB_NAME = 'SonLuong_KPI_Evidence_DB';
const STORE_NAME = 'evidence_files';

// IndexedDB Helper for robust local storage of heavy files
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ trong trình duyệt này.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('formId', 'formId', { unique: false });
        store.createIndex('criterionId', 'criterionId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDB(fileItem: KpiEvidenceFile): Promise<void> {
  try {
    const idb = await openIndexedDB();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(fileItem);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Không thể ghi vào IndexedDB:', err);
  }
}

async function removeFromIndexedDB(id: string): Promise<void> {
  try {
    const idb = await openIndexedDB();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Không thể xóa từ IndexedDB:', err);
  }
}

async function getFromIndexedDBForForm(formId: string): Promise<KpiEvidenceFile[]> {
  try {
    const idb = await openIndexedDB();
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('formId');
    const request = index.getAll(formId);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as KpiEvidenceFile[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Không thể đọc từ IndexedDB:', err);
    return [];
  }
}

/**
 * Validate a file before upload
 */
export function validateEvidenceFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Tệp không tồn tại.' };
  }

  // Size check
  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return { 
      valid: false, 
      error: `Dung lượng tệp (${sizeMB} MB) vượt quá giới hạn cho phép (10 MB). Vui lòng chọn tệp nhỏ hơn.` 
    };
  }

  // Format check
  const filename = file.name.toLowerCase();
  const ext = '.' + filename.split('.').pop();
  const isValidExt = ALLOWED_EVIDENCE_EXTENSIONS.includes(ext);
  const isValidMime = ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type) || file.type.startsWith('image/');

  if (!isValidExt && !isValidMime) {
    return {
      valid: false,
      error: `Định dạng tệp "${ext}" không được hỗ trợ. Vui lòng tải lên tệp PDF, Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx) hoặc ảnh (JPG, PNG, WEBP).`
    };
  }

  return { valid: true };
}

// Internal event emitter for local state sync across tabs & components
type EvidenceChangeListener = (formId: string) => void;
const changeListeners = new Set<EvidenceChangeListener>();

export function notifyEvidenceChanged(formId: string) {
  changeListeners.forEach(fn => {
    try {
      fn(formId);
    } catch (e) {
      console.error('Error in evidence change listener:', e);
    }
  });
}

// Persistent deleted file tracker to prevent deleted files from re-appearing due to cache or latency
const DELETED_FILES_KEY = 'SonLuong_KPI_Deleted_Evidence_IDs';

export function getDeletedFileIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_FILES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    console.warn('Lỗi đọc danh sách tệp đã xóa từ localStorage:', e);
  }
  return new Set();
}

export function markFileAsDeleted(id: string): void {
  if (!id) return;
  const cleanId = id.trim();
  const ids = getDeletedFileIds();
  ids.add(cleanId);
  try {
    localStorage.setItem(DELETED_FILES_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.warn('Lỗi lưu tệp đã xóa vào localStorage:', e);
  }
}

export function onEvidenceChanged(fn: EvidenceChangeListener) {
  changeListeners.add(fn);
  return () => {
    changeListeners.delete(fn);
  };
}

/**
 * Save / upload an evidence file
 */
export async function saveEvidenceFile(fileItem: KpiEvidenceFile): Promise<void> {
  const cleanData = cleanFirestoreData(fileItem);
  
  // 1. Save locally to IndexedDB
  await saveToIndexedDB(fileItem);

  // 2. Save to Firestore if within doc size limit (~900KB Base64 data)
  try {
    const dataStr = JSON.stringify(cleanData);
    if (dataStr.length < 900000) {
      const docRef = doc(db, COLLECTION_NAME, fileItem.id);
      await setDoc(docRef, cleanData, { merge: true });
    }
  } catch (err) {
    console.error('Lỗi khi lưu minh chứng vào Firestore:', err);
  }

  // 3. Notify listeners
  if (fileItem.formId) {
    notifyEvidenceChanged(fileItem.formId);
  }
}

/**
 * Reassign evidence files formId (e.g. from draft_... to kpif_...)
 */
export async function reassignEvidenceFilesFormId(oldFormId: string, newFormId: string): Promise<void> {
  if (!oldFormId || !newFormId || oldFormId === newFormId) return;

  try {
    // 1. Reassign in IndexedDB
    const idbFiles = await getFromIndexedDBForForm(oldFormId);
    for (const f of idbFiles) {
      const updated = { ...f, formId: newFormId };
      await saveToIndexedDB(updated);
    }

    // 2. Reassign in Firestore
    const q = query(
      collection(db, COLLECTION_NAME),
      where('formId', '==', oldFormId)
    );
    const snap = await getDocs(q);
    for (const dSnap of snap.docs) {
      const docRef = doc(db, COLLECTION_NAME, dSnap.id);
      await setDoc(docRef, { formId: newFormId }, { merge: true });
    }

    notifyEvidenceChanged(newFormId);
    notifyEvidenceChanged(oldFormId);
  } catch (err) {
    console.warn('Lỗi khi chuyển mã phiếu cho minh chứng:', err);
  }
}

/**
 * Delete an evidence file with audit log and permanent deletion
 */
export async function deleteEvidenceFile(
  id: string, 
  formId?: string,
  options?: {
    isLocked?: boolean;
    currentUserId?: string;
    currentUserName?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Mã tệp không hợp lệ.' };
  const cleanId = id.trim();
  console.log(`[KPI Evidence Service] Bắt đầu quy trình xóa tệp minh chứng: ID=${cleanId}, FormID=${formId || 'N/A'}`);

  if (options?.isLocked) {
    console.warn(`[KPI Evidence Service] Từ chối xóa minh chứng ID=${cleanId}: Phiếu KPI đã bị khóa.`);
    return { success: false, error: 'Phiếu KPI đã bị khóa. Không thể xóa minh chứng.' };
  }

  // 1. Synchronously mark as deleted locally
  markFileAsDeleted(cleanId);
  console.log(`[KPI Evidence Service] Đã đánh dấu ID=${cleanId} vào danh sách đã xóa trong localStorage.`);

  // 2. Remove from IndexedDB
  try {
    await removeFromIndexedDB(cleanId);
    console.log(`[KPI Evidence Service] Đã xóa tệp ID=${cleanId} khỏi IndexedDB thành công.`);
  } catch (err) {
    console.warn(`[KPI Evidence Service] Cảnh báo khi xóa từ IndexedDB (ID=${cleanId}):`, err);
  }

  // 3. Remove from Firestore
  try {
    const docRef = doc(db, COLLECTION_NAME, cleanId);
    await deleteDoc(docRef);
    console.log(`[KPI Evidence Service] Đã xóa bản ghi document ID=${cleanId} khỏi Firestore collection '${COLLECTION_NAME}'.`);
  } catch (err: any) {
    console.warn(`[KPI Evidence Service] Lỗi/Cảnh báo khi xóa document ID=${cleanId} khỏi Firestore:`, err);
  }

  // 4. Log deletion audit entry in Firestore
  try {
    const auditRef = doc(db, 'kpi_evidence_audit_logs', `del_${Date.now()}_${cleanId}`);
    await setDoc(auditRef, {
      action: 'delete_evidence_file',
      fileId: cleanId,
      formId: formId || 'unknown',
      deletedBy: options?.currentUserId || 'system',
      deletedByName: options?.currentUserName || 'Người dùng',
      deletedAt: new Date().toISOString()
    });
    console.log(`[KPI Evidence Service] Đã lưu nhật ký xóa (audit log) cho ID=${cleanId}.`);
  } catch (e) {
    console.warn(`[KPI Evidence Service] Bỏ qua lỗi ghi audit log cho ID=${cleanId}:`, e);
  }

  // 5. Notify all listeners to refresh their state immediately
  notifyEvidenceChanged(formId);
  console.log(`[KPI Evidence Service] Đã phát thông báo thay đổi dữ liệu (event notify) cho FormID=${formId}.`);

  return { success: true };
}

/**
 * Get evidence files for a KPI form
 */
export async function getEvidenceFilesForForm(formId: string): Promise<KpiEvidenceFile[]> {
  if (!formId) return [];

  const deletedIds = getDeletedFileIds();

  // Alias formId check (e.g. draft vs kpif)
  const aliasFormId = formId.startsWith('draft_') 
    ? formId.replace('draft_', 'kpif_') 
    : (formId.startsWith('kpif_') ? `draft_${formId.replace('kpif_', '')}` : '');

  const formIdsToQuery = Array.from(new Set([formId, aliasFormId])).filter(Boolean);

  let firestoreFiles: KpiEvidenceFile[] = [];
  try {
    for (const fid of formIdsToQuery) {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('formId', '==', fid)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => d.data() as KpiEvidenceFile);
      firestoreFiles.push(...docs);
    }
  } catch (err) {
    console.warn('Lỗi khi đọc danh sách minh chứng từ Firestore:', err);
  }

  // Merge with IndexedDB
  let idbFiles: KpiEvidenceFile[] = [];
  for (const fid of formIdsToQuery) {
    const files = await getFromIndexedDBForForm(fid);
    idbFiles.push(...files);
  }

  const fileMap = new Map<string, KpiEvidenceFile>();
  idbFiles.forEach(f => {
    if (!deletedIds.has(f.id)) {
      fileMap.set(f.id, f);
    }
  });
  firestoreFiles.forEach(f => {
    if (!deletedIds.has(f.id)) {
      fileMap.set(f.id, f);
    }
  });

  return Array.from(fileMap.values()).sort((a, b) => 
    new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
  );
}

/**
 * Subscribe to evidence files for a form in real-time
 */
export function subscribeEvidenceFilesForForm(
  formId: string, 
  onUpdate: (files: KpiEvidenceFile[]) => void
): () => void {
  if (!formId) {
    onUpdate([]);
    return () => {};
  }

  const sync = async () => {
    const files = await getEvidenceFilesForForm(formId);
    onUpdate(files);
  };

  // Initial load
  sync();

  // Firestore listener
  const q = query(
    collection(db, COLLECTION_NAME),
    where('formId', '==', formId)
  );

  const unsubFirestore = onSnapshot(q, () => {
    sync();
  }, (err) => {
    console.warn('Lỗi listener Firestore cho minh chứng:', err);
    sync();
  });

  // Local event listener
  const unsubLocal = onEvidenceChanged((_changedFormId) => {
    sync();
  });

  return () => {
    unsubFirestore();
    unsubLocal();
  };
}

/**
 * Helper to convert File to Data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes into human readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
