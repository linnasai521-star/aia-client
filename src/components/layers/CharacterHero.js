import React from 'react';
import './CharacterHero.css';

const h = React.createElement;

export default function CharacterHero({ name, avatar, mood, moodEmoji, affection, online }) {
  const characterName = name || '她';
  const characterAffection = typeof affection === 'number' ? affection : 78;
  const isOnline = online !== false;

  return h('div', { className: 'hero' },
    h('div', { className: 'online-bar' },
      h('div', { className: 'online-dot' }),
      h('span', null, isOnline ? '在线' : '离线')
    ),
    h('div', { className: 'avatar-container' },
      h('div', { className: 'avatar-wrapper' },
        avatar
          ? h('img', { className: 'avatar', src: avatar, alt: characterName, onError: (e) => { e.target.style.display = 'none'; } })
          : h('div', { className: 'avatar-placeholder' }, h('span', null, characterName[0] || '✨'))
      )
    ),
    h('div', { className: 'glass-bar' },
      h('div', { className: 'glass-avatar' },
        avatar
          ? h('img', { src: avatar, alt: characterName })
          : h('div', { className: 'glass-avatar-placeholder' }, characterName[0] || '✨')
      ),
      h('div', { className: 'glass-info' },
        h('div', { className: 'character-name' }, characterName),
        h('div', { className: 'affection-bar' },
          h('div', { className: 'affection-fill', style: { width: characterAffection + '%' } })
        ),
        h('div', { className: 'affection-text' }, '好感度 ' + characterAffection + '%')
      )
    ),
    h('div', { className: 'mood-text' },
      h('span', { className: 'mood-emoji' }, moodEmoji || '🥰'),
      h('span', null, mood || '等待中')
    )
  );
}