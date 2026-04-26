/* ============================================
   BoomBoomMovie — API & Data Layer
   ============================================ */

BBM.API = {
  _cache: {},
  _items: null,
  _movies: null,
  _seriesMap: null,

  /* ----------------------------------------
     Worker API + R2 streams — Fetch all items
     ---------------------------------------- */

  /** True si l'URL pointe vers un manifest HLS (m3u8). */
  isHlsUrl(url) {
    return typeof url === 'string' && /\.m3u8(\?|$)/i.test(url);
  },

  /** Normalise un item du R2 streams JSON vers le format catalog interne. */
  _normalizeStreamItem(s) {
    if (!s || !s.tmdbId || !s.url) return null;
    const tmdbID = String(s.tmdbId);
    const isMovie = s.type === 'movie';
    const createdAt = s.addedAt ? new Date(Number(s.addedAt)).toISOString() : null;
    if (isMovie) {
      return {
        tmdbID,
        category: 'movie',
        title: '', // sera enrichi via TMDB cache au rendu
        url: s.url,
        createdAt
      };
    }
    // series : convertir "01" → 1, "02" → 2
    const seasonNumber = s.season != null ? parseInt(s.season, 10) : null;
    const episodeNumber = s.episode != null ? parseInt(s.episode, 10) : null;
    if (seasonNumber == null || episodeNumber == null) return null;
    return {
      tmdbID,
      category: 'series',
      seriesTitle: '',
      url: s.url,
      seasonNumber,
      episodeNumber,
      createdAt
    };
  },

  _itemKey(item) {
    return item.category === 'movie'
      ? `movie_${item.tmdbID}`
      : `series_${item.tmdbID}_s${item.seasonNumber}_e${item.episodeNumber}`;
  },

  async fetchAllItems() {
    if (this._items) return this._items;

    // Fetch parallèle des deux sources
    const [workerItems, streamItems] = await Promise.all([
      fetch(BBM.Config.workerAPI)
        .then(r => r.ok ? r.json() : [])
        .catch(e => { console.warn('workerAPI indisponible', e); return []; }),
      BBM.Config.streamsAPI
        ? fetch(BBM.Config.streamsAPI)
            .then(r => r.ok ? r.json() : [])
            .catch(e => { console.warn('streamsAPI indisponible', e); return []; })
        : Promise.resolve([])
    ]);

    if (workerItems.length === 0 && streamItems.length === 0) {
      throw new Error('Aucune API disponible');
    }

    // Normalisation des items R2 puis fusion avec dédup.
    // Priorité au HLS (m3u8) en cas de doublon : si un item m3u8 arrive
    // alors qu'on a déjà un mp4 pour la même clé, on remplace.
    const normalizedStreams = streamItems
      .map(s => this._normalizeStreamItem(s))
      .filter(Boolean);

    const map = new Map();
    const addItem = (item) => {
      const key = this._itemKey(item);
      const existing = map.get(key);
      if (!existing) { map.set(key, item); return; }
      const existingIsHls = this.isHlsUrl(existing.url);
      const incomingIsHls = this.isHlsUrl(item.url);
      // Remplace si l'incoming est HLS et l'existant ne l'est pas
      if (incomingIsHls && !existingIsHls) {
        // Conserve les métadonnées existantes (title, seriesTitle, createdAt
        // si présent) en plus de la nouvelle URL HLS.
        map.set(key, {
          ...existing,
          url: item.url,
          createdAt: item.createdAt || existing.createdAt
        });
      }
      // Sinon on garde l'existant (priorité au premier vu si même format,
      // ou au HLS déjà en place)
    };

    workerItems.forEach(addItem);
    normalizedStreams.forEach(addItem);

    this._items = Array.from(map.values());
    this._processItems();
    this._buildSearchIndex();
    return this._items;
  },

  _processItems() {
    this._movies = this._items.filter(i => i.category === 'movie');
    this._seriesMap = new Map();

    this._items.filter(i => i.category === 'series').forEach(ep => {
      const key = ep.tmdbID;
      if (!this._seriesMap.has(key)) {
        this._seriesMap.set(key, {
          tmdbID: ep.tmdbID,
          seriesTitle: ep.seriesTitle,
          category: 'series',
          episodes: []
        });
      }
      this._seriesMap.get(key).episodes.push(ep);
    });

    // Trier les épisodes par saison puis par numéro
    this._seriesMap.forEach(series => {
      series.episodes.sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
        return a.episodeNumber - b.episodeNumber;
      });
    });
  },

  getMovies() { return this._movies || []; },
  getSeries() { return this._seriesMap ? Array.from(this._seriesMap.values()) : []; },
  getSeriesMap() { return this._seriesMap || new Map(); },

  /** Trouver l'URL de lecture d'un épisode */
  getEpisodeURL(tmdbID, season, episode) {
    const series = this._seriesMap?.get(String(tmdbID));
    if (!series) return null;
    const ep = series.episodes.find(
      e => e.seasonNumber === season && e.episodeNumber === episode
    );
    return ep ? ep.url : null;
  },

  /** Trouver l'URL d'un film par tmdbID */
  getMovieURL(tmdbID) {
    const movie = this._movies?.find(m => m.tmdbID === String(tmdbID));
    return movie ? movie.url : null;
  },

  /** Récemment ajoutés */
  isNewlyAdded(tmdbID) {
    if (!this._items) return false;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this._items.some(i =>
      String(i.tmdbID) === String(tmdbID) && i.createdAt && new Date(i.createdAt).getTime() > sevenDaysAgo
    );
  },

  getRecentlyAdded(limit = 20) {
    if (!this._items) return [];
    const unique = new Map();
    // Pour les séries, prendre une entrée par série
    [...this._items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach(item => {
        const key = item.tmdbID;
        if (!unique.has(key)) {
          unique.set(key, item);
        }
      });
    return Array.from(unique.values()).slice(0, limit);
  },

  /* ----------------------------------------
     TMDB API — Metadata
     ---------------------------------------- */

  /** Fetch TMDB metadata avec cache localStorage */
  async getTMDBData(tmdbID, type = 'movie') {
    const cacheKey = `tmdb_${type}_${tmdbID}`;

    // Check memory cache
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    // Check localStorage
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed._cachedAt < BBM.Config.cacheTTL) {
          this._cache[cacheKey] = parsed;
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }

    // Fetch from TMDB — avec un retry sur NetworkError car beaucoup de
    // requêtes parallèles peuvent se faire silence par le navigateur ou
    // un blocker, et un seul échec crée un trou dans la grille.
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const url = `${BBM.Config.tmdb.baseURL}/${endpoint}/${tmdbID}?api_key=${BBM.Config.tmdb.apiKey}&language=${BBM.Config.tmdb.language}&append_to_response=credits,videos,images&include_image_language=fr,en,null`;

    const tryFetch = async () => {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    };

    let data = null;
    try {
      data = await tryFetch();
    } catch (e) {
      // Un retry après 1,5s — couvre les network blips, rate-limits TMDB,
      // les extensions qui bloquent sporadiquement
      await new Promise(r => setTimeout(r, 1500));
      try { data = await tryFetch(); }
      catch (e2) {
        console.warn(`TMDB ${tmdbID}: échec après retry`, e2.message || e2);
        return null;
      }
    }
    if (!data) return null;

    data._cachedAt = Date.now();
    try { localStorage.setItem(cacheKey, JSON.stringify(data)); }
    catch (e) { /* localStorage full */ }
    this._cache[cacheKey] = data;
    return data;
  },

  /** Fetch TMDB season data */
  async getTMDBSeason(tmdbID, seasonNumber) {
    const cacheKey = `tmdb_season_${tmdbID}_${seasonNumber}`;

    if (this._cache[cacheKey]) return this._cache[cacheKey];

    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed._cachedAt < BBM.Config.cacheTTL) {
          this._cache[cacheKey] = parsed;
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }

    const url = `${BBM.Config.tmdb.baseURL}/tv/${tmdbID}/season/${seasonNumber}?api_key=${BBM.Config.tmdb.apiKey}&language=${BBM.Config.tmdb.language}`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      data._cachedAt = Date.now();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) { /* full */ }
      this._cache[cacheKey] = data;
      return data;
    } catch (e) {
      return null;
    }
  },

  /** Fetch TMDB person credits (filmography) */
  async getPersonCredits(personID) {
    const cacheKey = `tmdb_person_${personID}`;

    if (this._cache[cacheKey]) return this._cache[cacheKey];

    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed._cachedAt < BBM.Config.cacheTTL) {
          this._cache[cacheKey] = parsed;
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }

    const url = `${BBM.Config.tmdb.baseURL}/person/${personID}?api_key=${BBM.Config.tmdb.apiKey}&language=${BBM.Config.tmdb.language}&append_to_response=combined_credits`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      data._cachedAt = Date.now();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) { /* full */ }
      this._cache[cacheKey] = data;
      return data;
    } catch (e) {
      return null;
    }
  },

  /** Batch fetch TMDB data avec concurrency limit */
  async batchFetchTMDB(items, concurrency = 6, onProgress = null) {
    const results = new Map();
    const queue = [...items];
    const total = queue.length;
    let done = 0;

    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        const type = item.category === 'movie' ? 'movie' : 'tv';
        const data = await BBM.API.getTMDBData(item.tmdbID, type);
        if (data) results.set(item.tmdbID, data);
        done++;
        if (onProgress) onProgress(done, total);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
    await Promise.all(workers);
    return results;
  },

  /* ----------------------------------------
     Image Helpers
     ---------------------------------------- */

  getPosterURL(path, size) {
    if (!path) return null;
    return `${BBM.Config.tmdb.imageBase}/${size || BBM.Config.posterSize}${path}`;
  },

  getBackdropURL(path, size) {
    if (!path) return null;
    return `${BBM.Config.tmdb.imageBase}/${size || BBM.Config.backdropSize}${path}`;
  },

  getStillURL(path) {
    if (!path) return null;
    return `${BBM.Config.tmdb.imageBase}/w300${path}`;
  },

  getLogoURL(tmdb, size) {
    const logos = tmdb?.images?.logos || [];
    if (logos.length === 0) return null;
    const preferred = logos.find(l => l.iso_639_1 === 'fr')
      || logos.find(l => l.iso_639_1 === 'en')
      || logos.find(l => !l.iso_639_1)
      || logos[0];
    if (!preferred?.file_path) return null;
    return `${BBM.Config.tmdb.imageBase}/${size || 'w500'}${preferred.file_path}`;
  },

  getProfileURL(path) {
    if (!path) return null;
    return `${BBM.Config.tmdb.imageBase}/${BBM.Config.profileSize}${path}`;
  },

  /* ----------------------------------------
     Firestore — User document (single source of truth)
     ----------------------------------------
     Le document utilisateur est lu UNE SEULE fois par session puis
     mis en cache. Toutes les lectures (myList, continueWatching,
     ratings, downloads, isAdmin) partagent ce snapshot pour éviter
     les incohérences entre cache et serveur Firestore.
  */
  _userDocCache: null,
  _userDocCacheUid: null,
  _userDocPromise: null,

  /** Récupère le document utilisateur — server-first, cache mémoire. */
  async getUserDoc(opts = {}) {
    const user = BBM.Auth.currentUser;
    if (!user) return null;
    const forceFresh = opts.forceFresh === true;

    // Cache invalidé si l'uid change (changement de compte)
    if (this._userDocCacheUid !== user.uid) {
      this._userDocCache = null;
      this._userDocPromise = null;
      this._userDocCacheUid = user.uid;
    }

    if (!forceFresh && this._userDocCache) return this._userDocCache;

    // Déduplique les lectures parallèles : si une fetch est déjà en
    // cours, tous les appelants attendent le même résultat.
    if (!forceFresh && this._userDocPromise) return this._userDocPromise;

    const ref = BBM.db.collection('users').doc(user.uid);
    this._userDocPromise = (async () => {
      let doc;
      try {
        doc = await ref.get({ source: 'server' });
      } catch (serverErr) {
        try { doc = await ref.get(); } catch (e) { return null; }
      }
      if (!doc) return null;
      const data = doc.exists ? doc.data() : {};
      this._userDocCache = data;
      return data;
    })();

    try {
      return await this._userDocPromise;
    } finally {
      this._userDocPromise = null;
    }
  },

  /** Invalide le cache après une écriture. À appeler dans chaque update. */
  invalidateUserDoc() {
    this._userDocCache = null;
    this._userDocPromise = null;
  },

  /** Patch local du cache après écriture (évite un round-trip serveur). */
  patchUserDoc(patcher) {
    if (!this._userDocCache) return;
    try { patcher(this._userDocCache); } catch (e) {}
  },

  /* ----------------------------------------
     Firestore — My List
     ---------------------------------------- */

  async getMyList() {
    const data = await this.getUserDoc();
    return (data && data.myList) || [];
  },

  async addToMyList(tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    await BBM.db.collection('users').doc(user.uid).update({
      myList: firebase.firestore.FieldValue.arrayUnion(String(tmdbID))
    });
    this.patchUserDoc(d => {
      const list = d.myList || [];
      if (!list.includes(String(tmdbID))) list.push(String(tmdbID));
      d.myList = list;
    });
  },

  async removeFromMyList(tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    await BBM.db.collection('users').doc(user.uid).update({
      myList: firebase.firestore.FieldValue.arrayRemove(String(tmdbID))
    });
    this.patchUserDoc(d => {
      d.myList = (d.myList || []).filter(id => id !== String(tmdbID));
    });
  },

  async isInMyList(tmdbID) {
    const list = await this.getMyList();
    return list.includes(String(tmdbID));
  },

  /* ----------------------------------------
     Firestore — Continue Watching
     ---------------------------------------- */

  /**
   * Save current playback state.
   *  - `continueWatching[tmdbID]` reflects the LATEST state for the rangée
   *    "Reprendre" et la restauration de progression au lancement du player.
   *  - `watchHistory[sessionId]` est append-only : chaque session de
   *    visionnage (≤ 4h d'inactivité) génère une entrée distincte. Permet
   *    d'avoir un vrai journal chronologique avec doublons.
   */
  _currentSessions: {},        // key → sessionId actif en mémoire
  _sessionStartedSet: new Set(),

  _sessionKey(tmdbID, season, episode) {
    return `${tmdbID}_${season != null ? season : 0}_${episode != null ? episode : 0}`;
  },

  _msFromTimestamp(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    if (typeof ts === 'number') return ts;
    return 0;
  },

  async saveContinueWatching(tmdbID, data) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    const tid = String(tmdbID);
    const ref = BBM.db.collection('users').doc(user.uid);

    // ---- 1. État courant (continueWatching) ----
    const update = {};
    for (const [k, v] of Object.entries(data)) {
      update[`continueWatching.${tid}.${k}`] = v;
    }
    update[`continueWatching.${tid}.updatedAt`] = firebase.firestore.FieldValue.serverTimestamp();

    // ---- 2. Session de visionnage (watchHistory) ----
    const season = data.seasonNumber != null ? data.seasonNumber : null;
    const episode = data.episodeNumber != null ? data.episodeNumber : null;
    const sessKey = this._sessionKey(tid, season, episode);

    // Réutilise la session active en mémoire ; sinon cherche la session
    // la plus récente dans le cache utilisateur, et l'accepte si < 4h.
    let sessionId = this._currentSessions[sessKey];
    if (!sessionId) {
      const wh = (this._userDocCache && this._userDocCache.watchHistory) || {};
      let bestId = null, bestMs = 0;
      for (const [sid, e] of Object.entries(wh)) {
        if (this._sessionKey(e.tmdbID, e.seasonNumber, e.episodeNumber) === sessKey) {
          const ms = this._msFromTimestamp(e.updatedAt);
          if (ms > bestMs) { bestMs = ms; bestId = sid; }
        }
      }
      if (bestId && (Date.now() - bestMs) < 4 * 3600 * 1000) {
        sessionId = bestId;
        this._sessionStartedSet.add(sessionId); // déjà existant, ne pas réinitialiser startedAt
      }
    }
    if (!sessionId) {
      sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    this._currentSessions[sessKey] = sessionId;

    const sessionData = {
      tmdbID: tid,
      seasonNumber: season,
      episodeNumber: episode,
      progress: Number(data.progress) || 0,
      duration: Number(data.duration) || 0,
      category: data.category || 'movie',
      allWatched: !!data.allWatched
    };
    for (const [k, v] of Object.entries(sessionData)) {
      update[`watchHistory.${sessionId}.${k}`] = v;
    }
    update[`watchHistory.${sessionId}.updatedAt`] = firebase.firestore.FieldValue.serverTimestamp();
    if (!this._sessionStartedSet.has(sessionId)) {
      update[`watchHistory.${sessionId}.startedAt`] = firebase.firestore.FieldValue.serverTimestamp();
      this._sessionStartedSet.add(sessionId);
    }

    try {
      await ref.update(update);
    } catch (e) {
      await ref.set({
        continueWatching: {
          [tid]: { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }
        },
        watchHistory: {
          [sessionId]: {
            ...sessionData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            startedAt: firebase.firestore.FieldValue.serverTimestamp()
          }
        }
      }, { merge: true });
    }

    this.patchUserDoc(d => {
      d.continueWatching = d.continueWatching || {};
      d.continueWatching[tid] = { ...(d.continueWatching[tid] || {}), ...data };
      d.watchHistory = d.watchHistory || {};
      d.watchHistory[sessionId] = { ...(d.watchHistory[sessionId] || {}), ...sessionData };
    });
  },

  /**
   * Lit l'historique de visionnage. MERGE `watchHistory` (chronologie
   * append-only) et `continueWatching` (état courant) pour ne perdre
   * aucune entrée pendant la migration : un item présent uniquement dans
   * `continueWatching` (visionnage antérieur au déploiement de
   * watchHistory) est ajouté comme entrée legacy. La déduplication se
   * fait par tmdbID + season + episode pour ne pas montrer en double une
   * entrée qui existe déjà comme session.
   */
  async getWatchHistory() {
    const data = await this.getUserDoc();
    if (!data) return [];

    const wh = data.watchHistory || {};
    const cw = data.continueWatching || {};

    const sessions = Object.entries(wh).map(([sid, e]) => ({
      sessionId: sid,
      tmdbID: String(e.tmdbID),
      seasonNumber: e.seasonNumber != null ? e.seasonNumber : null,
      episodeNumber: e.episodeNumber != null ? e.episodeNumber : null,
      progress: Number(e.progress) || 0,
      duration: Number(e.duration) || 0,
      category: e.category || 'movie',
      allWatched: !!e.allWatched,
      updatedAt: e.updatedAt
    }));

    // Construit l'index des (tmdbID+s+e) déjà couverts par watchHistory.
    const covered = new Set(sessions.map(s => this._sessionKey(s.tmdbID, s.seasonNumber, s.episodeNumber)));

    // Ajoute les entrées de continueWatching non couvertes — typiquement
    // les visionnages antérieurs à la mise en place de watchHistory.
    Object.entries(cw).forEach(([tid, e]) => {
      const season = e.seasonNumber != null ? e.seasonNumber : (e.season != null ? e.season : null);
      const episode = e.episodeNumber != null ? e.episodeNumber : (e.episode != null ? e.episode : null);
      const key = this._sessionKey(String(tid), season, episode);
      if (covered.has(key)) return;
      sessions.push({
        sessionId: `legacy_${tid}`,
        tmdbID: String(tid),
        seasonNumber: season,
        episodeNumber: episode,
        progress: Number(e.progress) || 0,
        duration: Number(e.duration) || 0,
        category: e.category || 'movie',
        allWatched: !!e.allWatched,
        updatedAt: e.updatedAt,
        _legacy: true
      });
    });

    return sessions;
  },

  /** Supprime une session du watchHistory. Pour les entrées _legacy, retombe
   *  sur removeContinueWatching. */
  async removeWatchHistorySession(sessionId, tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user || !sessionId) return;
    if (sessionId.startsWith('legacy_')) {
      return this.removeContinueWatching(tmdbID || sessionId.slice(7));
    }
    await BBM.db.collection('users').doc(user.uid).update({
      [`watchHistory.${sessionId}`]: firebase.firestore.FieldValue.delete()
    });
    this.patchUserDoc(d => { if (d.watchHistory) delete d.watchHistory[sessionId]; });
    // Libère le sessionId du cache mémoire pour que la prochaine lecture
    // reparte de zéro
    for (const [k, v] of Object.entries(this._currentSessions)) {
      if (v === sessionId) delete this._currentSessions[k];
    }
  },

  /** Marque une session comme entièrement visionnée. */
  async markWatchHistoryWatched(sessionId, tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user || !sessionId) return;
    if (sessionId.startsWith('legacy_')) {
      const tid = tmdbID || sessionId.slice(7);
      const cw = (this._userDocCache && this._userDocCache.continueWatching && this._userDocCache.continueWatching[tid]) || {};
      const dur = Number(cw.duration) || 1;
      return this.saveContinueWatching(tid, {
        progress: dur,
        duration: dur,
        category: cw.category || 'movie',
        seasonNumber: cw.seasonNumber != null ? cw.seasonNumber : null,
        episodeNumber: cw.episodeNumber != null ? cw.episodeNumber : null,
        allWatched: true
      });
    }
    const sess = (this._userDocCache && this._userDocCache.watchHistory && this._userDocCache.watchHistory[sessionId]) || {};
    const dur = Number(sess.duration) || 1;
    await BBM.db.collection('users').doc(user.uid).update({
      [`watchHistory.${sessionId}.allWatched`]: true,
      [`watchHistory.${sessionId}.progress`]: dur,
      [`watchHistory.${sessionId}.updatedAt`]: firebase.firestore.FieldValue.serverTimestamp()
    });
    this.patchUserDoc(d => {
      if (d.watchHistory && d.watchHistory[sessionId]) {
        d.watchHistory[sessionId].allWatched = true;
        d.watchHistory[sessionId].progress = dur;
      }
    });
  },

  /** Mark a single episode as watched within a series entry. */
  async markEpisodeWatched(tmdbID, season, episode) {
    const user = BBM.Auth.currentUser;
    if (!user || season == null || episode == null) return;
    const tid = String(tmdbID);
    const epKey = `${season}-${episode}`;
    const ref = BBM.db.collection('users').doc(user.uid);
    try {
      await ref.update({
        [`continueWatching.${tid}.watchedEpisodes.${epKey}`]: true
      });
    } catch (e) {
      await ref.set({
        continueWatching: {
          [tid]: { watchedEpisodes: { [epKey]: true } }
        }
      }, { merge: true });
    }
    this.patchUserDoc(d => {
      d.continueWatching = d.continueWatching || {};
      d.continueWatching[tid] = d.continueWatching[tid] || {};
      d.continueWatching[tid].watchedEpisodes = d.continueWatching[tid].watchedEpisodes || {};
      d.continueWatching[tid].watchedEpisodes[epKey] = true;
    });
  },

  /* ----------------------------------------
     Firestore — Downloads library
     ---------------------------------------- */

  /** Store a downloaded item in the user's library (map keyed by tmdb_s_e). */
  async addDownload(entry) {
    const user = BBM.Auth.currentUser;
    if (!user || !entry || !entry.tmdbID) return;
    const key = entry.type === 'series' && entry.season != null && entry.episode != null
      ? `${entry.tmdbID}_${entry.season}_${entry.episode}`
      : String(entry.tmdbID);
    const ref = BBM.db.collection('users').doc(user.uid);
    const data = {
      tmdbID: String(entry.tmdbID),
      title: entry.title || '',
      type: entry.type || 'movie',
      url: entry.url || '',
      posterPath: entry.posterPath || '',
      season: entry.season != null ? entry.season : null,
      episode: entry.episode != null ? entry.episode : null,
      downloadedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      await ref.update({ [`downloads.${key}`]: data });
    } catch (e) {
      await ref.set({ downloads: { [key]: data } }, { merge: true });
    }
    this.patchUserDoc(d => {
      d.downloads = d.downloads || {};
      d.downloads[key] = data;
    });
  },

  async removeDownload(key) {
    const user = BBM.Auth.currentUser;
    if (!user || !key) return;
    try {
      await BBM.db.collection('users').doc(user.uid).update({
        [`downloads.${key}`]: firebase.firestore.FieldValue.delete()
      });
    } catch (e) { /* noop */ }
    this.patchUserDoc(d => {
      if (d.downloads) delete d.downloads[key];
    });
  },

  async getDownloads() {
    const data = await this.getUserDoc();
    return (data && data.downloads) || {};
  },

  /* ----------------------------------------
     Firestore — Presence (heartbeat)
     ---------------------------------------- */

  /** Writes the current user's presence. `watching` may be null when idle. */
  async updatePresence(watching) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    try {
      await BBM.db.collection('users').doc(user.uid).set({
        presence: {
          lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
          watching: watching || null,
          ua: (navigator.userAgent || '').slice(0, 200)
        },
        // Cache display fields on the root doc for admin listing
        displayName: user.displayName || null,
        email: user.email || null
      }, { merge: true });
    } catch (e) { /* noop */ }
  },

  /* ----------------------------------------
     Firestore — Admin: users management
     ---------------------------------------- */

  async getAllUsers() {
    try {
      const snap = await BBM.db.collection('users').get();
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    } catch (e) {
      console.warn('getAllUsers failed (firestore rules?):', e);
      return [];
    }
  },

  async setUserAdmin(uid, admin) {
    if (!uid) return;
    await BBM.db.collection('users').doc(uid).update({ admin: !!admin });
  },

  /* ----------------------------------------
     Firestore — Skip Markers (intro/outro)
     ---------------------------------------- */

  _skipMarkersDocId(tmdbID, type, season, episode) {
    if (type === 'series' && season != null && episode != null) {
      return `${tmdbID}_s${season}_e${episode}`;
    }
    return String(tmdbID);
  },

  async getSkipMarkers(tmdbID, type, season, episode) {
    if (!tmdbID) return null;
    try {
      const docId = this._skipMarkersDocId(tmdbID, type, season, episode);
      const snap = await BBM.db.collection('skipMarkers').doc(docId).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      console.warn('getSkipMarkers failed:', e);
      return null;
    }
  },

  async setSkipMarkers(tmdbID, type, season, episode, markers) {
    const user = BBM.Auth.currentUser;
    if (!user) throw new Error('Connexion requise');
    if (!tmdbID) throw new Error('tmdbID manquant');
    const docId = this._skipMarkersDocId(tmdbID, type, season, episode);
    const payload = {
      tmdbID: Number(tmdbID),
      type: type || 'movie',
      updatedBy: user.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (type === 'series') {
      payload.season = season;
      payload.episode = episode;
    }
    ['recapStart', 'recapEnd', 'introStart', 'introEnd', 'outroStart', 'outroEnd', 'postCreditsAt'].forEach(k => {
      const v = markers[k];
      payload[k] = (v != null && !isNaN(v)) ? Math.round(v * 10) / 10 : null;
    });
    await BBM.db.collection('skipMarkers').doc(docId).set(payload, { merge: true });
  },

  /* ----------------------------------------
     Firestore — Watch Party (synced playback)
     ---------------------------------------- */

  _generateRoomCode() {
    // Unambiguous alphabet (no 0/O/I/1 confusion)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  async createWatchParty({ tmdbID, title, videoURL, type, season, episode }) {
    const user = BBM.Auth.currentUser;
    if (!user) throw new Error('Connexion requise');
    const code = this._generateRoomCode();
    const ref = BBM.db.collection('watchParties').doc(code);
    const name = user.displayName || (user.email || '').split('@')[0] || 'Host';
    await ref.set({
      code,
      hostUid: user.uid,
      hostName: name,
      tmdbID: String(tmdbID),
      title: title || '',
      videoURL: videoURL || '',
      type: type || 'movie',
      season: season != null ? season : null,
      episode: episode != null ? episode : null,
      currentTime: 0,
      isPlaying: false,
      // Lobby flag — guests wait until host clicks "Démarrer"
      started: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      participants: {
        [user.uid]: { name, joinedAt: firebase.firestore.Timestamp.now() }
      }
    });
    return code;
  },

  /** Host clicks "Démarrer" — closes the lobby, guests start watching */
  async startWatchParty(code) {
    if (!code) return;
    try {
      await BBM.db.collection('watchParties').doc(code).update({
        started: true,
        currentTime: 0,
        isPlaying: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { /* noop */ }
  },

  async joinWatchParty(code) {
    const user = BBM.Auth.currentUser;
    if (!user) throw new Error('Connexion requise');
    if (!code) throw new Error('Code manquant');
    code = String(code).toUpperCase();
    const ref = BBM.db.collection('watchParties').doc(code);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Watch party introuvable');
    const data = doc.data();
    const name = user.displayName || (user.email || '').split('@')[0] || 'Invité';
    await ref.update({
      [`participants.${user.uid}`]: { name, joinedAt: firebase.firestore.Timestamp.now() }
    });
    // Always post a "X a rejoint" message. We used to skip it when the
    // user was already in `participants` (typical of a refresh where
    // beforeunload didn't manage to flush the leave write), but that
    // check is unreliable — the "leave" message would show without a
    // matching "join" on the way back. Symmetric is better : every
    // join logs, every leave logs.
    this.sendSystemMessage(code, `${name} a rejoint la session`).catch(() => {});
    return data;
  },

  async updateWatchPartyState(code, state) {
    if (!code) return;
    try {
      await BBM.db.collection('watchParties').doc(code).update({
        ...state,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { /* noop */ }
  },

  /** Subscribe to a watch party. Callback receives the data on each
   *  update, OR `null` when the party is deleted (host or admin ended
   *  it). The caller is expected to handle null by toasting + redirecting. */
  listenWatchParty(code, callback) {
    if (!code) return () => {};
    return BBM.db.collection('watchParties').doc(code).onSnapshot(doc => {
      callback(doc.exists ? doc.data() : null);
    });
  },

  async leaveWatchParty(code, uid) {
    if (!code || !uid) return;
    // Post a "X est parti" system message BEFORE removing the entry, so
    // the message has the correct senderUid/senderName for the rules.
    // We AWAIT both writes so the caller (typically the back-button
    // handler awaiting before navigation) can guarantee they reach the
    // server before the page is destroyed.
    const user = BBM.Auth.currentUser;
    if (user && user.uid === uid) {
      const name = user.displayName || (user.email || '').split('@')[0] || 'Anon';
      try { await this.sendSystemMessage(code, `${name} a quitté la session`); }
      catch (e) { /* noop */ }
    }
    try {
      await BBM.db.collection('watchParties').doc(code).update({
        [`participants.${uid}`]: firebase.firestore.FieldValue.delete()
      });
    } catch (e) { /* noop */ }
  },

  /** Delete sub-collections (messages, reactions) for a watch party.
   *  Firestore doesn't cascade delete, so we batch-delete manually before
   *  removing the parent doc. */
  async _deleteWatchPartySubcollections(code) {
    if (!code) return;
    const ref = BBM.db.collection('watchParties').doc(code);
    for (const subName of ['messages', 'reactions']) {
      try {
        const snap = await ref.collection(subName).get();
        if (snap.empty) continue;
        // Firestore batch is capped at 500 ops — chunk if needed
        let batch = BBM.db.batch();
        let count = 0;
        for (const doc of snap.docs) {
          batch.delete(doc.ref);
          count++;
          if (count >= 450) {
            await batch.commit();
            batch = BBM.db.batch();
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
      } catch (e) { /* noop — best effort */ }
    }
  },

  async endWatchParty(code) {
    if (!code) return;
    // Clean sub-collections first so they don't get orphaned
    await this._deleteWatchPartySubcollections(code);
    try { await BBM.db.collection('watchParties').doc(code).delete(); }
    catch (e) { /* noop */ }
  },

  /** Cleanup pattern (no Cloud Functions cron) :
   *  À chaque démarrage de page, l'utilisateur courant supprime ses
   *  propres parties dont `updatedAt` est vieux de plus de
   *  `staleHours` heures. Toute party active continue de heartbeat
   *  toutes les 8s, donc seules les sessions abandonnées disparaissent.
   *  Retourne le nombre de parties supprimées.
   */
  async cleanupOwnStaleWatchParties({ staleHours = 6 } = {}) {
    const user = BBM.Auth.currentUser;
    if (!user) return 0;
    try {
      const cutoff = Date.now() - staleHours * 3600 * 1000;
      const snap = await BBM.db.collection('watchParties')
        .where('hostUid', '==', user.uid).get();
      const stale = [];
      snap.forEach(doc => {
        const data = doc.data();
        const updatedMs = this._msFromTimestamp(data.updatedAt) || this._msFromTimestamp(data.createdAt);
        if (updatedMs && updatedMs < cutoff) stale.push(doc.id);
      });
      // Delete sub-collections first, then the parent docs
      for (const code of stale) {
        await this._deleteWatchPartySubcollections(code);
        try { await BBM.db.collection('watchParties').doc(code).delete(); }
        catch (e) { /* noop */ }
      }
      return stale.length;
    } catch (e) {
      console.warn('cleanupOwnStaleWatchParties failed:', e);
      return 0;
    }
  },

  /** Admin only — purge ALL parties whose updatedAt > staleHours ago.
   *  Échoue côté Firestore si l'user n'est pas admin (cf. rules).
   *  Retourne le nombre de parties supprimées.
   */
  async purgeStaleWatchParties({ staleHours = 6 } = {}) {
    try {
      const cutoff = Date.now() - staleHours * 3600 * 1000;
      const snap = await BBM.db.collection('watchParties').get();
      const stale = [];
      snap.forEach(doc => {
        const data = doc.data();
        const updatedMs = this._msFromTimestamp(data.updatedAt) || this._msFromTimestamp(data.createdAt);
        if (updatedMs && updatedMs < cutoff) stale.push(doc.id);
      });
      for (const code of stale) {
        await this._deleteWatchPartySubcollections(code);
        try { await BBM.db.collection('watchParties').doc(code).delete(); }
        catch (e) { /* noop */ }
      }
      return stale.length;
    } catch (e) {
      console.warn('purgeStaleWatchParties failed:', e);
      return 0;
    }
  },

  /* --- Chat -------------------------------------------------------- */

  /** Client-side rate-limits to prevent accidental spam. Not a security
   *  mechanism (a determined user can bypass) but enough to avoid
   *  burning Firestore writes when someone holds down a key. */
  _rateLimit: { lastChatAt: 0, lastReactionAt: 0 },

  async sendChatMessage(code, text) {
    const user = BBM.Auth.currentUser;
    if (!user || !code) return;
    const now = Date.now();
    if (now - this._rateLimit.lastChatAt < 500) return; // 1 msg / 500ms max
    this._rateLimit.lastChatAt = now;
    const trimmed = String(text || '').trim().slice(0, 500);
    if (!trimmed) return;
    const name = user.displayName || (user.email || '').split('@')[0] || 'Anon';
    await BBM.db.collection('watchParties').doc(code).collection('messages').add({
      text: trimmed,
      senderUid: user.uid,
      senderName: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  /** System message (join / leave / etc.) — different style in the UI,
   *  no rate-limit since it's automated. */
  async sendSystemMessage(code, text) {
    const user = BBM.Auth.currentUser;
    if (!user || !code || !text) return;
    try {
      await BBM.db.collection('watchParties').doc(code).collection('messages').add({
        text: String(text).slice(0, 200),
        system: true,
        senderUid: user.uid,
        senderName: user.displayName || (user.email || '').split('@')[0] || 'Anon',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { /* best effort */ }
  },

  /** Returns an unsubscribe function. Callback receives the latest 100
      messages in chronological order. */
  listenChatMessages(code, callback) {
    if (!code) return () => {};
    return BBM.db.collection('watchParties').doc(code)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(200)
      .onSnapshot(snap => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(msgs);
      });
  },

  /* --- Reactions (ephemeral floating emojis) ----------------------- */

  async sendReaction(code, emoji) {
    const user = BBM.Auth.currentUser;
    if (!user || !code || !emoji) return;
    const now = Date.now();
    if (now - this._rateLimit.lastReactionAt < 250) return; // 1 reaction / 250ms max
    this._rateLimit.lastReactionAt = now;
    const name = user.displayName || (user.email || '').split('@')[0] || 'Anon';
    await BBM.db.collection('watchParties').doc(code).collection('reactions').add({
      emoji: String(emoji).slice(0, 8),
      senderUid: user.uid,
      senderName: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  /** Listen for reactions. The callback receives docChanges so the player
      can animate only newly-added reactions and ignore the initial dump
      of historical ones. */
  listenReactions(code, onAdded) {
    if (!code) return () => {};
    return BBM.db.collection('watchParties').doc(code)
      .collection('reactions')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(snap => {
        const cutoff = Date.now() - 8000; // ignore reactions older than 8s
        snap.docChanges().forEach(change => {
          if (change.type !== 'added') return;
          const data = change.doc.data();
          const ts = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
          if (ts < cutoff) return; // skip historical dump on first attach
          onAdded({ id: change.doc.id, ...data });
        });
      });
  },

  /** Liste TOUTES les watch parties actives (admin only). Pas de filtre
   *  d'âge, pas d'exclusion. À utiliser dans le panel admin pour purge. */
  async listAllWatchParties() {
    try {
      const snap = await BBM.db.collection('watchParties').get();
      const parties = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data || !data.code) return;
        parties.push({
          code: data.code,
          hostName: data.hostName || 'Hôte',
          hostUid: data.hostUid,
          tmdbID: data.tmdbID,
          title: data.title || '',
          type: data.type || 'movie',
          season: data.season != null ? data.season : null,
          episode: data.episode != null ? data.episode : null,
          isPlaying: !!data.isPlaying,
          started: !!data.started,
          participantsCount: data.participants ? Object.keys(data.participants).length : 0,
          updatedAt: data.updatedAt,
          createdAt: data.createdAt
        });
      });
      parties.sort((a, b) => this._msFromTimestamp(b.updatedAt) - this._msFromTimestamp(a.updatedAt));
      return parties;
    } catch (e) {
      console.warn('listAllWatchParties failed:', e);
      return [];
    }
  },

  /** Liste les watch parties actives (mises à jour < `maxAgeHours`).
   *  Exclut par défaut celles dont l'utilisateur courant est hôte. */
  async listActiveWatchParties({ excludeOwn = true, maxAgeHours = 6 } = {}) {
    try {
      const snap = await BBM.db.collection('watchParties').get();
      const uid = BBM.Auth.currentUser?.uid;
      const cutoff = Date.now() - maxAgeHours * 3600 * 1000;
      const parties = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data || !data.code) return;
        if (excludeOwn && uid && data.hostUid === uid) return;
        const updatedMs = this._msFromTimestamp(data.updatedAt) || this._msFromTimestamp(data.createdAt);
        if (updatedMs && updatedMs < cutoff) return;
        parties.push({
          code: data.code,
          hostName: data.hostName || 'Hôte',
          hostUid: data.hostUid,
          tmdbID: data.tmdbID,
          title: data.title || '',
          type: data.type || 'movie',
          season: data.season != null ? data.season : null,
          episode: data.episode != null ? data.episode : null,
          isPlaying: !!data.isPlaying,
          participantsCount: data.participants ? Object.keys(data.participants).length : 0,
          updatedAt: data.updatedAt,
          createdAt: data.createdAt
        });
      });
      // Tri : les plus récemment actives en premier
      parties.sort((a, b) => this._msFromTimestamp(b.updatedAt) - this._msFromTimestamp(a.updatedAt));
      return parties;
    } catch (e) {
      console.warn('listActiveWatchParties failed:', e);
      return [];
    }
  },

  /** Un-mark a single episode from watched. */
  async unmarkEpisodeWatched(tmdbID, season, episode) {
    const user = BBM.Auth.currentUser;
    if (!user || season == null || episode == null) return;
    const tid = String(tmdbID);
    const epKey = `${season}-${episode}`;
    try {
      await BBM.db.collection('users').doc(user.uid).update({
        [`continueWatching.${tid}.watchedEpisodes.${epKey}`]: firebase.firestore.FieldValue.delete()
      });
    } catch (e) { /* entry may not exist */ }
    this.patchUserDoc(d => {
      const eps = d.continueWatching?.[tid]?.watchedEpisodes;
      if (eps) delete eps[epKey];
    });
  },

  async getContinueWatching() {
    const data = await this.getUserDoc();
    return (data && data.continueWatching) || {};
  },

  async removeContinueWatching(tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    const key = `continueWatching.${String(tmdbID)}`;
    await BBM.db.collection('users').doc(user.uid).update({
      [key]: firebase.firestore.FieldValue.delete()
    });
    this.patchUserDoc(d => {
      if (d.continueWatching) delete d.continueWatching[String(tmdbID)];
    });
  },

  /* ----------------------------------------
     Search
     ---------------------------------------- */

  /** Build search index for fast lookup */
  _buildSearchIndex() {
    this._searchIndex = [];
    const seen = new Set();
    this._items.forEach(item => {
      if (seen.has(item.tmdbID)) return;
      seen.add(item.tmdbID);
      const title = (item.seriesTitle || item.title || '').toLowerCase();
      // Split into searchable tokens (words)
      const tokens = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/);
      this._searchIndex.push({ item, title, tokens, id: String(item.tmdbID) });
    });
  },

  search(query) {
    if (!query || !this._items) return [];
    const q = query.trim();
    const isNumeric = /^\d+$/.test(q);

    if (isNumeric) {
      const entry = (this._searchIndex || []).find(e => e.id === q);
      return entry ? [entry.item] : [];
    }

    // Normalize query: remove accents, lowercase, split into words
    const qNorm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const qTokens = qNorm.split(/\s+/).filter(Boolean);

    if (!this._searchIndex) this._buildSearchIndex();

    // Score each entry: exact start > word start > contains
    const scored = [];
    this._searchIndex.forEach(entry => {
      const titleNorm = entry.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // All query tokens must match somewhere
      const allMatch = qTokens.every(qt => titleNorm.includes(qt));
      if (!allMatch) return;

      let score = 0;
      if (titleNorm.startsWith(qNorm)) score = 3;
      else if (entry.tokens.some(t => t.startsWith(qNorm))) score = 2;
      else score = 1;

      scored.push({ item: entry.item, score });
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.item);
  },

  /* ----------------------------------------
     Firestore — User Ratings (1-5, demi-étoiles)
     ---------------------------------------- */

  async getUserRatings() {
    const data = await this.getUserDoc();
    return (data && data.ratings) || {};
  },

  async setRating(tmdbID, rating) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    const key = `ratings.${String(tmdbID)}`;
    const ref = BBM.db.collection('users').doc(user.uid);
    try {
      await ref.update({ [key]: rating });
    } catch (e) {
      await ref.set({
        ratings: { [String(tmdbID)]: rating }
      }, { merge: true });
    }
    this.patchUserDoc(d => {
      d.ratings = d.ratings || {};
      d.ratings[String(tmdbID)] = rating;
    });
  },

  /** Composite key for episode ratings (stored in the same `ratings` map). */
  episodeRatingKey(tmdbID, season, episode) {
    return `${tmdbID}_s${season}_e${episode}`;
  },

  async setEpisodeRating(tmdbID, season, episode, rating) {
    return this.setRating(this.episodeRatingKey(tmdbID, season, episode), rating);
  },

  async removeEpisodeRating(tmdbID, season, episode) {
    return this.removeRating(this.episodeRatingKey(tmdbID, season, episode));
  },

  async removeRating(tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    const key = `ratings.${String(tmdbID)}`;
    await BBM.db.collection('users').doc(user.uid).update({
      [key]: firebase.firestore.FieldValue.delete()
    });
    this.patchUserDoc(d => {
      if (d.ratings) delete d.ratings[String(tmdbID)];
    });
  },

  /* ----------------------------------------
     Firestore — Content Requests
     ---------------------------------------- */

  async submitRequest(requestData) {
    // requestData: { tmdbID, title, posterPath, type, requestedBy (uid), requestedByName }
    await BBM.db.collection('requests').add({
      ...requestData,
      status: 'pending',       // pending | approved | rejected
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async getMyRequests() {
    const user = BBM.Auth.currentUser;
    if (!user) return [];
    try {
      const snap = await BBM.db.collection('requests')
        .where('requestedBy', '==', user.uid)
        .get();
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side to avoid needing a composite Firestore index
      results.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      return results;
    } catch (e) {
      console.error('getMyRequests error:', e);
      return [];
    }
  },

  /** Vérifie les demandes "pending" de l'utilisateur et auto-approuve
      celles dont le tmdbID est désormais disponible dans le catalogue.
      Retourne la liste des demandes nouvellement approuvées. */
  async checkAndAutoApproveRequests() {
    const user = BBM.Auth.currentUser;
    if (!user) return [];

    const pending = (await this.getMyRequests()).filter(r => r.status === 'pending');
    if (pending.length === 0) return [];

    // Ensemble des tmdbID disponibles (films + séries)
    const availableIDs = new Set();
    (this._items || []).forEach(i => availableIDs.add(String(i.tmdbID)));

    const approved = [];
    for (const req of pending) {
      if (availableIDs.has(String(req.tmdbID))) {
        try {
          await BBM.db.collection('requests').doc(req.id).update({
            status: 'approved',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          approved.push(req);
        } catch (e) {
          console.warn('Auto-approve failed for', req.id, e);
        }
      }
    }
    return approved;
  },

  /* ----------------------------------------
     TMDB — Search (pour les requêtes utilisateur)
     ---------------------------------------- */

  async searchTMDB(query, page = 1) {
    const q = query.trim();

    // Si c'est un ID numérique, chercher directement par TMDB ID
    if (/^\d+$/.test(q)) {
      const id = q;
      const results = [];
      try {
        const [movieRes, tvRes] = await Promise.all([
          fetch(`${BBM.Config.tmdb.baseURL}/movie/${id}?api_key=${BBM.Config.tmdb.apiKey}&language=${BBM.Config.tmdb.language}`),
          fetch(`${BBM.Config.tmdb.baseURL}/tv/${id}?api_key=${BBM.Config.tmdb.apiKey}&language=${BBM.Config.tmdb.language}`)
        ]);
        if (movieRes.ok) {
          const movie = await movieRes.json();
          movie.media_type = 'movie';
          results.push(movie);
        }
        if (tvRes.ok) {
          const tv = await tvRes.json();
          tv.media_type = 'tv';
          results.push(tv);
        }
      } catch (e) { /* ignore */ }
      return results;
    }

    const url = `${BBM.Config.tmdb.baseURL}/search/multi?api_key=${BBM.Config.tmdb.apiKey}&language=${BBM.Config.tmdb.language}&query=${encodeURIComponent(q)}&page=${page}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 10);
    } catch (e) {
      return [];
    }
  },

  /* ----------------------------------------
     TMDB — Collections
     ---------------------------------------- */

  async getCollection(collectionId) {
    const cacheKey = `tmdb_collection_${collectionId}`;
    if (this._cache[cacheKey]) return this._cache[cacheKey];
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed._cachedAt < BBM.Config.cacheTTL) {
          this._cache[cacheKey] = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    const url = `${BBM.Config.tmdb.baseURL}/collection/${collectionId}?api_key=${BBM.Config.tmdb.apiKey}&language=${BBM.Config.tmdb.language}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      data._cachedAt = Date.now();
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      this._cache[cacheKey] = data;
      return data;
    } catch (e) {
      return null;
    }
  },

  /** Extraire les collections uniques depuis le cache TMDB */
  getCollectionsFromCache(tmdbCacheMap) {
    const collections = new Map();
    tmdbCacheMap.forEach((data, tmdbID) => {
      if (data.belongs_to_collection) {
        const col = data.belongs_to_collection;
        if (!collections.has(col.id)) {
          collections.set(col.id, {
            id: col.id,
            name: col.name,
            poster_path: col.poster_path,
            backdrop_path: col.backdrop_path,
            movieIds: []
          });
        }
        collections.get(col.id).movieIds.push(tmdbID);
      }
    });
    return Array.from(collections.values());
  }
};

/* ============================================
   BBM.Notify — Browser notifications + Toast
   Combines the in-app toast with a native Notification API call when
   the user has opted in via Settings and granted browser permission.
   ============================================ */
BBM.Notify = {
  hasPermission() {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  },

  async requestPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
  },

  /** Sync the persisted toggle with the browser's current permission.
   *  If the user revoked the permission externally (cleared site data,
   *  changed browser settings), reset the toggle to false so we don't
   *  silently no-op every notification. Called on page load. */
  syncPermissionState() {
    if (!BBM.Settings) return;
    const enabled = BBM.Settings.get('notifications.browserPush') === true;
    if (!enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      BBM.Settings.set('notifications.browserPush', false);
    }
  },

  /**
   * Show a toast and (optionally) a browser notification.
   * @param {string} title - Headline shown in both surfaces.
   * @param {object} opts - { body, type ('success'|'error'|'info'), duration, icon, tag, browser (force-disable with false) }
   */
  show(title, opts = {}) {
    const type = opts.type || 'success';
    const duration = opts.duration || 3000;
    const fullText = opts.body ? `${title} — ${opts.body}` : title;
    if (BBM.Toast?.show) BBM.Toast.show(fullText, type, duration);
    const allowBrowser = opts.browser !== false
      && BBM.Settings?.get?.('notifications.browserPush') === true
      && this.hasPermission()
      && document.visibilityState !== 'visible'; // don't double-notify when tab is focused
    if (allowBrowser) {
      try {
        const notifOpts = {
          body: opts.body || '',
          tag: opts.tag || undefined,
          silent: false
        };
        // Optional icon — only if the caller passes one. The site uses a
        // data: URL favicon, no static PNG asset, so we don't default.
        if (opts.icon) notifOpts.icon = opts.icon;
        new Notification(title, notifOpts);
      } catch (e) { /* ignore — toast already shown */ }
    }
  }
};

// Re-check the browser notification permission on every page load. If the
// user revoked it externally, reset the toggle so future notifications
// don't silently fail.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BBM.Notify.syncPermissionState());
} else {
  BBM.Notify.syncPermissionState();
}
