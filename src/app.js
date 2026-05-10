import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Ctx } from './state.js';
import * as db from './db/indexeddb.js';
import { genId } from './utils/helpers.js';
import { decryptStr } from './utils/crypto.js';
import { createProvider } from './providers/registry.js';
import { processWorldBook } from './utils/worldbook.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatPage } from './components/ChatPage.js';
import { SettingsPage } from './components/SettingsPage.js';
import { CharacterPage } from './components/CharacterPage.js';
import { LockScreen } from './components/LockScreen.js';

const h = React.createElement;

function App() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pinHash, setPinHash] = useState(null);
  const [settings, setSettings] = useState({});
  const [convs, setConvs] = useState([]);
  const [curId, setCurId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [sidebar, setSidebar] = useState(false);
  const [page, setPage] = useState('chat');
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState('');
  const [charCard, setCharCard] = useState(null);
  const [wb, setWB] = useState([]);
  const [models, setModels] = useState([]);
  const abortRef = useRef(null);
  const streamRef = useRef('');

  // Init
  useEffect(() => {
    (async () => {
      try {
        const allSettings = await db.getAllSettings();
        setSettings(allSettings);
        if (allSettings.pinHash) { setPinHash(allSettings.pinHash); setLocked(true); }
        setConvs(await db.getAllConversations());
        const chars = await db.getAllCharacters();
        if (chars.length) setCharCard(chars[0]);
        setWB(await db.getWorldBook('_global'));
      } catch (e) { console.error('Init error:', e); }
      setReady(true);
    })();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (!curId) { setMsgs([]); return; }
    db.getAllMessages(curId).then(m => setMsgs(m));
  }, [curId]);

  const saveSetting = useCallback(async (key, value) => {
    await db.setSetting(key, value);
    setSettings(s => ({ ...s, [key]: value }));
  }, []);

  const createConv = useCallback(async () => {
    const conv = { id: genId(), title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), pinned: false };
    await db.putConversation(conv);
    setConvs(c => [conv, ...c]);
    setCurId(conv.id);
    setSidebar(false);
    setPage('chat');
  }, []);

  const delConv = useCallback(async (id) => {
    await db.deleteConversation(id);
    setConvs(c => c.filter(x => x.id !== id));
    if (curId === id) setCurId(null);
  }, [curId]);

  const pinConv = useCallback(async (id) => {
    const conv = await db.getConversation(id);
    if (!conv) return;
    conv.pinned = !conv.pinned;
    await db.putConversation(conv);
    setConvs(await db.getAllConversations());
  }, []);

  const sendMsg = useCallback(async (content) => {
    if (!content.trim() || loading || !curId) return;

    const userMsg = { id: genId(), convId: curId, role: 'user', content, ts: Date.now() };
    await db.putMessage(userMsg);
    const allMsgs = await db.getAllMessages(curId);
    setMsgs(allMsgs);

    // Update title on first message
    if (allMsgs.length === 1) {
      const title = content.slice(0, 40) + (content.length > 40 ? '...' : '');
      const conv = await db.getConversation(curId);
      if (conv) { conv.title = title; conv.updatedAt = Date.now(); await db.putConversation(conv); }
      setConvs(c => c.map(x => x.id === curId ? { ...x, title } : x));
    }
    // Update timestamp
    const conv = await db.getConversation(curId);
    if (conv) { conv.updatedAt = Date.now(); await db.putConversation(conv); }

    // Get fresh settings
    const fresh = await db.getAllSettings();
    const apiUrl = fresh.apiUrl;
    if (!apiUrl) {
      const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ 请先在设置中配置 API。', ts: Date.now() };
      await db.putMessage(em); setMsgs(m => [...m, em]); return;
    }

    // Resolve API key
    let realKey = fresh.apiKey;
    if (!realKey && fresh.encryptedKey) {
      const pin = settings._sessionPin;
      if (!pin) {
        const em = { id: genId(), convId: curId, role: 'assistant', content: '🔒 请先输入 PIN 解锁。', ts: Date.now() };
        await db.putMessage(em); setMsgs(m => [...m, em]); return;
      }
      try { realKey = await decryptStr(fresh.encryptedKey, pin); }
      catch { const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ API Key 解密失败。', ts: Date.now() }; await db.putMessage(em); setMsgs(m => [...m, em]); return; }
    }
    if (!realKey) {
      const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ 请先设置 API Key。', ts: Date.now() };
      await db.putMessage(em); setMsgs(m => [...m, em]); return;
    }

    // Build messages
    const apiMsgs = [];
    let sys = fresh.systemPrompt || 'You are a helpful assistant.';
    if (charCard?.systemPrompt) sys = charCard.systemPrompt;
    apiMsgs.push({ role: 'system', content: sys });
    const wbContent = processWorldBook(wb, content, parseInt(fresh.wbTokenBudget) || 2000);
    if (wbContent) apiMsgs.push({ role: 'system', content: wbContent });
    const ctxMsgs = await db.getAllMessages(curId);
    for (const m of ctxMsgs) apiMsgs.push({ role: m.role, content: m.content });

    setLoading(true);
    setStream('');
    streamRef.current = '';

    const provider = createProvider(fresh.provider || 'openai', { apiUrl, apiKey: realKey, model: fresh.model });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (fresh.stream !== false) {
      provider.streamMessage(apiMsgs,
        { maxTokens: parseInt(fresh.maxTokens) || 4096, temperature: parseFloat(fresh.temperature) || 0.7, topP: parseFloat(fresh.topP) || 1 },
        ctrl.signal,
        (full) => { streamRef.current = full; setStream(full); },
        async (full) => {
          const am = { id: genId(), convId: curId, role: 'assistant', content: full || '(空响应)', ts: Date.now() };
          await db.putMessage(am); setMsgs(m => [...m, am]); setStream(''); setLoading(false); abortRef.current = null;
        },
        async (err) => {
          const em = { id: genId(), convId: curId, role: 'assistant', content: '❌ ' + err.message, ts: Date.now() };
          await db.putMessage(em); setMsgs(m => [...m, em]); setStream(''); setLoading(false); abortRef.current = null;
        }
      );
    } else {
      try {
        const result = await provider.sendMessage(apiMsgs,
          { maxTokens: parseInt(fresh.maxTokens) || 4096, temperature: parseFloat(fresh.temperature) || 0.7, topP: parseFloat(fresh.topP) || 1 }
        );
        const am = { id: genId(), convId: curId, role: 'assistant', content: result || '(空响应)', ts: Date.now() };
        await db.putMessage(am); setMsgs(m => [...m, am]);
      } catch (err) {
        const em = { id: genId(), convId: curId, role: 'assistant', content: '❌ ' + err.message, ts: Date.now() };
        await db.putMessage(em); setMsgs(m => [...m, em]);
      }
      setLoading(false);
    }
  }, [loading, curId, settings._sessionPin, charCard, wb]);

  const stopStream = useCallback(async () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    const partial = streamRef.current;
    if (partial && curId) {
      const am = { id: genId(), convId: curId, role: 'assistant', content: partial + '\n\n[已中断]', ts: Date.now() };
      await db.putMessage(am); setMsgs(m => [...m, am]);
    }
    setStream(''); setLoading(false);
  }, [curId]);

  const fetchModels = useCallback(async () => {
    const fresh = await db.getAllSettings();
    if (!fresh.apiUrl) return [];
    const p = createProvider(fresh.provider || 'openai', { apiUrl: fresh.apiUrl, apiKey: fresh.apiKey, model: fresh.model });
    try { const list = await p.listModels(); setModels(list); return list; }
    catch { return []; }
  }, []);

  // Context value
  const ctx = {
    ready, locked, setLocked, pinHash, setPinHash,
    settings, saveSetting, setSettings,
    convs, setConvs, createConv, delConv, pinConv,
    curId, setCurId,
    msgs, setMsgs,
    sidebar, setSidebar,
    page, setPage,
    loading, stream, sendMsg, stopStream,
    charCard, setCharCard,
    wb, setWB,
    models, fetchModels,
  };

  if (!ready) {
    return h('div', { className: 'empty-state' },
      h('div', { className: 'icon' }, '⚡'),
      h('h3', null, 'Loading...')
    );
  }

  return h(Ctx.Provider, { value: ctx },
    h('div', { className: 'app' },
      h(Sidebar),
      h('div', { className: 'main' },
        page === 'chat' ? h(ChatPage) :
        page === 'settings' ? h(SettingsPage) :
        h(CharacterPage)
      ),
      locked ? h(LockScreen) : null
    )
  );
}

createRoot(document.getElementById('root')).render(h(App));