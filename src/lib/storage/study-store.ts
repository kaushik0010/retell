import { StudySet, StudySetSchema } from "../domain/study-set";
import {
  PracticeAttempt,
  PracticeAttemptSchema,
} from "../domain/practice-session";
import {
  SemanticAuditResult,
  SemanticAuditResultSchema,
} from "../domain/semantic-audit";
import { checkScopeCompatibility } from "../domain/attempt-comparison";

const DB_NAME = "retell_db";
const DB_VERSION = 4;
const STORE_NAME = "study_sets";
const ATTEMPTS_STORE = "practice_attempts";
const AUDITS_STORE = "semantic_audits";

/**
 * In-memory fallback maps used in non-browser environments (SSR, Node tests,
 * or when IndexedDB is blocked in private browsing).
 */
const inMemoryStore = new Map<string, StudySet>();
const inMemoryAttempts = new Map<string, PracticeAttempt>();
const inMemoryAudits = new Map<string, SemanticAuditResult>();

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
      if (!db.objectStoreNames.contains(AUDITS_STORE)) {
        const auditsStore = db.createObjectStore(AUDITS_STORE, {
          keyPath: "id",
        });
        auditsStore.createIndex("attemptId", "attemptId", { unique: true });
        auditsStore.createIndex("studySetId", "studySetId", { unique: false });
        auditsStore.createIndex("questionId", "questionId", { unique: false });
        auditsStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onblocked = () => {
      console.warn(
        "IndexedDB upgrade blocked: please close other Retell tabs."
      );
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
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
      req.onerror = () => {
        const err = req.error;
        if (err?.name === "QuotaExceededError") {
          reject(
            new Error(
              "Browser storage quota exceeded. Please delete old attempts or study sets to free space."
            )
          );
        } else {
          reject(err || new Error("Failed to save study set"));
        }
      };
      tx.onabort = () => {
        reject(tx.error || new Error("Storage transaction was aborted"));
      };
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
      req.onerror = () => {
        const err = req.error;
        if (err?.name === "QuotaExceededError") {
          reject(
            new Error(
              "Browser storage quota exceeded. Please delete old attempts or study sets to free space."
            )
          );
        } else {
          reject(err || new Error("Failed to save practice attempt"));
        }
      };
      tx.onabort = () => {
        reject(tx.error || new Error("Storage transaction was aborted"));
      };
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

/**
 * Saves a semantic audit result to IndexedDB (or fallback memory store).
 */
export async function saveSemanticAuditResult(
  audit: SemanticAuditResult
): Promise<void> {
  const parsed = SemanticAuditResultSchema.parse(audit);

  if (!isIndexedDBSupported()) {
    inMemoryAudits.set(parsed.id, structuredClone(parsed));
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(AUDITS_STORE, "readwrite");
      const store = tx.objectStore(AUDITS_STORE);
      const req = store.put(parsed);

      req.onsuccess = () => resolve();
      req.onerror = () => {
        const err = req.error;
        if (err?.name === "QuotaExceededError") {
          reject(
            new Error(
              "Browser storage quota exceeded. Please delete old attempts or study sets to free space."
            )
          );
        } else {
          reject(
            req.error || new Error("Failed to save semantic audit result")
          );
        }
      };
      tx.onabort = () => {
        reject(tx.error || new Error("Storage transaction was aborted"));
      };
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Retrieves a single semantic audit result by its audit ID.
 */
export async function getSemanticAuditResult(
  id: string
): Promise<SemanticAuditResult | null> {
  if (!isIndexedDBSupported()) {
    const item = inMemoryAudits.get(id);
    return item ? structuredClone(item) : null;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(AUDITS_STORE, "readonly");
      const store = tx.objectStore(AUDITS_STORE);
      const req = store.get(id);

      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
          return;
        }
        const parsed = SemanticAuditResultSchema.safeParse(val);
        resolve(parsed.success ? parsed.data : null);
      };
      req.onerror = () =>
        reject(req.error || new Error("Failed to get semantic audit result"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Retrieves the semantic audit result for a specific practice attempt ID.
 */
export async function getSemanticAuditByAttempt(
  attemptId: string
): Promise<SemanticAuditResult | null> {
  if (!isIndexedDBSupported()) {
    for (const audit of inMemoryAudits.values()) {
      if (audit.attemptId === attemptId) {
        return structuredClone(audit);
      }
    }
    return null;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(AUDITS_STORE, "readonly");
      const store = tx.objectStore(AUDITS_STORE);
      const index = store.index("attemptId");
      const req = index.get(attemptId);

      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
          return;
        }
        const parsed = SemanticAuditResultSchema.safeParse(val);
        resolve(parsed.success ? parsed.data : null);
      };
      req.onerror = () =>
        reject(
          req.error || new Error("Failed to get audit result by attempt ID")
        );
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Lists semantic audits, optionally filtered by studySetId and/or questionId.
 */
export async function listSemanticAudits(
  studySetId?: string,
  questionId?: string
): Promise<SemanticAuditResult[]> {
  if (!isIndexedDBSupported()) {
    let items = Array.from(inMemoryAudits.values());
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
      const tx = db.transaction(AUDITS_STORE, "readonly");
      const store = tx.objectStore(AUDITS_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const rawList = (req.result || []) as unknown[];
        let validList: SemanticAuditResult[] = [];

        for (const raw of rawList) {
          const parsed = SemanticAuditResultSchema.safeParse(raw);
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
        reject(req.error || new Error("Failed to list semantic audits"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Deletes a semantic audit result by ID.
 */
export async function deleteSemanticAuditResult(id: string): Promise<void> {
  if (!isIndexedDBSupported()) {
    inMemoryAudits.delete(id);
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(AUDITS_STORE, "readwrite");
      const store = tx.objectStore(AUDITS_STORE);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(
          req.error || new Error("Failed to delete semantic audit result")
        );
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Clears all semantic audit results (for testing and resets).
 */
export async function clearAllSemanticAudits(): Promise<void> {
  if (!isIndexedDBSupported()) {
    inMemoryAudits.clear();
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(AUDITS_STORE, "readwrite");
      const store = tx.objectStore(AUDITS_STORE);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(req.error || new Error("Failed to clear semantic audits"));
      tx.oncomplete = () => db.close();
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Retrieves all practice attempts for a specific question, sorted newest first.
 */
export async function getPracticeAttemptsByQuestion(
  studySetId: string,
  questionId: string
): Promise<PracticeAttempt[]> {
  return listPracticeAttempts(studySetId, questionId);
}

/**
 * Retrieves the immediately preceding attempt for the same question, or null if none.
 */
export async function getPreviousPracticeAttempt(
  currentAttemptId: string
): Promise<PracticeAttempt | null> {
  const current = await getPracticeAttempt(currentAttemptId);
  if (!current) return null;

  const allAttempts = await getPracticeAttemptsByQuestion(
    current.studySetId,
    current.questionId
  );

  // allAttempts is sorted newest first
  const currentIndex = allAttempts.findIndex((a) => a.id === currentAttemptId);
  if (currentIndex === -1 || currentIndex >= allAttempts.length - 1) {
    return null;
  }

  // The attempt created immediately before current is at currentIndex + 1
  return allAttempts[currentIndex + 1] ?? null;
}

/**
 * Finds the immediately preceding comparable attempt that has completed semantic evaluation.
 * Evaluates earlier attempts chronologically (most recent first) and ensures scope compatibility.
 */
export async function getPrecedingComparableAttemptWithAudit(
  currentAttempt: PracticeAttempt,
  currentAudit?: SemanticAuditResult | null
): Promise<{ attempt: PracticeAttempt; audit: SemanticAuditResult } | null> {
  const allAttempts = await getPracticeAttemptsByQuestion(
    currentAttempt.studySetId,
    currentAttempt.questionId
  );

  const currentCreated = new Date(currentAttempt.createdAt).getTime();
  const earlierCandidates = allAttempts
    .filter(
      (a) =>
        a.id !== currentAttempt.id &&
        new Date(a.createdAt).getTime() < currentCreated
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  for (const candidate of earlierCandidates) {
    let candidateAudit: SemanticAuditResult | null = null;
    if (candidate.auditId) {
      candidateAudit = await getSemanticAuditResult(candidate.auditId);
    }
    if (!candidateAudit) {
      candidateAudit = await getSemanticAuditByAttempt(candidate.id);
    }

    const compatibility = checkScopeCompatibility(
      candidate,
      currentAttempt,
      candidateAudit,
      currentAudit
    );

    if (
      compatibility.compatible &&
      candidateAudit &&
      candidateAudit.status === "completed"
    ) {
      return {
        attempt: candidate,
        audit: candidateAudit,
      };
    }
  }

  return null;
}

/**
 * Loads an attempt and its associated semantic audit result together.
 */
export async function getAttemptWithAudit(attemptId: string): Promise<{
  attempt: PracticeAttempt;
  audit: SemanticAuditResult | null;
} | null> {
  const attempt = await getPracticeAttempt(attemptId);
  if (!attempt) return null;

  let audit: SemanticAuditResult | null = null;
  if (attempt.auditId) {
    audit = await getSemanticAuditResult(attempt.auditId);
  }
  if (!audit) {
    audit = await getSemanticAuditByAttempt(attemptId);
  }

  return { attempt, audit };
}

/**
 * Diagnostic health check of the local-first storage subsystem.
 */
export async function getStorageDiagnostics(): Promise<{
  isSupported: boolean;
  usingFallback: boolean;
  studySetCount: number;
  attemptCount: number;
  auditCount: number;
  quotaEstimate?: {
    usageBytes: number;
    quotaBytes: number;
    usageFormatted: string;
  };
}> {
  const isSupported = isIndexedDBSupported();
  const studySets = await listStudySets();
  const attempts = await listPracticeAttempts();
  const audits = await listSemanticAudits();

  let quotaEstimate:
    | { usageBytes: number; quotaBytes: number; usageFormatted: string }
    | undefined;

  if (
    typeof navigator !== "undefined" &&
    navigator.storage &&
    navigator.storage.estimate
  ) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const mb = (usage / (1024 * 1024)).toFixed(2);
      quotaEstimate = {
        usageBytes: usage,
        quotaBytes: quota,
        usageFormatted: `${mb} MB`,
      };
    } catch {
      // Storage estimate may be restricted
    }
  }

  return {
    isSupported,
    usingFallback: !isSupported,
    studySetCount: studySets.length,
    attemptCount: attempts.length,
    auditCount: audits.length,
    quotaEstimate,
  };
}
