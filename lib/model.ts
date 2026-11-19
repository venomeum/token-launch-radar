// Launch Radar model: the sealed DefiLlama snapshot in, a ranked board of
// pre-token protocols out. Everything the board claims is derived from the
// snapshot's own ten fields per protocol — no protocol name is ever
// special-cased, and the same code scores every row.
//
// Selection. A protocol joins the board when its record shows no token
// (gecko_id, symbol and mcap_usd all null) and it is not a derivative
// product of a token that already trades. The derivative test is the
// watchlist's own rule, applied to the whole snapshot instead of only the
// $50M floor: no versioned names (V2, 2.0, ...), no Bridge / Canonical
// Bridge / Liquid Staking / Liquid Restaking / Restaked BTC / CEX
// category, no whole word wrapped / staked / staking in the name, and no
// exchange name at the front. That keeps every watchlist slug (the gate's
// floor) and adds the smaller pre-token protocols below it (the radar's
// reason to exist), while WBTC-style products stay off: their token
// already trades under another name.
//
// Implied value. What a launch would be worth if the protocol's record
// stayed as it is, priced the way the market prices comparable tokenized
// protocols — per dollar of TVL, then adjusted by the snapshot's other
// figures:
//
//   implied = TVL x category multiple x growth x seasoning x reach
//
//   category multiple  what one TVL dollar of this kind of protocol has
//                      historically been worth in token value (a DEX's
//                      fee stream prices richer than a stablecoin's
//                      float); table below, every value stated.
//   growth             1 + 0.6 x clamp(change_7d, -50, +100) / 100:
//                      a protocol adding TVL is worth more at launch
//                      than one leaking it; clamped so one wild week
//                      cannot dominate.
//   seasoning          0.75 + 0.5 x min(age_days, 1460) / 1460: a
//                      protocol that has run four years with no token
//                      has a larger pent-up launch than a four-week
//                      one. Unknown listing date counts as one year.
//   reach              1 + 0.03 per extra chain, capped at +30%:
//                      more chains is more distribution on day one.
//
// The dashboard shows all four factors on every protocol's detail view,
// so any reader can recompute any row by hand.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label, stated in the dashboard. */
export const MODEL_VERSION = 'launch-radar-1';

/** The model's stated constants: the dashboard prints them and the detail view uses them. */
export const GROWTH_WEIGHT = 0.6;
export const GROWTH_FLOOR = -50;
export const GROWTH_CAP = 100;
export const SEASON_BASE = 0.75;
export const SEASON_RANGE = 0.5;
export const SEASON_DAYS = 1460;
export const UNKNOWN_AGE_DAYS = 365;
export const REACH_PER_CHAIN = 0.03;
export const REACH_MAX_EXTRA = 10;

/** What one TVL dollar is worth in token value, by DefiLlama category. */
const CATEGORY_MULTIPLE: Record<string, number> = {
  'Dexs': 0.8,
  'Lending': 0.55,
  'CDP': 0.5,
  'CDP Manager': 0.5,
  'Chain': 1.2,
  'Derivatives': 0.7,
  'Interest Rate Derivatives': 0.55,
  'Options': 0.6,
  'Options Vault': 0.45,
  'Prediction Market': 0.9,
  'Launchpad': 0.9,
  'AI Agents': 0.85,
  'Decentralized AI': 0.7,
  'Privacy': 0.55,
  'Payments': 0.5,
  'Crypto Card Issuer': 0.45,
  'NFT Marketplace': 0.45,
  'Liquid Staking': 0.45,
  'Liquid Restaking': 0.4,
  'RWA': 0.4,
  'OTC Marketplace': 0.4,
  'Insurance': 0.4,
  'Onchain Capital Allocator': 0.35,
  'Risk Curators': 0.35,
  'Liquidity Manager': 0.35,
  'Collateral Management': 0.35,
  'CeDeFi': 0.35,
  'Decentralized BTC': 0.35,
  'Indexes': 0.35,
  'Yield': 0.35,
  'Farm': 0.3,
  'Leveraged Farming': 0.3,
  'Bridge': 0.3,
  'Cross Chain Bridge': 0.3,
  'Canonical Bridge': 0.3,
  'Basis Trading': 0.3,
  'Anchor BTC': 0.3,
  'Governance Incentives': 0.3,
  'Restaked BTC': 0.35,
  'DOR': 0.4,
  'Algo-Stables': 0.15,
  'Dual-Token Stablecoin': 0.2,
  'Stablecoin': 0.15,
};

