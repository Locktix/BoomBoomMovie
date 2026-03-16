/**
 * BoomBoom - app.js
 * Movies metadata and posters can be resolved from TMDB when configured.
 */
const CONFIG = {
  MOVIES_DATA_FILE: 'data.movie.json',
  SERIES_DATA_FILE: 'data.series.json',
  TMDB_CONFIG_FILE: 'tmdb.config.json',
  TIER_STORAGE_KEY: 'boomboom:tier-order:v1',
  TMDB_API_KEY: window.BOOMBOOM_TMDB_API_KEY || localStorage.getItem('boomboom:tmdb:api-key') || '',
  TMDB_BEARER_TOKEN: window.BOOMBOOM_TMDB_BEARER_TOKEN || localStorage.getItem('boomboom:tmdb:bearer-token') || '',
  TMDB_LANG: 'fr-FR',
  TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
  TMDB_MOVIE_DETAILS_ENDPOINT: 'https://api.themoviedb.org/3/movie',
  TMDB_TV_DETAILS_ENDPOINT: 'https://api.themoviedb.org/3/tv',
};

const TIER_LABELS = ['S', 'A', 'B', 'C', 'D', 'F'];
const TIER_POOL = 'pool';

const state = {
  movies: [],
  series: [],
  displayMode: 'grid',
  selectedCollection: 'all',
  tierItems: [],
  tierItemMap: new Map(),
  tierOrder: null,
  tierTypeFilter: 'all',
  tierCollectionFilter: 'all',
  draggedTierItemId: '',
};

const playerState = {
  urlCandidates: [],
  currentIndex: 0,
};

const mediaProbeCache = new Map();
const MEDIA_PROBE_SUCCESS_TTL_MS = 30 * 60 * 1000;
const MEDIA_PROBE_FAILURE_TTL_MS = 20 * 1000;

