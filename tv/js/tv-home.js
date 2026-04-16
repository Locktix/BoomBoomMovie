/* ============================================
   BoomBoomMovie TV — Home / Browse
   ============================================ */

(() => {
  const state = {
    user: null,
    movies: [],
    series: [],
    tmdbCache: new Map(),   // tmdbID → TMDB data
    myList: [],
    continueWatching: {},
    heroItem: null
  };

  // ----------------------------------------
  // Entry
  // ----------------------------------------
  BBM.auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    state.user = user;
    BBM.Auth.currentUser = user;
    try {
      await loadCatalog();
      await loadUserData();
      render();
    } catch (err) {
      console.error('TV home init failed:', err);
      document.getElementById('tv-hero-title').textContent = 'Erreur de chargement';
      document.getElementById('tv-hero-overview').textContent = err.message || 'Impossible de charger le catalogue.';
    } finally {
      BBM.TV.Loading.hide();
    }
  });

  // ----------------------------------------
  // Load catalog & TMDB metadata
  // ----------------------------------------
  async function loadCatalog() {
    await BBM.API.fetchAllItems();
    state.movies = BBM.API.getMovies();
    state.series = BBM.API.getSeries();

    // Unique items for TMDB fetch: one entry per tmdbID
    const unique = new Map();
    state.movies.forEach(m => unique.set(m.tmdbID, { tmdbID: m.tmdbID, category: 'movie' }));
    state.series.forEach(s => unique.set(s.tmdbID, { tmdbID: s.tmdbID, category: 'series' }));

    state.tmdbCache = await BBM.API.batchFetchTMDB([...unique.values()], 6);
  }

  async function loadUserData() {
    const [list, cw] = await Promise.all([
      BBM.API.getMyList(),
      BBM.API.getContinueWatching()
    ]);
    state.myList = list;
    state.continueWatching = cw || {};
  }

  // ----------------------------------------
  // Render
  // ----------------------------------------
  function render() {
    setupTopBar();
    renderHero();
    renderRows('all');
    // Default focus on the hero "Lire" button once content is live
    requestAnimationFrame(() => {
      document.getElementById('hero-play')?.focus();
    });
  }

  function setupTopBar() {
    document.getElementById('btn-logout').addEventListener('click', () => {
      BBM.Auth.logout();
    });

    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderRows(filter);
        // Focus the first card of the new view
        requestAnimationFrame(() => {
          const first = document.querySelector('#tv-rows .tv-focusable');
          if (first) first.focus();
        });
      });
    });
  }

  function renderHero() {
    // Pick a random item from recently added with a backdrop
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

    document.getElementById('tv-hero-bg').style.backgroundImage =
      `url(${BBM.API.getBackdropURL(tmdb.backdrop_path)})`;
    document.getElementById('tv-hero-title').textContent = title;

    const meta = document.getElementById('tv-hero-meta');
    meta.innerHTML = '';
    if (rating) meta.insertAdjacentHTML('beforeend', `<span class="rating">★ ${rating}</span>`);
    if (year) meta.insertAdjacentHTML('beforeend', `<span>${year}</span>`);
    meta.insertAdjacentHTML('beforeend', `<span>${type}</span>`);

    document.getElementById('tv-hero-overview').textContent = tmdb.overview || '';

    document.getElementById('hero-play').onclick = () => playItem(item, tmdb);
    document.getElementById('hero-info').onclick = () => openDetail(item, tmdb);
  }

  function renderRows(filter = 'all') {
    const rowsEl = document.getElementById('tv-rows');
    rowsEl.innerHTML = '';

    // Continue watching
    if (filter === 'all') {
      const cwRow = buildContinueWatchingRow();
      if (cwRow) rowsEl.appendChild(cwRow);

      const myListRow = buildMyListRow();
      if (myListRow) rowsEl.appendChild(myListRow);

      rowsEl.appendChild(buildRow('Récemment ajoutés', BBM.API.getRecentlyAdded(25)));
    }

    if (filter === 'all' || filter === 'movies') {
      const movies = withTmdb(state.movies).slice(0, 40);
      rowsEl.appendChild(buildRow('Films', movies));
    }

    if (filter === 'all' || filter === 'series') {
      const series = withTmdb(state.series).slice(0, 40);
      rowsEl.appendChild(buildRow('Séries', series));
    }
  }

  function withTmdb(items) {
    // Sort by TMDB popularity when available
    return [...items]
      .map(i => ({ item: i, tmdb: state.tmdbCache.get(i.tmdbID) }))
      .filter(x => x.tmdb)
      .sort((a, b) => (b.tmdb.popularity || 0) - (a.tmdb.popularity || 0))
      .map(x => x.item);
  }

  function buildContinueWatchingRow() {
    const entries = Object.entries(state.continueWatching || {})
      .filter(([, d]) => d && d.progress && d.duration)
      .sort((a, b) => {
        const ta = a[1].updatedAt?.toMillis ? a[1].updatedAt.toMillis() : 0;
        const tb = b[1].updatedAt?.toMillis ? b[1].updatedAt.toMillis() : 0;
        return tb - ta;
      });

    if (entries.length === 0) return null;

    const items = [];
    for (const [tmdbID, data] of entries) {
      const allItems = [...state.movies, ...state.series];
      const base = allItems.find(i => String(i.tmdbID) === String(tmdbID));
      if (base) items.push({ ...base, _cw: data });
    }
    if (items.length === 0) return null;
    return buildRow('Reprendre', items, { showProgress: true });
  }

  function buildMyListRow() {
    if (!state.myList || state.myList.length === 0) return null;
    const allItems = [...state.movies, ...state.series];
    const items = state.myList
      .map(id => allItems.find(i => String(i.tmdbID) === String(id)))
      .filter(Boolean);
    if (items.length === 0) return null;
    return buildRow('Ma liste', items);
  }

  function buildRow(title, items, opts = {}) {
    const row = document.createElement('section');
    row.className = 'tv-row';

    const h = document.createElement('h2');
    h.className = 'tv-row-title';
    h.textContent = title;
    row.appendChild(h);

    const scroller = document.createElement('div');
    scroller.className = 'tv-row-scroller';

    items.forEach(item => {
      const card = buildCard(item, opts);
      if (card) scroller.appendChild(card);
    });

    if (scroller.children.length === 0) return null;
    row.appendChild(scroller);
    return row;
  }

  function buildCard(item, opts = {}) {
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

    if (opts.showProgress && item._cw && item._cw.duration) {
      const pct = Math.min(100, (item._cw.progress / item._cw.duration) * 100);
      const bar = document.createElement('div');
      bar.className = 'tv-card-progress';
      bar.innerHTML = `<div class="tv-card-progress-fill" style="width:${pct}%"></div>`;
      card.appendChild(bar);
    }

    card.addEventListener('click', () => openDetail(item, tmdb));

    return card;
  }

  // ----------------------------------------
  // Detail modal
  // ----------------------------------------
  function openDetail(item, tmdb) {
    const title = tmdb?.title || tmdb?.name || item.title || item.seriesTitle;
    const year = (tmdb?.release_date || tmdb?.first_air_date || '').slice(0, 4);
    const rating = tmdb?.vote_average ? tmdb.vote_average.toFixed(1) : null;
    const runtime = tmdb?.runtime ? `${tmdb.runtime} min` : null;
    const seasons = item.category === 'series'
      ? `${item.episodes?.length || 0} épisode${item.episodes?.length > 1 ? 's' : ''}`
      : null;
    const genres = (tmdb?.genres || []).slice(0, 3).map(g => g.name).join(' · ');
    const type = item.category === 'movie' ? 'Film' : 'Série';

    const metaBits = [
      rating ? `<span class="rating">★ ${rating}</span>` : '',
      year ? `<span>${year}</span>` : '',
      `<span>${type}</span>`,
      runtime ? `<span>${runtime}</span>` : '',
      seasons ? `<span>${seasons}</span>` : ''
    ].filter(Boolean).join('');

    const inList = state.myList.includes(String(item.tmdbID));

    let body = `
      <h2 class="tv-modal-title">${escapeHtml(title)}</h2>
      <div class="tv-modal-meta">${metaBits}</div>
      ${genres ? `<div style="color:var(--tv-text-dim);font-size:18px">${escapeHtml(genres)}</div>` : ''}
      <p class="tv-modal-overview">${escapeHtml(tmdb?.overview || 'Pas de description disponible.')}</p>
      <div class="tv-modal-actions" id="tv-modal-actions">
        <button class="tv-btn primary tv-focusable" id="btn-play">▶ Lire</button>
        <button class="tv-btn tv-focusable" id="btn-mylist">
          ${inList ? '✓ Dans ma liste' : '+ Ajouter à ma liste'}
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

    // Wire buttons after modal opens
    requestAnimationFrame(() => {
      const btnPlay = document.getElementById('btn-play');
      const btnList = document.getElementById('btn-mylist');

      btnPlay.addEventListener('click', () => {
        if (item.category === 'series') {
          // Play first episode or resumed episode
          const cw = state.continueWatching[String(item.tmdbID)];
          let ep;
          if (cw && cw.season && cw.episode) {
            ep = item.episodes.find(e => e.seasonNumber === cw.season && e.episodeNumber === cw.episode);
          }
          ep = ep || item.episodes[0];
          if (ep) playEpisode(item, ep, tmdb);
        } else {
          playItem(item, tmdb);
        }
      });

      btnList.addEventListener('click', async () => {
        const inList2 = state.myList.includes(String(item.tmdbID));
        try {
          if (inList2) {
            await BBM.API.removeFromMyList(item.tmdbID);
            state.myList = state.myList.filter(id => id !== String(item.tmdbID));
            btnList.textContent = '+ Ajouter à ma liste';
          } else {
            await BBM.API.addToMyList(item.tmdbID);
            state.myList.push(String(item.tmdbID));
            btnList.textContent = '✓ Dans ma liste';
          }
        } catch (e) {
          console.warn('My list toggle failed', e);
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
                <span class="ep-num">S${e.seasonNumber}·E${e.episodeNumber}</span>
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
    const title = `${tmdb?.name || series.seriesTitle} — S${ep.seasonNumber}·E${ep.episodeNumber}`;
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
