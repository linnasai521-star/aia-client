import React, { useContext, useState, useRef, useEffect } from 'react';
import { Ctx } from '../state.js';
import { renderMarkdown } from '../utils/markdown.js';
const h = React.createElement;
const GREETINGS = [
  '今天怎么这么晚才来？', '我刚刚还在想你会不会来。', '你来啦，我等你好久了。',
  '终于等到你了。', '今天也来陪我聊天吗？', '我一直在等你回来。', '这么晚还不睡，在等我吗？',
];
const MOODS = [
  { emoji: '😊', text: '开心', desc: '正在看着窗外的雨' }, { emoji: '🤔', text: '思考中', desc: '安静地想着什么' },
  { emoji: '😌', text: '安静', desc: '静静地翻着书页' }, { emoji: '😴', text: '困倦', desc: '有点困了，但还在等你' },
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

  const cn = ctx.charCard ? ctx.charCard.name : '她';
  const ca = ctx.charCard?.avatar;
  
  // Determine if we have a character with personality
  const hasCharacter = !!ctx.charCard;
  const personality = ctx.charCard?.personality || '';
  const scenario = ctx.charCard?.scenario || '';

  const renderMessage = msg => {
    const iu = msg.role === 'user';
    const t = new Date(msg.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    if (iu) {
      return h('div', { key: msg.id, className: 'msg-user' },
        h('div', { className: 'msg-user-bubble' }, msg.content),
        h('span', { className: 'msg-time' }, t)
      );
    }
    
    const isReplying = ctx.loading && msg === ctx.msgs[ctx.msgs.length-1];
    return h('div', { key: msg.id, className: 'msg-ai' },
      h('div', { className: 'msg-ai-avatar' },
        ca ? h('img', { src: ca, alt: cn, style: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' } }) : h('span', null, cn[0] || 'AI'),
        isReplying ? h('span', { className: 'status-dot-sm' }) : null
      ),
      h('div', null,
        h('div', { className: 'msg-ai-bubble', dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) } }),
        h('span', { className: 'msg-time' }, t)
      )
    );
  };

  const renderTypingIndicator = () => {
    if (!ctx.loading && !isTyping) return null;
    return h('div', { className: 'typing-indicator' },
      h('div', { className: 'typing-dot' }), h('div', { className: 'typing-dot' }), h('div', { className: 'typing-dot' })
    );
  };

  const renderEmptyState = () => {
    return h('div', { className: 'empty-chat' },
      h('div', { className: 'character-presence' },
        h('div', { className: 'char-time-indicator' }, now()),
        h('div', { className: 'char-avatar-large', style: { border: 'none', boxShadow: 'none' } },
          ca ? h('img', { src: ca, alt: cn, style: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' } }) : h('span', { style: { fontSize: '2rem' } }, cn[0] || '✨')
        ),
        h('div', { className: 'char-name-display', style: { marginTop: '12px', fontSize: '1.5rem' } },
          hasCharacter ? cn : '等待中...'
        ),
        h('div', { className: 'char-status-area', style: { gap: '6px' } },
          hasCharacter ? 
            h(React.Fragment, null,
              personality ? h('div', { style: { fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' } }, personality) : null,
              scenario ? h('div', { className: 'char-scene-line' }, scenario) : null,
              h('div', { className: 'char-mood-badge' }, h('span', null, mood.emoji), h('span', null, mood.text)),
              h('div', { className: 'char-environment' }, env)
            ) :
            h(React.Fragment, null,
              h('div', { className: 'char-companion-text' }, greeting),
              h('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.06em' } }, `${cn}${mood.desc}`),
              h('div', { className: 'char-mood-badge' }, h('span', null, mood.emoji), h('span', null, mood.text)),
              h('div', { className: 'char-scene-line' }, scene),
              h('div', { className: 'char-environment' }, env)
            )
        ),


      )
    );
  };

  const renderStreamMessage = () => {
    if (!ctx.stream) return null;
    return h('div', { className: 'msg-ai' }, h('div', { className: 'msg-ai-bubble' }, ctx.stream));
  };

  return h('div', { className: 'chat-page' },
    // 顶部：角色信息条
    h('div', { className: 'chat-header' },
      h('button', { className: 'chat-back-btn', onClick: () => ctx.setSidebar(!ctx.sidebar) }, '☰'),
      ca ? h('img', { className: 'chat-avatar-sm', src: ca, alt: cn }) : null,
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('span', { className: 'chat-char-name' }, hasCharacter ? cn : '深夜陪伴'),
        h('div', { className: 'chat-header-meta' },
          h('span', { className: 'chat-online-dot' }),
          h('span', { style: { fontSize: '12px', color: '#8b6bae' } }, '在线'),
          h('span', { className: 'chat-mood' }, mood.emoji + ' ' + mood.text)
        )
      ),
      h('button', { className: 'chat-back-btn', onClick: () => ctx.setPage('character'), style: { marginLeft: 'auto' } }, '🎭'),
      h('button', { className: 'chat-back-btn', onClick: () => ctx.setPage('settings') }, '⚙️')
    ),
    // 中间：消息区域（唯一可滚动）
    h('div', { className: 'chat-messages-scroll' },
      ctx.msgs.length === 0 ? renderEmptyState() : ctx.msgs.map(renderMessage),
      renderStreamMessage(), renderTypingIndicator(), h('div', { ref: messagesEndRef })
    ),
    // 底部：输入框（flex流中，不fixed）
    h('div', { className: 'chat-input-bar' },
      h('div', { className: 'chat-input-wrapper' },
        h('textarea', {
          ref: textareaRef, value: inputValue,
          onChange: e => setInputValue(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder: hasCharacter ? `和${cn}说些什么...` : '输入消息...',
          rows: 1
        }),
        h('button', { className: 'chat-send-btn', onClick: handleSend, disabled: !inputValue.trim() || ctx.loading }, '↑'),
        ctx.loading ? h('button', { className: 'chat-stop-btn', onClick: () => ctx.stopStream() }, '⏹') : null
      )
    )
  );
}
