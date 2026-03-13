/**
 * BoomBoom - app.js
 * API removed: posters come only from data.json (field: poster).
 */
const CONFIG = {
  DATA_FILE: 'data.json',
};

const state = {
  movies: [],
  series: [],
  displayMode: 'grid',
  selectedCollection: 'all',
};

const EXPIRING_SOON_MS = 6 * 60 * 60 * 1000;

function parseSignedUrlExpiry(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  try {
    const parsed = new URL(url);
    const signedAt = parsed.searchParams.get('X-Amz-Date');
    const expiresIn = Number(parsed.searchParams.get('X-Amz-Expires'));
    if (!signedAt || !Number.isFinite(expiresIn)) return null;

    const signedMatch = signedAt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!signedMatch) return null;

    const [, year, month, day, hour, minute, second] = signedMatch;
    const signedAtMs = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    return signedAtMs + expiresIn * 1000;
  } catch {
    return null;
  }
}

function getUrlAvailability(url, nowMs = Date.now()) {
  const expiresAt = parseSignedUrlExpiry(url);
  if (!expiresAt) {
    return {
      hasSignedExpiry: false,
      isExpired: false,
      isExpiringSoon: false,
      expiresAt: null,
    };
  }

  return {
    hasSignedExpiry: true,
    isExpired: expiresAt <= nowMs,
    isExpiringSoon: expiresAt > nowMs && expiresAt - nowMs <= EXPIRING_SOON_MS,
    expiresAt,
  };
}

