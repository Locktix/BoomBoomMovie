/* ============================================
   BoomBoomMovie — Stats Page
   ============================================ */

(function () {
  'use strict';

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    BBM.Auth.currentUser = user;

    // Avatar & username
    const avatar = document.getElementById('nav-avatar');
    if (avatar) avatar.textContent = BBM.Auth.getInitials();
    document.getElementById('stats-username').textContent = BBM.Auth.getDisplayName();

    // Load all data in parallel
    const [ratings, myList, continueWatching, requests, allItems] = await Promise.all([
      BBM.API.getUserRatings(),
      BBM.API.getMyList(),
      BBM.API.getContinueWatching(),
      BBM.API.getMyRequests(),
      BBM.API.fetchAllItems()
    ]);

    // Hide loader, show page
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('stats-page').style.display = 'block';

    // Build TMDB cache for rated items & continue watching
    const tmdbIDs = new Set();
    Object.keys(ratings).forEach(id => tmdbIDs.add(id));
    Object.keys(continueWatching).forEach(id => tmdbIDs.add(id));
    myList.forEach(id => tmdbIDs.add(id));

    const itemsToFetch = [];
    tmdbIDs.forEach(id => {
      const item = allItems.find(i => String(i.tmdbID) === String(id));
      if (item) itemsToFetch.push(item);
    });
    const tmdbCache = await BBM.API.batchFetchTMDB(itemsToFetch, 8);

    renderOverview(ratings, myList, continueWatching, requests);
    renderRatingsChart(ratings);
    renderGenresChart(ratings, tmdbCache);
    renderProgress(continueWatching, tmdbCache, allItems);
    renderTopRated(ratings, tmdbCache);
    renderRequestsChart(requests);
    renderActivity(continueWatching, requests, tmdbCache);
  });

  /* ---------- Overview Cards ---------- */

  function renderOverview(ratings, myList, continueWatching, requests) {
    const ratingEntries = Object.values(ratings);
    const numRated = ratingEntries.length;
    const avgRating = numRated > 0
      ? (ratingEntries.reduce((a, b) => a + b, 0) / numRated).toFixed(1)
      : '—';

    const cwEntries = Object.values(continueWatching);
    const finished = cwEntries.filter(cw => cw.duration > 0 && (cw.progress / cw.duration) >= 0.9);
    const inProgress = cwEntries.filter(cw => !(cw.duration > 0 && (cw.progress / cw.duration) >= 0.9));
    const totalWatchSec = cwEntries.reduce((sum, cw) => sum + (cw.progress || 0), 0);
    const watchHours = Math.floor(totalWatchSec / 3600);
    const watchMin = Math.floor((totalWatchSec % 3600) / 60);
    const watchTimeStr = watchHours > 0 ? `${watchHours}h${watchMin > 0 ? watchMin : ''}` : `${watchMin}min`;

    document.getElementById('stat-rated').textContent = numRated;
    document.getElementById('stat-avg-rating').textContent = avgRating;
    document.getElementById('stat-mylist').textContent = myList.length;
    document.getElementById('stat-finished').textContent = finished.length;
    document.getElementById('stat-watching').textContent = inProgress.length;
    document.getElementById('stat-watchtime').textContent = watchTimeStr;
    document.getElementById('stat-requests').textContent = requests.length;

    // Animate numbers
    document.querySelectorAll('.stats-card').forEach((card, i) => {
      card.style.animationDelay = `${i * 0.08}s`;
    });
  }

  /* ---------- Ratings Distribution Chart ---------- */

  function renderRatingsChart(ratings) {
    const container = document.getElementById('chart-ratings');
    const counts = { 0.5: 0, 1: 0, 1.5: 0, 2: 0, 2.5: 0, 3: 0, 3.5: 0, 4: 0, 4.5: 0, 5: 0 };

    Object.values(ratings).forEach(r => {
      if (counts[r] !== undefined) counts[r]++;
    });

    const max = Math.max(...Object.values(counts), 1);

    // Show simplified (full stars + halves grouped)
    const simplified = [
      { label: '½', keys: [0.5] },
      { label: '1', keys: [1] },
      { label: '1½', keys: [1.5] },
      { label: '2', keys: [2] },
      { label: '2½', keys: [2.5] },
      { label: '3', keys: [3] },
      { label: '3½', keys: [3.5] },
      { label: '4', keys: [4] },
      { label: '4½', keys: [4.5] },
      { label: '5', keys: [5] }
    ];

    if (Object.values(ratings).length === 0) {
      container.innerHTML = '<p class="stats-empty">Aucune note pour le moment</p>';
      return;
    }

    container.innerHTML = simplified.map(group => {
      const count = group.keys.reduce((s, k) => s + counts[k], 0);
      const pct = (count / max) * 100;
      return `
        <div class="chart-bar-row">
          <span class="chart-bar-label">${group.label}★</span>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${pct}%" data-count="${count}"></div>
          </div>
          <span class="chart-bar-count">${count}</span>
        </div>
      `;
    }).join('');

    // Animate bars
    requestAnimationFrame(() => {
      container.querySelectorAll('.chart-bar-fill').forEach(bar => {
        bar.style.transition = 'width 0.8s var(--bbm-ease)';
      });
    });
  }

  /* ---------- Genres Chart ---------- */

  function renderGenresChart(ratings, tmdbCache) {
    const container = document.getElementById('chart-genres');
    const genreCounts = {};

    Object.keys(ratings).forEach(tmdbID => {
      const data = tmdbCache.get(String(tmdbID)) || tmdbCache.get(Number(tmdbID));
      if (data && data.genres) {
        data.genres.forEach(g => {
          genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
        });
      }
    });

    const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    if (sorted.length === 0) {
      container.innerHTML = '<p class="stats-empty">Pas assez de données</p>';
      return;
    }

    const max = sorted[0][1];
    const colors = ['#d4a843', '#e4bc5a', '#c49235', '#b8860b', '#daa520', '#f0c060', '#c8a84e', '#a89030'];

    container.innerHTML = sorted.map(([name, count], i) => {
      const pct = (count / max) * 100;
      return `
        <div class="genre-bar-row">
          <span class="genre-bar-label">${name}</span>
          <div class="genre-bar-track">
            <div class="genre-bar-fill" style="width:${pct}%;background:${colors[i % colors.length]}">${count}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---------- Watch Progress ---------- */

  function renderProgress(continueWatching, tmdbCache, allItems) {
    const container = document.getElementById('stats-progress');
    const entries = Object.entries(continueWatching)
      .filter(([, cw]) => !(cw.duration > 0 && (cw.progress / cw.duration) >= 0.9));

    if (entries.length === 0) {
      container.innerHTML = '<p class="stats-empty">Aucun visionnage en cours</p>';
      return;
    }

    // Sort by most recent
    entries.sort((a, b) => {
      const ta = a[1].updatedAt?.toMillis ? a[1].updatedAt.toMillis() : 0;
      const tb = b[1].updatedAt?.toMillis ? b[1].updatedAt.toMillis() : 0;
      return tb - ta;
    });

    container.innerHTML = entries.slice(0, 10).map(([tmdbID, cw]) => {
      const data = tmdbCache.get(String(tmdbID)) || tmdbCache.get(Number(tmdbID));
      const title = data ? (data.title || data.name) : `#${tmdbID}`;
      const poster = data?.poster_path ? BBM.API.getPosterURL(data.poster_path, 'w92') : null;
      const pct = cw.duration > 0 ? Math.min(Math.round((cw.progress / cw.duration) * 100), 100) : 0;
      const progressMin = Math.floor(cw.progress / 60);
      const durationMin = Math.floor((cw.duration || 0) / 60);
      const episodeInfo = cw.season ? `S${cw.season}E${cw.episode}` : '';

      return `
        <div class="stats-progress-item">
          <div class="stats-progress-poster">
            ${poster ? `<img src="${poster}" alt="${title}" loading="lazy">` : '<div class="stats-no-poster">?</div>'}
          </div>
          <div class="stats-progress-info">
            <span class="stats-progress-title">${title} ${episodeInfo ? `<small>${episodeInfo}</small>` : ''}</span>
            <div class="stats-progress-bar-track">
              <div class="stats-progress-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="stats-progress-meta">${progressMin}min / ${durationMin}min · ${pct}%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---------- Top Rated ---------- */

  function renderTopRated(ratings, tmdbCache) {
    const container = document.getElementById('stats-top-rated');
    const entries = Object.entries(ratings).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (entries.length === 0) {
      container.innerHTML = '<p class="stats-empty">Aucune note pour le moment</p>';
      return;
    }

    container.innerHTML = entries.map(([tmdbID, rating]) => {
      const data = tmdbCache.get(String(tmdbID)) || tmdbCache.get(Number(tmdbID));
      const title = data ? (data.title || data.name) : `#${tmdbID}`;
      const poster = data?.poster_path ? BBM.API.getPosterURL(data.poster_path, 'w92') : null;
      const year = data ? (data.release_date || data.first_air_date || '').slice(0, 4) : '';
      const stars = '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '');

      return `
        <div class="stats-rated-item">
          <div class="stats-rated-poster">
            ${poster ? `<img src="${poster}" alt="${title}" loading="lazy">` : '<div class="stats-no-poster">?</div>'}
          </div>
          <div class="stats-rated-info">
            <span class="stats-rated-title">${title} ${year ? `<small>(${year})</small>` : ''}</span>
            <span class="stats-rated-stars">${stars} <small>${rating}/5</small></span>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---------- Requests Status Donut ---------- */

  function renderRequestsChart(requests) {
    const container = document.getElementById('chart-requests');

    if (requests.length === 0) {
      container.innerHTML = '<p class="stats-empty">Aucune demande</p>';
      return;
    }

    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    const total = requests.length;

    // Build donut with CSS conic-gradient
    const pendingPct = (pending / total) * 100;
    const approvedPct = (approved / total) * 100;
    const rejectedPct = (rejected / total) * 100;

    const gradient = `conic-gradient(
      #ffb432 0% ${pendingPct}%,
      #4caf50 ${pendingPct}% ${pendingPct + approvedPct}%,
      #e05555 ${pendingPct + approvedPct}% 100%
    )`;

    container.innerHTML = `
      <div class="stats-donut-wrap">
        <div class="stats-donut" style="background:${gradient}">
          <div class="stats-donut-hole">
            <span class="stats-donut-total">${total}</span>
            <span class="stats-donut-label">demandes</span>
          </div>
        </div>
        <div class="stats-donut-legend">
          <div class="stats-legend-item"><span class="stats-legend-dot" style="background:#ffb432"></span>En attente <strong>${pending}</strong></div>
          <div class="stats-legend-item"><span class="stats-legend-dot" style="background:#4caf50"></span>Approuvés <strong>${approved}</strong></div>
          <div class="stats-legend-item"><span class="stats-legend-dot" style="background:#e05555"></span>Refusés <strong>${rejected}</strong></div>
        </div>
      </div>
    `;
  }

  /* ---------- Recent Activity Feed ---------- */

  function renderActivity(continueWatching, requests, tmdbCache) {
    const container = document.getElementById('stats-activity');
    const events = [];

    // Watch events
    Object.entries(continueWatching).forEach(([tmdbID, cw]) => {
      const ts = cw.updatedAt?.toMillis ? cw.updatedAt.toMillis() : (cw.updatedAt?.seconds ? cw.updatedAt.seconds * 1000 : 0);
      if (!ts) return;
      const data = tmdbCache.get(String(tmdbID)) || tmdbCache.get(Number(tmdbID));
      const title = data ? (data.title || data.name) : `#${tmdbID}`;
      const finished = cw.duration > 0 && (cw.progress / cw.duration) >= 0.9;
      const epInfo = cw.season ? ` S${cw.season}E${cw.episode}` : '';
      events.push({
        ts,
        icon: finished ? '✅' : '▶️',
        text: finished ? `A terminé <strong>${title}</strong>${epInfo}` : `A regardé <strong>${title}</strong>${epInfo}`,
        poster: data?.poster_path ? BBM.API.getPosterURL(data.poster_path, 'w92') : null
      });
    });

    // Request events
    requests.forEach(req => {
      const ts = req.createdAt?.toMillis ? req.createdAt.toMillis() : (req.createdAt?.seconds ? req.createdAt.seconds * 1000 : 0);
      if (!ts) return;
      events.push({
        ts,
        icon: req.status === 'approved' ? '🎬' : req.status === 'rejected' ? '❌' : '📩',
        text: `A demandé <strong>${req.title || '?'}</strong>`,
        poster: req.posterPath ? `${BBM.Config.tmdb.imageBase}/w92${req.posterPath}` : null
      });
    });

    if (events.length === 0) {
      container.innerHTML = '<p class="stats-empty">Aucune activité récente</p>';
      return;
    }

    events.sort((a, b) => b.ts - a.ts);

    const formatDate = (ts) => {
      const d = new Date(ts);
      const now = Date.now();
      const diff = now - ts;
      if (diff < 60000) return 'À l\'instant';
      if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
      if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    container.innerHTML = events.slice(0, 20).map(ev => `
      <div class="activity-item">
        <span class="activity-icon">${ev.icon}</span>
        ${ev.poster ? `<img class="activity-poster" src="${ev.poster}" alt="" loading="lazy">` : ''}
        <div class="activity-text">${ev.text}</div>
        <span class="activity-time">${formatDate(ev.ts)}</span>
      </div>
    `).join('');
  }

  /* ---------- Toast ---------- */

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
