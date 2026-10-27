import { StudySet, StudySetSchema } from "../domain/study-set";

const DB_NAME = "retell_db";
const DB_VERSION = 1;
const STORE_NAME = "study_sets";

/**
 * In-memory fallback map used in non-browser environments (SSR, Node tests,
 * or when IndexedDB is blocked in private browsing).
 */
const inMemoryStore = new Map<string, StudySet>();

/**
 * Checks whether browser IndexedDB is supported and accessible.
 */
function isIndexedDBSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    window.indexedDB !== null
  );
}

/**
 * Opens or upgrades the IndexedDB instance.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Saves a study set to IndexedDB (or fallback memory store).
 * Overwrites any existing record with the same ID.
 */
export async function saveStudySet(studySet: StudySet): Promise<void> {
  const parsed = StudySetSchema.parse(studySet);

  if (!isIndexedDBSupported()) {
    inMemoryStore.set(parsed.id, structuredClone(parsed));
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(parsed);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error || new Error("Failed to save study set"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Retrieves a single study set by ID. Returns null if not found.
 */
export async function getStudySet(id: string): Promise<StudySet | null> {
  if (!isIndexedDBSupported()) {
    const item = inMemoryStore.get(id);
    return item ? structuredClone(item) : null;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
          return;
        }
        const parsed = StudySetSchema.safeParse(val);
        resolve(parsed.success ? parsed.data : null);
      };
      req.onerror = () =>
        reject(req.error || new Error("Failed to get study set"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Lists all stored study sets, sorted most-recently updated first.
 */
export async function listStudySets(): Promise<StudySet[]> {
  if (!isIndexedDBSupported()) {
    const items = Array.from(inMemoryStore.values());
    return items
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .map((item) => structuredClone(item));
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const rawList = (req.result || []) as unknown[];
        const validList: StudySet[] = [];

        for (const raw of rawList) {
          const parsed = StudySetSchema.safeParse(raw);
          if (parsed.success) {
            validList.push(parsed.data);
          }
        }

        // Sort descending by updatedAt
        validList.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        resolve(validList);
      };

      req.onerror = () =>
        reject(req.error || new Error("Failed to list study sets"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Deletes a study set by ID.
 */
export async function deleteStudySet(id: string): Promise<void> {
  if (!isIndexedDBSupported()) {
    inMemoryStore.delete(id);
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error || new Error("Failed to delete study set"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Updates an existing study set.
 */
export async function updateStudySet(studySet: StudySet): Promise<void> {
  return saveStudySet(studySet);
}

/**
 * Clears all study sets from storage (useful for reset and tests).
 */
export async function clearAllStudySets(): Promise<void> {
  if (!isIndexedDBSupported()) {
    inMemoryStore.clear();
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error || new Error("Failed to clear store"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}
