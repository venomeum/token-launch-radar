// Token Launch Radar dashboard. Renders window.RADAR (written by main.ts
// beside this folder as data.js) as a ranked board with filters, sortable
// columns, a per-protocol detail view and a separate already-launched
// view. No network, no framework: every byte shown comes from data.js,
// and the farm plans are the very strings board.json carries.
(function () {
  'use strict';

  var D = window.RADAR;
  var app = document.getElementById('app');
  if (!D || !app) return;

  var state = {
    view: 'board',
    q: '',
    chain: 'all',
    category: 'all',
    minTvl: 0,
    watchOnly: false,
    sort: 'rank',
    dir: 1,
    selected: D.rows.length ? D.rows[0].slug : null,
  };

  // ---------- formatting ----------
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined) return '<span class="flat">n/a</span>';
    var cls = n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat';
    return '<span class="' + cls + '">' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }
  function age(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 730) return (days / 365).toFixed(1) + ' yrs';
    if (days >= 365) return '1.0 yrs';
    if (days >= 60) return Math.round(days / 30.4) + ' mo';
    return days + ' d';
  }
  function mult(x) { return 'x' + x.toFixed(2); }

  // ---------- filtering & sorting ----------
  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var key = state.sort, dir = state.dir;
    var val = {
      rank: function (r) { return r.rank; },
      name: function (r) { return r.name.toLowerCase(); },
      tvl: function (r) { return r.tvl_usd; },
      change: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
      age: function (r) { return r.age_days === null ? -1 : r.age_days; },
      implied: function (r) { return r.implied_value_usd; },
      multiple: function (r) { return r.implied_multiple; },
    }[key];
    rows.sort(function (a, b) {
      var va = val(a), vb = val(b);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.rank - b.rank;
    });
    return rows;
  }

  function bySlug(slug) {
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) return D.rows[i];
    return null;
  }

  // ---------- static frame ----------
  var chains = {}, cats = {};
  D.rows.forEach(function (r) {
    r.chains.forEach(function (c) { chains[c] = 1; });
    cats[r.category || 'Uncategorised'] = 1;
  });
  var chainOpts = Object.keys(chains).sort().map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  var catOpts = Object.keys(cats).sort().map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  var watchCount = D.rows.filter(function (r) { return r.watchlist; }).length;
  var earlyCount = D.rows.length - watchCount;
  var top = D.rows[0];

  app.innerHTML =
    '<header class="masthead">' +
      '<p class="kicker">Token Launch Radar</p>' +
      '<h1>Protocols with <span class="signal">no token yet</span>, ranked by what their launch would be worth</h1>' +
      '<p class="lede">One sealed snapshot of every protocol DefiLlama tracks at $5M TVL or more, read on ' +
        esc(D.as_of) + '. The board ranks the ones that still record <strong>no token</strong> and are not a wrapped or ' +
        'staked product of one that trades, by an <strong>implied value</strong> worked out from the snapshot itself. ' +
        'Every row carries the steps to farm it. An implied value is this board\'s own model claim, not a prediction ' +
        'that a token will exist.</p>' +
      '<div class="stats">' +
        '<div class="stat"><b>' + D.counts.protocols + '</b><span>protocols scanned</span></div>' +
        '<div class="stat"><b>' + D.counts.watchlist + '</b><span>on the watchlist</span></div>' +
        '<div class="stat hot"><b>' + D.counts.board + '</b><span>pre-token rows ranked</span></div>' +
        '<div class="stat"><b>' + usd(top ? top.implied_value_usd : 0) + '</b><span>top implied value</span></div>' +
        '<div class="stat"><b>' + usd(D.floor_usd) + '</b><span>watchlist TVL floor</span></div>' +
      '</div>' +
      '<div class="model-strip"><b>The model.</b> <span class="formula">implied = TVL x category multiple x growth x seasoning x reach</span> ' +
        'The category multiple prices a TVL dollar the way comparable tokenized protocols trade; growth clamps the 7-day TVL change to ' +
        '-50%..+100% at 0.6 weight; seasoning grows from 0.75 to 1.25 over four tokenless years; reach adds 3% per extra chain, capped at +30%. ' +
        'Open any protocol to see its four factors. Model ' + esc(D.model_version) + '.</div>' +
    '</header>' +
    '<nav class="views">' +
      '<button class="view-tab" id="tab-board" aria-pressed="true">Pre-token board (' + D.counts.board + ')</button>' +
      '<button class="view-tab" id="tab-live" aria-pressed="false">Already launched (' + D.counts.live + ')</button>' +
    '</nav>' +
    '<section id="view-board">' +
      '<div class="controls">' +
        '<label>Search<input type="search" id="f-q" placeholder="Name, category, slug"></label>' +
        '<label>Chain<select id="f-chain"><option value="all">All chains</option>' + chainOpts + '</select></label>' +
        '<label>Category<select id="f-category"><option value="all">All categories</option>' + catOpts + '</select></label>' +
        '<label>Min TVL<select id="f-tvl">' +
          '<option value="0">Any size</option><option value="10000000">$10M+</option>' +
          '<option value="50000000">$50M+</option><option value="250000000">$250M+</option>' +
          '<option value="1000000000">$1B+</option></select></label>' +
        '<label class="check"><input type="checkbox" id="f-watch"> Watchlist only (' + watchCount + ')</label>' +
        '<span class="count" id="f-count"></span>' +
      '</div>' +
      '<div class="board-wrap"><table class="board"><thead><tr>' +
        '<th data-sort="rank" class="l">#</th>' +
        '<th data-sort="name" class="l">Protocol</th>' +
        '<th class="l">Chains</th>' +
        '<th data-sort="tvl">TVL</th>' +
        '<th data-sort="change">7d</th>' +
        '<th data-sort="age">Tokenless for</th>' +
        '<th data-sort="implied">Implied value</th>' +
        '<th data-sort="multiple">x TVL</th>' +
      '</tr></thead><tbody id="rows"></tbody></table>' +
      '<div class="empty" id="rows-empty" hidden>No protocol matches those filters. Loosen one and the board fills again.</div></div>' +
      '<div id="detail"></div>' +
    '</section>' +
    '<section id="view-live" hidden>' +
      '<p class="live-note"><b>Already launched.</b> These protocols\' tokens trade today, so the board shows the ' +
      'market\'s own market cap and never ranks them with the model. They are here so the separation is visible: ' +
      'a radar that mixes the two would be pricing launches that already happened.</p>' +
      '<div class="board-wrap"><table class="board"><thead><tr>' +
        '<th class="l">Protocol</th><th class="l">Ticker</th><th class="l">Category</th>' +
        '<th>TVL</th><th>Market cap</th><th>7d</th>' +
      '</tr></thead><tbody id="live-rows"></tbody></table></div>' +
    '</section>' +
    '<footer><b>How to read this board.</b> Rank is the model\'s claim about relative launch value, nothing more: ' +
    'it says a protocol records no token, never that it has none — a record can lag a launch. Farm plans are ' +
    'generated from each protocol\'s category, chains, size and age, and state their own costs and times; capital ' +
    'in any farm is at risk, and most farmed protocols never issue a token. Snapshot source, as recorded in the ' +
    'sealed input: <span id="src"></span></footer>';

  document.getElementById('src').textContent = D.source;

  // ---------- board rendering ----------
  var rowsEl = document.getElementById('rows');
  var emptyEl = document.getElementById('rows-empty');
  var countEl = document.getElementById('f-count');
  var detailEl = document.getElementById('detail');

  function rowHtml(r) {
    var badge = r.watchlist
      ? '<span class="badge">WATCHLIST</span>'
      : '<span class="badge early">EARLY</span>';
    var chainTxt = r.chains.length === 0 ? 'n/a'
      : esc(r.chains[0]) + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '');
    return '<tr data-slug="' + esc(r.slug) + '"' +
      (r.slug === state.selected ? ' class="selected' + (r.rank <= 3 ? ' top' : '') + '"' : (r.rank <= 3 ? ' class="top"' : '')) + '>' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td class="l"><span class="pname">' + esc(r.name) + '</span>' + badge +
        '<span class="pcat">' + esc(r.category || 'Uncategorised') + '</span></td>' +
      '<td class="l chains">' + chainTxt + '</td>' +
      '<td>' + usd(r.tvl_usd) + '</td>' +
      '<td>' + pct(r.change_7d) + '</td>' +
      '<td>' + age(r.age_days) + '</td>' +
      '<td class="implied">' + usd(r.implied_value_usd) + '</td>' +
      '<td class="mult">' + mult(r.implied_multiple) + '</td></tr>';
  }

  function factorRow(name, val, frac, amber, label) {
    var w = Math.max(2, Math.min(100, Math.round(frac * 100)));
    return '<div class="factor' + (amber ? ' amber' : '') + '">' +
      '<span class="f-name">' + esc(name) + '</span>' +
      '<span class="f-bar"><span class="f-fill" style="width:' + w + '%"></span></span>' +
      '<span class="f-val">' + esc(label !== undefined ? label : 'x' + val.toFixed(2)) + '</span></div>';
  }

  function detailHtml(r) {
    var m = r.model;
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    return '<article class="detail" id="detail-panel">' +
      '<div class="d-head"><h2>#' + r.rank + ' ' + esc(r.name) + '</h2>' +
      (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '<span class="badge early">EARLY — BELOW THE $50M FLOOR</span>') +
      '<span class="d-sub">' + esc(r.category || 'Uncategorised') + ' · records no token</span>' +
      '<div class="d-implied"><b>' + usd(r.implied_value_usd) + '</b><span>implied launch value</span></div></div>' +
      '<div class="d-grid">' +
        '<div class="d-cell"><span>TVL</span><b>' + usd(r.tvl_usd) + '</b></div>' +
        '<div class="d-cell"><span>TVL change, 7d</span><b>' + pct(r.change_7d) + '</b></div>' +
        '<div class="d-cell"><span>Tracked since</span><b>' + esc(r.listed_at || 'unknown') + '</b></div>' +
        '<div class="d-cell"><span>Tokenless for</span><b>' + age(r.age_days) + '</b></div>' +
        '<div class="d-cell"><span>Chains</span><b>' + r.chains.length + '</b></div>' +
        '<div class="d-cell"><span>Implied x TVL</span><b>' + mult(r.implied_multiple) + '</b></div>' +
      '</div>' +
      '<p class="d-note">Runs on: ' + esc(r.chains.join(', ') || 'no chains recorded') + '.</p>' +
      '<h3>Why this value — the model, factor by factor</h3>' +
      '<div class="factors">' +
        factorRow('TVL (snapshot)', r.tvl_usd, Math.min(1, r.tvl_usd / 3e9), false, usd(r.tvl_usd)) +
        factorRow('Category multiple (' + (r.category || 'default') + ')', m.category_multiple, m.category_multiple / 1.2, false) +
        factorRow('Growth (7d ' + (m.growth_pct > 0 ? '+' : '') + m.growth_pct.toFixed(1) + '%)', m.growth_multiplier, m.growth_multiplier / 1.6, false) +
        factorRow('Seasoning (' + age(r.age_days) + ' tokenless)', m.season_multiplier, (m.season_multiplier - 0.7) / 0.6, false) +
        factorRow('Reach (' + r.chains.length + ' chains)', m.reach_multiplier, (m.reach_multiplier - 0.95) / 0.4, false) +
        '<div class="factor total"><span class="f-name">Implied value</span><span></span>' +
          '<span class="f-val">' + usd(r.implied_value_usd) + '</span></div>' +
      '</div>' +
      '<h3>Farm plan — what to do before a launch</h3>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<p class="d-note">The plan is generated from this protocol\'s category, chains, size and age — the same ' +
      'plan board.json carries for this row. It assumes no token is promised: the position should make sense ' +
      'even if no launch ever comes.</p>' +
    '</article>';
  }

  function renderBoard() {
    var rows = visibleRows();
    rowsEl.innerHTML = rows.map(rowHtml).join('');
    emptyEl.hidden = rows.length !== 0;
    countEl.textContent = rows.length + ' of ' + D.rows.length + ' rows';
    var sel = bySlug(state.selected);
    detailEl.innerHTML = sel ? detailHtml(sel) : '';
    var ths = document.querySelectorAll('th[data-sort]');
    for (var i = 0; i < ths.length; i++) {
      ths[i].classList.toggle('sorted', ths[i].getAttribute('data-sort') === state.sort);
    }
  }

  function renderLive() {
    document.getElementById('live-rows').innerHTML = D.live.map(function (r) {
      return '<tr><td class="l"><span class="pname">' + esc(r.name) + '</span></td>' +
        '<td class="l"><span class="sym">' + esc(r.symbol || '—') + '</span></td>' +
        '<td class="l chains">' + esc(r.category || 'Uncategorised') + '</td>' +
        '<td>' + usd(r.tvl_usd) + '</td><td>' + usd(r.mcap_usd) + '</td><td>' + pct(r.change_7d) + '</td></tr>';
    }).join('');
  }

  // ---------- events ----------
  document.getElementById('f-q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  document.getElementById('f-chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  document.getElementById('f-category').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  document.getElementById('f-tvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); renderBoard(); });
  document.getElementById('f-watch').addEventListener('change', function (e) { state.watchOnly = e.target.checked; renderBoard(); });
  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
    if (!tr) return;
    state.selected = tr.getAttribute('data-slug');
    renderBoard();
    var panel = document.getElementById('detail-panel');
    if (panel) panel.scrollIntoView({ block: 'nearest' });
  });
  var ths = document.querySelectorAll('th[data-sort]');
  for (var i = 0; i < ths.length; i++) {
    ths[i].addEventListener('click', function () {
      var k = this.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = (k === 'name') ? 1 : -1; }
      if (k === 'rank') state.dir = 1;
      renderBoard();
    });
  }
  function setView(v) {
    state.view = v;
    document.getElementById('tab-board').setAttribute('aria-pressed', v === 'board' ? 'true' : 'false');
    document.getElementById('tab-live').setAttribute('aria-pressed', v === 'live' ? 'true' : 'false');
    document.getElementById('view-board').hidden = v !== 'board';
    document.getElementById('view-live').hidden = v !== 'live';
  }
  document.getElementById('tab-board').addEventListener('click', function () { setView('board'); });
  document.getElementById('tab-live').addEventListener('click', function () { setView('live'); });

  app.setAttribute('aria-busy', 'false');
  renderBoard();
  renderLive();
})();
