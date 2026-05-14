import React from 'react';

const h = React.createElement;

/**
 * ChatRoom — 聊天页面统一布局容器（重构目标）
 * 目前为占位壳，后续将组合 AtmosphereBackground + CharacterHero +
 * FloatingContent + MessageLayer + InputDock + BottomNavDock
 */
export default function ChatRoom() {
  return h('div', { className: 'chat-room-shell', style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' } },
      h('div', { style: { padding: 16, textAlign: 'center', color: '#b0a4c8' } }, 'ChatRoom — 新布局壳')
    )
  );
}