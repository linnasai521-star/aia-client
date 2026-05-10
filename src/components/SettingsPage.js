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
      const p = createProvider(s.provider || 'openai', { apiUrl: s.apiUrl, apiKey: key, model: s.model });
      const list = await p.listModels();
      setTestResult({ ok: true, msg: `连接成功！发现 ${list.length} 个模型。` });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    }
    setTestLoading(false);
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

  return h(React.Fragment, null,
    h('header', { className: 'header' },
      h('button', { className: 'btn-icon menu-btn', onClick: () => ctx.setSidebar(true) }, '☰'),
      h('span', { className: 'header-title' }, '⚙️ 设置')
    ),
    h('div', { className: 'settings-page' },
      h('div', { className: 'settings-inner' },
        // API Config
        h('div', { className: 'section' },
          h('div', { className: 'section-title' }, '🔌 API 配置'),
          h('div', { className: 'field' },
            h('label', null, 'Provider'),
            h('select', { value: s.provider || 'openai', onChange: e => {
              ctx.saveSetting('provider', e.target.value);
              const preset = PRESETS[e.target.value];
              if (preset && !s.apiUrl) {
                ctx.saveSetting('apiUrl', preset.apiUrl);
                ctx.saveSetting('model', preset.model);
              }
            }}, providerList.map(p => h('option', { key: p.id, value: p.id }, p.name)))
          ),
          h('div', { className: 'field' },
            h('label', null, 'API 地址'),
            h('input', { value: s.apiUrl || '', onChange: e => ctx.saveSetting('apiUrl', e.target.value), placeholder: 'https://api.openai.com' })
          ),
          h('div', { className: 'field' },
            h('label', null, 'API Key'),
            h('div', { style: { display: 'flex', gap: 8 } },
              h('input', { type: showKey ? 'text' : 'password', value: keyInput, onChange: e => setKeyInput(e.target.value), placeholder: s.encryptedKey ? '已加密，输入新的可替换' : 'sk-...' }),
              h('button', { className: 'btn-icon', onClick: () => setShowKey(!showKey) }, showKey ? '🙈' : '👁')
            ),
            h('div', { style: { display: 'flex', gap: 8, marginTop: 8 } },
              h('button', { className: 'btn btn-primary', onClick: handleSaveKey, disabled: !keyInput }, '保存 Key'),
              h('button', { className: 'btn btn-ghost', onClick: handleTest, disabled: testLoading }, testLoading ? '⏳ 测试中...' : '🔍 测试连接')
            ),
            testResult ? h('div', { className: testResult.ok ? 'test-ok' : 'test-err' }, testResult.msg) : null
          ),
          h('div', { className: 'field' },
            h('label', null, '模型'),
            ctx.models.length > 0
              ? h('select', { value: s.model || '', onChange: e => ctx.saveSetting('model', e.target.value) },
                  h('option', { value: '' }, '选择模型...'),
                  ctx.models.map(m => h('option', { key: m, value: m }, m))
                )
              : h('input', { value: s.model || '', onChange: e => ctx.saveSetting('model', e.target.value), placeholder: 'gpt-4o / claude-3-sonnet...' })
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