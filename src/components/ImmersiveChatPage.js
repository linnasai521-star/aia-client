// 沉浸式聊天页面组件
import React, { useContext, useState, useRef, useEffect } from 'react';
import { Ctx } from '../state.js';
import { timeAgo, showToast } from '../utils/helpers.js';

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
    
    // 模拟打字状态
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
        h('div', { className: 'message-content' }, msg.content)
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
      h('span', null, '正在思考中...')
    );
  };

  const renderEmptyState = () => {
    return h('div', { className: 'empty-chat' },
      h('div', { className: 'icon' }, '💬'),
      h('h3', null, '开始对话'),
      h('p', null, '输入消息与角色开始沉浸式对话，体验真实的角色扮演互动'),
      h('div', { className: 'quick-actions' },
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('你好，很高兴认识你！')
        }, '👋 打招呼'),
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('今天过得怎么样？')
        }, '🌤️ 问候'),
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('能给我讲个故事吗？')
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
    // 聊天头部
    h('div', { className: 'chat-header' },
      h('div', { className: 'chat-header-left' },
        h('button', { 
          className: 'header-icon',
          onClick: () => ctx.setSidebar(true)
        }, '☰')
      ),
      h('div', { className: 'chat-header-center' },
        h('div', { className: 'header-title' }, 
          ctx.charCard ? ctx.charCard.name : 'AI Aggregator'
        ),
        ctx.charCard && h('div', { className: 'header-subtitle' }, 
          ctx.charCard.description?.slice(0, 50) + '...'
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
    
    // 输入区域
    h('div', { className: 'input-area' },
      h('div', { className: 'input-container' },
        h('div', { className: 'input-wrapper' },
          h('textarea', {
            ref: textareaRef,
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: '输入消息... (Enter发送，Shift+Enter换行)',
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
      ),
      h('div', { className: 'quick-actions' },
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('Continue')
        }, '➡️ 继续'),
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('/remember')
        }, '💾 记忆'),
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('/summary')
        }, '📋 总结'),
        h('button', { 
          className: 'quick-action-btn',
          onClick: () => handleQuickAction('/reset')
        }, '🔄 重置')
      )
    )
  );
}