function showNotice(message, type = 'warning') {
  const root = document.body;
  if (!root) return;

  const existing = document.getElementById('runtime-notice');
  if (existing) existing.remove();

  const notice = document.createElement('div');
  notice.id = 'runtime-notice';
  notice.className = `notice notice-${type}`;
  notice.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="notice-close" type="button" aria-label="Fermer">✕</button>
  `;

  const closeBtn = notice.querySelector('.notice-close');
  closeBtn?.addEventListener('click', () => notice.remove());

  root.appendChild(notice);
}

function annotateLibraryLinks() {
  const stats = {
    signed: 0,
    expired: 0,
    expiringSoon: 0,
  };

  state.movies.forEach((movie) => {
    const availability = getUrlAvailability(movie.url);
    movie._urlAvailability = availability;

    if (availability.hasSignedExpiry) stats.signed += 1;
    if (availability.isExpired) stats.expired += 1;
    if (availability.isExpiringSoon) stats.expiringSoon += 1;
  });

  state.series.forEach((show) => {
    const seasons = Array.isArray(show.seasons) ? show.seasons : [];
    seasons.forEach((season) => {
      const episodes = Array.isArray(season.episodes) ? season.episodes : [];
      episodes.forEach((ep) => {
        const availability = getUrlAvailability(ep.url);
        ep._urlAvailability = availability;

        if (availability.hasSignedExpiry) stats.signed += 1;
        if (availability.isExpired) stats.expired += 1;
        if (availability.isExpiringSoon) stats.expiringSoon += 1;
      });
    });
  });

  return stats;
}

function sortByReleaseDate(items) {
  return [...items].sort((a, b) => {
    const yearA = Number(a?.year) || 0;
    const yearB = Number(b?.year) || 0;
    if (yearA !== yearB) return yearB - yearA;
    return String(a?.title || '').localeCompare(String(b?.title || ''), 'fr', { sensitivity: 'base' });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function normalizeCollection(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getItemCollection(item) {
  return String(item?.collection || '').trim();
}

function getActiveSection() {
  return document.querySelector('.section.active');
}

function getDisplayMode() {
  return state.displayMode;
}

function getGridIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
}

function getYearIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
}

function updateViewToggleButtons() {
  const isByYear = getDisplayMode() === 'by-year';
  const nextModeLabel = isByYear ? 'Passer en affichage grille' : 'Passer en affichage par annee';
  const icon = isByYear ? getGridIcon() : getYearIcon();

  document.querySelectorAll('.view-toggle').forEach((btn) => {
    btn.innerHTML = icon;
    btn.setAttribute('aria-label', nextModeLabel);
    btn.setAttribute('title', nextModeLabel);
  });
}

function setSelectOptions(select, options, fallbackValue) {
  select.innerHTML = '';
  options.forEach((option) => {
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    select.appendChild(el);
  });

  const hasFallback = options.some((option) => option.value === fallbackValue);
  select.value = hasFallback ? fallbackValue : 'all';
}

function refreshFiltersForActiveSection() {
  const section = getActiveSection();
  if (!section) return;

  const cards = [...section.querySelectorAll('.card')];

  const collectionMap = new Map();
  cards.forEach((card) => {
    const key = card.dataset.collection || '';
    const label = card.dataset.collectionLabel || '';
    if (key && label && !collectionMap.has(key)) collectionMap.set(key, label);
  });

  const collections = [...collectionMap.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'fr', { sensitivity: 'base' }))
    .map(([value, label]) => ({ value, label }));

  renderAllCollectionChips(collections);
}

function renderAllCollectionChips(collections) {
  const isSeries = document.querySelector('.section.active').id === 'series';
  const containerId = isSeries ? 'series-collection-filters' : 'movies-collection-filters';
  renderCollectionChips(containerId, collections);
}

function renderCollectionChips(containerId, collections) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  collections.forEach(({ value, label }) => {
    const chip = document.createElement('button');
    chip.className = `filter-chip ${state.selectedCollection === value ? 'active' : ''}`;
    chip.textContent = label;
    chip.addEventListener('click', () => {
      state.selectedCollection = state.selectedCollection === value ? 'all' : value;
      refreshFiltersForActiveSection();
      applyCurrentFilters();
    });
    fragment.appendChild(chip);
  });

  container.appendChild(fragment);
}

function applyCurrentFilters() {
  const section = getActiveSection();
  const input = document.getElementById('search');
  if (!section || !input) return;

  const q = input.value.trim().toLowerCase();
  const selectedCollection = state.selectedCollection;
  let visibleCount = 0;

  section.querySelectorAll('.card').forEach((card) => {
    const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
    const matchSearch = !q || title.includes(q);
    const matchCollection = selectedCollection === 'all' || card.dataset.collection === selectedCollection;
    const isVisible = matchSearch && matchCollection;

    card.style.display = isVisible ? '' : 'none';
    if (isVisible) visibleCount += 1;
  });

  section.querySelectorAll('.year-group').forEach((group) => {
    const hasVisibleCard = [...group.querySelectorAll('.card')].some((card) => card.style.display !== 'none');
    group.style.display = hasVisibleCard ? '' : 'none';
  });

  const count = section.querySelector('.count');
  if (count) count.textContent = String(visibleCount);
}

function setupFilters() {
  refreshFiltersForActiveSection();
}

function setupDisplayMode() {
  const buttons = document.querySelectorAll('.view-toggle');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.displayMode = getDisplayMode() === 'by-year' ? 'grid' : 'by-year';
      updateViewToggleButtons();
      renderLibrary();
      refreshFiltersForActiveSection();
      applyCurrentFilters();
    });
  });

  updateViewToggleButtons();
}

function hideLoading() {
  const el = document.getElementById('loading');
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 450);
}

function showSeriesModal(seriesItem) {
  const modal = document.getElementById('series-modal');
  const title = document.getElementById('series-modal-title');
  const meta = document.getElementById('series-modal-meta');
  const content = document.getElementById('series-modal-content');

  const seasons = Array.isArray(seriesItem.seasons) ? seriesItem.seasons : [];
  const totalEpisodes = seasons.reduce((acc, s) => {
    const epList = Array.isArray(s.episodes) ? s.episodes : Array(Number(s.episodes) || 0);
    return acc + epList.length;
  }, 0);

  title.textContent = seriesItem.title;
  meta.textContent = `${seriesItem.year || ''} | ${seasons.length} saison(s) | ${totalEpisodes} episode(s)`;

  let html = '';
  seasons.forEach((season) => {
    const seasonNum = Number(season.season) || 1;
    const epList = Array.isArray(season.episodes)
      ? season.episodes
      : Array.from({ length: Number(season.episodes) || 0 }, () => ({ url: '' }));
    const epCount = epList.length;
    html += `
      <article class="season-card">
        <header class="season-card-head">
          <h4>Saison ${seasonNum}</h4>
          <span>${epCount} episode(s) | ${season.year || ''}</span>
        </header>
        <div class="episode-list">
    `;

    epList.forEach((ep, i) => {
      const epNum = i + 1;
      const code = `S${String(seasonNum).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
      const hasUrl = !!ep.url;
      const isExpired = !!ep?._urlAvailability?.isExpired;
      const isPlayable = hasUrl && !isExpired;
      html += `
          <div class="episode-item${isPlayable ? ' episode-playable' : ''}${isExpired ? ' episode-expired' : ''}"${isPlayable ? ` data-url="${escapeHtml(ep.url)}"` : ''}>
            <div class="episode-main">
              <p class="episode-code">${code}</p>
              <p class="episode-title">Episode ${epNum}</p>
            </div>
            ${isPlayable
              ? '<span class="episode-play">&#9654;</span>'
              : isExpired
                ? '<p class="episode-year">Lien expire</p>'
                : `<p class="episode-year">${season.year || ''}</p>`}
          </div>
      `;
    });

    html += `
        </div>
      </article>
    `;
  });

  if (!html) {
    html = '<p class="series-empty">Aucune information d\'episodes disponible.</p>';
  }

  content.innerHTML = html;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeSeriesModal() {
  const modal = document.getElementById('series-modal');
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openVideoPlayer(videoUrl, movieTitle) {
  const modal = document.getElementById('video-modal');
  const source = document.getElementById('video-source');
  const video = document.getElementById('video-player');
  const title = document.getElementById('video-modal-title');

  source.src = videoUrl;
  title.textContent = movieTitle;
  video.load();

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  video.play().catch(() => {
    console.warn('Autoplay was prevented. User interaction required.');
  });
}

function closeVideoPlayer() {
  const modal = document.getElementById('video-modal');
  const video = document.getElementById('video-player');

  video.pause();
  video.currentTime = 0;

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function setupVideoModal() {
  const modal = document.getElementById('video-modal');
  const closeBtn = document.getElementById('video-modal-close');
  const video = document.getElementById('video-player');

  closeBtn.addEventListener('click', closeVideoPlayer);
  modal.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.hasAttribute('data-close-video')) {
      closeVideoPlayer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeVideoPlayer();
  });

  video.addEventListener('error', () => {
    showNotice('Lecture impossible. Le lien video est peut-etre expire.', 'error');
  });
}

