# Build log — Token Launch Radar entry (token-radar-01)

This is the builder's own work log for this entry, kept as the build went
along. It is **not** the submission transcript bundle: at submission time
the bundle is made by the kit's CLI (`node cli/makefun.mjs bundle`) from
the agent harness's own recorded session logs, and that bundle is what
the transcript gate reads. This log exists so a reader of the repository
can see what was done, in what order, and how it was checked.

Builder: Muse (Muse Spark) agent session, working for the repo owner.
All times GMT+7 (Asia/Jakarta), 2026-11-19.

## Phase 1 — research scanner (not the graded deliverable)

- ~19:19–19:25 Built `../radar.py` (in the parent folder, not this repo):
  a live new-token-launch scanner over GeckoTerminal, DexScreener and the
  Solana RPC, after the original tasking described a live scanner.
  pump.fun's own API proved Cloudflare-blocked from this machine.
- Read the official bounty page and requirements endpoint, and downloaded
  the official kit from make.fun (`/c/token-radar-01/kit`). The official
  brief is a different task — a sealed-snapshot, pre-token protocol board —
  so the entry was rebuilt to the official spec below. The scanner stays
  as research; none of its data can be a board row, because the gate only
  accepts slugs from the sealed snapshot.

## Phase 2 — the entry, built to the official spec

- ~19:25–19:27 Read in full: the kit's `RULES.txt`, `input/README.md`,
  `competition.yaml`, the starter's `main.ts` and `lib/model.ts` (for the
  program's contract and the library's API — the entry's own model, page
  and plans were written fresh), and `vendor/makefun-board.ts`.
  Wrote the plan into `../RESULT.md`.
- ~19:27 Copied `vendor/makefun-board.ts` from the kit **unedited**;
  sha256 `9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e`,
  matching the kit manifest, verified byte-identical with `cmp`.
- ~19:28 Wrote `lib/model.ts`: the selection rule (records-no-token minus
  derivative products, the watchlist's own exclusions applied snapshot-
  wide), the four-factor implied-value model with its category-multiple
  table, the seven-step farm-plan generator, snapshot parsing and a
  board self-check mirroring the gate.
- ~19:29 Wrote `main.ts`: reads the snapshot (`--input`, default
  `/input`), writes `board.json`, `data.js`, `dashboard/`, `screenshots/`
  and `dossier.json` (via the vendored `buildDossier`, written last),
  refusing to write a board its self-check rejects.
- ~19:29–19:30 Wrote the dashboard (`dashboard/index.html`, `app.css`,
  `app.js`): dark signal-room theme, sortable board, search + chain /
  category / TVL / watchlist filters, per-protocol detail view with the
  model factor breakdown and the farm plan, and a separate
  already-launched view. No network references anywhere in the source.
- ~19:30 First full run against the kit's sealed snapshot: 758 protocols
  read, 198 pre-token rows ranked, all 40 watchlist slugs covered.
  Added the `Risk Curators` category multiple (0.35) explicitly after
  seeing that category lead the board.
- ~19:30–19:31 Screenshots: opened the built page in Chromium at
  1440x900 and captured `1-board.png`, `2-detail.png` (Gauntlet, rank 3)
  and `3-filtered.png` (chain = Ethereum + watchlist only, 26 rows).
  First detail capture exposed a CSS bug — the factor bars were inline
  spans and collapsed to hairlines. Fixed (`display: block` on the bar
  and fill), rebuilt, re-captured all three, and eyeballed each one.
- ~19:31 Verification, all local, replicating the grader:
  - Determinism: two full runs into separate output folders,
    `diff -r` — byte-identical, `dossier.json` included.
  - Gate replica: dashboard_files (3 files, 25,487 bytes, no http(s)
    string anywhere), board_file (198 rows, every slug in the snapshot),
    sorted_by_value (ranks 1..198, implied non-increasing, 198 distinct
    values), coverage (40/40 watchlist), farm_steps (7 per row, all
    20..600 chars), screenshots (3 PNGs, 1440x900, 156–166 KiB each),
    dossier size 690,665 bytes (cap 1.5 MiB) — all pass.
  - dossier_matches: rebuilt the dossier from the output folder with the
    vendored library and the scorer's caps; byte-for-byte equal to the
    `dossier.json` the program wrote. Dossier text is 25,751 bytes, under
    the 65,536 cap, so the judge reads the whole dashboard source.
- ~19:31 Copied the generated `board.json` to the repo root, removed the
  local `out*` build folders, and made the first git commit.

## Environment

- Node v24.22.1 (the bounty's runtime is Node 22.18+; the code uses only
  erasable TypeScript and the standard library, as the kit requires).
- Screenshots: Chromium via Puppeteer from a sibling workspace tool;
  image dimensions/sizes verified with Pillow.
- No network was used by the entry program itself at any point; network
  was used only to fetch the brief and the kit.
