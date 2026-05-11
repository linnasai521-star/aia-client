import { SSEParser } from '../utils/sse.js';

export function normalizeBaseURL(url) {
  if (!url) return '';
  return url
    .trim()
    .replace(/\/chat\/completions\/?$/, '')
    .replace(/\/v1\/?$/, '/v1')
    .replace(/\/?$/, '');
}

export class BaseProvider {
  constructor(cfg) {
    this.url = normalizeBaseURL(cfg.apiUrl);
    this.key = cfg.apiKey;
    this.model = cfg.model;
  }

  _chatUrl() {
    return this.url + '/chat/completions';
  }

  _modelsUrl() {
    return this.url + '/models';
  }

  _headers() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.key };
  }

  _body(msgs, opts) {
    return {
      model: this.model,
      messages: msgs,
      max_tokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.7,
      top_p: opts.topP ?? 1,
      stream: !!opts.stream,
    };
  }

  async sendMessage(msgs, opts) {
    const url = this._chatUrl();
    const resp = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(this._body(msgs, { ...opts, stream: false })),
    });
    if (!resp.ok) {
      const text = (await resp.text()).slice(0, 200);
      if (text.includes('not_found') || resp.status === 404) {
        throw new Error('无法连接到接口，请检查 API 地址是否正确。');
      }
      if (resp.status === 401 || resp.status === 403) {
        throw new Error('API Key 无效或没有权限，请检查密钥。');
      }
      if (resp.status === 429) {
        throw new Error('请求过于频繁，请稍后重试。');
      }
      throw new Error('请求失败 (' + resp.status + '): ' + text);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }

  streamMessage(msgs, opts, signal, onDelta, onDone, onErr) {
    const url = this._chatUrl();
    const parser = new SSEParser();
    let full = '', aborted = false;
    fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(this._body(msgs, { ...opts, stream: true })),
      signal,
    })
      .then(r => {
        if (!r.ok) return r.text().then(t => {
          let msg = '请求失败 (' + r.status + ')';
          if (r.status === 404) msg = '无法连接到接口，请检查 API 地址是否正确。';
          else if (r.status === 401 || r.status === 403) msg = 'API Key 无效或没有权限，请检查密钥。';
          else if (r.status === 429) msg = '请求过于频繁，请稍后重试。';
          throw new Error(msg);
        });
        return r.body.getReader();
      })
      .then(reader => {
        const pump = () => {
          reader.read().then(({ done, value }) => {
            if (done) { if (!aborted) onDone(full); return; }
            parser.feed(value);
            for (const msg of parser.drain()) {
              if (msg.data === '[DONE]') { onDone(full); return; }
              try {
                const p = JSON.parse(msg.data);
                const delta = p.choices?.[0]?.delta?.content;
                if (delta) { full += delta; onDelta(full); }
              } catch {}
            }
            pump();
          }).catch(e => { if (!aborted) onErr(e); });
        };
        pump();
      })
      .catch(e => { if (!aborted && e.name !== 'AbortError') onErr(e); });
    return () => { aborted = true; };
  }

  async listModels() {
    const url = this._modelsUrl();
    const resp = await fetch(url, { headers: this._headers() });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    return (data.data || []).map(m => m.id).sort();
  }
}
