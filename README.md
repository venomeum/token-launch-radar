# Token Launch Radar

An entry for make.fun's **"Build the best token launch radar"** bounty
(`token-radar-01`). It reads the competition's sealed DefiLlama snapshot,
finds the protocols that still record **no token** and are not a wrapped or
staked product of one that trades, ranks them by what their token launch
would be worth, and hands in a static dashboard that shows the board, a
detail view for every protocol, and the steps to farm each one.

An implied value is this entry's own model claim about a hypothetical
launch. It is not a prediction that any protocol will issue a token.

## Run it

Needs Node.js 22.18 or later (Node runs the TypeScript as-is; there is
nothing to install — standard library only).

```bash
# in the grader's layout: snapshot at /input/snapshot.json, outputs to /output
node main.ts

# anywhere else: point it at the kit's snapshot and a local output folder
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/input/snapshot.json
```

Outputs, all written deterministically (same snapshot in, same bytes out):

| File | What it is |
| --- | --- |
| `board.json` | The ranked board: one row per protocol, with `rank`, `implied_value_usd` and `farm_steps` |
| `data.js` | The dashboard's data (`window.RADAR`), the same rows the board carries |
| `dashboard/` | A copy of this repo's dashboard, ready to open |
| `screenshots/` | A copy of this repo's three dashboard screenshots |
| `dossier.json` | The dossier the judge reads, built by `vendor/makefun-board.ts` |

To look at the dashboard, run the program, then open `out/dashboard/index.html`
in a browser. The page needs no network: its data is the `data.js` the
program wrote beside it.

`board.json` at this repo's root is the board the program writes from the
sealed snapshot, kept here so the entry can be read without running it.
Regenerate it any time with the commands above and copy `out/board.json` over it.

## The model

Selection: a protocol is ranked when its snapshot record shows no token
(`gecko_id`, `symbol` and `mcap_usd` all null) and it is not a derivative
product — the watchlist's own exclusion rule (versioned names; Bridge,
Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX
categories; whole-word wrapped/staked/staking in the name; exchange-name
prefixes) applied to the whole snapshot rather than only the $50M floor.
That covers all 40 watchlist protocols and adds the smaller pre-token
protocols below the floor.

Implied value, from the snapshot's figures only:

```
implied = TVL x category multiple x growth x seasoning x reach
```

- **category multiple** — what one TVL dollar of that kind of protocol is
  worth in token value, stated per category in `lib/model.ts`.
- **growth** — `1 + 0.6 x clamp(change_7d, -50, +100) / 100`.
- **seasoning** — `0.75 + 0.5 x min(age_days, 1460) / 1460`: longer
  running tokenless, larger the pent-up launch. Unknown listing date
  counts as one year.
- **reach** — `1 + 3%` per extra chain beyond the first, capped at +30%.

Every row of `board.json` carries its four factors, and the dashboard's
detail view shows them, so any figure on the board can be recomputed by hand.

Farm plans are generated per protocol from its category, cheapest chain,
size and age: seven steps, each stating the action, what it costs and how
long it takes. No protocol name is hand-written anywhere in the model.

## Layout

```
main.ts                  the program (Node 22, standard library only)
lib/model.ts             selection, the value model, farm plans, gate self-check
vendor/makefun-board.ts  the kit's dossier library, copied unedited
dashboard/               index.html, app.css, app.js — static, no network
screenshots/             1-board, 2-detail, 3-filtered (1440x900)
board.json               the generated board, for reading without running
transcripts/             the build log of this entry
LICENSE                  MIT
```

## Notes for submission (not done by this repo alone)

- The repository must be public, created after the competition opened
  (2026-11-14T10:00:00Z), and entered at one commit.
- If the repo's GitHub owner is not the entering account's GitHub login,
  add `.makefun/owner.json` holding `{"wallet": "<base58 address>"}`.
- The entry is submitted with the kit's CLI together with the transcript
  bundle of the agent sessions that built it
  (`node cli/makefun.mjs bundle`, then `check`, then `submit`), and signed
  by a Solana wallet linked to the account. `transcripts/BUILD-LOG.md`
  records how this entry was built; the bundle itself is made from the
  harness's own session logs at submission time.
