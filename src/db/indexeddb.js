const DB_NAME = 'aia-v4';
const DB_VER = 3;
let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;

      // v1 → v2 基础表（首次创建场景）
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
      if (!d.objectStoreNames.contains('apiConfigs')) {
        d.createObjectStore('apiConfigs', { keyPath: 'id' });
      }

      // v1 → v2 迁移：settings → apiConfigs
      if (e.oldVersion < 2 && d.objectStoreNames.contains('settings')) {
        const tx = e.target.transaction;
        const settingStore = tx.objectStore('settings');
        const apiStore = tx.objectStore('apiConfigs');
        const sreq = settingStore.getAll();
        sreq.onsuccess = () => {
          const all = sreq.result;
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

      // ===== v2 → v3 升级：角色-会话双层架构 =====
      if (e.oldVersion < 3) {
        const tx = e.target.transaction;

        // 1. 新增 chats 表
        if (!d.objectStoreNames.contains('chats')) {
          const chatStore = d.createObjectStore('chats', { keyPath: 'chatId' });
          chatStore.createIndex('characterId', 'characterId');
          chatStore.createIndex('updatedAt', 'updatedAt');
        }

        // 2. messages 添加 chatId 索引（如果不存在）
        const msgStore = tx.objectStore('messages');
        if (msgStore && !msgStore.indexNames.contains('chatId')) {
          msgStore.createIndex('chatId', 'chatId');
        }

        // 3. 为已有 conversations 迁移到 chats + 关联角色
        if (d.objectStoreNames.contains('conversations') && d.objectStoreNames.contains('characters')) {
          const convStore = tx.objectStore('conversations');
          const charStore = tx.objectStore('characters');
          const chatStore = tx.objectStore('chats');

          convStore.getAll().onsuccess = () => {
            const convs = convStore.getAll().result || [];
            charStore.getAll().onsuccess = () => {
              const chars = charStore.getAll().result || [];

              // 为每个角色创建默认 chat
              for (const ch of chars) {
                if (!ch.defaultChatId) {
                  const chatId = 'chat-' + ch.id;
                  ch.defaultChatId = chatId;
                  charStore.put(ch);

                  // 创建默认聊天会话
                  chatStore.put({
                    chatId,
                    characterId: ch.id,
                    title: '默认聊天',
                    createdAt: ch.createdAt || Date.now(),
                    updatedAt: Date.now(),
                    lastMessageAt: null,
                    isActive: true,
                    summary: ''
                  });
                }
              }

              // 为已有对话关联到角色（如果对话有 characterId）
              for (const cv of convs) {
                if (cv.characterId) {
                  const chatId = 'chat-' + cv.characterId;
                  // 更新该对话下的消息，设置 chatId
                  const msgStore2 = tx.objectStore('messages');
                  const msgIdx = msgStore2.index('convId');
                  msgIdx.getAll(IDBKeyRange.only(cv.id)).onsuccess = () => {
                    const msgs = msgIdx.getAll().result || [];
                    for (const m of msgs) {
                      m.chatId = chatId;
                      msgStore2.put(m);
                    }
                  };
                }
              }
            };
          };
        }
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

// ==================== Conversations（保留向后兼容） ====================
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

// ==================== Messages ====================
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

// ==================== Settings ====================
export async function getAllSettings() {
  const all = await r2p((await store('settings')).getAll());
  const obj = {};
  for (const i of all) obj[i.key] = i.value;
  return obj;
}
export async function setSetting(key, value) {
  return r2p((await store('settings', 'readwrite')).put({ key, value }));
}

// ==================== API Configs ====================
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

// ==================== World book ====================
export async function getWorldBook(convId = '_global') {
  return r2p((await store('worldbook')).index('convId').getAll(IDBKeyRange.only(convId)));
}
export async function putWorldBookEntry(e) { return r2p((await store('worldbook', 'readwrite')).put(e)); }
export async function deleteWorldBookEntry(id) { return r2p((await store('worldbook', 'readwrite')).delete(id)); }

// ==================== Characters ====================
export async function getAllCharacters() { return r2p((await store('characters')).getAll()); }
export async function getCharacter(id) { return r2p((await store('characters')).get(id)); }
export async function putCharacter(c) { return r2p((await store('characters', 'readwrite')).put(c)); }
export async function deleteCharacter(id) { return r2p((await store('characters', 'readwrite')).delete(id)); }

// ==================== Chats（新：角色-会话双层架构） ====================
/** 获取某个角色的所有聊天会话 */
export async function getChatsByCharacter(characterId) {
  return r2p((await store('chats')).index('characterId').getAll(IDBKeyRange.only(characterId)));
}

/** 获取单个聊天会话 */
export async function getChat(chatId) {
  return r2p((await store('chats')).get(chatId));
}

/** 保存聊天会话 */
export async function putChat(chat) {
  chat.updatedAt = Date.now();
  return r2p((await store('chats', 'readwrite')).put(chat));
}

/** 删除聊天会话及其消息 */
export async function deleteChat(chatId) {
  await r2p((await store('chats', 'readwrite')).delete(chatId));
  await deleteByIndex('messages', 'chatId', chatId);
}

/** 获取某个聊天会话的消息（按 chatId） */
export async function getMessagesByChatId(chatId, limit = 200) {
  const s = await store('messages');
  if (!s.indexNames.contains('chatId')) return [];
  return new Promise((resolve) => {
    const results = [];
    const req = s.index('chatId').openCursor(IDBKeyRange.only(chatId), 'prev');
    req.onsuccess = e => {
      const c = e.target.result;
      if (!c || results.length >= limit) { resolve(results.reverse()); return; }
      results.push(c.value);
      c.continue();
    };
    req.onerror = () => resolve([]);
  });
}

/** 获取角色的默认聊天（没有则创建） */
export async function getOrCreateDefaultChat(characterId) {
  const char = await getCharacter(characterId);
  if (char?.defaultChatId) {
    const chat = await getChat(char.defaultChatId);
    if (chat) return chat;
  }
  // 创建默认聊天
  const chatId = 'chat-' + characterId;
  const chat = {
    chatId,
    characterId,
    title: char?.name ? `与${char.name}的聊天` : '默认聊天',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastMessageAt: null,
    isActive: true,
    summary: ''
  };
  await putChat(chat);
  // 更新角色的 defaultChatId
  if (char) {
    char.defaultChatId = chatId;
    await putCharacter(char);
  }
  return chat;
}

/** 获取所有聊天会话（全局） */
export async function getAllChats() {
  const all = await r2p((await store('chats')).getAll());
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// ==================== Helpers ====================
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

// API Config status helpers
export async function updateApiConfigStatus(id, updates) {
  const cfg = await getApiConfig(id);
  if (!cfg) return;
  Object.assign(cfg, updates, { updatedAt: Date.now() });
  return r2p((await store('apiConfigs', 'readwrite')).put(cfg));
}

export async function getApiConfigModels(id) {
  const cfg = await getApiConfig(id);
  return cfg?.models || [];
}
