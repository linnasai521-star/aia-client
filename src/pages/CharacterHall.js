import React from 'react';
import AtmosphereBackground from '../components/layers/AtmosphereBackground';
import BottomNavDock from '../components/layers/BottomNavDock';
import './character-hall.css';

const h = React.createElement;

var MOCK_MOODS = [
  { name: '她', emoji: '🥰', mood: '想你了', time: '刚刚' },
  { name: '猫娘', emoji: '😺', mood: '等你摸头', time: '5分钟前' },
  { name: '学姐', emoji: '📚', mood: '正在看书', time: '12分钟前' },
  { name: '小天使', emoji: '👼', mood: '想出去玩', time: '1小时前' },
];

var MOCK_RECENT = [
  { id: 'r1', name: '她', desc: '陪了你很久的那个她', time: '刚刚聊过' },
  { id: 'r2', name: '猫娘', desc: '调皮又粘人的小猫咪', time: '今天 14:30' },
  { id: 'r3', name: '学姐', desc: '温柔又知性的学姐', time: '昨天 22:15' },
];

var MOCK_CHARS = [
  { id: 'c1', name: '她', desc: '一直在等你回来', last: '刚刚', affection: 78 },
  { id: 'c2', name: '猫娘', desc: '喵~快来玩', last: '今天 14:30', affection: 65 },
  { id: 'c3', name: '学姐', desc: '安静地读着书', last: '昨天 22:15', affection: 42 },
  { id: 'c4', name: '小天使', desc: '今天也元气满满', last: '3天前', affection: 55 },
  { id: 'c5', name: '温柔姐姐', desc: '会照顾人的姐姐', last: '上周', affection: 30 },
  { id: 'c6', name: '小恶魔', desc: '今天想怎么捉弄你呢', last: '5月10日', affection: 20 },
];

export default function CharacterHall() {
  return h('div', { className: 'nh-shell' },
    h(AtmosphereBackground),
    h('div', { className: 'nh-scroll' },
      h('h2', { className: 'nh-title' }, '💭 此刻的心情'),
      h('div', { className: 'nh-scroll-x' },
        MOCK_MOODS.map(function(m) {
          return h('div', { key: m.name, className: 'mood-card' },
            h('div', { className: 'mood-avatar' }, m.emoji),
            h('div', { className: 'mood-name' }, m.name),
            h('div', { className: 'mood-bubble' }, m.mood),
            h('div', { className: 'mood-time' }, m.time),
          );
        })
      ),
      h('h2', { className: 'nh-title' }, '🕐 最近互动'),
      h('div', { className: 'nh-scroll-x' },
        MOCK_RECENT.map(function(r) {
          return h('div', { key: r.id, className: 'recent-card' },
            h('div', { className: 'recent-bg-icon' }, '✨'),
            h('div', { className: 'recent-avatar' }, r.name[0]),
            h('div', { className: 'recent-name' }, r.name),
            h('div', { className: 'recent-desc' }, r.desc),
            h('div', { className: 'recent-time' }, r.time),
          );
        })
      ),
      h('h2', { className: 'nh-title' }, '🎭 角色'),
      h('div', { className: 'nh-grid' },
        MOCK_CHARS.map(function(c) {
          return h('div', { key: c.id, className: 'char-card' },
            h('div', { className: 'char-card-avatar' },
              c.name[0],
              h('div', { className: 'char-card-halo', style: { opacity: 0.3 + c.affection / 300 } }),
            ),
            h('div', { className: 'char-card-name' }, c.name),
            h('div', { className: 'char-card-desc' }, c.desc),
            h('div', { className: 'char-card-bar' },
              h('div', { className: 'char-card-fill', style: { width: c.affection + '%' } }),
            ),
            h('div', { className: 'char-card-time' }, c.last),
          );
        })
      ),
    ),
    h(BottomNavDock, { activeId: 'character' }),
  );
}