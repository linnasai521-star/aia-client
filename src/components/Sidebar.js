// PNG角色卡支持已添加 - v1.0
import React, { useContext, useState, useRef, useMemo } from 'react';
import { Ctx } from '../state.js';
import { genId, timeAgo, showToast } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

// 提取 PNG 中的文本块
function extractPngTextChunks(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  
  // 验证 PNG 签名
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
    throw new Error('不是有效的 PNG 文件');
  }
  
  const chunks = [];
  let offset = 8; // 跳过 PNG 签名
  
  while (offset < bytes.length - 12) {
    const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    
    if (type === 'tEXt' || type === 'iTXt') {
      const data = bytes.slice(offset + 8, offset + 8 + length);
      const nullIdx = data.indexOf(0);
      
      if (nullIdx > 0) {
        const keyword = String.fromCharCode(...data.slice(0, nullIdx));
        let text;
        
        if (type === 'tEXt') {
          text = String.fromCharCode(...data.slice(nullIdx + 1));
        } else {
          let pos = nullIdx + 1;
          // 跳过压缩标志、语言标签、翻译关键词
          while (pos < data.length && data[pos] !== 0) pos++;
          pos++;
          while (pos < data.length && data[pos] !== 0) pos++;
          pos++;
          text = String.fromCharCode(...data.slice(pos));
        }
        
        chunks.push({ keyword, text, type });
      }
    }
    
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  
  return chunks;
}

// 解析角色卡数据
function parseCardData(json) {
  const d = json.data || json;
  
  return {
    id: genId(),
    name: d.name || json.name || 'Unknown',
    description: d.description || '',
    personality: d.personality || '',
    systemPrompt: d.system_prompt || d.systemPrompt || d.personality || '',
    firstMessage: d.first_mes || d.firstMessage || '',
    exampleDialogue: d.mes_example || '',
    creatorNotes: d.creator_notes || '',
    tags: d.tags || [],
    creator: d.creator || '',
    characterVersion: d.character_version || '',
    worldBook: d.character_book || d.lorebook || null,
    avatar: json.avatar || null,
    createdAt: Date.now(),
  };
}

