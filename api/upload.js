import { kv } from '@vercel/kv';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, type, text } = req.body || {};
  if (!name || !text) return res.status(400).json({ error: 'Missing name or text' });

  const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  await kv.set(`doc:${id}`, { name, type: type || 'txt', text, addedAt: Date.now() });

  const manifest = (await kv.get('manifest')) || { docs: [] };
  manifest.docs.push({ id, name, type: type || 'txt', chars: text.length, addedAt: Date.now() });
  await kv.set('manifest', manifest);

  return res.status(200).json({ id });
}
