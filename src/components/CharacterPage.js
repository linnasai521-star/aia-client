import React, { useContext, useRef, useState } from 'react';
import { Ctx } from '../state.js';
import { showToast } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

// ============================================================
//  头像组件 - 支持 URL / base64 / blob / 默认首字
// ============================================================
function AvatarDisplay({ charCard, size = 80, borderRadius = 20, fontSize = '2rem' }) {
  const [imgError, setImgError] = useState(false);

  // 检查可能的头像字段
  const avatarSrc = charCard?.avatar || charCard?.img || charCard?.image || charCard?.avatar_url || '';
  console.log('[Character] avatar field:', avatarSrc ? avatarSrc.slice(0, 80) : 'empty');

  // 是否为有效可加载的 URL
  const isValidSrc = avatarSrc && (
    avatarSrc.startsWith('blob:') ||
    avatarSrc.startsWith('data:') ||
    avatarSrc.startsWith('http://') ||
    avatarSrc.startsWith('https://') ||
    avatarSrc.startsWith('/')
  );

  if (isValidSrc && !imgError) {
    return h('img', {
      src: avatarSrc,
      alt: charCard?.name || '?',
      style: {
        width: size,
        height: size,
        borderRadius,
        objectFit: 'cover',
        border: '3px solid var(--accent)',
        display: 'block',
      },
      onError: () => {
        console.log('[Character] avatar load failed:', avatarSrc.slice(0, 80));
        setImgError(true);
      },
    });
  }

  // 默认头像：显示角色名首字
  const initial = (charCard?.name || '?')[0];
  return h('div', {
    style: {
      width: size,
      height: size,
      borderRadius,
      background: 'linear-gradient(135deg, rgba(139,147,255,0.3), rgba(183,153,255,0.2))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize,
      fontWeight: '600',
      color: 'var(--accent-secondary, #8b93ff)',
      flexShrink: 0,
    },
  }, initial);
}

// ============================================================
//  EditCharacterForm - 角色卡编辑表单
// ============================================================
function EditCharacterForm({ card, onSave, onCancel }) {
  const [form, setForm] = useState({ ...card });

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.name || !form.name.trim()) {
      showToast('❌ 角色名称不能为空', 'error');
      return;
    }
    const updated = { ...form, updatedAt: Date.now() };
    await db.putCharacter(updated);
    showToast('✅ 角色卡已保存', 'success');
    onSave(updated);
  };

  const fieldStyle = { marginBottom: '14px' };
  const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' };
  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: '0.9rem', lineHeight: '1.5',
    background: 'var(--bg-input)', border: '1px solid var(--glass-border)', borderRadius: '10px',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', resize: 'vertical',
  };
  const textareaStyle = { ...inputStyle, minHeight: '60px' };

  const fields = [
    { key: 'name', label: '角色名称 *', type: 'input', rows: 1 },
    { key: 'personality', label: '性格', type: 'textarea', rows: 3 },
    { key: 'description', label: '描述', type: 'textarea', rows: 4 },
    { key: 'scenario', label: '场景', type: 'textarea', rows: 3 },
    { key: 'first_mes', label: '首条消息 (first_mes)', type: 'textarea', rows: 4 },
    { key: 'mes_example', label: '示例对话', type: 'textarea', rows: 5 },
    { key: 'system_prompt', label: '系统提示', type: 'textarea', rows: 4 },
    { key: 'creator_notes', label: '作者备注', type: 'textarea', rows: 3 },
    { key: 'post_history_instructions', label: '后续指令', type: 'textarea', rows: 3 },
    { key: 'tags', label: '标签（逗号分隔）', type: 'input', rows: 1 },
    { key: 'creator', label: '创作者', type: 'input', rows: 1 },
  ];

  return h('div', { style: { padding: '16px', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' } },
    h('h3', { style: { margin: '0 0 16px', color: 'var(--text-primary)' } }, '✏️ 编辑角色卡'),
    ...fields.map(({ key, label, type, rows }) => {
      const value = Array.isArray(form[key]) ? form[key].join(', ') : (form[key] || '');
      return h('div', { key, style: fieldStyle },
        h('label', { style: labelStyle }, label),
        type === 'textarea' ?
          h('textarea', {
            value,
            rows,
            style: textareaStyle,
            onChange: e => update(key, e.target.value),
          }) :
          h('input', {
            type: 'text',
            value,
            style: inputStyle,
            onChange: e => update(key, e.target.value),
          })
      );
    }),
    h('div', { style: { display: 'flex', gap: '10px', marginTop: '20px', paddingBottom: '20px' } },
      h('button', {
        onClick: handleSave,
        style: {
          flex: 1, padding: '12px', border: 'none', borderRadius: '10px', fontSize: '0.95rem', cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(139,147,255,0.2), rgba(183,153,255,0.15))',
          color: 'var(--text-primary)', fontWeight: '600',
        }
      }, '💾 保存'),
      h('button', {
        onClick: onCancel,
        style: {
          flex: 1, padding: '12px', border: '1px solid var(--glass-border)', borderRadius: '10px',
          fontSize: '0.95rem', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)',
        }
      }, '取消')
    )
  );
}

