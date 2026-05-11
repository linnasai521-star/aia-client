import React, { useContext } from 'react';
import { Ctx } from '../state.js';
import { showToast } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

export function CharacterPage() {
  const ctx = useContext(Ctx);
  const c = ctx.charCard;

  if (!c) {
    return h(React.Fragment, null,
      h('header', { className: 'header' },
        h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
        h('span', { className: 'header-title' }, '🎭 角色卡')
      ),
      h('div', { className: 'empty-state' },
        h('div', { className: 'icon' }, '🎭'),
        h('h3', null, '未导入角色卡'),
        h('p', null, '从侧边栏导入 SillyTavern 格式的角色卡')
      )
    );
  }

  const fields = [
    ['描述', c.description],
    ['性格', c.personality],
    ['系统提示', c.systemPrompt],
    ['首条消息', c.firstMessage],
    ['示例对话', c.exampleDialogue],
    ['作者备注', c.creatorNotes],
  ].filter(([_, v]) => v && v.trim());

  return h(React.Fragment, null,
    h('header', { className: 'header' },
      h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
      h('span', { className: 'header-title' }, '🎭 角色卡')
    ),
    h('div', { className: 'cc-panel' },
      h('div', { className: 'card-header' },
        c.avatar ? 
          h('img', { 
            src: c.avatar, 
            alt: c.name,
            style: { 
              width: 56, 
              height: 56, 
              borderRadius: 14, 
              objectFit: 'cover',
              border: '2px solid var(--accent)'
            },
            onError: (e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }
          }) : null,
        h('div', { 
          className: 'card-avatar',
          style: c.avatar ? { display: 'none' } : {}
        }, c.name?.[0] || '?'),
        h('div', null,
          h('div', { className: 'card-name' }, c.name),
          c.creator ? h('div', { style: { fontSize: 12, color: 'var(--text3)' } }, 'by ' + c.creator) : null,
          c.characterVersion ? h('div', { style: { fontSize: 11, color: 'var(--text3)' } }, 'v' + c.characterVersion) : null
        )
      ),
      fields.length > 0 ? 
        fields.map(([label, value]) =>
          h('div', { key: label, className: 'cc-field' },
            h('label', null, label),
            h('div', { 
              className: 'value',
              style: { whiteSpace: 'pre-wrap' }
            }, value)
          )
        ) :
        h('div', { style: { textAlign: 'center', color: 'var(--text3)', padding: 20 } }, '暂无详细信息'),
      c.tags?.length ? h('div', { className: 'cc-field' },
        h('label', null, '标签'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
          c.tags.map((t, i) => h('span', { key: i, className: 'tag tag-blue' }, t))
        )
      ) : null,
      h('div', { style: { marginTop: 20, display: 'flex', gap: 8 } },
        h('button', {
          className: 'btn btn-danger',
          onClick: async () => {
            if (confirm('确定删除此角色卡？')) {
              await db.deleteCharacter(c.id);
              ctx.setCharCard(null);
              showToast('角色卡已删除', 'success');
            }
          },
        }, '删除角色卡'),
        h('button', {
          className: 'btn btn-ghost',
          onClick: () => {
            // 复制系统提示到剪贴板
            if (c.systemPrompt) {
              navigator.clipboard.writeText(c.systemPrompt);
              showToast('系统提示已复制', 'success');
            }
          },
        }, '复制提示')
      )
    )
  );
}