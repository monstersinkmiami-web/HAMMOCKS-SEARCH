import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const manifest = (await kv.get('manifest')) || { docs: [] };
  const docs = manifest.docs.map(d => ({ id: d.id, name: d.name, type: d.type, addedAt: d.addedAt }));
  return res.status(200).json({ count: docs.length, docs });
}
