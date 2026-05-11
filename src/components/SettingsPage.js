import React, { useContext, useState } from 'react';
import { Ctx } from '../state.js';
import { encryptStr, decryptStr } from '../utils/crypto.js';
import { createProvider, getProviderList } from '../providers/registry.js';
import { normalizeBaseURL } from '../providers/baseProvider.js';
import { showToast } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

const PROVIDER_MODELS = {
  openai:      ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  deepseek:    ['deepseek-chat', 'deepseek-reasoner'],
  claude:      ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  gemini:      ['gemini-2.0-flash', 'gemini-1.5-pro'],
  openrouter:  ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash'],
  siliconflow: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct'],
};

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

  const handleProviderChange = (val) => {
    ctx.saveSetting('provider', val);
    const preset = providerList.find(p => p.id === val);
    if (preset) {
      ctx.saveSetting('apiUrl', preset.apiUrl);
      ctx.saveSetting('model', '');
    }
  };

  const handleApiUrlChange = (val) => {
    // 如果是域名补全协议
    let v = val.trim();
    if (v && !v.startsWith('http://') && !v.startsWith('https://') && v.includes('.')) {
      v = 'https://' + v;
    }
    ctx.saveSetting('apiUrl', v);
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      let key = keyInput || s.apiKey;
      if (!key && s.encryptedKey && s._sessionPin) {
        key = await decryptStr(s.encryptedKey, s._sessionPin);
      }
      if (!key) throw new Error('请先填写 API Key');
      
      let apiUrl = s.apiUrl || '';
      // 自动修复常见问题
      const normalized = normalizeBaseURL(apiUrl);
      if (normalized !== apiUrl) {
        apiUrl = normalized;
        ctx.saveSetting('apiUrl', apiUrl);
        showToast('已自动修复 API 地址格式', 'success');
      }
      
      const p = createProvider(s.provider || 'openai', { apiUrl, apiKey: key, model: s.model || 'gpt-4o' });
      const list = await p.listModels();
      setTestResult({ ok: true, msg: `连接成功！发现 ${list.length} 个可用模型。` });
      setModelList(list);
    } catch (err) {
      const msg = err.message;
      let friendly = msg;
      if (msg.includes('404') || msg.includes('not found')) friendly = '无法连接到接口，请检查 API 地址是否正确。';
      else if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) friendly = 'API Key 无效，请检查密钥。';
      else if (msg.includes('429')) friendly = '请求过于频繁，请稍后重试。';
      else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) friendly = '网络连接失败，请检查地址或网络。';
      setTestResult({ ok: false, msg: friendly });
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
      apiUrl = normalizeBaseURL(apiUrl);
      if (apiUrl !== s.apiUrl) ctx.saveSetting('apiUrl', apiUrl);
      
      const p = createProvider(s.provider || 'openai', { apiUrl, apiKey: key, model: s.model || 'gpt-4o' });
      const list = await p.listModels();
      setModelList(list);
      setTestResult({ ok: true, msg: `获取到 ${list.length} 个模型。` });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    }
    setFetchingModels(false);
  };

  const recommendedModels = PROVIDER_MODELS[s.provider] || [];

  return h('div', { className: 'settings-page' },
    h('div', { className: 'settings-container' },
      // 标题
      h('div', { className: 'settings-header' },
        h('button', { className: 'back-btn', onClick: () => ctx.setPage('chat') }, '← 返回'),
        h('h2', null, '设置')
      ),

      // Provider 选择
      h('div', { className: 'setting-group' },
        h('label', null, '选择服务商'),
        h('select', {
          value: s.provider || 'custom',
          onChange: e => handleProviderChange(e.target.value),
          className: 'setting-select'
        },
          h('option', { value: 'custom' }, '自定义'),
          ...providerList.map(p => h('option', { key: p.id, value: p.id }, p.name))
        ),
        s.provider && s.provider !== 'custom' &&
          h('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' } },
            `已自动填写 ${providerList.find(p=>p.id===s.provider)?.name} 的地址`
          )
      ),

      // API 地址
      h('div', { className: 'setting-group' },
        h('label', null, 'API 地址'),
        h('div', { style: { position: 'relative' } },
          h('input', {
            value: s.apiUrl || '',
            onChange: e => handleApiUrlChange(e.target.value),
            placeholder: 'https://api.deepseek.com',
            className: 'setting-input',
            style: { paddingRight: '40px' }
          }),
          s.apiUrl && s.apiUrl.includes('/chat/completions') &&
            h('div', { style: {
              fontSize: '0.6875rem', color: '#fbbf24', marginTop: '2px'
            }}, '检测到完整端点，系统已自动简化地址。')
        ),
        h('div', { style: { fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' } },
          '只需填写基础域名，如 api.deepseek.com'
        )
      ),

      // API Key
      h('div', { className: 'setting-group' },
        h('label', null, 'API Key'),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('input', {
            type: showKey ? 'text' : 'password',
            value: keyInput || (s.encryptedKey ? '••••••••' : ''),
            onChange: e => setKeyInput(e.target.value),
            placeholder: 'sk-...',
            className: 'setting-input',
            style: { flex: 1 }
          }),
          h('button', {
            className: 'setting-btn small',
            onClick: () => setShowKey(!showKey)
          }, showKey ? '隐藏' : '显示')
        )
      ),

      // 模型
      h('div', { className: 'setting-group' },
        h('label', null, '模型'),
        h('input', {
          value: s.model || '',
          onChange: e => ctx.saveSetting('model', e.target.value),
          placeholder: recommendedModels[0] || 'gpt-4o, deepseek-chat, ...',
          className: 'setting-input',
          list: 'model-suggest'
        }),
        h('datalist', { id: 'model-suggest' },
          ...recommendedModels.map(m => h('option', { key: m, value: m }))
        ),
        recommendedModels.length > 0 && h('div', { style: { fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' } },
          `推荐: ${recommendedModels.slice(0,3).join(', ')}`
        )
      ),

      // 测试连接
      h('div', { className: 'setting-group' },
        h('div', { style: { display: 'flex', gap: '8px' } },
          h('button', {
            className: 'setting-btn primary',
            onClick: handleTest,
            disabled: testLoading
          }, testLoading ? '测试中...' : '测试连接'),
          h('button', {
            className: 'setting-btn',
            onClick: handleFetchModels,
            disabled: fetchingModels
          }, fetchingModels ? '获取中...' : '获取模型列表')
        ),
        testResult && h('div', {
          style: {
            marginTop: '8px', padding: '10px 14px',
            borderRadius: '12px', fontSize: '0.8125rem',
            background: testResult.ok ? 'rgba(74, 222, 128, 0.06)' : 'rgba(248, 113, 113, 0.06)',
            border: '1px solid ' + (testResult.ok ? 'rgba(74, 222, 128, 0.12)' : 'rgba(248, 113, 113, 0.12)'),
            color: testResult.ok ? 'var(--text-primary)' : 'var(--text-secondary)'
          }
        }, testResult.msg),
        modelList.length > 0 && h('div', { style: { marginTop: '8px', maxHeight: '200px', overflowY: 'auto' } },
          ...modelList.map(m => h('div', {
            key: m,
            style: {
              padding: '4px 8px', fontSize: '0.75rem',
              cursor: 'pointer', borderRadius: '6px',
              color: 'var(--text-muted)',
            },
            onClick: () => { ctx.saveSetting('model', m); showToast('已选择: ' + m); }
          }, m))
        )
      ),

      // 系统提示词
      h('div', { className: 'setting-group' },
        h('label', null, '系统提示词'),
        h('textarea', {
          value: s.systemPrompt || '',
          onChange: e => ctx.saveSetting('systemPrompt', e.target.value),
          placeholder: '设置角色的行为规则和性格描述...',
          rows: 4,
          className: 'setting-textarea'
        })
      ),

      // 保存按钮
      h('button', {
        className: 'setting-btn primary',
        style: { width: '100%', marginTop: '16px' },
        onClick: async () => {
          try {
            if (keyInput) {
              const pin = prompt('设置一个记忆密码（用于加密存储）：');
              if (pin) {
                const encrypted = await encryptStr(keyInput, pin);
                ctx.saveSetting('encryptedKey', encrypted);
                ctx.saveSetting('_sessionPin', pin);
                setKeyInput('');
              }
            }
            showToast('设置已保存', 'success');
          } catch (e) {
            showToast('保存失败: ' + e.message, 'error');
          }
        }
      }, '保存设置')
    )
  );
}
