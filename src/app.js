import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Ctx } from './state.js';
import * as db from './db/indexeddb.js';
import * as memorydb from './db/memorydb.js';
import { genId } from './utils/helpers.js';
import { decryptStr } from './utils/crypto.js';
import { createProvider } from './providers/registry.js';
import { processWorldBook } from './utils/worldbook.js';
import { extractFromConversation, generateSummary, buildMemoryContext } from './utils/memory.js';
import { ImmersiveSidebar } from './components/ImmersiveSidebar.js';
import { ImmersiveChatPage } from './components/ImmersiveChatPage.js';
import { CharacterPanel } from './components/CharacterPanel.js';
import { SettingsPage } from './components/SettingsPage.js';
import { CharacterPage } from './components/CharacterPage.js';
import { MemoryPage } from './components/MemoryPage.js';
import { LockScreen } from './components/LockScreen.js';

// NEW: RP引擎组件
import { parsePngCharacterCard, isSillyTavernCharacterCard, getCharacterCardVersion } from './utils/pngParser.js';
import { LoreBookEngine, globalLoreBook } from './utils/lorebookEngine.js';
import { PromptAssembler, PromptComponents, globalPromptAssembler } from './utils/promptAssembler.js';
import { TokenContextManager, globalTokenManager } from './utils/tokenContextManager.js';

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
  const [memoryContext, setMemoryContext] = useState('');
  const abortRef = useRef(null);
  const streamRef = useRef('');
  
  // NEW: RP引擎实例
  const loreBookEngine = useRef(new LoreBookEngine());
  const promptAssembler = useRef(new PromptAssembler());
  const tokenManager = useRef(new TokenContextManager());
  
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
        
        // NEW: 初始化RP引擎
        if (chars.length > 0) {
          const card = chars[0];
          loreBookEngine.current.clear();
          if (card.worldbook && Array.isArray(card.worldbook)) {
            const entries = loreBookEngine.current.importFromJSON(card.worldbook);
            loreBookEngine.current.addEntries(entries);
          }
          promptAssembler.current.clear();
          promptAssembler.current.setFromCharacterCard(card);
        }
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
  
  // NEW: 角色卡导入函数
  const importCharacterCard = useCallback(async (file) => {
    try {
      let characterData = null;
      
      if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        // 解析PNG角色卡
        characterData = await parsePngCharacterCard(file);
        console.log('Parsed PNG character card:', characterData);
      } else if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
        // 解析JSON角色卡
        const text = await file.text();
        const jsonData = JSON.parse(text);
        
        // 检查是否为SillyTavern格式
        if (jsonData.spec === 'chara_card_v2' || jsonData.data) {
          characterData = jsonData.data || jsonData;
        } else {
          characterData = jsonData;
        }
      }
      
      if (characterData) {
        // 确保必要字段
        const character = {
          id: characterData.name || genId(),
          name: characterData.name || '未知角色',
          description: characterData.description || '',
          personality: characterData.personality || '',
          scenario: characterData.scenario || '',
          first_mes: characterData.first_mes || characterData.firstMessage || '',
          mes_example: characterData.mes_example || characterData.exampleDialogue || '',
          creator_notes: characterData.creator_notes || characterData.creatorNotes || '',
          system_prompt: characterData.system_prompt || characterData.systemPrompt || '',
          post_history_instructions: characterData.post_history_instructions || '',
          alternate_greetings: characterData.alternate_greetings || [],
          tags: characterData.tags || [],
          creator: characterData.creator || '',
          character_version: characterData.character_version || characterData.characterVersion || '',
          extensions: characterData.extensions || {},
          worldbook: characterData.worldbook || characterData.character_book || [],
          avatar: characterData.avatar || '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        // 保存到数据库
        await db.putCharacter(character);
        setCharCard(character);
        
        // 更新RP引擎
        loreBookEngine.current.clear();
        if (character.worldbook && Array.isArray(character.worldbook)) {
          const entries = loreBookEngine.current.importFromJSON(character.worldbook);
          loreBookEngine.current.addEntries(entries);
        }
        
        promptAssembler.current.clear();
        promptAssembler.current.setFromCharacterCard(character);
        
        return character;
      }
    } catch (error) {
      console.error('Import character card failed:', error);
      throw error;
    }
  }, []);
  
  // NEW: 世界书导入函数
  const importLoreBook = useCallback(async (file) => {
    try {
      let entries = [];
      
      if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        entries = loreBookEngine.current.importFromJSON(text);
      } else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        // 从PNG中提取世界书
        const metadata = await parsePngCharacterCard(file);
        entries = loreBookEngine.current.extractFromPNGMetadata(metadata);
      }
      
      if (entries.length > 0) {
        // 保存到数据库
        for (const entry of entries) {
          await db.putWorldBookEntry({
            ...entry,
            convId: '_global',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
        
        // 更新内存中的世界书
        setWB(await db.getWorldBook('_global'));
        
        // 更新RP引擎
        loreBookEngine.current.addEntries(entries);
        
        return entries.length;
      }
    } catch (error) {
      console.error('Import lorebook failed:', error);
      throw error;
    }
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
    let cfgId = fresh.currentApiConfigId || '';
    let apiCfg = null;
    if (cfgId) apiCfg = await db.getApiConfig(cfgId);
    if (!apiCfg) { apiCfg = await db.getDefaultApiConfig(); }
    const apiUrl = apiCfg?.baseURL || '';
    if (!apiUrl) {
      const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ 请先在设置中配置 API。', ts: Date.now() };
      await db.putMessage(em); setMsgs(m => [...m, em]); return;
    }
    
    // Resolve API key
    let realKey = apiCfg?.apiKey || "";
    if (!realKey && apiCfg?.encryptedKey) {
      const pin = settings._sessionPin;
      if (!pin) {
        const em = { id: genId(), convId: curId, role: 'assistant', content: '🔒 请先输入 PIN 解锁。', ts: Date.now() };
        await db.putMessage(em); setMsgs(m => [...m, em]); return;
      }
      try { realKey = await decryptStr(apiCfg.encryptedKey, pin); }
      catch { const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ API Key 解密失败。', ts: Date.now() }; await db.putMessage(em); setMsgs(m => [...m, em]); return; }
    }
    if (!realKey) {
      const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ 请先设置 API Key。', ts: Date.now() };
      await db.putMessage(em); setMsgs(m => [...m, em]); return;
    }
    
    // NEW: 使用RP引擎构建消息
    // 1. 设置角色卡
    if (charCard) {
      promptAssembler.current.setFromCharacterCard(charCard);
    }
    
    // 2. 设置用户消息触发的LoreBook
    const loreBookEntries = loreBookEngine.current.trigger(content);
    const loreBookContext = loreBookEngine.current.generateContext(content, 2000);
    if (loreBookContext) {
      promptAssembler.current.setComponent(PromptComponents.LOREBOOK, loreBookContext);
    }
    
    // 3. 设置聊天历史
    promptAssembler.current.setChatHistory(allMsgs, 50);
    
    // 4. 拼装prompt
    const assembled = promptAssembler.current.assemble();
    
    // 5. 使用Token管理器优化上下文
    const managed = tokenManager.current.manageContext({
      systemPrompt: assembled.system,
      messages: assembled.messages,
      loreBook: loreBookEntries,
      characterCard: charCard
    });
    
    // 6. 构建最终消息数组
    const apiMsgs = [];
    if (managed.systemPrompt) {
      apiMsgs.push({ role: 'system', content: managed.systemPrompt });
    }
    for (const msg of managed.messages) {
      apiMsgs.push(msg);
    }
    
    setLoading(true);
    setStream('');
    streamRef.current = '';
    
    const cfgModel = apiCfg?.model || 'gpt-4o';
    const provider = createProvider(apiCfg?.provider || fresh.provider || 'openai', { apiUrl, apiKey: realKey, model: cfgModel });
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
          const em = { id: genId(), convId: curId, role: 'assistant', content: '❌ 错误：' + (err.message || '未知错误'), ts: Date.now() };
          await db.putMessage(em); setMsgs(m => [...m, em]); setStream(''); setLoading(false); abortRef.current = null;
        }
      );
    } else {
      provider.sendMessage(apiMsgs,
        { maxTokens: parseInt(fresh.maxTokens) || 4096, temperature: parseFloat(fresh.temperature) || 0.7, topP: parseFloat(fresh.topP) || 1 },
        ctrl.signal
      ).then(async (response) => {
        const am = { id: genId(), convId: curId, role: 'assistant', content: response || '(空响应)', ts: Date.now() };
        await db.putMessage(am); setMsgs(m => [...m, am]); setLoading(false); abortRef.current = null;
      }).catch(async (err) => {
        const em = { id: genId(), convId: curId, role: 'assistant', content: '❌ 错误：' + (err.message || '未知错误'), ts: Date.now() };
        await db.putMessage(em); setMsgs(m => [...m, em]); setLoading(false); abortRef.current = null;
      });
    }
  }, [loading, curId, charCard, settings._sessionPin]);
  
  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
    setStream('');
  }, []);
  
  const fetchModels = useCallback(async () => {
    try {
      const fresh = await db.getAllSettings();
      let cfgId = fresh.currentApiConfigId || '';
      let apiCfg = null;
      if (cfgId) apiCfg = await db.getApiConfig(cfgId);
      if (!apiCfg) { apiCfg = await db.getDefaultApiConfig(); }
      const apiUrl = apiCfg?.baseURL || '';
      const apiKey = apiCfg?.apiKey || '';
      
      if (!apiUrl || !apiKey) {
        setModels([]);
        return [];
      }
      
      const provider = createProvider(apiCfg?.provider || fresh.provider || 'openai', { apiUrl, apiKey });
      const modelList = await provider.listModels();
      setModels(modelList);
      return modelList;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setModels([]);
      return [];
    }
  }, []);
  
  const ctx = {
    ready, locked, setLocked, pinHash, setPinHash,
    settings, saveSetting,
    convs, curId, setCurId, createConv, delConv, pinConv,
    msgs, sendMsg, stopStream,
    sidebar, setSidebar,
    page, setPage,
    loading, stream,
    charCard, setCharCard,
    wb, setWB,
    models, fetchModels,
    memoryContext, setMemoryContext,
    // NEW: RP引擎方法
    importCharacterCard,
    importLoreBook,
    loreBookEngine: loreBookEngine.current,
    promptAssembler: promptAssembler.current,
    tokenManager: tokenManager.current
  };
  
  if (!ready) {
    return h('div', { className: 'empty-state' },
      h('div', { className: 'icon' }, '⚡'),
      h('h3', null, 'Loading...')
    );
  }
  
  return h(Ctx.Provider, { value: ctx },
    h('div', { 
      className: 'app',
      style: {
        background: settings.customBackground || settings.customBackgroundColor || 'var(--bg-primary)'
      }
    },
      // 粒子背景
      h('div', { className: 'particles' },
        h('div', { className: 'particle' }),
        h('div', { className: 'particle' }),
        h('div', { className: 'particle' }),
        h('div', { className: 'particle' }),
        h('div', { className: 'particle' })
      ),
      
      // 沉浸式侧边栏
      h(ImmersiveSidebar),
      
      // 主内容区域
      h('div', { className: 'main' },
        page === 'chat' ? 
          h('div', { className: 'chat-layout' },
            h(ImmersiveChatPage),
            h(CharacterPanel)
          ) :
        page === 'settings' ? h(SettingsPage) :
        page === 'memory' ? h(MemoryPage) :
        page === 'character' ? h(CharacterPage) :
        h(ImmersiveChatPage) // 默认显示沉浸式聊天
      ),
      
      locked ? h(LockScreen) : null
    )
  );
}

const root = createRoot(document.getElementById('root'));
root.render(h(App));
