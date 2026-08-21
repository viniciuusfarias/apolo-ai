import { getOfficialHealth } from '../lib/lottery-data.js';

export default async function handler(_req, res) {
  const health = await getOfficialHealth();
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  res.status(health.status === 'unavailable' ? 503 : 200).json(health);
}
