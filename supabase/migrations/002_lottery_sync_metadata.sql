-- Additive metadata used by Apollo's server-side result synchronizer.
alter table public.lottery_draws
  add column if not exists provider text,
  add column if not exists source_url text,
  add column if not exists raw_payload jsonb;

alter table public.lottery_sync_runs
  add column if not exists provider text,
  add column if not exists records_received integer not null default 0,
  add column if not exists records_inserted integer not null default 0,
  add column if not exists records_updated integer not null default 0,
  add column if not exists latest_draw_date date,
  add column if not exists latency_ms integer;

alter table public.data_source_status
  add column if not exists provider text,
  add column if not exists latest_draw_date date,
  add column if not exists records_available integer not null default 0,
  add column if not exists latency_ms integer,
  add column if not exists last_error text;
