import { getOfficialDraws } from '../lib/lottery-data.js';

export default async function handler(req, res) {
  try {
    const game = req.query.game === 'Mega Millions' ? 'Mega Millions' : 'Powerball';
    const data = await getOfficialDraws(game, req.query.limit);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).json(data);
  } catch (error) {
    res.status(503).json({ status: 'unavailable', message: 'Não foi possível validar os resultados neste momento. Tente novamente em alguns minutos.' });
  }
}