/** The category multiple for a protocol, exact table first, then keyword families, then the default. */
export function categoryMultiple(category: string | null): number {
  if (category !== null && category in CATEGORY_MULTIPLE) return CATEGORY_MULTIPLE[category]!;
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return 0.55;
  if (c.includes('dex') || c.includes('swap')) return 0.8;
  if (c.includes('perpetual') || c.includes('derivative')) return 0.7;
  if (c.includes('option')) return 0.55;
  if (c.includes('stake') || c.includes('staking') || c.includes('restak')) return 0.42;
  if (c.includes('stable')) return 0.18;
  if (c.includes('bridge')) return 0.3;
  if (c.includes('yield') || c.includes('farm') || c.includes('vault')) return 0.32;
  if (c.includes('insur')) return 0.4;
  if (c.includes('pay')) return 0.5;
  if (c.includes('launch')) return 0.9;
  if (c.includes('predict')) return 0.9;
  if (c.includes('index')) return 0.35;
  if (c.includes('rwa') || c.includes('real world')) return 0.4;
  if (c.includes('chain')) return 1.1;
  return 0.4;
}

/** A finite number, else the fallback. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const DAY_MS = 86_400_000;

/** Whole days from the listing date to the snapshot date; null when the date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The four factors and the implied value one protocol gets. */
export interface Scored {
  implied: number;
  category_multiple: number;
  growth_pct: number;
  growth_multiplier: number;
  season_multiplier: number;
  reach_multiplier: number;
  age_days: number | null;
}

export function impliedValue(p: SnapshotProtocol, asOf: string): Scored {
  const age = ageDays(asOf, p.listed_at);
  const cat = categoryMultiple(p.category);
  const growthPct = Math.min(GROWTH_CAP, Math.max(GROWTH_FLOOR, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * GROWTH_WEIGHT;
  const ageForModel = age ?? UNKNOWN_AGE_DAYS;
  const seasonMult = SEASON_BASE + (Math.min(Math.max(ageForModel, 0), SEASON_DAYS) / SEASON_DAYS) * SEASON_RANGE;
  const extraChains = Math.min(Math.max(p.chains.length - 1, 0), REACH_MAX_EXTRA);
  const reachMult = 1 + extraChains * REACH_PER_CHAIN;
  const implied = Math.max(1, Math.round(p.tvl_usd * cat * growthMult * seasonMult * reachMult));
  return {
    implied,
    category_multiple: cat,
    growth_pct: growthPct,
    growth_multiplier: growthMult,
    season_multiplier: seasonMult,
    reach_multiplier: reachMult,
    age_days: age,
  };
}

// ---------------------------------------------------------------- selection

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are products of another asset, not protocols awaiting their own launch. */
const DERIVATIVE_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Names that begin with an exchange's name are that exchange's products. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether the record shows no token: no CoinGecko id, no ticker, no market cap. */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null && p.mcap_usd === null;
}

/** Whether a no-token protocol is a wrapped, staked, bridged or versioned product of another. */
export function isDerivative(p: SnapshotProtocol): boolean {
  if (p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) return true;
  if (VERSIONED.test(p.name)) return true;
  const words = p.name.toLowerCase().split(/[^a-z]+/);
  if (words.includes('wrapped') || words.includes('staked') || words.includes('staking')) return true;
  return EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x));
}

/** Whether the board ranks this protocol: records no token and is not a derivative product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return recordsNoToken(p) && !isDerivative(p);
}

// ---------------------------------------------------------------- farm plans

/** Chains where a small farmer's gas stays cheap, preferred in that order. */
const CHEAP_CHAINS = ['Solana', 'Base', 'Arbitrum', 'Optimism', 'Polygon', 'BSC', 'Avalanche', 'Sui', 'Aptos', 'Near'];

/** The chain a plan works on: the cheapest chain the protocol runs on, else its first. */
export function planChain(p: SnapshotProtocol): string {
  for (const c of CHEAP_CHAINS) if (p.chains.includes(c)) return c;
  return p.chains.length > 0 ? p.chains[0]! : 'Ethereum';
}

