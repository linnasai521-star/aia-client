import React, { useState } from 'react';
import { renderMarkdown } from '../utils/markdown.js';

const h = React.createElement;

export function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return h('div', { className: `msg ${msg.role}` },
    h('div', { className: 'avatar' }, isUser ? 'U' : 'AI'),
    h('div', { className: 'bubble' },
      isUser
        ? h('div', null, msg.content.split('\n').map((line, i) =>
            h(React.Fragment, { key: i }, i ? h('br') : null, line)))
        : h('div', {
            className: 'md-content',
            dangerouslySetInnerHTML: { __html: renderMarkdown(msg.content) }
          }),
      h('div', { className: 'msg-toolbar' },
        h('button', { onClick: handleCopy }, copied ? '✓' : '📋')
      )
    )
  );
}