import { kv } from '@vercel/kv';

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function tokenize(q) { return q.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2); }
function stem(t) { return t.length > 5 ? t.slice(0, t.length - 2) : t; }

function countMatches(lowerText, stems) {
  let score = 0;
  for (const s of stems) {
    const re = new RegExp(escapeRe(s), 'g');
    const m = lowerText.match(re);
    if (m) score += m.length;
  }
  return score;
}

function bestExcerpt(text, stems, maxLen = 1100) {
  let paras = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 40);
  if (paras.length < 2) {
    paras = [];
    for (let i = 0; i < text.length; i += 500) paras.push(text.slice(i, i + 500));
  }
  const scored = paras.map(p => ({ p, s: countMatches(p.toLowerCase(), stems) })).sort((a, b) => b.s - a.s);
  let excerpt = scored.slice(0, 3).map(x => x.p).join('\n\u2026\n');
  if (excerpt.length > maxLen) excerpt = excerpt.slice(0, maxLen) + '\u2026';
  return excerpt;
}

// 20 questions per visitor per hour, to keep API costs predictable on a public page.
async function checkRateLimit(ip) {
  const key = `rl:${ip}:${new Date().getUTCHours()}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, 3600);
  return count <= 20;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Missing question' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({ error: "You've hit the question limit for now \u2014 please try again in a bit." });
  }

  const manifest = (await kv.get('manifest')) || { docs: [] };
  if (manifest.docs.length === 0) {
    return res.status(200).json({ answer: "This library doesn't have any documents in it yet.", sources: [] });
  }

  const stems = tokenize(query).map(stem);
  if (stems.length === 0) {
    return res.status(200).json({ answer: 'Try asking a more specific question.', sources: [] });
  }

  const scored = [];
  for (const doc of manifest.docs) {
    const record = await kv.get(`doc:${doc.id}`);
    if (!record || !record.text) continue;
    const score = countMatches(record.text.toLowerCase(), stems);
    if (score > 0) scored.push({ doc, text: record.text, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 8);

  if (top.length === 0) {
    return res.status(200).json({ answer: `No documents in the library contain terms related to "${query}".`, sources: [] });
  }

  const sources = top.map(r => ({ name: r.doc.name, excerpt: bestExcerpt(r.text, stems) }));
  const context = sources.map((s, i) => `[Document ${i + 1}: ${s.name}]\n${s.excerpt}`).join('\n\n---\n\n');
  const systemPrompt =
    "You are a document research assistant. Answer the user's question using ONLY the excerpts provided below " +
    "\u2014 never use outside knowledge. Cite the source document by name in parentheses after each claim, e.g. " +
    '(filename.pdf). If the excerpts don\'t contain a clear answer, say so plainly instead of guessing. Be concise and direct.';

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Excerpts:\n\n${context}\n\nQuestion: ${query}` }]
      })
    });
    const data = await resp.json();
    const answer = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || 'No answer was returned.';
    return res.status(200).json({ answer, sources });
  } catch (e) {
    return res.status(200).json({ answer: 'Could not reach the AI to summarize an answer. The matching excerpts are below.', sources });
  }
}
