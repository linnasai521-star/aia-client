import React, { useState, useEffect, useContext } from 'react';
import { Ctx } from '../state.js';
import * as db from '../db/indexeddb.js';
import { showToast } from '../utils/helpers.js';

const h = React.createElement;

export default function CharacterHall({ onSelectCharacter }) {
  const ctx = useContext(Ctx);
  const [characters, setCharacters] = useState([]);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  async function loadCharacters() {
    try {
      const all = await db.getAllCharacters();
      setCharacters(all || []);
    } catch (e) {
      console.error('loadCharacters:', e);
    }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const ch = await ctx.importCharacterCard(file);
      if (ch) {
        showToast(`✅ 角色「${ch.name}」导入成功！`, 'success');
        await loadCharacters();
        if (onSelectCharacter) onSelectCharacter(ch);
      } else {
        showToast('❌ 导入失败', 'error');
      }
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return h('div', { className: 'character-hall' },
    h('div', { className: 'hall-header' },
      h('h1', null, '🎭 角色')
    ),
    h('div', { className: 'hall-content' },
      characters.length === 0 ?
        h('div', { className: 'hall-empty' },
          h('div', { className: 'empty-avatar' }, '🎭'),
          h('h3', null, '还没有角色'),
          h('p', null, '导入你的第一个角色卡片')
        ) :
        h('div', { className: 'character-grid' },
          characters.map(char =>
            h('div', {
              key: char.id,
              className: 'hall-card',
              onClick: () => onSelectCharacter && onSelectCharacter(char)
            },
              h('img', {
                src: char.avatar || '',
                className: 'hall-avatar',
                alt: char.name,
                onError: (ev) => { ev.target.style.display = 'none'; }
              }),
              h('div', { className: 'hall-card-info' },
                h('h3', null, char.name),
                h('p', null, char.description?.substring(0, 50) || '暂无描述'),
                h('div', { className: 'hall-card-footer' },
                  h('span', { className: 'hall-status' }, '● 在线'),
                  h('span', { className: 'hall-time' }, '最近使用')
                )
              )
            )
          )
        )
    ),
    h('div', { className: 'hall-footer' },
      h('input', {
        ref: fileInputRef,
        type: 'file',
        accept: '.json,.png',
        onChange: handleImport,
        style: { display: 'none' }
      }),
      h('button', {
        className: 'import-btn',
        onClick: () => fileInputRef.current?.click()
      }, '+ 导入角色卡')
    )
  );
}