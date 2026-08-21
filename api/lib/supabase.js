const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada`);
  return value;
};

export async function supabaseRequest(path, options = {}) {
  const baseUrl = required('SUPABASE_URL').replace(/\/$/, '');
  const secret = required('SUPABASE_SECRET_KEY');
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`Supabase respondeu ${response.status}`);
  return response;
}

export async function storeOfficialLotteryData(results) {
  const startedAt = Date.now();
  const records = results.flatMap(result => result.draws.map(draw => ({
    game: draw.game,
    draw_date: draw.draw_date,
    white_numbers: draw.white_numbers,
    special_ball: draw.special_ball,
    multiplier: draw.multiplier,
    data_status: 'available',
    synced_at: new Date().toISOString()
  })));

  if (!records.length) throw new Error('Nenhum resultado validado para persistir');

  await supabaseRequest('lottery_draws?on_conflict=game,draw_date', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(records)
  });

  const now = new Date().toISOString();
  await supabaseRequest('data_source_status?on_conflict=game', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(results.map(result => ({
      game: result.game,
      status: 'connected',
      last_sync_at: now,
      updated_at: now
    })))
  });

  await supabaseRequest('lottery_sync_runs', {
    method: 'POST',
    body: JSON.stringify(results.map(result => ({
      game: result.game,
      status: 'success',
      records_synced: result.draws.length,
      started_at: new Date(startedAt).toISOString(),
      completed_at: now
    })))
  });

  return { records: records.length, latency_ms: Date.now() - startedAt };
}
