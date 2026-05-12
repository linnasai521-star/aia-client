const DB_NAME = 'aia-v4';
const DB_VER = 2;
let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('conversations')) {
        const s = d.createObjectStore('conversations', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      }
      if (!d.objectStoreNames.contains('messages')) {
        const s = d.createObjectStore('messages', { keyPath: 'id' });
        s.createIndex('convId', 'convId');
        s.createIndex('convTs', ['convId', 'ts']);
      }
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
      if (!d.objectStoreNames.contains('worldbook')) {
        const s = d.createObjectStore('worldbook', { keyPath: 'id' });
        s.createIndex('convId', 'convId');
      }
      if (!d.objectStoreNames.contains('characters')) d.createObjectStore('characters', { keyPath: 'id' });
      // NEW: API configs store
      if (!d.objectStoreNames.contains('apiConfigs')) {
        d.createObjectStore('apiConfigs', { keyPath: 'id' });
      }
      // Migrate old settings to apiConfig if exists
      if (e.oldVersion < 2 && d.objectStoreNames.contains('settings')) {
        const tx = e.target.transaction;
        const settingStore = tx.objectStore('settings');
        const apiStore = tx.objectStore('apiConfigs');
        const req = settingStore.getAll();
        req.onsuccess = () => {
          const all = req.result;
          const s = {};
          for (const i of all) s[i.key] = i.value;
          if (s.apiUrl || s.apiKey) {
            apiStore.put({
              id: 'default',
              name: '默认配置',
              provider: s.provider || 'openai',
              baseURL: s.apiUrl || '',
              apiKey: s.apiKey || '',
              encryptedKey: s.encryptedKey || '',
              model: s.model || '',
              systemPrompt: s.systemPrompt || '',
              isDefault: true,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        };
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = e => reject(e.target.error);
  });
}

async function store(name, mode = 'readonly') {
  const d = await open();
  return d.transaction(name, mode).objectStore(name);
}

function r2p(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Conversations
export async function getAllConversations() {
  const s = await store('conversations');
  const all = await r2p(s.getAll());
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
export async function getConversation(id) { return r2p((await store('conversations')).get(id)); }
export async function putConversation(c) { return r2p((await store('conversations', 'readwrite')).put(c)); }
export async function deleteConversation(id) {
  await r2p((await store('conversations', 'readwrite')).delete(id));
  await deleteByIndex('messages', 'convId', id);
}

// Messages
export async function getMessages(convId, limit = 200) {
  const s = await store('messages');
  const idx = s.index('convTs');
  return new Promise((resolve, reject) => {
    const results = [];
    const req = idx.openCursor(IDBKeyRange.bound([convId, 0], [convId, Infinity]), 'prev');
    req.onsuccess = e => {
      const c = e.target.result;
      if (!c || results.length >= limit) { resolve(results.reverse()); return; }
      results.push(c.value);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
export async function getAllMessages(convId) {
  const all = await r2p((await store('messages')).index('convId').getAll(IDBKeyRange.only(convId)));
  return all.sort((a, b) => a.ts - b.ts);
}
export async function putMessage(m) { return r2p((await store('messages', 'readwrite')).put(m)); }

// Settings
export async function getAllSettings() {
  const all = await r2p((await store('settings')).getAll());
  const obj = {};
  for (const i of all) obj[i.key] = i.value;
  return obj;
}
export async function setSetting(key, value) {
  return r2p((await store('settings', 'readwrite')).put({ key, value }));
}

// 👇 NEW: API Configs CRUD
export async function getAllApiConfigs() {
  return r2p((await store('apiConfigs')).getAll());
}
export async function getApiConfig(id) {
  return r2p((await store('apiConfigs')).get(id));
}
export async function putApiConfig(cfg) {
  cfg.updatedAt = Date.now();
  return r2p((await store('apiConfigs', 'readwrite')).put(cfg));
}
export async function deleteApiConfig(id) {
  return r2p((await store('apiConfigs', 'readwrite')).delete(id));
}
export async function setDefaultApiConfig(id) {
  const tx = (await open()).transaction('apiConfigs', 'readwrite');
  const s = tx.objectStore('apiConfigs');
  const all = await r2p(s.getAll());
  for (const cfg of all) {
    cfg.isDefault = cfg.id === id;
    await r2p(s.put(cfg));
  }
}
export async function getDefaultApiConfig() {
  const all = await r2p((await store('apiConfigs')).getAll());
  return all.find(c => c.isDefault) || all[0] || null;
}

// World book
export async function getWorldBook(convId = '_global') {
  return r2p((await store('worldbook')).index('convId').getAll(IDBKeyRange.only(convId)));
}
export async function putWorldBookEntry(e) { return r2p((await store('worldbook', 'readwrite')).put(e)); }
export async function deleteWorldBookEntry(id) { return r2p((await store('worldbook', 'readwrite')).delete(id)); }

// Characters
export async function getAllCharacters() { return r2p((await store('characters')).getAll()); }
export async function putCharacter(c) { return r2p((await store('characters', 'readwrite')).put(c)); }
export async function deleteCharacter(id) { return r2p((await store('characters', 'readwrite')).delete(id)); }

// Helpers
async function deleteByIndex(storeName, idxName, val) {
  const s = await store(storeName, 'readwrite');
  return new Promise(resolve => {
    const req = s.index(idxName).openCursor(IDBKeyRange.only(val));
    req.onsuccess = e => {
      const c = e.target.result;
      if (c) { c.delete(); c.continue(); } else resolve();
    };
  });
}
