/* ============================================
   BoomBoomMovie TV — Home / Browse (guest mode)
   ============================================ */

(() => {
  const state = {
    movies: [],
    series: [],
    tmdbCache: new Map(),
    heroItem: null
  };

  // Diag panel — revealed if init takes too long
  const Diag = {
    el:  () => document.getElementById('tv-diag'),
    api: (t) => { const e = document.getElementById('tv-diag-api'); if (e) e.textContent = '📡 API : ' + t; },
    err: (t) => { const e = document.getElementById('tv-diag-err'); if (e) e.textContent = t || ''; if (t) Diag.show(); },
    show: () => { const e = Diag.el(); if (e) e.style.display = 'block'; }
  };

  document.addEventListener('keydown', (e) => {
    const k = document.getElementById('tv-diag-key');
    if (k) k.textContent = `⌨️ Dernière touche : ${e.key} (code=${e.code})`;
  }, true);

  const diagTimer = setTimeout(() => Diag.show(), 6000);

  // ----------------------------------------
  // Entry — no auth in guest mode
  // ----------------------------------------
  async function init() {
    try {
      Diag.api('chargement du catalogue…');
      await loadCatalog();
      Diag.api(`OK — ${state.movies.length} films, ${state.series.length} séries`);
      render();
      clearTimeout(diagTimer);
      setTimeout(() => { const e = Diag.el(); if (e) e.style.display = 'none'; }, 2000);
    } catch (err) {
      console.error('TV home init failed:', err);
      Diag.api('ÉCHEC');
      Diag.err('⚠️ ' + (err.message || 'Impossible de charger le catalogue.'));
      document.getElementById('tv-hero-title').textContent = 'Erreur de chargement';
      document.getElementById('tv-hero-overview').textContent = err.message || 'Impossible de charger le catalogue.';
    } finally {
      BBM.TV.Loading.hide();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ----------------------------------------
  // Catalog & TMDB
  // ----------------------------------------
  async function loadCatalog() {
    await BBM.API.fetchAllItems();
    state.movies = BBM.API.getMovies();
    state.series = BBM.API.getSeries();

    const unique = new Map();
    state.movies.forEach(m => unique.set(m.tmdbID, { tmdbID: m.tmdbID, category: 'movie' }));
    state.series.forEach(s => unique.set(s.tmdbID, { tmdbID: s.tmdbID, category: 'series' }));

    state.tmdbCache = await BBM.API.batchFetchTMDB([...unique.values()], 12);
  }

  // ----------------------------------------
  // Render
  // ----------------------------------------
  function render() {
    setupTopBar();
    renderHero();
    renderRows('all');
    requestAnimationFrame(() => {
      document.getElementById('hero-play')?.focus();
    });
  }

  function setupTopBar() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === btn));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderRows(filter);
        requestAnimationFrame(() => {
          const first = document.querySelector('#tv-rows .tv-focusable');
          if (first) first.focus();
        });
      });
    });
  }

  function renderHero() {
    const recent = BBM.API.getRecentlyAdded(40)
      .map(item => {
        const tmdb = state.tmdbCache.get(item.tmdbID);
        return tmdb ? { item, tmdb } : null;
      })
      .filter(x => x && x.tmdb.backdrop_path);

    if (recent.length === 0) return;

    const pick = recent[Math.floor(Math.random() * Math.min(8, recent.length))];
    state.heroItem = pick;

    const { item, tmdb } = pick;
    const title = tmdb.title || tmdb.name || item.title || item.seriesTitle;
    const year = (tmdb.release_date || tmdb.first_air_date || '').slice(0, 4);
    const rating = tmdb.vote_average ? tmdb.vote_average.toFixed(1) : null;
    const type = item.category === 'movie' ? 'Film' : 'Série';
    const runtime = tmdb.runtime ? `${tmdb.runtime} min` : null;

    document.getElementById('tv-hero-bg').style.backgroundImage =
      `url(${BBM.API.getBackdropURL(tmdb.backdrop_path)})`;
    document.getElementById('tv-hero-title').textContent = title;

    const meta = document.getElementById('tv-hero-meta');
    meta.innerHTML = '';
    if (rating) {
      meta.insertAdjacentHTML('beforeend',
        `<span class="tv-hero-chip rating"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg> ${rating}</span>`);
    }
    if (year) meta.insertAdjacentHTML('beforeend', `<span class="tv-hero-chip">${year}</span>`);
    meta.insertAdjacentHTML('beforeend', `<span class="tv-hero-chip">${type}</span>`);
    if (runtime) meta.insertAdjacentHTML('beforeend', `<span class="tv-hero-chip">${runtime}</span>`);
    meta.insertAdjacentHTML('beforeend', `<span class="tv-hero-chip" style="font-weight:800;color:var(--tv-accent-bright);border-color:rgba(var(--tv-accent-rgb),0.5)">HD</span>`);

    document.getElementById('tv-hero-overview').textContent = tmdb.overview || '';

    document.getElementById('hero-play').onclick = () => playItem(item, tmdb);
    document.getElementById('hero-info').onclick = () => openDetail(item, tmdb);
  }

  function renderRows(filter = 'all') {
    const rowsEl = document.getElementById('tv-rows');
    const hero = document.getElementById('tv-hero');
    rowsEl.innerHTML = '';

    if (filter === 'all') {
      hero.style.display = '';
      rowsEl.appendChild(buildTop10Row());
      rowsEl.appendChild(buildRow('Récemment ajoutés', BBM.API.getRecentlyAdded(25)));
      rowsEl.appendChild(buildRow('Films populaires', withTmdb(state.movies).slice(0, 25)));
      rowsEl.appendChild(buildRow('Séries populaires', withTmdb(state.series).slice(0, 25)));
      buildGenreRows().forEach(row => rowsEl.appendChild(row));
    } else {
      hero.style.display = 'none';
      const source = filter === 'movies' ? state.movies : state.series;
      const title = filter === 'movies' ? 'Tous les films' : 'Toutes les séries';
      renderGrid(rowsEl, title, withTmdb(source));
    }
  }

  function renderGrid(container, title, items) {
    const header = document.createElement('div');
    header.className = 'tv-grid-header';
    header.innerHTML = `
      <h1 class="tv-grid-title">${title}</h1>
      <span class="tv-grid-count">${items.length}</span>
    `;
    container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'tv-grid';
    items.forEach(item => {
      const card = buildCard(item);
      if (card) grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  function buildTop10Row() {
    // Top 10 by popularity
    const all = withTmdb([...state.movies, ...state.series]).slice(0, 10);
    const row = document.createElement('section');
    row.className = 'tv-row tv-row-top10';
    row.innerHTML = `<h2 class="tv-row-title"><span>Top 10 cette semaine</span></h2>`;

    const scroller = document.createElement('div');
    scroller.className = 'tv-row-scroller';
    all.forEach((item, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'tv-top10-item';
      const num = document.createElement('div');
      num.className = 'tv-top10-number';
      num.textContent = i + 1;
      wrap.appendChild(num);
      const card = buildCard(item);
      if (card) wrap.appendChild(card);
      scroller.appendChild(wrap);
    });
    row.appendChild(scroller);
    return row;
  }

  function buildGenreRows() {
    const allItems = [...state.movies, ...state.series];
    const seen = new Set();
    const genreMap = new Map();

    allItems.forEach(item => {
      const tmdb = state.tmdbCache.get(item.tmdbID);
      if (!tmdb || !tmdb.genres) return;
      tmdb.genres.forEach(g => {
        const key = `${g.id}_${item.tmdbID}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (!genreMap.has(g.id)) genreMap.set(g.id, { name: g.name, items: [] });
        genreMap.get(g.id).items.push(item);
      });
    });

    return [...genreMap.values()]
      .filter(g => g.items.length >= 5)
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 6)
      .map(g => buildRow(g.name, withTmdb(g.items).slice(0, 25)))
      .filter(Boolean);
  }

  function withTmdb(items) {
    return [...items]
      .map(i => ({ item: i, tmdb: state.tmdbCache.get(i.tmdbID) }))
      .filter(x => x.tmdb)
      .sort((a, b) => (b.tmdb.popularity || 0) - (a.tmdb.popularity || 0))
      .map(x => x.item);
  }

  function buildRow(title, items) {
    const row = document.createElement('section');
    row.className = 'tv-row';

    const h = document.createElement('h2');
    h.className = 'tv-row-title';
    h.innerHTML = `<span>${escapeHtml(title)}</span>`;
    row.appendChild(h);

    const scroller = document.createElement('div');
    scroller.className = 'tv-row-scroller';

    items.forEach(item => {
      const card = buildCard(item);
      if (card) scroller.appendChild(card);
    });

    if (scroller.children.length === 0) return null;
    row.appendChild(scroller);
    return row;
  }

  function buildCard(item) {
    const tmdb = state.tmdbCache.get(item.tmdbID);
    const title = (tmdb?.title || tmdb?.name || item.title || item.seriesTitle || 'Sans titre');

    const card = document.createElement('div');
    card.className = 'tv-card tv-focusable';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', title);

    const poster = tmdb?.poster_path ? BBM.API.getPosterURL(tmdb.poster_path) : null;
    if (poster) {
      const img = document.createElement('img');
      img.className = 'tv-card-img';
      img.loading = 'lazy';
      img.alt = title;
      img.src = poster;
      card.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'tv-card-placeholder';
      ph.textContent = title;
      card.appendChild(ph);
    }

    if (BBM.API.isNewlyAdded(item.tmdbID)) {
      const badge = document.createElement('div');
      badge.className = 'tv-card-badge';
      badge.textContent = 'Nouveau';
      card.appendChild(badge);
    }

    card.addEventListener('click', () => openDetail(item, tmdb));
    return card;
  }

  // ----------------------------------------
  // Detail modal (guest mode — no myList)
  // ----------------------------------------
  function openDetail(item, tmdb) {
    const title = tmdb?.title || tmdb?.name || item.title || item.seriesTitle;
    const year = (tmdb?.release_date || tmdb?.first_air_date || '').slice(0, 4);
    const rating = tmdb?.vote_average ? tmdb.vote_average.toFixed(1) : null;
    const runtime = tmdb?.runtime ? `${tmdb.runtime} min` : null;
    const seasons = item.category === 'series'
      ? `${item.episodes?.length || 0} épisode${item.episodes?.length > 1 ? 's' : ''}`
      : null;
    const genres = (tmdb?.genres || []).slice(0, 3).map(g => g.name);
    const type = item.category === 'movie' ? 'Film' : 'Série';

    const metaBits = [
      rating ? `<span class="tv-hero-chip rating"><svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg> ${rating}</span>` : '',
      year ? `<span class="tv-hero-chip">${year}</span>` : '',
      `<span class="tv-hero-chip">${type}</span>`,
      runtime ? `<span class="tv-hero-chip">${runtime}</span>` : '',
      seasons ? `<span class="tv-hero-chip">${seasons}</span>` : ''
    ].filter(Boolean).join('');

    let body = `
      <h2 class="tv-modal-title">${escapeHtml(title)}</h2>
      <div class="tv-modal-meta">${metaBits}</div>
      ${genres.length ? `<div class="tv-modal-genres">${genres.map(escapeHtml).join('<span class="sep">·</span>')}</div>` : ''}
      <p class="tv-modal-overview">${escapeHtml(tmdb?.overview || 'Pas de description disponible.')}</p>
      <div class="tv-modal-actions" id="tv-modal-actions">
        <button class="tv-btn primary tv-focusable" id="btn-play">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5,3 19,12 5,21"/></svg>
          Lire
        </button>
      </div>
    `;

    if (item.category === 'series') {
      body += `<div class="tv-episode-selector" id="tv-episode-selector"></div>`;
    }

    BBM.TV.Modal.open({
      backdrop: tmdb?.backdrop_path ? BBM.API.getBackdropURL(tmdb.backdrop_path) : null,
      body
    });

    requestAnimationFrame(() => {
      document.getElementById('btn-play').addEventListener('click', () => {
        if (item.category === 'series') {
          const ep = item.episodes?.[0];
          if (ep) playEpisode(item, ep, tmdb);
        } else {
          playItem(item, tmdb);
        }
      });

      if (item.category === 'series') {
        renderEpisodeSelector(item, tmdb);
      }
    });
  }

  function renderEpisodeSelector(series, tmdb) {
    const container = document.getElementById('tv-episode-selector');
    if (!container) return;

    const seasons = [...new Set(series.episodes.map(e => e.seasonNumber))].sort((a, b) => a - b);
    let activeSeason = seasons[0];

    const render = () => {
      container.innerHTML = `
        <div class="tv-episode-selector-label">Saisons</div>
        <div class="tv-season-tabs">
          ${seasons.map(s => `
            <button class="tv-season-tab tv-focusable ${s === activeSeason ? 'active' : ''}" data-season="${s}">
              Saison ${s}
            </button>
          `).join('')}
        </div>
        <div class="tv-episode-list">
          ${series.episodes
            .filter(e => e.seasonNumber === activeSeason)
            .map(e => `
              <button class="tv-episode-item tv-focusable" data-s="${e.seasonNumber}" data-e="${e.episodeNumber}">
                <span class="ep-num">S${String(e.seasonNumber).padStart(2,'0')}E${String(e.episodeNumber).padStart(2,'0')}</span>
                <span style="flex:1;text-align:left">Épisode ${e.episodeNumber}</span>
              </button>
            `).join('')}
        </div>
      `;

      container.querySelectorAll('.tv-season-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          activeSeason = parseInt(btn.dataset.season);
          render();
        });
      });

      container.querySelectorAll('.tv-episode-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = parseInt(btn.dataset.s);
          const e = parseInt(btn.dataset.e);
          const ep = series.episodes.find(x => x.seasonNumber === s && x.episodeNumber === e);
          if (ep) playEpisode(series, ep, tmdb);
        });
      });
    };

    render();
  }

  // ----------------------------------------
  // Playback navigation
  // ----------------------------------------
  function playItem(item, tmdb) {
    const title = tmdb?.title || tmdb?.name || item.title || item.seriesTitle || '';
    const params = new URLSearchParams({
      v: item.url,
      title,
      tmdbid: item.tmdbID,
      type: item.category || 'movie'
    });
    window.location.href = `watch.html?${params.toString()}`;
  }

  function playEpisode(series, ep, tmdb) {
    const title = `${tmdb?.name || series.seriesTitle} — S${String(ep.seasonNumber).padStart(2,'0')}E${String(ep.episodeNumber).padStart(2,'0')}`;
    const params = new URLSearchParams({
      v: ep.url,
      title,
      tmdbid: series.tmdbID,
      type: 'series',
      s: ep.seasonNumber,
      e: ep.episodeNumber
    });
    window.location.href = `watch.html?${params.toString()}`;
  }

  // ----------------------------------------
  // Utilities
  // ----------------------------------------
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
})();
