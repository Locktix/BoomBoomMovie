/* ============================================
   BoomBoomMovie — Admin Panel
   ============================================ */

(function () {
  'use strict';

  const db = BBM.db;
  let allRequests = [];
  let currentFilter = 'all';

  /* ---------- Auth & Admin Check ---------- */

  firebase.auth().onAuthStateChanged(async (user) => {
    const loading = document.getElementById('loading-screen');
    const denied = document.getElementById('admin-denied');
    const page = document.getElementById('admin-page');

    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    // Check admin
    BBM.Auth.currentUser = user;
    const isAdmin = await BBM.Auth.isAdmin();
    if (!isAdmin) {
      loading.style.display = 'none';
      denied.style.display = 'flex';
      return;
    }

    loading.style.display = 'none';
    page.style.display = 'block';

    await loadRequests();
    setupFilters();
    loadGlobalStats();
  });

  /* ---------- Load All Requests ---------- */

  async function loadRequests() {
    try {
      const snapshot = await db.collection('requests')
        .orderBy('createdAt', 'desc')
        .get();

      allRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      updateStats();
      renderRequests();
    } catch (err) {
      console.error('Erreur chargement demandes:', err);
      document.getElementById('admin-requests').innerHTML =
        '<p style="text-align:center;color:#f44;padding:40px">Erreur de chargement. Vérifie les règles Firestore (l\'admin doit pouvoir lire toutes les demandes).</p>';
    }
  }

  /* ---------- Stats ---------- */

  function updateStats() {
    const total = allRequests.length;
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const approved = allRequests.filter(r => r.status === 'approved').length;
    const rejected = allRequests.filter(r => r.status === 'rejected').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-approved').textContent = approved;
    document.getElementById('stat-rejected').textContent = rejected;
  }

  /* ---------- Render ---------- */

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

      const posterURL = req.posterPath
        ? `${BBM.Config.tmdb.imageBase}/w154${req.posterPath}`
        : '';

      const typeLabel = req.type === 'movie' ? 'Film' : 'Série';

      const statusClass = req.status || 'pending';
      const statusLabel = statusClass === 'pending' ? 'En attente'
        : statusClass === 'approved' ? 'Approuvé'
        : 'Refusé';

      const actions = req.status === 'pending' ? `
        <div class="admin-actions">
          <button class="admin-btn approve" data-action="approved" data-id="${req.id}" title="Approuver">✓ Approuver</button>
          <button class="admin-btn reject" data-action="rejected" data-id="${req.id}" title="Refuser">✕ Refuser</button>
        </div>
      ` : `
        <div class="admin-actions">
          <button class="admin-btn reset" data-action="pending" data-id="${req.id}" title="Remettre en attente">↺ Réinitialiser</button>
        </div>
      `;

      return `
        <div class="admin-request-card ${statusClass}">
          <div class="admin-request-poster">
            ${posterURL ? `<img src="${posterURL}" alt="${req.title}" loading="lazy">` : '<div class="admin-no-poster">?</div>'}
          </div>
          <div class="admin-request-info">
            <h3>${req.title || 'Sans titre'}</h3>
            <div class="admin-request-meta">
              <span class="admin-badge type">${typeLabel}</span>
              <span class="admin-badge status ${statusClass}">${statusLabel}</span>
              <span class="admin-meta-text">TMDB #${req.tmdbID || '?'}</span>
            </div>
            <p class="admin-request-by">Demandé par <strong>${req.requestedByName || 'Inconnu'}</strong> le ${date}</p>
          </div>
          ${actions}
        </div>
      `;
    }).join('');
  }

  /* ---------- Actions (delegated + confirmation) ---------- */

  document.getElementById('admin-requests').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const requestId = btn.dataset.id;
    const newStatus = btn.dataset.action;

    btn.disabled = true;

    try {
      await db.collection('requests').doc(requestId).update({
        status: newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const req = allRequests.find(r => r.id === requestId);
      if (req) req.status = newStatus;

      updateStats();
      renderRequests();

      const labels = { approved: 'Demande approuvée', rejected: 'Demande refusée', pending: 'Demande réinitialisée' };
      BBM.Toast.show(labels[newStatus] || 'Mis à jour', newStatus === 'rejected' ? 'error' : 'success');
    } catch (err) {
      console.error('Erreur action admin:', err);
      btn.disabled = false;
      BBM.Toast.show('Erreur : vérifie les règles Firestore', 'error');
    }
  });

  /* ---------- Global Stats ---------- */

  async function loadGlobalStats() {
    try {
      const allItems = await BBM.API.fetchAllItems();
      const movies = BBM.API.getMovies();
      const series = BBM.API.getSeries();

      document.getElementById('gstat-catalog').textContent = new Set(allItems.map(i => i.tmdbID)).size;
      document.getElementById('gstat-movies').textContent = movies.length;
      document.getElementById('gstat-series').textContent = BBM.API.getSeriesMap().size;

      // Unique requesters
      const requesters = new Set(allRequests.map(r => r.requestedBy).filter(Boolean));
      document.getElementById('gstat-requesters').textContent = requesters.size;

      // Top requested titles (count by tmdbID) — exclure les demandes approuvées
      const titleCounts = {};
      allRequests
        .filter(r => r.status !== 'approved')
        .forEach(r => {
          const key = r.tmdbID || '?';
          if (!titleCounts[key]) titleCounts[key] = { title: r.title || `#${key}`, poster: r.posterPath, count: 0 };
          titleCounts[key].count++;
        });
      const top = Object.values(titleCounts).sort((a, b) => b.count - a.count).slice(0, 5);
      const topContainer = document.getElementById('admin-top-requested');
      if (top.length > 0) {
        topContainer.innerHTML = '<h3 class="admin-subsection-title">Titres les plus demandés</h3>' +
          top.map(t => {
            const poster = t.poster ? `${BBM.Config.tmdb.imageBase}/w92${t.poster}` : '';
            return `<div class="admin-top-item">
              ${poster ? `<img src="${poster}" alt="" class="admin-top-poster">` : '<div class="admin-no-poster" style="width:40px;height:60px">?</div>'}
              <span class="admin-top-title">${t.title}</span>
              <span class="admin-top-count">${t.count} demande${t.count > 1 ? 's' : ''}</span>
            </div>`;
          }).join('');
      }
    } catch (e) {
      console.warn('Global stats error:', e);
    }
  }

  /* ---------- Filters ---------- */

  function setupFilters() {
    document.querySelectorAll('.admin-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelector('.admin-filter-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderRequests();
      });
    });
  }

  /* ---------- Toast (minimal copy) ---------- */

  BBM.Toast = BBM.Toast || {
    show(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }, 3000);
    }
  };

})();
