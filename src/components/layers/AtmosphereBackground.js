import React from 'react';

const h = React.createElement;

export default function AtmosphereBackground() {
  return h('div', { className: 'atmo-wrapper' },
    // 底层：线性渐变背景（通过 CSS 实现）
    // 中层：5 个缓慢移动的径向渐变光斑
    h('div', { className: 'atmo-orb atmo-orb-1' }),
    h('div', { className: 'atmo-orb atmo-orb-2' }),
    h('div', { className: 'atmo-orb atmo-orb-3' }),
    h('div', { className: 'atmo-orb atmo-orb-4' }),
    h('div', { className: 'atmo-orb atmo-orb-5' }),
    // 顶层：轻量网格纹理
    h('div', { className: 'atmo-grid' })
  );
}