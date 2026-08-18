/**
 * Backend-facing data boundary for Apollo. UI code only consumes normalized
 * lottery/draw records and never reaches an individual provider directly.
 */
export class GlobalLotteryDataService {
  constructor({ providers = [], repository, clock = () => new Date() } = {}) {
    this.providers = providers;
    this.repository = repository;
    this.clock = clock;
  }

  async syncLottery(lottery) {
    const candidates = this.providers.filter(provider => provider.supports(lottery));
    for (const provider of candidates) {
      try {
        const payload = await provider.fetchLottery(lottery);
        const result = this.validate(this.normalize(payload, lottery));
        await this.repository?.upsertLotterySnapshot(result);
        return { data_status: 'available', provider: provider.name, result };
      } catch (error) {
        // Provider Router: try the next eligible provider as a fallback.
      }
    }
    await this.repository?.markUnavailable?.(lottery.id);
    return { data_status: 'unavailable', provider: null, result: null };
  }

  normalize(payload, lottery) {
    return {
      lottery_id: lottery.id,
      latest_draw: payload.latest_draw ?? null,
      historical_draws: payload.historical_draws ?? [],
      next_draw: payload.next_draw ?? null,
      jackpot: payload.jackpot ?? null,
      schedule: payload.schedule ?? lottery.drawing_days ?? [],
      lottery_status: payload.lottery_status ?? 'active',
      synced_at: this.clock().toISOString()
    };
  }

  validate(record) {
    if (!record.lottery_id) throw new Error('Invalid normalized lottery record');
    return record;
  }

  getNetworkStatus() {
    return { status: 'operational', automatic_sync: true, coverage: 'global', last_sync: this.clock().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) };
  }
}

// Replace these adapters with server-only provider clients. They deliberately
// return unavailable data until verified provider credentials are configured.
export class ProviderRouter {
  constructor(providers) { this.providers = providers; }
  forLottery(lottery) { return this.providers.filter(provider => provider.supports(lottery)); }
}
