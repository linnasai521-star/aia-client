// 视觉小说模式组件
import React, { useContext, useState, useEffect, useRef } from 'react';
import { Ctx } from '../state.js';
import { timeAgo } from '../utils/helpers.js';

const h = React.createElement;

// 场景背景配置
const SCENES = {
  night_rain: {
    name: '雨天咖啡馆',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    icon: '🌧️'
  },
  bedroom: {
    name: '温馨卧室',
    background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%)',
    icon: '🛏️'
  },
  library: {
    name: '图书馆',
    background: 'linear-gradient(135deg, #2c3e50 0%, #3d5a80 50%, #293241 100%)',
    icon: '📚'
  },
  cyberpunk: {
    name: '赛博朋克城市',
    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    icon: '🌃'
  },
  sunset: {
    name: '黄昏海岸',
    background: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 50%, #ff7e5f 100%)',
    icon: '🌅'
  },
  snow: {
    name: '雪景森林',
    background: 'linear-gradient(135deg, #e6e9f0 0%, #eef1f5 50%, #e6e9f0 100%)',
    icon: '❄️'
  }
};

// 情绪配置
const MOODS = {
  happy: { emoji: '😊', text: '开心', color: '#ffd6a5' },
  sad: { emoji: '😢', text: '低落', color: '#a0c4ff' },
  angry: { emoji: '😠', text: '生气', color: '#ffadad' },
  thoughtful: { emoji: '🤔', text: '思考中', color: '#bdb2ff' },
  dependent: { emoji: '🥰', text: '依赖', color: '#ffc6ff' }
};

