import React from 'react';
import AtmosphereBackground from '../components/layers/AtmosphereBackground';
import CharacterHero from '../components/layers/CharacterHero';
import FloatingContent from '../components/layers/FloatingContent';
import MessageLayer from '../components/layers/MessageLayer';
import InputDock from '../components/layers/InputDock';
import BottomNavDock from '../components/layers/BottomNavDock';

const h = React.createElement;

/**
 * ChatRoom — 聊天页面统一布局容器
 * 六个独立层在z轴上叠加
 */
export default function ChatRoom({ character, messages, inputValue, onInputChange, onSend, loading, activeNav, onNavigate }) {
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
      name: character?.name, 
      avatar: character?.avatar, 
      mood: character?.mood 
    }),
    h(FloatingContent),
    h(MessageLayer, { messages }),
    h(InputDock, { value: inputValue, onChange: onInputChange, onSend, loading }),
    h(BottomNavDock, { activeId: activeNav, onNavigate })
  );
}