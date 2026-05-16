import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Ctx } from './state.js';
import * as db from './db/indexeddb.js';
import * as memorydb from './db/memorydb.js';
import { genId } from './utils/helpers.js';
import { decryptStr } from './utils/crypto.js';
import { createProvider } from './providers/registry.js';
import { ImmersiveSidebar } from './components/ImmersiveSidebar.js';
import { ImmersiveChatPage } from './components/ImmersiveChatPage.js';
import { CharacterPanel } from './components/CharacterPanel.js';
import { SettingsPage } from './components/SettingsPage.js';
import { CharacterPage } from './components/CharacterPage.js';
import { MemoryPage } from './components/MemoryPage.js';
import { LockScreen } from './components/LockScreen.js';
import CharacterHall from './components/CharacterHall.js';
import ChatListPage from './components/ChatListPage.js';
import { parsePngCharacterCard } from './utils/pngParser.js';
import { LoreBookEngine } from './utils/lorebookEngine.js';
import { PromptAssembler, PromptComponents } from './utils/promptAssembler.js';
import { TokenContextManager } from './utils/tokenContextManager.js';

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
  const loreBookEngine = useRef(new LoreBookEngine());
  const promptAssembler = useRef(new PromptAssembler());
  const tokenManager = useRef(new TokenContextManager());

  // 新路由状态
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [pageHistory, setPageHistory] = useState([]);

  // Init
  useEffect(() => { (async () => {
    try {
      const allSettings = await db.getAllSettings();
      setSettings(allSettings);
      if (allSettings.pinHash) { setPinHash(allSettings.pinHash); setLocked(true); }
      setConvs(await db.getAllConversations());
      const chars = await db.getAllCharacters();
      if (chars.length) {
        const card = normalizeCharCard(chars[0]);
        setCharCard(card);
        setSelectedCharacter(chars[0]);
        initRpEngine(card);
      }
      setWB(await db.getWorldBook('_global'));
    } catch(e) { console.error('Init:', e); }
    setReady(true);
  })(); }, []);

  // Load messages
  useEffect(() => {
    if (!curId) { setMsgs([]); return; }
    db.getAllMessages(curId).then(ms => setMsgs(ms));
  }, [curId]);

  // Normalize character card for both naming conventions
  function normalizeCharCard(c) {
    if (!c) return null;
    return {
      ...c,
      systemPrompt: c.systemPrompt || c.system_prompt || '',
      system_prompt: c.system_prompt || c.systemPrompt || '',
      firstMessage: c.firstMessage || c.first_mes || '',
      first_mes: c.first_mes || c.firstMessage || '',
      exampleDialogue: c.exampleDialogue || c.mes_example || '',
      mes_example: c.mes_example || c.exampleDialogue || '',
      creatorNotes: c.creatorNotes || c.creator_notes || '',
      creator_notes: c.creator_notes || c.creatorNotes || '',
    };
  }

  function initRpEngine(card) {
    loreBookEngine.current.clear();
    promptAssembler.current.clear();
    if (card) {
      if (card.worldbook && Array.isArray(card.worldbook) && card.worldbook.length) {
        const entries = loreBookEngine.current.importFromJSON(card.worldbook);
        loreBookEngine.current.addEntries(entries);
        console.log('[RPEngine] Loaded', entries.length, 'lorebook entries');
      }
      promptAssembler.current.setFromCharacterCard(card);
    }
  }

  // ===== 导航函数 =====
  function navigateToCharacterHall() {
    setPage('characterHall');
    setSidebar(false);
  }

  function navigateToChatList(character) {
    setSelectedCharacter(character);
    setPage('chatList');
  }

  async function openChat(character, chat) {
    setSelectedCharacter(character);
    setSelectedChat(chat);
    const normalized = normalizeCharCard(character);
    setCharCard(normalized);
    initRpEngine(normalized);
    
    // 创建新对话并关联 chatId
    const conv = {
      id: genId(),
      title: chat.title || '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      characterId: character.id,
      chatId: chat.chatId
    };
    await db.putConversation(conv);
    setConvs(c => [conv, ...c]);
    setCurId(conv.id);
    setSidebar(false);
    setPage('chat');
    setMsgs([]);
    
    // 更新 chat 的 lastMessageAt
    try {
      chat.lastMessageAt = Date.now();
      chat.updatedAt = Date.now();
      await db.putChat(chat);
    } catch(e) { /* ignore */ }
    
    const fm = normalized.first_mes || normalized.firstMessage;
    if (fm && fm.trim()) {
      const initMsg = { id: genId()+'_init', convId: conv.id, role: 'assistant', content: fm, ts: Date.now(), chatId: chat.chatId };
      await db.putMessage(initMsg);
      setMsgs([initMsg]);
    }
  }

  const createChat = useCallback(async () => {
    const charId = charCard?.id;
    if (!charId) return;
    const chatId = genId();
    await db.putChat({ chatId, characterId: charId, title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), lastMessageAt: Date.now(), summary: '', messageCount: 0 });
    setCurrentChatId(chatId);
    setPage('chat');
    if (charCard?.first_mes) {
      const m = { id: genId()+'_init', chatId, role: 'assistant', content: charCard.first_mes, ts: Date.now() };
      await db.putMessage(m);
      setMsgs([m]);
      await db.updateChat(chatId, { summary: charCard.first_mes.substring(0,50), messageCount: 1 });
    }
  }, [charCard]);

  const openExistingChat = useCallback(async (chat) => {
    setCurrentChatId(chat.chatId);
    setPage('chat');
    const chatMsgs = await db.getMessagesByChatId(chat.chatId);
    setMsgs(chatMsgs);
    if (chat.characterId) {
      const ch = await db.getCharacter(chat.characterId);
      if (ch) setCharCard({ ...ch, first_mes: ch.first_mes || ch.firstMessage || '', mes_example: ch.mes_example || '', system_prompt: ch.system_prompt || '' });
    }
  }, []);

  const saveSetting = useCallback(async (key, value) => {
    await db.setSetting(key, value);
    setSettings(s => ({ ...s, [key]: value }));
  }, []);

  const createConv = useCallback(async () => {
    const conv = { id: genId(), title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), pinned: false, characterId: selectedCharacter?.id || charCard?.id || null };
    await db.putConversation(conv);
    setConvs(c => [conv, ...c]);
    setCurId(conv.id);
    setSidebar(false);
    setPage('chat');
    setMsgs([]);
    // 如果有角色卡且first_mes不为空，自动插入开场白
    if (charCard) {
      const fm = charCard.first_mes || charCard.firstMessage;
      if (fm && fm.trim()) {
        const initMsg = { id: genId()+'_init', convId: conv.id, role: 'assistant', content: fm, ts: Date.now() };
        await db.putMessage(initMsg);
        setMsgs([initMsg]);
        console.log('[RPEngine] Auto-inserted first_mes');
      }
    }
  }, [charCard, selectedCharacter]);

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

  // 角色卡导入
  const importCharacterCard = useCallback(async (file) => {
    try {
      let characterData = null;
      let avatar = null;
      if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        // 将 PNG 文件转为 base64（永久存储，刷新后不会丢失）
        try {
          avatar = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
              resolve(e.target.result); // data:image/png;base64,xxxxx
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          console.log('[Import] Avatar saved as base64, length:', avatar.length);
        } catch(err) {
          console.warn('[Import] Avatar read failed:', err);
          avatar = null;
        }
        characterData = await parsePngCharacterCard(file);
        console.log('[Import] PNG parsed:', { name: characterData.name, hasPersonality: !!characterData.personality, hasFirstMes: !!characterData.first_mes, hasScenario: !!characterData.scenario, hasWorldbook: !!(characterData.worldbook?.length), tags: characterData.tags });
      } else if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        if (jsonData.spec === 'chara_card_v2' || jsonData.data) {
          characterData = jsonData.data || jsonData;
        } else {
          characterData = jsonData;
        }
      }
      
      if (characterData) {
        const character = {
          id: genId(),
          name: characterData.name || '未知角色',
          description: characterData.description || '',
          personality: characterData.personality || '',
          scenario: characterData.scenario || '',
          first_mes: characterData.first_mes || characterData.firstMessage || '',
          firstMessage: characterData.firstMessage || characterData.first_mes || '',
          mes_example: characterData.mes_example || characterData.mesExample || characterData.exampleDialogue || '',
          exampleDialogue: characterData.exampleDialogue || characterData.mes_example || '',
          creator_notes: characterData.creator_notes || characterData.creatorNotes || '',
          creatorNotes: characterData.creatorNotes || characterData.creator_notes || '',
          system_prompt: characterData.system_prompt || characterData.systemPrompt || '',
          systemPrompt: characterData.systemPrompt || characterData.system_prompt || '',
          post_history_instructions: characterData.post_history_instructions || '',
          alternate_greetings: characterData.alternate_greetings || [],
          tags: characterData.tags || [],
          creator: characterData.creator || '',
          character_version: characterData.character_version || characterData.characterVersion || '',
          extensions: characterData.extensions || {},
          worldbook: characterData.worldbook || characterData.character_book || [],
          avatar: avatar || characterData.avatar || '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        await db.putCharacter(character);
        const normalized = normalizeCharCard(character);
        setCharCard(normalized);
        setSelectedCharacter(character);
        initRpEngine(normalized);
        console.log('[Import] Character saved:', { name: normalized.name, avatar: !!normalized.avatar, hasFirstMes: !!normalized.first_mes });
        return normalized;
      }
      return null;
    } catch (error) {
      console.error('[Import] Failed:', error);
      throw error;
    }
  }, []);

  // 世界书导入
  const importLoreBook = useCallback(async (file) => {
    try {
      let entries = [];
      if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        entries = loreBookEngine.current.importFromJSON(text);
      } else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        const metadata = await parsePngCharacterCard(file);
        entries = loreBookEngine.current.extractFromPNGMetadata(metadata);
      }
      if (entries.length > 0) {
        for (const entry of entries) {
          await db.putWorldBookEntry({ ...entry, convId: '_global', createdAt: Date.now(), updatedAt: Date.now() });
        }
        const freshWb = await db.getWorldBook('_global');
        setWB(freshWb);
        loreBookEngine.current.addEntries(entries);
        console.log('[Import] Lorebook loaded:', entries.length, 'entries');
      }
      return entries.length;
    } catch (error) {
      console.error('[Import] Lorebook failed:', error);
      throw error;
    }
  }, []);

  // 发送消息
  const sendMsg = useCallback(async (content) => {
    if (!content.trim() || loading || !curId) return;
    
    const userMsg = { id: genId(), convId: curId, role: 'user', content, ts: Date.now(), chatId: selectedChat?.chatId };
    await db.putMessage(userMsg);
    const allMsgs = await db.getAllMessages(curId);
    setMsgs(allMsgs);
    
    // Update title
    if (allMsgs.length === 1) {
      const title = content.slice(0, 40) + (content.length > 40 ? '...' : '');
      const conv = await db.getConversation(curId);
      if (conv) { conv.title = title; conv.updatedAt = Date.now(); await db.putConversation(conv); }
      setConvs(c => c.map(x => x.id === curId ? { ...x, title } : x));
    }
    const conv = await db.getConversation(curId);
    if (conv) { conv.updatedAt = Date.now(); await db.putConversation(conv); }
    
    // Get API config
    const fresh = await db.getAllSettings();
    let cfgId = fresh.currentApiConfigId || '';
    let apiCfg = null;
    if (cfgId) apiCfg = await db.getApiConfig(cfgId);
    if (!apiCfg) apiCfg = await db.getDefaultApiConfig();
    if (!apiCfg?.baseURL) {
      const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ 请先在设置中配置 API。', ts: Date.now() };
      await db.putMessage(em); setMsgs(m => [...m, em]); return;
    }
    
    let realKey = apiCfg.apiKey || '';
    if (!realKey && apiCfg.encryptedKey) {
      const pin = settings._sessionPin;
      if (!pin) {
        const em = { id: genId(), convId: curId, role: 'assistant', content: '🔒 请先输入 PIN 解锁。', ts: Date.now() };
        await db.putMessage(em); setMsgs(m => [...m, em]); return;
      }
      try { realKey = await decryptStr(apiCfg.encryptedKey, pin); }
      catch {
        const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ API Key 解密失败。', ts: Date.now() };
        await db.putMessage(em); setMsgs(m => [...m, em]); return;
      }
    }
    if (!realKey) {
      const em = { id: genId(), convId: curId, role: 'assistant', content: '⚠️ 请先设置 API Key。', ts: Date.now() };
      await db.putMessage(em); setMsgs(m => [...m, em]); return;
    }
    
    // RP引擎：构建完整Prompt
    promptAssembler.current.clear();
    if (charCard) promptAssembler.current.setFromCharacterCard(charCard);
    
    // 世界书关键词触发
    const combinedText = content + ' ' + (charCard?.name || '');
    const loreBookEntries = loreBookEngine.current.trigger(combinedText);
    if (loreBookEntries.length > 0) {
      const loreContext = loreBookEngine.current.generateContext(combinedText, 2000);
      if (loreContext) {
        promptAssembler.current.setComponent(PromptComponents.LOREBOOK, loreContext);
        console.log('[RPEngine] Lorebook triggered:', loreBookEntries.length, 'entries');
      }
    }
    
    promptAssembler.current.setChatHistory(allMsgs, 50);
    const assembled = promptAssembler.current.assemble();
    
    const managed = tokenManager.current.manageContext({
      systemPrompt: assembled.system,
      messages: assembled.messages,
      loreBook: loreBookEntries,
      characterCard: charCard
    });
    
    // ===== 第 1.1 步：构建完整 system prompt（覆盖 managed.systemPrompt） =====
    console.log('=== Prompt Assembly Start ===');
    
    let systemPrompt = '';
    const charName = charCard?.name || '角色';
    
    // 角色身份指令
    if (charName) {
      systemPrompt += `你现在正在扮演「${charName}」。你必须始终以该角色的身份、性格和说话方式回复。不要承认自己是AI，不要打破角色，不要使用任何语言模型的口吻。\n\n`;
    }
    
    // 角色描述
    if (charCard?.description && charCard.description.trim()) {
      systemPrompt += `[角色描述]\n${charCard.description}\n\n`;
    }
    
    // 角色性格
    if (charCard?.personality && charCard.personality.trim()) {
      systemPrompt += `[角色性格]\n${charCard.personality}\n\n`;
    }
    
    // 场景设定
    if (charCard?.scenario && charCard.scenario.trim()) {
      systemPrompt += `[场景设定]\n${charCard.scenario}\n\n`;
    }
    
    // 系统提示词（角色卡自带的system_prompt）
    if (charCard?.system_prompt && charCard.system_prompt.trim()) {
      systemPrompt += `[角色指令]\n${charCard.system_prompt}\n\n`;
    }
    
    // 示例对话
    if (charCard?.mes_example && charCard.mes_example.trim()) {
      systemPrompt += `[对话示例]\n${charCard.mes_example}\n\n`;
    }
    
    // 世界书触发内容
    const allLoreEntries = loreBookEngine.current.getAllEntries();
    if (allLoreEntries.length > 0) {
      const triggeredEntries = loreBookEngine.current.trigger(content);
      console.log('[Worldbook] Total loaded:', allLoreEntries.length, '| Triggered:', triggeredEntries.length);
      
      if (triggeredEntries.length > 0) {
        let loreText = '[世界知识]\n以下是你知道的世界设定，请在回复中自然地结合这些知识：\n';
        triggeredEntries.forEach(entry => {
          if (entry.content) {
            loreText += entry.content + '\n';
            console.log('[Worldbook] Injected:', entry.comment || 'entry-' + entry.id);
          }
        });
        systemPrompt += loreText + '\n';
      }
    }
    
    // 对话规则（防止AI跳出角色）
    systemPrompt += `[对话规则]\n`;
    systemPrompt += `1. 你就是「${charName}」，永远不要脱离这个角色\n`;
    systemPrompt += `2. 不要说"作为AI"、"我是语言模型"、"我是助手"等破坏角色的话\n`;
    systemPrompt += `3. 回复要符合角色的性格、语气和说话方式\n`;
    systemPrompt += `4. 用括号描写动作和心情，如"（微微笑）"、"（轻轻叹了口气）"\n`;
    systemPrompt += `5. 回复要有真实情感，像真人在说话\n`;
    systemPrompt += `6. 回复长度适中（50-300字），不要太空洞也不要太冗长\n`;
    systemPrompt += `7. 不要总结对话，不要解释你的设定\n`;
    systemPrompt += `8. 不要说"你想要我做什么"、"请问还有什么问题"等客服话\n`;
    systemPrompt += `9. 像一个真实的人一样与用户互动，保持角色的个性\n`;
    systemPrompt += `10. 回复风格参考该角色的示例对话\n\n`;
    
    // 首句提醒
    if (charCard?.first_mes && charCard.first_mes.trim()) {
      systemPrompt += `[开场记忆]\n你之前说过这段话：「${charCard.first_mes.substring(0, 200)}」\n请继续以这个角色状态和用户交流。\n\n`;
    }
    
    console.log('[Prompt] Final system prompt length:', systemPrompt.length);
    console.log('[Prompt] Preview:', systemPrompt.substring(0, 300));
    console.log('=== Prompt Assembly End ===');
    // ===== system prompt 构建结束 =====
    
    // ===== 第 1.2 步：构建 apiMsgs =====
    const apiMsgs = [];
    
    // 第一条：system prompt（强制非空）
    if (systemPrompt) {
      apiMsgs.push({ role: 'system', content: systemPrompt });
    } else if (managed.systemPrompt) {
      apiMsgs.push({ role: 'system', content: managed.systemPrompt });
    }
    
    // 后面：聊天历史（只取最近的消息）
    const recentMessages = allMsgs.slice(-30); // 最近30条
    for (const msg of recentMessages) {
      apiMsgs.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }
    
    console.log('[Prompt] Final apiMsgs count:', apiMsgs.length);
    console.log('[Prompt] Messages:', apiMsgs.map(m => m.role + ': ' + (m.content || '').substring(0, 20)));
    
    // ===== 第 2 步：调试日志 =====
    console.log('');
    console.log('========================================');
    console.log('        PROMPT ASSEMBLY RESULTS        ');
    console.log('========================================');
    console.log('Character:', charCard?.name || 'none');
    console.log('Description:', charCard?.description ? charCard.description.substring(0, 50) + '...' : '(empty)');
    console.log('Personality:', charCard?.personality || '(empty)');
    console.log('Scenario:', charCard?.scenario || '(empty)');
    console.log('SystemPrompt (from card):', charCard?.system_prompt ? 'exists (' + charCard.system_prompt.length + ' chars)' : '(empty)');
    console.log('MesExample:', charCard?.mes_example ? 'exists (' + charCard.mes_example.length + ' chars)' : '(empty)');
    console.log('FirstMes:', charCard?.first_mes ? 'exists (' + charCard.first_mes.length + ' chars)' : '(empty)');
    console.log('Worldbook entries:', allLoreEntries.length);
    console.log('Final system prompt:', systemPrompt.length, 'chars');
    console.log('System prompt preview:', systemPrompt.substring(0, 500));
    console.log('apiMsgs count:', apiMsgs.length);
    console.log('First msg role:', apiMsgs[0]?.role);
    console.log('========================================');
    console.log('');
    // ===== 调试日志结束 =====
    
    setLoading(true); setStream(''); streamRef.current = '';
    
    const cfgModel = apiCfg.model || 'gpt-4o';
    const provider = createProvider(apiCfg.provider || 'openai', { apiUrl: apiCfg.baseURL, apiKey: realKey, model: cfgModel });
    const ctrl = new AbortController(); abortRef.current = ctrl;
    
    if (fresh.stream !== false) {
      provider.streamMessage(apiMsgs,
        { maxTokens: parseInt(fresh.maxTokens) || 4096, temperature: parseFloat(fresh.temperature) || 0.7, topP: parseFloat(fresh.topP) || 1 },
        ctrl.signal,
        (full) => { streamRef.current = full; setStream(full); },
        async (full) => {
          const am = { id: genId(), convId: curId, role: 'assistant', content: full || '(空响应)', ts: Date.now(), chatId: selectedChat?.chatId };
          await db.putMessage(am); setMsgs(m => [...m, am]); setStream(''); setLoading(false); abortRef.current = null;
        },
        async (err) => {
          const em = { id: genId(), convId: curId, role: 'assistant', content: '❌ ' + (err.message || '未知错误'), ts: Date.now() };
          await db.putMessage(em); setMsgs(m => [...m, em]); setStream(''); setLoading(false); abortRef.current = null;
        }
      );
    } else {
      provider.sendMessage(apiMsgs,
        { maxTokens: parseInt(fresh.maxTokens) || 4096, temperature: parseFloat(fresh.temperature) || 0.7, topP: parseFloat(fresh.topP) || 1 },
        ctrl.signal
      ).then(async (resp) => {
        const am = { id: genId(), convId: curId, role: 'assistant', content: resp || '(空响应)', ts: Date.now(), chatId: selectedChat?.chatId };
        await db.putMessage(am); setMsgs(m => [...m, am]); setLoading(false); abortRef.current = null;
      }).catch(async (err) => {
        const em = { id: genId(), convId: curId, role: 'assistant', content: '❌ ' + (err.message || '未知错误'), ts: Date.now(), chatId: selectedChat?.chatId };
        await db.putMessage(em); setMsgs(m => [...m, em]); setLoading(false); abortRef.current = null;
      });
    }
  }, [loading, curId, charCard, settings._sessionPin]);

  const stopStream = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setLoading(false); setStream('');
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const fresh = await db.getAllSettings();
      let cfgId = fresh.currentApiConfigId || '';
      let apiCfg = null;
      if (cfgId) apiCfg = await db.getApiConfig(cfgId);
      if (!apiCfg) apiCfg = await db.getDefaultApiConfig();
      if (!apiCfg?.baseURL || !apiCfg?.apiKey) { setModels([]); return []; }
      const provider = createProvider(apiCfg.provider || 'openai', { apiUrl: apiCfg.baseURL, apiKey: apiCfg.apiKey });
      const list = await provider.listModels();
      setModels(list); return list;
    } catch(e) { console.error('Fetch models:', e); setModels([]); return []; }
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
    importCharacterCard, importLoreBook,
    loreBookEngine: loreBookEngine.current,
    promptAssembler: promptAssembler.current,
    tokenManager: tokenManager.current,
    // 新路由暴露
    selectedCharacter, selectedChat,
    navigateToCharacterHall, navigateToChatList, openChat,
    currentChatId, setCurrentChatId, createChat, openExistingChat, pageHistory, setPageHistory, page, setPage
  };

  if (!ready) return h('div', { className: 'empty-state' },
    h('div', { className: 'empty-state-inner' },
      h('div', { className: 'icon' }, '⚡'),
      h('h3', null, 'Loading...')
    )
  );

  // 底部导航栏
  const navItems = [
    { id: 'chat', icon: '💬', label: '聊天', action: () => { if (charCard) { setPage('chatList'); setSidebar(false); } else { setPage('characterHall'); setSidebar(false); } } },
    { id: 'character', icon: '🎭', label: '角色', action: () => navigateToCharacterHall() },
    { id: 'memory', icon: '🧠', label: '记忆', action: () => { setPage('memory'); setSidebar(false); } },
    { id: 'settings', icon: '⚙️', label: '设置', action: () => { setPage('settings'); setSidebar(false); } },
  ];

  const renderBottomNav = () => h('nav', { className: 'bottom-nav' },
    navItems.map(item => {
      const isActive = page === item.id
        || (item.id === 'character' && (page === 'characterHall' || page === 'chatList'))
        || (item.id === 'chat' && (page === 'chatList' || page === 'chat'));
      return h('button', {
        key: item.id,
        className: 'bot-nav-item' + (isActive ? ' active' : ''),
        onClick: item.action
      },
        h('span', { className: 'bot-nav-icon' }, item.icon),
        h('span', { className: 'bot-nav-label' }, item.label)
      );
    })
  );

  return h(Ctx.Provider, { value: ctx },
    h('div', { className: 'app-shell' },
      h(ImmersiveSidebar),
      h('div', { className: 'page-content-area' },
        page === 'chat' ? h(ImmersiveChatPage) :
        page === 'settings' ? h(SettingsPage) :
        page === 'memory' ? h(MemoryPage) :
        page === 'character' ? h(CharacterPage) :
        page === 'characterHall' ? h(CharacterHall, { onSelectCharacter: (char) => navigateToChatList(char) }) :
        page === 'chatList' && charCard ? h(ChatListPage, {
          characterId: charCard.id,
          onSelectChat: (chat) => openExistingChat(chat),
          onBack: () => setPage('characterHall')
        }) :
        h(ImmersiveChatPage)
      ),
      renderBottomNav(),
      locked ? h(LockScreen) : null
    )
  );
}

const root = createRoot(document.getElementById('root'));
root.render(h(App));
