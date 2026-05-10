export function genId() {
  return 'xxxx-xxxx-4xxx'.replace(/[x]/g, () => (Math.random()*16|0).toString(16)) + '-' + Date.now().toString(36);
}

export function timeAgo(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return '刚刚';
  if (d < 3600000) return Math.floor(d/60000) + '分钟前';
  if (d < 86400000) return Math.floor(d/3600000) + '小时前';
  if (d < 604800000) return Math.floor(d/86400000) + '天前';
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function escapeHtml(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '"', "'": '&#39;' };
  return s.replace(/[&<>"']/g, c => map[c]);
}

let _toastC = null;
export function showToast(msg, type = 'info', dur = 3000) {
  if (!_toastC) { _toastC = document.createElement('div'); _toastC.className = 'toast-container'; document.body.appendChild(_toastC); }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  _toastC.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = '.3s';
    setTimeout(() => el.remove(), 300);
  }, dur);
}