// 沉浸式聊天页面组件 v2.0 - 陪伴感增强
import React, { useContext, useState, useRef, useEffect } from 'react';
import { Ctx } from '../state.js';
import { renderMarkdown } from '../utils/markdown.js';

const h = React.createElement;

export function ImmersiveChatPage() {
  const ctx = useContext(Ctx);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ctx.msgs, ctx.stream]);

  // 自动调整textarea高度
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
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const renderMessage = (msg) => {
    const isUser = msg.role === 'user';
    const time = new Date(msg.ts).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return h('div', { 
      key: msg.id, 
      className: `message ${msg.role}` 
    },
      h('div', { className: 'message-bubble' },
        isUser
          ? h('div', { className: 'message-content' }, msg.content)
          : h('div', {
              className: 'message-content',
              dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) }
            })
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
    const charName = ctx.charCard ? ctx.charCard.name : '';
    const charAvatar = ctx.charCard?.avatar;
    const greetings = [
      '今天也来陪我聊天吗？',
      '我一直在等你...',
      '终于等到你了。',
      '你来啦，我很开心。',
      '准备好了吗？开始吧。'
    ];
    const moods = [
      { emoji: '😊', text: '开心' },
      { emoji: '🤔', text: '思考中' },
      { emoji: '😌', text: '安静' },
      { emoji: '😴', text: '有点困' }
    ];
    const scenes = [
      '深夜 · 卧室',
      '雨天 · 咖啡馆',
      '黄昏 · 海边',
      '午后 · 图书馆'
    ];
    
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    const randomScene = scenes[Math.floor(Math.random() * scenes.length)];

    return h('div', { className: 'empty-chat' },
      // 大头像 + 呼吸光效
      h('div', { className: 'avatar-glow' },
        h('div', { className: 'big-avatar' },
          charAvatar 
            ? h('img', { src: charAvatar, alt: charName })
            : charName ? charName[0] : '✨'
        )
      ),
      // 角色名
      charName && h('div', { 
        style: { 
          fontSize: '1.25rem', 
          color: 'var(--text-primary)',
          fontWeight: '500',
          marginTop: '8px',
          animation: 'fade-slide-up 0.8s ease-out 0.1s both'
        }
      }, charName),
      // 陪伴感文案
      h('div', { className: 'char-greeting' }, randomGreeting),
      // 当前情绪
      h('div', { className: 'char-mood' },
        h('span', null, randomMood.emoji),
        h('span', null, randomMood.text)
      ),
      // 当前场景
      h('div', { className: 'char-scene' }, randomScene),
      // 快速开始按钮
      h('div', { className: 'quick-actions' },
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('你好')
        }, '👋 打招呼'),
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('今天过得怎么样？')
        }, '🌤️ 问候'),
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('给我讲个故事')
        }, '📖 听故事')
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

  return h('div', { className: 'chat-page' },
    // 聊天头部 - 弱化为角色信息条
    h('div', { className: 'chat-header' },
      h('div', { className: 'chat-header-left' },
        h('button', { 
          className: 'header-icon',
          onClick: () => ctx.setSidebar(true)
        }, '☰')
      ),
      h('div', { className: 'chat-header-center' },
        h('div', { className: 'header-title' }, 
          ctx.charCard 
            ? h(React.Fragment, null,
                h('span', { className: 'char-name' }, ctx.charCard.name),
                h('span', { className: 'status-dot' })
              )
            : 'AI Aggregator'
        ),
        h('div', { className: 'header-subtitle' }, 
          ctx.charCard 
            ? (ctx.charCard.description?.slice(0, 40) + '...')
            : '选择一个角色开始对话'
        )
      ),
      h('div', { className: 'chat-header-right' },
        h('button', { 
          className: 'header-icon',
          onClick: () => ctx.setPage('settings')
        }, '⚙️'),
        h('button', { 
          className: 'header-icon',
          onClick: () => ctx.setPage('memory')
        }, '🧠')
      )
    ),
    
    // 消息区域
    h('div', { className: 'messages-area' },
      ctx.msgs.length === 0 ? renderEmptyState() : 
        ctx.msgs.map(renderMessage),
      renderStreamMessage(),
      renderTypingIndicator(),
      h('div', { ref: messagesEndRef })
    ),
    
    // 输入区域 - 极简浮空
    h('div', { className: 'input-area' },
      h('div', { className: 'input-container' },
        h('div', { className: 'input-wrapper' },
          h('textarea', {
            ref: textareaRef,
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: ctx.charCard 
              ? `和${ctx.charCard.name}说些什么...`
              : '输入你想说的话...',
            rows: 1
          })
        ),
        h('div', { className: 'input-actions' },
          h('button', { 
            className: 'input-btn secondary',
            onClick: () => ctx.stopStream(),
            disabled: !ctx.loading
          }, 
            h('span', { className: 'icon' }, '⏹️'),
            '停止'
          ),
          h('button', { 
            className: 'input-btn primary',
            onClick: handleSend,
            disabled: !inputValue.trim() || ctx.loading
          }, 
            h('span', { className: 'icon' }, '➤'),
            '发送'
          )
        )
      )
    )
  );
}
