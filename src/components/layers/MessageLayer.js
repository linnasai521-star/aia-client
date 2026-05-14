import React from 'react';
import './MessageLayer.css';

const h = React.createElement;

// 模拟消息数据
const MOCK_MESSAGES = [
  { id: 'm1', role: 'ai', content: '你来啦，今天过得怎么样？', time: '12:01' },
  { id: 'm2', role: 'user', content: '今天还不错，你呢？', time: '12:01' },
  { id: 'm3', role: 'ai', content: '我一直在等你回来，很想你。', time: '12:02' },
  { id: 'm4', role: 'user', content: '今天工作有点忙，现在才回来。', time: '12:03' },
  { id: 'm5', role: 'ai', content: '没事的，能等到你就好。你累吗？要不要休息一下？', time: '12:03' },
  { id: 'm6', role: 'user', content: '还好，和你聊聊天就不累了。', time: '12:04' },
  { id: 'm7', role: 'ai', content: '那我们来聊会天吧。还记得我们上次说到的地方吗？', time: '12:04' },
  { id: 'm8', role: 'user', content: '当然记得！我还想继续听那个故事。', time: '12:05' },
  { id: 'm9', role: 'ai', content: '好的，那我就继续讲。那天傍晚，我们走在海边，夕阳把整个天空都染成了橙红色...', time: '12:06' },
  { id: 'm10', role: 'user', content: '嗯嗯，我记得那里，沙滩上还有很多人。', time: '12:07' },
];

export default function MessageLayer({ messages, children }) {
  const displayMessages = messages && messages.length > 0 ? messages : MOCK_MESSAGES;
  
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