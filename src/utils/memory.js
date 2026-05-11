// 记忆提取模块 - 分析对话并提取长期记忆
import * as memorydb from '../db/memorydb.js';

// 记忆类别
const CATEGORIES = {
  profile: ['我', '名字', '年龄', '职业', '工作', '学校', '专业', '城市', '爱好', '喜欢'],
  project: ['项目', '开发', '代码', '部署', '功能', 'bug', '修复', '重构', '测试'],
  preference: ['喜欢', '讨厌', '偏好', '风格', '习惯', '设置', '配置', '选择'],
  relationship: ['朋友', '家人', '同事', '老师', '同学', '关系', '社交'],
  knowledge: ['学习', '了解', '知道', '概念', '原理', '教程', '文档'],
  workflow: ['流程', '步骤', '方法', '工作流', '自动化', '效率', '计划'],
  goal: ['目标', '计划', '想要', '希望', '期待', '未来', '打算', '梦想'],
};

// 重要性评估
const IMPORTANCE_SIGNALS = {
  high: [
    /我是(.{2,10})/,
    /我的(.{2,10})是/,
    /记住这个/,
    /重要的是/,
    /永远不要忘记/,
    /我的目标是/,
    /我计划/,
    /项目名称[:：]/,
  ],
  medium: [
    /我喜欢/,
    /我讨厌/,
    /我习惯/,
    /通常我/,
    /我的风格/,
    /最近在(.{2,20})/,
    /正在开发/,
    /正在学习/,
  ],
  low: [
    /今天/,
    /刚才/,
    /刚才说的/,
    /之前提到/,
  ],
};

// 检测类别
function detectCategory(content) {
  const lower = content.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'general';
}

// 评估重要性
function assessImportance(content) {
  for (const pattern of IMPORTANCE_SIGNALS.high) {
    if (pattern.test(content)) return 9;
  }
  
  for (const pattern of IMPORTANCE_SIGNALS.medium) {
    if (pattern.test(content)) return 6;
  }
  
  for (const pattern of IMPORTANCE_SIGNALS.low) {
    if (pattern.test(content)) return 3;
  }
  
  return 5; // 默认中等重要性
}

// 提取标签
function extractTags(content) {
  const tags = [];
  const tagPatterns = [
    /#[\u4e00-\u9fa5a-zA-Z0-9_]+/g, // #标签
    /【([\u4e00-\u9fa5a-zA-Z0-9_]+)】/g, // 【标签】
  ];
  
  for (const pattern of tagPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      tags.push(...matches.map(t => t.replace(/[【】#]/g, '').trim()));
    }
  }
  
  // 自动标签
  if (/部署/.test(content)) tags.push('部署');
  if (/开发/.test(content)) tags.push('开发');
  if (/bug/.test(content)) tags.push('bug');
  if (/学习/.test(content)) tags.push('学习');
  if (/项目/.test(content)) tags.push('项目');
  
  return [...new Set(tags)];
}

// 从单条消息提取记忆
export function extractFromMessage(message) {
  if (!message || !message.content) return null;
  
  const content = message.content.trim();
  if (content.length < 10) return null; // 太短不提取
  
  // 跳过系统消息
  if (message.role === 'system') return null;
  
  const category = detectCategory(content);
  const importance = assessImportance(content);
  const tags = extractTags(content);
  
  // 生成摘要
  const summary = content.length > 100 
    ? content.slice(0, 100) + '...' 
    : content;
  
  return {
    content,
    summary,
    category,
    importance,
    tags,
    conversationId: message.convId,
    sourceMessageIds: [message.id],
    createdAt: Date.now(),
  };
}

// 从对话提取记忆
export async function extractFromConversation(messages, convId) {
  const memories = [];
  
  // 分析用户消息
  const userMessages = messages.filter(m => m.role === 'user');
  
  for (const msg of userMessages) {
    const memory = extractFromMessage(msg);
    if (memory && memory.importance >= 5) {
      memories.push(memory);
    }
  }
  
  // 保存重要记忆
  for (const mem of memories) {
    await memorydb.addMemory({
      ...mem,
      conversationId: convId,
    });
  }
  
  return memories;
}

// 生成对话摘要
export async function generateSummary(messages, convId) {
  if (messages.length < 5) return null;
  
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  // 提取关键话题
  const topics = new Set();
  for (const msg of [...userMessages, ...assistantMessages]) {
    const tags = extractTags(msg.content);
    tags.forEach(t => topics.add(t));
  }
  
  // 生成摘要内容
  const summaryContent = [
    `对话共 ${messages.length} 条消息`,
    `用户消息: ${userMessages.length} 条`,
    `AI回复: ${assistantMessages.length} 条`,
    topics.size > 0 ? `关键话题: ${[...topics].join(', ')}` : '',
  ].filter(Boolean).join('\n');
  
  const summary = await memorydb.addSummary({
    conversationId: convId,
    content: summaryContent,
    keyTopics: [...topics],
    messageCount: messages.length,
  });
  
  return summary;
}

// 检索相关记忆
export async function retrieveRelevantMemories(query, limit = 5) {
  // 先检查缓存
  const cacheKey = `query_${query.slice(0, 50)}`;
  const cached = await memorydb.getCachedMemories(cacheKey);
  if (cached) return cached;
  
  // 搜索记忆
  const results = await memorydb.searchMemories(query);
  
  // 限制数量
  const limited = results.slice(0, limit);
  
  // 缓存结果
  await memorydb.setCachedMemories(cacheKey, limited, 300000); // 5分钟缓存
  
  return limited;
}

// 构建记忆上下文
export async function buildMemoryContext(query, convId) {
  const relevant = await retrieveRelevantMemories(query);
  const important = await memorydb.getImportantMemories();
  
  // 合并去重
  const allMemories = [...new Map([...relevant, ...important].map(m => [m.id, m])).values()];
  
  if (allMemories.length === 0) return '';
  
  // 构建上下文
  const lines = ['Relevant Memories:'];
  
  for (const mem of allMemories.slice(0, 10)) {
    const summary = mem.summary || mem.content.slice(0, 100);
    const tags = mem.tags?.length > 0 ? ` [${mem.tags.join(', ')}]` : '';
    lines.push(`- ${summary}${tags}`);
  }
  
  return lines.join('\n');
}

// 清理低重要性记忆
export async function decayMemories() {
  const all = await memorydb.getAllMemories();
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  for (const mem of all) {
    if (mem.importance < 4 && mem.createdAt < monthAgo) {
      await memorydb.deleteMemory(mem.id);
    }
  }
}

// 导出记忆
export async function exportMemories() {
  const memories = await memorydb.getAllMemories();
  const summaries = await memorydb.getRecentSummaries(100);
  
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    memories,
    summaries,
  }, null, 2);
}

// 导入记忆
export async function importMemories(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || !data.memories) {
      throw new Error('Invalid memory export format');
    }
    
    let imported = 0;
    for (const mem of data.memories) {
      await memorydb.addMemory(mem);
      imported++;
    }
    
    for (const summary of data.summaries || []) {
      await memorydb.addSummary(summary);
    }
    
    return imported;
  } catch (err) {
    console.error('Import memories failed:', err);
    throw err;
  }
}