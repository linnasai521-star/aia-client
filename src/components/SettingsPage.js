import React, { useContext, useState, useEffect } from 'react';
import { Ctx } from '../state.js';
import { encryptStr, decryptStr } from '../utils/crypto.js';
import { createProvider, getProviderList } from '../providers/registry.js';
import { normalizeBaseURL } from '../providers/baseProvider.js';
import { showToast } from '../utils/helpers.js';
import * as db from '../db/indexeddb.js';

const h = React.createElement;

const PROVIDER_MODELS = {
  openai: ['gpt-4o','gpt-4o-mini','gpt-4.1','gpt-4.1-mini'],
  deepseek: ['deepseek-chat','deepseek-reasoner'],
  claude: ['claude-3-5-sonnet-20241022','claude-3-haiku-20240307'],
  gemini: ['gemini-2.0-flash','gemini-1.5-pro'],
  openrouter: ['openai/gpt-4o','anthropic/claude-3.5-sonnet'],
  siliconflow: ['deepseek-ai/DeepSeek-V3','deepseek-ai/DeepSeek-R1']
};

function genId() { return 'cfg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6); }

// Auto-detect provider from URL
function detectProvider(baseURL) {
  if (!baseURL) return 'openai';
  const u = baseURL.toLowerCase();
  if (u.includes('deepseek')) return 'deepseek';
  if (u.includes('openrouter')) return 'openrouter';
  if (u.includes('siliconflow')) return 'siliconflow';
  if (u.includes('anthropic') || u.includes('claude')) return 'claude';
  if (u.includes('generativelanguage') || u.includes('gemini')) return 'gemini';
  if (u.includes('openai')) return 'openai';
  return 'openai';
}

// Normalize baseURL
function smartNormalize(url) {
  if (!url) return '';
  let clean = url.trim();
  // If no protocol, add https
  if (clean && !clean.startsWith('http')) clean = 'https://' + clean;
  // Remove trailing slash
  clean = clean.replace(/\/+$/, '');
  // Remove /chat/completions if present
  clean = clean.replace(/\/chat\/completions\/?$/, '');
  // Remove /v1/chat/completions
  clean = clean.replace(/\/v1\/chat\/completions\/?$/, '/v1');
  // Add /v1 if not present and domain suggests it needs it
  if (!clean.endsWith('/v1')) {
    const knownProviders = ['deepseek.com', 'openai.com', 'openrouter.ai', 'siliconflow.cn'];
    if (knownProviders.some(p => clean.includes(p))) {
      clean += '/v1';
    }
  }
  return clean;
}

// User-friendly error messages
function friendlyError(err) {
  const msg = err.message || '';
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized'))
    return 'API Key 无效或没有权限，请检查后重新输入。';
  if (msg.includes('404') || msg.includes('not_found') || msg.includes('not found'))
    return '接口地址可能填写错误。请检查 Base URL 是否正确。';
  if (msg.includes('429') || msg.includes('rate'))
    return '请求过于频繁，请稍后重试。';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('TypeError'))
    return '网络连接失败。请检查地址是否正确，或该接口是否支持浏览器访问（CORS）。';
  if (msg.includes('CORS') || msg.includes('cross-origin') || msg.includes('opaque'))
    return '该接口不支持浏览器直接访问，请使用支持 CORS 的中转站。';
  if (msg.includes('HTTP'))
    return `接口请求失败: ${msg}`;
  return msg || '未知错误';
}

