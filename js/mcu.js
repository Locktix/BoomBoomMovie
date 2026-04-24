/* ============================================
   BoomBoomMovie — MCU Chronological Timeline
   ============================================ */

BBM.MCU = {
  // Complete MCU + Multiverse viewing order (chronological)
  timeline: [
    // ── Phase 1 ──
    { title: "Captain America: First Avenger", tmdbID: "1771", type: "movie", release: "2011-07-22", section: "phase1" },
    { title: "Captain Marvel", tmdbID: "299537", type: "movie", release: "2019-03-08", section: "phase1" },
    { title: "Iron Man", tmdbID: "1726", type: "movie", release: "2008-05-02", section: "phase1" },
    { title: "Iron Man 2", tmdbID: "10138", type: "movie", release: "2010-05-07", section: "phase1" },
    { title: "L'Incroyable Hulk", tmdbID: "1724", type: "movie", release: "2008-06-13", section: "phase1" },
    { title: "Thor", tmdbID: "10195", type: "movie", release: "2011-05-06", section: "phase1" },
    { title: "Avengers", tmdbID: "24428", type: "movie", release: "2012-05-04", section: "phase1" },

    // ── Phase 2 ──
    { title: "Thor : Le Monde des Ténèbres", tmdbID: "76338", type: "movie", release: "2013-11-08", section: "phase2" },
    { title: "Iron Man 3", tmdbID: "68721", type: "movie", release: "2013-05-03", section: "phase2" },
    { title: "Captain America : Le Soldat de l'Hiver", tmdbID: "100402", type: "movie", release: "2014-04-04", section: "phase2" },
    { title: "Les Gardiens de la Galaxie", tmdbID: "118340", type: "movie", release: "2014-08-01", section: "phase2" },
    { title: "Les Gardiens de la Galaxie Vol. 2", tmdbID: "283995", type: "movie", release: "2017-05-05", section: "phase2" },
    { title: "Daredevil – Saison 1", tmdbID: "61889", type: "tv", release: "2015-04-10", section: "phase2" },
    { title: "Avengers : L'Ère d'Ultron", tmdbID: "99861", type: "movie", release: "2015-05-01", section: "phase2" },
    { title: "Ant-Man", tmdbID: "102899", type: "movie", release: "2015-07-17", section: "phase2" },

    // ── Phase 3 ──
    { title: "Captain America : Civil War", tmdbID: "271110", type: "movie", release: "2016-05-06", section: "phase3" },
    { title: "Black Widow", tmdbID: "497698", type: "movie", release: "2021-07-09", section: "phase3" },
    { title: "Black Panther", tmdbID: "284054", type: "movie", release: "2018-02-16", section: "phase3" },
    { title: "Spider-Man : Homecoming", tmdbID: "315635", type: "movie", release: "2017-07-07", section: "phase3" },
    { title: "Daredevil – Saison 2", tmdbID: "61889", type: "tv", release: "2016-03-18", section: "phase3" },
    { title: "The Punisher – Saison 1", tmdbID: "67178", type: "tv", release: "2017-11-17", section: "phase3" },
    { title: "Doctor Strange", tmdbID: "284052", type: "movie", release: "2016-11-04", section: "phase3" },
    { title: "Thor : Ragnarok", tmdbID: "284053", type: "movie", release: "2017-11-03", section: "phase3" },
    { title: "Avengers : Infinity War", tmdbID: "299536", type: "movie", release: "2018-04-27", section: "phase3" },
    { title: "Ant-Man et la Guêpe", tmdbID: "363088", type: "movie", release: "2018-07-06", section: "phase3" },
    { title: "Avengers : Endgame", tmdbID: "299534", type: "movie", release: "2019-04-26", section: "phase3" },

    // ── Phase 4 ──
    { title: "Loki – Saison 1", tmdbID: "84958", type: "tv", release: "2021-06-09", section: "phase4" },
    { title: "Loki – Saison 2", tmdbID: "84958", type: "tv", release: "2023-10-06", section: "phase4" },
    { title: "WandaVision", tmdbID: "85271", type: "tv", release: "2021-01-15", section: "phase4" },
    { title: "What If...? – Saison 1", tmdbID: "91363", type: "tv", release: "2021-08-11", section: "phase4" },
    { title: "What If...? – Saison 2", tmdbID: "91363", type: "tv", release: "2023-12-22", section: "phase4" },
    { title: "What If...? – Saison 3", tmdbID: "91363", type: "tv", release: "2024-12-22", section: "phase4" },
    { title: "Shang-Chi et la Légende des Dix Anneaux", tmdbID: "566525", type: "movie", release: "2021-09-03", section: "phase4" },
    { title: "Falcon et le Soldat de l'Hiver", tmdbID: "88396", type: "tv", release: "2021-03-19", section: "phase4" },
    { title: "Les Éternels", tmdbID: "524434", type: "movie", release: "2021-11-05", section: "phase4" },
    { title: "Spider-Man : Far From Home", tmdbID: "429617", type: "movie", release: "2019-07-02", section: "phase4" },

    // ── Multivers — Spider-Man ──
    { title: "Spider-Man", tmdbID: "557", type: "movie", release: "2002-05-03", section: "multivers-sm" },
    { title: "Spider-Man 2", tmdbID: "558", type: "movie", release: "2004-06-30", section: "multivers-sm" },
    { title: "Spider-Man 3", tmdbID: "559", type: "movie", release: "2007-05-04", section: "multivers-sm" },
    { title: "The Amazing Spider-Man", tmdbID: "1930", type: "movie", release: "2012-07-03", section: "multivers-sm" },
    { title: "The Amazing Spider-Man 2", tmdbID: "102382", type: "movie", release: "2014-05-02", section: "multivers-sm" },

    // ── Phase 4 (suite) ──
    { title: "Spider-Man : No Way Home", tmdbID: "634649", type: "movie", release: "2021-12-17", section: "phase4b" },
    { title: "Doctor Strange in the Multiverse of Madness", tmdbID: "453395", type: "movie", release: "2022-05-06", section: "phase4b" },
    { title: "Moon Knight", tmdbID: "92749", type: "tv", release: "2022-03-30", section: "phase4b" },
    { title: "Thor : Love and Thunder", tmdbID: "616037", type: "movie", release: "2022-07-08", section: "phase4b" },
    { title: "Ms. Marvel", tmdbID: "92782", type: "tv", release: "2022-06-08", section: "phase4b" },
    { title: "She-Hulk: Attorney at Law", tmdbID: "92783", type: "tv", release: "2022-08-18", section: "phase4b" },
    { title: "Black Panther : Wakanda Forever", tmdbID: "505642", type: "movie", release: "2022-11-11", section: "phase4b" },
    { title: "Werewolf by Night", tmdbID: "877703", type: "movie", release: "2022-10-07", section: "phase4b" },

    // ── Phase 5 ──
    { title: "Ant-Man et la Guêpe : Quantumania", tmdbID: "640146", type: "movie", release: "2023-02-17", section: "phase5" },
    { title: "Les Gardiens de la Galaxie Vol. 3", tmdbID: "447365", type: "movie", release: "2023-05-05", section: "phase5" },
    { title: "Secret Invasion", tmdbID: "114472", type: "tv", release: "2023-06-21", section: "phase5" },
    { title: "The Marvels", tmdbID: "609681", type: "movie", release: "2023-11-10", section: "phase5" },
    { title: "Hawkeye", tmdbID: "88329", type: "tv", release: "2021-11-24", section: "phase5" },
    { title: "Echo", tmdbID: "108978", type: "tv", release: "2024-01-10", section: "phase5" },

    // ── Multivers — X-Men & Deadpool ──
    { title: "X-Men", tmdbID: "36657", type: "movie", release: "2000-07-14", section: "multivers-xmen" },
    { title: "X-Men 2", tmdbID: "36658", type: "movie", release: "2003-05-02", section: "multivers-xmen" },
    { title: "X-Men : L'Affrontement Final", tmdbID: "36668", type: "movie", release: "2006-05-26", section: "multivers-xmen" },
    { title: "X-Men : Le Commencement", tmdbID: "49538", type: "movie", release: "2011-06-03", section: "multivers-xmen" },
    { title: "X-Men : Days of Future Past", tmdbID: "127585", type: "movie", release: "2014-05-23", section: "multivers-xmen" },
    { title: "Logan", tmdbID: "263115", type: "movie", release: "2017-03-03", section: "multivers-xmen" },
    { title: "Deadpool", tmdbID: "293660", type: "movie", release: "2016-02-12", section: "multivers-xmen" },
    { title: "Deadpool 2", tmdbID: "383498", type: "movie", release: "2018-05-18", section: "multivers-xmen" },
    { title: "Deadpool & Wolverine", tmdbID: "533535", type: "movie", release: "2024-07-26", section: "multivers-xmen" },

    // ── Phase 5 (suite) ──
    { title: "Agatha All Along", tmdbID: "134949", type: "tv", release: "2024-09-18", section: "phase5b" },
    { title: "Captain America : Brave New World", tmdbID: "822119", type: "movie", release: "2025-02-14", section: "phase5b" },
    { title: "Daredevil: Born Again – Saison 1", tmdbID: "202555", type: "tv", release: "2025-03-04", section: "phase5b" },

    // ── Phase 6 ──
    { title: "Thunderbolts*", tmdbID: "986056", type: "movie", release: "2025-05-02", section: "phase6" },
    { title: "The Fantastic Four: First Steps", tmdbID: "617126", type: "movie", release: "2025-07-25", section: "phase6" },
    { title: "Avengers: Doomsday", tmdbID: "1003596", type: "movie", release: "2026-05-01", section: "phase6" },
    { title: "Spider-Man 4 : Brand New Day", tmdbID: "900667", type: "movie", release: "2026-07-24", section: "phase6" },
    { title: "Vision", tmdbID: "254556", type: "tv", release: "2026-01-01", section: "phase6" },
    { title: "Daredevil: Born Again – Saison 2", tmdbID: "204541", type: "tv", release: "2026-06-01", section: "phase6" },
    { title: "Avengers: Secret Wars", tmdbID: "1003598", type: "movie", release: "2027-05-07", section: "phase6" },

    // ── À venir ──
    { title: "Blade", tmdbID: null, type: "movie", release: "2028-01-01", section: "avenir" },
    { title: "Armor Wars", tmdbID: null, type: "movie", release: "2028-01-01", section: "avenir" },
    { title: "Shang-Chi 2", tmdbID: null, type: "movie", release: "2028-01-01", section: "avenir" }
  ],

  sectionLabels: {
    "phase1": "Phase 1",
    "phase2": "Phase 2",
    "phase3": "Phase 3",
    "phase4": "Phase 4",
    "multivers-sm": "Multivers — Spider-Man",
    "phase4b": "Phase 4 (suite)",
    "phase5": "Phase 5",
    "multivers-xmen": "Multivers — X-Men & Deadpool",
    "phase5b": "Phase 5 (suite)",
    "phase6": "Phase 6",
    "avenir": "À venir"
  },

  availableItems: new Set(),
  workerData: [],

  async init() {
    await BBM.Auth.requireAuth();

    // Fetch available content from catalog
    try {
      const res = await fetch(BBM.Config.workerAPI);
      if (res.ok) {
        this.workerData = await res.json();
        this.workerData.forEach(item => this.availableItems.add(String(item.tmdbID)));
      }
    } catch (e) { /* ignore */ }

    this.setupToggle();
    await this.render('chronological');

    document.getElementById('loading-screen')?.classList.add('fade-out');
    setTimeout(() => {
      const ls = document.getElementById('loading-screen');
      if (ls) ls.style.display = 'none';
    }, 600);
  },

  setupToggle() {
    document.querySelectorAll('.mcu-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mcu-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.render(btn.dataset.order);
      });
    });
  },

  /** Get the watch URL for a movie from catalog */
  getMovieURL(tmdbID) {
    const movie = this.workerData.find(i => String(i.tmdbID) === String(tmdbID) && i.category === 'movie');
    return movie ? movie.url : null;
  },

  /** Navigate to play a title */
  playTitle(item) {
    if (!item.tmdbID) {
      BBM.Toast.show('Pas encore annoncé', 'error');
      return;
    }

    if (!this.availableItems.has(String(item.tmdbID))) {
      BBM.Toast.show('Non disponible dans le catalogue', 'error');
      return;
    }

    if (item.type === 'movie') {
      const url = this.getMovieURL(item.tmdbID);
      if (url) {
        window.location.href = `watch.html?v=${encodeURIComponent(url)}&title=${encodeURIComponent(item.title)}&tmdbid=${item.tmdbID}&type=movie`;
      } else {
        BBM.Toast.show('URL non trouvée', 'error');
      }
    } else {
      // Series → go to browse to pick episodes
      window.location.href = `browse.html`;
    }
  },

  async render(order) {
    const container = document.getElementById('mcu-timeline');
    container.innerHTML = '<div class="loader" style="margin:60px auto"></div>';

    let items = [...this.timeline];
    if (order === 'release') {
      items.sort((a, b) => a.release.localeCompare(b.release));
    }

    // Batch fetch TMDB data (deduplicate)
    const uniqueFetch = [];
    const seen = new Set();
    items.forEach(item => {
      if (!item.tmdbID) return;
      const key = `${item.tmdbID}_${item.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFetch.push({ tmdbID: item.tmdbID, category: item.type === 'movie' ? 'movie' : 'series' });
      }
    });

    const tmdbData = await BBM.API.batchFetchTMDB(uniqueFetch);

    container.innerHTML = '';

    let currentSection = null;

    items.forEach((item, index) => {
      // Section separator (only in chronological mode)
      if (order === 'chronological' && item.section !== currentSection) {
        currentSection = item.section;
        const label = this.sectionLabels[currentSection] || currentSection;
        const sep = document.createElement('div');
        sep.className = 'mcu-phase-separator';

        // Special styling for multiverse sections
        const isMultivers = currentSection.startsWith('multivers');
        const isAvenir = currentSection === 'avenir';
        sep.innerHTML = `<span class="${isMultivers ? 'multivers' : ''} ${isAvenir ? 'avenir' : ''}">${label}</span>`;
        container.appendChild(sep);
      }

      const tmdb = item.tmdbID ? tmdbData.get(item.tmdbID) : null;
      const poster = tmdb?.poster_path ? BBM.API.getPosterURL(tmdb.poster_path, 'w200') : null;
      const overview = tmdb?.overview || '';
      const rating = tmdb?.vote_average ? (tmdb.vote_average / 2).toFixed(1) : '';
      const releaseYear = item.release.substring(0, 4);

      const isAvailable = item.tmdbID && this.availableItems.has(String(item.tmdbID));
      const isAnnounced = item.tmdbID !== null;

      const card = document.createElement('div');
      card.className = `mcu-card ${isAvailable ? 'available' : ''} ${!isAnnounced ? 'tba' : ''}`;
      card.style.animationDelay = `${index * 0.04}s`;

      const escapedTitle = item.title.replace(/"/g, '&quot;');
      card.innerHTML = `
        <div class="mcu-card-number">${index + 1}</div>
        <div class="mcu-card-poster">
          ${poster
            ? `<img src="${poster}" alt="${escapedTitle}" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')">`
            : ''}
          <div class="mcu-card-placeholder" style="${poster ? 'display:none' : ''}">${escapedTitle.substring(0, 2)}</div>
          ${isAvailable ? '<div class="mcu-play-badge">▶</div>' : ''}
        </div>
        <div class="mcu-card-content">
          <h3 class="mcu-card-title">${item.title}</h3>
          <div class="mcu-card-meta">
            <span class="mcu-card-type">${item.type === 'movie' ? '🎬 Film' : '📺 Série'}</span>
            <span class="mcu-card-year">📅 ${releaseYear === '2028' && !isAnnounced ? 'TBA' : releaseYear}</span>
            ${rating ? `<span class="mcu-card-rating">⭐ ${rating}/5</span>` : ''}
            ${isAvailable ? '<span class="mcu-badge available">Disponible</span>' : ''}
            ${!isAnnounced ? '<span class="mcu-badge tba">Pas encore annoncé</span>' : ''}
          </div>
          <p class="mcu-card-overview">${overview || (!isAnnounced ? 'Aucune information disponible pour le moment.' : '')}</p>
        </div>
      `;

      // Click handler
      if (isAvailable) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => this.playTitle(item));
      }

      container.appendChild(card);
    });
  }
};

/* ============================================
   Toast (minimal copy for MCU page)
   ============================================ */
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

document.addEventListener('DOMContentLoaded', () => {
  BBM.MCU.init();
});
