import React from 'react';
import AtmosphereBackground from '../components/layers/AtmosphereBackground';
import BottomNavDock from '../components/layers/BottomNavDock';

const h = React.createElement;

export default function CharacterHall({ characters = [], onSelectCharacter, onNavigate }) {
  return h('div', { className: 'nh-shell' },
    h(AtmosphereBackground),
    h('div', { className: 'nh-scroll' },
      h('h2', { className: 'nh-title' }, '🎭 角色'),
      characters.length === 0
        ? h('div', { style: { textAlign: 'center', padding: '40px 20px', color: '#b0a4c8' } },
            h('div', { style: { fontSize: '40px', marginBottom: '12px' } }, '📭'),
            h('div', { style: { fontSize: '14px' } }, '还没有角色，去导入一个吧')
          )
        : h('div', { className: 'nh-grid' },
            characters.map(function(c) {
              var name = c.name || '未知';
              var affection = typeof c.affection === 'number' ? c.affection : 50;
              return h('div', {
                key: c.id,
                className: 'char-card',
                onClick: function() { onSelectCharacter && onSelectCharacter(c); }
              },
                h('div', { className: 'char-card-avatar' },
                  name[0],
                  h('div', { className: 'char-card-halo', style: { opacity: 0.3 + affection / 300 } }),
                ),
                h('div', { className: 'char-card-name' }, name),
                h('div', { className: 'char-card-desc' }, c.description || c.personality || ''),
                h('div', { className: 'char-card-bar' },
                  h('div', { className: 'char-card-fill', style: { width: affection + '%' } }),
                ),
                h('div', { className: 'char-card-time' }, '好感度 ' + affection + '%'),
              );
            })
          ),
    ),
    h(BottomNavDock, { activeId: 'character', onNavigate: onNavigate }),
  );
}