const EXPIRING_SOON_MS = 6 * 60 * 60 * 1000;
const tmdbPosterCache = new Map();
const tmdbDetailsCache = new Map();
const tmdbSeasonDetailsCache = new Map();

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

    return {
      title,
      releaseDate,
      year: releaseYear,
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

  content.innerHTML = `
    <div class="details-hero">
      <div class="details-poster-wrap">
        ${posterUrl
          ? `<img class="details-poster" src="${escapeHtml(posterUrl)}" alt="${escapeHtml(title)}" loading="lazy" />`
          : `<div class="details-poster-fallback">${escapeHtml(getMediaDisplayType(mediaType))}</div>`}
        <button type="button" class="details-poster-play" data-details-action="play" ${hasPlaybackTarget ? '' : 'disabled'} aria-label="Lecture ${escapeHtml(title)}">
          <span>▶</span>
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

    openVideoPlayer(detailsUrlCandidates, item.title);
  });
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

  for (let i = 0; i < workerCount; i += 1) {
    workers.push((async () => {
      while (queue.length) {
        const movie = queue.shift();
        if (!movie) continue;
        const metadata = await resolveTmdbMovieMetadataById(movie);
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

function clearProbeCache(url) {
  if (!url) return;
  mediaProbeCache.delete(url);
}

function setProbeCache(url, ok) {
  if (!url) return;
  mediaProbeCache.set(url, {
    ok,
    checkedAt: Date.now(),
  });
}

function getFreshProbeCache(url) {
  if (!url) return null;
  const cached = mediaProbeCache.get(url);
  if (!cached || typeof cached !== 'object' || !('checkedAt' in cached)) return null;

  const age = Date.now() - Number(cached.checkedAt || 0);
  const maxAge = cached.ok ? MEDIA_PROBE_SUCCESS_TTL_MS : MEDIA_PROBE_FAILURE_TTL_MS;
  if (age > maxAge) {
    mediaProbeCache.delete(url);
    return null;
  }

  return cached;
}

function probeVideoUrl(url, timeoutMs = 9000) {
  if (!url) return Promise.resolve(false);

  const freshCached = getFreshProbeCache(url);
  if (freshCached) return Promise.resolve(Boolean(freshCached.ok));

  const inFlightKey = `${url}::inflight`;
  if (mediaProbeCache.has(inFlightKey)) return mediaProbeCache.get(inFlightKey);

  const probePromise = new Promise((resolve) => {
    const probe = document.createElement('video');
    let settled = false;

    const finalize = (isReachable) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      probe.removeEventListener('loadedmetadata', onSuccess);
      probe.removeEventListener('canplay', onSuccess);
      probe.removeEventListener('error', onError);
      probe.src = '';
      probe.load();
      resolve(isReachable);
    };

    const onSuccess = () => finalize(true);
    const onError = () => {
      setProbeCache(url, false);
      finalize(false);
    };

    const timer = setTimeout(() => {
      setProbeCache(url, false);
      finalize(false);
    }, timeoutMs);

    probe.preload = 'metadata';
    probe.muted = true;
    probe.playsInline = true;
    probe.addEventListener('loadedmetadata', onSuccess, { once: true });
    probe.addEventListener('canplay', onSuccess, { once: true });
    probe.addEventListener('error', onError, { once: true });
    probe.src = url;
    probe.load();
  }).then((ok) => {
    setProbeCache(url, ok);
    mediaProbeCache.delete(inFlightKey);
    return ok;
  });

  mediaProbeCache.set(inFlightKey, probePromise);
  return probePromise;
}

function openVideoModalWithUrl(url, index, movieTitle, candidates) {
  const modal = document.getElementById('video-modal');
  const source = document.getElementById('video-source');
  const video = document.getElementById('video-player');
  const title = document.getElementById('video-modal-title');

  playerState.urlCandidates = candidates;
  playerState.currentIndex = index;

  source.src = url;
  title.textContent = movieTitle;
  video.load();

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  video.play().catch(() => {
    console.warn('Autoplay was prevented. User interaction required.');
  });
}

async function findReachableCandidate(candidates, startIndex = 0) {
  for (let i = Math.max(0, startIndex); i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (!candidate || getUrlAvailability(candidate).isExpired) continue;
    // Verify the stream can actually load before attempting playback in modal.
    const isReachable = await probeVideoUrl(candidate);
    if (isReachable) return { url: candidate, index: i };
  }
  return null;
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

function slugifyValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function getTierCollectionKey(item) {
  return normalizeCollection(getItemCollection(item)) || 'none';
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

function renderChoiceChips(containerId, options, activeValue, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  options.forEach(({ value, label }) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `filter-chip ${activeValue === value ? 'active' : ''}`;
    chip.textContent = label;
    chip.addEventListener('click', () => onSelect(value));
    fragment.appendChild(chip);
  });

  container.appendChild(fragment);
}

function refreshFiltersForActiveSection() {
  const section = getActiveSection();
  if (!section) return;

  if (section.id === 'tiers') {
    renderTierFilterChips();
    return;
  }

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

function createTierItem(item, mediaType) {
  const collection = getItemCollection(item);
  return {
    id: `${mediaType}-${slugifyValue(item.title)}-${item.year || 'na'}`,
    title: item.title,
    year: item.year,
    poster: item.poster || '',
    collection,
    collectionKey: getTierCollectionKey(item),
    mediaType,
  };
}

function buildTierItems() {
  const items = [
    ...state.movies.map((item) => createTierItem(item, 'movie')),
    ...state.series.map((item) => createTierItem(item, 'series')),
  ].sort((a, b) => {
    const titleCompare = String(a.title || '').localeCompare(String(b.title || ''), 'fr', { sensitivity: 'base' });
    if (titleCompare !== 0) return titleCompare;
    return (Number(b.year) || 0) - (Number(a.year) || 0);
  });

  state.tierItems = items;
  state.tierItemMap = new Map(items.map((item) => [item.id, item]));
}

function getTierZones() {
  return [TIER_POOL, ...TIER_LABELS];
}

function getDefaultTierOrder() {
  const order = { [TIER_POOL]: state.tierItems.map((item) => item.id) };
  TIER_LABELS.forEach((label) => {
    order[label] = [];
  });
  return order;
}

function sanitizeTierOrder(rawOrder) {
  const knownIds = new Set(state.tierItems.map((item) => item.id));
  const seen = new Set();
  const sanitized = {};

  getTierZones().forEach((zone) => {
    const ids = Array.isArray(rawOrder?.[zone]) ? rawOrder[zone] : [];
    sanitized[zone] = ids.filter((id) => {
      if (!knownIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  });

  state.tierItems.forEach((item) => {
    if (!seen.has(item.id)) sanitized[TIER_POOL].push(item.id);
  });

  return sanitized;
}

function loadTierOrder() {
  const fallback = getDefaultTierOrder();

  try {
    const raw = localStorage.getItem(CONFIG.TIER_STORAGE_KEY);
    if (!raw) return fallback;
    return sanitizeTierOrder(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function saveTierOrder() {
  try {
    localStorage.setItem(CONFIG.TIER_STORAGE_KEY, JSON.stringify(state.tierOrder));
  } catch {
    showNotice('Impossible d\'enregistrer la tier list localement.', 'error');
  }
}

function getTierCollectionOptions() {
  const options = new Map([['all', 'Toutes']]);

  state.tierItems.forEach((item) => {
    const label = item.collection || 'Sans collection';
    if (!options.has(item.collectionKey)) options.set(item.collectionKey, label);
  });

  return [...options.entries()].map(([value, label]) => ({ value, label }));
}

function renderTierFilterChips() {
  renderChoiceChips(
    'tier-type-filters',
    [
      { value: 'all', label: 'Tout' },
      { value: 'movie', label: 'Films' },
      { value: 'series', label: 'Séries' },
    ],
    state.tierTypeFilter,
    (value) => {
      state.tierTypeFilter = value;
      renderTierFilterChips();
      renderTierBoard();
    }
  );

  renderChoiceChips(
    'tier-collection-filters',
    getTierCollectionOptions(),
    state.tierCollectionFilter,
    (value) => {
      state.tierCollectionFilter = value;
      renderTierFilterChips();
      renderTierBoard();
    }
  );
}

function matchesTierFilters(item, query) {
  const title = String(item?.title || '').toLowerCase();
  const matchesSearch = !query || title.includes(query);
  const matchesType = state.tierTypeFilter === 'all' || item.mediaType === state.tierTypeFilter;
  const matchesCollection = state.tierCollectionFilter === 'all' || item.collectionKey === state.tierCollectionFilter;
  return matchesSearch && matchesType && matchesCollection;
}

function createTierTile(item) {
  const tile = document.createElement('article');
  tile.className = 'tier-item';
  tile.draggable = true;
  tile.dataset.itemId = item.id;
  tile.setAttribute('aria-label', `${item.title} (${item.year || ''})`);

  const collectionBadge = item.collection
    ? `<span class="tier-item-badge">${escapeHtml(item.collection)}</span>`
    : '<span class="tier-item-badge tier-item-badge-muted">Sans collection</span>';

  tile.innerHTML = `
    <div class="tier-item-poster-wrap">
      ${item.poster
        ? `<img class="tier-item-poster" src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
        : `<div class="tier-item-fallback">${item.mediaType === 'series' ? 'SERIE' : 'FILM'}</div>`}
    </div>
    <div class="tier-item-copy">
      <h3 class="tier-item-title">${escapeHtml(item.title)}</h3>
      <p class="tier-item-meta">${item.mediaType === 'series' ? 'Série' : 'Film'} · ${item.year || 'N/A'}</p>
      <div class="tier-item-tags">${collectionBadge}</div>
    </div>
  `;

  tile.addEventListener('dragstart', (event) => {
    state.draggedTierItemId = item.id;
    tile.classList.add('tier-item-dragging');
    event.dataTransfer?.setData('text/plain', item.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });

  tile.addEventListener('dragend', () => {
    tile.classList.remove('tier-item-dragging');
    state.draggedTierItemId = '';
    document.querySelectorAll('.tier-dropzone-active').forEach((zone) => zone.classList.remove('tier-dropzone-active'));
  });

  return tile;
}

function moveTierItem(itemId, targetZone) {
  if (!itemId || !state.tierItemMap.has(itemId) || !getTierZones().includes(targetZone)) return;

  getTierZones().forEach((zone) => {
    state.tierOrder[zone] = state.tierOrder[zone].filter((id) => id !== itemId);
  });

  state.tierOrder[targetZone].push(itemId);
  saveTierOrder();
  renderTierBoard();
}

function createTierDropzone(zone, items, emptyLabel) {
  const dropzone = document.createElement('div');
  dropzone.className = `tier-dropzone ${zone === TIER_POOL ? 'tier-dropzone-pool' : ''}`;
  dropzone.dataset.zone = zone;

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('tier-dropzone-active');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('tier-dropzone-active');
  });

  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('tier-dropzone-active');
    const itemId = event.dataTransfer?.getData('text/plain') || state.draggedTierItemId;
    moveTierItem(itemId, zone);
  });

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'tier-empty';
    empty.textContent = emptyLabel;
    dropzone.appendChild(empty);
    return dropzone;
  }

  items.forEach((item) => dropzone.appendChild(createTierTile(item)));
  return dropzone;
}

