/* ============================================
   BoomBoomMovie — Admin Panel (sidebar layout)
   ============================================ */

(function () {
  'use strict';

  const db = BBM.db;
  let allRequests = [];
  let allUsers = [];
  let currentFilter = 'all';
  let currentUserFilter = 'all';
  let currentUserSearch = '';
  let activeSection = 'dashboard';

  /* ---------- Auth & Admin Check ---------- */

  firebase.auth().onAuthStateChanged(async (user) => {
    const loading = document.getElementById('loading-screen');
    const denied = document.getElementById('admin-denied');
    const page = document.getElementById('admin-page');

    if (!user) { window.location.href = 'index.html'; return; }

    BBM.Auth.currentUser = user;
    const isAdmin = await BBM.Auth.isAdmin();
    if (!isAdmin) {
      loading.style.display = 'none';
      denied.style.display = 'flex';
      return;
    }

    loading.style.display = 'none';
    page.style.display = '';

    // Sidebar user info
    const name = user.displayName || user.email.split('@')[0] || 'Admin';
    document.getElementById('admin-sidebar-user-name').textContent = name;
    document.getElementById('admin-sidebar-avatar').textContent = (name[0] || '?').toUpperCase();

    setupSidebar();
    setupFilters();
    setupUserFilters();
    setupSystem();

    await Promise.all([loadRequests(), loadUsers()]);
    loadDashboard();
    loadCatalog();
    loadSystemInfo();

    // Realtime listener sur la collection users — pas besoin de polling,
    // on est notifié dès qu'un user pulse son lastSeen ou change watching
    if (BBM.API.listenAllUsers) {
      BBM.API.listenAllUsers((users) => {
        allUsers = users;
        renderUsers();
        updateSidebarCounts();
        // Re-render aussi le dashboard online list
        try { renderDashboardOnline(); } catch (e) {}
      });
    }
    // Re-render toutes les 15s même sans changement Firestore : les
    // labels relatifs ("il y a X min") doivent se rafraîchir, et un
    // user qui n'a plus pulsé doit basculer en "Inactif" / "Offline"
    setInterval(() => { renderUsers(); updateSidebarCounts(); }, 15000);
  });

  /* ---------- Sidebar navigation ---------- */

  function setupSidebar() {
    document.querySelectorAll('[data-section]').forEach(btn => {
      btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });
    // Mobile burger
    const burger = document.getElementById('admin-burger');
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    const closeSidebar = () => sidebar.classList.remove('open');
    burger?.addEventListener('click', () => sidebar.classList.toggle('open'));
    backdrop?.addEventListener('click', closeSidebar);
    document.querySelectorAll('[data-section]').forEach(b => b.addEventListener('click', closeSidebar));
  }

  function switchSection(section) {
    activeSection = section;
    document.querySelectorAll('[data-section]').forEach(b => {
      b.classList.toggle('active', b.dataset.section === section);
    });
    document.querySelectorAll('.admin-section').forEach(s => {
      s.hidden = s.id !== `section-${section}`;
    });
    // Section-specific re-render when switching to
    if (section === 'users') renderUsers();
    if (section === 'parties') loadWatchParties();
  }

  /* ---------- Watch Parties (admin) ---------- */

  async function loadWatchParties() {
    const list = document.getElementById('admin-parties-list');
    const label = document.getElementById('parties-count-label');
    const badge = document.getElementById('sidebar-parties-count');
    if (!list) return;
    list.innerHTML = '<div class="admin-empty-state">Chargement…</div>';
    let parties = [];
    try {
      parties = await BBM.API.listAllWatchParties();
    } catch (e) {
      list.innerHTML = '<p class="admin-empty">Erreur de chargement.</p>';
      return;
    }
    if (label) label.textContent = `${parties.length} session${parties.length > 1 ? 's' : ''}`;
    if (badge) badge.textContent = String(parties.length);
    if (parties.length === 0) {
      list.innerHTML = '<div class="admin-empty-state">Aucune Watch Party active actuellement.</div>';
      return;
    }
    const safe = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const fmtDate = (ts) => {
      if (!ts) return '—';
      try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      } catch (e) { return '—'; }
    };
    list.innerHTML = parties.map(p => {
      const epLabel = p.type === 'series' && p.season != null && p.episode != null
        ? ` · S${String(p.season).padStart(2, '0')}E${String(p.episode).padStart(2, '0')}` : '';
      const stateChip = p.started
        ? '<span class="admin-party-chip is-live">EN COURS</span>'
        : '<span class="admin-party-chip is-lobby">LOBBY</span>';
      return `
        <div class="admin-party-row" data-code="${p.code}">
          <div class="admin-party-main">
            <div class="admin-party-code">${p.code}</div>
            <div class="admin-party-info">
              <div class="admin-party-title">${safe(p.title)}${epLabel}</div>
              <div class="admin-party-meta">
                ${stateChip}
                <span>👤 ${safe(p.hostName)}</span>
                <span>${p.participantsCount} participant${p.participantsCount > 1 ? 's' : ''}</span>
                <span>Mis à jour ${fmtDate(p.updatedAt)}</span>
              </div>
            </div>
          </div>
          <button class="admin-party-kill" data-code="${p.code}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Terminer
          </button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.admin-party-kill').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        if (!confirm(`Terminer la Watch Party ${code} ? Tous les invités seront éjectés.`)) return;
        btn.disabled = true;
        try {
          await BBM.API.endWatchParty(code);
          BBM.Toast?.show('Watch Party terminée', 'success');
          await loadWatchParties();
        } catch (e) {
          BBM.Toast?.show('Erreur lors de la suppression', 'error');
          btn.disabled = false;
        }
      });
    });
  }

  // Refresh + purge buttons
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#parties-refresh')) {
      loadWatchParties();
      return;
    }
    const purgeBtn = e.target.closest('#parties-purge');
    if (purgeBtn) {
      if (!confirm('Supprimer toutes les Watch Parties inactives depuis plus de 6 heures ?')) return;
      purgeBtn.disabled = true;
      const removed = await BBM.API.purgeStaleWatchParties({ staleHours: 6 });
      BBM.Toast?.show(`${removed} session${removed > 1 ? 's' : ''} purgée${removed > 1 ? 's' : ''}`, 'success');
      purgeBtn.disabled = false;
      await loadWatchParties();
    }
  });

  /* ---------- Requests ---------- */

  async function loadRequests() {
    try {
      const snap = await db.collection('requests').orderBy('createdAt', 'desc').get();
      allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateRequestStats();
      renderRequests();
      updateSidebarCounts();
    } catch (err) {
      console.error('Load requests error:', err);
      document.getElementById('admin-requests').innerHTML =
        '<p class="admin-empty">Erreur de chargement. Vérifie les règles Firestore.</p>';
    }
  }

  function updateRequestStats() {
    const total = allRequests.length;
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;
    set('stat-total', total);
    set('stat-pending', pending);
    set('stat-approved', approved);
    set('stat-rejected', rejected);
  }

  function renderRequests() {
    const container = document.getElementById('admin-requests');
    const filtered = currentFilter === 'all'
      ? allRequests
      : allRequests.filter(r => r.status === currentFilter);

    if (filtered.length === 0) {
      container.innerHTML = '<p class="admin-empty">Aucune demande à afficher.</p>';
      return;
    }

    container.innerHTML = filtered.map(req => {
      const date = req.createdAt?.toDate
        ? req.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
      const posterURL = req.posterPath ? `${BBM.Config.tmdb.imageBase}/w154${req.posterPath}` : '';
      const typeLabel = req.type === 'movie' ? 'Film' : 'Série';
      const statusClass = req.status || 'pending';
      const statusLabel = statusClass === 'pending' ? 'En attente'
        : statusClass === 'approved' ? 'Approuvé'
        : 'Refusé';
      const actions = req.status === 'pending' ? `
        <div class="admin-actions">
          <button class="admin-btn approve" data-action="approved" data-id="${req.id}">✓ Approuver</button>
          <button class="admin-btn reject" data-action="rejected" data-id="${req.id}">✕ Refuser</button>
        </div>` : `
        <div class="admin-actions">
          <button class="admin-btn reset" data-action="pending" data-id="${req.id}">↺ Réinitialiser</button>
        </div>`;

      return `
        <div class="admin-request-card ${statusClass}">
          <div class="admin-request-poster">
            ${posterURL ? `<img src="${posterURL}" alt="${escapeHtml(req.title)}" loading="lazy">` : '<div class="admin-no-poster">?</div>'}
          </div>
          <div class="admin-request-info">
            <h3>${escapeHtml(req.title || 'Sans titre')}</h3>
            <div class="admin-request-meta">
              <span class="admin-badge type">${typeLabel}</span>
              <span class="admin-badge status ${statusClass}">${statusLabel}</span>
              <span class="admin-meta-text">TMDB #${req.tmdbID || '?'}</span>
            </div>
            <p class="admin-request-by">Demandé par <strong>${escapeHtml(req.requestedByName || 'Inconnu')}</strong> le ${date}</p>
          </div>
          ${actions}
        </div>`;
    }).join('');
  }

  document.getElementById('admin-requests')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const status = btn.dataset.action;
    btn.disabled = true;
    try {
      await db.collection('requests').doc(id).update({
        status, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const req = allRequests.find(r => r.id === id);
      if (req) req.status = status;
      updateRequestStats(); renderRequests(); updateSidebarCounts();
      const labels = { approved: 'Demande approuvée', rejected: 'Demande refusée', pending: 'Remise en attente' };
      BBM.Toast.show(labels[status] || 'Mis à jour', status === 'rejected' ? 'error' : 'success');
    } catch (err) {
      console.error('Admin action error:', err);
      btn.disabled = false;
      BBM.Toast.show('Erreur', 'error');
    }
  });

  function setupFilters() {
    document.querySelectorAll('#section-requests .admin-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#section-requests .admin-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderRequests();
      });
    });
  }

  /* ---------- Users ---------- */

  async function loadUsers() {
    try {
      allUsers = await BBM.API.getAllUsers();
      renderUsers();
      updateSidebarCounts();
    } catch (err) {
      console.error('Load users error:', err);
      document.getElementById('admin-users-table').innerHTML =
        '<p class="admin-empty">Impossible de charger les utilisateurs. Vérifie les règles Firestore.</p>';
    }
  }

  function isOnline(user) {
    const ts = user?.presence?.lastSeen;
    if (!ts) return false;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return (Date.now() - date.getTime()) < 120000; // <2min
  }

  function isAway(user) {
    const ts = user?.presence?.lastSeen;
    if (!ts) return false;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const delta = Date.now() - date.getTime();
    return delta >= 120000 && delta < 600000; // 2–10min
  }

  function presenceLabel(user) {
    const ts = user?.presence?.lastSeen;
    if (!ts) return 'Jamais connecté';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const delta = Date.now() - date.getTime();
    if (delta < 120000) return 'En ligne';
    if (delta < 600000) return 'Inactif';
    if (delta < 3600000) return 'Il y a ' + Math.floor(delta / 60000) + ' min';
    if (delta < 86400000) return 'Il y a ' + Math.floor(delta / 3600000) + ' h';
    return 'Il y a ' + Math.floor(delta / 86400000) + ' j';
  }

  function watchingText(user) {
    const w = user?.presence?.watching;
    if (!w) return '';
    const epCode = (w.type === 'series' && w.season != null && w.episode != null)
      ? `S${String(w.season).padStart(2,'0')}E${String(w.episode).padStart(2,'0')}`
      : '';
    const title = w.title || 'Contenu';
    return epCode ? `${title} · ${epCode}` : title;
  }

  function lastWatchedText(user) {
    const lw = user?.lastWatched;
    if (!lw || !lw.title) return '';
    const epCode = (lw.type === 'series' && lw.season != null && lw.episode != null)
      ? `S${String(lw.season).padStart(2,'0')}E${String(lw.episode).padStart(2,'0')}`
      : '';
    const title = lw.title;
    return epCode ? `${title} · ${epCode}` : title;
  }

  function lastWatchedRelative(user) {
    const ts = user?.lastWatched?.at;
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const delta = Date.now() - date.getTime();
    if (delta < 3600000) return 'il y a ' + Math.max(1, Math.floor(delta / 60000)) + ' min';
    if (delta < 86400000) return 'il y a ' + Math.floor(delta / 3600000) + ' h';
    return 'il y a ' + Math.floor(delta / 86400000) + ' j';
  }

  function renderUsers() {
    const container = document.getElementById('admin-users-table');
    if (!container) return;
    const search = currentUserSearch.toLowerCase();
    const filtered = allUsers
      .filter(u => {
        if (currentUserFilter === 'online') return isOnline(u);
        if (currentUserFilter === 'watching') return !!u?.presence?.watching;
        if (currentUserFilter === 'admin') return !!u.admin;
        return true;
      })
      .filter(u => {
        if (!search) return true;
        return (u.email || '').toLowerCase().includes(search)
          || (u.displayName || '').toLowerCase().includes(search);
      })
      .sort((a, b) => {
        // Online first, then by most recent presence
        const ao = isOnline(a) ? 0 : 1;
        const bo = isOnline(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const at = a?.presence?.lastSeen?.toMillis?.() || 0;
        const bt = b?.presence?.lastSeen?.toMillis?.() || 0;
        return bt - at;
      });

    if (filtered.length === 0) {
      container.innerHTML = '<p class="admin-empty">Aucun utilisateur correspondant.</p>';
      return;
    }

    container.innerHTML = `
      <div class="admin-users-head">
        <div>Utilisateur</div>
        <div>Statut</div>
        <div>Regarde</div>
        <div>Dernier vu</div>
        <div>Rôle</div>
        <div></div>
      </div>
      ${filtered.map(u => {
        const name = u.displayName || (u.email || '').split('@')[0] || 'Utilisateur';
        const initial = (name[0] || '?').toUpperCase();
        const online = isOnline(u);
        const away = !online && isAway(u);
        const statusCls = online ? 'online' : away ? 'away' : 'offline';
        const watching = watchingText(u);
        const isPaused = !!u?.presence?.watching?.paused;
        const lastTitle = lastWatchedText(u);
        const lastRel = lastWatchedRelative(u);
        return `
          <div class="admin-user-row">
            <div class="admin-user-identity">
              <div class="admin-user-avatar">
                <span>${initial}</span>
                <span class="admin-user-dot ${statusCls}"></span>
              </div>
              <div class="admin-user-meta">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(u.email || '—')}</span>
              </div>
            </div>
            <div class="admin-user-status">
              <span class="admin-user-dot ${statusCls}"></span>
              <span>${presenceLabel(u)}</span>
            </div>
            <div class="admin-user-watching">
              ${watching
                ? `<span class="admin-watching-icon ${isPaused ? 'paused' : 'playing'}" title="${isPaused ? 'En pause' : 'En lecture'}">${isPaused ? '⏸' : '▶'}</span><span class="admin-watching-text" title="${escapeHtml(watching)}">${escapeHtml(watching)}</span>`
                : '<span class="admin-muted">—</span>'}
            </div>
            <div class="admin-user-lastwatched" title="${escapeHtml(lastTitle || '')}">
              ${lastTitle
                ? `<span class="admin-lastwatched-text">${escapeHtml(lastTitle)}</span><span class="admin-muted admin-lastwatched-rel">${lastRel}</span>`
                : '<span class="admin-muted">—</span>'}
            </div>
            <div class="admin-user-role">
              ${u.admin ? '<span class="admin-role-badge admin">Admin</span>' : '<span class="admin-role-badge">User</span>'}
            </div>
            <div class="admin-user-actions">
              <button class="admin-btn ${u.admin ? 'reset' : 'approve'}" data-user-action="${u.admin ? 'demote' : 'promote'}" data-uid="${u.uid}" title="${u.admin ? 'Retirer les droits admin' : 'Promouvoir admin'}">
                ${u.admin ? 'Rétrograder' : 'Promouvoir'}
              </button>
            </div>
          </div>`;
      }).join('')}`;
  }

  document.getElementById('admin-users-table')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-user-action]');
    if (!btn) return;
    const uid = btn.dataset.uid;
    const action = btn.dataset.userAction;
    const promote = action === 'promote';
    if (uid === BBM.Auth.currentUser?.uid && !promote) {
      if (!confirm('Retirer tes propres droits admin ? Tu ne pourras plus revenir ici.')) return;
    }
    btn.disabled = true;
    try {
      await BBM.API.setUserAdmin(uid, promote);
      const u = allUsers.find(x => x.uid === uid);
      if (u) u.admin = promote;
      renderUsers();
      BBM.Toast.show(promote ? 'Utilisateur promu admin' : 'Rétrogradé en user', 'success');
    } catch (err) {
      btn.disabled = false;
      BBM.Toast.show('Erreur', 'error');
    }
  });

  function setupUserFilters() {
    document.querySelectorAll('[data-user-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-user-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentUserFilter = btn.dataset.userFilter;
        renderUsers();
      });
    });
    const input = document.getElementById('users-search');
    if (input) {
      let t;
      input.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { currentUserSearch = input.value.trim(); renderUsers(); }, 150);
      });
    }
  }

  /* ---------- Dashboard (overview) ---------- */

  async function loadDashboard() {
    try {
      const allItems = await BBM.API.fetchAllItems();
      const movies = BBM.API.getMovies();
      set('gstat-catalog', new Set(allItems.map(i => i.tmdbID)).size);
      set('gstat-movies', movies.length);
      set('gstat-series', BBM.API.getSeriesMap().size);
      set('gstat-requesters', new Set(allRequests.map(r => r.requestedBy).filter(Boolean)).size);

      // Top requested (exclure approuvées)
      const counts = {};
      allRequests.filter(r => r.status !== 'approved').forEach(r => {
        const k = r.tmdbID || '?';
        counts[k] = counts[k] || { title: r.title || `#${k}`, poster: r.posterPath, count: 0 };
        counts[k].count++;
      });
      const top = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
      const topEl = document.getElementById('admin-top-requested');
      if (topEl) {
        topEl.innerHTML = top.length === 0
          ? '<p class="admin-muted" style="padding:16px">Aucune demande en attente.</p>'
          : top.map(t => {
              const poster = t.poster ? `${BBM.Config.tmdb.imageBase}/w92${t.poster}` : '';
              return `<div class="admin-top-item">
                ${poster ? `<img src="${poster}" alt="" class="admin-top-poster">` : '<div class="admin-no-poster" style="width:40px;height:60px">?</div>'}
                <span class="admin-top-title">${escapeHtml(t.title)}</span>
                <span class="admin-top-count">${t.count} demande${t.count > 1 ? 's' : ''}</span>
              </div>`;
            }).join('');
      }

      renderDashboardOnline();
    } catch (e) { console.warn('Dashboard error:', e); }
  }

  function renderDashboardOnline() {
    const list = document.getElementById('dashboard-online-list');
    const summary = document.getElementById('dashboard-online-summary');
    if (!list || !summary) return;
    const online = allUsers.filter(isOnline);
    summary.textContent = online.length === 0
      ? 'Personne en ligne pour le moment'
      : `${online.length} utilisateur${online.length > 1 ? 's' : ''} connecté${online.length > 1 ? 's' : ''}`;
    if (online.length === 0) {
      list.innerHTML = '<p class="admin-muted" style="padding:16px">Personne pour l\'instant. Repasse dans un moment !</p>';
      return;
    }
    list.innerHTML = online
      .sort((a, b) => {
        const aw = a?.presence?.watching ? 0 : 1;
        const bw = b?.presence?.watching ? 0 : 1;
        return aw - bw;
      })
      .slice(0, 10)
      .map(u => {
        const name = u.displayName || (u.email || '').split('@')[0] || 'Utilisateur';
        const watching = watchingText(u);
        return `<div class="admin-online-item">
          <div class="admin-user-avatar small">
            <span>${(name[0] || '?').toUpperCase()}</span>
            <span class="admin-user-dot online"></span>
          </div>
          <div class="admin-online-meta">
            <strong>${escapeHtml(name)}</strong>
            ${watching ? `<span class="admin-online-watching">🎬 ${escapeHtml(watching)}</span>` : '<span class="admin-muted">En train de naviguer…</span>'}
          </div>
        </div>`;
      }).join('');
  }

  /* ---------- Catalog ---------- */

  async function loadCatalog() {
    try {
      const allItems = await BBM.API.fetchAllItems();
      const movies = BBM.API.getMovies();
      const seriesMap = BBM.API.getSeriesMap();
      const episodes = allItems.filter(i => i.category === 'series').length;
      set('catalog-total', new Set(allItems.map(i => i.tmdbID)).size);
      set('catalog-movies', movies.length);
      set('catalog-series', seriesMap.size);
      set('catalog-episodes', episodes);

      // Recently added (7 days)
      const now = Date.now();
      const recent = allItems.filter(i => {
        if (!i.createdAt) return false;
        return (now - new Date(i.createdAt).getTime()) < 7 * 86400000;
      });
      const uniqueRecent = new Map();
      recent.forEach(i => { if (!uniqueRecent.has(i.tmdbID)) uniqueRecent.set(i.tmdbID, i); });
      document.getElementById('catalog-recent-count').textContent =
        `${uniqueRecent.size} titre${uniqueRecent.size > 1 ? 's' : ''}`;

      // Fetch TMDB for recent + genre breakdown
      const uniqueForTmdb = [...uniqueRecent.values()].map(i => ({
        tmdbID: i.tmdbID, category: i.category
      }));
      const tmdbCache = uniqueForTmdb.length
        ? await BBM.API.batchFetchTMDB(uniqueForTmdb, 12)
        : new Map();

      const recentEl = document.getElementById('catalog-recent');
      recentEl.innerHTML = uniqueRecent.size === 0
        ? '<p class="admin-muted" style="padding:16px">Rien ajouté ce mois-ci.</p>'
        : [...uniqueRecent.values()]
            .slice(0, 12)
            .map(i => {
              const t = tmdbCache.get(i.tmdbID);
              const poster = t?.poster_path ? `${BBM.Config.tmdb.imageBase}/w154${t.poster_path}` : '';
              const title = t?.title || t?.name || i.title || i.seriesTitle || 'Sans titre';
              return `<div class="admin-recent-item">
                ${poster ? `<img src="${poster}" alt="" loading="lazy">` : '<div class="admin-no-poster" style="height:100%">?</div>'}
                <div class="admin-recent-title">${escapeHtml(title)}</div>
              </div>`;
            }).join('');

      // Genre breakdown (across the whole catalog)
      const genreCounts = new Map();
      const allUniqueTmdb = new Set();
      [...movies, ...seriesMap.values()].forEach(it => {
        if (!allUniqueTmdb.has(it.tmdbID)) {
          allUniqueTmdb.add(it.tmdbID);
        }
      });
      // Fetch TMDB for the whole catalog with memory cache already populated
      const allUniqueItems = [];
      movies.forEach(m => allUniqueItems.push({ tmdbID: m.tmdbID, category: 'movie' }));
      seriesMap.forEach(s => allUniqueItems.push({ tmdbID: s.tmdbID, category: 'series' }));
      // Reuse already-cached TMDB data (memory + localStorage)
      const bigCache = await BBM.API.batchFetchTMDB(allUniqueItems, 12);
      bigCache.forEach(t => {
        (t.genres || []).forEach(g => {
          genreCounts.set(g.name, (genreCounts.get(g.name) || 0) + 1);
        });
      });
      const sortedGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const max = sortedGenres[0]?.[1] || 1;
      const genresEl = document.getElementById('catalog-genres');
      genresEl.innerHTML = sortedGenres.map(([name, count]) => {
        const pct = Math.round((count / max) * 100);
        return `<div class="admin-genre-row">
          <span class="admin-genre-name">${escapeHtml(name)}</span>
          <div class="admin-genre-bar"><div class="admin-genre-fill" style="width:${pct}%"></div></div>
          <span class="admin-genre-count">${count}</span>
        </div>`;
      }).join('');
    } catch (e) { console.warn('Catalog load error:', e); }
  }

  /* ---------- System ---------- */

  function loadSystemInfo() {
    const version = (typeof BBM_CHANGELOG !== 'undefined' && BBM_CHANGELOG.currentVersion)
      ? 'v' + BBM_CHANGELOG.currentVersion : '—';
    document.getElementById('system-version').textContent = version;
    document.getElementById('system-ua').textContent = navigator.userAgent || '—';

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        document.getElementById('system-sw').textContent = regs.length
          ? `${regs.length} registration active`
          : 'Non enregistré';
      });
    } else {
      document.getElementById('system-sw').textContent = 'Non supporté';
    }

    // localStorage TMDB cache size
    try {
      let count = 0, bytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('tmdb_')) { count++; bytes += (localStorage.getItem(k) || '').length; }
      }
      const kb = Math.round(bytes / 1024);
      document.getElementById('system-cache').textContent = `${count} entrées · ~${kb} Ko`;
    } catch (e) {
      document.getElementById('system-cache').textContent = '—';
    }
  }

  function setupSystem() {
    document.getElementById('op-refresh-catalog')?.addEventListener('click', () => {
      if (!confirm('Purger le cache TMDB local et recharger le catalogue ?')) return;
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('tmdb_')) localStorage.removeItem(k);
        }
      } catch (e) {}
      BBM.Toast.show('Cache vidé, rechargement…', 'success');
      setTimeout(() => location.reload(), 800);
    });

    document.getElementById('op-clear-resolved')?.addEventListener('click', async () => {
      const resolved = allRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
      if (resolved.length === 0) { BBM.Toast.show('Rien à purger', 'info'); return; }
      if (!confirm(`Supprimer définitivement ${resolved.length} demande(s) traitée(s) ?`)) return;
      try {
        const batch = db.batch();
        resolved.forEach(r => batch.delete(db.collection('requests').doc(r.id)));
        await batch.commit();
        allRequests = allRequests.filter(r => r.status === 'pending');
        updateRequestStats(); renderRequests(); updateSidebarCounts();
        BBM.Toast.show(`${resolved.length} demande(s) supprimée(s)`, 'success');
      } catch (err) {
        BBM.Toast.show('Erreur', 'error');
      }
    });

    document.getElementById('op-export-requests')?.addEventListener('click', () => {
      const json = JSON.stringify(allRequests, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bbm-requests-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      BBM.Toast.show('Export téléchargé', 'success');
    });

    document.getElementById('op-clear-sw')?.addEventListener('click', async () => {
      if (!confirm('Désenregistrer le Service Worker et vider tous ses caches ?')) return;
      try {
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if (navigator.serviceWorker) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        BBM.Toast.show('Service Worker vidé, rechargement…', 'success');
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        BBM.Toast.show('Erreur', 'error');
      }
    });

    document.getElementById('op-delete-all-requests')?.addEventListener('click', async () => {
      if (!confirm('⚠️ Supprimer TOUTES les demandes (y compris en attente) ?')) return;
      if (!confirm('Vraiment sûr ? Cette action est définitive.')) return;
      try {
        const batch = db.batch();
        allRequests.forEach(r => batch.delete(db.collection('requests').doc(r.id)));
        await batch.commit();
        allRequests = [];
        updateRequestStats(); renderRequests(); updateSidebarCounts();
        BBM.Toast.show('Toutes les demandes ont été supprimées', 'success');
      } catch (err) {
        BBM.Toast.show('Erreur', 'error');
      }
    });
  }

  /* ---------- Helpers ---------- */

  function updateSidebarCounts() {
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const reqBadge = document.getElementById('sidebar-req-count');
    if (reqBadge) {
      reqBadge.textContent = pending;
      reqBadge.style.display = pending > 0 ? '' : 'none';
    }
    const online = allUsers.filter(isOnline).length;
    const onlineBadge = document.getElementById('sidebar-online-count');
    if (onlineBadge) {
      onlineBadge.textContent = online;
      onlineBadge.style.display = online > 0 ? '' : 'none';
      onlineBadge.classList.toggle('admin-nav-badge-online', online > 0);
    }
    // Also refresh the dashboard online card if visible
    renderDashboardOnline();
  }

  function set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /* ---------- Toast (fallback) ---------- */
  BBM.Toast = BBM.Toast || {
    show(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
    }
  };
})();
