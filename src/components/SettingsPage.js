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
    onClick: onUse
  },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('span', { style: { fontSize: '1.25rem' } }, 
          cfg.provider === 'openai' ? '🟢' : cfg.provider === 'deepseek' ? '🔵' : cfg.provider === 'claude' ? '🟣' : '🟡'
        ),
        h('div', null,
          h('div', { style: { fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' } }, cfg.name),
          h('div', { style: { fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' } }, cfg.model || '-')
        )
      ),
      h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
        cfg.isDefault && h('span', {
          style: { fontSize: '0.625rem', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: '8px' }
        }, '默认'),
        isActive && h('span', {
          style: { fontSize: '0.625rem', color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: '8px' }
        }, '使用中')
      )
    ),
    h('div', { style: { fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '6px', wordBreak: 'break-all' } },
      cfg.baseURL || '未设置'
    ),
    h('div', { style: { fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' } }, maskedKey || '未设置 Key'),
    h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px', justifyContent: 'flex-end' } },
      !cfg.isDefault && h('button', {
        style: { fontSize: '0.6875rem', padding: '3px 10px', border: '1px solid rgba(139,147,255,0.15)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' },
        onClick: e => { e.stopPropagation(); onSetDefault(cfg.id); }
      }, '设为默认'),
      h('button', {
        style: { fontSize: '0.6875rem', padding: '3px 10px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' },
        onClick: e => { e.stopPropagation(); onEdit(cfg); }
      }, '编辑'),
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
  const [showNewForm, setShowNewForm] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  const loadConfigs = async () => {
    const all = await db.getAllApiConfigs();
    setConfigs(all);
  };

  useEffect(() => { loadConfigs(); }, []);

  const currentId = ctx.settings?.currentApiConfigId;

  const handleUse = async (id) => {
    await db.setSetting('currentApiConfigId', id);
    ctx.saveSetting('currentApiConfigId', id);
    showToast('已切换 API 配置', 'success');
  };

  const handleSetDefault = async (id) => {
    await db.setDefaultApiConfig(id);
    await loadConfigs();
    showToast('已设为默认配置', 'success');
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
  };

  const handleSaveEdit = async () => {
    await db.putApiConfig(editForm);
    await loadConfigs();
    setEditing(null);
    showToast('已保存', 'success');
  };

  const handleAddDefault = async () => {
    const id = genId();
    const newCfg = {
      id, name: '新配置', provider: 'openai',
      baseURL: 'https://api.openai.com', apiKey: '',
      model: 'gpt-4o', isDefault: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    await db.putApiConfig(newCfg);
    await loadConfigs();
    setEditing(id);
    setEditForm(newCfg);
    setShowNewForm(false);
  };

  const handleImport = async () => {
    try {
      const text = prompt('粘贴 API 配置 JSON：');
      if (!text) return;
      const imported = JSON.parse(text);
      const arr = Array.isArray(imported) ? imported : [imported];
      for (const cfg of arr) {
        await db.putApiConfig({ id: genId(), ...cfg, createdAt: Date.now(), updatedAt: Date.now() });
      }
      await loadConfigs();
      showToast(`已导入 ${arr.length} 个配置`, 'success');
    } catch (e) { showToast('导入失败: ' + e.message, 'error'); }
  };

  const handleExport = async () => {
    const exportData = configs.map(({ id, createdAt, updatedAt, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'api_configs_backup.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('已导出', 'success');
  };

  return h('div', { className: 'settings-page' },
    h('div', { className: 'settings-container' },
      h('div', { className: 'settings-header' },
        h('button', { className: 'back-btn', onClick: () => ctx.setPage('chat') }, '← 返回'),
        h('h2', null, 'API 配置'),
        h('button', {
          style: { fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' },
          onClick: () => setShowImportExport(!showImportExport)
        }, '📁')
      ),

      showImportExport && h('div', { style: { display: 'flex', gap: '8px', marginBottom: '16px' } },
        h('button', { className: 'setting-btn', style: { flex: 1 }, onClick: handleImport }, '📥 导入'),
        h('button', { className: 'setting-btn', style: { flex: 1 }, onClick: handleExport }, '📤 导出')
      ),

      configs.length === 0 && h('div', { style: { textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '0.875rem' } },
        '暂无 API 配置，点击下方按钮添加。'
      ),

      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' } },
        ...configs.map(cfg =>
          editing === cfg.id
            ? h('div', {
                key: cfg.id,
                style: { background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '14px 16px', border: '1px solid rgba(139,147,255,0.15)' }
              },
                h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                  h('input', {
                    value: editForm.name || '',
                    onChange: e => setEditForm({...editForm, name: e.target.value}),
                    className: 'setting-input',
                    placeholder: '配置名称',
                    style: { borderBottom: '1px solid rgba(255,255,255,0.06)', borderRadius: '0' }
                  }),
                  h('select', {
                    value: editForm.provider || 'openai',
                    onChange: e => {
                      const p = { ...editForm, provider: e.target.value };
                      const rec = PROVIDER_MODELS[e.target.value];
                      if (rec) p.model = rec[0];
                      setEditForm(p);
                    },
                    className: 'setting-select'
                  }, ...getProviderList().map(p => h('option', { key: p.id, value: p.id }, p.name)), h('option', { value: 'custom' }, '自定义')),
                  h('input', {
                    value: editForm.baseURL || '',
                    onChange: e => setEditForm({...editForm, baseURL: e.target.value}),
                    className: 'setting-input',
                    placeholder: 'https://api.deepseek.com'
                  }),
                  h('input', {
                    type: 'password',
                    value: editForm.apiKey || '',
                    onChange: e => setEditForm({...editForm, apiKey: e.target.value}),
                    className: 'setting-input',
                    placeholder: 'API Key (留空保留原值)'
                  }),
                  h('input', {
                    value: editForm.model || '',
                    onChange: e => setEditForm({...editForm, model: e.target.value}),
                    className: 'setting-input',
                    placeholder: '模型名称',
                    list: 'edit-model-suggest'
                  }),
                  PROVIDER_MODELS[editForm.provider] && h('datalist', { id: 'edit-model-suggest' },
                    ...PROVIDER_MODELS[editForm.provider].map(m => h('option', { key: m, value: m }))
                  ),
                  h('div', { style: { display: 'flex', gap: '8px', marginTop: '4px' } },
                    h('button', { className: 'setting-btn primary', style: { flex: 1 }, onClick: handleSaveEdit }, '保存'),
                    h('button', { className: 'setting-btn', style: { flex: 1 }, onClick: () => setEditing(null) }, '取消')
                  )
                )
              )
            : h(ConfigCard, {
                key: cfg.id,
                cfg, isActive: currentId === cfg.id,
                onUse: () => handleUse(cfg.id),
                onSetDefault: handleSetDefault,
                onDelete: handleDelete,
                onEdit: handleEdit
              })
        )
      ),

      h('button', {
        className: 'setting-btn',
        style: { width: '100%', padding: '12px', opacity: showNewForm ? 0.5 : 1 },
        onClick: handleAddDefault
      }, '+ 添加 API 配置')
    )
  );
}
