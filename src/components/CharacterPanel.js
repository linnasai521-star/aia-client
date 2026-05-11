// 沉浸式角色状态面板组件
import React, { useContext, useState, useEffect } from 'react';
import { Ctx } from '../state.js';

const h = React.createElement;

export function CharacterPanel() {
  const ctx = useContext(Ctx);
  const [isOpen, setIsOpen] = useState(true);
  const [mood, setMood] = useState('thoughtful');
  const [affection, setAffection] = useState(72);
  const [scene, setScene] = useState('深夜 · 雨天咖啡馆');
  const [worldState, setWorldState] = useState(['现代都市', '夜晚', '雨天', '咖啡馆']);
  const [authorNote, setAuthorNote] = useState('角色正在思考接下来的对话，保持神秘感和深度。');

  // 模拟情绪变化
  useEffect(() => {
    const moods = ['happy', 'sad', 'angry', 'thoughtful', 'dependent'];
    const interval = setInterval(() => {
      const randomMood = moods[Math.floor(Math.random() * moods.length)];
      setMood(randomMood);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // 模拟好感度变化
  useEffect(() => {
    const interval = setInterval(() => {
      setAffection(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        return Math.max(0, Math.min(100, prev + change));
      });
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const getMoodEmoji = (mood) => {
    const emojis = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      thoughtful: '🤔',
      dependent: '🥰'
    };
    return emojis[mood] || '🤔';
  };

  const getMoodText = (mood) => {
    const texts = {
      happy: '开心',
      sad: '低落',
      angry: '生气',
      thoughtful: '思考中',
      dependent: '依赖'
    };
    return texts[mood] || '思考中';
  };

  const getAffectionClass = (value) => {
    if (value >= 90) return 'max';
    if (value >= 70) return 'high';
    if (value >= 40) return 'medium';
    return 'low';
  };

  const renderAvatar = () => {
    if (ctx.charCard?.avatar) {
      return h('img', {
        src: ctx.charCard.avatar,
        alt: ctx.charCard.name,
        className: 'character-avatar'
      });
    }
    
    return h('div', { className: 'character-avatar' },
      ctx.charCard ? ctx.charCard.name?.[0] || '?' : '?'
    );
  };

  const renderMoodIndicator = () => {
    return h('div', { className: 'mood-indicator ' + mood },
      getMoodEmoji(mood)
    );
  };

  const renderAffectionBar = () => {
    const fillClass = getAffectionClass(affection);
    return h('div', { className: 'affection-bar' },
      h('div', { 
        className: 'affection-fill ' + fillClass,
        style: { width: affection + '%' }
      })
    );
  };

  const renderWorldTags = () => {
    return h('div', { className: 'world-tags' },
      worldState.map((tag, i) => 
        h('span', { key: i, className: 'world-tag' }, tag)
      )
    );
  };

  return h('div', { className: 'character-panel ' + (isOpen ? '' : 'collapsed') },
    // 头部
    h('div', { className: 'character-header' },
      h('div', { className: 'character-title' }, '角色状态'),
      h('button', { 
        className: 'character-toggle',
        onClick: () => setIsOpen(!isOpen)
      }, isOpen ? '→' : '←')
    ),
    
    // 角色信息
    h('div', { className: 'character-info' },
      // 头像区域
      h('div', { className: 'character-avatar-section' },
        renderAvatar(),
        h('div', { className: 'character-name' }, 
          ctx.charCard ? ctx.charCard.name : '未选择角色'
        ),
        ctx.charCard && h('div', { className: 'character-title-text' }, 
          ctx.charCard.creator || '角色扮演'
        )
      ),
      
      // 状态卡片
      h('div', { className: 'character-status-card' },
        // 情绪状态
        h('div', { className: 'mood-status' },
          renderMoodIndicator(),
          h('div', { className: 'mood-text' },
            h('div', { className: 'mood-label' }, '当前情绪'),
            h('div', { className: 'mood-value' }, getMoodText(mood))
          )
        ),
        
        // 好感度
        h('div', { className: 'affection-system' },
          h('div', { className: 'affection-header' },
            h('span', { className: 'affection-label' }, '❤ 好感度'),
            h('span', { className: 'affection-value' }, affection)
          ),
          renderAffectionBar()
        ),
        
        // 场景状态
        h('div', { className: 'scene-status' },
          h('div', { className: 'scene-label' }, '当前场景'),
          h('div', { className: 'scene-value' }, scene)
        ),
        
        // 世界状态
        h('div', { className: 'world-status' },
          h('div', { className: 'world-label' }, '世界状态'),
          renderWorldTags()
        )
      ),
      
      // Author Note
      h('div', { className: 'author-note' },
        h('div', { className: 'author-note-label' },
          h('span', null, '📝'),
          'Author Note'
        ),
        h('div', { className: 'author-note-content' }, authorNote)
      )
    ),
    
    // 动作按钮
    h('div', { className: 'character-actions' },
      h('button', { className: 'character-action-btn' },
        h('span', { className: 'icon' }, '🎭'),
        '切换角色'
      ),
      h('button', { className: 'character-action-btn' },
        h('span', { className: 'icon' }, '🎨'),
        '调整情绪'
      ),
      h('button', { className: 'character-action-btn' },
        h('span', { className: 'icon' }, '🖼️'),
        '更换场景'
      ),
      h('button', { className: 'character-action-btn' },
        h('span', { className: 'icon' }, '📚'),
        '查看记忆'
      )
    )
  );
}