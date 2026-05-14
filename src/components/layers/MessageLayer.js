import React from 'react';
import './MessageLayer.css';

const h = React.createElement;

export default function MessageLayer({ messages = [], children }) {
  return h('div', { className: 'scrollContainer' },
    messages.map((msg, i) => {
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