function ConfigCard({ cfg, isActive, onUse, onSetDefault, onDelete, onEdit }) {
  const maskedKey = cfg.apiKey ? cfg.apiKey.slice(0,3) + '****' + cfg.apiKey.slice(-4) : '';
  return h('div', {
    style: {
      background: isActive ? 'rgba(139,147,255,0.04)' : 'rgba(255,255,255,0.02)',
      border: isActive ? '1px solid rgba(139,147,255,0.2)' : '1px solid rgba(255,255,255,0.04)',
      borderRadius: '16px', padding: '14px 16px',
      transition: 'all 0.3s ease', cursor: 'pointer',
      boxShadow: isActive ? '0 0 20px rgba(139,147,255,0.04)' : 'none',
      position: 'relative'
    },
    onClick: () => onEdit(cfg)
  },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('span', { style: { fontSize: '1.25rem' } },
          cfg.provider === 'openai' ? '🟢' : cfg.provider === 'deepseek' ? '🔵' : cfg.provider === 'claude' ? '🟣' : cfg.provider === 'gemini' ? '🔴' : '🟡'
        ),
        h('div', null,
          h('div', { style: { fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' } }, cfg.name),
          h('div', { style: { fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' } }, cfg.model || '未选择模型')
        )
      ),
      h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
        cfg.status === 'online' && h('span', { style: { fontSize: '0.625rem', color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: '8px' } }, '● 在线'),
        cfg.status === 'error' && h('span', { style: { fontSize: '0.625rem', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: '8px' } }, '● 离线'),
        cfg.isDefault && h('span', { style: { fontSize: '0.625rem', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: '8px' } }, '默认'),
        isActive && h('span', { style: { fontSize: '0.625rem', color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: '8px' } }, '使用中')
      )
    ),
    h('div', { style: { fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '4px' } }, cfg.baseURL || '未设置'),
    h('div', { style: { fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' } }, maskedKey || '未设置 Key'),
    cfg.models && cfg.models.length > 0 && h('div', { style: { fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px', opacity: 0.5 } }, `${cfg.models.length} 个模型可用`),
    h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px', justifyContent: 'flex-end' } },
      h('button', {
        style: { fontSize: '0.6875rem', padding: '3px 10px', border: '1px solid rgba(139,147,255,0.15)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' },
        onClick: e => { e.stopPropagation(); onSetDefault(cfg.id); }
      }, '设为默认'),
      h('button', {
        style: { fontSize: '0.6875rem', padding: '3px 10px', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', background: 'transparent', color: '#f87171', cursor: 'pointer' },
        onClick: e => { e.stopPropagation(); onDelete(cfg.id); }
      }, '删除')
    )
  );
}

export function SettingsPage() {
  const ctx = useContext(Ctx);
  const [configs, setConfigs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  const loadConfigs = async () => setConfigs(await db.getAllApiConfigs());
  useEffect(() => { loadConfigs(); }, []);
  const currentId = ctx.settings?.currentApiConfigId;

  const handleUse = async (id) => {
    await db.setSetting('currentApiConfigId', id);
    ctx.saveSetting('currentApiConfigId', id);
    showToast('已切换配置', 'success');
  };

  const handleSetDefault = async (id) => {
    await db.setDefaultApiConfig(id);
    await loadConfigs();
    showToast('已设为默认', 'success');
  };

  const handleDelete = async (id) => {
    if (configs.length <= 1) { showToast('至少保留一个配置', 'warning'); return; }
    await db.deleteApiConfig(id);
    await loadConfigs();
    if (currentId === id) {
      const def = await db.getDefaultApiConfig();
      if (def) await db.setSetting('currentApiConfigId', def.id);
    }
    showToast('已删除', 'info');
  };

  const handleEdit = (cfg) => {
    setEditing(cfg.id);
    setEditForm({ ...cfg });
    setTestStatus(null);
  };

  const handleUrlChange = (val) => {
    const normalized = smartNormalize(val);
    const detected = detectProvider(normalized);
    setEditForm(f => ({
      ...f,
      baseURL: normalized,
      provider: detected,
      // Clear cache when URL or Provider changes
      ...(normalized !== f.baseURL || detected !== f.provider ? { models: [], lastFetchedModelsAt: null } : {})
    }));
  };

  const handleKeyChange = (val) => {
    // Clear cache when key changes
    setEditForm(f => ({
      ...f,
      apiKey: val,
      ...(val !== f.apiKey ? { models: [], lastFetchedModelsAt: null } : {})
    }));
  };

  const handleTestAndFetch = async () => {
    const cfg = editForm;
    setTesting(true);
    setTestStatus({ msg: '正在测试连接...', ok: null });
    try {
      const url = cfg.baseURL || '';
      if (!url) throw new Error('请填写 API 地址');
      if (!cfg.apiKey) throw new Error('请填写 API Key');
      const p = createProvider(cfg.provider || 'openai', { apiUrl: url, apiKey: cfg.apiKey, model: cfg.model || 'gpt-4o' });
      const list = await p.listModels();
      const autoModel = cfg.model || (list.length > 0 ? list[0] : '');
      const updated = { ...cfg, model: autoModel, models: list, status: 'online', lastTestedAt: Date.now(), lastFetchedModelsAt: Date.now() };
      await db.putApiConfig(updated);
      setEditForm(updated);
      await loadConfigs();
      setTestStatus({ msg: `✅ 连接成功！获取到 ${list.length} 个模型，已选择: ${autoModel}`, ok: true });
    } catch (err) {
      const fm = friendlyError(err);
      await db.putApiConfig({ ...cfg, status: 'error', lastTestedAt: Date.now() });
      await loadConfigs();
      setTestStatus({ msg: `❌ ${fm}`, ok: false });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    await db.putApiConfig(editForm);
    await loadConfigs();
    setEditing(null);
    showToast('已保存', 'success');
  };

  const handleAdd = async () => {
    const id = genId();
    const newCfg = {
      id, name: '新配置', provider: 'openai', baseURL: 'https://api.openai.com/v1',
      apiKey: '', model: 'gpt-4o', isDefault: false, models: [],
      createdAt: Date.now(), updatedAt: Date.now()
    };
    await db.putApiConfig(newCfg);
    await loadConfigs();
    setEditing(id);
    setEditForm(newCfg);
    setTestStatus(null);
  };

  // Edit form UI
  if (editing) {
    return h('div', { className: 'settings-page' },
      h('div', { className: 'settings-container' },
        h('div', { className: 'settings-header' },
          h('button', { className: 'back-btn', onClick: () => setEditing(null) }, '← 返回'),
          h('h2', null, editForm.isNew ? '添加 API' : '编辑 API')
        ),
        // Provider
        h('div', { className: 'setting-group' },
          h('label', null, '服务商'),
          h('select', {
            value: editForm.provider || 'openai',
            onChange: e => setEditForm({...editForm, provider: e.target.value}),
            className: 'setting-select'
          }, ...getProviderList().map(p => h('option', { key: p.id, value: p.id }, p.name)))
        ),
        // Name
        h('div', { className: 'setting-group' },
          h('label', null, '名称'),
          h('input', {
            value: editForm.name || '',
            onChange: e => setEditForm({...editForm, name: e.target.value}),
            className: 'setting-input',
            placeholder: 'DeepSeek 主号'
          })
        ),
        // Base URL
        h('div', { className: 'setting-group' },
          h('label', null, 'Base URL'),
          h('input', {
            value: editForm.baseURL || '',
            onChange: e => handleUrlChange(e.target.value),
            className: 'setting-input',
            placeholder: 'https://api.deepseek.com/v1'
          }),
          h('div', { style: { fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' } },
            '系统会自动修复地址格式（如移除 /chat/completions）')
        ),
        // API Key
        h('div', { className: 'setting-group' },
          h('label', null, 'API Key'),
          h('input', {
            type: 'password',
            value: editForm.apiKey || '',
            onChange: e => handleKeyChange(e.target.value),
            className: 'setting-input',
            placeholder: 'sk-...'
          })
        ),
        // Model select
        h('div', { className: 'setting-group' },
          h('label', null, '模型'),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            editForm.models && editForm.models.length > 0
              ? h('select', {
                  value: editForm.model || '',
                  onChange: e => setEditForm({...editForm, model: e.target.value}),
                  className: 'setting-select',
                  style: { flex: 1 }
                },
                  (editForm.models || []).map(m => h('option', { key: m, value: m }, m))
                )
              : h('input', {
                  value: editForm.model || '',
                  onChange: e => setEditForm({...editForm, model: e.target.value}),
                  className: 'setting-input',
                  placeholder: '请先点击下方按钮获取模型列表',
                  style: { flex: 1 }
                })
          ),
          editForm.models && editForm.models.length > 0 &&
            h('div', { style: { fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' } },
              `${editForm.models.length} 个模型可用`) ||
            h('div', { style: { fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' } },
              '获取模型后自动显示下拉列表')
        ),
        // Test & Fetch button
        h('button', {
          className: 'setting-btn primary',
          style: { width: '100%', marginBottom: '8px' },
          onClick: handleTestAndFetch,
          disabled: testing
        }, testing ? '⏳ 测试中...' : '🔗 测试连接 & 获取模型'),
        // Status
        testStatus && h('div', {
          style: {
            padding: '10px 14px', borderRadius: '10px', fontSize: '0.8125rem', marginBottom: '8px',
            background: testStatus.ok === true ? 'rgba(74,222,128,0.06)' : testStatus.ok === false ? 'rgba(248,113,113,0.06)' : 'rgba(139,147,255,0.04)',
            border: '1px solid ' + (testStatus.ok === true ? 'rgba(74,222,128,0.12)' : testStatus.ok === false ? 'rgba(248,113,113,0.12)' : 'rgba(139,147,255,0.08)'),
            color: testStatus.ok === true ? '#4ade80' : testStatus.ok === false ? '#f87171' : 'var(--text-muted)'
          }
        }, testStatus.msg),
        // Save/Cancel
        h('div', { style: { display: 'flex', gap: '8px' } },
          h('button', { className: 'setting-btn primary', style: { flex: 1 }, onClick: handleSave }, '保存'),
          h('button', { className: 'setting-btn', style: { flex: 1 }, onClick: () => setEditing(null) }, '取消'),
          h('button', {
            style: { fontSize: '0.6875rem', padding: '6px 10px', border: '1px solid rgba(139,147,255,0.15)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' },
            onClick: async () => {
              await db.setDefaultApiConfig(editForm.id);
              showToast('已设为默认', 'success');
            }
          }, '设为默认')
        )
      )
    );
  }

  // List view
  return h('div', { className: 'settings-page' },
    h('div', { className: 'settings-container' },
      h('div', { className: 'settings-header' },
        h('button', { className: 'back-btn', onClick: () => ctx.setPage('chat') }, '← 返回'),
        h('h2', null, 'API 配置')
      ),
      configs.length === 0 && h('div', { style: { textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '0.875rem' } },
        '暂无 API 配置，点击下方按钮添加。'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' } },
        ...configs.map(cfg => h(ConfigCard, {
          key: cfg.id, cfg, isActive: currentId === cfg.id,
          onUse: handleUse, onSetDefault: handleSetDefault,
          onDelete: handleDelete, onEdit: handleEdit
        }))
      ),
      h('button', { className: 'setting-btn', style: { width: '100%', padding: '12px' }, onClick: handleAdd }, '+ 添加 API 配置')
    )
  );
}