/** A round trip's gas on a chain, in the plain dollars a plan states. */
function gasFor(chain: string): string {
  if (chain === 'Solana' || chain === 'Sui' || chain === 'Aptos' || chain === 'Near') return 'about $1 of gas in total';
  if (chain === 'Ethereum') return 'about $15 of gas at typical fees, less on a quiet weekend';
  if (chain === 'BSC' || chain === 'Polygon') return 'about $1 of gas in total';
  return 'about $2 of gas in total';
}

/** How much capital one position carries, from the protocol's own size. */
function capitalFor(tvl: number): number {
  if (tvl >= 1_000_000_000) return 250;
  if (tvl >= 250_000_000) return 150;
  if (tvl >= 50_000_000) return 100;
  if (tvl >= 10_000_000) return 50;
  return 25;
}

/** The core action, in the words of the protocol's own category. */
function coreAction(p: SnapshotProtocol, chain: string, capital: number): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp'))
    return `Supply $${capital} of USDC to ${n} on ${chain}, then borrow no more than 30% against it and re-supply the borrow once, so both sides of the market see the wallet`;
  if (c.includes('dex') || c.includes('swap'))
    return `Add $${capital} of liquidity, split evenly between USDC and the pool's main asset, to ${n}'s deepest pool on ${chain}, then make two small swaps through the same pool`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('option'))
    return `Deposit $${capital} of USDC as margin on ${n} and open one small hedged position (long and short of near-equal size), so the account trades without betting on direction`;
  if (c.includes('bridge'))
    return `Bridge $${capital} of USDC to ${chain} through ${n}, then use the bridged funds in one app on the far side instead of bridging straight back`;
  if (c.includes('stake') || c.includes('restak'))
    return `Stake $${capital} of the chain's staking asset through ${n} on ${chain} and hold the staking receipt in the same wallet`;
  if (c.includes('stable'))
    return `Mint or deposit $${capital} of ${n}'s stable asset against USDC on ${chain}, and hold the stable asset rather than swapping it away`;
  if (c.includes('predict'))
    return `Fund $${capital} on ${n} and take one position in its most liquid market, then let the market settle rather than trading out early`;
  if (c.includes('launch'))
    return `Take part in one launch on ${n} with $${capital} on ${chain}, and keep the launched position instead of flipping it on day one`;
  if (c.includes('pay') || c.includes('card'))
    return `Route $${capital} of ordinary spending or one payment through ${n} on ${chain}, the way a real user of the product would`;
  if (c.includes('rwa') || c.includes('real world'))
    return `Mint $${capital} of ${n}'s yield-bearing asset on ${chain} and hold it to at least one distribution date`;
  if (c.includes('insur'))
    return `Buy $${capital} of cover from ${n} on ${chain} for a position you actually hold, and keep the policy to its end date`;
  if (c.includes('chain'))
    return `Bridge $${capital} to ${n}'s chain, swap a little for its gas token, and make one deposit into an app that runs on it`;
  if (c.includes('index'))
    return `Buy and hold $${capital} of ${n}'s main index or basket product on ${chain}`;
  return `Deposit $${capital} of USDC into ${n}'s main product on ${chain} and keep the position open, the way a real user would`;
}

/** A follow-through action that fits the same category. */
function secondAction(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp'))
    return `Repay a slice of the borrow and borrow again once, so the wallet shows a full lend-borrow-repay cycle on ${n}`;
  if (c.includes('dex') || c.includes('swap'))
    return `Move a quarter of the liquidity to a second ${n} pool on ${chain}, so the wallet is not riding on a single pair`;
  if (c.includes('bridge'))
    return `Bridge a smaller amount back a week later rather than the same day, so the two crossings read as use, not as a round trip`;
  if (c.includes('stake') || c.includes('restak'))
    return `Claim any staking rewards ${n} shows and restake them once instead of selling them`;
  if (c.includes('chain'))
    return `Use a second app on ${n}'s chain with the same wallet, so the wallet's activity is a pattern of use, not one deposit`;
  return `Repeat the core action once at half size in the second week, so the wallet's history on ${n} is a pattern, not a single visit`;
}

/** How many weeks of cadence a plan asks for, from the protocol's age: younger boards qualify longer. */
function weeksFor(age: number | null): number {
  if (age === null) return 6;
  if (age < 180) return 8;
  if (age < 730) return 6;
  return 4;
}

