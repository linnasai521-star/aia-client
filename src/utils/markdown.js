import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { escapeHtml } from './helpers.js';

marked.setOptions({ gfm: true, breaks: true, pedantic: false });

const renderer = new marked.Renderer();
renderer.code = function(ctx) {
  const lang = ctx.lang || '';
  const text = typeof ctx.text === 'string' ? ctx.text : String(ctx);
  return `<pre><div class="code-header"><span>${lang}</span><button class="copy-btn" data-copy>Copy</button></div><code class="language-${lang}">${escapeHtml(text)}</code></pre>`;
};
renderer.codespan = function(ctx) {
  const text = ctx.text || ctx;
  return `<code>${escapeHtml(typeof text === 'string' ? text : String(text))}</code>`;
};
marked.use({ renderer });

const CONFIG = {
  ALLOWED_TAGS: ['p','br','strong','em','b','i','u','s','del','ins','h1','h2','h3','h4','h5','h6','ul','ol','li','dl','dt','dd','blockquote','pre','code','kbd','samp','table','thead','tbody','tfoot','tr','th','td','a','img','hr','div','span','sup','sub','mark','abbr','button'],
  ALLOWED_ATTR: ['href','target','rel','src','alt','title','class','id','style','colspan','rowspan','data-copy'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script','iframe','object','embed','form','input','textarea','select','style'],
  FORBID_ATTR: ['onclick','onerror','onload','onmouseover','onfocus','onblur','onchange','onsubmit'],
  ALLOWED_URI_REGEXP: /^https?:\/\/|^mailto:|^data:image\//i,
};

export function renderMarkdown(text) {
  if (!text) return '';
  try {
    const raw = marked.parse(text);
    return DOMPurify.sanitize(raw, CONFIG);
  } catch (e) {
    return DOMPurify.sanitize(escapeHtml(text));
  }
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-copy]');
  if (btn) {
    const code = btn.closest('pre')?.querySelector('code');
    if (code) {
      navigator.clipboard.writeText(code.textContent).then(() => {
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    }
  }
});