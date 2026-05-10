import React, { useContext, useState, useRef, useMemo } from 'react';
import { Ctx } from '../state.js';
import { genId, timeAgo, showToast } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

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
      const text = await file.text();
      const json = JSON.parse(text);
      const d = json.data || json;
      const card = {
        id: genId(), name: d.name || json.name || 'Unknown',
        description: d.description || '', personality: d.personality || '',
        systemPrompt: d.system_prompt || d.systemPrompt || d.personality || '',
        firstMessage: d.first_mes || d.firstMessage || '',
        exampleDialogue: d.mes_example || '', creatorNotes: d.creator_notes || '',
        tags: d.tags || [], creator: d.creator || '', createdAt: Date.now(),
      };
      await db.putCharacter(card);
      ctx.setCharCard(card);
      showToast('角色卡导入成功', 'success');
    } catch (err) { showToast('导入失败: ' + err.message, 'error'); }
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

  const TABS = [['chat', '💬 聊天'], ['settings', '⚙️ 设置'], ['character', '🎭 角色']];

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
        h('button', { className: 'import-btn', onClick: () => cardRef.current?.click() }, '📋 导入角色卡'),
        h('button', { className: 'import-btn', onClick: () => wbRef.current?.click() }, '📚 导入世界书')
      )
    )
  );
}