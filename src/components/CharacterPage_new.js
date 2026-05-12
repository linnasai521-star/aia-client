import React, { useContext, useRef, useState } from 'react';
import { Ctx } from '../state.js';
import { showToast } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';
import { parsePngCharacterCard, isSillyTavernCharacterCard, getCharacterCardVersion } from '../utils/pngParser.js';

const h = React.createElement;

export function CharacterPage() {
  const ctx = useContext(Ctx);
  const c = ctx.charCard;
  const fileInputRef = useRef(null);
  const pngInputRef = useRef(null);
  const lorebookInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  
  // 导入角色卡（支持PNG和JSON）
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
      // 清理文件输入
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
        setImportProgress('导入完成！');
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
  
  // 复制系统提示
  const handleCopySystemPrompt = () => {
    if (!c?.system_prompt) {
      showToast('没有系统提示可复制', 'warning');
      return;
    }
    navigator.clipboard.writeText(c.system_prompt);
    showToast('系统提示已复制', 'success');
  };
  
  // 显示角色卡版本信息
  const renderVersionBadge = () => {
    if (!c?.extensions) return null;
    
    let version = '标准格式';
    if (c.character_version) {
      version = `v${c.character_version}`;
    } else if (c.extensions.spec) {
      version = c.extensions.spec;
    }
    
    return h('span', {
      style: {
        fontSize: '0.75rem',
        padding: '2px 8px',
        background: 'var(--accent)',
        color: 'white',
        borderRadius: '12px',
        marginLeft: '8px'
      }
    }, version);
  };
  
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
          // JSON导入
          h('div', null,
            h('input', {
              ref: fileInputRef,
              type: 'file',
              accept: '.json,.png',
              onChange: handleImportCharacter,
              style: { display: 'none' }
            }),
            h('button', {
              className: 'btn btn-primary',
              onClick: () => fileInputRef.current?.click(),
              disabled: importing
            }, importing ? '导入中...' : '📁 导入角色卡 (JSON/PNG)')
          ),
          
          // PNG专用导入
          h('div', null,
            h('input', {
              ref: pngInputRef,
              type: 'file',
              accept: '.png',
              onChange: handleImportCharacter,
              style: { display: 'none' }
            }),
            h('button', {
              className: 'btn btn-ghost',
              onClick: () => pngInputRef.current?.click(),
              disabled: importing
            }, '🖼️ 导入 PNG 角色卡')
          ),
          
          // 世界书导入
          h('div', null,
            h('input', {
              ref: lorebookInputRef,
              type: 'file',
              accept: '.json,.png',
              onChange: handleImportLorebook,
              style: { display: 'none' }
            }),
            h('button', {
              className: 'btn btn-ghost',
              onClick: () => lorebookInputRef.current?.click(),
              disabled: importing
            }, '📚 导入世界书')
          ),
          
          // 进度显示
          importProgress ? h('div', { style: { color: 'var(--text-muted)', fontSize: '0.875rem' } }, importProgress) : null
        )
      )
    );
  }
  
  // 角色卡字段
  const fields = [
    ['描述', c.description],
    ['性格', c.personality],
    ['场景', c.scenario],
    ['首条消息', c.first_mes],
    ['示例对话', c.mes_example],
    ['作者备注', c.creator_notes],
    ['系统提示', c.system_prompt],
    ['后续指令', c.post_history_instructions],
  ].filter(([_, v]) => v && v.trim());
  
  return h(React.Fragment, null,
    h('header', { className: 'header' },
      h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
      h('span', { className: 'header-title' }, '🎭 角色卡')
    ),
    h('div', { className: 'cc-panel' },
      // 角色头像和名称
      h('div', { className: 'card-header' },
        c.avatar ? 
          h('img', { 
            src: c.avatar, 
            alt: c.name,
            style: { 
              width: 80, 
              height: 80, 
              borderRadius: 20, 
              objectFit: 'cover',
              border: '3px solid var(--accent)'
            },
            onError: (e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }
          }) : null,
        h('div', { 
          className: 'card-avatar',
          style: c.avatar ? { display: 'none' } : { width: 80, height: 80 }
        }, c.name?.[0] || '?'),
        h('div', { style: { marginLeft: '16px' } },
          h('div', { className: 'card-name', style: { fontSize: '1.25rem' } }, c.name),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' } },
            c.creator ? h('span', { style: { fontSize: '0.875rem', color: 'var(--text3)' } }, 'by ' + c.creator) : null,
            renderVersionBadge()
          ),
          c.tags?.length ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' } },
            c.tags.map((t, i) => h('span', { key: i, className: 'tag tag-blue' }, t))
          ) : null
        )
      ),
      
      // 详细信息
      fields.length > 0 ? 
        fields.map(([label, value]) =>
          h('div', { key: label, className: 'cc-field' },
            h('label', null, label),
            h('div', { 
              className: 'value',
              style: { 
                whiteSpace: 'pre-wrap',
                maxHeight: label === '系统提示' ? '300px' : 'none',
                overflow: label === '系统提示' ? 'auto' : 'visible',
                fontSize: '0.9rem',
                lineHeight: '1.6'
              }
            }, value)
          )
        ) :
        h('div', { style: { textAlign: 'center', color: 'var(--text3)', padding: 20 } }, '暂无详细信息'),
      
      // 操作按钮
      h('div', { style: { marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' } },
        h('button', {
          className: 'btn btn-ghost',
          onClick: handleCopySystemPrompt,
          style: { flex: 1 }
        }, '📋 复制系统提示'),
        
        h('button', {
          className: 'btn btn-ghost',
          onClick: () => fileInputRef.current?.click(),
          style: { flex: 1 }
        }, '🔄 重新导入'),
        
        h('button', {
          className: 'btn btn-danger',
          onClick: handleDeleteCharacter,
          style: { flex: 1 }
        }, '🗑️ 删除角色')
      ),
      
      // 导入新角色卡（隐藏）
      h('input', {
        ref: fileInputRef,
        type: 'file',
        accept: '.json,.png',
        onChange: handleImportCharacter,
        style: { display: 'none' }
      }),
      
      // 世界书导入
      h('div', { style: { marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
          h('h4', { style: { margin: 0 } }, '📚 世界书'),
          h('button', {
            className: 'btn btn-ghost btn-sm',
            onClick: () => lorebookInputRef.current?.click(),
            disabled: importing
          }, '➕ 导入世界书')
        ),
        
        // 显示世界书条目数量
        ctx.wb && ctx.wb.length > 0 ? 
          h('div', { style: { fontSize: '0.875rem', color: 'var(--text-muted)' } },
            `已加载 ${ctx.wb.length} 个世界书条目`
          ) :
          h('div', { style: { fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' } },
            '暂无世界书条目'
          ),
        
        // 世界书导入输入
        h('input', {
          ref: lorebookInputRef,
          type: 'file',
          accept: '.json,.png',
          onChange: handleImportLorebook,
          style: { display: 'none' }
        })
      ),
      
      // 交替问候语
      c.alternate_greetings && c.alternate_greetings.length > 0 ?
        h('div', { style: { marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' } },
          h('h4', { style: { marginBottom: '12px' } }, '💬 交替问候语'),
          c.alternate_greetings.map((greeting, index) =>
            h('div', {
              key: index,
              style: {
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                marginBottom: '8px',
                whiteSpace: 'pre-wrap',
                fontSize: '0.9rem',
                lineHeight: '1.6'
              }
            }, greeting)
          )
        ) : null,
      
      // 扩展信息
      c.extensions && Object.keys(c.extensions).length > 0 ?
        h('div', { style: { marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' } },
          h('h4', { style: { marginBottom: '12px' } }, '🔧 扩展信息'),
          h('pre', {
            style: {
              background: 'var(--bg-secondary)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              overflow: 'auto',
              maxHeight: '200px'
            }
          }, JSON.stringify(c.extensions, null, 2))
        ) : null,
      
      // 进度显示
      importProgress ? 
        h('div', {
          style: {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-primary)',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            color: 'var(--text-primary)'
          }
        }, importProgress) : null
    )
  );
}
