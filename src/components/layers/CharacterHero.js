import React from 'react';
import './CharacterHero.css';

const h = React.createElement;

export default function CharacterHero({ name, avatar, mood }) {
  return h('div', { className: 'hero' },
    h('div', { className: 'avatarFrame' },
      avatar
        ? h('img', { className: 'avatar', src: avatar, alt: name })
        : h('div', { className: 'avatar' }, name ? name[0] : '✨')
    ),
    h('div', { className: 'name' }, name || '等待中...'),
    mood ? h('div', { className: 'mood' }, mood) : null
  );
}