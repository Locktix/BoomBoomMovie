/**
 * BoomBoom - app.js
 * Movies metadata and posters can be resolved from TMDB when configured.
 */
const CONFIG = {
  MOVIES_DATA_FILE: 'data.movie.json',
  SERIES_DATA_FILE: 'data.series.json',
  TMDB_CONFIG_FILE: 'tmdb.config.json',
  COLLECTIONS_FILE: 'collections.json',
  TMDB_API_KEY: window.BOOMBOOM_TMDB_API_KEY || localStorage.getItem('boomboom:tmdb:api-key') || '',
  TMDB_BEARER_TOKEN: window.BOOMBOOM_TMDB_BEARER_TOKEN || localStorage.getItem('boomboom:tmdb:bearer-token') || '',
  TMDB_LANG: 'fr-FR',
  TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
  TMDB_MOVIE_DETAILS_ENDPOINT: 'https://api.themoviedb.org/3/movie',
  TMDB_TV_DETAILS_ENDPOINT: 'https://api.themoviedb.org/3/tv',
  R2_CATALOG_API: 'https://liste-films-api.alanplokain.workers.dev/',
};

// Ordre MCU complet (films + series)
const MCU_ORDER = [
  { title: 'Captain America: First Avenger', tmdbId: 1771, type: 'movie' },
  { title: 'Captain Marvel', tmdbId: 299537, type: 'movie' },
  { title: 'Iron Man', tmdbId: 1726, type: 'movie' },
  { title: 'Iron Man 2', tmdbId: 10138, type: 'movie' },
  { title: 'L’Incroyable Hulk', tmdbId: 1724, type: 'movie' },
  { title: 'Thor', tmdbId: 10195, type: 'movie' },
  { title: 'Avengers', tmdbId: 24428, type: 'movie' },
  { title: 'Thor : Le Monde des Ténèbres', tmdbId: 76338, type: 'movie' },
  { title: 'Iron Man 3', tmdbId: 68721, type: 'movie' },
  { title: 'Captain America : Le Soldat de l’Hiver', tmdbId: 100402, type: 'movie' },
  { title: 'Les Gardiens de la Galaxie', tmdbId: 118340, type: 'movie' },
  { title: 'Les Gardiens de la Galaxie Vol. 2', tmdbId: 283995, type: 'movie' },
  { title: 'Daredevil – Saison 1', tmdbId: 61889, type: 'tv', season: 1 },
  { title: 'Avengers : L’Ère d’Ultron', tmdbId: 99861, type: 'movie' },
  { title: 'Ant-Man', tmdbId: 102899, type: 'movie' },
  { title: 'Captain America : Civil War', tmdbId: 271110, type: 'movie' },
  { title: 'Black Widow', tmdbId: 497698, type: 'movie' },
  { title: 'Black Panther', tmdbId: 284054, type: 'movie' },
  { title: 'Spider-Man : Homecoming', tmdbId: 315635, type: 'movie' },
  { title: 'Daredevil – Saison 2', tmdbId: 61889, type: 'tv', season: 2 },
  { title: 'The Punisher – Saison 1', tmdbId: 67178, type: 'tv', season: 1 },
  { title: 'Doctor Strange', tmdbId: 284052, type: 'movie' },
  { title: 'Thor : Ragnarok', tmdbId: 284053, type: 'movie' },
  { title: 'Avengers : Infinity War', tmdbId: 299536, type: 'movie' },
  { title: 'Ant-Man et la Guêpe', tmdbId: 363088, type: 'movie' },
  { title: 'Avengers : Endgame', tmdbId: 299534, type: 'movie' },
  { title: 'Loki – Saison 1', tmdbId: 84958, type: 'tv', season: 1 },
  { title: 'Loki – Saison 2', tmdbId: 84958, type: 'tv', season: 2 },
  { title: 'WandaVision', tmdbId: 85271, type: 'tv' },
  { title: 'What If...? – Saison 1', tmdbId: 91363, type: 'tv', season: 1 },
  { title: 'What If...? – Saison 2', tmdbId: 91363, type: 'tv', season: 2 },
  { title: 'What If...? – Saison 3', tmdbId: 91363, type: 'tv', season: 3 },
  { title: 'Shang-Chi et la Légende des Dix Anneaux', tmdbId: 566525, type: 'movie' },
  { title: 'Falcon and the Winter Soldier', tmdbId: 88396, type: 'tv' },
  { title: 'Les Éternels', tmdbId: 524434, type: 'movie' },
  { title: 'Spider-Man : Far From Home', tmdbId: 429617, type: 'movie' },
  { title: 'Spider-Man 1', tmdbId: 557, type: 'movie' },
  { title: 'Spider-Man 2', tmdbId: 558, type: 'movie' },
  { title: 'Spider-Man 3', tmdbId: 559, type: 'movie' },
  { title: 'The Amazing Spider-Man 1', tmdbId: 1930, type: 'movie' },
  { title: 'The Amazing Spider-Man 2', tmdbId: 102382, type: 'movie' },
  { title: 'Spider-Man : No Way Home', tmdbId: 634649, type: 'movie' },
  { title: 'Doctor Strange in the Multiverse of Madness', tmdbId: 453395, type: 'movie' },
  { title: 'Moon Knight', tmdbId: 92749, type: 'tv' },
  { title: 'Thor : Love and Thunder', tmdbId: 616037, type: 'movie' },
  { title: 'Ms. Marvel', tmdbId: 92782, type: 'tv' },
  { title: 'She-Hulk: Attorney at Law', tmdbId: 92783, type: 'tv' },
  { title: 'Black Panther : Wakanda Forever', tmdbId: 505642, type: 'movie' },
  { title: 'Werewolf by Night', tmdbId: 877703, type: 'movie' },
  { title: 'Ant-Man et la Guêpe : Quantumania', tmdbId: 640146, type: 'movie' },
  { title: 'Les Gardiens de la Galaxie Vol. 3', tmdbId: 447365, type: 'movie' },
  { title: 'Secret Invasion', tmdbId: 114472, type: 'tv' },
  { title: 'The Marvels', tmdbId: 609681, type: 'movie' },
  { title: 'Hawkeye', tmdbId: 88329, type: 'tv' },
  { title: 'Echo', tmdbId: 108978, type: 'tv' },
  { title: 'X-Men 1', tmdbId: 36657, type: 'movie' },
  { title: 'X-Men 2', tmdbId: 36658, type: 'movie' },
  { title: 'X-Men 3 : L\'Affrontement Final', tmdbId: 36668, type: 'movie' },
  { title: 'X-Men : Le Commencement', tmdbId: 49538, type: 'movie' },
  { title: 'X-Men : Days of Future Past', tmdbId: 127585, type: 'movie' },
  { title: 'Logan', tmdbId: 263115, type: 'movie' },
  { title: 'Deadpool 1', tmdbId: 293660, type: 'movie' },
  { title: 'Deadpool 2', tmdbId: 383498, type: 'movie' },
  { title: 'Deadpool & Wolverine', tmdbId: 533535, type: 'movie' },
  { title: 'Agatha All Along', tmdbId: 134949, type: 'tv' },
  { title: 'Captain America : Brave New World', tmdbId: 822119, type: 'movie' },
  { title: 'Daredevil: Born Again – Saison 1', tmdbId: 202555, type: 'tv', season: 1 },
  { title: 'Thunderbolts', tmdbId: 986056, type: 'movie' },
  { title: 'The Fantastic Four: First Steps', tmdbId: 617126, type: 'movie' },
  { title: 'Avengers: Doomsday', tmdbId: 1003596, type: 'movie' },
  { title: 'Spider-Man 4 : Brand New Day', tmdbId: 900667, type: 'movie' },
  { title: 'Vision', tmdbId: 254556, type: 'tv' },
  { title: 'Daredevil: Born Again – Saison 2', tmdbId: 204541, type: 'tv', season: 2 },
  { title: 'Avengers: Secret Wars', tmdbId: 1003598, type: 'movie' },
  { title: 'Blade', tmdbId: null, type: 'movie' },
  { title: 'Armor Wars', tmdbId: null, type: 'movie' },
  { title: 'Shang-Chi 2', tmdbId: null, type: 'movie' },
];

const state = {
  movies: [],
  series: [],
  collections: [],
  displayMode: 'grid',
  activeCollectionKey: '',
  activeGenreKey: '',
  selectedCollection: 'all',
  selectedStatus: {
    movies: 'all',
    series: 'all',
  },
  sortConfig: {
    movies: 'default',
    series: 'default',
  },
  filterConfig: {
    movies: { genre: '' },
    series: { genre: '' },
  },
};

const playerState = {
  urlCandidates: [],
  currentIndex: 0,
  playbackContext: null,
  lastProgressSavedAt: 0,
  pendingResumeTime: 0,
};

const EXPIRING_SOON_MS = 6 * 60 * 60 * 1000;
const WATCH_PROGRESS_STORE_KEY = 'boomboom:watch-progress:v1';
const WATCH_PROGRESS_SAVE_INTERVAL_MS = 2500;
const WATCH_PROGRESS_MIN_RESUME_SECONDS = 15;
const WATCH_PROGRESS_COMPLETED_RATIO = 0.92;
const RATINGS_STORE_KEY = 'boomboom:ratings:v1';
const tmdbPosterCache = new Map();
const tmdbDetailsCache = new Map();
const tmdbSeasonDetailsCache = new Map();

let watchProgressStore = {};
let ratingsStore = {};

// ── Firebase debounce timers (évite trop d'écritures pendant la lecture) ──
const _fbProgressTimers = {};
function _fbDebounceProgress(progressKey, data) {
  if (!window.FB?.isLoggedIn?.()) return;
  clearTimeout(_fbProgressTimers[progressKey]);
  _fbProgressTimers[progressKey] = setTimeout(() => {
    window.FB.saveProgress(progressKey, data);
  }, 3000);
}

function _fbSaveRatingNow(ratingKey, data) {
  if (!window.FB?.isLoggedIn?.()) return;
  if (data) {
    window.FB.saveRating(ratingKey, data);
  } else {
    window.FB.deleteRatingCloud(ratingKey);
  }
}
const WATCH_STATUS_FILTERS = [
  { value: 'all', label: 'Tout' },
  { value: 'not-started', label: 'Non vus' },
  { value: 'in-progress', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
];

function safeBase64Encode(value) {
  try {
    return btoa(unescape(encodeURIComponent(String(value || ''))));
  } catch {
    return String(value || '');
  }
}

function normalizeProgressTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function getMovieProgressKey(item) {
  const tmdbId = getTmdbNumericId(item);
  if (tmdbId) return `movie:${tmdbId}`;
  return `movie:title:${safeBase64Encode(normalizeProgressTitle(item?.title || 'movie'))}`;
}

function getEpisodeProgressKey(seriesItem, seasonNumber, episodeNumber) {
  const tmdbId = getTmdbNumericId(seriesItem);
  const seriesSlug = normalizeProgressTitle(seriesItem?.title || 'series');
  const idPart = tmdbId ? `tmdb:${tmdbId}` : `title:${safeBase64Encode(seriesSlug)}`;
  return `episode:${idPart}:s${Number(seasonNumber) || 0}:e${Number(episodeNumber) || 0}`;
}

function loadWatchProgressStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WATCH_PROGRESS_STORE_KEY) || '{}');
    watchProgressStore = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    watchProgressStore = {};
  }
}

function saveWatchProgressStore() {
  try {
    localStorage.setItem(WATCH_PROGRESS_STORE_KEY, JSON.stringify(watchProgressStore));
  } catch {
    // Ignore persistence errors (private mode / quota).
  }
}

// ── Personal ratings (1-5 stars, stored in localStorage) ─────────────────

function loadRatingsStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RATINGS_STORE_KEY) || '{}');
    ratingsStore = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    ratingsStore = {};
  }
}

function saveRatingsStore() {
  try {
    localStorage.setItem(RATINGS_STORE_KEY, JSON.stringify(ratingsStore));
  } catch {
    // Ignore (private mode / quota).
  }
}

function getRatingKey(item, mediaType) {
  const tmdbId = getTmdbNumericId(item);
  const prefix = mediaType === 'tv' ? 'series' : 'movie';
  if (tmdbId) return `${prefix}:${tmdbId}`;
  return `${prefix}:title:${safeBase64Encode(normalizeProgressTitle(item?.title || prefix))}`;
}

function getUserRating(ratingKey) {
  if (!ratingKey) return 0;
  const entry = ratingsStore[ratingKey];
  const value = Number(entry?.rating);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
}

function setUserRating(ratingKey, rating) {
  if (!ratingKey) return;
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    delete ratingsStore[ratingKey];
    _fbSaveRatingNow(ratingKey, null);
  } else {
    ratingsStore[ratingKey] = { rating: value, updatedAt: Date.now() };
    _fbSaveRatingNow(ratingKey, ratingsStore[ratingKey]);
  }
  saveRatingsStore();
}

function refreshRatingDecorations() {
  document.querySelectorAll('[data-rating-display-for]').forEach((el) => {
    const key = el.getAttribute('data-rating-display-for') || '';
    const rating = getUserRating(key);
    if (rating > 0) {
      el.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      el.removeAttribute('hidden');
    } else {
      el.textContent = '';
      el.setAttribute('hidden', 'hidden');
    }
  });
}

function renderStarRatingWidget(ratingKey, containerEl) {
  if (!containerEl) return;
  const currentRating = getUserRating(ratingKey);

  containerEl.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'rating-label';
  label.textContent = 'Ma note :';

  const stars = document.createElement('div');
  stars.className = 'rating-stars';
  stars.setAttribute('role', 'group');
  stars.setAttribute('aria-label', 'Note personnelle sur 5');

  for (let i = 1; i <= 5; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rating-star' + (i <= currentRating ? ' active' : '');
    btn.setAttribute('aria-label', `${i} étoile${i > 1 ? 's' : ''}`);
    btn.textContent = i <= currentRating ? '★' : '☆';
    btn.dataset.value = String(i);

    btn.addEventListener('mouseenter', () => {
      stars.querySelectorAll('.rating-star').forEach((s, idx) => {
        s.textContent = idx < i ? '★' : '☆';
        s.classList.toggle('active', idx < i);
      });
    });

    btn.addEventListener('click', () => {
      const newRating = currentRating === i ? 0 : i;
      setUserRating(ratingKey, newRating);
      refreshRatingDecorations();
      renderStarRatingWidget(ratingKey, containerEl);
    });

    stars.appendChild(btn);
  }

  stars.addEventListener('mouseleave', () => {
    const saved = getUserRating(ratingKey);
    stars.querySelectorAll('.rating-star').forEach((s, idx) => {
      s.textContent = idx < saved ? '★' : '☆';
      s.classList.toggle('active', idx < saved);
    });
  });

  const ratingValue = document.createElement('span');
  ratingValue.className = 'rating-value-label';
  ratingValue.textContent = currentRating > 0 ? `${currentRating}/5` : '';

  containerEl.appendChild(label);
  containerEl.appendChild(stars);
  containerEl.appendChild(ratingValue);
}

// ── Episode / season / series rating helpers ─────────────────────────────

function getEpisodeRatingKey(seriesItem, seasonNumber, episodeNumber) {
  const tmdbId = getTmdbNumericId(seriesItem);
  const seriesSlug = normalizeProgressTitle(seriesItem?.title || 'series');
  const idPart = tmdbId ? `tmdb:${tmdbId}` : `title:${safeBase64Encode(seriesSlug)}`;
  return `ep-rating:${idPart}:s${Number(seasonNumber) || 0}:e${Number(episodeNumber) || 0}`;
}