export function Sidebar() {
  const ctx = useContext(Ctx);
  const [search, setSearch] = useState('');
  const cardRef = useRef(null);
  const wbRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search) return ctx.convs;
    return ctx.convs.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()));
  }, [ctx.convs, search]);

  const handleImportCard = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      let card;
      const isPng = file.name.toLowerCase().endsWith('.png');
      
      if (isPng) {
        // PNG 角色卡导入
        const arrayBuffer = await file.arrayBuffer();
        
        // 将 PNG 文件转换为 base64 URL 作为头像
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const avatarUrl = 'data:image/png;base64,' + btoa(binary);
        
        const chunks = extractPngTextChunks(arrayBuffer);
        
        let cardData = null;
        for (const chunk of chunks) {
          if (chunk.keyword === 'chara' || chunk.keyword === 'ccv3' || chunk.keyword === 'character') {
            try {
              // 尝试 base64 解码
              const decoded = atob(chunk.text.trim());
              cardData = JSON.parse(decoded);
              break;
            } catch {
              try {
                // 直接解析 JSON
                cardData = JSON.parse(chunk.text);
                break;
              } catch {
                continue;
              }
            }
          }
        }
        
        if (!cardData) {
          throw new Error('PNG 中未找到角色卡数据');
        }
        
        card = parseCardData(cardData);
        
        // 设置 PNG 图片作为头像
        card.avatar = avatarUrl;
        
        // 处理关联的世界书
        if (cardData.data?.character_book || cardData.character_book) {
          const worldBookData = cardData.data?.character_book || cardData.character_book;
          if (worldBookData.entries) {
            for (const [key, entry] of Object.entries(worldBookData.entries)) {
              await db.putWorldBookEntry({
                id: genId(),
                convId: '_global',
                keywords: entry.keys || [],
                content: entry.content || '',
                constant: entry.constant || false,
                enabled: entry.enabled !== false,
                priority: entry.insertion_order || 3,
              });
            }
            ctx.setWB(await db.getWorldBook('_global'));
          }
        }
      } else {
        // JSON 角色卡导入
        const text = await file.text();
        const json = JSON.parse(text);
        
        card = parseCardData(json);
        
        // 处理关联的世界书
        const worldBookData = json.data?.character_book || json.character_book || json.lorebook;
        if (worldBookData?.entries) {
          for (const [key, entry] of Object.entries(worldBookData.entries)) {
            await db.putWorldBookEntry({
              id: genId(),
              convId: '_global',
              keywords: entry.keys || [],
              content: entry.content || '',
              constant: entry.constant || false,
              enabled: entry.enabled !== false,
              priority: entry.insertion_order || 3,
            });
          }
          ctx.setWB(await db.getWorldBook('_global'));
        }
      }
      
      await db.putCharacter(card);
      ctx.setCharCard(card);
      showToast('角色卡导入成功', 'success');
    } catch (err) {
      showToast('导入失败: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  const handleImportWB = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.entries) {
        for (const [k, v] of Object.entries(data.entries)) {
          await db.putWorldBookEntry({
            id: genId(), convId: '_global',
            keywords: v.keys || [], content: v.content || '',
            constant: v.constant || false, enabled: v.enabled !== false,
            priority: v.insertion_order || 3,
          });
        }
      }
      ctx.setWB(await db.getWorldBook('_global'));
      showToast('世界书导入成功', 'success');
    } catch (err) { showToast('导入失败: ' + err.message, 'error'); }
    e.target.value = '';
  };

  const TABS = [['chat', '💬 聊天'], ['memory', '🧠 记忆'], ['settings', '⚙️ 设置'], ['character', '🎭 角色']];

  return h(React.Fragment, null,
    ctx.sidebar ? h('div', { className: 'sidebar-overlay show', onClick: () => ctx.setSidebar(false) }) : null,
    h('aside', { className: `sidebar ${ctx.sidebar ? 'open' : ''}` },
      h('div', { className: 'sidebar-header' },
        h('div', { className: 'sidebar-title' },
          h('span', { className: 'icon' }, '⚡'),
          h('span', null, 'AI Aggregator')
        ),
        h('button', { className: 'new-chat-btn', onClick: ctx.createConv }, '+ 新建对话')
      ),
      h('div', { className: 'sidebar-nav' },
        TABS.map(([k, l]) => h('button', {
          key: k,
          className: `nav-tab ${ctx.page === k ? 'active' : ''}`,
          onClick: () => { ctx.setPage(k); ctx.setSidebar(false); },
        }, l))
      ),
      ctx.charCard ? h('div', { className: 'char-badge' },
        h('div', { className: 'avatar' }, ctx.charCard.name?.[0] || '?'),
        h('span', { className: 'name' }, ctx.charCard.name)
      ) : null,
      h('div', { className: 'sidebar-search' },
        h('input', { placeholder: '搜索对话...', value: search, onChange: e => setSearch(e.target.value) })
      ),
      h('div', { className: 'conv-list' },
        filtered.map(c => h('div', {
          key: c.id,
          className: `conv-item ${c.id === ctx.curId ? 'active' : ''}`,
          onClick: () => { ctx.setCurId(c.id); ctx.setSidebar(false); ctx.setPage('chat'); },
        },
          c.pinned ? h('span', { className: 'pin' }, '📌') : null,
          h('span', { className: 'title' }, c.title),
          h('span', { className: 'time' }, timeAgo(c.updatedAt)),
          h('div', { className: 'actions' },
            h('button', { className: 'action-btn', onClick: e => { e.stopPropagation(); ctx.pinConv(c.id); } }, c.pinned ? '📌' : '📍'),
            h('button', { className: 'action-btn', onClick: e => { e.stopPropagation(); ctx.delConv(c.id); } }, '✕')
          )
        ))
      ),
      h('div', { className: 'sidebar-footer' },
        h('input', { ref: cardRef, type: 'file', accept: '.json,.png', style: { display: 'none' }, onChange: handleImportCard }),
        h('input', { ref: wbRef, type: 'file', accept: '.json', style: { display: 'none' }, onChange: handleImportWB }),
        h('button', { className: 'import-btn', onClick: () => cardRef.current?.click() }, '📋 导入角色卡 (JSON/PNG)'),
        h('button', { className: 'import-btn', onClick: () => wbRef.current?.click() }, '📚 导入世界书')
      )
    )
  );
}