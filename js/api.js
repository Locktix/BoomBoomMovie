/* ============================================
   BoomBoomMovie — API & Data Layer
   ============================================ */

BBM.API = {
  _cache: {},
  _items: null,
  _movies: null,
  _seriesMap: null,

  /* ----------------------------------------
     Worker API — Fetch all items
     ---------------------------------------- */
  async fetchAllItems() {
    if (this._items) return this._items;

    const res = await fetch(BBM.Config.workerAPI);
    if (!res.ok) throw new Error('Erreur API Worker');
    const data = await res.json();

    this._items = data;
    this._processItems();
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

    // Fetch from TMDB
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const url = `${BBM.Config.tmdb.baseURL}/${endpoint}/${tmdbID}?api_key=${BBM.Config.tmdb.apiKey}&language=${BBM.Config.tmdb.language}&append_to_response=credits,videos`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      data._cachedAt = Date.now();

      // Save to localStorage
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) { /* localStorage full */ }

      this._cache[cacheKey] = data;
      return data;
    } catch (e) {
      console.error(`TMDB fetch error for ${tmdbID}:`, e);
      return null;
    }
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

  /** Batch fetch TMDB data avec concurrency limit */
  async batchFetchTMDB(items, concurrency = 6) {
    const results = new Map();
    const queue = [...items];

    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        const type = item.category === 'movie' ? 'movie' : 'tv';
        const data = await BBM.API.getTMDBData(item.tmdbID, type);
        if (data) results.set(item.tmdbID, data);
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

  /* ----------------------------------------
     Firestore — My List
     ---------------------------------------- */

  async getMyList() {
    const user = BBM.Auth.currentUser;
    if (!user) return [];
    try {
      const doc = await BBM.db.collection('users').doc(user.uid).get();
      return doc.exists ? (doc.data().myList || []) : [];
    } catch (e) {
      console.error('getMyList error:', e);
      return [];
    }
  },

  async addToMyList(tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    await BBM.db.collection('users').doc(user.uid).update({
      myList: firebase.firestore.FieldValue.arrayUnion(String(tmdbID))
    });
  },

  async removeFromMyList(tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    await BBM.db.collection('users').doc(user.uid).update({
      myList: firebase.firestore.FieldValue.arrayRemove(String(tmdbID))
    });
  },

  async isInMyList(tmdbID) {
    const list = await this.getMyList();
    return list.includes(String(tmdbID));
  },

  /* ----------------------------------------
     Firestore — Continue Watching
     ---------------------------------------- */

  async saveContinueWatching(tmdbID, data) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    const key = `continueWatching.${String(tmdbID)}`;
    const ref = BBM.db.collection('users').doc(user.uid);
    try {
      await ref.update({
        [key]: {
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      });
    } catch (e) {
      // Document might not exist yet, use set with merge
      await ref.set({
        continueWatching: {
          [String(tmdbID)]: {
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }
        }
      }, { merge: true });
    }
  },

  async getContinueWatching() {
    const user = BBM.Auth.currentUser;
    if (!user) return {};
    try {
      const doc = await BBM.db.collection('users').doc(user.uid).get();
      return doc.exists ? (doc.data().continueWatching || {}) : {};
    } catch (e) {
      return {};
    }
  },

  async removeContinueWatching(tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    const key = `continueWatching.${String(tmdbID)}`;
    await BBM.db.collection('users').doc(user.uid).update({
      [key]: firebase.firestore.FieldValue.delete()
    });
  },

  /* ----------------------------------------
     Search
     ---------------------------------------- */

  search(query) {
    if (!query || !this._items) return [];
    const q = query.trim();
    const results = new Map();
    const isNumeric = /^\d+$/.test(q);

    this._items.forEach(item => {
      if (isNumeric) {
        if (String(item.tmdbID) === q && !results.has(item.tmdbID)) {
          results.set(item.tmdbID, item);
        }
      } else {
        const title = (item.seriesTitle || item.title || '').toLowerCase();
        if (title.includes(q.toLowerCase()) && !results.has(item.tmdbID)) {
          results.set(item.tmdbID, item);
        }
      }
    });

    return Array.from(results.values());
  },

  /* ----------------------------------------
     Firestore — User Ratings (1-5, demi-étoiles)
     ---------------------------------------- */

  async getUserRatings() {
    const user = BBM.Auth.currentUser;
    if (!user) return {};
    try {
      const doc = await BBM.db.collection('users').doc(user.uid).get();
      return doc.exists ? (doc.data().ratings || {}) : {};
    } catch (e) {
      return {};
    }
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
  },

  async removeRating(tmdbID) {
    const user = BBM.Auth.currentUser;
    if (!user) return;
    const key = `ratings.${String(tmdbID)}`;
    await BBM.db.collection('users').doc(user.uid).update({
      [key]: firebase.firestore.FieldValue.delete()
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
