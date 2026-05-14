# AIA Client — 移动端 AI 角色扮演聊天平台

一个运行在移动浏览器中的 AI 角色扮演（RP）聊天应用，支持多角色、多会话、沉浸式 UI。

## 架构说明

### 数据架构

```
Character（角色）
  ├── Chat 1（会话）
  │     ├── Message 1
  │     └── Message 2
  └── Chat 2（会话）
        └── Message 1
```

| 层 | 说明 |
|----|------|
| **Character** | 角色基本信息（名称、头像、设定、世界书等） |
| **Chat** | 角色下的独立对话线程，每个角色可有多个会话 |
| **Message** | 会话中的具体消息，关联到 convId + chatId |

### 页面流程

```
角色大厅 (CharacterHall)
  └─ 点击角色卡片 ──→ 会话列表 (ChatListPage)
                        ├─ 点击已有会话 ──→ 聊天页 (ImmersiveChatPage)
                        └─ 新建对话 ──→ 聊天页 (ImmersiveChatPage)

底部导航
  💬 聊天   🎭 角色(大厅)   🧠 记忆   ⚙️ 设置
```

### 存储结构

**IndexedDB (v3)** — 浏览器本地数据库

| 表 | 主键 | 索引 |
|----|------|------|
| `characters` | id | — |
| `chats` | chatId | characterId, updatedAt |
| `messages` | id | convId, chatId, [convId, ts] |
| `conversations` | id | updatedAt |
| `settings` | key | — |
| `worldbook` | id | convId |
| `apiConfigs` | id | — |

### 技术栈

- **前端**：React (createElement，无 JSX 编译)
- **样式**：纯 CSS（毛玻璃 + 粉紫渐变 + CSS 变量系统）
- **存储**：IndexedDB (Dexie-free，原生 API)
- **部署**：GitHub Pages
- **AI 后端**：兼容 OpenAI 协议的任意 API

## 目录结构

```
src/
├── app.js                    # 主应用 + 路由
├── state.js                  # React Context
├── db/
│   └── indexeddb.js          # IndexedDB 封装 (v3)
├── components/
│   ├── ImmersiveChatPage.js  # 聊天页
│   ├── ImmersiveSidebar.js   # 侧边栏
│   ├── CharacterHall.js      # 角色大厅 [NEW v1.3]
│   ├── ChatListPage.js       # 会话列表 [NEW v1.3]
│   ├── CharacterPage.js      # 角色详情页
│   ├── CharacterPanel.js     # 角色面板
│   ├── SettingsPage.js       # 设置页
│   ├── MemoryPage.js         # 记忆页
│   └── LockScreen.js         # PIN 锁屏
├── providers/                # AI 提供商适配
├── utils/                    # 工具函数
└── styles/
    └── immersive-rp.css      # 全局样式（明亮梦幻）
```

## 快速开始

1. 访问 https://linnasai521-star.github.io/aia-client/
2. 在设置中配置 API（Base URL + Key + Model）
3. 点击 🎭 角色 → 导入角色卡（.json 或 .png）
4. 点击角色 → 新建对话 → 开始聊天

## 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)

### 最近更新 (v1.3.0)

- 🎭 角色大厅：卡片流展示所有角色
- 💬 多会话：每个角色支持多个独立对话
- 📋 会话列表：查看和管理角色的所有对话
- 🔄 向后兼容：自动迁移现有数据

### 后续计划

- 聊天导入/导出
- 会话重命名/删除确认
- 角色标签分组
- 更多 AI 提供商支持