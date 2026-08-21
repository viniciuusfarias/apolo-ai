import { getOfficialHealth } from '../lib/lottery-data.js';
import { getOfficialDraws } from '../lib/lottery-data.js';
import { storeOfficialLotteryData } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  try {
    const results = await Promise.all(['Powerball', 'Mega Millions'].map(game => getOfficialDraws(game, 500)));
    const stored = await storeOfficialLotteryData(results);
    const health = await getOfficialHealth();
    return res.status(200).json({ ...health, sync: stored });
  } catch (error) {
    return res.status(503).json({ status: 'unavailable', message: 'Não foi possível sincronizar resultados verificados.' });
  }
}
