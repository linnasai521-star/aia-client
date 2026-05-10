export function processWorldBook(entries, userMsg, maxTokens = 2000) {
  if (!entries?.length) return '';
  const ml = userMsg.toLowerCase();
  const matched = [];
  for (const e of entries) {
    if (!e.enabled && !e.constant) continue;
    let score = 0;
    if (e.constant) { score = e.priority || 5; }
    else if (e.keywords?.length) {
      const hits = e.keywords.filter(kw => ml.includes(kw.toLowerCase())).length;
      if (hits > 0) score = hits * (e.priority || 3);
    }
    if (score > 0) matched.push({ content: e.content, score });
  }
  matched.sort((a, b) => b.score - a.score);
  const maxChars = maxTokens * 3;
  let total = 0;
  const selected = [];
  for (const m of matched) {
    if (total + m.content.length > maxChars) break;
    selected.push(m.content);
    total += m.content.length;
  }
  return selected.length ? '[World Info]\n' + selected.join('\n\n') : '';
}