function getSeasonRatingAverage(seriesItem, seasonNumber) {
  const seasons = Array.isArray(seriesItem?.seasons) ? seriesItem.seasons : [];
  const season = seasons.find((s) => Number(s?.season) === Number(seasonNumber));
  if (!season) return null;
  const epList = Array.isArray(season.episodes) ? season.episodes : [];
  const ratings = [];
  epList.forEach((_, i) => {
    const r = getUserRating(getEpisodeRatingKey(seriesItem, seasonNumber, i + 1));
    if (r > 0) ratings.push(r);
  });
  if (!ratings.length) return null;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

function getSeriesEpisodeRatingAverage(seriesItem) {
  const seasons = Array.isArray(seriesItem?.seasons) ? seriesItem.seasons : [];
  const ratings = [];
  seasons.forEach((season) => {
    const seasonNum = Number(season?.season) || 1;
    const epList = Array.isArray(season.episodes) ? season.episodes : [];
    epList.forEach((_, i) => {
      const r = getUserRating(getEpisodeRatingKey(seriesItem, seasonNum, i + 1));
      if (r > 0) ratings.push(r);
    });
  });
  if (!ratings.length) return null;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

function renderMiniStarWidget(ratingKey, containerEl, onRate) {
  if (!containerEl) return;
  const currentRating = getUserRating(ratingKey);
  containerEl.innerHTML = '';
  containerEl.className = 'ep-rating-stars';
  containerEl.setAttribute('role', 'group');
  containerEl.setAttribute('aria-label', "Note de l'épisode sur 5");

  for (let i = 1; i <= 5; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ep-rating-star' + (i <= currentRating ? ' active' : '');
    btn.setAttribute('aria-label', `${i} étoile${i > 1 ? 's' : ''}`);
    btn.textContent = i <= currentRating ? '★' : '☆';

    btn.addEventListener('mouseenter', () => {
      containerEl.querySelectorAll('.ep-rating-star').forEach((s, idx) => {
        s.textContent = idx < i ? '★' : '☆';
        s.classList.toggle('active', idx < i);
      });
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newRating = currentRating === i ? 0 : i;
      setUserRating(ratingKey, newRating);
      renderMiniStarWidget(ratingKey, containerEl, onRate);
      if (typeof onRate === 'function') onRate();
    });

    containerEl.appendChild(btn);
  }

  containerEl.addEventListener('mouseleave', () => {
    const saved = getUserRating(ratingKey);
    containerEl.querySelectorAll('.ep-rating-star').forEach((s, idx) => {
      s.textContent = idx < saved ? '★' : '☆';
      s.classList.toggle('active', idx < saved);
    });
  });
}

function refreshSeriesModalAverages(contentEl, headEl, seriesItem) {
  contentEl.querySelectorAll('[data-season-avg-for]').forEach((el) => {
    const seasonNum = Number(el.getAttribute('data-season-avg-for'));
    const avg = getSeasonRatingAverage(seriesItem, seasonNum);
    if (avg !== null) {
      el.textContent = `Moy. ★ ${avg.toFixed(1)}/5`;
      el.removeAttribute('hidden');
    } else {
      el.textContent = '';
      el.setAttribute('hidden', 'hidden');
    }
  });

  const seriesAvgEl = headEl?.querySelector('.series-rating-avg');
  if (seriesAvgEl) {
    const avg = getSeriesEpisodeRatingAverage(seriesItem);
    if (avg !== null) {
      const rounded = Math.round(avg);
      seriesAvgEl.textContent = `Note moyenne série : ${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)} ${avg.toFixed(1)}/5`;
      seriesAvgEl.removeAttribute('hidden');
    } else {
      seriesAvgEl.setAttribute('hidden', 'hidden');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────

function getWatchProgressEntry(progressKey) {
  if (!progressKey) return null;
  const entry = watchProgressStore[progressKey];
  return entry && typeof entry === 'object' ? entry : null;
}

function getProgressRatio(progressEntry) {
  const position = Number(progressEntry?.positionSeconds);
  const duration = Number(progressEntry?.durationSeconds);
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(1, position / duration));
}

function isProgressCompleted(progressEntry) {
  if (!progressEntry || typeof progressEntry !== 'object') return false;
  if (progressEntry.completed === true) return true;
  return getProgressRatio(progressEntry) >= WATCH_PROGRESS_COMPLETED_RATIO;
}

function formatTimeLabel(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getResumeTimeSeconds(progressEntry) {
  if (!progressEntry || isProgressCompleted(progressEntry)) return 0;
  const value = Number(progressEntry.positionSeconds);
  if (!Number.isFinite(value) || value < WATCH_PROGRESS_MIN_RESUME_SECONDS) return 0;
  return Math.floor(value);
}

function updateWatchProgressEntry(progressKey, payload) {
  if (!progressKey) return;
  const existing = getWatchProgressEntry(progressKey) || {};
  watchProgressStore[progressKey] = {
    ...existing,
    ...payload,
    updatedAt: Date.now(),
  };
  saveWatchProgressStore();
  // Sync Firebase (débouncé 3s pour ne pas saturer pendant la lecture)
  _fbDebounceProgress(progressKey, watchProgressStore[progressKey]);
}

function removeWatchProgressEntry(progressKey) {
  if (!progressKey) return;
  if (!Object.prototype.hasOwnProperty.call(watchProgressStore, progressKey)) return;
  delete watchProgressStore[progressKey];
  saveWatchProgressStore();
  // Sync Firebase
  if (window.FB?.isLoggedIn?.()) window.FB.deleteProgress(progressKey);
}

function markPlaybackCompleted(progressKey, title = '') {
  if (!progressKey) return;
  const existing = getWatchProgressEntry(progressKey) || {};
  const durationSeconds = Number(existing.durationSeconds) || Number(existing.positionSeconds) || 1;
  updateWatchProgressEntry(progressKey, {
    title: String(title || existing.title || '').trim(),
    positionSeconds: durationSeconds,
    durationSeconds,
    completed: true,
  });
  refreshProgressDecorations();
}

function setPlaybackProgress(progressKey, title, positionSeconds, durationSeconds) {
  if (!progressKey) return;
  const ratio = Number(durationSeconds) > 0 ? Number(positionSeconds) / Number(durationSeconds) : 0;
  updateWatchProgressEntry(progressKey, {
    title: String(title || '').trim(),
    positionSeconds: Math.max(0, Number(positionSeconds) || 0),
    durationSeconds: Math.max(0, Number(durationSeconds) || 0),
    completed: Number.isFinite(ratio) && ratio >= WATCH_PROGRESS_COMPLETED_RATIO,
  });
}

function refreshProgressDecorations() {
  document.querySelectorAll('.watch-progress[data-progress-key]').forEach((bar) => {
    const key = bar.getAttribute('data-progress-key') || '';
    const entry = getWatchProgressEntry(key);
    const ratio = getProgressRatio(entry);
    const fill = bar.querySelector('.watch-progress-fill');
    const isCompleted = isProgressCompleted(entry);
    const percent = isCompleted ? 100 : Math.round(ratio * 100);

    if (fill) fill.style.width = `${percent}%`;
    bar.classList.toggle('watch-progress-visible', ratio > 0 || isCompleted);
  });

  document.querySelectorAll('[data-progress-badge-for]').forEach((badge) => {
    const key = badge.getAttribute('data-progress-badge-for') || '';
    const entry = getWatchProgressEntry(key);
    const ratio = getProgressRatio(entry);
    const isCompleted = isProgressCompleted(entry);

    if (isCompleted) {
      badge.textContent = 'Terminé';
      badge.classList.add('watch-state-complete');
      badge.classList.remove('watch-state-resume');
      badge.removeAttribute('hidden');
      return;
    }

    const resumeAt = getResumeTimeSeconds(entry);
    if (resumeAt > 0 && ratio > 0) {
      badge.textContent = `Reprendre ${formatTimeLabel(resumeAt)}`;
      badge.classList.add('watch-state-resume');
      badge.classList.remove('watch-state-complete');
      badge.removeAttribute('hidden');
      return;
    }

    badge.setAttribute('hidden', 'hidden');
    badge.textContent = '';
    badge.classList.remove('watch-state-resume', 'watch-state-complete');
  });

  refreshRatingDecorations();
}

function getWatchStatusFromEntry(entry) {
  if (!entry) return 'not-started';
  if (isProgressCompleted(entry)) return 'completed';
  const ratio = getProgressRatio(entry);
  return ratio > 0 ? 'in-progress' : 'not-started';
}

function getMovieWatchStatus(item) {
  const key = getMovieProgressKey(item);
  return getWatchStatusFromEntry(getWatchProgressEntry(key));
}

function getSeriesEpisodeProgressStats(seriesItem, options = {}) {
  const seasons = Array.isArray(seriesItem?.seasons) ? seriesItem.seasons : [];
  const onlySeasonNumber = Number(options?.seasonNumber) || 0;
  let playableEpisodes = 0;
  let completedEpisodes = 0;
  let startedEpisodes = 0;
  let progressUnits = 0;

  seasons.forEach((season) => {
    const seasonNum = Number(season?.season) || 1;
    if (onlySeasonNumber > 0 && seasonNum !== onlySeasonNumber) return;

    const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
    episodes.forEach((ep, idx) => {
      const epNum = idx + 1;
      const candidates = Array.isArray(ep?._urlCandidates) ? ep._urlCandidates : getMediaUrlCandidates(ep);
      if (!hasPlayableCandidate(candidates)) return;

      playableEpisodes += 1;
      const key = getEpisodeProgressKey(seriesItem, seasonNum, epNum);
      const entry = getWatchProgressEntry(key);
      const status = getWatchStatusFromEntry(entry);
      const ratio = getProgressRatio(entry);

      if (status === 'completed') completedEpisodes += 1;
      if (status === 'in-progress' || status === 'completed') startedEpisodes += 1;

      if (status === 'completed') {
        progressUnits += 1;
      } else if (status === 'in-progress') {
        progressUnits += Math.max(0, Math.min(1, ratio));
      }
    });
  });

  return {
    playableEpisodes,
    completedEpisodes,
    startedEpisodes,
    progressUnits,
  };
}

function getSeriesWatchStatus(seriesItem) {
  const stats = getSeriesEpisodeProgressStats(seriesItem);
  if (stats.playableEpisodes > 0 && stats.completedEpisodes >= stats.playableEpisodes) return 'completed';
  if (stats.startedEpisodes > 0) return 'in-progress';
  return 'not-started';
}

function getSeriesNextEpisodeCandidate(seriesItem, options = {}) {
  const seasons = Array.isArray(seriesItem?.seasons) ? seriesItem.seasons : [];
  const preferredSeason = Number(options?.preferredSeason) || 0;
  const preferredEpisode = Number(options?.preferredEpisode) || 0;
  const onlySeasonNumber = Number(options?.seasonNumber) || 0;

  const flattened = [];
  seasons.forEach((season) => {
    const seasonNum = Number(season?.season) || 1;
    if (onlySeasonNumber > 0 && seasonNum !== onlySeasonNumber) return;

    const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
    episodes.forEach((ep, idx) => {
      const epNum = idx + 1;
      const candidates = Array.isArray(ep?._urlCandidates) ? ep._urlCandidates : getMediaUrlCandidates(ep);
      if (!hasPlayableCandidate(candidates)) return;

      const progressKey = getEpisodeProgressKey(seriesItem, seasonNum, epNum);
      const status = getWatchStatusFromEntry(getWatchProgressEntry(progressKey));
      const code = `S${String(seasonNum).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
      flattened.push({
        seasonNum,
        epNum,
        code,
        candidates,
        progressKey,
        status,
      });
    });
  });

  if (!flattened.length) return null;

  if (preferredSeason > 0 && preferredEpisode > 0) {
    const afterCurrent = flattened.find((entry) =>
      entry.seasonNum > preferredSeason
      || (entry.seasonNum === preferredSeason && entry.epNum > preferredEpisode)
    );
    if (afterCurrent) return afterCurrent;
  }

  const inProgressEntry = flattened.find((entry) => entry.status === 'in-progress');
  if (inProgressEntry) return inProgressEntry;

  const firstNotCompleted = flattened.find((entry) => entry.status !== 'completed');
  return firstNotCompleted || null;
}

function buildEpisodePlaybackEntry(seriesTitle, episodeCode, episodeName, candidates, progressKey) {
  const safeSeriesTitle = String(seriesTitle || 'Episode').trim();
  const safeCode = String(episodeCode || '').trim();
  const safeEpisodeName = String(episodeName || '').trim();
  const displayTitle = [safeSeriesTitle, safeCode].filter(Boolean).join(' - ');

  return {
    candidates: Array.isArray(candidates) ? candidates : [],
    progressKey: String(progressKey || ''),
    displayTitle,
    subtitle: safeEpisodeName,
    title: safeEpisodeName ? `${displayTitle} - ${safeEpisodeName}` : displayTitle,
  };
}

function createEpisodePlaybackContext(episodeList, episodeIndex) {
  const list = Array.isArray(episodeList) ? episodeList : [];
  const index = Number(episodeIndex);
  const currentEpisode = list[index];
  if (!currentEpisode) return null;

  return {
    progressKey: currentEpisode.progressKey,
    title: currentEpisode.title,
    displayTitle: currentEpisode.displayTitle,
    subtitle: currentEpisode.subtitle,
    mediaType: 'episode',
    episodeList: list,
    episodeIndex: index,
  };
}

function getEpisodeContextEntry(playbackContext, offset = 0) {
  const episodeList = Array.isArray(playbackContext?.episodeList) ? playbackContext.episodeList : [];
  const episodeIndex = Number(playbackContext?.episodeIndex);
  if (!Number.isInteger(episodeIndex)) return null;

  return episodeList[episodeIndex + Number(offset || 0)] || null;
}

function getContinueWatchingItems(limit = 14) {
  const candidates = [];

  state.movies.forEach((item, index) => {
    const progressKey = getMovieProgressKey(item);
    const progressEntry = getWatchProgressEntry(progressKey);
    const status = getWatchStatusFromEntry(progressEntry);
    if (status !== 'in-progress') return;

    const resumeAt = getResumeTimeSeconds(progressEntry);
    candidates.push({
      item,
      isTV: false,
      index,
      updatedAt: Number(progressEntry?.updatedAt) || 0,
      cardOptions: {
        seasonLabel: resumeAt > 0 ? `Reprendre ${formatTimeLabel(resumeAt)}` : 'En cours',
      },
    });
  });

  state.series.forEach((item, index) => {
    const status = getSeriesWatchStatus(item);
    if (status !== 'in-progress') return;

    const nextEpisode = getSeriesNextEpisodeCandidate(item);
    if (!nextEpisode?.progressKey) return;

    const progressEntry = getWatchProgressEntry(nextEpisode.progressKey);
    const resumeAt = getResumeTimeSeconds(progressEntry);

    candidates.push({
      item,
      isTV: true,
      index,
      updatedAt: Number(progressEntry?.updatedAt) || 0,
      cardOptions: {
        seasonLabel: resumeAt > 0
          ? `Reprendre ${nextEpisode.code} ${formatTimeLabel(resumeAt)}`
          : `Continuer ${nextEpisode.code}`,
      },
    });
  });

  return candidates
    .sort((a, b) => {
      if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
      return String(a.item?.title || '').localeCompare(String(b.item?.title || ''), 'fr', { sensitivity: 'base' });
    })
    .slice(0, Math.max(1, Number(limit) || 14));
}

function markMovieCompleted(item) {
  const key = getMovieProgressKey(item);
  markPlaybackCompleted(key, item?.title || 'Film');
}

function markSeriesCompleted(seriesItem) {
  const seasons = Array.isArray(seriesItem?.seasons) ? seriesItem.seasons : [];
  seasons.forEach((season) => {
    const seasonNum = Number(season?.season) || 1;
    const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
    episodes.forEach((ep, idx) => {
      const epNum = idx + 1;
      const candidates = Array.isArray(ep?._urlCandidates) ? ep._urlCandidates : getMediaUrlCandidates(ep);
      if (!hasPlayableCandidate(candidates)) return;
      const key = getEpisodeProgressKey(seriesItem, seasonNum, epNum);
      markPlaybackCompleted(key, `${seriesItem?.title || 'Serie'} S${seasonNum}E${epNum}`);
    });
  });
}

function unmarkMovieCompleted(item) {
  const key = getMovieProgressKey(item);
  removeWatchProgressEntry(key);
}

function unmarkSeriesCompleted(seriesItem) {
  const seasons = Array.isArray(seriesItem?.seasons) ? seriesItem.seasons : [];
  seasons.forEach((season) => {
    const seasonNum = Number(season?.season) || 1;
    const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
    episodes.forEach((ep, idx) => {
      const epNum = idx + 1;
      const key = getEpisodeProgressKey(seriesItem, seasonNum, epNum);
      removeWatchProgressEntry(key);
    });
  });
}

function hasTmdbCredentials() {
  return Boolean(CONFIG.TMDB_BEARER_TOKEN || CONFIG.TMDB_API_KEY);
}

function applyTmdbConfig(configData) {
  const apiKey = String(
    configData?.tmdbApiKey
    || configData?.apiKey
    || ''
  ).trim();

  const bearerToken = String(
    configData?.tmdbBearerToken
    || configData?.bearerToken
    || ''
  ).trim();

  if (apiKey) CONFIG.TMDB_API_KEY = apiKey;
  if (bearerToken) CONFIG.TMDB_BEARER_TOKEN = bearerToken;
}

async function loadTmdbConfigFile() {
  try {
    const response = await fetch(CONFIG.TMDB_CONFIG_FILE, { cache: 'no-store' });
    if (!response.ok) return;
    const configData = await response.json();
    applyTmdbConfig(configData);
  } catch {
    // Ignore config loading errors and keep runtime/browser defaults.
  }
}

function getTmdbNumericId(item) {
  const raw = item?.tmdbId ?? item?.tmdb_id ?? item?.tmdbID;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function getTmdbDetailsCacheKey(mediaType, tmdbId) {
  return `${mediaType}::${tmdbId}`;
}

function buildTmdbDetailsRequest(mediaType, tmdbId) {
  const endpointRoot = mediaType === 'tv'
    ? CONFIG.TMDB_TV_DETAILS_ENDPOINT
    : CONFIG.TMDB_MOVIE_DETAILS_ENDPOINT;

  const params = new URLSearchParams({
    language: CONFIG.TMDB_LANG,
  });

  if (!CONFIG.TMDB_BEARER_TOKEN && CONFIG.TMDB_API_KEY) {
    params.set('api_key', CONFIG.TMDB_API_KEY);
  }

  const headers = {};
  if (CONFIG.TMDB_BEARER_TOKEN) headers.Authorization = `Bearer ${CONFIG.TMDB_BEARER_TOKEN}`;

  return {
    url: `${endpointRoot}/${tmdbId}?${params.toString()}`,
    options: { headers },
  };
}

function buildTmdbCreditsRequest(mediaType, tmdbId) {
  const endpointRoot = mediaType === 'tv'
    ? CONFIG.TMDB_TV_DETAILS_ENDPOINT
    : CONFIG.TMDB_MOVIE_DETAILS_ENDPOINT;

  const params = new URLSearchParams({
    language: CONFIG.TMDB_LANG,
  });

  if (!CONFIG.TMDB_BEARER_TOKEN && CONFIG.TMDB_API_KEY) {
    params.set('api_key', CONFIG.TMDB_API_KEY);
  }

  const headers = {};
  if (CONFIG.TMDB_BEARER_TOKEN) headers.Authorization = `Bearer ${CONFIG.TMDB_BEARER_TOKEN}`;

  return {
    url: `${endpointRoot}/${tmdbId}/credits?${params.toString()}`,
    options: { headers },
  };
}

function buildTmdbVideosRequest(mediaType, tmdbId) {
  const endpointRoot = mediaType === 'tv'
    ? CONFIG.TMDB_TV_DETAILS_ENDPOINT
    : CONFIG.TMDB_MOVIE_DETAILS_ENDPOINT;

  const params = new URLSearchParams({
    language: CONFIG.TMDB_LANG,
  });

  if (!CONFIG.TMDB_BEARER_TOKEN && CONFIG.TMDB_API_KEY) {
    params.set('api_key', CONFIG.TMDB_API_KEY);
  }

  const headers = {};
  if (CONFIG.TMDB_BEARER_TOKEN) headers.Authorization = `Bearer ${CONFIG.TMDB_BEARER_TOKEN}`;

  return {
    url: `${endpointRoot}/${tmdbId}/videos?${params.toString()}`,
    options: { headers },
  };
}

function buildTmdbSeasonDetailsRequest(tmdbSeriesId, seasonNumber) {
  const params = new URLSearchParams({
    language: CONFIG.TMDB_LANG,
  });

  if (!CONFIG.TMDB_BEARER_TOKEN && CONFIG.TMDB_API_KEY) {
    params.set('api_key', CONFIG.TMDB_API_KEY);
  }

  const headers = {};
  if (CONFIG.TMDB_BEARER_TOKEN) headers.Authorization = `Bearer ${CONFIG.TMDB_BEARER_TOKEN}`;

  return {
    url: `${CONFIG.TMDB_TV_DETAILS_ENDPOINT}/${tmdbSeriesId}/season/${seasonNumber}?${params.toString()}`,
    options: { headers },
  };
}

async function resolveTmdbSeasonEpisodes(seriesItem, seasonNumber) {
  const tmdbSeriesId = getTmdbNumericId(seriesItem);
  if (!tmdbSeriesId || !Number.isFinite(Number(seasonNumber)) || !hasTmdbCredentials()) return [];

  const cacheKey = `${tmdbSeriesId}::season-${seasonNumber}`;
  if (!tmdbSeasonDetailsCache.has(cacheKey)) {
    try {
      const request = buildTmdbSeasonDetailsRequest(tmdbSeriesId, seasonNumber);
      const response = await fetch(request.url, request.options);
      if (!response.ok) {
        tmdbSeasonDetailsCache.set(cacheKey, []);
      } else {
        const data = await response.json();
        tmdbSeasonDetailsCache.set(cacheKey, Array.isArray(data?.episodes) ? data.episodes : []);
      }
    } catch {
      tmdbSeasonDetailsCache.set(cacheKey, []);
    }
  }

  return tmdbSeasonDetailsCache.get(cacheKey) || [];
}

async function resolveTmdbPosterById(item, mediaType) {
  const tmdbId = getTmdbNumericId(item);
  if (!tmdbId) return null;

  try {
    const cacheKey = getTmdbDetailsCacheKey(mediaType, tmdbId);
    if (!tmdbDetailsCache.has(cacheKey)) {
      const request = buildTmdbDetailsRequest(mediaType, tmdbId);
      const response = await fetch(request.url, request.options);
      if (!response.ok) {
        tmdbDetailsCache.set(cacheKey, null);
      } else {
        tmdbDetailsCache.set(cacheKey, await response.json());
      }
    }

    const data = tmdbDetailsCache.get(cacheKey);
    return data?.poster_path ? `${CONFIG.TMDB_IMAGE_BASE_URL}${data.poster_path}` : null;
  } catch {
    return null;
  }
}

function getReleaseYearFromDate(value) {
  const date = String(value || '');
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : 0;
}

async function resolveTmdbMovieMetadataById(movie) {
  const tmdbId = getTmdbNumericId(movie);
  if (!tmdbId || !hasTmdbCredentials()) return null;

  const cacheKey = getTmdbDetailsCacheKey('movie', tmdbId);

  try {
    if (!tmdbDetailsCache.has(cacheKey)) {
      const request = buildTmdbDetailsRequest('movie', tmdbId);
      const response = await fetch(request.url, request.options);
      if (!response.ok) {
        tmdbDetailsCache.set(cacheKey, null);
      } else {
        tmdbDetailsCache.set(cacheKey, await response.json());
      }
    }

    const data = tmdbDetailsCache.get(cacheKey);
    if (!data || typeof data !== 'object') return null;

    const title = String(data.title || data.original_title || '').trim();
    const releaseDate = String(data.release_date || '').trim();
    const releaseYear = getReleaseYearFromDate(releaseDate);
    const backdropPath = String(data.backdrop_path || '').trim();
    const backdrop = backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : '';
    const genres = Array.isArray(data.genres)
      ? data.genres.map((entry) => String(entry?.name || '').trim()).filter(Boolean)
      : [];

    return {
      title,
      releaseDate,
      year: releaseYear,
      backdrop,
      genres,
    };
  } catch {
    return null;
  }
}

async function resolveTmdbSeriesMetadataById(seriesItem) {
  const tmdbId = getTmdbNumericId(seriesItem);
  if (!tmdbId || !hasTmdbCredentials()) return null;

  const cacheKey = getTmdbDetailsCacheKey('tv', tmdbId);

  try {
    if (!tmdbDetailsCache.has(cacheKey)) {
      const request = buildTmdbDetailsRequest('tv', tmdbId);
      const response = await fetch(request.url, request.options);
      if (!response.ok) {
        tmdbDetailsCache.set(cacheKey, null);
      } else {
        tmdbDetailsCache.set(cacheKey, await response.json());
      }
    }

    const data = tmdbDetailsCache.get(cacheKey);
    if (!data || typeof data !== 'object') return null;

    const title = String(data.name || data.original_name || '').trim();
    const firstAirDate = String(data.first_air_date || '').trim();
    const releaseYear = getReleaseYearFromDate(firstAirDate);
    const backdropPath = String(data.backdrop_path || '').trim();
    const backdrop = backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : '';
    const genres = Array.isArray(data.genres)
      ? data.genres.map((entry) => String(entry?.name || '').trim()).filter(Boolean)
      : [];

    return {
      title,
      year: releaseYear,
      backdrop,
      genres,
    };
  } catch {
    return null;
  }
}

function formatRuntime(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '';
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (!h) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function getMediaDisplayType(mediaType) {
  return mediaType === 'tv' ? 'Série' : 'Film';
}

function openDetailsModal() {
  const modal = document.getElementById('details-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
  const modal = document.getElementById('details-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function fetchTmdbDetailsBundle(item, mediaType = 'movie') {
  const tmdbId = getTmdbNumericId(item);
  if (!tmdbId || !hasTmdbCredentials()) return null;

  const detailsKey = getTmdbDetailsCacheKey(mediaType, tmdbId);

  if (!tmdbDetailsCache.has(detailsKey)) {
    const detailsRequest = buildTmdbDetailsRequest(mediaType, tmdbId);
    const detailsRes = await fetch(detailsRequest.url, detailsRequest.options);
    if (!detailsRes.ok) return null;
    tmdbDetailsCache.set(detailsKey, await detailsRes.json());
  }

  const details = tmdbDetailsCache.get(detailsKey);

  const [creditsData, videosData] = await Promise.all([
    (async () => {
      try {
        const creditsRequest = buildTmdbCreditsRequest(mediaType, tmdbId);
        const creditsRes = await fetch(creditsRequest.url, creditsRequest.options);
        return creditsRes.ok ? await creditsRes.json() : null;
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        const videosRequest = buildTmdbVideosRequest(mediaType, tmdbId);
        const videosRes = await fetch(videosRequest.url, videosRequest.options);
        return videosRes.ok ? await videosRes.json() : null;
      } catch {
        return null;
      }
    })(),
  ]);

  return {
    details,
    credits: creditsData,
    videos: videosData,
  };
}

function renderDetailsModalContent(item, mediaType, bundle) {
  const content = document.getElementById('details-modal-content');
  if (!content) return;

  const details = bundle?.details || {};
  const credits = Array.isArray(bundle?.credits?.cast) ? bundle.credits.cast : [];
  const videos = Array.isArray(bundle?.videos?.results) ? bundle.videos.results : [];

  const title = String(
    mediaType === 'tv'
      ? (details.name || details.original_name || item.title || '')
      : (details.title || details.original_title || item.title || '')
  ).trim();

  const posterPath = String(details.poster_path || '').trim();
  const posterUrl = posterPath ? `${CONFIG.TMDB_IMAGE_BASE_URL}${posterPath}` : String(item.poster || '');
  const overview = String(details.overview || '').trim();

  const genres = Array.isArray(details.genres)
    ? details.genres.map((entry) => String(entry?.name || '').trim()).filter(Boolean)
    : [];

  const voteAverage = Number(details.vote_average);
  const runtimeLabel = mediaType === 'movie'
    ? formatRuntime(details.runtime)
    : `${Number(details.number_of_seasons) || Number(item?.seasons?.length) || 0} saison(s)`;

  const releaseDate = String(
    mediaType === 'tv'
      ? (details.first_air_date || item.year || '')
      : (details.release_date || item.releaseDate || item.year || '')
  );

  const topCast = credits.slice(0, 8);

  const trailers = videos
    .filter((entry) => entry?.site === 'YouTube' && (entry?.type === 'Trailer' || entry?.type === 'Teaser'))
    .slice(0, 3);

  const detailsUrlCandidates = Array.isArray(item?._urlCandidates)
    ? item._urlCandidates
    : getMediaUrlCandidates(item);
  const hasPlaybackTarget = mediaType === 'tv' || detailsUrlCandidates.length > 0;
  const isAlreadyCompleted = mediaType === 'tv'
    ? getSeriesWatchStatus(item) === 'completed'
    : isProgressCompleted(getWatchProgressEntry(getMovieProgressKey(item)));

  content.innerHTML = `
    <div class="details-hero">
      <div class="details-poster-wrap">
        ${posterUrl
          ? `<img class="details-poster" src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}" loading="lazy" />`
          : `<div class="details-poster-fallback">${escapeHtml(getMediaDisplayType(mediaType))}</div>`}
        <button type="button" class="details-poster-play" data-details-action="play" ${hasPlaybackTarget ? '' : 'disabled'} aria-label="Lecture ${escapeHtml(title)}">
          <span>&#9654;</span>
        </button>
      </div>
      <div class="details-head">
        <h3 id="details-modal-title" class="details-title">${escapeHtml(title)}</h3>
        <p class="details-subtitle">${escapeHtml(getMediaDisplayType(mediaType))} · ${escapeHtml(String(releaseDate))}</p>
        <div class="details-stats">
          ${runtimeLabel ? `<span class="details-stat">${escapeHtml(runtimeLabel)}</span>` : ''}
          ${Number.isFinite(voteAverage) ? `<span class="details-stat">Note TMDB: ${escapeHtml(voteAverage.toFixed(1))}/10</span>` : ''}
          ${genres.slice(0, 4).map((genre) => `<span class="details-stat">${escapeHtml(genre)}</span>`).join('')}
        </div>
        <div class="rating-wrap" id="details-rating-wrap"></div>
        <div class="details-trailer-list">
          <button type="button" class="details-btn" data-details-action="mark-watched">${isAlreadyCompleted ? 'Retirer comme vu' : 'Marquer comme vu'}</button>
        </div>
        <p class="details-overview">${overview ? escapeHtml(overview) : 'Aucun synopsis TMDB disponible.'}</p>
      </div>
    </div>

    <section class="details-section">
      <h4>Casting</h4>
      ${topCast.length
        ? `<div class="details-cast-list">${topCast.map((person) => {
            const actorName = String(person?.name || '').trim() || 'Acteur inconnu';
            const actorRole = String(person?.character || '').trim();
            const profilePath = String(person?.profile_path || '').trim();
            const profileUrl = profilePath ? `${CONFIG.TMDB_IMAGE_BASE_URL}${profilePath}` : '';

            return `<article class="details-cast-item">
              <div class="details-cast-avatar-wrap">
                ${profileUrl
                  ? `<img class="details-cast-avatar" src="${escapeHtml(profileUrl)}" alt="${escapeHtml(actorName)}" loading="lazy" />`
                  : `<div class="details-cast-avatar-fallback" aria-hidden="true">${escapeHtml(getNameInitials(actorName))}</div>`}
              </div>
              <div class="details-cast-copy">
                <p class="details-cast-name">${escapeHtml(actorName)}</p>
                ${actorRole ? `<p class="details-cast-role">${escapeHtml(actorRole)}</p>` : ''}
              </div>
            </article>`;
          }).join('')}</div>`
        : '<p class="details-empty">Casting indisponible.</p>'}
    </section>

    <section class="details-section">
      <h4>Bandes-annonces</h4>
      ${trailers.length
        ? `<div class="details-trailer-list">${trailers.map((video) => {
            const key = String(video?.key || '');
            const label = String(video?.name || 'Voir la bande-annonce');
            return `<button type="button" class="details-btn" data-trailer-key="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
          }).join('')}</div>`
        : '<p class="details-empty">Aucune bande-annonce YouTube disponible.</p>'}
    </section>
  `;

  const ratingWrap = content.querySelector('#details-rating-wrap');
  if (ratingWrap) {
    if (mediaType === 'movie') {
      const ratingKey = getRatingKey(item, 'movie');
      renderStarRatingWidget(ratingKey, ratingWrap);
    } else {
      const avg = getSeriesEpisodeRatingAverage(item);
      if (avg !== null) {
        const rounded = Math.round(avg);
        ratingWrap.innerHTML = `
          <span class="rating-label">Moyenne épisodes :</span>
          <span class="rating-stars-display">${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}</span>
          <span class="rating-value-label">${avg.toFixed(1)}/5</span>
        `;
      } else {
        ratingWrap.hidden = true;
      }
    }
  }

  content.querySelectorAll('[data-trailer-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-trailer-key') || '';
      if (!key) return;
      window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(key)}`, '_blank', 'noopener,noreferrer');
    });
  });

  const playBtn = content.querySelector('[data-details-action="play"]');
  playBtn?.addEventListener('click', () => {
    closeDetailsModal();

    if (mediaType === 'tv') {
      showSeriesModal(item);
      return;
    }

    openVideoPlayer(detailsUrlCandidates, item.title, {
      progressKey: mediaType === 'movie' ? getMovieProgressKey(item) : '',
      title: item.title,
      mediaType,
    });
  });

  const markWatchedBtn = content.querySelector('[data-details-action="mark-watched"]');
  markWatchedBtn?.addEventListener('click', () => {
    if (mediaType === 'tv') {
      if (getSeriesWatchStatus(item) === 'completed') {
        unmarkSeriesCompleted(item);
      } else {
        markSeriesCompleted(item);
      }
    } else {
      const key = getMovieProgressKey(item);
      if (isProgressCompleted(getWatchProgressEntry(key))) {
        unmarkMovieCompleted(item);
      } else {
        markMovieCompleted(item);
      }
    }

    renderDetailsModalContent(item, mediaType, bundle);
    renderLibrary();
    refreshFiltersForActiveSection();
    applyCurrentFilters();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TMDB Metadata Caching System
// ═══════════════════════════════════════════════════════════════════════════

const TMDB_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (updated hourly for frequent content updates)
const TMDB_METADATA_STORE_KEY = 'tmdb_metadata_cache';

function getTmdbCacheKey(mediaType, tmdbId) {
  return `${mediaType}::${tmdbId}`;
}

function getTmdbMetadataFromCache(mediaType, tmdbId) {
  if (!tmdbId) return null;
  try {
    const store = JSON.parse(localStorage.getItem(TMDB_METADATA_STORE_KEY) || '{}');
    const cacheKey = getTmdbCacheKey(mediaType, tmdbId);
    const cached = store[cacheKey];
    
    if (!cached || typeof cached !== 'object') return null;
    
    const age = Date.now() - (cached.cachedAt || 0);
    if (age > TMDB_CACHE_TTL_MS) {
      delete store[cacheKey];
      localStorage.setItem(TMDB_METADATA_STORE_KEY, JSON.stringify(store));
      return null;
    }
    
    return cached.data || null;
  } catch {
    return null;
  }
}

function setTmdbMetadataCache(mediaType, tmdbId, metadata) {
  if (!tmdbId || !metadata) return;
  try {
    const store = JSON.parse(localStorage.getItem(TMDB_METADATA_STORE_KEY) || '{}');
    const cacheKey = getTmdbCacheKey(mediaType, tmdbId);
    store[cacheKey] = {
      data: metadata,
      cachedAt: Date.now(),
    };
    localStorage.setItem(TMDB_METADATA_STORE_KEY, JSON.stringify(store));
  } catch {
    // Fail silently
  }
}

function clearTmdbMetadataCache() {
  try {
    localStorage.removeItem(TMDB_METADATA_STORE_KEY);
    console.log('[BoomBoom] TMDB metadata cache cleared - page will refresh new data on next load');
  } catch {
    // Fail silently
  }
}

// Manual cache refresh command for console: window.refreshTmdbCache()
window.refreshTmdbCache = function() {
  clearTmdbMetadataCache();
  location.reload();
};

// Wrapper for TMDB API calls with caching
async function resolveTmdbMovieMetadataByIdWithCache(movie) {
  const tmdbId = getTmdbNumericId(movie);
  if (!tmdbId) return null;

  // Try cache first
  const cached = getTmdbMetadataFromCache('movie', tmdbId);
  if (
    cached
    && Object.prototype.hasOwnProperty.call(cached, 'backdrop')
    && Object.prototype.hasOwnProperty.call(cached, 'genres')
  ) {
    console.log(`[BoomBoom] Cache HIT: movie ${tmdbId}`);
    return cached;
  }

  // Cache miss - fetch from API
  const metadata = await resolveTmdbMovieMetadataById(movie);
  if (metadata) {
    setTmdbMetadataCache('movie', tmdbId, metadata);
    console.log(`[BoomBoom] Cache MISS: movie ${tmdbId} (fetched from API)`);
  }
  return metadata;
}

async function resolveTmdbSeriesMetadataByIdWithCache(series) {
  const tmdbId = getTmdbNumericId(series);
  if (!tmdbId) return null;

  // Try cache first
  const cached = getTmdbMetadataFromCache('tv', tmdbId);
  if (
    cached
    && Object.prototype.hasOwnProperty.call(cached, 'backdrop')
    && Object.prototype.hasOwnProperty.call(cached, 'genres')
  ) {
    console.log(`[BoomBoom] Cache HIT: series ${tmdbId}`);
    return cached;
  }

  // Cache miss - fetch from API
  const metadata = await resolveTmdbSeriesMetadataById(series);
  if (metadata) {
    setTmdbMetadataCache('tv', tmdbId, metadata);
    console.log(`[BoomBoom] Cache MISS: series ${tmdbId} (fetched from API)`);
  }
  return metadata;
}

async function showDetailsModal(item, mediaType = 'movie') {
  const content = document.getElementById('details-modal-content');
  if (!content) return;

  openDetailsModal();
  content.innerHTML = '<p class="details-empty">Chargement de la fiche TMDB...</p>';

  try {
    const bundle = await fetchTmdbDetailsBundle(item, mediaType);
    if (!bundle?.details) {
      content.innerHTML = '<p class="details-empty">Impossible de charger la fiche TMDB. Verifie le tmdbId.</p>';
      return;
    }
    renderDetailsModalContent(item, mediaType, bundle);
  } catch {
    content.innerHTML = '<p class="details-empty">Erreur pendant le chargement de la fiche.</p>';
  }
}

async function hydrateMovieMetadataFromTmdb(movies) {
  if (!Array.isArray(movies) || !movies.length) return 0;
  if (!hasTmdbCredentials()) return 0;

  let updatedCount = 0;
  const workers = [];
  const queue = [...movies];
  const workerCount = Math.min(6, queue.length);

  console.log(`[BoomBoom] Starting movie metadata hydration with ${workerCount} workers...`);

  for (let i = 0; i < workerCount; i += 1) {
    workers.push((async () => {
      while (queue.length) {
        const movie = queue.shift();
        if (!movie) continue;
        const metadata = await resolveTmdbMovieMetadataByIdWithCache(movie);
        if (!metadata) continue;

        let changed = false;

        if (metadata.title) {
          movie.title = metadata.title;
          changed = true;
        }
        if (metadata.releaseDate) {
          movie.releaseDate = metadata.releaseDate;
          changed = true;
        }
        if (metadata.year) {
          movie.year = metadata.year;
          changed = true;
        }
        if (metadata.backdrop) {
          movie.backdrop = metadata.backdrop;
          changed = true;
        }
        if (Array.isArray(metadata.genres)) {
          movie.genres = metadata.genres;
          changed = true;
        }

        if (changed) updatedCount += 1;
      }
    })());
  }

  await Promise.all(workers);
  return updatedCount;
}

async function hydrateSeriesMetadataFromTmdb(seriesList) {
  if (!Array.isArray(seriesList) || !seriesList.length) return 0;
  if (!hasTmdbCredentials()) return 0;

  let updatedCount = 0;
  const workers = [];
  const queue = [...seriesList];
  const workerCount = Math.min(6, queue.length);

  console.log(`[BoomBoom] Starting series metadata hydration with ${workerCount} workers...`);

  for (let i = 0; i < workerCount; i += 1) {
    workers.push((async () => {
      while (queue.length) {
        const seriesItem = queue.shift();
        if (!seriesItem) continue;
        const hasExistingGenres = Array.isArray(seriesItem.genres) && seriesItem.genres.length > 0;
        if (seriesItem.title && seriesItem.year && hasExistingGenres) continue;
        const metadata = await resolveTmdbSeriesMetadataByIdWithCache(seriesItem);
        if (!metadata) continue;

        let changed = false;

        if (metadata.title && !seriesItem.title) {
          seriesItem.title = metadata.title;
          changed = true;
        }
        if (metadata.year && !seriesItem.year) {
          seriesItem.year = metadata.year;
          changed = true;
        }
        if (metadata.backdrop) {
          seriesItem.backdrop = metadata.backdrop;
          changed = true;
        }
        if (Array.isArray(metadata.genres)) {
          seriesItem.genres = metadata.genres;
          changed = true;
        }

        if (changed) updatedCount += 1;
      }
    })());
  }

  await Promise.all(workers);
  return updatedCount;
}

async function resolveTmdbPosterForItem(item, mediaType = 'movie') {
  const tmdbId = getTmdbNumericId(item);
  if (!tmdbId || !hasTmdbCredentials()) return null;

  const cacheKey = `${mediaType}::${tmdbId}`;
  if (tmdbPosterCache.has(cacheKey)) return tmdbPosterCache.get(cacheKey);

  try {
    const posterById = await resolveTmdbPosterById(item, mediaType);
    tmdbPosterCache.set(cacheKey, posterById || null);
    return posterById || null;
  } catch {
    tmdbPosterCache.set(cacheKey, null);
    return null;
  }
}

async function hydratePostersFromTmdb(items, mediaType = 'movie') {
  if (!Array.isArray(items) || !items.length) return 0;
  if (!hasTmdbCredentials()) return 0;

  let updatedCount = 0;
  const workers = [];
  const queue = [...items];
  const workerCount = Math.min(6, queue.length);

  for (let i = 0; i < workerCount; i += 1) {
    workers.push((async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) continue;
        const tmdbPoster = await resolveTmdbPosterForItem(item, mediaType);
        if (!tmdbPoster) continue;
        item.poster = tmdbPoster;
        updatedCount += 1;
      }
    })());
  }

  await Promise.all(workers);

  return updatedCount;
}

async function hydrateMoviePostersFromTmdb(movies) {
  return hydratePostersFromTmdb(movies, 'movie');
}

async function hydrateSeriesPostersFromTmdb(series) {
  return hydratePostersFromTmdb(series, 'tv');
}

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

function getMediaUrlCandidates(entry) {
  const raw = [];
  if (Array.isArray(entry?.urls)) raw.push(...entry.urls);
  raw.push(entry?.url, entry?.tempUrl);

  const seen = new Set();
  return raw
    .map((url) => String(url || '').trim())
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function hasPlayableCandidate(candidates) {
  return candidates.some((url) => !getUrlAvailability(url).isExpired);
}

function updateVideoModalFooter(fallbackTitle = '') {
  const title = document.getElementById('video-modal-title');
  const meta = document.getElementById('video-modal-meta');
  const nav = document.getElementById('video-modal-episode-nav');
  const prevBtn = document.getElementById('video-prev-episode');
  const nextBtn = document.getElementById('video-next-episode');
  const context = playerState.playbackContext;

  if (!title || !meta || !nav || !prevBtn || !nextBtn) return;

  title.textContent = String(context?.displayTitle || fallbackTitle || context?.title || '').trim();

  const subtitle = String(context?.subtitle || '').trim();
  if (subtitle) {
    meta.textContent = subtitle;
    meta.hidden = false;
  } else {
    meta.textContent = '';
    meta.hidden = true;
  }

  const prevEpisode = getEpisodeContextEntry(context, -1);
  const nextEpisode = getEpisodeContextEntry(context, 1);
  const showNav = context?.mediaType === 'episode' && (prevEpisode || nextEpisode);

  nav.hidden = !showNav;
  prevBtn.disabled = !prevEpisode;
  nextBtn.disabled = !nextEpisode;
}

function openVideoModalWithUrl(url, index, movieTitle, candidates, playbackContext = null) {
  const modal = document.getElementById('video-modal');
  const source = document.getElementById('video-source');
  const video = document.getElementById('video-player');

  playerState.urlCandidates = candidates;
  playerState.currentIndex = index;
  playerState.playbackContext = playbackContext && typeof playbackContext === 'object'
    ? { ...playbackContext }
    : null;
  playerState.lastProgressSavedAt = 0;

  source.src = url;

  const progressKey = playerState.playbackContext?.progressKey || '';
  const progressEntry = getWatchProgressEntry(progressKey);
  const resumeAt = getResumeTimeSeconds(progressEntry);
  playerState.pendingResumeTime = resumeAt;
  updateVideoModalFooter(movieTitle);

  video.load();

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Auto-play video (browsers allow if started by user action)
  video.play().catch(() => {
    // Silently ignore if autoplay fails - user can click play button
  });
}

function annotateLibraryLinks() {
  const stats = {
    signed: 0,
    expired: 0,
    expiringSoon: 0,
  };

  state.movies.forEach((movie) => {
    const candidates = getMediaUrlCandidates(movie);
    const availability = getUrlAvailability(candidates[0] || '');
    movie._urlCandidates = candidates;
    movie._hasPlayableCandidate = hasPlayableCandidate(candidates);
    movie._urlAvailability = availability;

    candidates.forEach((url) => {
      const candidateAvailability = getUrlAvailability(url);
      if (candidateAvailability.hasSignedExpiry) stats.signed += 1;
      if (candidateAvailability.isExpired) stats.expired += 1;
      if (candidateAvailability.isExpiringSoon) stats.expiringSoon += 1;
    });
  });

  state.series.forEach((show) => {
    const seasons = Array.isArray(show.seasons) ? show.seasons : [];
    seasons.forEach((season) => {
      const episodes = Array.isArray(season.episodes) ? season.episodes : [];
      episodes.forEach((ep) => {
        const candidates = getMediaUrlCandidates(ep);
        const availability = getUrlAvailability(candidates[0] || '');
        ep._urlCandidates = candidates;
        ep._hasPlayableCandidate = hasPlayableCandidate(candidates);
        ep._urlAvailability = availability;

        candidates.forEach((url) => {
          const candidateAvailability = getUrlAvailability(url);
          if (candidateAvailability.hasSignedExpiry) stats.signed += 1;
          if (candidateAvailability.isExpired) stats.expired += 1;
          if (candidateAvailability.isExpiringSoon) stats.expiringSoon += 1;
        });
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

function getNameInitials(value) {
  const name = String(value || '').trim();
  if (!name) return '?';

  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';

  const first = parts[0]?.charAt(0) || '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) || '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

function normalizeCollection(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getItemCollection(item) {
  return String(item?.collection || '').trim();
}

function getItemGenres(item) {
  const rawGenres = Array.isArray(item?.genres) ? item.genres : [];
  return rawGenres
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function getActiveSection() {
  return document.querySelector('.view.active');
}

function navigateTo(viewId) {
  const navLinks = document.querySelectorAll('.nav-link[data-view]');
  const views = document.querySelectorAll('.view');

  navLinks.forEach((l) => {
    const isActive = l.dataset.view === viewId;
    l.classList.toggle('active', isActive);
    l.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  views.forEach((v) => v.classList.toggle('active', v.id === viewId));
  updateSearchPlaceholder();
  refreshFiltersForActiveSection();
  applyCurrentFilters();
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

function refreshFiltersForActiveSection() {
  const section = getActiveSection();
  if (!section) return;

  if (section.id === 'view-mcu') return;
  if (section.id === 'view-home') return;
  if (section.id === 'view-collections') return;
  if (section.id === 'view-genres') return;
  if (section.id === 'view-stats') return;
  if (section.id === 'view-requests') return;

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
  renderStatusChips();
  _populateGenreSelect(section);
  _wireAdvancedFilters(section);
}

function renderStatusChips() {
  const section = getActiveSection();
  if (!section) return;

  const isSeries = section.id === 'view-series';
  const isMovies = section.id === 'view-films';

  const moviesContainer = document.getElementById('movies-status-filters');
  const seriesContainer = document.getElementById('series-status-filters');

  if (moviesContainer) moviesContainer.innerHTML = '';
  if (seriesContainer) seriesContainer.innerHTML = '';

  const container = isSeries ? seriesContainer : (isMovies ? moviesContainer : null);
  if (!container) return;

  const stateKey = isSeries ? 'series' : 'movies';
  const selectedValue = state.selectedStatus[stateKey] || 'all';
  const fragment = document.createDocumentFragment();

  WATCH_STATUS_FILTERS.forEach((entry) => {
    const chip = document.createElement('button');
    chip.className = `filter-chip ${selectedValue === entry.value ? 'active' : ''}`;
    chip.type = 'button';
    chip.textContent = entry.label;
    chip.addEventListener('click', () => {
      const current = state.selectedStatus[stateKey] || 'all';
      const next = current === entry.value ? 'all' : entry.value;
      state.selectedStatus[stateKey] = next;
      renderStatusChips();
      applyCurrentFilters();
    });
    fragment.appendChild(chip);
  });

  container.appendChild(fragment);
}

function renderAllCollectionChips(collections) {
  const isSeries = document.querySelector('.view.active')?.id === 'view-series';
  const containerId = isSeries ? 'series-collection-filters' : 'movies-collection-filters';
  renderCollectionChips(containerId, collections, isSeries);
}

function getMcuCollectionValue(collections) {
  const mcuEntry = collections.find(({ value, label }) => {
    const normalizedValue = normalizeCollection(value);
    const normalizedLabel = normalizeCollection(label);
    return normalizedValue === 'mcu' || normalizedLabel === 'mcu';
  });

  return mcuEntry?.value || '';
}

function getMcuOrderRenderableItems() {
  const moviesByTmdbId = new Map();
  state.movies.forEach((movie, index) => {
    const tmdbId = getTmdbNumericId(movie);
    if (!tmdbId || moviesByTmdbId.has(tmdbId)) return;
    moviesByTmdbId.set(tmdbId, { item: movie, isTV: false, index });
  });

  const seriesByTmdbId = new Map();
  state.series.forEach((seriesItem, index) => {
    const tmdbId = getTmdbNumericId(seriesItem);
    if (!tmdbId || seriesByTmdbId.has(tmdbId)) return;
    seriesByTmdbId.set(tmdbId, { item: seriesItem, isTV: true, index });
  });

  return MCU_ORDER.map((entry, idx) => {
    const source = entry.type === 'tv'
      ? seriesByTmdbId.get(entry.tmdbId)
      : moviesByTmdbId.get(entry.tmdbId);
    if (!source) return null;

    const mappedTitle = String(entry?.title || '').trim();
    const mappedItem = mappedTitle
      ? { ...source.item, title: mappedTitle }
      : source.item;

    if (entry.type === 'tv' && Number.isFinite(Number(entry?.season))) {
      mappedItem.season = Number(entry.season);
    }

    return {
      ...source,
      item: mappedItem,
      orderIndex: idx + 1,
    };
  }).filter(Boolean);
}

function showMCUOrderList(query = '', gridId = 'mcu-grid', countId = 'mcu-count') {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = '';
  grid.classList.remove('grid-by-year');

  const normalizedQuery = String(query || '').trim().toLowerCase();
  const orderedItems = getMcuOrderRenderableItems().filter(({ item }) => {
    const title = String(item?.title || '').toLowerCase();
    return !normalizedQuery || title.includes(normalizedQuery);
  });

  const count = document.getElementById(countId);
  if (count) count.textContent = String(orderedItems.length);

  if (!orderedItems.length) return;

  const fragment = document.createDocumentFragment();
  orderedItems.forEach(({ item, isTV, index, orderIndex }) => {
    const seasonNumber = Number(item?.season);
    const seasonLabel = isTV && Number.isFinite(seasonNumber) && seasonNumber > 0
      ? `Saison ${seasonNumber}`
      : '';
    const card = createCard(item, isTV, index, { seasonLabel });
    const rank = document.createElement('span');
    rank.className = 'mcu-order-rank';
    rank.textContent = `#${orderIndex}`;
    card.appendChild(rank);
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
  refreshProgressDecorations();
}

function refreshMcuViewIfActive() {
  const section = getActiveSection();
  if (!section || section.id !== 'view-mcu') return;
  const input = document.getElementById('search');
  showMCUOrderList(input?.value || '', 'mcu-grid', 'mcu-count');
}

function renderCollectionChips(containerId, collections, isSeries = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const mcuCollectionValue = getMcuCollectionValue(collections);

  collections.forEach(({ value, label }) => {
    const isMcuCollection = Boolean(mcuCollectionValue)
      && normalizeCollection(value) === normalizeCollection(mcuCollectionValue);
    if (isMcuCollection) return;

    const chip = document.createElement('button');
    chip.className = `filter-chip ${state.selectedCollection === value ? 'active' : ''}`;
    chip.textContent = label;
    chip.addEventListener('click', () => {
      const nextValue = state.selectedCollection === value ? 'all' : value;

      state.selectedCollection = nextValue;

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


  if (section.id === 'view-mcu') {
    showMCUOrderList(input.value, 'mcu-grid', 'mcu-count');
    return;
  }

  // Recherche sur la page d'accueil
  if (section.id === 'view-home') {
    const q = input.value.trim().toLowerCase();
    const homeRows = document.getElementById('home-rows');
    // Si recherche vide, affichage classique
    if (!q) {
      if (homeRows) homeRows.style.display = '';
      // Optionnel : réafficher le contenu d'accueil si masqué
      return;
    }
    // Sinon, afficher une grille filtrée de tous les films et séries
    if (homeRows) homeRows.style.display = 'none';
    let results = [
      ...state.movies.map((item, i) => ({ item, isTV: false, index: i })),
      ...state.series.map((item, i) => ({ item, isTV: true, index: i }))
    ];
    results = results.filter(({ item }) => String(item.title || '').toLowerCase().includes(q));

    // Créer ou cibler un conteneur de résultats
    let searchGrid = document.getElementById('home-search-grid');
    if (!searchGrid) {
      searchGrid = document.createElement('div');
      searchGrid.id = 'home-search-grid';
      searchGrid.className = 'grid';
      section.appendChild(searchGrid);
    }
    searchGrid.innerHTML = '';
    results.forEach(({ item, isTV, index }) => {
      searchGrid.appendChild(createCard(item, isTV, index));
    });
    searchGrid.style.display = '';

    // Afficher le compteur de résultats si besoin
    let count = section.querySelector('.count');
    if (!count) {
      count = document.createElement('span');
      count.className = 'count';
      section.querySelector('.section-title')?.appendChild(count);
    }
    count.textContent = String(results.length);
    count.style.display = '';
    return;
  }

  if (section.id === 'view-collections') {
    const searchGrid = document.getElementById('home-search-grid');
    if (searchGrid) searchGrid.style.display = 'none';

    const q = input.value.trim().toLowerCase();
    const detailCards = section.querySelectorAll('.collections-detail-grid .card');
    const detailSubtitle = document.getElementById('collections-detail-subtitle');

    if (detailCards.length) {
      let visibleCount = 0;
      detailCards.forEach((card) => {
        const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
        const isVisible = !q || title.includes(q);
        card.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount += 1;
      });

      if (detailSubtitle) {
        detailSubtitle.textContent = `${visibleCount} resultat${visibleCount > 1 ? 's' : ''}`;
      }
      setCollectionsCount(visibleCount);
      return;
    }

    const showcaseCards = section.querySelectorAll('.collection-showcase-card');
    let visibleCollections = 0;
    showcaseCards.forEach((card) => {
      const label = String(card.dataset.collectionLabel || '').toLowerCase();
      const isVisible = !q || label.includes(q);
      card.style.display = isVisible ? '' : 'none';
      if (isVisible) visibleCollections += 1;
    });

    setCollectionsCount(visibleCollections);
    return;
  }

  if (section.id === 'view-genres') {
    const searchGrid = document.getElementById('home-search-grid');
    if (searchGrid) searchGrid.style.display = 'none';

    const q = input.value.trim().toLowerCase();
    const detailCards = section.querySelectorAll('.genres-detail-grid .card');
    const detailSubtitle = document.getElementById('genres-detail-subtitle');

    if (detailCards.length) {
      let visibleCount = 0;
      detailCards.forEach((card) => {
        const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
        const isVisible = !q || title.includes(q);
        card.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount += 1;
      });

      if (detailSubtitle) {
        detailSubtitle.textContent = `${visibleCount} resultat${visibleCount > 1 ? 's' : ''}`;
      }
      setGenresCount(visibleCount);
      return;
    }

    const showcaseCards = section.querySelectorAll('.collection-showcase-card[data-genre-key]');
    let visibleGenres = 0;
    showcaseCards.forEach((card) => {
      const label = String(card.dataset.genreLabel || '').toLowerCase();
      const isVisible = !q || label.includes(q);
      card.style.display = isVisible ? '' : 'none';
      if (isVisible) visibleGenres += 1;
    });

    setGenresCount(visibleGenres);
    return;
  }

  const q = input.value.trim().toLowerCase();
  const selectedCollection = state.selectedCollection;
  const statusKey = section.id === 'view-series' ? 'series' : 'movies';
  const selectedStatus = state.selectedStatus[statusKey] || 'all';
  const selectedGenre = state.filterConfig[statusKey]?.genre || '';
  let visibleCount = 0;

  section.querySelectorAll('.card').forEach((card) => {
    const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
    const matchSearch = !q || title.includes(q);
    const matchCollection = selectedCollection === 'all' || card.dataset.collection === selectedCollection;
    const cardStatus = card.dataset.watchStatus || 'not-started';
    const matchStatus = selectedStatus === 'all' || selectedStatus === cardStatus;
    const cardGenres = (card.dataset.genres || '').split('|').map((g) => g.toLowerCase());
    const matchGenre = !selectedGenre || cardGenres.includes(selectedGenre.toLowerCase());
    const isVisible = matchSearch && matchCollection && matchStatus && matchGenre;

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

function _populateGenreSelect(section) {
  const isMovies = section.id === 'view-films';
  const isSeries = section.id === 'view-series';
  if (!isMovies && !isSeries) return;

  const stateKey = isSeries ? 'series' : 'movies';
  const selectId = isSeries ? 'series-genre-select' : 'movies-genre-select';
  const select = document.getElementById(selectId);
  if (!select) return;

  const items = isSeries ? state.series : state.movies;
  const genreSet = new Set();
  items.forEach((item) => getItemGenres(item).forEach((g) => genreSet.add(g)));
  const genres = [...genreSet].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  const currentVal = state.filterConfig[stateKey]?.genre || '';
  select.innerHTML = '<option value="">Tous les genres</option>'
    + genres.map((g) => `<option value="${escapeHtml(g)}"${g === currentVal ? ' selected' : ''}>${escapeHtml(g)}</option>`).join('');
}

const _advancedFiltersBound = new Set();
function _wireAdvancedFilters(section) {
  const isMovies = section.id === 'view-films';
  const isSeries = section.id === 'view-series';
  if (!isMovies && !isSeries) return;

  const stateKey  = isSeries ? 'series' : 'movies';
  const genreSelId = isSeries ? 'series-genre-select' : 'movies-genre-select';
  const sortSelId  = isSeries ? 'series-sort-select'  : 'movies-sort-select';

  if (!_advancedFiltersBound.has(genreSelId)) {
    const genreSel = document.getElementById(genreSelId);
    genreSel?.addEventListener('change', () => {
      state.filterConfig[stateKey].genre = genreSel.value;
      applyCurrentFilters();
    });
    _advancedFiltersBound.add(genreSelId);
  }

  if (!_advancedFiltersBound.has(sortSelId)) {
    const sortSel = document.getElementById(sortSelId);
    sortSel?.addEventListener('change', () => {
      state.sortConfig[stateKey] = sortSel.value;
      renderLibrary();
      refreshFiltersForActiveSection();
      applyCurrentFilters();
    });
    _advancedFiltersBound.add(sortSelId);
  }
}

function updateSearchPlaceholder() {
  const input = document.getElementById('search');
  const section = getActiveSection();
  if (!input || !section) return;

  if (section.id === 'view-mcu') {
    input.placeholder = 'Rechercher dans MCU…';
    return;
  }

  if (section.id === 'view-collections') {
    input.placeholder = state.activeCollectionKey
      ? 'Rechercher dans cette collection…'
      : 'Rechercher une collection…';
    return;
  }

  if (section.id === 'view-genres') {
    input.placeholder = state.activeGenreKey
      ? 'Rechercher dans ce genre…'
      : 'Rechercher un genre…';
    return;
  }

  input.placeholder = 'Rechercher un titre…';
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

async function showSeriesModal(seriesItem) {
  const modal = document.getElementById('series-modal');
  const title = document.getElementById('series-modal-title');
  const meta = document.getElementById('series-modal-meta');
  const content = document.getElementById('series-modal-content');

  const requestId = `${Date.now()}-${Math.random()}`;
  modal.dataset.requestId = requestId;

  const seasons = Array.isArray(seriesItem.seasons) ? seriesItem.seasons : [];
  const totalEpisodes = seasons.reduce((acc, s) => {
    const epList = Array.isArray(s.episodes) ? s.episodes : Array(Number(s.episodes) || 0);
    return acc + epList.length;
  }, 0);

  title.textContent = seriesItem.title;
  meta.textContent = `${seriesItem.year || ''} | ${seasons.length} saison(s) | ${totalEpisodes} episode(s)`;

  const head = meta.closest('.series-modal-head');
  const existingContinueBtn = head?.querySelector('.series-continue-btn');
  existingContinueBtn?.remove();

  // Series average rating element
  let seriesAvgEl = head?.querySelector('.series-rating-avg');
  if (!seriesAvgEl && head) {
    seriesAvgEl = document.createElement('p');
    seriesAvgEl.className = 'series-rating-avg';
    seriesAvgEl.setAttribute('hidden', 'hidden');
    head.appendChild(seriesAvgEl);
  }

  content.innerHTML = '<p class="series-empty">Chargement des episodes TMDB...</p>';

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const seasonEpisodesMap = new Map();
  await Promise.all(seasons.map(async (season) => {
    const seasonNum = Number(season.season) || 1;
    const tmdbEpisodes = await resolveTmdbSeasonEpisodes(seriesItem, seasonNum);
    seasonEpisodesMap.set(seasonNum, tmdbEpisodes);
  }));

  if (modal.dataset.requestId !== requestId) return;

  let html = '';
  const playableEpisodes = [];
  seasons.forEach((season) => {
    const seasonNum = Number(season.season) || 1;
    const tmdbEpisodes = seasonEpisodesMap.get(seasonNum) || [];
    const epList = Array.isArray(season.episodes)
      ? season.episodes
      : Array.from({ length: Number(season.episodes) || 0 }, () => ({ url: '' }));
    const epCount = epList.length;
    html += `
      <article class="season-card">
        <header class="season-card-head">
          <h4>Saison ${seasonNum}</h4>
          <span>${epCount} episode(s) | ${season.year || ''}</span>
          <span class="season-avg-badge" data-season-avg-for="${seasonNum}" hidden></span>
        </header>
        <div class="episode-list">
    `;

    epList.forEach((ep, i) => {
      const epNum = i + 1;
      const code = `S${String(seasonNum).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
      const progressKey = getEpisodeProgressKey(seriesItem, seasonNum, epNum);
      const tmdbEpisode = tmdbEpisodes.find((entry) => Number(entry?.episode_number) === epNum) || tmdbEpisodes[i] || null;
      const tmdbEpisodeName = String(tmdbEpisode?.name || '').trim();
      const tmdbAirDate = String(tmdbEpisode?.air_date || '').trim();
      const tmdbStillPath = String(tmdbEpisode?.still_path || '').trim();

      const urlCandidates = Array.isArray(ep?._urlCandidates) ? ep._urlCandidates : getMediaUrlCandidates(ep);
      const hasUrl = urlCandidates.length > 0;

      if (hasUrl) {
        playableEpisodes.push(buildEpisodePlaybackEntry(
          seriesItem.title,
          code,
          tmdbEpisodeName || `Episode ${epNum}`,
          urlCandidates,
          progressKey
        ));
      }

      const thumbMarkup = tmdbStillPath
        ? `<img class="episode-thumb" src="${escapeHtml(`${CONFIG.TMDB_IMAGE_BASE_URL}${tmdbStillPath}`)}" alt="${escapeHtml(tmdbEpisodeName || code)}" loading="lazy" />`
        : `<div class="episode-thumb-fallback">${escapeHtml(code)}</div>`;

      const epRatingKey = getEpisodeRatingKey(seriesItem, seasonNum, epNum);
      html += `
          <article class="episode-card${hasUrl ? ' episode-playable' : ''}" data-progress-key="${escapeHtml(progressKey)}" data-ep-rating-widget-key="${escapeHtml(epRatingKey)}">
            <div class="episode-thumb-wrap">
              ${thumbMarkup}
            </div>
            <div class="episode-main">
              <p class="episode-code">${code}</p>
              <p class="episode-title">${escapeHtml(tmdbEpisodeName || `Episode ${epNum}`)}</p>
              <p class="episode-year">${escapeHtml(tmdbAirDate || String(season.year || ''))}</p>
              <div data-ep-rating-widget="${escapeHtml(epRatingKey)}"></div>
            </div>
            <span class="watch-state-badge watch-state-badge-episode" data-progress-badge-for="${escapeHtml(progressKey)}" hidden></span>
            <div class="watch-progress watch-progress-episode" data-progress-key="${escapeHtml(progressKey)}"><span class="watch-progress-fill"></span></div>
            ${hasUrl ? '<span class="episode-play">&#9654;</span>' : ''}
          </article>
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

  modal._playableEpisodes = playableEpisodes;
  content.innerHTML = html;

  // Wire episode star rating widgets
  content.querySelectorAll('[data-ep-rating-widget]').forEach((wrap) => {
    const key = wrap.getAttribute('data-ep-rating-widget') || '';
    if (!key) return;
    renderMiniStarWidget(key, wrap, () => refreshSeriesModalAverages(content, head, seriesItem));
  });

  // Render initial season + series averages
  refreshSeriesModalAverages(content, head, seriesItem);

  const nextEpisode = getSeriesNextEpisodeCandidate(seriesItem);
  const continueIndex = nextEpisode?.progressKey
    ? playableEpisodes.findIndex((entry) => entry.progressKey === nextEpisode.progressKey)
    : -1;

  if (head && continueIndex >= 0) {
    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'details-btn series-continue-btn';
    continueBtn.textContent = `Continuer ${nextEpisode.code}`;
    continueBtn.addEventListener('click', () => {
      const playbackContext = createEpisodePlaybackContext(playableEpisodes, continueIndex);
      if (!playbackContext) return;

      openVideoPlayer(
        playableEpisodes[continueIndex].candidates,
        playableEpisodes[continueIndex].displayTitle,
        playbackContext
      );
    });
    head.appendChild(continueBtn);
  }

  refreshProgressDecorations();
}

function closeSeriesModal() {
  const modal = document.getElementById('series-modal');
  modal._playableEpisodes = [];
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openVideoPlayer(videoUrl, movieTitle, playbackContext = null) {
  const candidates = Array.isArray(videoUrl)
    ? videoUrl
    : getMediaUrlCandidates({ url: videoUrl });

  const firstUrl = candidates[0] || '';
  openVideoModalWithUrl(firstUrl, 0, movieTitle, candidates, playbackContext);
}

function closeVideoPlayer() {
  const modal = document.getElementById('video-modal');
  const source = document.getElementById('video-source');
  const video = document.getElementById('video-player');

  const context = playerState.playbackContext;
  if (context?.progressKey) {
    setPlaybackProgress(
      context.progressKey,
      context?.title || document.getElementById('video-modal-title')?.textContent || '',
      Number(video.currentTime) || 0,
      Number(video.duration) || 0
    );
    refreshProgressDecorations();
  }

  video.pause();
  video.currentTime = 0;
  source.src = '';
  playerState.urlCandidates = [];
  playerState.currentIndex = 0;
  playerState.playbackContext = null;
  playerState.lastProgressSavedAt = 0;
  playerState.pendingResumeTime = 0;

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  // Refresh cards (including MCU TV entries) after saving progress state.
  renderLibrary();
  refreshFiltersForActiveSection();
  applyCurrentFilters();
}

function setupVideoModal() {
  const modal = document.getElementById('video-modal');
  const closeBtn = document.getElementById('video-modal-close');
  const video = document.getElementById('video-player');
  const prevEpisodeBtn = document.getElementById('video-prev-episode');
  const nextEpisodeBtn = document.getElementById('video-next-episode');
  const SEEK_STEP_SECONDS = 10;

  function seekVideoBy(offsetSeconds) {
    const duration = Number(video.duration) || 0;
    const currentTime = Number(video.currentTime) || 0;
    const targetTime = Math.max(0, currentTime + Number(offsetSeconds || 0));

    video.currentTime = duration > 0 ? Math.min(duration, targetTime) : targetTime;
  }

  function bindMediaSessionSeekHandlers() {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setActionHandler !== 'function') {
      return;
    }

    try {
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = Number(details?.seekOffset) || SEEK_STEP_SECONDS;
        seekVideoBy(Math.min(SEEK_STEP_SECONDS, offset));
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = Number(details?.seekOffset) || SEEK_STEP_SECONDS;
        seekVideoBy(-Math.min(SEEK_STEP_SECONDS, offset));
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        const targetTime = Number(details?.seekTime);
        const duration = Number(video.duration) || 0;

        if (!Number.isFinite(targetTime)) return;

        video.currentTime = duration > 0 ? Math.min(duration, Math.max(0, targetTime)) : Math.max(0, targetTime);
      });
    } catch (_error) {
      // Ignore browsers that expose Media Session partially but reject these handlers.
    }
  }

  function handleVideoKeyboardShortcuts(e) {
    if (modal.hidden) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeVideoPlayer();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      seekVideoBy(SEEK_STEP_SECONDS);
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      seekVideoBy(-SEEK_STEP_SECONDS);
    }
  }

  function persistCurrentPlaybackProgress() {
    const context = playerState.playbackContext;
    const progressKey = context?.progressKey || '';
    if (!progressKey) return;

    setPlaybackProgress(
      progressKey,
      context?.title || document.getElementById('video-modal-title')?.textContent || '',
      Number(video.currentTime) || 0,
      Number(video.duration) || 0
    );
    refreshProgressDecorations();
    refreshMcuViewIfActive();
  }

  function openEpisodeAtOffset(offset) {
    const context = playerState.playbackContext;
    const targetEpisode = getEpisodeContextEntry(context, offset);
    const currentEpisodeIndex = Number(context?.episodeIndex);
    const episodeList = Array.isArray(context?.episodeList) ? context.episodeList : [];

    if (!targetEpisode?.candidates?.length || !Number.isInteger(currentEpisodeIndex)) return;

    persistCurrentPlaybackProgress();
    openVideoPlayer(
      targetEpisode.candidates,
      targetEpisode.displayTitle || targetEpisode.title,
      createEpisodePlaybackContext(episodeList, currentEpisodeIndex + offset)
    );
  }

  function applyPendingResumeTime() {
    const resumeAt = Number(playerState.pendingResumeTime) || 0;
    if (!resumeAt) return;

    const safeTarget = Math.min(
      Math.max(0, Number(video.duration) - 2),
      resumeAt
    );

    if (Number.isFinite(safeTarget) && safeTarget > 0) {
      video.currentTime = safeTarget;
    }

    playerState.pendingResumeTime = 0;
  }

  closeBtn.addEventListener('click', closeVideoPlayer);
  prevEpisodeBtn?.addEventListener('click', () => openEpisodeAtOffset(-1));
  nextEpisodeBtn?.addEventListener('click', () => openEpisodeAtOffset(1));
  bindMediaSessionSeekHandlers();
  modal.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.hasAttribute('data-close-video')) {
      closeVideoPlayer();
    }
  });

  window.addEventListener('keydown', handleVideoKeyboardShortcuts, true);

  video.addEventListener('loadedmetadata', () => {
    applyPendingResumeTime();
  });

  video.addEventListener('canplay', () => {
    applyPendingResumeTime();
  });

  video.addEventListener('pause', () => {
    if (modal.hidden) return;
    persistCurrentPlaybackProgress();
  });

  video.addEventListener('timeupdate', () => {
    const context = playerState.playbackContext;
    const progressKey = context?.progressKey || '';
    if (!progressKey) return;

    const now = Date.now();
    if (now - playerState.lastProgressSavedAt < WATCH_PROGRESS_SAVE_INTERVAL_MS) return;
    playerState.lastProgressSavedAt = now;

    persistCurrentPlaybackProgress();
  });

  video.addEventListener('ended', () => {
    const context = playerState.playbackContext;
    if (!context?.progressKey) return;
    markPlaybackCompleted(context.progressKey, context?.title || '');

    const nextEpisode = getEpisodeContextEntry(context, 1);
    if (context?.mediaType === 'episode' && nextEpisode?.candidates?.length) {
      openVideoPlayer(
        nextEpisode.candidates,
        nextEpisode.displayTitle || nextEpisode.title,
        createEpisodePlaybackContext(context.episodeList, Number(context.episodeIndex) + 1)
      );
      return;
    }

    renderLibrary();
    refreshFiltersForActiveSection();
    applyCurrentFilters();
  });


}

function setupDetailsModal() {
  const modal = document.getElementById('details-modal');
  const closeBtn = document.getElementById('details-modal-close');
  if (!modal) return;

  closeBtn?.addEventListener('click', closeDetailsModal);
  modal.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.hasAttribute('data-close-details')) {
      closeDetailsModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeDetailsModal();
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
    if (epItem) {
      const playableEpisodes = Array.isArray(modal._playableEpisodes) ? modal._playableEpisodes : [];
      const progressKey = epItem.dataset.progressKey || '';
      const episodeIndex = playableEpisodes.findIndex((entry) => entry.progressKey === progressKey);
      const playbackContext = createEpisodePlaybackContext(playableEpisodes, episodeIndex);
      if (!playbackContext) return;

      openVideoPlayer(
        playableEpisodes[episodeIndex].candidates,
        playableEpisodes[episodeIndex].displayTitle,
        playbackContext
      );
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeSeriesModal();
  });
}

function createCard(item, isTV = false, index = 0, options = {}) {
  const releaseLabel = !isTV && item.releaseDate
    ? String(item.releaseDate)
    : String(item.year || '');

  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${item.title} (${releaseLabel})`);
  card.dataset.year = String(item.year || '');
  // genres pour le filtre avancé
  const cardGenreList = getItemGenres(item);
  card.dataset.genres = cardGenreList.join('|');
  const collectionLabel = getItemCollection(item);
  card.dataset.collection = normalizeCollection(collectionLabel);
  card.dataset.collectionLabel = collectionLabel;
  const seasonLabel = String(options?.seasonLabel || '').trim();
  const sagaBadgeLabel = String(options?.sagaBadge || '').trim();
  const urlCandidates = Array.isArray(item?._urlCandidates) ? item._urlCandidates : getMediaUrlCandidates(item);
  const collectionBadge = collectionLabel
    ? `<span class="card-collection">${escapeHtml(collectionLabel)}</span>`
    : '';
  const seasonBadge = seasonLabel
    ? `<span class="card-season">${escapeHtml(seasonLabel)}</span>`
    : '';
  const sagaBadge = sagaBadgeLabel
    ? `<span class="card-saga-badge">${escapeHtml(sagaBadgeLabel)}</span>`
    : '';
  const progressKey = !isTV ? getMovieProgressKey(item) : '';
  const itemRatingKey = getRatingKey(item, isTV ? 'tv' : 'movie');
  const currentCardRating = getUserRating(itemRatingKey);

  let cardWatchStatus = 'not-started';
  let progressBadgeMarkup = '';
  let progressBarMarkup = '';

  if (!isTV) {
    cardWatchStatus = getMovieWatchStatus(item);
    progressBadgeMarkup = `<span class="watch-state-badge" data-progress-badge-for="${escapeHtml(progressKey)}" hidden></span>`;
    progressBarMarkup = `<div class="watch-progress" data-progress-key="${escapeHtml(progressKey)}"><span class="watch-progress-fill"></span></div>`;
  } else {
    const seasonScope = Number(item?.season) || 0;
    const stats = getSeriesEpisodeProgressStats(item, { seasonNumber: seasonScope });
    const total = Number(stats.playableEpisodes) || 0;
    const progressUnits = Math.max(0, Number(stats.progressUnits) || 0);
    const ratio = total > 0 ? Math.max(0, Math.min(1, progressUnits / total)) : 0;
    const isCompleted = total > 0 && Number(stats.completedEpisodes) >= total;
    cardWatchStatus = isCompleted
      ? 'completed'
      : Number(stats.startedEpisodes) > 0
        ? 'in-progress'
        : 'not-started';

    const percent = isCompleted ? 100 : Math.round(ratio * 100);
    const showBar = ratio > 0 || isCompleted;
    const barClass = showBar ? 'watch-progress watch-progress-visible' : 'watch-progress';
    progressBarMarkup = `<div class="${barClass}"><span class="watch-progress-fill" style="width: ${percent}%"></span></div>`;

    if (cardWatchStatus === 'completed') {
      progressBadgeMarkup = '<span class="watch-state-badge watch-state-complete">Terminé</span>';
    } else if (cardWatchStatus === 'in-progress') {
      const nextEpisode = getSeriesNextEpisodeCandidate(item, { seasonNumber: seasonScope });
      progressBadgeMarkup = `<span class="watch-state-badge watch-state-resume">${escapeHtml(nextEpisode?.code ? `Continuer ${nextEpisode.code}` : 'En cours')}</span>`;
    }
  }

  card.innerHTML = `
    <div class="card-placeholder">
      <span class="placeholder-icon">${isTV ? 'TV' : 'FILM'}</span>
      <span class="placeholder-title">${escapeHtml(item.title)}</span>
    </div>
    <img class="card-img" alt="${escapeHtml(item.title)}" loading="lazy" />
    ${sagaBadge}
    ${progressBadgeMarkup}
    <div class="card-play" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="#000" width="22" height="22">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </div>
    ${progressBarMarkup}
    <div class="card-overlay">
      <h3 class="card-title">${escapeHtml(item.title)}</h3>
      <div class="card-meta">
        <span class="card-year">${escapeHtml(releaseLabel)}</span>
        ${seasonBadge}
        ${collectionBadge}
      </div>
      <div class="card-rating" data-rating-display-for="${escapeHtml(itemRatingKey)}"${currentCardRating > 0 ? '' : ' hidden'}>${currentCardRating > 0 ? '★'.repeat(currentCardRating) + '☆'.repeat(5 - currentCardRating) : ''}</div>
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

    const isTmdbPoster = typeof item.poster === 'string' && item.poster.includes('image.tmdb.org');
    if (isTmdbPoster) {
      // TMDB posters are few in this app: eager loading avoids browser lazy-loading stalls.
      img.loading = 'eager';
      img.fetchPriority = 'high';
    } else if (index < 8) {
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

  const openDetails = () => {
    showDetailsModal(item, isTV ? 'tv' : 'movie');
  };

  const openPlayer = () => {
    if (isTV) {
      showSeriesModal(state.series[index]);
      return;
    }

    openVideoPlayer(urlCandidates, item.title, {
      progressKey: getMovieProgressKey(item),
      title: item.title,
      mediaType: 'movie',
    });
  };

  card.addEventListener('click', openDetails);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openDetails();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      openPlayer();
    }
  });

  if (progressKey) {
    card.dataset.progressKey = progressKey;
  }

  card.dataset.watchStatus = cardWatchStatus;

  return card;
}

// ── Collections & home rows ──────────────────────────────────────────────────

function getHeroCandidate() {
  // Prefer items with a backdrop for the cinematic hero
  const withBackdrop = [
    ...state.movies.map((item) => ({ item, isTV: false })),
    ...state.series.map((item) => ({ item, isTV: true })),
  ].filter(({ item }) => {
    const title = String(item?.title || '').trim();
    if (!title) return false;
    return Boolean(item?.backdrop);
  });

  const pool = withBackdrop.length ? withBackdrop : [
    ...state.movies.map((item) => ({ item, isTV: false })),
    ...state.series.map((item) => ({ item, isTV: true })),
  ].filter(({ item }) => Boolean(String(item?.title || '').trim()) && Boolean(item?.poster));

  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function renderHomeHero() {
  const hero = document.getElementById('home-hero');
  if (!hero) return;

  const candidate = getHeroCandidate();
  if (!candidate?.item) {
    hero.innerHTML = '';
    hero.style.removeProperty('--hero-bg');
    return;
  }

  const { item, isTV } = candidate;
  const releaseLabel = !isTV && item.releaseDate
    ? String(item.releaseDate)
    : String(item.year || '');
  const overview = String(item.overview || '').trim();
  const heroImageUrl = String(item.backdrop || item.poster || '').trim();

  if (heroImageUrl) {
    hero.style.setProperty('--hero-bg', `url("${heroImageUrl.replace(/"/g, '\\"')}")`);
  } else {
    hero.style.removeProperty('--hero-bg');
  }

  // Build meta segments: type · year · genres
  const typeBadge = isTV ? 'Série' : 'Film';
  const genres = getItemGenres(item).slice(0, 3);
  const metaParts = [typeBadge, releaseLabel, ...genres].filter(Boolean);
  const metaHtml = metaParts.map((part, i) =>
    (i > 0 ? '<span class="hero-dot"></span>' : '') + escapeHtml(part)
  ).join('');

  hero.innerHTML = `
    <div class="home-hero-content">
      <p class="home-hero-kicker">Sélection BoomBoom</p>
      <h2 class="home-hero-title">${escapeHtml(item.title)}</h2>
      <p class="home-hero-meta">${metaHtml}</p>
      ${overview ? `<p class="home-hero-overview">${escapeHtml(overview)}</p>` : ''}
      <div class="home-hero-actions">
        <button type="button" class="hero-watch-btn" id="hero-watch-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Regarder
        </button>
        <button type="button" class="hero-details-btn" id="hero-details-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Plus d'infos
        </button>
      </div>
    </div>
    <div class="home-hero-scroll" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
    </div>
  `;

  const watchBtn = document.getElementById('hero-watch-btn');
  const detailsBtn = document.getElementById('hero-details-btn');

  watchBtn?.addEventListener('click', () => {
    const urlCandidates = Array.isArray(item?._urlCandidates) ? item._urlCandidates : getMediaUrlCandidates(item);
    if (urlCandidates.length > 0) {
      openVideoPlayer(urlCandidates, item.title, {
        progressKey: !isTV ? getMovieProgressKey(item) : '',
        title: item.title,
        mediaType: isTV ? 'tv' : 'movie',
      });
      return;
    }
    showDetailsModal(item, isTV ? 'tv' : 'movie');
  });

  detailsBtn?.addEventListener('click', () => {
    showDetailsModal(item, isTV ? 'tv' : 'movie');
  });
}

async function loadCollections() {
  try {
    const res = await fetch(CONFIG.COLLECTIONS_FILE);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) state.collections = data;
  } catch {
    state.collections = [];
  }
}

function getRecentlyAdded(limit = 20) {
  const allItems = [
    ...state.movies.map((item) => ({ item, isTV: false })),
    ...state.series.map((item) => ({ item, isTV: true })),
  ];
  allItems.sort((a, b) => {
    const dateA = a.item.createdAt ? new Date(a.item.createdAt).getTime() : 0;
    const dateB = b.item.createdAt ? new Date(b.item.createdAt).getTime() : 0;
    return dateB - dateA;
  });
  return allItems.slice(0, limit).map(({ item, isTV }, i) => ({ item, isTV, index: i }));
}

function getCollectionItems(collection) {
  const ids = new Set((collection.tmdbIds || []).map(Number));
  if (!ids.size) return [];

  const result = [];
  const colType = String(collection.type || '').toLowerCase();

  if (colType === 'movie' || !colType) {
    state.movies.forEach((item, index) => {
      const tmdbId = getTmdbNumericId(item);
      if (tmdbId && ids.has(tmdbId)) result.push({ item, isTV: false, index });
    });
  }

  if (colType === 'series' || !colType) {
    state.series.forEach((item, index) => {
      const tmdbId = getTmdbNumericId(item);
      if (tmdbId && ids.has(tmdbId)) result.push({ item, isTV: true, index });
    });
  }

  if (collection.ordered && collection.tmdbIds) {
    result.sort((a, b) => {
      const idxA = collection.tmdbIds.indexOf(getTmdbNumericId(a.item));
      const idxB = collection.tmdbIds.indexOf(getTmdbNumericId(b.item));
      return idxA - idxB;
    });
  }

  return result;
}

function getCollectionDisplayEntries() {
  const entries = [];

  const mcuItems = getMcuOrderRenderableItems();
  if (mcuItems.length) {
    entries.push({
      key: 'mcu',
      label: 'MCU',
      displayLabel: '✨ MCU',
      sagaPrefix: 'MCU',
      sagaOrdered: true,
      showOrderIndex: true,
      items: mcuItems,
    });
  }

  state.collections.forEach((collection) => {
    const items = getCollectionItems(collection);
    if (!items.length) return;

    const key = String(collection.id || normalizeCollection(collection.label) || '').trim();
    if (!key) return;

    entries.push({
      key,
      label: String(collection.label || '').trim() || key,
      displayLabel: [collection.icon, collection.label].filter(Boolean).join(' '),
      sagaPrefix: String(collection.badgePrefix || '').trim() || getNameInitials(collection.label),
      sagaOrdered: Boolean(collection.ordered),
      showOrderIndex: false,
      items,
    });
  });

  return entries;
}

function getCollectionPosterUrls(items, max = 7) {
  const urls = [];

  items.forEach(({ item }) => {
    const poster = String(item?.poster || '').trim();
    const backdrop = String(item?.backdrop || '').trim();
    if (poster && !urls.includes(poster)) urls.push(poster);
    if (backdrop && !urls.includes(backdrop)) urls.push(backdrop);
  });

  return urls.slice(0, Math.max(1, Number(max) || 7));
}

function setCollectionsCount(value) {
  const count = document.getElementById('collections-count');
  if (!count) return;
  count.textContent = String(Math.max(0, Number(value) || 0));
}

function setGenresCount(value) {
  const count = document.getElementById('genres-count');
  if (!count) return;
  count.textContent = String(Math.max(0, Number(value) || 0));
}

function openCollectionDetail(collectionKey) {
  state.activeCollectionKey = String(collectionKey || '').trim();
  renderCollectionRows();
  updateSearchPlaceholder();
  applyCurrentFilters();
}

function closeCollectionDetail() {
  state.activeCollectionKey = '';
  renderCollectionRows();
  updateSearchPlaceholder();
  applyCurrentFilters();
}

function openGenreDetail(genreKey) {
  state.activeGenreKey = String(genreKey || '').trim();
  renderGenreRows();
  updateSearchPlaceholder();
  applyCurrentFilters();
}

function closeGenreDetail() {
  state.activeGenreKey = '';
  renderGenreRows();
  updateSearchPlaceholder();
  applyCurrentFilters();
}

function buildShowcaseCard(entry, dataAttr, dataLabel, onClick, usedImages) {
  const card = document.createElement('button');
  card.className = 'collection-showcase-card';
  card.type = 'button';
  card.dataset[dataAttr] = entry.key;
  card.dataset[dataLabel] = entry.displayLabel;

  // Pick a unique backdrop that hasn't been used by another card yet
  let backdropUrl = '';
  for (const { item } of entry.items) {
    const bd = String(item?.backdrop || '').trim();
    if (bd && !usedImages.has(bd)) { backdropUrl = bd; break; }
  }
  if (!backdropUrl) {
    for (const { item } of entry.items) {
      const p = String(item?.poster || '').trim();
      if (p && !usedImages.has(p)) { backdropUrl = p; break; }
    }
  }
  if (backdropUrl) usedImages.add(backdropUrl);

  // Poster strip: pick unique posters not already used as backdrop by other cards
  const posterUrls = [];
  for (const { item } of entry.items) {
    const p = String(item?.poster || '').trim();
    if (p && !posterUrls.includes(p) && p !== backdropUrl) posterUrls.push(p);
    if (posterUrls.length >= 4) break;
  }

  if (backdropUrl) {
    const bgImg = document.createElement('img');
    bgImg.className = 'showcase-bg';
    bgImg.src = backdropUrl;
    bgImg.loading = 'lazy';
    bgImg.alt = '';
    card.appendChild(bgImg);
  } else {
    const bgFallback = document.createElement('div');
    bgFallback.className = 'showcase-bg-fallback';
    bgFallback.textContent = getNameInitials(entry.label);
    card.appendChild(bgFallback);
  }

  const strip = document.createElement('div');
  strip.className = 'showcase-poster-strip';
  posterUrls.slice(0, 4).forEach((url) => {
    const img = document.createElement('img');
    img.src = url;
    img.loading = 'lazy';
    img.alt = '';
    strip.appendChild(img);
  });
  if (posterUrls.length > 1) card.appendChild(strip);

  const content = document.createElement('div');
  content.className = 'showcase-content';

  const title = document.createElement('h3');
  title.className = 'showcase-title';
  title.textContent = entry.displayLabel;

  const countEl = document.createElement('p');
  countEl.className = 'showcase-count';
  countEl.innerHTML = `<span class="showcase-dot"></span>${entry.items.length} titre${entry.items.length > 1 ? 's' : ''}`;

  content.appendChild(title);
  content.appendChild(countEl);
  card.appendChild(content);

  card.addEventListener('click', onClick);
  return card;
}

function renderCollectionsShowcase(container, entries) {
  const showcaseGrid = document.createElement('div');
  showcaseGrid.className = 'collections-showcase-grid';
  const usedImages = new Set();

  entries.forEach((entry) => {
    const card = buildShowcaseCard(entry, 'collectionKey', 'collectionLabel', () => openCollectionDetail(entry.key), usedImages);
    showcaseGrid.appendChild(card);
  });

  container.appendChild(showcaseGrid);
  setCollectionsCount(entries.length);
}

function renderCollectionDetail(container, entry) {
  const detail = document.createElement('section');
  detail.className = 'collections-detail';

  const head = document.createElement('div');
  head.className = 'collections-detail-head';

  const backBtn = document.createElement('button');
  backBtn.className = 'collections-back-btn';
  backBtn.type = 'button';
  backBtn.textContent = '← Toutes les collections';
  backBtn.addEventListener('click', closeCollectionDetail);

  const main = document.createElement('div');
  main.className = 'collections-detail-main';

  const title = document.createElement('h3');
  title.className = 'collections-detail-title';
  title.textContent = entry.displayLabel;

  const subtitle = document.createElement('p');
  subtitle.className = 'collections-detail-subtitle';
  subtitle.id = 'collections-detail-subtitle';
  subtitle.textContent = `${entry.items.length} titre${entry.items.length > 1 ? 's' : ''}`;

  main.appendChild(title);
  main.appendChild(subtitle);
  head.appendChild(backBtn);
  head.appendChild(main);
  detail.appendChild(head);

  const detailGrid = document.createElement('div');
  detailGrid.className = 'grid collections-detail-grid';

  entry.items.forEach(({ item, isTV, index, orderIndex }, position) => {
    const cardOptions = {
      sagaBadge: entry.sagaOrdered ? `${entry.sagaPrefix} #${position + 1}` : '',
      seasonLabel: isTV && Number.isFinite(Number(item?.season)) ? `Saison ${Number(item.season)}` : '',
    };
    const card = createCard(item, isTV, index, cardOptions);

    if (entry.showOrderIndex && orderIndex != null) {
      const rank = document.createElement('span');
      rank.className = 'mcu-order-rank';
      rank.textContent = `#${orderIndex}`;
      card.appendChild(rank);
    }

    detailGrid.appendChild(card);
  });

  detail.appendChild(detailGrid);
  container.appendChild(detail);
  setCollectionsCount(entry.items.length);
}

function renderRow(containerEl, title, items, options = {}) {
  const { showIndex = false, viewAllTarget = null, sagaPrefix = '', sagaOrdered = false } = options;
  if (!items || !items.length) return;

  const row = document.createElement('div');
  row.className = 'content-row';

  const header = document.createElement('div');
  header.className = 'row-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'row-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  if (viewAllTarget) {
    const seeAllBtn = document.createElement('button');
    seeAllBtn.className = 'row-see-all';
    seeAllBtn.type = 'button';
    seeAllBtn.textContent = 'Voir tout';
    seeAllBtn.addEventListener('click', () => navigateTo(viewAllTarget));
    header.appendChild(seeAllBtn);
  }

  const track = document.createElement('div');
  track.className = 'row-track';

  items.forEach(({ item, isTV, index, orderIndex, cardOptions }, i) => {
    const sagaBadge = sagaOrdered
      ? `${sagaPrefix || getNameInitials(title)} #${i + 1}`
      : '';
    const card = createCard(item, isTV, index ?? i, {
      ...(cardOptions || {}),
      sagaBadge,
    });
    if (showIndex && orderIndex != null) {
      const rank = document.createElement('span');
      rank.className = 'mcu-order-rank';
      rank.textContent = `#${orderIndex}`;
      card.appendChild(rank);
    }
    track.appendChild(card);
  });

  row.appendChild(header);
  row.appendChild(track);
  containerEl.appendChild(row);
}

function renderHomeRows() {
  const container = document.getElementById('home-rows');
  if (!container) return;
  container.innerHTML = '';

  renderHomeHero();

  // Continue watching row (only if there are unfinished items)
  const continueItems = getContinueWatchingItems(16);
  if (continueItems.length) {
    renderRow(container, '▶ Reprendre la lecture', continueItems);
  }

  // Recently added
  const recentItems = getRecentlyAdded(20);
  if (recentItems.length) {
    renderRow(container, '🆕 Dernières nouveautés de BoomBoomMovie', recentItems);
  }

  // Series row
  if (state.series.length) {
    const seriesItems = state.series.map((item, i) => ({ item, isTV: true, index: i }));
    renderRow(container, '📺 Séries', seriesItems, { viewAllTarget: 'view-series' });
  }

  // MCU row
  const mcuItems = getMcuOrderRenderableItems().slice(0, 20);
  if (mcuItems.length) {
    renderRow(container, '✨ MCU', mcuItems, { showIndex: true, viewAllTarget: 'view-mcu' });
  }

  // Collections showcase (same cinematic tiles as the Collections view)
  const collEntries = getCollectionDisplayEntries();
  if (collEntries.length) {
    const section = document.createElement('div');
    section.className = 'content-row home-collections-row';

    const header = document.createElement('div');
    header.className = 'row-header';

    const titleEl = document.createElement('h3');
    titleEl.className = 'row-title';
    titleEl.textContent = '🎬 Collections';
    header.appendChild(titleEl);

    const seeAllBtn = document.createElement('button');
    seeAllBtn.className = 'row-see-all';
    seeAllBtn.type = 'button';
    seeAllBtn.textContent = 'Voir tout';
    seeAllBtn.addEventListener('click', () => navigateTo('view-collections'));
    header.appendChild(seeAllBtn);

    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'collections-showcase-grid';
    const usedImages = new Set();

    collEntries.forEach((entry) => {
      const card = buildShowcaseCard(
        entry, 'collectionKey', 'collectionLabel',
        () => { navigateTo('view-collections'); openCollectionDetail(entry.key); },
        usedImages
      );
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  }
}

function renderCollectionRows() {
  const container = document.getElementById('collections-rows');
  if (!container) return;
  container.innerHTML = '';

  const entries = getCollectionDisplayEntries();
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'collections-empty';
    empty.textContent = 'Aucune collection disponible pour le moment.';
    container.appendChild(empty);
    setCollectionsCount(0);
    return;
  }

  const activeEntry = entries.find((entry) => entry.key === state.activeCollectionKey) || null;
  if (activeEntry) {
    renderCollectionDetail(container, activeEntry);
    return;
  }

  state.activeCollectionKey = '';
  renderCollectionsShowcase(container, entries);
}

function getGenreItems() {
  const map = new Map();

  state.movies.forEach((item, index) => {
    const genres = getItemGenres(item);
    genres.forEach((genre) => {
      if (!map.has(genre)) map.set(genre, []);
      map.get(genre).push({ item, isTV: false, index });
    });
  });

  state.series.forEach((item, index) => {
    const genres = getItemGenres(item);
    genres.forEach((genre) => {
      if (!map.has(genre)) map.set(genre, []);
      map.get(genre).push({ item, isTV: true, index });
    });
  });

  return [...map.entries()]
    .map(([genre, items]) => ({ genre, items }))
    .filter((entry) => Array.isArray(entry.items) && entry.items.length > 0)
    .sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.genre.localeCompare(b.genre, 'fr', { sensitivity: 'base' });
    });
}

function getGenreDisplayEntries() {
  return getGenreItems().map(({ genre, items }) => ({
    key: normalizeCollection(genre),
    label: genre,
    displayLabel: `🎞️ ${genre}`,
    items,
  }));
}

function renderGenresShowcase(container, entries) {
  const showcaseGrid = document.createElement('div');
  showcaseGrid.className = 'collections-showcase-grid';
  const usedImages = new Set();

  entries.forEach((entry) => {
    const card = buildShowcaseCard(entry, 'genreKey', 'genreLabel', () => openGenreDetail(entry.key), usedImages);
    showcaseGrid.appendChild(card);
  });

  container.appendChild(showcaseGrid);
  setGenresCount(entries.length);
}

function renderGenreDetail(container, entry) {
  const detail = document.createElement('section');
  detail.className = 'collections-detail';

  const head = document.createElement('div');
  head.className = 'collections-detail-head';

  const backBtn = document.createElement('button');
  backBtn.className = 'collections-back-btn';
  backBtn.type = 'button';
  backBtn.textContent = '← Tous les genres';
  backBtn.addEventListener('click', closeGenreDetail);

  const main = document.createElement('div');
  main.className = 'collections-detail-main';

  const title = document.createElement('h3');
  title.className = 'collections-detail-title';
  title.textContent = entry.displayLabel;

  const subtitle = document.createElement('p');
  subtitle.className = 'collections-detail-subtitle';
  subtitle.id = 'genres-detail-subtitle';
  subtitle.textContent = `${entry.items.length} titre${entry.items.length > 1 ? 's' : ''}`;

  main.appendChild(title);
  main.appendChild(subtitle);
  head.appendChild(backBtn);
  head.appendChild(main);
  detail.appendChild(head);

  const detailGrid = document.createElement('div');
  detailGrid.className = 'grid genres-detail-grid';

  entry.items.forEach(({ item, isTV, index }) => {
    detailGrid.appendChild(createCard(item, isTV, index));
  });

  detail.appendChild(detailGrid);
  container.appendChild(detail);
  setGenresCount(entry.items.length);
}

function renderGenreRows() {
  const container = document.getElementById('genres-rows');
  if (!container) return;
  container.innerHTML = '';

  const entries = getGenreDisplayEntries();
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'collections-empty';
    empty.textContent = 'Aucun genre disponible pour le moment.';
    container.appendChild(empty);
    setGenresCount(0);
    return;
  }

  const activeEntry = entries.find((entry) => entry.key === state.activeGenreKey) || null;
  if (activeEntry) {
    renderGenreDetail(container, activeEntry);
    return;
  }

  state.activeGenreKey = '';
  renderGenresShowcase(container, entries);
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
  const moviesSorted = _getSortedItems(state.movies, 'movies');
  const seriesSorted = _getSortedItems(state.series, 'series');
  renderGrid(moviesSorted, 'movies-grid', 'movies-count', false);
  renderGrid(seriesSorted, 'series-grid', 'series-count', true);
  renderHomeRows();
  renderCollectionRows();
  renderGenreRows();
  refreshProgressDecorations();
}

function _getSortedItems(items, section) {
  const sort = state.sortConfig[section] || 'default';
  if (sort === 'date-desc' || sort === 'default') return items;
  if (sort === 'date-asc') {
    return [...items].sort((a, b) => {
      const ya = Number(a?.year) || 0;
      const yb = Number(b?.year) || 0;
      if (ya !== yb) return ya - yb;
      return String(a?.title || '').localeCompare(String(b?.title || ''), 'fr', { sensitivity: 'base' });
    });
  }
  if (sort === 'rating-desc') {
    const isTV = section === 'series';
    return [...items].sort((a, b) => {
      const ra = getUserRating(getRatingKey(a, isTV ? 'tv' : 'movie'));
      const rb = getUserRating(getRatingKey(b, isTV ? 'tv' : 'movie'));
      if (rb !== ra) return rb - ra;
      return String(a?.title || '').localeCompare(String(b?.title || ''), 'fr', { sensitivity: 'base' });
    });
  }
  return items;
}

function navigateTo(target) {
  const navLinks = document.querySelectorAll('.nav-link[data-view]');
  const views    = document.querySelectorAll('.view');

  navLinks.forEach((l) => {
    const isActive = l.dataset.view === target;
    l.classList.toggle('active', isActive);
    l.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  views.forEach((v) => v.classList.toggle('active', v.id === target));
  updateSearchPlaceholder();
  refreshFiltersForActiveSection();
  applyCurrentFilters();

  if (target === 'view-stats')    renderStatsView();
  if (target === 'view-requests') renderRequestsView();
}

function setupNav() {
  const navLinks = document.querySelectorAll('.nav-link[data-view]');

  navLinks.forEach((link) => {
    link.addEventListener('click', () => navigateTo(link.dataset.view));
  });
}

function setupSearch() {
  const input = document.getElementById('search');

  input.addEventListener('input', () => {
    applyCurrentFilters();
  });
}

const changelogState = {
  data: null,
};

function parseVersionParts(versionValue) {
  return String(versionValue || '')
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number(part))
    .map((part) => (Number.isFinite(part) && part >= 0 ? part : 0));
}

function compareVersionParts(aParts, bParts) {
  const maxLen = Math.max(aParts.length, bParts.length, 3);
  for (let i = 0; i < maxLen; i += 1) {
    const a = Number(aParts[i] || 0);
    const b = Number(bParts[i] || 0);
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function findLatestChangelogRelease(releases) {
  if (!Array.isArray(releases) || !releases.length) return null;

  let latest = null;
  releases.forEach((release) => {
    if (!release || typeof release !== 'object') return;
    if (!latest) {
      latest = release;
      return;
    }

    const releaseParts = parseVersionParts(release.version);
    const latestParts = parseVersionParts(latest.version);
    if (compareVersionParts(releaseParts, latestParts) > 0) {
      latest = release;
    }
  });

  return latest;
}

function updateVersionBadgeFromChangelog() {
  const badge = document.getElementById('open-roadmap');
  if (!badge) return;

  const releases = Array.isArray(changelogState.data) ? changelogState.data : [];
  const latestRelease = findLatestChangelogRelease(releases);
  if (!latestRelease) return;

  const rawVersion = String(latestRelease.version || '').trim().replace(/^v/i, '');
  if (!rawVersion) return;

  const badgeVersion = `v${rawVersion}`;
  const label = String(latestRelease.label || '').trim();

  badge.textContent = badgeVersion;
  badge.setAttribute('title', label ? `Voir le changelog (${badgeVersion} - ${label})` : `Voir le changelog (${badgeVersion})`);
  badge.setAttribute('aria-label', label ? `Voir le changelog ${badgeVersion} ${label}` : `Voir le changelog ${badgeVersion}`);
}

function openRoadmapModal() {
  const modal = document.getElementById('roadmap-modal');
  if (!modal) return;
  renderChangelogContent();
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeRoadmapModal() {
  const modal = document.getElementById('roadmap-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function renderChangelogContent() {
  const content = document.getElementById('roadmap-modal-content');
  if (!content || !changelogState.data) return;

  const releases = Array.isArray(changelogState.data) ? changelogState.data : [];
  content.innerHTML = releases.map((release) => `
    <div class="roadmap-release">
      <div class="roadmap-release-head">
        <span class="roadmap-version-pill roadmap-version-released">${escapeHtml(release.version)}</span>
        <h3 class="roadmap-release-title">${escapeHtml(release.label)}</h3>
        <span class="roadmap-release-date">${escapeHtml(release.date || '')}</span>
      </div>
      <ul class="roadmap-changes-list">
        ${(Array.isArray(release.changes) ? release.changes : []).map((change) =>
          `<li>
            <span class="roadmap-change-type roadmap-change-${escapeHtml(change.type)}">${
              change.type === 'feature' ? 'Nouveaute' :
              change.type === 'fix' ? 'Correctif' :
              change.type === 'improvement' ? 'Amelioration' :
              escapeHtml(change.type)
            }</span>
            ${escapeHtml(change.description)}
          </li>`
        ).join('')}
      </ul>
    </div>
  `).join('');
}

function setupRoadmapModal() {
  const openBtn = document.getElementById('open-roadmap');
  const closeBtn = document.getElementById('roadmap-modal-close');
  const modal = document.getElementById('roadmap-modal');
  if (!modal) return;

  openBtn?.addEventListener('click', openRoadmapModal);
  closeBtn?.addEventListener('click', closeRoadmapModal);
  modal.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.hasAttribute('data-close-roadmap')) {
      closeRoadmapModal();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeRoadmapModal();
  });
}

// ── R2 Catalog helpers ─────────────────────────────────────────────────────

function filenameFromUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) {
    try {
      const parts = new URL(url).pathname.split('/');
      return decodeURIComponent(parts[parts.length - 1] || '');
    } catch {
      return '';
    }
  }
  // bare filename
  return String(url).split('/').pop() || '';
}

function normalizeForFuzzyMatch(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenOverlap(normalizedA, normalizedB) {
  const setA = new Set(normalizedA.split(' ').filter((t) => t.length > 2));
  let count = 0;
  normalizedB.split(' ').forEach((t) => { if (t.length > 2 && setA.has(t)) count += 1; });
  return count;
}

async function fetchR2Catalog() {
  if (!CONFIG.R2_CATALOG_API) return null;
  try {
    console.log(`[BoomBoom] Fetching R2 catalog from: ${CONFIG.R2_CATALOG_API}`);
    const fetchStart = performance.now();
    
    const res = await fetch(CONFIG.R2_CATALOG_API);
    const fetchDuration = performance.now() - fetchStart;
    console.log(`[BoomBoom] Network fetch took: ${fetchDuration.toFixed(0)}ms`);
    
    if (!res.ok) return null;
    
    const jsonStart = performance.now();
    const data = await res.json();
    const jsonDuration = performance.now() - jsonStart;
    console.log(`[BoomBoom] JSON parsing took: ${jsonDuration.toFixed(0)}ms (${data.length} entries)`);
    
    if (!Array.isArray(data)) return null;
    const byFilename = new Map();
    const entries = [];
    
    const parseStart = performance.now();
    data.forEach((entry) => {
      const filename = String(entry?.title || '').trim();
      const url = String(entry?.url || '').trim();
      const key = String(entry?.key || '').trim();
      const normalizedKey = key.toLowerCase();
      const category = String(entry?.category || '').toLowerCase();
      const parsedTmdb = Number(entry?.tmdbID ?? entry?.tmdbId ?? 0);
      const tmdbId = Number.isFinite(parsedTmdb) && parsedTmdb > 0 ? parsedTmdb : 0;
      const parsedSeason = Number(entry?.seasonNumber ?? 0);
      const seasonNumber = Number.isFinite(parsedSeason) && parsedSeason > 0 ? parsedSeason : 0;
      const parsedEpisode = Number(entry?.episodeNumber ?? 0);
      const episodeNumber = Number.isFinite(parsedEpisode) && parsedEpisode > 0 ? parsedEpisode : 0;
      const seriesTitle = String(entry?.seriesTitle || '').trim();
      const createdAt = String(entry?.createdAt || '').trim();
      if (filename && url) byFilename.set(filename.toLowerCase(), url);
      if (url) {
        entries.push({
          filename: filename.toLowerCase(),
          key,
          keyLower: normalizedKey,
          category,
          tmdbId,
          seasonNumber,
          episodeNumber,
          seriesTitle,
          createdAt,
          url,
        });
      }
    });
    const parseDuration = performance.now() - parseStart;
    console.log(`[BoomBoom] Entry parsing took: ${parseDuration.toFixed(0)}ms (${entries.length} processed)`);
    
    return { byFilename, entries };
  } catch (err) {
    console.error('[BoomBoom] fetchR2Catalog error:', err);
    return null;
  }
}

function resolveMovieUrlFromCatalog(movie, catalog) {
  if (!catalog?.byFilename || !Array.isArray(catalog?.entries)) return null;

  // 0. Strict match by tmdbId from catalog metadata.
  const movieTmdbId = getTmdbNumericId(movie);
  if (movieTmdbId) {
    const strictEntry = catalog.entries.find((entry) => entry.category === 'movie' && entry.tmdbId === movieTmdbId);
    if (strictEntry?.url) return strictEntry.url;
  }

  // 1. Exact filename match from stored URL
  if (movie.url) {
    const filename = filenameFromUrl(movie.url);
    if (filename) {
      const found = catalog.byFilename.get(filename.toLowerCase());
      if (found) return found;
    }
  }

  // 2. Fuzzy title+year match (helps when url is empty)
  const title = String(movie.title || '').trim();
  if (!title) return null;

  const normalizedTitle = normalizeForFuzzyMatch(title);
  const titleTokens = normalizedTitle.split(' ').filter((t) => t.length > 2);
  if (!titleTokens.length) return null;

  const year = String(movie.year || '').trim();
  let bestUrl = null;
  let bestScore = -1;

  catalog.entries.forEach((entry) => {
    const apiUrl = entry.url;
    const filename = entry.filename;
    // Only match against movie files (not series episode files)
    if (entry.keyLower && !entry.keyLower.startsWith('movies/')) return;
    const filenameNoYearExt = filename.replace(/\.mp4$/i, '').replace(/ - \d{4}$/, '').trim();
    const normalizedFilename = normalizeForFuzzyMatch(filenameNoYearExt);
    const overlap = tokenOverlap(normalizedTitle, normalizedFilename);
    const threshold = Math.max(1, Math.ceil(titleTokens.length * 0.5));
    if (overlap < threshold) return;
    let score = overlap;
    if (year && filename.includes(year)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      bestUrl = apiUrl;
    }
  });

  return bestUrl;
}

function resolveEpisodeUrlFromCatalog(seriesItem, seasonNum, epNum, catalog) {
  if (!catalog?.byFilename || !Array.isArray(catalog?.entries)) return null;

  const seriesTitle = String(seriesItem?.title || '').trim();
  const normalizedTitle = normalizeForFuzzyMatch(seriesTitle);

  const tmdbId = getTmdbNumericId(seriesItem);
  const seasonCode = String(seasonNum).padStart(2, '0');
  const epCode = String(epNum).padStart(2, '0');

  // 0. Strict match from worker metadata.
  if (tmdbId) {
    const strictMeta = catalog.entries.find((entry) =>
      entry.category === 'series'
      && entry.tmdbId === tmdbId
      && entry.seasonNumber === Number(seasonNum)
      && entry.episodeNumber === Number(epNum)
    );
    if (strictMeta?.url) return strictMeta.url;
  }

  // New normalized structure: SERIES/<Name - tmdbId>/Sxx/Exx.mp4
  if (tmdbId) {
    const tmdbMarker = `- ${tmdbId}/`;
    const epMarker = `/s${seasonCode}/e${epCode}.mp4`;
    const strict = catalog.entries.find((entry) => entry.keyLower.includes(tmdbMarker) && entry.keyLower.endsWith(epMarker));
    if (strict?.url) return strict.url;
  }

  // Fuzzy fallback — useful for mixed naming styles or incomplete metadata.
  const epSuffix1 = `${seasonNum}-${epNum}`;
  const epSuffix2 = `s${seasonNum}e${String(epNum).padStart(2, '0')}`;
  const epSuffix3 = `s${String(seasonNum).padStart(2, '0')}e${String(epNum).padStart(2, '0')}`;
  const titleTokens = normalizedTitle.split(' ').filter((t) => t.length > 2);
  const threshold = Math.max(1, Math.ceil(titleTokens.length * 0.5));

  let bestUrl = null;
  let bestScore = -1;

  catalog.entries.forEach((entry) => {
    const filename = entry.filename;
    const url = entry.url;
    const normalizedFilename = normalizeForFuzzyMatch(filename.replace(/\.mp4$/i, ''));
    const hasEpSuffix =
      normalizedFilename.endsWith(epSuffix1) ||
      normalizedFilename.includes(epSuffix2) ||
      normalizedFilename.includes(epSuffix3);
    if (!hasEpSuffix) return;

    const overlap = tokenOverlap(normalizedTitle, normalizedFilename);
    if (overlap < threshold) return;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestUrl = url;
    }
  });

  return bestUrl;
}

function hydrateUrlsFromR2Catalog(movies, series, catalog) {
  if (!catalog?.byFilename || !Array.isArray(catalog?.entries)) return;

  movies.forEach((movie) => {
    const resolved = resolveMovieUrlFromCatalog(movie, catalog);
    if (resolved) movie.url = resolved;
  });

  series.forEach((show) => {
    const seriesTitle = String(show.title || '').trim();
    const seasons = Array.isArray(show.seasons) ? show.seasons : [];
    seasons.forEach((season) => {
      const seasonNum = Number(season.season) || 1;
      const episodes = Array.isArray(season.episodes) ? season.episodes : [];
      episodes.forEach((ep, i) => {
        const epNum = i + 1;
        // If a url hint is stored (old format), try exact filename match first
        if (ep.url) {
          const filename = filenameFromUrl(ep.url);
          if (filename) {
            const apiUrl = catalog.byFilename.get(filename.toLowerCase());
            if (apiUrl) { ep.url = apiUrl; return; }
          }
        }
        // Fuzzy resolution by series title + season + episode
        {
          const resolved = resolveEpisodeUrlFromCatalog(show, seasonNum, epNum, catalog);
          if (resolved) ep.url = resolved;
        }
      });
    });
  });
}

function prettifySeriesTitle(title) {
  const value = String(title || '').trim();
  if (!value) return '';
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLibraryFromR2Catalog(catalog) {
  const movies = [];
  const moviesSeen = new Set();
  const seriesGroupMap = new Map();

  const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
  entries.forEach((entry) => {
    if (!entry?.url) return;

    if (entry.category === 'movie') {
      const tmdbId = Number(entry.tmdbId) || 0;
      const dedupeKey = tmdbId > 0 ? `tmdb:${tmdbId}` : `key:${entry.keyLower || entry.filename}`;
      if (moviesSeen.has(dedupeKey)) return;
      moviesSeen.add(dedupeKey);

      const movie = {
        title: String(entry.filename || '').replace(/\.mp4$/i, '').trim() || 'Film',
        url: entry.url,
      };
      if (tmdbId > 0) movie.tmdbId = tmdbId;
      if (entry.createdAt) movie.createdAt = entry.createdAt;
      movies.push(movie);
      return;
    }

    if (entry.category !== 'series') return;

    const tmdbId = Number(entry.tmdbId) || 0;
    const seasonNumber = Number(entry.seasonNumber) || 0;
    const episodeNumber = Number(entry.episodeNumber) || 0;
    if (seasonNumber <= 0 || episodeNumber <= 0) return;

    const rawSeriesTitle = String(entry.seriesTitle || '').trim();
    const seriesTitle = prettifySeriesTitle(rawSeriesTitle) || 'Serie';
    const groupKey = `${tmdbId}:${seriesTitle.toLowerCase()}`;

    if (!seriesGroupMap.has(groupKey)) {
      const show = { title: seriesTitle, seasons: [] };
      if (tmdbId > 0) show.tmdbId = tmdbId;
      seriesGroupMap.set(groupKey, { show, seasons: new Map() });
    }

    const group = seriesGroupMap.get(groupKey);
    if (!group.seasons.has(seasonNumber)) {
      group.seasons.set(seasonNumber, { season: seasonNumber, episodes: [] });
    }

    // Track the most recent createdAt for this series
    if (entry.createdAt) {
      const entryDate = new Date(entry.createdAt).getTime();
      const currentDate = group.show.createdAt ? new Date(group.show.createdAt).getTime() : 0;
      if (entryDate > currentDate) group.show.createdAt = entry.createdAt;
    }

    const season = group.seasons.get(seasonNumber);
    while (season.episodes.length < episodeNumber) season.episodes.push({});
    season.episodes[episodeNumber - 1] = {
      ...(season.episodes[episodeNumber - 1] || {}),
      url: entry.url,
    };
  });

  const series = Array.from(seriesGroupMap.values()).map(({ show, seasons }) => ({
    ...show,
    seasons: Array.from(seasons.values()).sort((a, b) => Number(a.season) - Number(b.season)),
  }));

  return { movies, series };
}

// ──────────────────────────────────────────────────────────────────────────

async function init() {
  const initStartTime = performance.now();
  console.log('%c🚀 BoomBoomMovie init() started', 'color: #00ff00; font-weight: bold');

  // Initialiser Firebase dès le début
  if (typeof window.FB !== 'undefined' && typeof firebaseConfig !== 'undefined') {
    window.FB.init(firebaseConfig);
    window.FB.onAuthChange((user) => {
      if (user) {
        onUserLogin(user);
      } else {
        onUserLogout();
      }
    });
  }

  await Promise.all([
    loadTmdbConfigFile(),
    loadCollections(),
  ]);

  loadWatchProgressStore();
  loadRatingsStore();

  setupNav();
  setupSearch();
  setupFilters();
  setupDisplayMode();
  setupVideoModal();
  setupDetailsModal();
  setupSeriesModal();
  setupRoadmapModal();
  setupAuthModal();
  setupProfileDropdown();
  setupTmdbSearchModal();
  updateSearchPlaceholder();

  try {
    console.time('[BoomBoom] R2 Catalog fetch');
    const r2Catalog = await fetchR2Catalog();
    console.timeEnd('[BoomBoom] R2 Catalog fetch');
    
    if (!r2Catalog?.entries?.length) {
      throw new Error('Impossible de charger le catalogue R2 depuis le Worker.');
    }

    console.log(`%c✓ R2 Catalog loaded: ${r2Catalog.entries.length} entries`, 'color: #00ff00');

    console.time('[BoomBoom] Build library from catalog');
    const built = buildLibraryFromR2Catalog(r2Catalog);
    console.timeEnd('[BoomBoom] Build library from catalog');
    
    const rawMovies = Array.isArray(built.movies) ? built.movies : [];
    const rawSeries = Array.isArray(built.series) ? built.series : [];
    console.log(`%c✓ Library built: ${rawMovies.length} movies, ${rawSeries.length} series`, 'color: #00ff00');

    // Parallelize TMDB metadata hydration for faster startup
    console.time('[BoomBoom] TMDB metadata hydration');
    const [tmdbMoviesMetadataUpdated, tmdbSeriesMetadataUpdated] = await Promise.all([
      hydrateMovieMetadataFromTmdb(rawMovies),
      hydrateSeriesMetadataFromTmdb(rawSeries),
    ]);
    console.timeEnd('[BoomBoom] TMDB metadata hydration');
    console.log(`%c✓ TMDB metadata: ${tmdbMoviesMetadataUpdated} movies, ${tmdbSeriesMetadataUpdated} series updated`, 'color: #00ff00');

    // Keep URL hydration as safety fallback for any partially-built items.
    console.time('[BoomBoom] URL hydration fallback');
    hydrateUrlsFromR2Catalog(rawMovies, rawSeries, r2Catalog);
    console.timeEnd('[BoomBoom] URL hydration fallback');

    state.movies = sortByReleaseDate(rawMovies);
    state.series = sortByReleaseDate(rawSeries);

    const linkStats = annotateLibraryLinks();

    try {
      const clRes = await fetch('changelogs.json');
      if (clRes.ok) {
        changelogState.data = await clRes.json();
        updateVersionBadgeFromChangelog();
      }
    } catch {
      changelogState.data = null;
    }

    const preRenderTime = performance.now();
    console.log(`%c⏱️  Time before render: ${(preRenderTime - initStartTime).toFixed(0)}ms`, 'color: #ffff00');

    // Render library immediately, don't wait for TMDB posters
    console.time('[BoomBoom] Render library');
    renderLibrary();
    console.timeEnd('[BoomBoom] Render library');
    
    refreshFiltersForActiveSection();
    applyCurrentFilters();

    if (
      hasTmdbCredentials()
      && tmdbMoviesMetadataUpdated === 0
      && tmdbSeriesMetadataUpdated === 0
    ) {
      showNotice('TMDB est configure, mais aucune metadonnee n\'a ete recuperee. Verifie ta cle et les tmdbId dans le Worker.', 'warning');
    }

    // Load TMDB posters in background (non-blocking)
    console.time('[BoomBoom] Background poster loading');
    Promise.all([
      hydrateMoviePostersFromTmdb(state.movies),
      hydrateSeriesPostersFromTmdb(state.series),
    ]).then(([tmdbMoviePostersUpdated, tmdbSeriesPostersUpdated]) => {
      console.timeEnd('[BoomBoom] Background poster loading');
      console.log(`%c✓ TMDB posters: ${tmdbMoviePostersUpdated} movies, ${tmdbSeriesPostersUpdated} series loaded`, 'color: #00ff00');
      if (tmdbMoviePostersUpdated > 0 || tmdbSeriesPostersUpdated > 0) {
        renderLibrary(); // Refresh to show loaded posters
      }
    }).catch(() => {
      // Ignore TMDB poster errors - UI already rendered
    });

    if (linkStats.expired > 0) {
      showNotice(
        `${linkStats.expired} lien(s) video expire(s) dans le catalogue Worker.`,
        'error'
      );
    } else if (linkStats.expiringSoon > 0) {
      showNotice(
        `${linkStats.expiringSoon} lien(s) video vont expirer bientot dans le catalogue Worker.`,
        'warning'
      );
    }

    const totalTime = performance.now() - initStartTime;
    console.log(`%c✅ BoomBoomMovie init() complete in ${totalTime.toFixed(0)}ms`, 'color: #00ff00; font-weight: bold; font-size: 14px');
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

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE AUTH UI
// ═══════════════════════════════════════════════════════════════════════════

const AUTH_ERROR_MESSAGES = {
  'auth/email-already-in-use':    'Cet e-mail est déjà associé à un compte.',
  'auth/wrong-password':          'Mot de passe incorrect.',
  'auth/user-not-found':          'Aucun compte trouvé avec cet e-mail.',
  'auth/invalid-email':           'Adresse e-mail invalide.',
  'auth/weak-password':           'Le mot de passe doit contenir au moins 6 caractères.',
  'auth/too-many-requests':       'Trop de tentatives. Réessaie plus tard.',
  'auth/requires-recent-login':   'Reconnecte-toi avant de supprimer ton compte.',
  'auth/invalid-credential':      'E-mail ou mot de passe incorrect.',
};

function _fbErrorMessage(err) {
  return AUTH_ERROR_MESSAGES[err?.code] || String(err?.message || 'Une erreur est survenue.');
}

function openAuthModal(mode) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  _renderAuthForm(mode || 'login');
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const input = document.getElementById('auth-email-input');
  setTimeout(() => input?.focus(), 60);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function _renderAuthForm(mode) {
  const titleEl  = document.getElementById('auth-modal-title');
  const contentEl = document.getElementById('auth-modal-content');
  if (!titleEl || !contentEl) return;

  const isLogin = mode !== 'register';
  titleEl.textContent = isLogin ? 'Connexion' : 'Créer un compte';

  contentEl.innerHTML = `
    <form id="auth-form" class="auth-form" novalidate>
      <label class="auth-label" for="auth-email-input">E-mail</label>
      <input class="auth-input" id="auth-email-input" type="email" autocomplete="email"
        placeholder="ton@email.com" required />

      <label class="auth-label" for="auth-password-input">Mot de passe</label>
      <input class="auth-input" id="auth-password-input" type="password"
        autocomplete="${isLogin ? 'current-password' : 'new-password'}"
        placeholder="${isLogin ? '••••••' : 'Min. 6 caractères'}" required />

      <p id="auth-error" class="auth-error" hidden></p>

      <button class="auth-submit-btn" type="submit">
        ${isLogin ? 'Se connecter' : "S'inscrire"}
      </button>
    </form>
    <p class="auth-switch">
      ${isLogin
        ? 'Pas encore de compte ? <button class="auth-link" id="auth-switch-btn" type="button">Créer un compte</button>'
        : 'Déjà un compte ? <button class="auth-link" id="auth-switch-btn" type="button">Se connecter</button>'}
    </p>
  `;

  const form      = document.getElementById('auth-form');
  const switchBtn = document.getElementById('auth-switch-btn');
  const errorEl   = document.getElementById('auth-error');

  switchBtn?.addEventListener('click', () => _renderAuthForm(isLogin ? 'register' : 'login'));

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('auth-email-input')?.value?.trim() || '';
    const password = document.getElementById('auth-password-input')?.value || '';
    const btn = form.querySelector('.auth-submit-btn');

    if (!email || !password) return;

    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = '…';

    try {
      if (isLogin) {
        await window.FB.signIn(email, password);
      } else {
        await window.FB.signUp(email, password);
      }
      closeAuthModal();
    } catch (err) {
      errorEl.textContent = _fbErrorMessage(err);
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = isLogin ? 'Se connecter' : "S'inscrire";
    }
  });
}

function _renderDeleteAccountForm() {
  const titleEl   = document.getElementById('auth-modal-title');
  const contentEl = document.getElementById('auth-modal-content');
  if (!titleEl || !contentEl) return;

  titleEl.textContent = 'Supprimer le compte';
  contentEl.innerHTML = `
    <p class="auth-danger-warning">
      ⚠️ Cette action est <strong>irréversible</strong>. Toutes tes données
      (progression, notes, bibliothèque) seront supprimées définitivement.
    </p>
    <form id="delete-form" class="auth-form" novalidate>
      <label class="auth-label" for="delete-password-input">Confirme ton mot de passe</label>
      <input class="auth-input" id="delete-password-input" type="password"
        placeholder="••••••" required autocomplete="current-password" />
      <p id="delete-error" class="auth-error" hidden></p>
      <button class="auth-submit-btn auth-submit-danger" type="submit">Supprimer définitivement</button>
    </form>
  `;

  document.getElementById('delete-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('delete-password-input')?.value || '';
    const errorEl  = document.getElementById('delete-error');
    const btn      = e.target.querySelector('.auth-submit-btn');

    errorEl.hidden = true;
    btn.disabled   = true;
    btn.textContent = '…';

    try {
      await window.FB.deleteAccount(password);
      closeAuthModal();
    } catch (err) {
      errorEl.textContent = _fbErrorMessage(err);
      errorEl.hidden = false;
      btn.disabled   = false;
      btn.textContent = 'Supprimer définitivement';
    }
  });
}

function setupAuthModal() {
  const openBtn  = document.getElementById('auth-open-btn');
  const closeBtn = document.getElementById('auth-modal-close');
  const modal    = document.getElementById('auth-modal');
  if (!modal) return;

  openBtn?.addEventListener('click', () => openAuthModal('login'));
  closeBtn?.addEventListener('click', closeAuthModal);
  modal.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.hasAttribute('data-close-auth')) closeAuthModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeAuthModal();
  });
}

function _updateHeaderForAuth(user) {
  const openBtn    = document.getElementById('auth-open-btn');
  const profileBtn = document.getElementById('profile-btn');
  const avatarEl   = document.getElementById('profile-avatar');
  const emailEl    = document.getElementById('profile-email');

  if (user) {
    if (openBtn)    openBtn.hidden    = true;
    if (profileBtn) profileBtn.hidden = false;
    if (avatarEl) {
      const email = user.email || '';
      avatarEl.textContent = email.charAt(0).toUpperCase() || '?';
    }
    if (emailEl) emailEl.textContent = user.email || '';
  } else {
    if (openBtn)    openBtn.hidden    = false;
    if (profileBtn) profileBtn.hidden = true;
    _hideProfileDropdown();
  }
}

function _hideProfileDropdown() {
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.hidden = true;
}

function setupProfileDropdown() {
  const profileBtn  = document.getElementById('profile-btn');
  const dropdown    = document.getElementById('profile-dropdown');
  const signoutBtn  = document.getElementById('profile-signout');
  const deleteBtn   = document.getElementById('profile-delete');
  const navStats    = document.getElementById('profile-nav-stats');
  const navRequests = document.getElementById('profile-nav-requests');
  if (!profileBtn || !dropdown) return;

  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = profileBtn.getBoundingClientRect();
    dropdown.style.top  = `${rect.bottom + 8}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
    dropdown.hidden = !dropdown.hidden;
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== profileBtn) {
      _hideProfileDropdown();
    }
  });

  navStats?.addEventListener('click', () => {
    _hideProfileDropdown();
    navigateTo('view-stats');
  });

  navRequests?.addEventListener('click', () => {
    _hideProfileDropdown();
    navigateTo('view-requests');
  });

  signoutBtn?.addEventListener('click', async () => {
    _hideProfileDropdown();
    await window.FB?.signOut?.();
  });

  deleteBtn?.addEventListener('click', () => {
    _hideProfileDropdown();
    openAuthModal('login');
    _renderDeleteAccountForm();
  });
}

async function onUserLogin(user) {
  console.log(`[BoomBoom] Connecté : ${user.email}`);
  _updateHeaderForAuth(user);

  // Migration localStorage → Firestore (première connexion seulement)
  await window.FB.migrateFromLocalStorage(watchProgressStore, ratingsStore);

  // Charger les données Cloud et mettre à jour les stores locaux
  const [cloudProgress, cloudRatings] = await Promise.all([
    window.FB.loadAllProgress(),
    window.FB.loadAllRatings(),
  ]);

  // Fusionner : la version Cloud (plus récente) remplace le local
  Object.entries(cloudProgress).forEach(([key, val]) => {
    const localEntry = watchProgressStore[key];
    const cloudTs = Number(val?.updatedAt) || 0;
    const localTs = Number(localEntry?.updatedAt) || 0;
    if (cloudTs >= localTs) watchProgressStore[key] = val;
  });
  Object.entries(cloudRatings).forEach(([key, val]) => {
    const localEntry = ratingsStore[key];
    const cloudTs = Number(val?.updatedAt) || 0;
    const localTs = Number(localEntry?.updatedAt) || 0;
    if (cloudTs >= localTs) ratingsStore[key] = val;
  });

  saveWatchProgressStore();
  saveRatingsStore();

  // Synchronisation temps réel
  window.FB.setupRealtimeSync(
    (progressStore) => {
      watchProgressStore = { ...watchProgressStore, ...progressStore };
      saveWatchProgressStore();
      refreshProgressDecorations();
      renderLibrary();
    },
    (rStore) => {
      ratingsStore = { ...ratingsStore, ...rStore };
      saveRatingsStore();
      refreshRatingDecorations();
    }
  );

  renderLibrary();
  refreshFiltersForActiveSection();
  applyCurrentFilters();

  // Rafraîchir si on est sur une vue spéciale
  const section = getActiveSection();
  if (section?.id === 'view-stats')    renderStatsView();
  if (section?.id === 'view-requests') renderRequestsView();
}

function onUserLogout() {
  console.log('[BoomBoom] Déconnecté');
  _updateHeaderForAuth(null);
  window.FB?.teardownRealtimeSync?.();

  // Revenir aux données localStorage
  loadWatchProgressStore();
  loadRatingsStore();

  renderLibrary();
  refreshFiltersForActiveSection();
  applyCurrentFilters();

  const section = getActiveSection();
  if (section?.id === 'view-stats')    renderStatsView();
  if (section?.id === 'view-requests') renderRequestsView();
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD STATISTIQUES
// ═══════════════════════════════════════════════════════════════════════════

function _getStatsData() {
  let moviesSeenCount   = 0;
  let seriesStarted     = 0;
  let seriesCompleted   = 0;
  let totalRatings      = 0;
  let ratingsSum        = 0;
  const genreCount      = new Map();

  state.movies.forEach((item) => {
    const status = getMovieWatchStatus(item);
    if (status === 'completed') moviesSeenCount += 1;
    getItemGenres(item).forEach((g) => genreCount.set(g, (genreCount.get(g) || 0) + 1));
  });

  state.series.forEach((item) => {
    const status = getSeriesWatchStatus(item);
    if (status === 'in-progress') seriesStarted  += 1;
    if (status === 'completed')   seriesCompleted += 1;
    getItemGenres(item).forEach((g) => genreCount.set(g, (genreCount.get(g) || 0) + 1));
  });

  Object.values(ratingsStore).forEach((entry) => {
    const r = Number(entry?.rating);
    if (Number.isInteger(r) && r >= 1 && r <= 5) {
      totalRatings += 1;
      ratingsSum   += r;
    }
  });

  const avgRating = totalRatings > 0 ? (ratingsSum / totalRatings).toFixed(1) : '—';

  const topGenres = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return { moviesSeenCount, seriesStarted, seriesCompleted, avgRating, topGenres, totalRatings };
}

function renderStatsView() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const { moviesSeenCount, seriesStarted, seriesCompleted, avgRating, topGenres } = _getStatsData();
  const totalMovies = state.movies.length;
  const totalSeries = state.series.length;
  const maxGenreCount = topGenres.length ? topGenres[0][1] : 1;

  container.innerHTML = `
    <div class="stats-cards">
      <div class="stats-card">
        <span class="stats-card-icon">🎬</span>
        <span class="stats-card-value">${moviesSeenCount}</span>
        <span class="stats-card-label">Films vus</span>
        <span class="stats-card-sub">sur ${totalMovies} films</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-icon">📺</span>
        <span class="stats-card-value">${seriesCompleted}</span>
        <span class="stats-card-label">Séries terminées</span>
        <span class="stats-card-sub">${seriesStarted} en cours · ${totalSeries} total</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-icon">⭐</span>
        <span class="stats-card-value">${avgRating}</span>
        <span class="stats-card-label">Note moyenne</span>
        <span class="stats-card-sub">sur 5 étoiles</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-icon">📊</span>
        <span class="stats-card-value">${totalMovies + totalSeries}</span>
        <span class="stats-card-label">Titres au total</span>
        <span class="stats-card-sub">${totalMovies} films · ${totalSeries} séries</span>
      </div>
    </div>

    ${topGenres.length ? `
    <div class="stats-section">
      <h3 class="stats-section-title">Genres les plus représentés</h3>
      <div class="stats-genre-list">
        ${topGenres.map(([genre, count]) => `
          <div class="stats-genre-row">
            <span class="stats-genre-name">${escapeHtml(genre)}</span>
            <div class="stats-genre-bar-wrap">
              <div class="stats-genre-bar" style="width:${Math.round((count / maxGenreCount) * 100)}%"></div>
            </div>
            <span class="stats-genre-count">${count}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// BIBLIOTHÈQUE PERSONNELLE (Firebase)
// ═══════════════════════════════════════════════════════════════════════════

let _requestsUnsubscribe = null;

async function renderRequestsView() {
  const grid    = document.getElementById('requests-grid');
  const countEl = document.getElementById('requests-count');
  const addBtn  = document.getElementById('btn-request-title');
  if (!grid) return;

  if (!window.FB?.isLoggedIn?.()) {
    if (addBtn) addBtn.hidden = true;
    grid.innerHTML = `
      <div class="library-auth-prompt">
        <p class="library-auth-icon">🔒</p>
        <p>Connecte-toi pour faire une demande de titre.</p>
        <button class="auth-submit-btn" id="requests-login-btn" type="button">Connexion</button>
      </div>`;
    document.getElementById('requests-login-btn')?.addEventListener('click', () => openAuthModal('login'));
    if (countEl) countEl.textContent = '';
    return;
  }

  if (addBtn) addBtn.hidden = false;
  grid.innerHTML = '<p class="details-empty">Chargement…</p>';

  // Abonnement temps réel
  if (_requestsUnsubscribe) _requestsUnsubscribe();
  _requestsUnsubscribe = window.FB.onRequestsChange((items) => {
    if (countEl) countEl.textContent = items.length ? String(items.length) : '';
    _renderRequestsList(items);
  });
}

function _renderRequestsList(items) {
  const grid = document.getElementById('requests-grid');
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🎬</span><p>Tu n\'as pas encore fait de demande. Clique sur "Demander un titre" !</p></div>';
    return;
  }

  grid.innerHTML = '';
  items.forEach((item) => grid.appendChild(_createRequestCard(item)));
}

function _createRequestCard(item) {
  const STATUS_CONFIG = {
    pending:  { label: 'En attente', cls: '' },
    approved: { label: 'Approuvé',   cls: 'watch-state-resume' },
    added:    { label: '✓ Ajouté',   cls: 'watch-state-complete' },
  };
  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

  const posterUrl = item.poster ? escapeHtml(item.poster) : '';
  const typeLabel = item.mediaType === 'tv' ? 'Série' : 'Film';

  const card = document.createElement('div');
  card.className = 'request-card';
  card.innerHTML = `
    <div class="request-card-poster">
      ${posterUrl
        ? `<img src="${posterUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
        : `<div class="request-card-fallback">${escapeHtml(typeLabel)}</div>`}
    </div>
    <div class="request-card-body">
      <p class="request-card-title">${escapeHtml(item.title)}</p>
      <p class="request-card-meta">${escapeHtml(typeLabel)}${item.year ? ' · ' + escapeHtml(String(item.year)) : ''}</p>
      ${item.note ? `<p class="request-card-note">"${escapeHtml(item.note)}"</p>` : ''}
      <div class="request-card-footer">
        <span class="watch-state-badge ${escapeHtml(sc.cls)}">${escapeHtml(sc.label)}</span>
        ${item.status === 'pending' ? `<button class="request-cancel-btn" data-doc-id="${escapeHtml(item.id)}" type="button">Annuler</button>` : ''}
      </div>
    </div>
  `;

  card.querySelector('.request-cancel-btn')?.addEventListener('click', async (e) => {
    const docId = e.currentTarget.dataset.docId;
    try {
      await window.FB.cancelRequest(docId);
    } catch (err) {
      showNotice(err.message || 'Erreur lors de l\'annulation.', 'error');
    }
  });

  return card;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE DE RECHERCHE TMDB
// ═══════════════════════════════════════════════════════════════════════════

let _tmdbSearchMode = 'query'; // 'query' | 'id'

function openTmdbSearchModal() {
  const modal = document.getElementById('tmdb-search-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('tmdb-search-input')?.focus();
}

function closeTmdbSearchModal() {
  const modal = document.getElementById('tmdb-search-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  const results = document.getElementById('tmdb-search-results');
  if (results) results.innerHTML = '';
}

function setupTmdbSearchModal() {
  const modal      = document.getElementById('tmdb-search-modal');
  const closeBtn   = document.getElementById('tmdb-search-close');
  const searchBtn  = document.getElementById('tmdb-search-btn');
  const input      = document.getElementById('tmdb-search-input');
  const modeQuery  = document.getElementById('tmdb-mode-query');
  const modeId     = document.getElementById('tmdb-mode-id');
  const idTypeSelect = document.getElementById('tmdb-id-type');
  const addBtn     = document.getElementById('btn-request-title');
  if (!modal) return;

  addBtn?.addEventListener('click', openTmdbSearchModal);
  closeBtn?.addEventListener('click', closeTmdbSearchModal);

  modal.addEventListener('click', (e) => {
    if (e.target?.hasAttribute?.('data-close-tmdb')) closeTmdbSearchModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeTmdbSearchModal();
  });

  modeQuery?.addEventListener('click', () => {
    _tmdbSearchMode = 'query';
    modeQuery.classList.add('active');
    modeId.classList.remove('active');
    if (input) input.placeholder = 'Nom du film ou de la série…';
    if (idTypeSelect) idTypeSelect.hidden = true;
  });

  modeId?.addEventListener('click', () => {
    _tmdbSearchMode = 'id';
    modeId.classList.add('active');
    modeQuery.classList.remove('active');
    if (input) input.placeholder = 'ID TMDB (ex: 299536)';
    if (idTypeSelect) idTypeSelect.hidden = false;
  });

  searchBtn?.addEventListener('click', _runTmdbSearch);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') _runTmdbSearch(); });
}

async function _runTmdbSearch() {
  const input    = document.getElementById('tmdb-search-input');
  const results  = document.getElementById('tmdb-search-results');
  const idType   = document.getElementById('tmdb-id-type');
  if (!input || !results) return;

  const query = input.value.trim();
  if (!query) return;

  results.innerHTML = '<p class="tmdb-searching">Recherche en cours…</p>';

  try {
    let items = [];
    if (_tmdbSearchMode === 'id') {
      const mediaType = idType?.value || 'movie';
      const result = await window.FB.searchTmdbById(
        query, mediaType,
        CONFIG.TMDB_BEARER_TOKEN, CONFIG.TMDB_API_KEY, CONFIG.TMDB_LANG
      );
      if (result) items = [result];
    } else {
      items = await window.FB.searchTmdbByQuery(
        query,
        CONFIG.TMDB_BEARER_TOKEN, CONFIG.TMDB_API_KEY, CONFIG.TMDB_LANG
      );
    }

    if (!items.length) {
      results.innerHTML = '<p class="tmdb-searching">Aucun résultat trouvé.</p>';
      return;
    }

    results.innerHTML = '';
    items.forEach((tmdbItem) => {
      const card = _buildTmdbResultCard(tmdbItem);
      results.appendChild(card);
    });
  } catch {
    results.innerHTML = '<p class="tmdb-searching">Erreur lors de la recherche TMDB.</p>';
  }
}

function _buildTmdbResultCard(tmdbItem) {
  const mediaType  = tmdbItem.media_type || 'movie';
  const title      = String(tmdbItem.title || tmdbItem.name || '').trim();
  const overview   = String(tmdbItem.overview || '').trim();
  const posterPath = String(tmdbItem.poster_path || '').trim();
  const posterUrl  = posterPath ? `${CONFIG.TMDB_IMAGE_BASE_URL}${posterPath}` : '';
  const date       = String(tmdbItem.release_date || tmdbItem.first_air_date || '').trim();
  const year       = date ? date.slice(0, 4) : '';
  const tmdbId     = Number(tmdbItem.id) || 0;
  const genres     = Array.isArray(tmdbItem.genre_ids) ? tmdbItem.genre_ids : [];
  const typeLabel  = mediaType === 'tv' ? 'Série' : 'Film';

  const card = document.createElement('div');
  card.className = 'tmdb-result-card';
  card.innerHTML = `
    <div class="tmdb-result-poster">
      ${posterUrl
        ? `<img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}" loading="lazy" />`
        : `<div class="tmdb-result-poster-fallback">${escapeHtml(typeLabel)}</div>`}
    </div>
    <div class="tmdb-result-info">
      <p class="tmdb-result-title">${escapeHtml(title)}</p>
      <p class="tmdb-result-meta">${escapeHtml(typeLabel)} · ${escapeHtml(year)}</p>
      ${overview ? `<p class="tmdb-result-overview">${escapeHtml(overview.slice(0, 120))}…</p>` : ''}
    </div>
    <div class="tmdb-result-actions">
      <button class="tmdb-add-btn" type="button">Demander</button>
    </div>
    <div class="tmdb-note-area" hidden>
      <textarea class="tmdb-note-input" placeholder="Commentaire optionnel…" maxlength="200" rows="2"></textarea>
      <button class="tmdb-confirm-btn" type="button">Confirmer la demande →</button>
    </div>
  `;

  card.querySelector('.tmdb-add-btn')?.addEventListener('click', () => {
    if (!window.FB?.isLoggedIn?.()) {
      openAuthModal('login');
      return;
    }
    card.querySelector('.tmdb-note-area').hidden = false;
    card.querySelector('.tmdb-add-btn').hidden = true;
    card.querySelector('.tmdb-note-input')?.focus();
  });

  card.querySelector('.tmdb-confirm-btn')?.addEventListener('click', async () => {
    const note       = card.querySelector('.tmdb-note-input')?.value.trim() || '';
    const confirmBtn = card.querySelector('.tmdb-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '…';
    try {
      await window.FB.submitRequest({ tmdbId, mediaType, title, poster: posterUrl, overview, year: Number(year) || 0, note });
      card.querySelector('.tmdb-note-area').innerHTML = '<p class="tmdb-request-sent">✓ Demande envoyée !</p>';
      const section = getActiveSection();
      if (section?.id === 'view-requests') renderRequestsView();
    } catch (err) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirmer la demande →';
      showNotice(err.message || 'Erreur lors de la demande.', 'error');
    }
  });

  return card;
}

document.addEventListener('DOMContentLoaded', init);

