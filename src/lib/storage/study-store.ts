import { StudySet, StudySetSchema } from "../domain/study-set";
import {
  PracticeAttempt,
  PracticeAttemptSchema,
} from "../domain/practice-session";

const DB_NAME = "retell_db";
const DB_VERSION = 2;
const STORE_NAME = "study_sets";
const ATTEMPTS_STORE = "practice_attempts";

/**
 * In-memory fallback maps used in non-browser environments (SSR, Node tests,
 * or when IndexedDB is blocked in private browsing).
 */
const inMemoryStore = new Map<string, StudySet>();
const inMemoryAttempts = new Map<string, PracticeAttempt>();

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
      if (!db.objectStoreNames.contains(ATTEMPTS_STORE)) {
        const attemptsStore = db.createObjectStore(ATTEMPTS_STORE, {
          keyPath: "id",
        });
        attemptsStore.createIndex("studySetId", "studySetId", {
          unique: false,
        });
        attemptsStore.createIndex("questionId", "questionId", {
          unique: false,
        });
        attemptsStore.createIndex("createdAt", "createdAt", { unique: false });
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

/**
 * Saves a student's practice attempt to IndexedDB (or fallback memory store).
 */
export async function savePracticeAttempt(
  attempt: PracticeAttempt
): Promise<void> {
  const parsed = PracticeAttemptSchema.parse(attempt);

  if (!isIndexedDBSupported()) {
    inMemoryAttempts.set(parsed.id, structuredClone(parsed));
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ATTEMPTS_STORE, "readwrite");
      const store = tx.objectStore(ATTEMPTS_STORE);
      const req = store.put(parsed);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error || new Error("Failed to save practice attempt"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Retrieves a single practice attempt by its unique ID.
 */
export async function getPracticeAttempt(
  id: string
): Promise<PracticeAttempt | null> {
  if (!isIndexedDBSupported()) {
    const item = inMemoryAttempts.get(id);
    return item ? structuredClone(item) : null;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ATTEMPTS_STORE, "readonly");
      const store = tx.objectStore(ATTEMPTS_STORE);
      const req = store.get(id);

      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
          return;
        }
        const parsed = PracticeAttemptSchema.safeParse(val);
        resolve(parsed.success ? parsed.data : null);
      };
      req.onerror = () =>
        reject(req.error || new Error("Failed to get practice attempt"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Lists practice attempts, optionally filtered by studySetId and/or questionId,
 * ordered by most recent first.
 */
export async function listPracticeAttempts(
  studySetId?: string,
  questionId?: string
): Promise<PracticeAttempt[]> {
  if (!isIndexedDBSupported()) {
    let items = Array.from(inMemoryAttempts.values());
    if (studySetId) {
      items = items.filter((a) => a.studySetId === studySetId);
    }
    if (questionId) {
      items = items.filter((a) => a.questionId === questionId);
    }
    return items
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map((item) => structuredClone(item));
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ATTEMPTS_STORE, "readonly");
      const store = tx.objectStore(ATTEMPTS_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const rawList = (req.result || []) as unknown[];
        let validList: PracticeAttempt[] = [];

        for (const raw of rawList) {
          const parsed = PracticeAttemptSchema.safeParse(raw);
          if (parsed.success) {
            validList.push(parsed.data);
          }
        }

        if (studySetId) {
          validList = validList.filter((a) => a.studySetId === studySetId);
        }
        if (questionId) {
          validList = validList.filter((a) => a.questionId === questionId);
        }

        validList.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        resolve(validList);
      };

      req.onerror = () =>
        reject(req.error || new Error("Failed to list practice attempts"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Deletes a practice attempt by ID.
 */
export async function deletePracticeAttempt(id: string): Promise<void> {
  if (!isIndexedDBSupported()) {
    inMemoryAttempts.delete(id);
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ATTEMPTS_STORE, "readwrite");
      const store = tx.objectStore(ATTEMPTS_STORE);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error || new Error("Failed to delete practice attempt"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Clears all practice attempts (for testing and resets).
 */
export async function clearAllPracticeAttempts(): Promise<void> {
  if (!isIndexedDBSupported()) {
    inMemoryAttempts.clear();
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ATTEMPTS_STORE, "readwrite");
      const store = tx.objectStore(ATTEMPTS_STORE);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error || new Error("Failed to clear practice attempts"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}