function setupSeriesModal() {
  const modal = document.getElementById('series-modal');
  const closeBtn = document.getElementById('series-modal-close');

  closeBtn.addEventListener('click', closeSeriesModal);
  modal.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.hasAttribute('data-close-modal')) {
      closeSeriesModal();
      return;
    }
    const epItem = e.target instanceof HTMLElement && e.target.closest('.episode-playable');
    if (epItem && epItem.dataset.url) {
      const epCode = epItem.querySelector('.episode-code')?.textContent || '';
      const seriesTitle = document.getElementById('series-modal-title')?.textContent || 'Épisode';
      const episodeTitle = `${seriesTitle} - ${epCode}`;
      openVideoPlayer(epItem.dataset.url, episodeTitle);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeSeriesModal();
  });
}

function createCard(item, isTV = false, index = 0) {
  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${item.title} (${item.year})`);
  card.dataset.year = String(item.year || '');
  const collectionLabel = getItemCollection(item);
  card.dataset.collection = normalizeCollection(collectionLabel);
  card.dataset.collectionLabel = collectionLabel;
  const isExpired = !!item?._urlAvailability?.isExpired;
  if (!isTV && isExpired) card.classList.add('card-unavailable');
  const collectionBadge = collectionLabel
    ? `<span class="card-collection">${escapeHtml(collectionLabel)}</span>`
    : '';

  card.innerHTML = `
    <div class="card-placeholder">
      <span class="placeholder-icon">${isTV ? 'TV' : 'FILM'}</span>
      <span class="placeholder-title">${escapeHtml(item.title)}</span>
    </div>
    <img class="card-img" alt="${escapeHtml(item.title)}" loading="lazy" />
    <div class="card-play" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="#000" width="22" height="22">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </div>
    <div class="card-overlay">
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <div class="card-meta">
        <span class="card-year">${item.year || ''}</span>
        ${collectionBadge}
      </div>
    </div>
  `;

  const img = card.querySelector('.card-img');
  const placeholder = card.querySelector('.card-placeholder');
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';

  if (item.poster) {
    const isRemotePoster = /^https?:\/\//i.test(item.poster);
    const posterCandidates = [item.poster];
    if (isRemotePoster) {
      const strippedPoster = item.poster.replace(/^https?:\/\//, '');
      posterCandidates.push(
        `https://images.weserv.nl/?url=${encodeURIComponent(strippedPoster)}&w=500&h=750&fit=cover`
      );
    }

    let posterCandidateIndex = 0;

    const tryNextPoster = () => {
      if (posterCandidateIndex >= posterCandidates.length) {
        placeholder.style.display = '';
        img.classList.remove('loaded');
        return;
      }
      img.src = posterCandidates[posterCandidateIndex];
      posterCandidateIndex += 1;
    };

    const loadPoster = () => {
      posterCandidateIndex = 0;
      tryNextPoster();
    };

    img.onload = () => {
      img.classList.add('loaded');
      placeholder.style.display = 'none';
    };

    img.onerror = () => {
      tryNextPoster();
    };

    if (index < 8) {
      img.loading = 'eager';
      img.fetchPriority = 'high';
    } else {
      img.loading = 'lazy';
      img.fetchPriority = 'low';
    }

    // For local files we reveal immediately and only rollback on actual error.
    if (!isRemotePoster) {
      img.classList.add('loaded');
      placeholder.style.display = 'none';
    }

    loadPoster();

    // If the browser served the image from cache very quickly,
    // ensure we still reveal it even if onload was skipped.
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('loaded');
      placeholder.style.display = 'none';
    }
  }

  const open = () => {
    if (isTV) {
      showSeriesModal(state.series[index]);
      return;
    }

    if (isExpired) {
      showNotice('Ce film ne peut pas se lancer: le lien video a expire.', 'error');
      return;
    }

    if (item.url) {
      openVideoPlayer(item.url, item.title);
    }
  };

  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });

  return card;
}

