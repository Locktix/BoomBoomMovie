/*!
 * BoomBoom — Firebase Module (Auth + Firestore Cloud Sync)
 * Requires Firebase compat SDK v10 loaded via CDN in index.html
 *
 * ─── Firestore Security Rules ─────────────────────────────────────────────
 * Déployer ces règles dans la console Firebase > Firestore > Règles :
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *
 *       // Document racine users/{uid} (nécessaire pour checkIsAdmin)
 *       match /users/{userId} {
 *         allow read, write: if request.auth != null
 *                            && request.auth.uid == userId;
 *       }
 *
 *       // Sous-collections progress / ratings / requests
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null
 *                            && request.auth.uid == userId;
 *       }
 *
 *       // Admin : accès à toutes les demandes via collectionGroup
 *       match /{path=**}/requests/{reqId} {
 *         allow read, write: if request.auth != null
 *           && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.admin == true;
 *       }
 *     }
 *   }
 * ─────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  let _auth = null;
  let _db   = null;
  let _currentUser = null;
  let _initialized = false;

  const _authCallbacks = [];
  let _progressUnsub  = null;
  let _ratingsUnsub   = null;

  // ── Firestore document-ID safety (no slashes or dots) ───────────────────
  function safeId(key) {
    return String(key || '')
      .replace(/\//g, '__S__')
      .replace(/\./g, '__D__')
      .replace(/#/g, '__H__');
  }

  function rawId(id) {
    return String(id || '')
      .replace(/__S__/g, '/')
      .replace(/__D__/g, '.')
      .replace(/__H__/g, '#');
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init(config) {
    if (_initialized) return;
    if (typeof firebase === 'undefined') {
      console.warn('[FB] SDK Firebase non chargé');
      return;
    }
    if (!config || !config.apiKey) {
      console.warn('[FB] Config Firebase manquante');
      return;
    }

    try {
      const existingApp = firebase.apps && firebase.apps.find((a) => a.name === '[DEFAULT]');
      const app = existingApp || firebase.initializeApp(config);
      _auth = firebase.auth(app);
      _db   = firebase.firestore(app);

      // Mode hors-ligne : persistance sur disque
      _db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
          console.warn('[FB] Persistance:', err.code);
        }
      });

      _auth.onAuthStateChanged((user) => {
        _currentUser = user;
        _authCallbacks.forEach((cb) => { try { cb(user); } catch {} });
      });

      _initialized = true;
      console.log('[FB] Initialisé avec succès');
    } catch (err) {
      console.error('[FB] Erreur init:', err);
    }
  }

  function onAuthChange(cb) {
    if (typeof cb !== 'function') return;
    _authCallbacks.push(cb);
    if (_initialized) {
      try { cb(_currentUser); } catch {}
    }
  }

  function isLoggedIn()     { return _currentUser !== null; }
  function getCurrentUser() { return _currentUser; }

  // ── Auth : Inscription / Connexion / Déconnexion / Suppression ───────────
  async function signUp(email, password) {
    if (!_auth) throw new Error('Firebase non initialisé');
    const cred = await _auth.createUserWithEmailAndPassword(email, password);
    return cred.user;
  }

  async function signIn(email, password) {
    if (!_auth) throw new Error('Firebase non initialisé');
    const cred = await _auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  async function signOut() {
    teardownRealtimeSync();
    if (_auth) await _auth.signOut();
  }

  /**
   * Suppression du compte : re-authentifie puis efface toutes les données
   * Firestore avant de supprimer l'utilisateur dans Firebase Auth.
   */
  async function deleteAccount(password) {
    if (!_auth || !_currentUser) throw new Error('Non connecté');
    const credential = firebase.auth.EmailAuthProvider.credential(
      _currentUser.email,
      password
    );
    await _currentUser.reauthenticateWithCredential(credential);
    const uid = _currentUser.uid;
    teardownRealtimeSync();
    await _deleteAllUserData(uid);
    await _currentUser.delete();
  }

  async function _deleteAllUserData(uid) {
    if (!_db) return;
    const userRef = _db.collection('users').doc(uid);
    for (const sub of ['progress', 'ratings', 'requests']) {
      const snap = await userRef.collection(sub).get();
      if (snap.empty) continue;
      const batch = _db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await userRef.delete().catch(() => {});
  }

  // ── Référence utilisateur ────────────────────────────────────────────────
  function _userRef() {
    if (!_db || !_currentUser) return null;
    return _db.collection('users').doc(_currentUser.uid);
  }

  // ── Avatar ───────────────────────────────────────────────────────────────
  async function saveAvatar(avatarId) {
    const ref = _userRef();
    if (!ref) return;
    await ref.set({ avatarId: String(avatarId || '') }, { merge: true });
  }

  async function loadAvatar() {
    const ref = _userRef();
    if (!ref) return null;
    try {
      const snap = await ref.get();
      return snap.exists ? (snap.data()?.avatarId || null) : null;
    } catch { return null; }
  }

  // ── Progression (Watch Progress) ─────────────────────────────────────────
  async function saveProgress(progressKey, data) {
    const ref = _userRef();
    if (!ref || !progressKey) return;
    try {
      await ref.collection('progress').doc(safeId(progressKey)).set(
        { ...data, _syncedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch {}
  }

  async function deleteProgress(progressKey) {
    const ref = _userRef();
    if (!ref || !progressKey) return;
    try {
      await ref.collection('progress').doc(safeId(progressKey)).delete();
    } catch {}
  }

  async function loadAllProgress() {
    const ref = _userRef();
    if (!ref) return {};
    try {
      const snap = await ref.collection('progress').get();
      const out = {};
      snap.docs.forEach((d) => { out[rawId(d.id)] = d.data(); });
      return out;
    } catch { return {}; }
  }

  // ── Notes (Ratings) ───────────────────────────────────────────────────────
  async function saveRating(ratingKey, data) {
    const ref = _userRef();
    if (!ref || !ratingKey) return;
    try {
      await ref.collection('ratings').doc(safeId(ratingKey)).set(
        { ...data, _syncedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch {}
  }

  async function deleteRatingCloud(ratingKey) {
    const ref = _userRef();
    if (!ref || !ratingKey) return;
    try {
      await ref.collection('ratings').doc(safeId(ratingKey)).delete();
    } catch {}
  }

  async function loadAllRatings() {
    const ref = _userRef();
    if (!ref) return {};
    try {
      const snap = await ref.collection('ratings').get();
      const out = {};
      snap.docs.forEach((d) => { out[rawId(d.id)] = d.data(); });
      return out;
    } catch { return {}; }
  }

  // ── Demandes de titres ────────────────────────────────────────────────────
  async function checkAlreadyRequested(tmdbId, mediaType) {
    const ref = _userRef();
    if (!ref) return false;
    try {
      const snap = await ref.collection('requests')
        .where('tmdbId', '==', Number(tmdbId))
        .where('mediaType', '==', String(mediaType))
        .limit(1).get();
      return !snap.empty;
    } catch { return false; }
  }

  async function submitRequest(item) {
    const ref = _userRef();
    if (!ref) throw new Error('Non connecté');

    const tmdbId    = Number(item.tmdbId) || 0;
    const mediaType = String(item.mediaType || 'movie');

    if (tmdbId > 0 && await checkAlreadyRequested(tmdbId, mediaType)) {
      throw new Error('Tu as déjà envoyé une demande pour ce titre.');
    }

    const docRef = tmdbId > 0
      ? ref.collection('requests').doc(`${mediaType}:${tmdbId}`)
      : ref.collection('requests').doc();

    const data = {
      tmdbId,
      mediaType,
      title:              String(item.title    || ''),
      poster:             String(item.poster   || ''),
      overview:           String(item.overview || ''),
      year:               Number(item.year)    || 0,
      note:               String(item.note     || ''),
      requestedByEmail:   _auth?.currentUser?.email || '',
      status:             'pending',
      createdAt:          firebase.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(data);
    return { id: docRef.id, ...data };
  }

  async function cancelRequest(docId) {
    const ref = _userRef();
    if (!ref || !docId) return;
    const doc = await ref.collection('requests').doc(docId).get();
    if (!doc.exists) return;
    if (doc.data().status !== 'pending') throw new Error('Impossible d\'annuler une demande déjà traitée.');
    await ref.collection('requests').doc(docId).delete();
  }

  async function getUserRequests() {
    const ref = _userRef();
    if (!ref) return [];
    try {
      const snap = await ref.collection('requests').orderBy('createdAt', 'desc').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  }

  function onRequestsChange(callback) {
    const ref = _userRef();
    if (!ref || typeof callback !== 'function') return () => {};
    try {
      return ref.collection('requests').orderBy('createdAt', 'desc')
        .onSnapshot(
          (snap) => { callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
          () => { callback([]); }
        );
    } catch { return () => {}; }
  }

  // ── Admin ───────────────────────────────────────────────────────────────────────
  async function checkIsAdmin() {
    const ref = _userRef();
    if (!ref) return false;
    try {
      const doc = await ref.get();
      return doc.exists && doc.data()?.admin === true;
    } catch { return false; }
  }

  async function getAllRequests() {
    if (!_db) return [];
    try {
      const snap = await _db.collectionGroup('requests').get();
      const items = snap.docs.map((d) => ({
        id:     d.id,
        userId: d.ref.parent.parent.id,
        ...d.data(),
      }));
      items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      return items;
    } catch { return []; }
  }

  function onAllRequestsChange(callback) {
    if (!_db || typeof callback !== 'function') return () => {};
    try {
      return _db.collectionGroup('requests')
        .onSnapshot(
          (snap) => {
            const items = snap.docs.map((d) => ({
              id:     d.id,
              userId: d.ref.parent.parent.id,
              ...d.data(),
            }));
            items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            callback(items);
          },
          (err) => { console.warn('[FB] onAllRequestsChange:', err.message); }
        );
    } catch { return () => {}; }
  }

  async function updateRequestStatus(userId, docId, status) {
    if (!_db || !userId || !docId) return;
    await _db
      .collection('users').doc(userId)
      .collection('requests').doc(docId)
      .update({
        status,
        updatedByAdmin: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
  }

  // ── Migration localStorage → Firestore (exécutée une seule fois) ─────────
  async function migrateFromLocalStorage(progressStore, ratingsStore) {
    const ref = _userRef();
    if (!ref) return;

    const userDoc = await ref.get().catch(() => null);
    if (userDoc && userDoc.exists && userDoc.data()?.migrationDone) {
      console.log('[FB] Migration déjà effectuée, ignorée.');
      return;
    }

    const progressEntries = Object.entries(progressStore || {});
    const ratingEntries   = Object.entries(ratingsStore  || {});

    if (progressEntries.length > 0) {
      const batch = _db.batch();
      progressEntries.forEach(([key, val]) => {
        batch.set(ref.collection('progress').doc(safeId(key)), val, { merge: true });
      });
      await batch.commit();
    }

    if (ratingEntries.length > 0) {
      const batch = _db.batch();
      ratingEntries.forEach(([key, val]) => {
        batch.set(ref.collection('ratings').doc(safeId(key)), val, { merge: true });
      });
      await batch.commit();
    }

    await ref.set(
      { migrationDone: true, migratedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log(`[FB] Migration : ${progressEntries.length} progressions + ${ratingEntries.length} notes`);
  }

  // ── Synchronisation temps réel ───────────────────────────────────────────
  function setupRealtimeSync(onProgressUpdate, onRatingsUpdate) {
    teardownRealtimeSync();
    const ref = _userRef();
    if (!ref) return;

    if (typeof onProgressUpdate === 'function') {
      _progressUnsub = ref.collection('progress').onSnapshot((snap) => {
        const store = {};
        snap.docs.forEach((d) => { store[rawId(d.id)] = d.data(); });
        onProgressUpdate(store);
      }, () => {});
    }

    if (typeof onRatingsUpdate === 'function') {
      _ratingsUnsub = ref.collection('ratings').onSnapshot((snap) => {
        const store = {};
        snap.docs.forEach((d) => { store[rawId(d.id)] = d.data(); });
        onRatingsUpdate(store);
      }, () => {});
    }
  }

  function teardownRealtimeSync() {
    if (_progressUnsub) { _progressUnsub(); _progressUnsub = null; }
    if (_ratingsUnsub)  { _ratingsUnsub();  _ratingsUnsub  = null; }
  }

  // ── Recherche TMDB ────────────────────────────────────────────────────────
  async function searchTmdbByQuery(query, bearerToken, apiKey, lang) {
    if (!query) return [];
    const language = lang || 'fr-FR';
    const params = new URLSearchParams({ query: String(query), language, page: '1' });
    if (!bearerToken && apiKey) params.set('api_key', apiKey);
    const headers = {};
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return (Array.isArray(data.results) ? data.results : [])
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .slice(0, 5);
    } catch { return []; }
  }

  async function searchTmdbById(tmdbId, mediaType, bearerToken, apiKey, lang) {
    if (!tmdbId) return null;
    const language = lang || 'fr-FR';
    const base = mediaType === 'tv'
      ? 'https://api.themoviedb.org/3/tv'
      : 'https://api.themoviedb.org/3/movie';
    const params = new URLSearchParams({ language });
    if (!bearerToken && apiKey) params.set('api_key', apiKey);
    const headers = {};
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    try {
      const res = await fetch(`${base}/${tmdbId}?${params}`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      data.media_type = mediaType;
      return data;
    } catch { return null; }
  }

  // ── API publique ──────────────────────────────────────────────────────────
  window.FB = {
    init,
    onAuthChange,
    isLoggedIn,
    getCurrentUser,
    signUp,
    signIn,
    signOut,
    deleteAccount,
    saveProgress,
    deleteProgress,
    loadAllProgress,
    saveRating,
    deleteRatingCloud,
    loadAllRatings,
    checkAlreadyRequested,
    submitRequest,
    cancelRequest,
    getUserRequests,
    onRequestsChange,
    checkIsAdmin,
    getAllRequests,
    onAllRequestsChange,
    updateRequestStatus,
    migrateFromLocalStorage,
    setupRealtimeSync,
    teardownRealtimeSync,
    searchTmdbByQuery,
    searchTmdbById,
    saveAvatar,
    loadAvatar,
  };
})();
