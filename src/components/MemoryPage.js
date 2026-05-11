import React, { useContext, useState, useEffect } from 'react';
import { Ctx } from '../state.js';
import { showToast, timeAgo, genId } from '../utils/helpers.js';
import * as memorydb from '../db/memorydb.js';
import { exportMemories, importMemories, extractFromMessage, buildMemoryContext } from '../utils/memory.js';

const h = React.createElement;

// 记忆分类配置
const CATEGORY_CONFIG = {
  profile: { label: '个人信息', icon: '👤', color: '#3b82f6' },
  project: { label: '项目开发', icon: '🚀', color: '#10b981' },
  preference: { label: '偏好设置', icon: '⚙️', color: '#8b5cf6' },
  relationship: { label: '人际关系', icon: '👥', color: '#ec4899' },
  knowledge: { label: '知识学习', icon: '📚', color: '#f59e0b' },
  workflow: { label: '工作流程', icon: '🔄', color: '#f97316' },
  goal: { label: '目标计划', icon: '🎯', color: '#ef4444' },
  general: { label: '一般记忆', icon: '💭', color: '#64748b' },
};

export function MemoryPage() {
  const ctx = useContext(Ctx);
  const [memories, setMemories] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMemory, setEditingMemory] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editImportance, setEditImportance] = useState(5);
  const [editTags, setEditTags] = useState('');
  const [stats, setStats] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [newMemory, setNewMemory] = useState({
    content: '',
    category: 'general',
    importance: 5,
    tags: ''
  });

  // 加载数据
  const loadData = async () => {
    setIsLoading(true);
    try {
      const allMemories = searchQuery
        ? await memorydb.searchMemories(searchQuery)
        : await memorydb.getAllMemories();
      
      const filtered = selectedCategory === 'all'
        ? allMemories
        : allMemories.filter(m => m.category === selectedCategory);
      
      setMemories(filtered);
      setSummaries(await memorydb.getRecentSummaries(10));
      setStats(await memorydb.getMemoryStats());
    } catch (err) {
      console.error('Load memories error:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedCategory]);

  // 添加记忆
  const handleAddMemory = async () => {
    if (!newMemory.content.trim()) {
      showToast('请输入记忆内容', 'error');
      return;
    }
    
    const memory = {
      content: newMemory.content,
      summary: newMemory.content.slice(0, 100) + (newMemory.content.length > 100 ? '...' : ''),
      category: newMemory.category,
      importance: parseInt(newMemory.importance),
      tags: newMemory.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    
    await memorydb.addMemory(memory);
    showToast('记忆已添加', 'success');
    setNewMemory({ content: '', category: 'general', importance: 5, tags: '' });
    setShowForm(false);
    loadData();
  };

  // 编辑记忆
  const handleEdit = (memory) => {
    setEditingMemory(memory.id);
    setEditContent(memory.content);
    setEditImportance(memory.importance);
    setEditTags(memory.tags?.join(', ') || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMemory || !editContent.trim()) return;
    
    await memorydb.updateMemory(editingMemory, {
      content: editContent,
      summary: editContent.slice(0, 100) + (editContent.length > 100 ? '...' : ''),
      importance: editImportance,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
    });
    
    showToast('记忆已更新', 'success');
    setEditingMemory(null);
    loadData();
  };

  // 删除记忆
  const handleDelete = async (id) => {
    if (!confirm('确定删除这条记忆？')) return;
    await memorydb.deleteMemory(id);
    showToast('记忆已删除', 'success');
    loadData();
  };

  // 置顶记忆
  const handlePin = async (id) => {
    await memorydb.pinMemory(id);
    loadData();
  };

  // 导出记忆
  const handleExport = async () => {
    try {
      const data = await exportMemories();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memories-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('记忆导出成功', 'success');
    } catch (err) {
      showToast('导出失败', 'error');
    }
  };

  // 导入记忆
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const count = await importMemories(text);
      showToast(`成功导入 ${count} 条记忆`, 'success');
      loadData();
    } catch (err) {
      showToast('导入失败: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  // 清空记忆
  const handleClear = async () => {
    if (!confirm('确定清空所有记忆？此操作不可恢复！')) return;
    await memorydb.clearAllMemories();
    showToast('记忆已清空', 'success');
    loadData();
  };

  // 清理低重要性记忆
  const handleDecay = async () => {
    await memorydb.decayMemories();
    showToast('低重要性记忆已清理', 'success');
    loadData();
  };

  const categories = Object.entries(CATEGORY_CONFIG);

  return h(React.Fragment, null,
    // 顶部栏
    h('div', { className: 'memory-header' },
      h('button', {
        className: 'btn-icon',
        onClick: () => ctx.setSidebar(true)
      }, '☰'),
      h('h2', null, '🧠 长期记忆'),
      h('button', {
        className: 'btn-icon',
        onClick: () => setShowForm(!showForm)
      }, showForm ? '✕' : '+')
    ),
    
    // 添加记忆表单
    showForm && h('div', { className: 'memory-form' },
      h('textarea', {
        value: newMemory.content,
        onChange: (e) => setNewMemory({ ...newMemory, content: e.target.value }),
        placeholder: '输入要记住的内容...',
        rows: 3
      }),
      h('div', { className: 'form-row' },
        h('select', {
          value: newMemory.category,
          onChange: (e) => setNewMemory({ ...newMemory, category: e.target.value })
        },
          categories.map(([key, config]) =>
            h('option', { key, value: key }, `${config.icon} ${config.label}`)
          )
        ),
        h('input', {
          type: 'number',
          min: 1,
          max: 10,
          value: newMemory.importance,
          onChange: (e) => setNewMemory({ ...newMemory, importance: e.target.value }),
          placeholder: '重要性'
        })
      ),
      h('input', {
        value: newMemory.tags,
        onChange: (e) => setNewMemory({ ...newMemory, tags: e.target.value }),
        placeholder: '标签（逗号分隔）'
      }),
      h('button', {
        className: 'btn btn-primary',
        onClick: handleAddMemory
      }, '💾 保存记忆')
    ),
    
    // 搜索和筛选
    h('div', { className: 'memory-controls' },
      h('input', {
        type: 'search',
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        placeholder: '🔍 搜索记忆...',
        className: 'search-input'
      }),
      h('div', { className: 'category-filters' },
        h('button', {
          className: `filter-btn ${selectedCategory === 'all' ? 'active' : ''}`,
          onClick: () => setSelectedCategory('all')
        }, '全部'),
        categories.map(([key, config]) =>
          h('button', {
            key,
            className: `filter-btn ${selectedCategory === key ? 'active' : ''}`,
            onClick: () => setSelectedCategory(key),
            style: { borderColor: selectedCategory === key ? config.color : undefined }
          }, config.icon)
        )
      ),
      h('div', { className: 'action-btns' },
        h('button', {
          className: 'btn-sm',
          onClick: handleExport,
          title: '导出记忆'
        }, '📤'),
        h('label', { className: 'btn-sm', title: '导入记忆' },
          h('input', {
            type: 'file',
            accept: '.json',
            style: { display: 'none' },
            onChange: handleImport
          }),
          '📥'
        ),
        h('button', {
          className: 'btn-sm',
          onClick: handleDecay,
          title: '清理低重要性'
        }, '🧹'),
        h('button', {
          className: 'btn-sm danger',
          onClick: handleClear,
          title: '清空所有'
        }, '🗑️')
      )
    ),
    
    // 统计信息
    h('div', { className: 'memory-stats' },
      h('div', { className: 'stat' },
        h('span', { className: 'stat-num' }, stats.total || 0),
        h('span', null, '总记忆')
      ),
      h('div', { className: 'stat' },
        h('span', { className: 'stat-num' }, stats.byImportance?.high || 0),
        h('span', null, '重要')
      ),
      h('div', { className: 'stat' },
        h('span', { className: 'stat-num' }, stats.byImportance?.medium || 0),
        h('span', null, '中等')
      ),
      h('div', { className: 'stat' },
        h('span', { className: 'stat-num' }, stats.byImportance?.low || 0),
        h('span', null, '一般')
      )
    ),
    
    // 记忆列表
    h('div', { className: 'memory-list' },
      isLoading ? h('div', { className: 'loading' }, '加载中...') :
      memories.length === 0 ? h('div', { className: 'empty' },
        h('div', { className: 'empty-icon' }, '🧠'),
        h('p', null, searchQuery ? '没有找到相关记忆' : '开始聊天，AI会自动提取重要信息')
      ) :
      memories.map(memory => h('div', {
        key: memory.id,
        className: `memory-card ${memory.pinned ? 'pinned' : ''}`
      },
        // 编辑模式
        editingMemory === memory.id ? h('div', { className: 'edit-mode' },
          h('textarea', {
            value: editContent,
            onChange: (e) => setEditContent(e.target.value),
            rows: 4
          }),
          h('div', { className: 'edit-row' },
            h('select', {
              value: editImportance,
              onChange: (e) => setEditImportance(parseInt(e.target.value))
            },
              [1,2,3,4,5,6,7,8,9,10].map(n =>
                h('option', { key: n, value: n }, `重要性: ${n}`)
              )
            )
          ),
          h('input', {
            value: editTags,
            onChange: (e) => setEditTags(e.target.value),
            placeholder: '标签（逗号分隔）'
          }),
          h('div', { className: 'edit-actions' },
            h('button', { className: 'btn-sm primary', onClick: handleSaveEdit }, '保存'),
            h('button', { className: 'btn-sm', onClick: () => setEditingMemory(null) }, '取消')
          )
        ) :
        // 显示模式
        h(React.Fragment, null,
          h('div', { className: 'card-header' },
            h('div', { className: 'category-tag', style: { background: CATEGORY_CONFIG[memory.category]?.color } },
              CATEGORY_CONFIG[memory.category]?.icon
            ),
            h('div', { className: 'importance-bar' },
              h('div', {
                className: 'importance-fill',
                style: { width: `${memory.importance * 10}%` }
              })
            ),
            memory.pinned && h('span', { className: 'pin-icon' }, '📌'),
            h('span', { className: 'time-ago' }, timeAgo(memory.createdAt))
          ),
          h('div', { className: 'card-content' },
            h('p', null, memory.content),
            memory.tags?.length > 0 && h('div', { className: 'tags' },
              memory.tags.map((tag, i) => h('span', { key: i, className: 'tag' }, tag))
            )
          ),
          h('div', { className: 'card-actions' },
            h('button', {
              className: 'action-btn',
              onClick: () => handlePin(memory.id)
            }, memory.pinned ? '📌' : '📍'),
            h('button', {
              className: 'action-btn',
              onClick: () => handleEdit(memory)
            }, '✏️'),
            h('button', {
              className: 'action-btn danger',
              onClick: () => handleDelete(memory.id)
            }, '🗑️')
          )
        )
      ))
    ),
    
    // 最近摘要
    summaries.length > 0 && h('div', { className: 'summaries-section' },
      h('h3', null, '📋 最近对话摘要'),
      h('div', { className: 'summary-list' },
        summaries.slice(0, 5).map(summary => h('div', {
          key: summary.id,
          className: 'summary-card'
        },
          h('div', { className: 'summary-content' }, summary.content),
          h('div', { className: 'summary-meta' },
            h('span', null, timeAgo(summary.createdAt)),
            summary.keyTopics?.length > 0 && h('div', { className: 'topics' },
              summary.keyTopics.slice(0, 3).map((t, i) =>
                h('span', { key: i, className: 'topic-tag' }, t)
              )
            )
          )
        ))
      )
    )
  );
}