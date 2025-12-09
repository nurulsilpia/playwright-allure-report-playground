self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    console.log("[SW] Activated and claiming clients.");
    try {
      const persisted = await getAllFilesFromDB();
      if (persisted?.length) {
        fileCache = new Map(persisted.map(({ path, blob }) => [path, blob]));
        console.log(`[SW] ✓ Loaded ${fileCache.size} persisted files from IndexedDB on activation.`);
      } else {
        console.log('[SW] No persisted files found in IndexedDB on activation.');
      }
    } catch (err) {
      console.warn('[SW] Failed to load persisted files from IndexedDB:', err);
    }
  })());
});

let fileCache = new Map();

const DB_NAME = 'allure-local-drop';
const DB_STORE = 'files';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'path' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function putFileToDB(path, blob) {
  const db = await openDB();
  const buffer = await blobToArrayBuffer(blob);
  const mimeType = blob.type || 'application/octet-stream';
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.put({ path, buffer, mimeType });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function clearDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const req = store.clear();
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function getAllFilesFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const req = store.getAll();
    req.onsuccess = () => { 
      const results = req.result.map(record => ({
        path: record.path,
        blob: new Blob([record.buffer], { type: record.mimeType })
      }));
      db.close();
      console.log(`[SW] Retrieved ${results.length} files from IndexedDB.`);
      resolve(results);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function putAllFilesToDB(map) {
  console.log(`[SW] Starting to persist ${map.size} files to IndexedDB...`);
  let persisted = 0;
  try {
    await clearDB();
    console.log('[SW] Cleared previous IndexedDB store.');
  } catch (e) {
    console.warn('[SW] clearDB failed', e);
  }
  for (const [p, f] of map.entries()) {
    try {
      await putFileToDB(p, f);
      persisted++;
      if (persisted % 10 === 0) {
        console.log(`[SW] Persisted ${persisted}/${map.size} files...`);
      }
    } catch (e) {
      console.warn('[SW] Failed to persist file:', p, e);
    }
  }
  console.log(`[SW] ✓ Persisted ${persisted}/${map.size} files to IndexedDB.`);
  return persisted === map.size;
}

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "FILE_LIST") {
    const payload = event.data.files;
    const newMap = new Map();

    if (payload instanceof Map) {
      payload.forEach((v, k) => newMap.set(k, v));
    } else if (Array.isArray(payload)) {
      for (const entry of payload) {
        if (Array.isArray(entry) && entry.length >= 2) newMap.set(entry[0], entry[1]);
      }
    } else if (payload && typeof payload === 'object') {
      for (const key of Object.keys(payload)) {
        newMap.set(key, payload[key]);
      }
    }

    fileCache = newMap;
    console.log(`[SW] Received ${fileCache.size} normalized files. Ready to serve immediately from memory.`);

    (async () => {
      try {
        const success = await putAllFilesToDB(fileCache);
        if (success) {
          console.log('[SW] ✓ All files persisted to IndexedDB successfully.');
        } else {
          console.warn('[SW] ⚠ Some files failed to persist to IndexedDB.');
        }
      } catch (err) {
        console.error('[SW] Failed to persist files to IndexedDB:', err);
      }
    })();
  } else if (event.data.type === 'CLEAR_PERSISTENCE') {
    fileCache = new Map();
    console.log('[SW] Clearing persisted files from IndexedDB...');
    (async () => {
      try {
        await clearDB();
        console.log('[SW] ✓ Cleared all persisted files from IndexedDB.');
      } catch (err) {
        console.error('[SW] Failed to clear persisted files:', err);
      }
    })();
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.includes("/__view__/")) {
    event.respondWith(
      (async () => {
        let path = url.pathname.split("/__view__/")[1];
        path = decodeURIComponent(path);

        const file = fileCache.get(path);

        if (file) {
          let contentType = file.type || "application/octet-stream";
          if (path.endsWith(".html")) contentType = "text/html";
          else if (path.endsWith(".css")) contentType = "text/css";
          else if (path.endsWith(".js")) contentType = "application/javascript";
          else if (path.endsWith(".json")) contentType = "application/json";
          else if (path.endsWith(".png")) contentType = "image/png";
          else if (path.endsWith(".jpg") || path.endsWith(".jpeg"))
            contentType = "image/jpeg";
          else if (path.endsWith(".svg")) contentType = "image/svg+xml";

          return new Response(file, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-cache",
            },
          });
        } else {
          console.warn(`[SW] File not found in cache: ${path}`);
          return new Response(`File not found in local drop: ${path}`, {
            status: 404,
          });
        }
      })()
    );
  }
});
