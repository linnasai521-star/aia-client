import React, { useContext, useState } from 'react';
import { Ctx } from '../state.js';
import { encryptStr, decryptStr } from '../utils/crypto.js';
import { createProvider, getProviderList, PRESETS } from '../providers/registry.js';
import { genId, showToast } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

export function SettingsPage() {
  const ctx = useContext(Ctx);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelList, setModelList] = useState([]);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [newKW, setNewKW] = useState('');
  const [newWC, setNewWC] = useState('');

  const s = ctx.settings;
  const providerList = getProviderList();

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      let key = keyInput || s.apiKey;
      if (!key && s.encryptedKey && s._sessionPin) {
        key = await decryptStr(s.encryptedKey, s._sessionPin);
      }
      if (!key) throw new Error('请先填写 API Key');
      
      // 自动补全 API 地址
      let apiUrl = s.apiUrl || '';
      if (!apiUrl.includes('/v1') && !apiUrl.includes('/chat/completions')) {
        apiUrl = apiUrl.replace(/\/$/, '') + '/v1';
        ctx.saveSetting('apiUrl', apiUrl);
      }
      
      const p = createProvider(s.provider || 'openai', { apiUrl, apiKey: key, model: s.model });
      const list = await p.listModels();
      setTestResult({ ok: true, msg: `连接成功！发现 ${list.length} 个模型。` });
      setModelList(list);
    } catch (err) {
      let errorMsg = err.message;
      if (errorMsg.includes('404')) {
        errorMsg = 'HTTP 404 - API地址可能不正确。请检查地址是否以 /v1 结尾，或是否需要完整路径如 /v1/chat/completions';
      }
      setTestResult({ ok: false, msg: errorMsg });
    }
    setTestLoading(false);
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setModelList([]);
    try {
      let key = keyInput || s.apiKey;
      if (!key && s.encryptedKey && s._sessionPin) {
        key = await decryptStr(s.encryptedKey, s._sessionPin);
      }
      if (!key) throw new Error('请先填写 API Key');
      
      let apiUrl = s.apiUrl || '';
      if (!apiUrl.includes('/v1') && !apiUrl.includes('/chat/completions')) {
        apiUrl = apiUrl.replace(/\/$/, '') + '/v1';
        ctx.saveSetting('apiUrl', apiUrl);
      }
      
      const p = createProvider(s.provider || 'openai', { apiUrl, apiKey: key, model: s.model });
      const list = await p.listModels();
      setModelList(list);
      showToast(`获取到 ${list.length} 个模型`, 'success');
    } catch (err) {
      showToast('获取模型列表失败: ' + err.message, 'error');
    }
    setFetchingModels(false);
  };

  const handleSaveKey = async () => {
    if (!keyInput) return;
    if (s.pinHash) {
      if (!s._sessionPin) { showToast('请先解锁 PIN', 'error'); return; }
      const enc = await encryptStr(keyInput, s._sessionPin);
      ctx.saveSetting('encryptedKey', enc);
      ctx.saveSetting('apiKey', '');
    } else {
      ctx.saveSetting('apiKey', keyInput);
    }
    showToast('API Key 已保存', 'success');
    setKeyInput('');
  };

  const addWBEntry = async () => {
    if (!newWC.trim()) return;
    const entry = {
      id: genId(), convId: '_global',
      keywords: newKW.split(',').map(x => x.trim()).filter(Boolean),
      content: newWC, constant: false, enabled: true, priority: 3,
    };
    await db.putWorldBookEntry(entry);
    ctx.setWB(w => [...w, entry]);
    setNewKW(''); setNewWC('');
  };

  const delWBEntry = async (id) => {
    await db.deleteWorldBookEntry(id);
    ctx.setWB(w => w.filter(e => e.id !== id));
  };

  const toggleConst = async (entry) => {
    entry.constant = !entry.constant;
    await db.putWorldBookEntry(entry);
    ctx.setWB(w => w.map(e => e.id === entry.id ? { ...e, constant: entry.constant } : e));
  };

  const handleBackgroundChange = (bg) => {
    ctx.saveSetting('customBackground', bg);
  };

  return h(React.Fragment, null,
    h('header', { className: 'header' },
      h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setPage('chat') }, '←'),
      h('span', { className: 'header-title' }, '⚙️ 设置')
    ),
    h('div', { className: 'settings-page' },
      h('div', { className: 'settings-inner' },
        // API Config - Custom API Section
        h('div', { className: 'section' },
          h('div', { className: 'section-title' }, '🔌 自定义 API 配置'),
          
          // Provider 预设
          h('div', { className: 'field' },
            h('label', null, '快速选择（可选）'),
            h('select', { 
              value: s.provider || 'custom', 
              onChange: e => {
                ctx.saveSetting('provider', e.target.value);
                const preset = PRESETS[e.target.value];
                if (preset) {
                  ctx.saveSetting('apiUrl', preset.apiUrl);
                  ctx.saveSetting('model', preset.model);
                } else if (e.target.value === 'custom') {
                  // 清空，让用户自己填
                }
              }
            }, [
              ...providerList.map(p => h('option', { key: p.id, value: p.id }, p.name)),
              h('option', { key: 'custom', value: 'custom' }, '🔧 自定义')
            ])
          ),
          
          // API 地址
          h('div', { className: 'field' },
            h('label', null, 'API 地址（必填）'),
            h('input', { 
              value: s.apiUrl || '', 
              onChange: e => ctx.saveSetting('apiUrl', e.target.value), 
              placeholder: 'https://api.openai.com/v1',
              style: { fontSize: '16px' } // 防止 iOS 缩放
            }),
            h('div', { className: 'field-hint' }, 
              '例如: https://api.openai.com/v1 或 https://your-proxy.com/v1'
            )
          ),
          
          // API Key
          h('div', { className: 'field' },
            h('label', null, 'API Key（必填）'),
            h('div', { style: { display: 'flex', gap: 8 } },
              h('input', { 
                type: showKey ? 'text' : 'password', 
                value: keyInput, 
                onChange: e => setKeyInput(e.target.value), 
                placeholder: 'sk-...',
                style: { fontSize: '16px' } // 防止 iOS 缩放
              }),
              h('button', { 
                className: 'btn-icon', 
                onClick: () => setShowKey(!showKey) 
              }, showKey ? '🙈' : '👁')
            ),
            h('div', { style: { display: 'flex', gap: 8, marginTop: 8 } },
              h('button', { 
                className: 'btn btn-primary', 
                onClick: handleSaveKey, 
                disabled: !keyInput 
              }, '💾 保存 Key'),
              h('button', { 
                className: 'btn btn-ghost', 
                onClick: handleTest, 
                disabled: testLoading 
              }, testLoading ? '⏳ 测试中...' : '🔍 测试连接'),
              h('button', { 
                className: 'btn btn-ghost', 
                onClick: handleFetchModels, 
                disabled: fetchingModels 
              }, fetchingModels ? '⏳ 获取中...' : '📋 获取模型')
            ),
            testResult ? h('div', { 
              className: testResult.ok ? 'test-ok' : 'test-err' 
            }, testResult.msg) : null
          ),
          
          // 模型列表显示
          modelList.length > 0 ? h('div', { className: 'field' },
            h('label', null, '可用模型列表'),
            h('div', { className: 'model-list', style: { maxHeight: 200, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 8 } },
              modelList.map((model, i) => h('div', { 
                key: i, 
                className: 'model-item',
                style: { padding: '4px 8', cursor: 'pointer', borderBottom: i < modelList.length - 1 ? '1px solid var(--glass-border)' : 'none' },
                onClick: () => {
                  ctx.saveSetting('model', model.id || model.name);
                  showToast(`已选择模型: ${model.id || model.name}`, 'success');
                }
              }, model.id || model.name))
            )
          ) : null,
          
          // 模型
          h('div', { className: 'field' },
            h('label', null, '模型名称'),
            h('input', { 
              value: s.model || '', 
              onChange: e => ctx.saveSetting('model', e.target.value), 
              placeholder: 'gpt-4o, deepseek-chat, claude-3-sonnet',
              style: { fontSize: '16px' }
            }),
            h('div', { className: 'field-hint' }, 
              '输入你要使用的模型名称，例如: gpt-4o, deepseek-chat'
            )
          )
        ),
        
        // 背景设置
        h('div', { className: 'section' },
          h('div', { className: 'section-title' }, '🎨 背景设置'),
          h('div', { className: 'field' },
            h('label', null, '自定义背景'),
            h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              [
                { label: '默认深色', value: '' },
                { label: '星空', value: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
                { label: '森林', value: 'linear-gradient(135deg, #134e5e, #71b280)' },
                { label: '海洋', value: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
                { label: '日落', value: 'linear-gradient(135deg, #ff7e5f, #feb47b)' },
                { label: '极光', value: 'linear-gradient(135deg, #00c6ff, #0072ff)' }
              ].map(bg => h('button', {
                key: bg.value,
                className: `btn btn-ghost ${s.customBackground === bg.value ? 'active' : ''}`,
                onClick: () => handleBackgroundChange(bg.value),
                style: { 
                  background: bg.value || 'var(--bg-secondary)',
                  color: 'white',
                  minWidth: 80,
                  height: 40,
                  border: s.customBackground === bg.value ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)'
                }
              }, bg.label))
            )
          ),
          h('div', { className: 'field' },
            h('label', null, '自定义背景色'),
            h('input', { 
              type: 'color', 
              value: s.customBackgroundColor || '#0f1115',
              onChange: e => ctx.saveSetting('customBackgroundColor', e.target.value),
              style: { width: '100%', height: 40, border: 'none', borderRadius: 8 }
            })
          )
        ),
        
        // Parameters
        h('div', { className: 'section' },
          h('div', { className: 'section-title' }, '🎛️ 生成参数'),
          h('div', { className: 'field' }, h('div', { className: 'range-row' },
            h('label', null, 'Max Tokens'), h('input', { type: 'range', min: 256, max: 128000, step: 256, value: s.maxTokens || 4096, onChange: e => ctx.saveSetting('maxTokens', e.target.value) }),
            h('span', { className: 'range-val' }, s.maxTokens || 4096)
          )),
          h('div', { className: 'field' }, h('div', { className: 'range-row' },
            h('label', null, 'Temperature'), h('input', { type: 'range', min: 0, max: 2, step: 0.05, value: s.temperature ?? 0.7, onChange: e => ctx.saveSetting('temperature', e.target.value) }),
            h('span', { className: 'range-val' }, s.temperature ?? 0.7)
          )),
          h('div', { className: 'field' }, h('div', { className: 'range-row' },
            h('label', null, 'Top P'), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.topP ?? 1, onChange: e => ctx.saveSetting('topP', e.target.value) }),
            h('span', { className: 'range-val' }, s.topP ?? 1)
          )),
          h('div', { className: 'toggle-row' }, h('label', null, '流式输出'),
            h('div', { className: `toggle ${s.stream !== false ? 'on' : ''}`, onClick: () => ctx.saveSetting('stream', s.stream === false ? true : false) })
          ),
          h('div', { className: 'field' },
            h('label', null, '系统提示词'),
            h('textarea', { value: s.systemPrompt || '', onChange: e => ctx.saveSetting('systemPrompt', e.target.value), placeholder: 'You are a helpful assistant.', rows: 4 })
          )
        ),
        // Security
        h('div', { className: 'section' },
          h('div', { className: 'section-title' }, '🔒 安全'),
          h('div', { className: 'toggle-row' }, h('label', null, '启用 PIN 锁定'),
            h('div', { className: `toggle ${s.pinHash ? 'on' : ''}`, onClick: () => {
              if (s.pinHash) {
                ctx.saveSetting('pinHash', null); ctx.saveSetting('encryptedKey', null);
                ctx.setPinHash(null); showToast('PIN 已移除', 'success');
              } else { ctx.setLocked(true); }
            } })
          ),
          h('div', { className: 'field-hint' }, s.pinHash ? 'API Key 已加密存储' : 'API Key 明文存储')
        ),
        // World Book
        h('div', { className: 'section' },
          h('div', { className: 'section-title' }, '📚 世界书'),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 } },
            h('input', { value: newKW, onChange: e => setNewKW(e.target.value), placeholder: '关键词（逗号分隔）' }),
            h('textarea', { value: newWC, onChange: e => setNewWC(e.target.value), rows: 3, placeholder: '条目内容...' }),
            h('button', { className: 'btn btn-primary', onClick: addWBEntry, style: { alignSelf: 'flex-start' } }, '+ 添加')
          ),
          ctx.wb.map(e => h('div', { key: e.id, className: 'wb-entry' },
            h('div', { className: 'tags' },
              (e.keywords || []).map((k, i) => h('span', { key: i, className: 'tag tag-blue' }, k)),
              e.constant ? h('span', { className: 'tag tag-yellow' }, '常驻') : null
            ),
            h('div', { className: 'content' }, e.content),
            h('div', { className: 'actions' },
              h('button', { className: 'btn-icon', onClick: () => toggleConst(e) }, e.constant ? '📌' : '📍'),
              h('button', { className: 'btn-icon', onClick: () => delWBEntry(e.id) }, '✕')
            )
          )),
          ctx.wb.length === 0 ? h('div', { style: { textAlign: 'center', color: 'var(--text3)', padding: 16, fontSize: 13 } }, '暂无条目') : null
        ),
        h('div', { style: { textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12 } },
          h('p', null, 'AI Aggregator v3.0'),
          h('p', null, 'Modular · IndexedDB · AES-GCM · SSE Parser')
        )
      )
    )
  );
}