export function VisualNovelMode({ onClose }) {
  const ctx = useContext(Ctx);
  const [currentScene, setCurrentScene] = useState('night_rain');
  const [currentMood, setCurrentMood] = useState('thoughtful');
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showSceneSelector, setShowSceneSelector] = useState(false);
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const messagesEndRef = useRef(null);

  // 模拟对话历史
  const [dialogues] = useState([
    {
      id: 1,
      speaker: '角色',
      content: '你来了... 我等了很久。',
      mood: 'sad'
    },
    {
      id: 2,
      speaker: '角色',
      content: '今天外面下着雨，正好适合安静地聊天。',
      mood: 'thoughtful'
    },
    {
      id: 3,
      speaker: '角色',
      content: '你想听个故事吗？还是只是想静静地待一会儿？',
      mood: 'happy'
    }
  ]);

  // 场景切换动画
  const handleSceneChange = (sceneKey) => {
    if (sceneKey === currentScene) return;
    
    setTransitioning(true);
    setTimeout(() => {
      setCurrentScene(sceneKey);
      setTransitioning(false);
    }, 500);
    
    setShowSceneSelector(false);
  };

  // 情绪切换
  const handleMoodChange = (moodKey) => {
    setCurrentMood(moodKey);
    setShowMoodSelector(false);
  };

  // 发送消息
  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // 添加用户消息到对话历史
    const newDialogue = {
      id: Date.now(),
      speaker: '你',
      content: inputValue,
      mood: 'happy'
    };
    
    // 在实际应用中，这里会调用ctx.sendMsg
    setInputValue('');
    
    // 模拟角色回复
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      // 这里可以添加实际的AI回复逻辑
    }, 2000);
  };

  // 键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // 快捷操作
  const handleQuickAction = (action) => {
    setInputValue(action);
  };

  // 渲染对话内容
  const renderDialogue = () => {
    const currentDialogue = dialogues[dialogueIndex];
    if (!currentDialogue) return null;

    const moodConfig = MOODS[currentDialogue.mood] || MOODS.thoughtful;

    return h('div', { className: 'vn-dialogue-text' },
      h('div', { className: 'vn-text-content' },
        h('p', null, currentDialogue.content)
      )
    );
  };

  // 渲染角色信息
  const renderCharacterInfo = () => {
    const moodConfig = MOODS[currentMood];
    const characterName = ctx.charCard ? ctx.charCard.name : '角色';

    return h('div', { className: 'vn-character-info' },
      h('div', { className: 'vn-character-avatar' },
        ctx.charCard?.avatar ? 
          h('img', { 
            src: ctx.charCard.avatar, 
            alt: characterName,
            style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }
          }) :
          characterName[0] || '?'
      ),
      h('div', { className: 'vn-character-name' }, characterName),
      h('div', { className: 'vn-character-mood' }, 
        moodConfig.emoji + ' ' + moodConfig.text
      )
    );
  };

  // 渲染场景选择器
  const renderSceneSelector = () => {
    if (!showSceneSelector) return null;

    return h('div', { className: 'vn-scene-selector' },
      h('div', { className: 'vn-scene-title' }, '选择场景'),
      h('div', { className: 'vn-scene-options' },
        Object.entries(SCENES).map(([key, scene]) => 
          h('div', { 
            key: key,
            className: `vn-scene-option ${key === currentScene ? 'active' : ''}`,
            onClick: () => handleSceneChange(key)
          },
            h('div', { className: 'vn-scene-icon' }, scene.icon),
            h('div', { className: 'vn-scene-name' }, scene.name)
          )
        )
      )
    );
  };

  // 渲染情绪选择器
  const renderMoodSelector = () => {
    if (!showMoodSelector) return null;

    return h('div', { className: 'vn-mood-selector' },
      h('div', { className: 'vn-mood-title' }, '选择情绪'),
      h('div', { className: 'vn-mood-options' },
        Object.entries(MOODS).map(([key, mood]) => 
          h('div', { 
            key: key,
            className: `vn-mood-option ${key === currentMood ? 'active' : ''}`,
            onClick: () => handleMoodChange(key)
          },
            h('div', { className: 'vn-mood-icon' }, mood.emoji),
            h('div', { className: 'vn-mood-name' }, mood.text)
          )
        )
      )
    );
  };

  return h('div', { className: 'vn-mode' },
    // 背景层
    h('div', { 
      className: 'vn-background',
      style: { background: SCENES[currentScene].background }
    }),
    
    // 过渡效果
    transitioning && h('div', { className: 'vn-transition' }),
    
    // 角色立绘区域
    h('div', { className: 'vn-character-area' },
      ctx.charCard?.avatar ? 
        h('img', { 
          src: ctx.charCard.avatar,
          alt: ctx.charCard.name,
          className: 'vn-character-sprite'
        }) :
        h('div', { 
          className: 'vn-character-sprite',
          style: {
            width: '200px',
            height: '300px',
            background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-tertiary))',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '4rem',
            color: 'var(--bg-primary)'
          }
        }, ctx.charCard?.name?.[0] || '?')
    ),
    
    // 场景选择器
    renderSceneSelector(),
    
    // 情绪选择器
    renderMoodSelector(),
    
    // 对话框区域
    h('div', { className: 'vn-dialogue-area' },
      renderCharacterInfo(),
      renderDialogue(),
      h('div', { className: 'vn-dialogue-controls' },
        h('button', { 
          className: 'vn-control-btn',
          onClick: () => setShowSceneSelector(!showSceneSelector)
        }, '🖼️'),
        h('button', { 
          className: 'vn-control-btn',
          onClick: () => setShowMoodSelector(!showMoodSelector)
        }, '😊'),
        h('button', { 
          className: 'vn-control-btn',
          onClick: () => setDialogueIndex(Math.max(0, dialogueIndex - 1)),
          disabled: dialogueIndex === 0
        }, '◀️'),
        h('button', { 
          className: 'vn-control-btn',
          onClick: () => setDialogueIndex(Math.min(dialogues.length - 1, dialogueIndex + 1)),
          disabled: dialogueIndex >= dialogues.length - 1
        }, '▶️'),
        h('button', { 
          className: 'vn-control-btn primary',
          onClick: onClose
        }, '✕')
      )
    ),
    
    // 输入区域
    h('div', { className: 'vn-input-area' },
      h('div', { className: 'vn-input-container' },
        h('div', { className: 'vn-input-wrapper' },
          h('input', {
            type: 'text',
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: '输入你的回应...'
          })
        ),
        h('button', { 
          className: 'vn-send-btn',
          onClick: handleSend,
          disabled: !inputValue.trim()
        }, '发送')
      ),
      h('div', { className: 'vn-quick-actions' },
        h('button', { 
          className: 'vn-quick-action',
          onClick: () => handleQuickAction('继续说下去...')
        }, '继续'),
        h('button', { 
          className: 'vn-quick-action',
          onClick: () => handleQuickAction('我明白了')
        }, '明白'),
        h('button', { 
          className: 'vn-quick-action',
          onClick: () => handleQuickAction('为什么？')
        }, '为什么'),
        h('button', { 
          className: 'vn-quick-action',
          onClick: () => handleQuickAction('...')
        }, '...')
      )
    ),
    
    // 退出按钮（右上角）
    h('button', {
      onClick: onClose,
      style: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(0,0,0,0.5)',
        border: 'none',
        color: 'white',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        cursor: 'pointer',
        fontSize: '1.2rem',
        zIndex: 100
      }
    }, '✕')
  );
}