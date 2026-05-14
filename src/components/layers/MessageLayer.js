import React from 'react';

const h = React.createElement;

export default function MessageLayer({ messages, children }) {
  const displayMessages = messages && messages.length > 0 ? messages : [];
  
  return h('div', { className: 'scrollContainer' },
    displayMessages.map((msg, i) => {
      const isUser = msg.role === 'user';
      return h('div', {
        key: msg.id || i,
        className: 'messageRow' + (isUser ? ' messageRowUser' : '')
      },
        h('div', {
          className: 'bubble' + (isUser ? ' bubbleUser' : ' bubbleAI')
        },
          msg.content,
          h('span', { className: 'time' }, msg.time || '')
        )
      );
    }),
    children
  );
}