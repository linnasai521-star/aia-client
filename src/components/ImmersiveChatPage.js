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
];

const MOODS = [
  { emoji: '😊', text: '开心', desc: '正在看着窗外的雨' },
  { emoji: '🤔', text: '思考中', desc: '安静地想着什么' },
  { emoji: '😌', text: '安静', desc: '静静地翻着书页' },
  { emoji: '😴', text: '困倦', desc: '有点困了，但还在等你' },
];

const SCENES = ['深夜 · 雨天 · 房间', '黄昏 · 海边 · 夕阳', '午后 · 图书馆', '清晨 · 花园'];

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function ImmersiveChatPage() {
  const ctx = useContext(Ctx);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mood] = useState(getRandom(MOODS));
  const [scene] = useState(getRandom(SCENES));
  const [greeting] = useState(getRandom(GREETINGS));
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ctx.msgs, ctx.stream]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  const handleSend = () => {
    if (!inputValue.trim() || ctx.loading) return;
    ctx.sendMsg(inputValue);
    setInputValue('');
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action) => {
    setInputValue(action);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const renderMessage = (msg) => {
    const isUser = msg.role === 'user';
    const time = new Date(msg.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return h('div', { key: msg.id, className: `message ${msg.role}` },
      h('div', { className: 'message-bubble' },
        isUser
          ? h('div', { className: 'message-content' }, msg.content)
          : h('div', { className: 'message-content', dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) } })
      ),
      h('div', { className: 'message-meta' },
        h('span', { className: 'message-time' }, time),
        isUser && h('span', { className: 'message-status' }, '✓✓')
      )
    );
  };

  const renderTypingIndicator = () => {
    if (!ctx.loading && !isTyping) return null;
    return h('div', { className: 'typing-indicator' },
      h('div', { className: 'typing-dots' },
        h('div', { className: 'typing-dot' }),
        h('div', { className: 'typing-dot' }),
        h('div', { className: 'typing-dot' })
      ),
      h('span', null, '正在思考...')
    );
  };

  const renderEmptyState = () => {
    const charName = ctx.charCard ? ctx.charCard.name : '她';
    const charAvatar = ctx.charCard?.avatar;
    const description = mood.desc;

    return h('div', { className: 'empty-chat' },
      h('div', { className: 'character-presence' },
        // 大头像 + 呼吸光效 + 漂浮动画
        h('div', { className: 'char-avatar-large' },
          h('div', { className: 'avatar-inner' },
            charAvatar
              ? h('img', { src: charAvatar, alt: charName })
              : charName[0] || '✨'
          )
        ),
        // 角色名字
        h('div', {
          className: 'char-name-display',
          style: { marginTop: '12px', fontSize: '1.375rem' }
        }, charName === '她' ? '等待中...' : charName),
        // 陪伴感描述文案
        h('div', {
          className: 'char-status-area',
          style: { gap: '8px' }
        },
          h('div', { className: 'char-companion-text' }, greeting),
          h('div', {
            style: {
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em'
            }
          }, `${charName}${description}`),
          h('div', { className: 'char-mood-badge' },
            h('span', null, mood.emoji),
            h('span', null, mood.text)
          ),
          h('div', { className: 'char-scene-line' }, scene)
        ),
        // 轻量快捷按钮
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
    return h('div', { className: 'message assistant' },
      h('div', { className: 'message-bubble' },
        h('div', { className: 'message-content' }, ctx.stream)
      )
    );
  };

  const charName = ctx.charCard ? ctx.charCard.name : '';

  return h('div', { className: 'chat-page' },
    // 极简顶栏
    h('div', { className: 'chat-header' },
      h('div', { className: 'chat-header-left' },
        h('button', { className: 'header-icon', onClick: () => ctx.setSidebar(true) }, '☰')
      ),
      h('div', { className: 'chat-header-center' },
        h('div', { className: 'header-title' },
          charName
            ? h(React.Fragment, null,
                h('span', { className: 'char-name' }, charName),
                h('span', { className: 'status-dot' })
              )
            : h('span', null, '深夜陪伴')
        )
      ),
      h('div', { className: 'chat-header-right' },
        h('button', { className: 'header-icon', onClick: () => ctx.setPage('settings') }, '⚙️'),
        h('button', { className: 'header-icon', onClick: () => ctx.setPage('memory') }, '🧠')
      )
    ),
    // 消息区
    h('div', { className: 'messages-area' },
      ctx.msgs.length === 0 ? renderEmptyState() : ctx.msgs.map(renderMessage),
      renderStreamMessage(),
      renderTypingIndicator(),
      h('div', { ref: messagesEndRef })
    ),
    // 极简输入区
    h('div', { className: 'input-area' },
      h('div', { className: 'input-container' },
        h('div', { className: 'input-wrapper' },
          h('textarea', {
            ref: textareaRef,
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: charName ? `和${charName}说些什么...` : '输入你想对她说的话...',
            rows: 1
          })
        ),
        h('div', { className: 'input-actions' },
          h('button', { className: 'input-btn secondary', onClick: () => ctx.stopStream(), disabled: !ctx.loading },
            h('span', { className: 'icon' }, '⏹️'), '停止'
          ),
          h('button', { className: 'input-btn primary', onClick: handleSend, disabled: !inputValue.trim() || ctx.loading },
            h('span', { className: 'icon' }, '➤'), '发送'
          )
        )
      )
    )
  );
}
