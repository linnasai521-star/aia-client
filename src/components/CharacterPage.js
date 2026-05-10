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
  ].filter(([_, v]) => v);

  return h(React.Fragment, null,
    h('header', { className: 'header' },
      h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
      h('span', { className: 'header-title' }, '🎭 角色卡')
    ),
    h('div', { className: 'cc-panel' },
      h('div', { className: 'card-header' },
        h('div', { className: 'card-avatar' }, c.name?.[0] || '?'),
        h('div', null,
          h('div', { className: 'card-name' }, c.name),
          c.creator ? h('div', { style: { fontSize: 12, color: 'var(--text3)' } }, 'by ' + c.creator) : null
        )
      ),
      ...fields.map(([label, value]) =>
        h('div', { key: label, className: 'cc-field' },
          h('label', null, label),
          h('div', { className: 'value' }, value)
        )
      ),
      c.tags?.length ? h('div', { className: 'cc-field' },
        h('label', null, '标签'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
          c.tags.map((t, i) => h('span', { key: i, className: 'tag tag-blue' }, t))
        )
      ) : null,
      h('div', { style: { marginTop: 20 } },
        h('button', {
          className: 'btn btn-danger',
          onClick: async () => {
            await db.deleteCharacter(c.id);
            ctx.setCharCard(null);
            showToast('角色卡已删除', 'success');
          },
        }, '删除角色卡')
      )
    )
  );
}