function renderGrid(items, gridId, countId, isTV) {
  const grid = document.getElementById(gridId);
  const count = document.getElementById(countId);
  const mode = getDisplayMode();

  grid.innerHTML = '';
  grid.classList.toggle('grid-by-year', mode === 'by-year');

  count.textContent = items && items.length ? String(items.length) : '0';
  if (!items || items.length === 0) return;

  if (mode === 'by-year') {
    const groups = new Map();
    items.forEach((item, index) => {
      const yearKey = String(item.year || 'Inconnu');
      if (!groups.has(yearKey)) groups.set(yearKey, []);
      groups.get(yearKey).push({ item, index });
    });

    const groupsFragment = document.createDocumentFragment();
    groups.forEach((entries, yearKey) => {
      const group = document.createElement('section');
      group.className = 'year-group';

      const title = document.createElement('h3');
      title.className = 'year-group-title';
      title.textContent = yearKey;

      const yearGrid = document.createElement('div');
      yearGrid.className = 'grid year-grid';
      entries.forEach(({ item, index }) => yearGrid.appendChild(createCard(item, isTV, index)));

      group.appendChild(title);
      group.appendChild(yearGrid);
      groupsFragment.appendChild(group);
    });

    grid.appendChild(groupsFragment);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => fragment.appendChild(createCard(item, isTV, index)));
  grid.appendChild(fragment);
}

function renderLibrary() {
  renderGrid(state.movies, 'movies-grid', 'movies-count', false);
  renderGrid(state.series, 'series-grid', 'series-count', true);
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const sections = document.querySelectorAll('.section');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      tabs.forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      sections.forEach((s) => s.classList.toggle('active', s.id === target));
      refreshFiltersForActiveSection();
      applyCurrentFilters();
    });
  });
}

function setupSearch() {
  const input = document.getElementById('search');

  input.addEventListener('input', () => {
    applyCurrentFilters();
  });
}

async function init() {
  setupTabs();
  setupSearch();
  setupFilters();
  setupDisplayMode();
  setupVideoModal();
  setupSeriesModal();

  try {
    const res = await fetch(CONFIG.DATA_FILE);
    if (!res.ok) throw new Error(`Impossible de charger ${CONFIG.DATA_FILE} (HTTP ${res.status})`);
    const data = await res.json();

    state.series = sortByReleaseDate(Array.isArray(data.series) ? data.series : []);
    state.movies = sortByReleaseDate(Array.isArray(data.movies) ? data.movies : []);

    const linkStats = annotateLibraryLinks();

    renderLibrary();
    refreshFiltersForActiveSection();
    applyCurrentFilters();

    if (linkStats.expired > 0) {
      showNotice(
        `${linkStats.expired} lien(s) video expire(s). Regenerer les URLs signees dans data.json.`,
        'error'
      );
    } else if (linkStats.expiringSoon > 0) {
      showNotice(
        `${linkStats.expiringSoon} lien(s) video vont expirer bientot. Pense a regenerer data.json.`,
        'warning'
      );
    }
  } catch (err) {
    console.error('[BoomBoom]', err.message);
    if (location.protocol === 'file:') {
      document.querySelector('.main').innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">!</span>
          <p>Pour executer le site localement, lancez un serveur HTTP :</p>
          <pre style="margin-top:.75rem;padding:.75rem 1rem;background:var(--bg-elevated);border-radius:8px;font-size:.8rem;color:var(--accent)">npx serve .</pre>
        </div>
      `;
    }
  } finally {
    hideLoading();
  }
}

document.addEventListener('DOMContentLoaded', init);
