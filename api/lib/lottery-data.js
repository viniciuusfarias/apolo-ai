export const OFFICIAL_SOURCES = {
  Powerball: {
    provider: 'Open Data NY — New York State Gaming Commission',
    endpoint: 'https://data.ny.gov/resource/d6yy-54nr.json',
    referenceUrl: 'https://data.ny.gov/d6yy-54nr',
    effectiveFrom: '2015-10-07',
    whiteMax: 69,
    specialMax: 26
  },
  'Mega Millions': {
    provider: 'Open Data NY — New York State Gaming Commission',
    endpoint: 'https://data.ny.gov/resource/5xaw-6ayf.json',
    referenceUrl: 'https://data.ny.gov/5xaw-6ayf',
    effectiveFrom: '2017-10-31',
    whiteMax: 70,
    specialMax: 25
  }
};

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const numbers = value => (String(value || '').match(/\d+/g) || []).map(Number);
const isoDate = value => new Date(value).toISOString().slice(0, 10);

export function validateDraw(game, draw) {
  const rule = OFFICIAL_SOURCES[game];
  if (!rule || !draw || !/^\d{4}-\d{2}-\d{2}$/.test(draw.draw_date)) throw new Error('Resultado com data inválida');
  if (!Array.isArray(draw.white_numbers) || draw.white_numbers.length !== 5) throw new Error('Quantidade inválida de bolas brancas');
  if (new Set(draw.white_numbers).size !== 5 || draw.white_numbers.some(n => !Number.isInteger(n) || n < 1 || n > rule.whiteMax)) throw new Error('Bolas brancas inválidas');
  if (!Number.isInteger(draw.special_ball) || draw.special_ball < 1 || draw.special_ball > rule.specialMax) throw new Error('Bola especial inválida');
  return draw;
}

export function normalizeDraw(game, row) {
  const source = OFFICIAL_SOURCES[game];
  const date = isoDate(row.draw_date);
  let whiteNumbers;
  let specialBall;
  if (game === 'Powerball') {
    const raw = numbers(row.winning_numbers);
    whiteNumbers = raw.slice(0, 5);
    specialBall = raw[5];
  } else {
    whiteNumbers = numbers(row.winning_numbers).slice(0, 5);
    specialBall = numbers(row.mega_ball)[0];
  }
  return validateDraw(game, {
    id: `${game}:${date}`,
    game,
    draw_date: date,
    white_numbers: whiteNumbers.sort((a, b) => a - b),
    special_ball: specialBall,
    multiplier: row.multiplier || null,
    source: source.provider,
    source_url: source.referenceUrl,
    source_updated_at: row.draw_date,
    raw_payload: row
  });
}

export async function getOfficialDraws(game, limit = 250) {
  const source = OFFICIAL_SOURCES[game];
  if (!source) throw new Error('Loteria não suportada');
  const cacheKey = `${game}:${limit}`;
  const prior = cache.get(cacheKey);
  if (prior && Date.now() - prior.fetchedAt < CACHE_TTL_MS) return { ...prior.value, cache: 'fresh' };

  const params = new URLSearchParams({
    '$limit': String(Math.min(Math.max(Number(limit) || 100, 1), 500)),
    '$order': 'draw_date DESC',
    '$where': `draw_date >= '${source.effectiveFrom}T00:00:00.000'`
  });
  const startedAt = Date.now();
  const response = await fetch(`${source.endpoint}?${params}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Fonte oficial respondeu ${response.status}`);
  const rows = await response.json();
  const draws = rows.map(row => normalizeDraw(game, row));
  if (!draws.length) throw new Error('A fonte oficial não retornou resultados compatíveis');
  const value = {
    game,
    draws,
    source: source.provider,
    source_url: source.referenceUrl,
    latest_draw_date: draws[0].draw_date,
    records_available: draws.length,
    latency_ms: Date.now() - startedAt,
    fetched_at: new Date().toISOString(),
    status: 'connected'
  };
  cache.set(cacheKey, { fetchedAt: Date.now(), value });
  return { ...value, cache: 'miss' };
}

export async function getOfficialHealth() {
  const results = await Promise.allSettled(Object.keys(OFFICIAL_SOURCES).map(game => getOfficialDraws(game, 1)));
  const games = results.map((result, index) => result.status === 'fulfilled'
    ? result.value
    : { game: Object.keys(OFFICIAL_SOURCES)[index], status: 'unavailable', error: result.reason?.message || 'Falha desconhecida' });
  const available = games.filter(game => game.status === 'connected');
  return {
    status: available.length === games.length ? 'connected' : available.length ? 'stored_or_degraded' : 'unavailable',
    provider: 'Open Data NY — New York State Gaming Commission',
    games,
    checked_at: new Date().toISOString()
  };
}
