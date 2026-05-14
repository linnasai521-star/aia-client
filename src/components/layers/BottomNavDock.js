import React from 'react';
import './BottomNavDock.css';

const h = React.createElement;

const DEFAULT_ITEMS = [
  { id: 'chat', icon: '💬', label: '聊天' },
  { id: 'character', icon: '🎭', label: '角色' },
  { id: 'memory', icon: '🧠', label: '记忆' },
  { id: 'settings', icon: '⚙️', label: '设置' },
];

export default function BottomNavDock({ items = DEFAULT_ITEMS, activeId, onNavigate }) {
  return h('div', { className: 'dock' },
    items.map(item =>
      h('button', {
        key: item.id,
        className: 'item' + (activeId === item.id ? ' itemActive' : ''),
        onClick: () => onNavigate && onNavigate(item.id)
      },
        h('span', { className: 'icon' }, item.icon),
        h('span', { className: 'label' }, item.label)
      )
    )
  );
}