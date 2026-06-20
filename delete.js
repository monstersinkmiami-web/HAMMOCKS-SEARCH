import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });

  await kv.del(`doc:${id}`);
  const manifest = (await kv.get('manifest')) || { docs: [] };
  manifest.docs = manifest.docs.filter(d => d.id !== id);
  await kv.set('manifest', manifest);

  return res.status(200).json({ ok: true });
}