/**
 * A protocol's farm plan: seven steps, each one string of action, cost and
 * time, generated from the protocol's record alone (category, chains,
 * TVL, age). No name is hand-written anywhere in it.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = planChain(p);
  const capital = capitalFor(p.tvl_usd);
  const weeks = weeksFor(age);
  const holdDays = weeks * 7;
  const steps = [
    `Start with a fresh wallet used only for this farm, and fund it on ${chain} with the position money plus a little of the gas token. Cost: ${gasFor(chain)}. Time: 10 minutes.`,
    `${coreAction(p, chain, capital)}. Cost: $${capital} of capital in the position, plus ${gasFor(chain)}. Time: 15 minutes to set up.`,
    `${secondAction(p, chain)}. Cost: about $2 of gas. Time: 10 minutes.`,
    `Keep a weekly cadence for ${weeks} weeks: one small qualifying action a week (a deposit, a swap, a claim or a vote), never a burst in one day. Cost: about $2 of gas a week. Time: 5 minutes a week.`,
    `Hold the position at least ${holdDays} days and across a month-end, when activity snapshots are usually taken; do not withdraw the week a launch is rumoured. Cost: the $${capital} stays in the position. Time: ${holdDays} days.`,
    `Check ${p.name}'s official announcements once a week for a points, snapshot or claim post, and claim only from a link the protocol itself publishes; never pay a fee to claim. Cost: $0. Time: 5 minutes a week.`,
    `Log the wallet, the dates and every transaction hash in a farm diary as you go, so the position can be repeated, proven or unwound later. Cost: $0. Time: 5 minutes.`,
  ];
  return steps.map((s) => {
    let t = s.trim();
    if (t.length > 600) t = `${t.slice(0, 596)}...`;
    if (t.length < 20) t = `${t} Hold the position and re-check weekly.`;
    return t;
  });
}

// ---------------------------------------------------------------- the board

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  implied_multiple: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    season_multiplier: number;
    reach_multiplier: number;
  };
  farm_steps: string[];
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The board: every rankable protocol, scored, ranked by implied value, ties broken by slug. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const watch = new Set(snapshot.watchlist);
  const scored = snapshot.protocols
    .filter(isRankable)
    .map((p) => ({ p, s: impliedValue(p, snapshot.as_of) }));
  scored.sort((a, b) => b.s.implied - a.s.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map(({ p, s }, i) => ({
    rank: i + 1,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    listed_at: p.listed_at,
    age_days: s.age_days,
    watchlist: watch.has(p.slug),
    implied_value_usd: s.implied,
    implied_multiple: round4(s.implied / Math.max(p.tvl_usd, 1)),
    model: {
      category_multiple: s.category_multiple,
      growth_pct: s.growth_pct,
      growth_multiplier: round4(s.growth_multiplier),
      season_multiplier: round4(s.season_multiplier),
      reach_multiplier: round4(s.reach_multiplier),
    },
    farm_steps: farmSteps(p, s.age_days),
  }));
}

/** A protocol whose token already trades: shown apart, at the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

/** How many already-launched protocols the dashboard's Live view carries. */
export const LIVE_ROWS = 24;

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !recordsNoToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
    }));
}

/** Everything the dashboard renders: the board with its farm plans, the live set, the model stated. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  counts: { protocols: number; watchlist: number; board: number; live: number };
  rows: BoardRow[];
  live: LiveRow[];
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    counts: {
      protocols: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      board: board.length,
      live: live.length,
    },
    rows: board,
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------- input & gate

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null. Mirrors the gate's own board rows. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const r of board) {
    if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
    if (seen.has(r.slug)) return `${r.slug} appears twice`;
    seen.add(r.slug);
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  const missing = snapshot.watchlist.filter((s) => !seen.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < byRank.length; i++) if (byRank[i]!.rank !== i + 1) return `rank ${i + 1} is ${byRank[i]!.rank}`;
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `rank ${byRank[i]!.rank} outvalues rank ${byRank[i - 1]!.rank}`;
  }
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) {
    return 'every row shares one implied value: a board that ranks nothing by value is not a ranking';
  }
  return null;
}

/** The dashboard's data as one script: window.RADAR, no fetch, no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
