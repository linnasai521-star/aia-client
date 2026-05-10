import React, { useContext, useEffect, useRef } from 'react';
import { Ctx } from '../state.js';
import { MessageBubble } from './MessageBubble.js';
import { InputBar } from './InputBar.js';
import { renderMarkdown } from '../utils/markdown.js';

const h = React.createElement;

export function ChatPage() {
  const ctx = useContext(Ctx);
  const msgEnd = useRef(null);

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ctx.msgs, ctx.stream]);

  if (!ctx.curId) {
    return h(React.Fragment, null,
      h('header', { className: 'header' },
        h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
        h('span', { className: 'header-title' }, 'AI Aggregator')
      ),
      h('div', { className: 'empty-state' },
        h('div', { className: 'icon' }, '⚡'),
        h('h3', null, 'AI Aggregator'),
        h('p', null, '点击「新建对话」开始'),
        h('div', { className: 'features' },
          ['流式输出 & 实时渲染', '角色卡 & 世界书', 'API Key 加密', 'IndexedDB 存储'].map(f =>
            h('div', { key: f, className: 'feature' }, h('span', { className: 'dot' }), f)
          )
        )
      )
    );
  }

  const convTitle = ctx.convs.find(c => c.id === ctx.curId)?.title || '对话';

  return h(React.Fragment, null,
    h('header', { className: 'header' },
      h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
      h('span', { className: 'header-title' }, convTitle)
    ),
    h('div', { className: 'chat-area' },
      h('div', { className: 'chat-inner' },
        ctx.msgs.length === 0 && !ctx.stream
          ? h('div', { className: 'empty-state', style: { minHeight: 300 } },
              h('div', { className: 'icon' }, '💬'),
              h('p', null, '输入你的第一条消息')
            )
          : ctx.msgs.map(m => h(MessageBubble, { key: m.id, msg: m })),
        ctx.loading && ctx.stream
          ? h('div', { className: 'msg assistant' },
              h('div', { className: 'avatar' }, 'AI'),
              h('div', { className: 'bubble' },
                h('div', { className: 'md-content', dangerouslySetInnerHTML: { __html: renderMarkdown(ctx.stream) } }),
                h('span', { className: 'cursor-blink' })
              )
            )
          : null,
        ctx.loading && !ctx.stream
          ? h('div', { className: 'msg assistant' },
              h('div', { className: 'avatar' }, 'AI'),
              h('div', { className: 'bubble' },
                h('div', { className: 'loading-dots' }, h('span'), h('span'), h('span'))
              )
            )
          : null,
        h('div', { ref: msgEnd })
      )
    ),
    h(InputBar)
  );
}