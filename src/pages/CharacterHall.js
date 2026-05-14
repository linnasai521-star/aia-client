import React from 'react';

const h = React.createElement;

/**
 * CharacterHall — 角色大厅页面（重构目标）
 * 目前为占位壳，后续将替换 src/components/CharacterHall.js
 */
export default function CharacterHall() {
  return h('div', { className: 'character-hall-shell', style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    h('div', { className: 'hall-placeholder', style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b0a4c8' } },
      'CharacterHall — 新布局壳'
    )
  );
}