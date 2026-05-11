// 记忆数据库模块
const DB_NAME = 'aia-memory';
const DB_VER = 1;
let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      
      // 记忆存储
      if (!d.objectStoreNames.contains('memories')) {
        const s = d.createObjectStore('memories', { keyPath: 'id' });
        s.createIndex('category', 'category');
        s.createIndex('importance', 'importance');
        s.createIndex('createdAt', 'createdAt');
        s.createIndex('conversationId', 'conversationId');
      }
      
      // 对话摘要存储
      if (!d.objectStoreNames.contains('summaries')) {
        const s = d.createObjectStore('summaries', { keyPath: 'id' });
        s.createIndex('conversationId', 'conversationId');
        s.createIndex('createdAt', 'createdAt');
      }
      
      // 记忆缓存
      if (!d.objectStoreNames.contains('memoryCache')) {
        d.createObjectStore('memoryCache', { keyPath: 'key' });
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

// === 记忆操作 ===
export async function getAllMemories() {
  const s = await store('memories');
  const all = await r2p(s.getAll());
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getMemoryById(id) {
  return r2p((await store('memories')).get(id));
}

export async function addMemory(memory) {
  const m = {
    id: crypto.randomUUID(),
    content: '',
    summary: '',
    category: 'general',
    importance: 5,
    tags: [],
    conversationId: null,
    sourceMessageIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...memory
  };
  await r2p((await store('memories', 'readwrite')).put(m));
  return m;
}

export async function updateMemory(id, updates) {
  const s = await store('memories', 'readwrite');
  const existing = await r2p(s.get(id));
  if (!existing) throw new Error('Memory not found');
  
  const updated = { ...existing, ...updates, updatedAt: Date.now() };
  await r2p(s.put(updated));
  return updated;
}

export async function deleteMemory(id) {
  return r2p((await store('memories', 'readwrite')).delete(id));
}

export async function getMemoriesByCategory(category) {
  const s = await store('memories');
  const idx = s.index('category');
  return r2p(idx.getAll(IDBKeyRange.only(category)));
}

export async function getMemoriesByImportance(minImportance = 7) {
  const s = await store('memories');
  const all = await r2p(s.getAll());
  return all.filter(m => m.importance >= minImportance)
    .sort((a, b) => b.importance - a.importance);
}

export async function getMemoriesByConversation(convId) {
  const s = await store('memories');
  const idx = s.index('conversationId');
  return r2p(idx.getAll(IDBKeyRange.only(convId)));
}

export async function searchMemories(query) {
  if (!query || query.trim() === '') return getAllMemories();
  
  const s = await store('memories');
  const all = await r2p(s.getAll());
  const q = query.toLowerCase();
  
  return all.filter(m => 
    m.content?.toLowerCase().includes(q) ||
    m.summary?.toLowerCase().includes(q) ||
    m.tags?.some(t => t.toLowerCase().includes(q)) ||
    m.category?.toLowerCase().includes(q)
  ).sort((a, b) => b.importance - a.importance);
}

export async function getImportantMemories() {
  return getMemoriesByImportance(8);
}

export async function getRecentMemories(limit = 20) {
  const all = await getAllMemories();
  return all.slice(0, limit);
}

export async function pinMemory(id) {
  const mem = await getMemoryById(id);
  if (!mem) return;
  return updateMemory(id, { pinned: !mem.pinned });
}

export async function clearAllMemories() {
  const s = await store('memories', 'readwrite');
  await r2p(s.clear());
}

// === 对话摘要 ===
export async function addSummary(summary) {
  const s = {
    id: crypto.randomUUID(),
    conversationId: '',
    content: '',
    keyTopics: [],
    createdAt: Date.now(),
    ...summary
  };
  await r2p((await store('summaries', 'readwrite')).put(s));
  return s;
}

export async function getSummariesByConversation(convId) {
  const s = await store('summaries');
  const idx = s.index('conversationId');
  const all = await r2p(idx.getAll(IDBKeyRange.only(convId)));
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getRecentSummaries(limit = 10) {
  const s = await store('summaries');
  const all = await r2p(s.getAll());
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
}

export async function deleteSummary(id) {
  return r2p((await store('summaries', 'readwrite')).delete(id));
}

// === 记忆缓存 ===
export async function getCachedMemories(key) {
  const s = await store('memoryCache');
  const result = await r2p(s.get(key));
  return result ? result.value : null;
}

export async function setCachedMemories(key, value, ttl = 3600000) { // 默认1小时
  const s = await store('memoryCache', 'readwrite');
  await r2p(s.put({ key, value, expires: Date.now() + ttl }));
}

export async function clearExpiredCache() {
  const s = await store('memoryCache', 'readwrite');
  const all = await r2p(s.getAll());
  const now = Date.now();
  
  for (const item of all) {
    if (item.expires && item.expires < now) {
      await r2p(s.delete(item.key));
    }
  }
}

// === 记忆统计 ===
export async function getMemoryStats() {
  const all = await getAllMemories();
  const byCategory = {};
  const byImportance = { low: 0, medium: 0, high: 0 };
  
  for (const mem of all) {
    byCategory[mem.category] = (byCategory[mem.category] || 0) + 1;
    if (mem.importance < 4) byImportance.low++;
    else if (mem.importance < 7) byImportance.medium++;
    else byImportance.high++;
  }
  
  return {
    total: all.length,
    byCategory,
    byImportance,
    lastUpdated: all[0]?.updatedAt || null
  };
}