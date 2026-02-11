/**
 * @deprecated WhisperWASMProvider now uses @huggingface/transformers which handles
 * model downloading and caching internally via ONNX models. This module is retained
 * for potential future use in manual model management or cache clearing UI.
 *
 * Original: Whisper GGML model loader with Cache Storage + IndexedDB caching.
 */

export interface ModelInfo {
  id: string;
  label: string;
  url: string;
  sizeBytes: number;
}

// Whisper GGML models hosted on Hugging Face
const HF_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

export const WHISPER_MODELS: Record<string, ModelInfo> = {
  tiny: {
    id: "tiny",
    label: "Tiny (75 MB)",
    url: `${HF_BASE}/ggml-tiny.bin`,
    sizeBytes: 75_000_000,
  },
  base: {
    id: "base",
    label: "Base (142 MB)",
    url: `${HF_BASE}/ggml-base.bin`,
    sizeBytes: 142_000_000,
  },
  small: {
    id: "small",
    label: "Small (466 MB)",
    url: `${HF_BASE}/ggml-small.bin`,
    sizeBytes: 466_000_000,
  },
};

const CACHE_NAME = "ainotes-whisper-models";
const IDB_DB_NAME = "ainotes-models";
const IDB_STORE_NAME = "blobs";

/**
 * Check if a model is cached.
 */
export async function isModelCached(modelId: string): Promise<boolean> {
  const model = WHISPER_MODELS[modelId];
  if (!model) return false;

  // Try Cache Storage first
  if ("caches" in globalThis) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(model.url);
      if (response) return true;
    } catch {
      // Cache Storage unavailable
    }
  }

  // Try IndexedDB
  try {
    return await idbHas(modelId);
  } catch {
    return false;
  }
}

/**
 * Load a whisper model, downloading if not cached.
 */
export async function loadModel(
  modelId: string,
  onProgress?: (pct: number) => void,
): Promise<ArrayBuffer> {
  const model = WHISPER_MODELS[modelId];
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  // Try Cache Storage
  if ("caches" in globalThis) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(model.url);
      if (cached) {
        onProgress?.(100);
        return cached.arrayBuffer();
      }
    } catch {
      // Fall through
    }
  }

  // Try IndexedDB
  try {
    const blob = await idbGet(modelId);
    if (blob) {
      onProgress?.(100);
      return blob;
    }
  } catch {
    // Fall through
  }

  // Download with progress
  const buffer = await downloadWithProgress(
    model.url,
    model.sizeBytes,
    onProgress,
  );

  // Cache for next time (fire-and-forget)
  cacheModel(model, buffer).catch(() => {
    // Caching failed, not critical
  });

  return buffer;
}

/**
 * Clear all cached models.
 */
export async function clearModelCache(): Promise<void> {
  if ("caches" in globalThis) {
    try {
      await caches.delete(CACHE_NAME);
    } catch {
      // Ignore
    }
  }
  try {
    await idbClear();
  } catch {
    // Ignore
  }
}

// ─── Internal helpers ───

async function downloadWithProgress(
  url: string,
  expectedSize: number,
  onProgress?: (pct: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download model: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    // Fallback: no streaming
    const buffer = await response.arrayBuffer();
    onProgress?.(100);
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.length;
    onProgress?.(
      Math.min(99, Math.round((receivedBytes / expectedSize) * 100)),
    );
  }

  // Concatenate all chunks
  const buffer = new ArrayBuffer(receivedBytes);
  const view = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    view.set(chunk, offset);
    offset += chunk.length;
  }

  onProgress?.(100);
  return buffer;
}

async function cacheModel(
  model: ModelInfo,
  buffer: ArrayBuffer,
): Promise<void> {
  // Try Cache Storage
  if ("caches" in globalThis) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = new Response(buffer, {
        headers: { "Content-Type": "application/octet-stream" },
      });
      await cache.put(model.url, response);
      return;
    } catch {
      // Fall through to IndexedDB
    }
  }

  // Fall back to IndexedDB
  await idbPut(model.id, buffer);
}

// ─── IndexedDB helpers ───

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDB_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbHas(key: string): Promise<boolean> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.count(key);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<ArrayBuffer | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: ArrayBuffer): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbClear(): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