function renderTierBoard() {
  const board = document.getElementById('tier-board');
  const count = document.getElementById('tiers-count');
  if (!board || !count || !state.tierOrder) return;

  const query = document.getElementById('search')?.value.trim().toLowerCase() || '';
  const total = state.tierItems.length;
  const rankedTotal = TIER_LABELS.reduce((sum, label) => sum + state.tierOrder[label].length, 0);
  count.textContent = `${rankedTotal}/${total} classés`;

  board.innerHTML = '';
  const fragment = document.createDocumentFragment();

  TIER_LABELS.forEach((label) => {
    const items = state.tierOrder[label]
      .map((id) => state.tierItemMap.get(id))
      .filter((item) => item && matchesTierFilters(item, query));

    const row = document.createElement('section');
    row.className = 'tier-row';
    row.innerHTML = `
      <div class="tier-rank tier-rank-${label.toLowerCase()}">${label}</div>
      <div class="tier-row-body">
        <div class="tier-row-head">
          <h3>${label} Tier</h3>
          <span>${items.length} visible(s)</span>
        </div>
      </div>
    `;

    row.querySelector('.tier-row-body').appendChild(
      createTierDropzone(label, items, 'Dépose un film ou une série ici')
    );
    fragment.appendChild(row);
  });

  const poolItems = state.tierOrder[TIER_POOL]
    .map((id) => state.tierItemMap.get(id))
    .filter((item) => item && matchesTierFilters(item, query));

  const pool = document.createElement('section');
  pool.className = 'tier-pool';
  pool.innerHTML = `
    <div class="tier-pool-head">
      <div>
        <p class="tier-pool-kicker">Bibliothèque</p>
        <h3>À classer</h3>
      </div>
      <span>${poolItems.length} visible(s)</span>
    </div>
  `;
  pool.appendChild(createTierDropzone(TIER_POOL, poolItems, 'Aucun résultat avec les filtres actuels'));
  fragment.appendChild(pool);

  board.appendChild(fragment);
}

