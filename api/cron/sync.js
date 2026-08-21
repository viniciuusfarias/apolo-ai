import { getOfficialHealth } from '../lib/lottery-data.js';

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  const health = await getOfficialHealth();
  return res.status(health.status === 'unavailable' ? 503 : 200).json(health);
}
