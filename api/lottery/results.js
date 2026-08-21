import { getOfficialDraws } from '../lib/lottery-data.js';

export default async function handler(req, res) {
  try {
    const game = req.query.game === 'Mega Millions' ? 'Mega Millions' : 'Powerball';
    const data = await getOfficialDraws(game, req.query.limit);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).json({
      game: data.game,
      draws: data.draws.map(({ game, draw_date, white_numbers, special_ball, multiplier }) => ({ game, draw_date, white_numbers, special_ball, multiplier })),
      latest_draw_date: data.latest_draw_date,
      records_available: data.records_available,
      latency_ms: data.latency_ms,
      fetched_at: data.fetched_at,
      status: data.status
    });
  } catch (error) {
    res.status(503).json({ status: 'unavailable', message: 'Não foi possível validar os resultados neste momento. Tente novamente em alguns minutos.' });
  }
}