function applyCurrentFilters() {
  const section = getActiveSection();
  const input = document.getElementById('search');
  if (!section || !input) return;

  if (section.id === 'tiers') {
    renderTierBoard();
    return;
  }

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

function updateSearchPlaceholder() {
  const input = document.getElementById('search');
  const section = getActiveSection();
  if (!input || !section) return;

  input.placeholder = section.id === 'tiers'
    ? 'Rechercher dans la tier list…'
    : 'Rechercher un titre…';
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
        </header>
        <div class="episode-list">
    `;

    epList.forEach((ep, i) => {
      const epNum = i + 1;
      const code = `S${String(seasonNum).padStart(2, '0')}E${String(epNum).padStart(2, '0')}`;
      const tmdbEpisode = tmdbEpisodes.find((entry) => Number(entry?.episode_number) === epNum) || tmdbEpisodes[i] || null;
      const tmdbEpisodeName = String(tmdbEpisode?.name || '').trim();
      const tmdbAirDate = String(tmdbEpisode?.air_date || '').trim();
      const tmdbStillPath = String(tmdbEpisode?.still_path || '').trim();

      const urlCandidates = Array.isArray(ep?._urlCandidates) ? ep._urlCandidates : getMediaUrlCandidates(ep);
      const hasUrl = urlCandidates.length > 0;

      const thumbMarkup = tmdbStillPath
        ? `<img class="episode-thumb" src="${escapeHtml(`${CONFIG.TMDB_IMAGE_BASE_URL}${tmdbStillPath}`)}" alt="${escapeHtml(tmdbEpisodeName || code)}" loading="lazy" />`
        : `<div class="episode-thumb-fallback">${escapeHtml(code)}</div>`;

      html += `
          <article class="episode-card${hasUrl ? ' episode-playable' : ''}"${hasUrl ? ` data-url-candidates="${escapeHtml(JSON.stringify(urlCandidates))}"` : ''}>
            <div class="episode-thumb-wrap">
              ${thumbMarkup}
            </div>
            <div class="episode-main">
              <p class="episode-code">${code}</p>
              <p class="episode-title">${escapeHtml(tmdbEpisodeName || `Episode ${epNum}`)}</p>
              <p class="episode-year">${escapeHtml(tmdbAirDate || String(season.year || ''))}</p>
            </div>
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

  content.innerHTML = html;
}

function closeSeriesModal() {
  const modal = document.getElementById('series-modal');
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openVideoPlayer(videoUrl, movieTitle) {
  const candidates = Array.isArray(videoUrl)
    ? videoUrl
    : getMediaUrlCandidates({ url: videoUrl });

  const firstUrl = candidates[0] || '';
  openVideoModalWithUrl(firstUrl, 0, movieTitle, candidates);
}

function closeVideoPlayer() {
  const modal = document.getElementById('video-modal');
  const source = document.getElementById('video-source');
  const video = document.getElementById('video-player');

  video.pause();
  video.currentTime = 0;
  source.src = '';
  playerState.urlCandidates = [];
  playerState.currentIndex = 0;

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
    if (epItem && epItem.dataset.urlCandidates) {
      const epCode = epItem.querySelector('.episode-code')?.textContent || '';
      const seriesTitle = document.getElementById('series-modal-title')?.textContent || 'Épisode';
      const episodeTitle = `${seriesTitle} - ${epCode}`;
      let urlCandidates = [];
      try {
        urlCandidates = JSON.parse(epItem.dataset.urlCandidates);
      } catch {
        urlCandidates = [];
      }
      openVideoPlayer(urlCandidates, episodeTitle);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeSeriesModal();
  });
}

function createCard(item, isTV = false, index = 0) {
  const releaseLabel = !isTV && item.releaseDate
    ? String(item.releaseDate)
    : String(item.year || '');

  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${item.title} (${releaseLabel})`);
  card.dataset.year = String(item.year || '');
  const collectionLabel = getItemCollection(item);
  card.dataset.collection = normalizeCollection(collectionLabel);
  card.dataset.collectionLabel = collectionLabel;
  const urlCandidates = Array.isArray(item?._urlCandidates) ? item._urlCandidates : getMediaUrlCandidates(item);
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
        <span class="card-year">${escapeHtml(releaseLabel)}</span>
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

    openVideoPlayer(urlCandidates, item.title);
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
  renderTierBoard();
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
      updateSearchPlaceholder();
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

function setupTierListControls() {
  const resetButton = document.getElementById('tier-reset');
  if (!resetButton) return;

  resetButton.addEventListener('click', () => {
    state.tierOrder = getDefaultTierOrder();
    saveTierOrder();
    renderTierBoard();
    showNotice('La tier list a été réinitialisée sur cet appareil.', 'warning');
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
              change.type === 'feature' ? 'Nouveauté' :
              change.type === 'fix' ? 'Correctif' :
              change.type === 'improvement' ? 'Amélioration' :
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

async function init() {
  await loadTmdbConfigFile();

  setupTabs();
  setupSearch();
  setupFilters();
  setupDisplayMode();
  setupVideoModal();
  setupDetailsModal();
  setupSeriesModal();
  setupTierListControls();
  setupRoadmapModal();
  updateSearchPlaceholder();

  try {
    const [moviesRes, seriesRes] = await Promise.all([
      fetch(CONFIG.MOVIES_DATA_FILE),
      fetch(CONFIG.SERIES_DATA_FILE),
    ]);

    if (!moviesRes.ok) {
      throw new Error(
        `Impossible de charger ${CONFIG.MOVIES_DATA_FILE} (HTTP ${moviesRes.status})`
      );
    }
    if (!seriesRes.ok) {
      throw new Error(
        `Impossible de charger ${CONFIG.SERIES_DATA_FILE} (HTTP ${seriesRes.status})`
      );
    }

    const [moviesData, seriesData] = await Promise.all([moviesRes.json(), seriesRes.json()]);

    const rawMovies = Array.isArray(moviesData.movies) ? moviesData.movies : [];
    const rawSeries = Array.isArray(seriesData.series) ? seriesData.series : [];

    const tmdbMoviesMetadataUpdated = await hydrateMovieMetadataFromTmdb(rawMovies);

    state.movies = sortByReleaseDate(rawMovies);
    state.series = sortByReleaseDate(rawSeries);

    const [tmdbMoviePostersUpdated, tmdbSeriesPostersUpdated] = await Promise.all([
      hydrateMoviePostersFromTmdb(state.movies),
      hydrateSeriesPostersFromTmdb(state.series),
    ]);
    buildTierItems();
    state.tierOrder = loadTierOrder();

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

    renderLibrary();
    refreshFiltersForActiveSection();
    applyCurrentFilters();

    if (
      hasTmdbCredentials()
      && tmdbMoviePostersUpdated === 0
      && tmdbSeriesPostersUpdated === 0
      && tmdbMoviesMetadataUpdated === 0
    ) {
      showNotice('TMDB est configure, mais aucune metadonnee/affiche n\'a ete recuperee. Verifie ta cle et les tmdbId dans les JSON.', 'warning');
    }

    if (linkStats.expired > 0) {
      showNotice(
        `${linkStats.expired} lien(s) video expire(s). Regenerer les URLs signees dans data.movie.json et data.series.json.`,
        'error'
      );
    } else if (linkStats.expiringSoon > 0) {
      showNotice(
        `${linkStats.expiringSoon} lien(s) video vont expirer bientot. Pense a regenerer data.movie.json et data.series.json.`,
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