// ============================================================
//  CharacterPage 主组件
// ============================================================
export function CharacterPage() {
  const ctx = useContext(Ctx);
  const c = ctx.charCard;
  const fileInputRef = useRef(null);
  const pngInputRef = useRef(null);
  const lorebookInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [editing, setEditing] = useState(false);

  // 导入角色卡
  const handleImportCharacter = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportProgress('正在解析文件...');
    try {
      const character = await ctx.importCharacterCard(file);
      if (character) {
        showToast(`✅ 角色卡「${character.name}」导入成功！`, 'success');
        setImportProgress('导入完成！');
      } else {
        showToast('❌ 角色卡导入失败', 'error');
      }
    } catch (error) {
      console.error('Import failed:', error);
      showToast(`❌ 导入失败: ${error.message}`, 'error');
    } finally {
      setImporting(false);
      setImportProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (pngInputRef.current) pngInputRef.current.value = '';
    }
  };

  // 导入世界书
  const handleImportLorebook = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportProgress('正在导入世界书...');
    try {
      const count = await ctx.importLoreBook(file);
      if (count > 0) {
        showToast(`✅ 成功导入 ${count} 个世界书条目！`, 'success');
      } else {
        showToast('❌ 未找到世界书条目', 'warning');
      }
    } catch (error) {
      console.error('Lorebook import failed:', error);
      showToast(`❌ 导入失败: ${error.message}`, 'error');
    } finally {
      setImporting(false);
      setImportProgress('');
      if (lorebookInputRef.current) lorebookInputRef.current.value = '';
    }
  };

  // 删除角色卡
  const handleDeleteCharacter = async () => {
    if (!c) return;
    if (!confirm(`确定删除角色卡「${c.name}」？`)) return;
    try {
      await db.deleteCharacter(c.id);
      ctx.setCharCard(null);
      showToast('角色卡已删除', 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      showToast('删除失败', 'error');
    }
  };

  // 保存编辑
  const handleEditSave = (updated) => {
    ctx.setCharCard(updated);
    setEditing(false);
  };

  // 复制系统提示
  const handleCopySystemPrompt = () => {
    const sp = c.system_prompt || c.systemPrompt;
    if (!sp) { showToast('没有系统提示可复制', 'warning'); return; }
    navigator.clipboard.writeText(sp);
    showToast('系统提示已复制', 'success');
  };

  // ---------- 未导入角色卡 ----------
  if (!c) {
    return h(React.Fragment, null,
      h('header', { className: 'header' },
        h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
        h('span', { className: 'header-title' }, '🎭 角色卡')
      ),
      h('div', { className: 'empty-state' },
        h('div', { className: 'icon' }, '🎭'),
        h('h3', null, '未导入角色卡'),
        h('p', null, '导入 SillyTavern 格式的角色卡'),
        h('div', { style: { marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' } },
          h('div', null,
            h('input', { ref: fileInputRef, type: 'file', accept: '.json,.png', onChange: handleImportCharacter, style: { display: 'none' } }),
            h('button', { className: 'btn btn-primary', onClick: () => fileInputRef.current?.click(), disabled: importing },
              importing ? '导入中...' : '📁 导入角色卡 (JSON/PNG)')
          ),
          h('div', null,
            h('input', { ref: pngInputRef, type: 'file', accept: '.png', onChange: handleImportCharacter, style: { display: 'none' } }),
            h('button', { className: 'btn btn-ghost', onClick: () => pngInputRef.current?.click(), disabled: importing }, '🖼️ 导入 PNG 角色卡')
          ),
          h('div', null,
            h('input', { ref: lorebookInputRef, type: 'file', accept: '.json,.png', onChange: handleImportLorebook, style: { display: 'none' } }),
            h('button', { className: 'btn btn-ghost', onClick: () => lorebookInputRef.current?.click(), disabled: importing }, '📚 导入世界书')
          ),
          importProgress ? h('div', { style: { color: 'var(--text-muted)', fontSize: '0.875rem' } }, importProgress) : null
        )
      )
    );
  }

  // ---------- 编辑模式 ----------
  if (editing) {
    return h(React.Fragment, null,
      h('header', { className: 'header' },
        h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
        h('span', { className: 'header-title' }, '✏️ 编辑角色')
      ),
      h(EditCharacterForm, { card: c, onSave: handleEditSave, onCancel: () => setEditing(false) })
    );
  }

  // ---------- 角色卡详情 ----------
  // 调试日志：检查角色卡数据
  console.log('[CharacterPage] Character data keys:', Object.keys(c));
  console.log('[CharacterPage] c.description:', c.description ? c.description.substring(0, 80) : 'EMPTY');
  console.log('[CharacterPage] c.personality:', c.personality ? c.personality.substring(0, 50) : 'EMPTY');
  console.log('[CharacterPage] c.scenario:', c.scenario ? c.scenario.substring(0, 50) : 'EMPTY');
  console.log('[CharacterPage] c.worldbook length:', c.worldbook ? c.worldbook.length : 0);
  console.log('[CharacterPage] c.avatar:', c.avatar ? c.avatar.substring(0, 50) : 'EMPTY');

  const fields = [
    ['描述', c.description],
    ['性格', c.personality],
    ['场景', c.scenario],
    ['首条消息', c.first_mes || c.firstMessage],
    ['示例对话', c.mes_example || c.exampleDialogue],
    ['作者备注', c.creator_notes || c.creatorNotes],
    ['系统提示', c.system_prompt || c.systemPrompt],
    ['后续指令', c.post_history_instructions],
  ].filter(([_, v]) => v && v.trim());

  const versionBadge = c.character_version || c.extensions?.spec || '';

  return h(React.Fragment, null,
    h('header', { className: 'header' },
      h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
      h('span', { className: 'header-title' }, '🎭 角色卡')
    ),
    h('div', { className: 'cc-panel' },
      // 头像和名称
      h('div', { className: 'card-header' },
        h(AvatarDisplay, { charCard: c, size: 80, borderRadius: 20, fontSize: '2rem' }),
        h('div', { style: { marginLeft: '16px', flex: 1 } },
          h('div', { style: { display: 'flex', alignItems: 'center' } },
            h('div', { className: 'card-name', style: { fontSize: '1.25rem' } }, c.name),
            versionBadge ? h('span', {
              style: { fontSize: '0.75rem', padding: '2px 8px', background: 'var(--accent)', color: 'white', borderRadius: '12px', marginLeft: '8px' }
            }, versionBadge) : null
          ),
          c.creator ? h('div', { style: { fontSize: '0.875rem', color: 'var(--text3)', marginTop: '4px' } }, 'by ' + c.creator) : null,
          c.tags?.length ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' } },
            c.tags.map((t, i) => h('span', { key: i, className: 'tag tag-blue' }, t))
          ) : null
        ),
        // ✏️ 编辑按钮
        h('button', {
          onClick: () => setEditing(true),
          style: {
            width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--glass-border)',
            background: 'transparent', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }
        }, '✏️')
      ),

      // 字段详情
      fields.length > 0 ?
        fields.map(([label, value]) =>
          h('div', { key: label, className: 'cc-field' },
            h('label', null, label),
            h('div', { className: 'value', style: { whiteSpace: 'pre-wrap', maxHeight: label === '系统提示' ? '300px' : 'none', overflow: label === '系统提示' ? 'auto' : 'visible', fontSize: '0.9rem', lineHeight: '1.6' } }, value)
          )
        ) :
        h('div', { style: { textAlign: 'center', color: 'var(--text3)', padding: 20 } }, '暂无详细信息'),

      // 操作按钮
      h('div', { style: { marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' } },
        h('button', { className: 'btn btn-ghost', onClick: handleCopySystemPrompt, style: { flex: 1 } }, '📋 复制提示'),
        h('button', { className: 'btn btn-ghost', onClick: () => fileInputRef.current?.click(), style: { flex: 1 } }, '🔄 重新导入'),
        h('button', { className: 'btn btn-danger', onClick: handleDeleteCharacter, style: { flex: 1 } }, '🗑️ 删除')
      ),
      h('input', { ref: fileInputRef, type: 'file', accept: '.json,.png', onChange: handleImportCharacter, style: { display: 'none' } }),

      // 世界书
      h('div', { style: { marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
          h('h4', { style: { margin: 0 } }, '📚 世界书'),
          h('button', { className: 'btn btn-ghost btn-sm', onClick: () => lorebookInputRef.current?.click(), disabled: importing }, '➕ 导入')
        ),
        ctx.wb && ctx.wb.length > 0 ?
          h('div', { style: { fontSize: '0.875rem', color: 'var(--text-muted)' } }, `已加载 ${ctx.wb.length} 个世界书条目`) :
          h('div', { style: { fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' } }, '暂无世界书条目'),
        h('input', { ref: lorebookInputRef, type: 'file', accept: '.json,.png', onChange: handleImportLorebook, style: { display: 'none' } })
      ),

      // 交替问候语
      c.alternate_greetings?.length > 0 ?
        h('div', { style: { marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' } },
          h('h4', { style: { marginBottom: '12px' } }, '💬 交替问候语'),
          c.alternate_greetings.map((g, i) =>
            h('div', { key: i, style: { padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: '1.6' } }, g)
          )
        ) : null,

      // 扩展信息
      c.extensions && Object.keys(c.extensions).length > 0 ?
        h('div', { style: { marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' } },
          h('h4', { style: { marginBottom: '12px' } }, '🔧 扩展信息'),
          h('pre', { style: { background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', fontSize: '0.75rem', overflow: 'auto', maxHeight: '200px' } }, JSON.stringify(c.extensions, null, 2))
        ) : null
    )
  );
}
