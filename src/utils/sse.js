export class SSEParser {
  constructor() { this.buf = ''; }

  feed(chunk) {
    this.buf += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk, { stream: true });
  }

  drain() {
    const msgs = [];
    while (true) {
      const idx = this.buf.indexOf('\n\n');
      if (idx === -1) break;
      const block = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      const msg = this._parse(block);
      if (msg) msgs.push(msg);
    }
    return msgs;
  }

  flush() {
    if (!this.buf.trim()) return null;
    const msg = this._parse(this.buf);
    this.buf = '';
    return msg;
  }

  _parse(block) {
    let event = '', data = '', id = '';
    const lines = block.split('\n');
    for (const line of lines) {
      if (line[0] === ':') continue;
      const ci = line.indexOf(':');
      if (ci === -1) continue;
      const field = line.slice(0, ci);
      const value = line.slice(ci + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data += (data ? '\n' : '') + value;
      else if (field === 'id') id = value;
    }
    if (!data && !event) return null;
    return { event: event || 'message', data, id };
  }
}