// Bers storage: everything lives on the phone, in IndexedDB.
// Stores: pieces (closet), log (what was worn / planned), looks (saved outfits), kv (settings, profile, usage, caches).

const DB_NAME = "bers", DB_VER = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pieces")) db.createObjectStore("pieces", { keyPath: "id" });
      if (!db.objectStoreNames.contains("log")) db.createObjectStore("log", { keyPath: "id" });
      if (!db.objectStoreNames.contains("looks")) db.createObjectStore("looks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // Ask iOS/Chrome not to evict our data under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode), s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && "result" in out ? out.result : out);
    t.onerror = () => reject(t.error);
  }));
}

export const all = (store) => tx(store, "readonly", (s) => s.getAll());
export const get = (store, key) => tx(store, "readonly", (s) => s.get(key));
export const put = (store, val, key) => tx(store, "readwrite", (s) => (key === undefined ? s.put(val) : s.put(val, key)));
export const del = (store, key) => tx(store, "readwrite", (s) => s.delete(key));
export const clear = (store) => tx(store, "readwrite", (s) => s.clear());

export const kv = {
  get: (k, dflt) => get("kv", k).then((v) => (v === undefined ? dflt : v)),
  set: (k, v) => put("kv", v, k),
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- backup: one JSON file with every store. The API key is never included. */
export async function exportBackup() {
  const data = { app: "bers", version: 1, exportedAt: new Date().toISOString(), stores: {} };
  for (const s of ["pieces", "log", "looks"]) data.stores[s] = await all(s);
  const keys = await tx("kv", "readonly", (s) => s.getAllKeys());
  data.stores.kv = {};
  for (const k of keys) if (k !== "apiKey") data.stores.kv[k] = await get("kv", k);
  return new Blob([JSON.stringify(data)], { type: "application/json" });
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== "bers" || !data.stores) throw new Error("That file isn't a Bers backup.");
  for (const s of ["pieces", "log", "looks"]) {
    await clear(s);
    for (const row of data.stores[s] || []) await put(s, row);
  }
  for (const [k, v] of Object.entries(data.stores.kv || {})) if (k !== "apiKey") await kv.set(k, v);
  return (data.stores.pieces || []).length;
}
