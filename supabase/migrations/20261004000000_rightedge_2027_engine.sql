-- RightEdge 2027 engine — competitions, fixtures, picks, settlement.
--
-- Replaces the Google Sheets engine for new competitions, starting with the
-- 2026 Rugby League World Cup. NRL continues to run off the sheet until this
-- schema is proven, so nothing in this migration touches existing behaviour:
-- it only adds tables. The legacy kv_store_f8a832e3 is left untouched.
--
-- Design is lifted from the RacingOracle schema, which has run this pattern in
-- production across thousands of settled picks. The rules that matter:
--
--   1. ENTRY PRICE IS IMMUTABLE. The price issued with a selection is stored
--      separately from every later market observation. RacingOracle learned
--      this the hard way: a single mutable `odds_at_pick` column was rewritten
--      by routine refreshes and destroyed the entry/close distinction that CLV
--      depends on. Entry and closing prices therefore live in different
--      columns, written by different processes.
--
--   2. SETTLEMENT IS DERIVED FROM THE RESULT, NOT TYPED. A score arrives from
--      a feed, `profit_units` is computed from it, and the status word is a
--      label on that computation — never the source of truth.
--
--   3. PROFIT IS UNITS, NOT A WORD. A push returns the stake; a void refunds
--      it; a loss returns nothing. Storing only win/loss cannot represent a
--      push and silently corrupts ROI.
--
--   4. FAIL CLOSED. Nothing settles without a final result. `result_status`
--      stays 'pending' rather than guessing.
--
--   5. SERVICE-ONLY WRITES. RLS is on and anon/authenticated are revoked from
--      every table. The edge function writes with the service role; the public
--      site reads through views added in a later migration.

-- ── Competitions ─────────────────────────────────────────────────────────
-- A competition dimension is what keeps RLWC round 1 from colliding with NRL
-- round 1 in archives, freeze keys and the P&L ledger. The user confirmed RLWC
-- results stay in their own ledger rather than pooling into the NRL record.

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- 'nrl' | 'rlwc' | 'nrlw'
  name text not null,
  season int not null,
  -- Competitions differ in rules that change settlement, not just branding.
  allows_draw boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column public.competitions.allows_draw is
  'True when a drawn match is a real outcome. NRL golden point makes draws near-impossible; RLWC pool matches can draw, which makes a backed team a LOSS rather than a push.';

-- ── Fixtures ─────────────────────────────────────────────────────────────

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  round_number int not null,
  round_label text not null,

  home_team text not null,
  away_team text not null,
  -- Stable sorted key so a fixture is identifiable regardless of orientation.
  match_key text not null,

  -- Kickoff is stored as an absolute instant. The venue timezone is kept
  -- alongside it for display ONLY. RLWC spans five offsets (Sydney +11,
  -- Brisbane +10, Perth +8, Port Moresby +10, Christchurch +13) and the
  -- existing two-offset string parsing cannot represent that.
  kickoff_at timestamptz not null,
  venue_timezone text not null,
  stadium text,
  broadcaster text,

  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'final', 'abandoned', 'postponed')),
  home_score int,
  away_score int,
  result_source text,
  result_captured_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, match_key, kickoff_at)
);

create index if not exists fixtures_competition_round_idx
  on public.fixtures (competition_id, round_number);
create index if not exists fixtures_kickoff_idx
  on public.fixtures (kickoff_at);
create index if not exists fixtures_status_idx
  on public.fixtures (status) where status <> 'final';

comment on column public.fixtures.kickoff_at is
  'Absolute kickoff instant. Never derive this from a timezone abbreviation string.';
comment on column public.fixtures.result_source is
  'Where the final score came from, so a disputed settlement can be audited.';

-- ── Model predictions ────────────────────────────────────────────────────
-- Separate from picks: the model produces a view of every fixture, and only
-- some of those become published plays. Keeping them apart means a prediction
-- can be evaluated even when no bet was advised.

