import React from 'react';
import AtmosphereBackground from '../components/layers/AtmosphereBackground';
import CharacterHero from '../components/layers/CharacterHero';
import FloatingContent from '../components/layers/FloatingContent';
import MessageLayer from '../components/layers/MessageLayer';
import InputDock from '../components/layers/InputDock';
import BottomNavDock from '../components/layers/BottomNavDock';
import { renderMarkdown } from '../utils/markdown.js';

const h = React.createElement;

function formatTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

export default function ChatRoom({ character, messages, inputValue, onInputChange, onSend, loading, activeNav, onNavigate, scene, stats }) {
  var moodEmoji = character?.moodEmoji || '🥰';
  var mood = character?.mood || '等待中';
  var affection = typeof character?.affection === 'number' ? character.affection : 78;
  var charName = character?.name || '她';
  var charAvatar = character?.avatar || '';

  // 转换消息层格式: role 'assistant' → 'ai', 'user' → 'user'
  var displayMsgs = (messages || []).map(function(m) {
    return {
      id: m.id,
      role: m.role === 'assistant' ? 'ai' : 'user',
      content: m.content,
      time: formatTime(m.ts)
    };
  });

  var sceneText = scene || (character?.scenario ? character.scenario + ' · ' + (character?.personality || '') : '');

  return h('div', { 
    className: 'chat-room-shell',
    style: { 
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }
  },
    h(AtmosphereBackground),
    h(CharacterHero, { 
      name: charName,
      avatar: charAvatar,
      mood: mood,
      moodEmoji: moodEmoji,
      affection: affection,
      online: true
    }),
    h(FloatingContent, {
      stats: stats || [
        { value: messages ? messages.filter(function(m) { return m.role === 'user'; }).length : 0, label: '消息' },
        { value: affection + '%', label: '好感' }
      ],
      scene: sceneText
    }),
    h(MessageLayer, { messages: displayMsgs }),
    h(InputDock, { value: inputValue, onChange: onInputChange, onSend: function() { if (inputValue && inputValue.trim()) { onSend && onSend(); } }, loading: loading, placeholder: '和' + charName + '说些什么...' }),
    h(BottomNavDock, { activeId: activeNav || 'chat', onNavigate })
  );
}