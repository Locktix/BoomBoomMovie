/* ============================================
   BoomBoomMovie — Downloads library page
   ============================================ */

BBM.Downloads = {
  async init() {
    const user = await BBM.Auth.requireAuth();
    if (!user) return;

    // Avatar
    const avatar = document.getElementById('nav-avatar');
    if (avatar) {
      avatar.textContent = BBM.Auth.getInitials(user);
    }

    const [items, downloads] = await Promise.all([
      BBM.API.fetchAllItems().catch(() => []),
      BBM.API.getDownloads().catch(() => ({}))
    ]);

    // TMDB enrichment for nicer cards
    const uniqueIDs = new Map();
    Object.values(downloads).forEach(d => {
      if (!uniqueIDs.has(d.tmdbID)) {
        uniqueIDs.set(d.tmdbID, {
          tmdbID: d.tmdbID,
          category: d.type === 'series' ? 'series' : 'movie'
        });
      }
    });
    const tmdbCache = uniqueIDs.size
      ? await BBM.API.batchFetchTMDB([...uniqueIDs.values()], 12)
      : new Map();

    this.render(downloads, tmdbCache);

    // Hide loading screen
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.style.display = 'none', 500);
    }
    document.getElementById('downloads-page').style.display = '';
  },

  render(downloads, tmdbCache) {
    const grid = document.getElementById('downloads-grid');
    const empty = document.getElementById('downloads-empty');
    const counter = document.getElementById('downloads-count');
    if (!grid || !empty || !counter) return;

    const entries = Object.entries(downloads).sort((a, b) => {
      const ta = a[1].downloadedAt?.toMillis?.() || 0;
      const tb = b[1].downloadedAt?.toMillis?.() || 0;
      return tb - ta;
    });

    grid.innerHTML = '';
    if (entries.length === 0) {
      empty.style.display = '';
      counter.textContent = 'Tu n\'as encore rien téléchargé.';
      return;
    }
    empty.style.display = 'none';
    counter.textContent = `${entries.length} élément${entries.length > 1 ? 's' : ''} dans ta bibliothèque`;

    for (const [key, d] of entries) {
      const tmdb = tmdbCache.get(d.tmdbID) || tmdbCache.get(String(d.tmdbID));
      const posterPath = d.posterPath || tmdb?.poster_path || null;
      const poster = posterPath ? BBM.API.getPosterURL(posterPath, 'w342') : null;

      const isSeries = d.type === 'series';
      const title = isSeries
        ? (tmdb?.name || d.title.split(' — ')[0] || 'Série')
        : (d.title || tmdb?.title || 'Film');
      const sub = isSeries && d.season != null && d.episode != null
        ? `S${String(d.season).padStart(2, '0')}E${String(d.episode).padStart(2, '0')}`
        : 'Film';

      const date = d.downloadedAt?.toDate?.();
      const dateStr = date
        ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

      const card = document.createElement('article');
      card.className = 'download-card';
      card.innerHTML = `
        <div class="download-card-poster">
          ${poster
            ? `<img src="${poster}" alt="${this.esc(title)}" loading="lazy">`
            : '<div class="download-card-placeholder">?</div>'}
        </div>
        <div class="download-card-body">
          <div class="download-card-type">${sub}</div>
          <h3 class="download-card-title">${this.esc(title)}</h3>
          ${dateStr ? `<div class="download-card-date">Téléchargé le ${dateStr}</div>` : ''}
          <div class="download-card-actions">
            <button class="btn-primary download-card-dl" data-url="${this.esc(d.url)}" data-filename="${this.esc(title)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Re-télécharger
            </button>
            <button class="btn-icon download-card-remove" data-key="${this.esc(key)}" title="Retirer de la liste">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);

      card.querySelector('.download-card-dl').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const a = document.createElement('a');
        a.href = btn.dataset.url;
        a.download = (btn.dataset.filename || 'video') + '.mp4';
        a.rel = 'noopener';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
        BBM.Toast.show('Téléchargement relancé', 'success');
      });

      card.querySelector('.download-card-remove').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        if (!confirm('Retirer cet élément de la liste ?')) return;
        btn.disabled = true;
        try {
          await BBM.API.removeDownload(btn.dataset.key);
          card.style.transition = 'opacity 0.25s, transform 0.25s';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.96)';
          setTimeout(() => {
            card.remove();
            // Update counter
            const remaining = grid.querySelectorAll('.download-card').length;
            if (remaining === 0) {
              empty.style.display = '';
              counter.textContent = 'Tu n\'as encore rien téléchargé.';
            } else {
              counter.textContent = `${remaining} élément${remaining > 1 ? 's' : ''} dans ta bibliothèque`;
            }
          }, 260);
          BBM.Toast.show('Retiré');
        } catch (err) {
          btn.disabled = false;
          BBM.Toast.show('Erreur', 'error');
        }
      });
    }
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }
};

/* Minimal toast in case it's not injected by other scripts */
BBM.Toast = BBM.Toast || {
  show(message, type = 'success', duration = 3000) {
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
    }, duration);
  }
};

document.addEventListener('DOMContentLoaded', () => BBM.Downloads.init());
