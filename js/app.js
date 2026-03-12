/**
 * BoomBoom - app.js
 * API removed: posters come only from data.json (field: poster).
 */
const CONFIG = {
  DATA_FILE: 'data.json',
};

const state = {
  series: [],
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
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
  const totalEpisodes = seasons.reduce((acc, s) => acc + (Number(s.episodes) || 0), 0);

  title.textContent = seriesItem.title;
  meta.textContent = `${seriesItem.year || ''} | ${seasons.length} saison(s) | ${totalEpisodes} episode(s)`;

  let html = '';
  seasons.forEach((season) => {
    const seasonNum = Number(season.season) || 1;
    const epCount = Number(season.episodes) || 0;
    html += `
      <article class="season-card">
        <header class="season-card-head">
          <h4>Saison ${seasonNum}</h4>
          <span>${epCount} episode(s) | ${season.year || ''}</span>
        </header>
        <div class="episode-list">
    `;

    for (let ep = 1; ep <= epCount; ep += 1) {
      const code = `S${String(seasonNum).padStart(2, '0')}E${String(ep).padStart(2, '0')}`;
      html += `
          <div class="episode-item">
            <div class="episode-main">
              <p class="episode-code">${code}</p>
              <p class="episode-title">Episode ${ep}</p>
            </div>
            <p class="episode-year">${season.year || ''}</p>
          </div>
      `;
    }

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

function setupSeriesModal() {
  const modal = document.getElementById('series-modal');
  const closeBtn = document.getElementById('series-modal-close');

  closeBtn.addEventListener('click', closeSeriesModal);
  modal.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.hasAttribute('data-close-modal')) {
      closeSeriesModal();
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
      <span class="card-year">${item.year || ''}</span>
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

    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
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

  count.textContent = items && items.length ? String(items.length) : '0';
  if (!items || items.length === 0) return;

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => fragment.appendChild(createCard(item, isTV, index)));
  grid.appendChild(fragment);
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
    });
  });
}

function setupSearch() {
  const input = document.getElementById('search');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();

    document.querySelectorAll('.section.active .card').forEach((card) => {
      const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
      card.style.display = !q || title.includes(q) ? '' : 'none';
    });


  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input'));
    });
  });
}

async function init() {
  setupTabs();
  setupSearch();
  setupSeriesModal();

  try {
    const res = await fetch(CONFIG.DATA_FILE);
    if (!res.ok) throw new Error(`Impossible de charger ${CONFIG.DATA_FILE} (HTTP ${res.status})`);
    const data = await res.json();

    state.series = Array.isArray(data.series) ? data.series : [];
    const movies = Array.isArray(data.movies) ? data.movies : [];

    renderGrid(movies, 'movies-grid', 'movies-count', false);
    renderGrid(state.series, 'series-grid', 'series-count', true);
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
