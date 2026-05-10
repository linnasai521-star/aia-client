import { SSEParser } from '../utils/sse.js';

export class BaseProvider {
  constructor(cfg) {
    this.url = cfg.apiUrl;
    this.key = cfg.apiKey;
    this.model = cfg.model;
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
    const url = this.url.replace(/\/+$/, '') + '/v1/chat/completions';
    const resp = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(this._body(msgs, { ...opts, stream: false })),
    });
    if (!resp.ok) throw new Error('API ' + resp.status + ': ' + (await resp.text()).slice(0, 200));
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }

  streamMessage(msgs, opts, signal, onDelta, onDone, onErr) {
    const url = this.url.replace(/\/+$/, '') + '/v1/chat/completions';
    const parser = new SSEParser();
    let full = '', aborted = false;

    fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(this._body(msgs, { ...opts, stream: true })),
      signal,
    })
      .then(r => {
        if (!r.ok) return r.text().then(t => { throw new Error('API ' + r.status + ': ' + t.slice(0, 200)); });
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
    const url = this.url.replace(/\/+$/, '') + '/v1/models';
    const resp = await fetch(url, { headers: this._headers() });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    return (data.data || []).map(m => m.id).sort();
  }
}