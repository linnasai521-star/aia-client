import React from 'react';
import './CharacterHero.css';

const h = React.createElement;

// 模拟数据
const MOCK_DATA = {
  name: '她',
  avatar: '',
  online: true,
  mood: '等待中',
  moodEmoji: '🥰',
  affection: 78
};

export default function CharacterHero({ name, avatar, mood }) {
  // 使用传入的props或模拟数据
  const characterName = name || MOCK_DATA.name;
  const characterAvatar = avatar || MOCK_DATA.avatar;
  const characterMood = mood || MOCK_DATA.mood;
  const isOnline = true; // 模拟在线状态
  
  return h('div', { className: 'hero' },
    // 在线状态指示条
    h('div', { className: 'online-bar' },
      h('div', { className: 'online-dot' }),
      h('span', null, isOnline ? '在线' : '离线')
    ),
    
    // 角色半身图（占主要空间）
    h('div', { className: 'avatar-container' },
      h('div', { className: 'avatar-wrapper' },
        characterAvatar
          ? h('img', { 
              className: 'avatar', 
              src: characterAvatar, 
              alt: characterName,
              onError: (e) => { e.target.style.display = 'none'; }
            })
          : h('div', { className: 'avatar-placeholder' }, 
              h('span', null, characterName ? characterName[0] : '✨')
            )
      )
    ),
    
    // 毛玻璃横条
    h('div', { className: 'glass-bar' },
      h('div', { className: 'glass-avatar' },
        characterAvatar
          ? h('img', { src: characterAvatar, alt: characterName })
          : h('div', { className: 'glass-avatar-placeholder' }, 
              characterName ? characterName[0] : '✨'
            )
      ),
      h('div', { className: 'glass-info' },
        h('div', { className: 'character-name' }, characterName),
        h('div', { className: 'affection-bar' },
          h('div', { 
            className: 'affection-fill',
            style: { width: `${MOCK_DATA.affection}%` }
          })
        ),
        h('div', { className: 'affection-text' }, `好感度 ${MOCK_DATA.affection}%`)
      )
    ),
    
    // 心情/标签文本
    h('div', { className: 'mood-text' },
      h('span', { className: 'mood-emoji' }, MOCK_DATA.moodEmoji),
      h('span', null, characterMood)
    )
  );
}