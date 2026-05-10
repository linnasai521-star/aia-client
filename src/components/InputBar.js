import React, { useRef, useEffect, useContext } from 'react';
import { Ctx } from '../state.js';

const h = React.createElement;

export function InputBar() {
  const ctx = useContext(Ctx);
  const [input, setInput] = React.useState('');
  const txtRef = useRef(null);

  useEffect(() => {
    if (txtRef.current) {
      txtRef.current.style.height = 'auto';
      txtRef.current.style.height = Math.min(txtRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim()) { ctx.sendMsg(input); setInput(''); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return h('div', { className: 'input-area' },
    h('div', { className: 'input-inner' },
      h('div', { className: 'input-row' },
        h('textarea', {
          ref: txtRef, value: input,
          onChange: e => setInput(e.target.value),
          onKeyDown: handleKey,
          placeholder: '输入消息... (Enter 发送)', rows: 1,
        }),
        ctx.loading
          ? h('button', { className: 'send-btn stop', onClick: ctx.stopStream }, '⏹')
          : h('button', { className: 'send-btn', onClick: handleSend, disabled: !input.trim() }, '➤')
      ),
      h('div', { className: 'input-hint' }, 'AI Aggregator · OpenAI 兼容 API')
    )
  );
}