create table if not exists public.model_predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  model_version text not null,

  projected_home_score numeric,
  projected_away_score numeric,
  home_win_probability numeric check (home_win_probability between 0 and 1),
  away_win_probability numeric check (away_win_probability between 0 and 1),
  draw_probability numeric check (draw_probability between 0 and 1),

  -- Provenance of the probability, so a soft-consensus anchor is never
  -- mistaken for a sharp one when the record is reviewed later.
  anchor_source text,
  anchor_max_spread_pct numeric,

  created_at timestamptz not null default now(),
  unique (fixture_id, model_version)
);

comment on column public.model_predictions.anchor_source is
  'e.g. betfair_midpoint | pinnacle_devig | soft_consensus. The engine must never present a soft-consensus anchor as a sharp one.';

-- ── Picks ────────────────────────────────────────────────────────────────

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  model_version text not null,

  market text not null check (market in ('h2h', 'line', 'total')),
  selection text not null,
  -- Handicap or total line. Required for line/total, null for h2h.
  point numeric,

  -- IMMUTABLE ENTRY PRICE. Written once at publication, never updated.
  entry_odds numeric not null check (entry_odds > 1),
  entry_bookmaker text not null,
  entry_captured_at timestamptz not null,
  model_probability numeric check (model_probability between 0 and 1),
  model_edge_pct numeric,

  -- CLOSING PRICE. Owned solely by the closing-odds worker.
  closing_odds numeric check (closing_odds > 1),
  closing_bookmaker text,
  closing_captured_at timestamptz,

  stake_units numeric not null default 1 check (stake_units > 0),

  -- SETTLEMENT. Derived from the fixture result, never typed by a human.
  result_status text not null default 'pending'
    check (result_status in ('pending', 'win', 'loss', 'push', 'void')),
  units_returned numeric,
  profit_units numeric,
  settled_at timestamptz,

  -- Publication state. A pick can exist privately for evaluation without ever
  -- being shown to subscribers.
  published boolean not null default false,
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One pick per market per model per fixture.
  unique (fixture_id, model_version, market, selection, point)
);

create index if not exists picks_fixture_idx on public.picks (fixture_id);
create index if not exists picks_pending_idx on public.picks (result_status)
  where result_status = 'pending';
create index if not exists picks_published_idx on public.picks (published, published_at desc);

comment on column public.picks.entry_odds is
  'Immutable price at publication. Never update this column — closing prices belong in closing_odds.';
comment on column public.picks.units_returned is
  'Units returned INCLUDING stake: win = stake x odds, push/void = stake, loss = 0. Profit is units_returned - stake_units.';
comment on column public.picks.result_status is
  'A label on the computed settlement, not its source. Always derive from the fixture result.';

-- ── Odds snapshots ───────────────────────────────────────────────────────
-- Immutable observations used to derive a genuine closing price, and to
-- measure how markets move between publication and kickoff.

create table if not exists public.odds_snapshots (
  id bigint generated always as identity primary key,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  bookmaker text not null,
  market text not null check (market in ('h2h', 'line', 'total')),
  selection text not null,
  point numeric,
  odds numeric not null check (odds > 1),
  captured_at timestamptz not null,
  minutes_before_kickoff int not null,
  created_at timestamptz not null default now(),
  unique (fixture_id, bookmaker, market, selection, point, captured_at)
);

create index if not exists odds_snapshots_fixture_capture_idx
  on public.odds_snapshots (fixture_id, market, captured_at desc);

comment on table public.odds_snapshots is
  'Service-only immutable price observations. Source of the closing price used for CLV.';

-- ── Security: service-only, matching the RacingOracle pattern ────────────

alter table public.competitions      enable row level security;
alter table public.fixtures          enable row level security;
alter table public.model_predictions enable row level security;
alter table public.picks             enable row level security;
alter table public.odds_snapshots    enable row level security;

revoke all on table public.competitions      from anon, authenticated;
revoke all on table public.fixtures          from anon, authenticated;
revoke all on table public.model_predictions from anon, authenticated;
revoke all on table public.picks             from anon, authenticated;
revoke all on table public.odds_snapshots    from anon, authenticated;

-- ── Seed the two competitions ────────────────────────────────────────────

insert into public.competitions (code, name, season, allows_draw)
values
  ('nrl',  'NRL',                     2026, false),
  ('rlwc', 'Rugby League World Cup',  2026, true)
on conflict (code) do nothing;
