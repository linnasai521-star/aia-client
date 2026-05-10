import React, { useContext, useState } from 'react';
import { Ctx } from '../state.js';
import { hashPin, verifyPin } from '../utils/crypto.js';
import { showToast } from '../utils/helpers.js';

const h = React.createElement;

export function LockScreen() {
  const ctx = useContext(Ctx);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const isNew = !ctx.pinHash;

  const submit = async () => {
    if (!pin || pin.length < 4) { setError('PIN 至少4位'); return; }
    if (isNew) {
      const hash = await hashPin(pin);
      ctx.saveSetting('pinHash', hash);
      ctx.setPinHash(hash);
      ctx.setLocked(false);
      showToast('PIN 设置成功', 'success');
    } else {
      const ok = await verifyPin(pin, ctx.pinHash);
      if (ok) {
        ctx.setLocked(false);
        ctx.setSettings(s => ({ ...s, _sessionPin: pin }));
      } else {
        setError('PIN 错误');
        setPin('');
      }
    }
  };

  return h('div', { className: 'lock-screen' },
    h('div', { className: 'lock-icon' }, '🔒'),
    h('div', { className: 'lock-title' }, isNew ? '设置 PIN' : '输入 PIN'),
    h('div', { className: 'lock-sub' }, isNew ? '设置 4-8 位 PIN 保护 API Key' : '输入 PIN 解锁'),
    h('input', {
      className: 'pin-input', type: 'password', maxLength: 8, value: pin,
      onChange: e => { setPin(e.target.value); setError(''); },
      onKeyDown: e => { if (e.key === 'Enter') submit(); },
    }),
    error ? h('div', { style: { color: 'var(--red)', fontSize: 13, marginTop: 8 } }, error) : null,
    h('div', { className: 'lock-actions' },
      h('button', { className: 'btn btn-primary', onClick: submit }, isNew ? '设置' : '解锁'),
      isNew ? h('button', { className: 'btn btn-ghost', onClick: () => ctx.setLocked(false) }, '跳过') : null
    )
  );
}