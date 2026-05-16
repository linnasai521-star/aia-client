import React, { useState, useEffect, useCallback } from 'react';
import { genId } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

export function ChatListPage({ characterId, onSelectChat, onBack }) {
  const [chats, setChats] = useState([]);
  const [character, setCharacter] = useState(null);
  const [menuChatId, setMenuChatId] = useState(null);

  useEffect(() => {
    if (characterId) db.getCharacter(characterId).then(c => setCharacter(c));
  }, [characterId]);

  const loadChats = useCallback(async () => {
    if (!characterId) return;
    const list = await db.getChatsByCharacter(characterId);
    setChats(list);
  }, [characterId]);

  useEffect(() => { loadChats(); }, [loadChats]);

  const createNewChat = async () => {
    const chatId = genId();
    await db.putChat({
      chatId, characterId, title: '新对话',
      createdAt: Date.now(), updatedAt: Date.now(),
      lastMessageAt: Date.now(), summary: '', messageCount: 0
    });
    await loadChats();
    const chat = await db.getChat(chatId);
    onSelectChat(chat);
  };

  const deleteChat = async (chatId) => {
    if (!confirm('确定删除这个对话？')) return;
    await db.deleteChat(chatId);
    setMenuChatId(null);
    await loadChats();
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
    return new Date(ts).toLocaleDateString('zh-CN');
  };

  return h('div', { className: 'chat-app' },
    h('header', { className: 'topbar' },
      h('button', { className: 'topbar-btn', onClick: onBack }, '←'),
      h('div', { className: 'topbar-info' },
        character?.avatar ? h('img', { src: character.avatar, className: 'topbar-avatar', onError: e => e.target.style.display = 'none' }) : null,
        h('span', { className: 'topbar-title' }, character?.name || '角色')
      ),
      h('button', { className: 'topbar-btn', onClick: createNewChat }, '+')
    ),
    h('main', { className: 'page-body' },
      h('div', { className: 'scroll-area' },
        chats.length === 0
          ? h('div', { className: 'empty-chat-list' },
              h('div', { className: 'empty-icon' }, '💬'),
              h('div', { className: 'empty-title' }, '还没有对话'),
              h('div', { className: 'empty-desc' }, '点击 + 创建新对话')
            )
          : h('div', { className: 'chat-items' },
              chats.map(chat => h('div', {
                key: chat.chatId, className: 'chat-item',
                onClick: () => onSelectChat(chat),
                onContextMenu: e => { e.preventDefault(); setMenuChatId(menuChatId === chat.chatId ? null : chat.chatId); }
              },
                h('div', { className: 'chat-item-left' },
                  h('div', { className: 'chat-item-avatar' },
                    character?.avatar
                      ? h('img', { src: character.avatar, className: 'chat-item-avatar-img', onError: e => e.target.style.display = 'none' })
                      : h('div', { className: 'chat-item-avatar-fallback' }, character?.name?.[0] || '💬')
                  )
                ),
                h('div', { className: 'chat-item-content' },
                  h('div', { className: 'chat-item-top' },
                    h('span', { className: 'chat-item-title' }, chat.title || '新对话'),
                    h('span', { className: 'chat-item-time' }, formatTime(chat.lastMessageAt))
                  ),
                  h('div', { className: 'chat-item-bottom' },
                    h('span', { className: 'chat-item-summary' }, chat.summary || '暂无消息'),
                    menuChatId !== chat.chatId && chat.messageCount > 0 && h('span', { className: 'chat-item-count' }, chat.messageCount)
                  )
                ),
                menuChatId === chat.chatId && h('button', {
                  className: 'chat-item-delete',
                  onClick: e => { e.stopPropagation(); deleteChat(chat.chatId); }
                }, '删除')
              ))
            )
      )
    )
  );
}

export default ChatListPage;
