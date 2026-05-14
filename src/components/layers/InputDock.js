import React from 'react';

const h = React.createElement;

export default function InputDock({ value, onChange, onSend, placeholder, loading }) {
  const textareaRef = React.useRef(null);

  return h('div', { className: 'dock' },
    h('div', { className: 'wrapper' },
      h('textarea', {
        ref: textareaRef,
        className: 'textarea',
        value,
        onChange: e => onChange && onChange(e.target.value),
        onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend && onSend(); } },
        placeholder: placeholder || '输入消息...',
        rows: 1
      }),
      h('button', {
        className: 'sendBtn',
        onClick: onSend,
        disabled: !value || !value.trim() || loading
      }, '↑')
    )
  );
}