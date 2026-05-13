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
      h('div', { className: 'empty-state char-card' },
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
              className: 'empty-btn',
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
              className: 'empty-btn',
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
              className: 'empty-btn',
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
  
  // 预览文本取第一项
  const previewField = fields.length > 0 ? fields[0] : null;
  
  return h(React.Fragment, null,
    h('header', { className: 'header' },
      h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
      h('span', { className: 'header-title' }, '🎭 角色卡')
    ),
    h('div', { className: 'cc-panel char-card' },
      // 卡片头部：头像 + 名称 + 标签
      h('div', { className: 'char-card-header' },
        c.avatar ? 
          h('img', { 
            src: c.avatar, 
            alt: c.name,
            className: 'char-card-avatar',
            onError: (e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }
          }) : h('div', { 
            className: 'char-card-avatar',
            style: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(167,139,250,0.15)', fontSize: '24px', color: '#a78bfa' }
          }, c.name?.[0] || '?'),
        h('div', { className: 'char-card-info' },
          h('div', { className: 'char-card-name' }, c.name),
          c.creator ? h('div', { style: { fontSize: '12px', color: 'var(--text-sub)', marginBottom: '4px' } }, 'by ' + c.creator) : null,
          c.tags?.length ? h('div', { className: 'char-card-tags' },
            c.tags.map((t, i) => h('span', { key: i, className: 'char-tag' }, t))
          ) : null
        )
      ),
      
      // 预览描述
      previewField ? h('div', { className: 'char-card-preview' }, previewField[1]) : 
        h('div', { className: 'char-card-preview', style: { color: '#b0a4c8', fontStyle: 'italic' } }, '暂无描述'),
      
      // 底部信息
      h('div', { className: 'char-card-footer' },
        h('span', { className: 'char-card-time' }, 
          c.create_time ? '🕐 ' + new Date(c.create_time).toLocaleDateString() : '🕐 最近使用'
        ),
        h('span', { className: 'char-card-fav' }, '❤️')
      ),
      
      // 详细信息（可折叠/展开）
      fields.length > 1 ?
        h('details', { style: { marginTop: '12px', borderTop: '1px solid rgba(200,180,220,0.1)', paddingTop: '12px' } },
          h('summary', { style: { cursor: 'pointer', fontSize: '14px', color: '#a78bfa', fontWeight: 500 } }, '📋 查看完整角色信息'),
          h('div', { style: { marginTop: '12px' } },
            fields.slice(1).map(([label, value]) =>
              h('div', { key: label, style: {
                marginBottom: '12px',
                background: 'rgba(255,255,255,0.4)',
                borderRadius: '12px',
                padding: '12px'
              }},
                h('label', { style: { fontSize: '12px', color: '#a78bfa', fontWeight: 600, display: 'block', marginBottom: '4px' } }, label),
                h('div', { style: { 
                  whiteSpace: 'pre-wrap',
                  maxHeight: label === '系统提示' ? '200px' : 'none',
                  overflow: label === '系统提示' ? 'auto' : 'visible',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#5b4a7a'
                }}, value)
              )
            )
          )
        ) : null,
      
      // 操作按钮
      h('div', { style: { marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' } },
        h('button', {
          className: 'empty-btn',
          onClick: handleCopySystemPrompt,
          style: { flex: 1, fontSize: '13px', padding: '10px 12px', border: 'none' }
        }, '📋 复制系统提示'),
        
        h('button', {
          className: 'empty-btn',
          onClick: () => fileInputRef.current?.click(),
          style: { flex: 1, fontSize: '13px', padding: '10px 12px', border: 'none' }
        }, '🔄 重新导入'),
        
        h('button', {
          className: 'empty-btn',
          onClick: handleDeleteCharacter,
          style: { flex: 1, fontSize: '13px', padding: '10px 12px', border: 'none', color: '#e85d75' }
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
      h('div', { style: { marginTop: '16px', borderTop: '1px solid rgba(200,180,220,0.1)', paddingTop: '16px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
          h('h4', { style: { margin: 0, color: '#3a2a5a', fontSize: '15px' } }, '📚 世界书'),
          h('button', {
            className: 'empty-btn',
            onClick: () => lorebookInputRef.current?.click(),
            disabled: importing,
            style: { padding: '6px 14px', fontSize: '12px', border: 'none' }
          }, '➕ 导入')
        ),
        
        ctx.wb && ctx.wb.length > 0 ? 
          h('div', { style: { fontSize: '13px', color: '#6b5b8a' } },
            `已加载 ${ctx.wb.length} 个世界书条目`
          ) :
          h('div', { style: { fontSize: '13px', color: '#b0a4c8', fontStyle: 'italic' } },
            '暂无世界书条目'
          ),
        
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
        h('details', { style: { marginTop: '16px', borderTop: '1px solid rgba(200,180,220,0.1)', paddingTop: '12px' } },
          h('summary', { style: { cursor: 'pointer', fontSize: '14px', color: '#a78bfa', fontWeight: 500 } }, '💬 交替问候语'),
          h('div', { style: { marginTop: '8px' } },
            c.alternate_greetings.map((greeting, index) =>
              h('div', { key: index, style: {
                padding: '12px',
                background: 'rgba(255,255,255,0.4)',
                borderRadius: '12px',
                marginBottom: '8px',
                whiteSpace: 'pre-wrap',
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#5b4a7a'
              }}, greeting)
            )
          )
        ) : null,
      
      // 扩展信息
      c.extensions && Object.keys(c.extensions).length > 0 ?
        h('details', { style: { marginTop: '16px', borderTop: '1px solid rgba(200,180,220,0.1)', paddingTop: '12px' } },
          h('summary', { style: { cursor: 'pointer', fontSize: '14px', color: '#a78bfa', fontWeight: 500 } }, '🔧 扩展信息'),
          h('pre', { style: {
            background: 'rgba(255,255,255,0.4)',
            padding: '12px',
            borderRadius: '12px',
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '160px',
            color: '#6b5b8a'
          }}, JSON.stringify(c.extensions, null, 2))
        ) : null,
      
      // 进度显示
      importProgress ? 
        h('div', {
          style: {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(16px)',
            padding: '12px 24px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(170,130,220,0.15)',
            zIndex: 1000,
            color: '#3a2a5a'
          }
        }, importProgress) : null
    )
  );
}
