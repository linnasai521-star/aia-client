import React, { useContext, useState, useRef, useEffect } from 'react';
import { Ctx } from '../state.js';
import { renderMarkdown } from '../utils/markdown.js';
const h = React.createElement;

const GREETINGS = [
  '今天怎么这么晚才来？',
  '我刚刚还在想你会不会来。',
  '你来啦，我等你好久了。',
  '终于等到你了。',
  '今天也来陪我聊天吗？',
  '我一直在等你回来。',
  '这么晚还不睡，在等我吗？',
];
const MOODS = [
  { emoji: '😊', text: '开心', desc: '正在看着窗外的雨' },
  { emoji: '🤔', text: '思考中', desc: '安静地想着什么' },
  { emoji: '😌', text: '安静', desc: '静静地翻着书页' },
  { emoji: '😴', text: '困倦', desc: '有点困了，但还在等你' },
  { emoji: '🥰', text: '期待', desc: '一直在等你回来' },
];
const SCENES = ['深夜 · 雨天 · 房间', '黄昏 · 海边 · 夕阳', '午后 · 图书馆', '清晨 · 花园', '夜晚 · 城市 · 高楼'];
const ENVIRONMENTS = ['窗外正在下雨。', '风吹动窗帘。', '时钟滴答作响。', '炉火轻轻噼啪响。', '远处传来城市的低鸣。'];
const getRandom = a => a[Math.floor(Math.random() * a.length)];

const now = () => { const d = new Date(); return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0'); };

export function ImmersiveChatPage() {
  const ctx = useContext(Ctx);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mood] = useState(getRandom(MOODS));
  const [scene] = useState(getRandom(SCENES));
  const [env] = useState(getRandom(ENVIRONMENTS));
  const [greeting] = useState(getRandom(GREETINGS));
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [ctx.msgs, ctx.stream]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; } }, [inputValue]);

  const handleSend = () => {
    if (!inputValue.trim() || ctx.loading) return;
    ctx.sendMsg(inputValue); setInputValue('');
    setIsTyping(true); setTimeout(() => setIsTyping(false), 2000);
  };
  const handleKeyDown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleQuickAction = a => { setInputValue(a); if (textareaRef.current) textareaRef.current.focus(); };

  const renderMessage = msg => {
    const iu = msg.role === 'user';
    const t = new Date(msg.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const cn = ctx.charCard?.name || 'AI';
    const ca = ctx.charCard?.avatar;
    
    if (iu) {
      return h('div', { key: msg.id, className: 'message user' },
        h('div', { className: 'message-bubble' },
          h('div', { className: 'message-content' }, msg.content)
        ),
        h('div', { className: 'message-meta' }, h('span', { className: 'message-time' }, t), h('span', { className: 'message-status' }, '✓✓'))
      );
    }
    
    const isReplying = ctx.loading && msg === ctx.msgs[ctx.msgs.length-1];
    return h('div', { key: msg.id, className: 'message assistant' },
      h('div', { className: 'ai-avatar-wrap' },
        h('div', { className: 'char-avatar-small' + (isReplying ? ' replying' : ''), style: { flexShrink: 0 } },
          ca ? h('img', { src: ca, alt: cn }) : h('span', null, cn[0] || 'AI'),
          h('span', { className: 'status-dot-sm' })
        ),
        h('div', { className: 'message-bubble' },
          h('div', { className: 'message-content', dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) } })
        )
      ),
      h('div', { className: 'message-meta' }, h('span', { className: 'message-time' }, t))
    );
  };

  const renderTypingIndicator = () => {
    if (!ctx.loading && !isTyping) return null;
    return h('div', { className: 'typing-indicator' },
      h('div', { className: 'typing-dots' }, h('div', { className: 'typing-dot' }), h('div', { className: 'typing-dot' }), h('div', { className: 'typing-dot' })),
      h('span', null, '正在思考...')
    );
  };

  const renderEmptyState = () => {
    const cn = ctx.charCard ? ctx.charCard.name : '她';
    const ca = ctx.charCard?.avatar;
    return h('div', { className: 'empty-chat' },
      h('div', { className: 'character-presence' },
        h('div', { className: 'char-time-indicator' }, now()),
        h('div', { className: 'char-avatar-large' },
          h('div', { className: 'avatar-inner' }, ca ? h('img', { src: ca, alt: cn }) : (cn[0] || '✨'))
        ),
        h('div', { className: 'char-name-display', style: { marginTop: '12px', fontSize: '1.5rem' } }, cn === '她' ? '等待中...' : cn),
        h('div', { className: 'char-status-area', style: { gap: '6px' } },
          h('div', { className: 'char-companion-text' }, greeting),
          h('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.06em' } }, `${cn}${mood.desc}`),
          h('div', { className: 'char-mood-badge' }, h('span', null, mood.emoji), h('span', null, mood.text)),
          h('div', { className: 'char-scene-line' }, scene),
          h('div', { className: 'char-environment' }, env)
        ),
        h('div', { className: 'quick-actions' },
          h('button', { className: 'quick-action-btn', onClick: () => handleQuickAction('你好') }, '👋 打招呼'),
          h('button', { className: 'quick-action-btn', onClick: () => handleQuickAction('今天过得怎么样？') }, '🌤️ 问候'),
          h('button', { className: 'quick-action-btn', onClick: () => handleQuickAction('给我讲个故事') }, '📖 听故事')
        )
      )
    );
  };

  const renderStreamMessage = () => {
    if (!ctx.stream) return null;
    return h('div', { className: 'message assistant' }, h('div', { className: 'message-bubble' }, h('div', { className: 'message-content' }, ctx.stream)));
  };

  const cn = ctx.charCard ? ctx.charCard.name : '';
  return h('div', { className: 'chat-page' },
    h('div', { className: 'chat-header' },
      h('div', { className: 'chat-header-left' }, h('button', { className: 'header-icon', onClick: () => ctx.setSidebar(true) }, '☰')),
      h('div', { className: 'chat-header-center' },
        h('div', { className: 'header-title' },
          cn ? h(React.Fragment, null, h('span', { className: 'char-name' }, cn), h('span', { className: 'status-dot' }))
            : h('span', null, '深夜陪伴')
        )
      ),
      h('div', { className: 'chat-header-right' },
        h('button', { className: 'header-icon', onClick: () => ctx.setPage('settings') }, '⚙️'),
        h('button', { className: 'header-icon', onClick: () => ctx.setPage('memory') }, '🧠')
      )
    ),
    h('div', { className: 'messages-area' },
      ctx.msgs.length === 0 ? renderEmptyState() : ctx.msgs.map(renderMessage),
      renderStreamMessage(), renderTypingIndicator(), h('div', { ref: messagesEndRef })
    ),
    h('div', { className: 'input-area' },
      h('div', { className: 'input-container' },
        h('div', { className: 'input-wrapper' },
          h('textarea', {
            ref: textareaRef, value: inputValue,
            onChange: e => setInputValue(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: cn ? `和${cn}说些什么...` : '输入你想对她说的话...',
            rows: 1
          })
        ),
        h('div', { className: 'input-actions', style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('button', { className: 'stop-btn', onClick: () => ctx.stopStream(), disabled: !ctx.loading },
            h('span', { style: { fontSize: '0.75rem' } }, '⏹')
          ),
          h('button', { className: 'send-btn', onClick: handleSend, disabled: !inputValue.trim() || ctx.loading },
            h('span', null, '➤')
          )
        )
      )
    )
  );
}
