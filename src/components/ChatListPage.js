import React, { useState, useEffect } from 'react';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return date.toLocaleDateString();
}

export default function ChatListPage({ character, onBack, onOpenChat }) {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (character) loadChats();
  }, [character]);

  async function loadChats() {
    try {
      const chatList = await db.getChatsByCharacter(character.id);
      setChats(chatList || []);
    } catch (e) {
      console.error('loadChats:', e);
      setChats([]);
    }
  }

  async function createNewChat() {
    const chatId = 'chat-' + Date.now();
    const newChat = {
      chatId,
      characterId: character.id,
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
      isActive: true,
      summary: ''
    };
    await db.putChat(newChat);
    await loadChats();
    if (onOpenChat) onOpenChat(character, newChat);
  }

  return h('div', { className: 'chat-list-page' },
    h('div', { className: 'list-header' },
      h('button', { className: 'back-btn', onClick: onBack }, '←'),
      character?.avatar ?
        h('img', {
          src: character.avatar,
          className: 'list-avatar',
          alt: character.name,
          onError: (e) => { e.target.style.display = 'none'; }
        }) : null,
      h('div', { className: 'list-info' },
        h('h2', null, character?.name || ''),
        h('p', null, (chats.length || 0) + ' 个对话')
      )
    ),
    h('div', { className: 'chat-list-content' },
      chats.length === 0 ?
        h('div', { className: 'list-empty' },
          h('p', null, '还没有对话'),
          h('button', { onClick: createNewChat }, '开始新对话')
        ) :
        h('div', { className: 'chat-list' },
          chats.map(chat =>
            h('div', {
              key: chat.chatId,
              className: 'chat-item',
              onClick: () => onOpenChat && onOpenChat(character, chat)
            },
              h('div', { className: 'chat-item-avatar' }, '💬'),
              h('div', { className: 'chat-item-info' },
                h('div', { className: 'chat-item-title' }, chat.title),
                h('div', { className: 'chat-item-summary' }, chat.summary || '暂无消息'),
                h('div', { className: 'chat-item-time' }, formatTime(chat.lastMessageAt))
              ),
              h('div', { className: 'chat-item-arrow' }, '›')
            )
          )
        )
    ),
    h('div', { className: 'list-footer' },
      h('button', { className: 'new-chat-btn', onClick: createNewChat }, '+ 新对话')
    )
  );
}