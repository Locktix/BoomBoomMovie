/* ============================================
   BoomBoomMovie — Browse Page Logic
   ============================================ */

BBM.Browse = {
  tmdbCache: new Map(),
  myList: [],
  continueWatching: {},
  userRatings: {},
  currentView: 'home', // home, movies, series, collections, mylist, search

  /* ----------------------------------------
     Initialization
     ---------------------------------------- */
  async init() {
    const user = await BBM.Auth.requireAuth();
    this.setupNavbar(user);
    this.setupSearch();
    this.setupModal();
    this.setupRequestModal();
    this.showLoading(true);

    try {
      // Fetch data in parallel
      const [items, myList, continueWatching, userRatings] = await Promise.all([
        BBM.API.fetchAllItems(),
        BBM.API.getMyList(),
        BBM.API.getContinueWatching(),
        BBM.API.getUserRatings()
      ]);

      this.myList = myList;
      this.continueWatching = continueWatching;
      this.userRatings = userRatings;

      // Prepare unique items for TMDB fetch
      const uniqueItems = this.getUniqueItems(items);
      this.tmdbCache = await BBM.API.batchFetchTMDB(uniqueItems);

      this.setupLazyLoad();
      this.renderHero();
      this.renderRows();
      this.showLoading(false);

      // Deep link: ?tmdbid=XXX opens modal directly
      this.handleDeepLink();

      // Notify new content since last visit
      this.notifyNewContent();

      // Auto-approve pending requests whose content is now available
      BBM.API.checkAndAutoApproveRequests().then(approved => {
        approved.forEach(req => {
          BBM.Toast.show(`🎬 "${req.title}" que vous avez demandé est maintenant disponible !`, 'success', 5000);
        });
      }).catch(e => console.warn('Auto-approve check failed:', e));
    } catch (err) {
      console.error('Init error:', err);
      this.showLoading(false);
      BBM.Toast.show('Erreur de chargement des données', 'error');
    }
  },

  getUniqueItems(items) {
    const map = new Map();
    items.forEach(item => {
      if (!map.has(item.tmdbID)) {
        map.set(item.tmdbID, {
          tmdbID: item.tmdbID,
          category: item.category,
          title: item.seriesTitle || item.title
        });
      }
    });
    return Array.from(map.values());
  },

  /* ----------------------------------------
     Deep Link — ?tmdbid=XXX
     ---------------------------------------- */
  handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const tmdbID = params.get('tmdbid');
    if (!tmdbID) return;

    // Clean URL without reload
    window.history.replaceState({}, '', 'browse.html');

    const data = this.tmdbCache.get(String(tmdbID));
    if (data) {
      const type = data.title ? 'movie' : 'series';
      setTimeout(() => this.openModal(tmdbID, type), 300);
    }
  },

  /* ----------------------------------------
     New Content Notifications
     ---------------------------------------- */
  notifyNewContent() {
    const STORAGE_KEY = 'bbm_last_visit';
    const now = Date.now();
    const lastVisit = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    localStorage.setItem(STORAGE_KEY, String(now));

    // Skip first visit
    if (!lastVisit) return;

    const recent = BBM.API.getRecentlyAdded(50);
    const newItems = recent.filter(item => {
      if (!item.createdAt) return false;
      return new Date(item.createdAt).getTime() > lastVisit;
    });

    if (newItems.length === 0) return;

    // Group: show a summary toast
    const uniqueNew = new Map();
    newItems.forEach(item => {
      if (!uniqueNew.has(item.tmdbID)) {
        const tmdb = this.tmdbCache.get(String(item.tmdbID));
        if (tmdb) uniqueNew.set(item.tmdbID, tmdb.title || tmdb.name || 'Titre');
      }
    });

    const count = uniqueNew.size;
    if (count === 0) return;

    if (count <= 3) {
      const titles = Array.from(uniqueNew.values());
      BBM.Toast.show(`🆕 Nouveau : ${titles.join(', ')}`, 'success', 6000);
    } else {
      BBM.Toast.show(`🆕 ${count} nouveaux titres ajoutés depuis ta dernière visite !`, 'success', 5000);
    }
  },

  /* ----------------------------------------
     Loading
     ---------------------------------------- */
  showLoading(show) {
    const loader = document.getElementById('loading-screen');
    if (!loader) return;
    if (show) {
      loader.classList.remove('fade-out');
    } else {
      loader.classList.add('fade-out');
      setTimeout(() => { loader.style.display = 'none'; }, 500);
    }
  },

  /* ----------------------------------------
     Lazy Loading Images
     ---------------------------------------- */
  setupLazyLoad() {
    this._lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          this._lazyObserver.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
  },

  observeLazyImages(container) {
    if (!this._lazyObserver) return;
    container.querySelectorAll('img[data-src]').forEach(img => {
      this._lazyObserver.observe(img);
    });
  },

  /* ----------------------------------------
     Navbar
     ---------------------------------------- */
  setupNavbar(user) {
    // Scroll effet
    window.addEventListener('scroll', () => {
      const nav = document.querySelector('.navbar');
      nav.classList.toggle('scrolled', window.scrollY > 10);
    });

    // Avatar
    const avatar = document.getElementById('nav-avatar');
    if (avatar) avatar.textContent = BBM.Auth.getInitials();

    const userName = document.getElementById('nav-username');
    if (userName) userName.textContent = BBM.Auth.getDisplayName();

    // Mobile avatar & username
    const mobileAvatar = document.getElementById('mobile-avatar');
    if (mobileAvatar) mobileAvatar.textContent = BBM.Auth.getInitials();
    const mobileUsername = document.getElementById('mobile-username');
    if (mobileUsername) mobileUsername.textContent = BBM.Auth.getDisplayName();

    // Admin link
    const adminBtn = document.getElementById('btn-admin');
    const mobileAdminBtn = document.getElementById('mobile-btn-admin');
    if (user) {
      BBM.Auth.isAdmin().then(isAdmin => {
        if (isAdmin) {
          if (adminBtn) adminBtn.style.display = '';
          if (mobileAdminBtn) mobileAdminBtn.style.display = '';
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => BBM.Auth.logout());
    const mobileLogoutBtn = document.getElementById('mobile-btn-logout');
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', () => BBM.Auth.logout());

    // Mobile request buttons — wire to same handlers as desktop
    const mobileReqBtn = document.getElementById('mobile-btn-request');
    if (mobileReqBtn) mobileReqBtn.addEventListener('click', () => {
      this.closeMobileMenu();
      document.getElementById('btn-request')?.click();
    });
    const mobileMyReqBtn = document.getElementById('mobile-btn-my-requests');
    if (mobileMyReqBtn) mobileMyReqBtn.addEventListener('click', () => {
      this.closeMobileMenu();
      document.getElementById('btn-my-requests')?.click();
    });

    // Nav links
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', (e) => {
        const view = link.dataset.view;
        if (!view) return; // Let normal links (like MCU) navigate
        e.preventDefault();
        this.switchView(view);
        document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    // Random pick
    const randomBtn = document.getElementById('btn-random');
    if (randomBtn) randomBtn.addEventListener('click', () => this.pickRandom());

    // --- Mobile burger menu ---
    this.setupMobileMenu();
  },

  setupMobileMenu() {
    const burgerBtn = document.getElementById('burger-btn');
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const closeBtn = document.getElementById('mobile-menu-close');
    if (!burgerBtn || !menu) return;

    burgerBtn.addEventListener('click', () => this.toggleMobileMenu());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeMobileMenu());
    if (overlay) overlay.addEventListener('click', () => this.closeMobileMenu());

    // Mobile nav links
    document.querySelectorAll('.mobile-menu-link[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        this.switchView(view);
        // Sync active state on both mobile and desktop nav
        document.querySelectorAll('.mobile-menu-link[data-view]').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const desktopLink = document.querySelector(`.nav-links a[data-view="${view}"]`);
        if (desktopLink) desktopLink.classList.add('active');
        this.closeMobileMenu();
      });
    });
  },

  toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const burger = document.getElementById('burger-btn');
    const isOpen = menu.classList.contains('active');
    if (isOpen) {
      this.closeMobileMenu();
    } else {
      menu.classList.add('active');
      overlay.classList.add('active');
      burger.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const burger = document.getElementById('burger-btn');
    if (menu) menu.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (burger) burger.classList.remove('active');
    document.body.style.overflow = '';
  },

  switchView(view) {
    this.currentView = view;
    const browseContent = document.getElementById('browse-content');
    const categoryFilter = document.getElementById('category-filter');
    const searchResults = document.getElementById('search-results');

    browseContent.style.display = 'none';
    categoryFilter.classList.remove('active');
    searchResults.style.display = 'none';
    document.getElementById('genre-filters').innerHTML = '';

    switch (view) {
      case 'home':
        browseContent.style.display = 'block';
        break;
      case 'movies':
        this.showCategory('Films', BBM.API.getMovies().map(m => m.tmdbID));
        break;
      case 'series':
        this.showCategory('Séries', BBM.API.getSeries().map(s => s.tmdbID));
        break;
      case 'collections':
        this.showCollections();
        break;
      case 'mylist':
        this.showCategory('Ma Liste', this.myList);
        break;
      case 'history':
        this.showHistory();
        break;
    }
  },

  showCategory(title, tmdbIDs) {
    const container = document.getElementById('category-filter');
    const header = container.querySelector('.category-filter-header h1');
    const sortSelect = document.getElementById('sort-select');

    header.textContent = title;
    sortSelect.value = 'default';
    this._activeGenre = null;

    // Store current IDs for re-sorting
    this._categoryIDs = [...new Set(tmdbIDs)];

    // Build genre filters (Films / Séries only, not Ma Liste)
    this._buildGenreFilters(title);

    this._renderCategoryGrid();

    // Sort handler
    sortSelect.onchange = () => this._renderCategoryGrid();

    container.classList.add('active');
  },

  _buildGenreFilters(title) {
    const filtersEl = document.getElementById('genre-filters');
    filtersEl.innerHTML = '';

    if (title !== 'Films' && title !== 'Séries') return;

    // Collect all genres from current items
    const genreSet = new Map();
    this._categoryIDs.forEach(id => {
      const tmdb = this.tmdbCache.get(String(id));
      if (!tmdb || !tmdb.genres) return;
      tmdb.genres.forEach(g => {
        genreSet.set(g.id, g.name);
      });
    });

    if (genreSet.size === 0) return;

    // Sort genres alphabetically
    const genres = Array.from(genreSet.entries()).sort((a, b) => a[1].localeCompare(b[1], 'fr'));

    // "Tous" button
    const allBtn = document.createElement('button');
    allBtn.className = 'genre-btn active';
    allBtn.textContent = 'Tous';
    allBtn.addEventListener('click', () => {
      this._activeGenre = null;
      filtersEl.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
      this._renderCategoryGrid();
    });
    filtersEl.appendChild(allBtn);

    genres.forEach(([id, name]) => {
      const btn = document.createElement('button');
      btn.className = 'genre-btn';
      btn.textContent = name;
      btn.addEventListener('click', () => {
        this._activeGenre = id;
        filtersEl.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderCategoryGrid();
      });
      filtersEl.appendChild(btn);
    });
  },

  _renderCategoryGrid() {
    const grid = document.querySelector('.category-grid');
    const sortSelect = document.getElementById('sort-select');
    const sortBy = sortSelect.value;
    grid.innerHTML = '';

    let ids = [...this._categoryIDs];

    // Filter by genre
    if (this._activeGenre) {
      ids = ids.filter(id => {
        const tmdb = this.tmdbCache.get(String(id));
        return tmdb?.genres?.some(g => g.id === this._activeGenre);
      });
    }

    if (sortBy !== 'default') {
      ids.sort((a, b) => {
        const ta = this.tmdbCache.get(String(a));
        const tb = this.tmdbCache.get(String(b));
        if (!ta || !tb) return 0;
        switch (sortBy) {
          case 'title-asc':
            return (ta.title || ta.name || '').localeCompare(tb.title || tb.name || '', 'fr');
          case 'title-desc':
            return (tb.title || tb.name || '').localeCompare(ta.title || ta.name || '', 'fr');
          case 'rating-desc':
            return (tb.vote_average || 0) - (ta.vote_average || 0);
          case 'year-desc':
            return (tb.release_date || tb.first_air_date || '').localeCompare(ta.release_date || ta.first_air_date || '');
          case 'year-asc':
            return (ta.release_date || ta.first_air_date || '').localeCompare(tb.release_date || tb.first_air_date || '');
          default: return 0;
        }
      });
    }

    ids.forEach(id => {
      const tmdb = this.tmdbCache.get(String(id));
      if (!tmdb) return;
      grid.appendChild(this.createCard(String(id), tmdb));
    });
    this.observeLazyImages(grid);
  },

  /* ----------------------------------------
     Watch History
     ---------------------------------------- */
  async showHistory() {
    const container = document.getElementById('category-filter');
    const header = container.querySelector('.category-filter-header h1');
    const sortSelect = document.getElementById('sort-select');
    const grid = document.querySelector('.category-grid');
    const filtersEl = document.getElementById('genre-filters');

    header.textContent = 'Historique';
    sortSelect.value = 'default';
    this._activeGenre = null;
    filtersEl.innerHTML = '';
    grid.innerHTML = '<div class="loader" style="margin:40px auto;grid-column:1/-1"></div>';
    container.classList.add('active');

    const cw = await BBM.API.getContinueWatching();
    const entries = Object.entries(cw);

    // Sort by most recent
    entries.sort((a, b) => {
      const ta = a[1].updatedAt?.toMillis ? a[1].updatedAt.toMillis() : (a[1].updatedAt?.seconds ? a[1].updatedAt.seconds * 1000 : 0);
      const tb = b[1].updatedAt?.toMillis ? b[1].updatedAt.toMillis() : (b[1].updatedAt?.seconds ? b[1].updatedAt.seconds * 1000 : 0);
      return tb - ta;
    });

    const ids = entries.map(([id]) => id);
    this._categoryIDs = ids;
    grid.innerHTML = '';

    if (ids.length === 0) {
      grid.innerHTML = '<div class="no-results" style="grid-column:1/-1"><p>Aucun historique de visionnage</p></div>';
      return;
    }

    ids.forEach(id => {
      const tmdb = this.tmdbCache.get(String(id));
      if (!tmdb) return;
      grid.appendChild(this.createCard(String(id), tmdb));
    });
    this.observeLazyImages(grid);
  },

  /* ----------------------------------------
     Search
     ---------------------------------------- */
  setupSearch() {
    const searchContainer = document.querySelector('.nav-search');
    const searchIcon = document.querySelector('.nav-search-icon');
    const searchInput = document.getElementById('search-input');
    let searchTimeout;

    searchIcon.addEventListener('click', () => {
      searchContainer.classList.toggle('open');
      if (searchContainer.classList.contains('open')) {
        searchInput.focus();
      } else {
        searchInput.value = '';
        if (this.currentView === 'search') this.switchView('home');
      }
    });

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          this.renderTypeahead(query);
        } else {
          this.hideTypeahead();
          if (this.currentView === 'search') this.switchView('home');
        }
      }, 200);
    });

    searchInput.addEventListener('blur', () => {
      setTimeout(() => this.hideTypeahead(), 200);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchContainer.classList.remove('open');
        searchInput.value = '';
        this.hideTypeahead();
        if (this.currentView === 'search') this.switchView('home');
      }
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q.length >= 2) {
          this.hideTypeahead();
          this.performSearch(q);
        }
      }
    });
  },

  renderTypeahead(query) {
    let panel = document.getElementById('typeahead-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'typeahead-panel';
      panel.className = 'typeahead-panel';
      document.body.appendChild(panel);
    }
    const results = BBM.API.search(query).slice(0, 6);
    if (results.length === 0) {
      panel.innerHTML = `<div class="typeahead-empty">Aucun résultat pour « ${query} »</div>`;
    } else {
      panel.innerHTML = results.map(r => {
        const tmdb = this.tmdbCache.get(String(r.tmdbID));
        if (!tmdb) return '';
        const title = tmdb.title || tmdb.name || '';
        const year = (tmdb.release_date || tmdb.first_air_date || '').substring(0, 4);
        const poster = BBM.API.getPosterURL(tmdb.poster_path, 'w185');
        const rating = tmdb.vote_average ? Math.round(tmdb.vote_average * 10) : null;
        const isMovie = !!tmdb.title;
        return `
          <div class="typeahead-item" data-tmdbid="${r.tmdbID}" data-type="${isMovie ? 'movie' : 'series'}">
            ${poster ? `<img src="${poster}" alt="${title}">` : '<div class="typeahead-ph"></div>'}
            <div class="typeahead-meta">
              <div class="typeahead-title">${title}</div>
              <div class="typeahead-sub">
                <span class="typeahead-tag">${isMovie ? 'Film' : 'Série'}</span>
                ${year ? `<span>${year}</span>` : ''}
                ${rating ? `<span class="typeahead-rating">★ ${rating}%</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('') + `<div class="typeahead-footer">Appuyer sur Entrée pour voir tous les résultats</div>`;
    }
    // Position below input
    const searchInput = document.getElementById('search-input');
    const rect = searchInput.getBoundingClientRect();
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.right = `${window.innerWidth - rect.right}px`;
    panel.style.width = `${Math.max(rect.width, 380)}px`;
    panel.classList.add('visible');
    panel.querySelectorAll('.typeahead-item').forEach(it => {
      it.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.hideTypeahead();
        this.openModal(it.dataset.tmdbid, it.dataset.type);
      });
    });
  },

  hideTypeahead() {
    const panel = document.getElementById('typeahead-panel');
    if (panel) panel.classList.remove('visible');
  },

  performSearch(query) {
    let results = BBM.API.search(query);
    const container = document.getElementById('search-results');
    const grid = container.querySelector('.search-grid');
    const titleEl = container.querySelector('.search-results-title');

    document.getElementById('browse-content').style.display = 'none';
    document.getElementById('category-filter').classList.remove('active');

    // Populate genre & year dropdowns once
    if (!this._searchFiltersBuilt) {
      this._searchFiltersBuilt = true;
      const genres = new Set();
      const years = new Set();
      this.tmdbCache.forEach(data => {
        (data.genres || []).forEach(g => genres.add(g.name));
        const y = (data.release_date || data.first_air_date || '').slice(0, 4);
        if (y) years.add(y);
      });
      const genreSelect = document.getElementById('search-filter-genre');
      [...genres].sort().forEach(g => {
        genreSelect.insertAdjacentHTML('beforeend', `<option value="${g}">${g}</option>`);
      });
      const yearSelect = document.getElementById('search-filter-year');
      [...years].sort((a, b) => b - a).forEach(y => {
        yearSelect.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
      });
      // Bind filter change events
      container.querySelector('.search-filters').addEventListener('change', () => {
        const q = document.getElementById('search-input').value.trim();
        if (q.length >= 2) this.performSearch(q);
      });
    }

    // Apply filters
    const typeFilter = document.getElementById('search-filter-type').value;
    const genreFilter = document.getElementById('search-filter-genre').value;
    const yearFilter = document.getElementById('search-filter-year').value;
    const sortBy = document.getElementById('search-sort').value;

    results = results.filter(item => {
      const tmdb = this.tmdbCache.get(String(item.tmdbID));
      if (!tmdb) return false;
      if (typeFilter !== 'all') {
        const isMovie = !!tmdb.title;
        if (typeFilter === 'movie' && !isMovie) return false;
        if (typeFilter === 'tv' && isMovie) return false;
      }
      if (genreFilter !== 'all') {
        if (!(tmdb.genres || []).some(g => g.name === genreFilter)) return false;
      }
      if (yearFilter !== 'all') {
        const y = (tmdb.release_date || tmdb.first_air_date || '').slice(0, 4);
        if (y !== yearFilter) return false;
      }
      return true;
    });

    // Sort
    if (sortBy !== 'relevance') {
      results.sort((a, b) => {
        const ta = this.tmdbCache.get(String(a.tmdbID));
        const tb = this.tmdbCache.get(String(b.tmdbID));
        if (!ta || !tb) return 0;
        if (sortBy === 'title-asc') return (ta.title || ta.name || '').localeCompare(tb.title || tb.name || '');
        if (sortBy === 'rating-desc') return (tb.vote_average || 0) - (ta.vote_average || 0);
        if (sortBy === 'year-desc') {
          const ya = (ta.release_date || ta.first_air_date || '').slice(0, 4);
          const yb = (tb.release_date || tb.first_air_date || '').slice(0, 4);
          return yb.localeCompare(ya);
        }
        return 0;
      });
    }

    titleEl.textContent = results.length > 0
      ? `Résultats pour "${query}"`
      : '';

    grid.innerHTML = '';

    if (results.length === 0) {
      grid.innerHTML = `<div class="no-results" style="grid-column: 1 / -1">
        <p>Aucun résultat pour "${query}"</p>
        <p style="font-size: 0.9rem; margin-top: 8px; color: var(--bbm-text-muted)">Essaie un autre titre ou ajuste les filtres</p>
      </div>`;
    } else {
      results.forEach(item => {
        const tmdb = this.tmdbCache.get(String(item.tmdbID));
        if (!tmdb) return;
        const card = this.createCard(String(item.tmdbID), tmdb);
        grid.appendChild(card);
      });
    }

    container.style.display = 'block';
    this.currentView = 'search';
    this.observeLazyImages(grid);
  },

  /* ----------------------------------------
     Hero / Billboard
     ---------------------------------------- */
  renderHero() {
    // Candidates : titres avec backdrop et note >= 7 en priorité
    const allCandidates = [];
    this.tmdbCache.forEach((data, tmdbID) => {
      if (data.backdrop_path) {
        allCandidates.push({ tmdbID, data, score: (data.vote_average || 0) * (data.vote_count > 100 ? 1 : 0.5) });
      }
    });
    if (allCandidates.length === 0) return;

    allCandidates.sort((a, b) => b.score - a.score);
    const topPool = allCandidates.slice(0, Math.min(20, allCandidates.length));
    const hero = topPool[Math.floor(Math.random() * topPool.length)];
    const { tmdbID, data } = hero;
    const isMovie = !!data.title;
    const title = data.title || data.name || '';
    const year = (data.release_date || data.first_air_date || '').substring(0, 4);
    const rating = data.vote_average ? Math.round(data.vote_average * 10) : null;
    const runtime = isMovie && data.runtime ? `${Math.floor(data.runtime / 60)}h ${String(data.runtime % 60).padStart(2, '0')}` : null;
    const seasons = !isMovie && data.number_of_seasons ? `${data.number_of_seasons} saison${data.number_of_seasons > 1 ? 's' : ''}` : null;
    const genres = (data.genres || []).slice(0, 3).map(g => g.name);
    const logoURL = BBM.API.getLogoURL(data, 'w500');
    const backdropURL = BBM.API.getBackdropURL(data.backdrop_path, 'original');
    const trailer = (data.videos?.results || []).find(v =>
      v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );

    const metaPills = [];
    if (rating) metaPills.push(`<span class="hero-rating"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l2.6 7.4h7.8l-6.3 4.6 2.4 7.4L12 16.8 5.5 21.4l2.4-7.4L1.6 9.4h7.8z"/></svg>${rating}%</span>`);
    if (year) metaPills.push(`<span class="hero-meta-item">${year}</span>`);
    if (runtime) metaPills.push(`<span class="hero-meta-item">${runtime}</span>`);
    if (seasons) metaPills.push(`<span class="hero-meta-item">${seasons}</span>`);
    metaPills.push(`<span class="hero-meta-item hero-hd">HD</span>`);

    const billboard = document.getElementById('billboard');
    const titleBlock = logoURL
      ? `<img class="billboard-logo" src="${logoURL}" alt="${title}">`
      : `<h1 class="billboard-title">${title}</h1>`;

    billboard.innerHTML = `
      <div class="billboard-bg">
        <img class="billboard-backdrop" src="${backdropURL}" alt="${title}">
        ${trailer ? `<div class="billboard-trailer" data-video-id="${trailer.key}"></div>` : ''}
        <div class="billboard-vignette"></div>
        <div class="billboard-grain"></div>
      </div>
      <div class="billboard-info">
        <div class="billboard-label">
          <span class="billboard-label-dot"></span>
          ${isMovie ? 'Film à la une' : 'Série à la une'}
        </div>
        ${titleBlock}
        <div class="billboard-meta">${metaPills.join('')}</div>
        ${genres.length ? `<div class="billboard-genres">${genres.map(g => `<span class="billboard-genre-chip">${g}</span>`).join('')}</div>` : ''}
        <p class="billboard-overview">${data.overview || ''}</p>
        <div class="billboard-buttons">
          <button class="btn-play" data-tmdbid="${tmdbID}" data-type="${isMovie ? 'movie' : 'series'}">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="4,2 22,12 4,22"/></svg>
            Lecture
          </button>
          <button class="btn-info" data-tmdbid="${tmdbID}" data-type="${isMovie ? 'movie' : 'series'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Plus d'infos
          </button>
          <button class="btn-mute" id="hero-mute" title="Son" aria-label="Son" style="display:none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Events
    billboard.querySelector('.btn-play').addEventListener('click', () => {
      this.playTitle(tmdbID, isMovie ? 'movie' : 'series');
    });
    billboard.querySelector('.btn-info').addEventListener('click', () => {
      this.openModal(tmdbID, isMovie ? 'movie' : 'series');
    });

    // Parallax on scroll (desktop only)
    if (!this._heroParallaxBound && !('ontouchstart' in window)) {
      this._heroParallaxBound = true;
      const onScroll = () => {
        const y = window.scrollY;
        if (y > 700) return;
        const bg = document.querySelector('.billboard-bg');
        const info = document.querySelector('.billboard-info');
        if (bg) bg.style.transform = `translateY(${y * 0.4}px) scale(${1 + y * 0.0003})`;
        if (info) info.style.transform = `translateY(${y * 0.15}px)`;
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // Trailer autoplay after 2.5s (desktop, non-tv, non-reduced-motion)
    if (trailer && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('tv-mode') && !('ontouchstart' in window)) {
      clearTimeout(this._heroTrailerTimer);
      this._heroTrailerTimer = setTimeout(() => {
        const trailerSlot = billboard.querySelector('.billboard-trailer');
        if (!trailerSlot) return;
        const iframe = document.createElement('iframe');
        iframe.id = 'hero-trailer-iframe';
        iframe.src = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailer.key}&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&disablekb=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
        iframe.allow = 'autoplay; encrypted-media';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('tabindex', '-1');
        trailerSlot.appendChild(iframe);
        requestAnimationFrame(() => trailerSlot.classList.add('active'));
        const muteBtn = document.getElementById('hero-mute');
        if (muteBtn) {
          muteBtn.style.display = 'inline-flex';
          this._heroMuted = true;
          muteBtn.addEventListener('click', () => this.toggleHeroMute());
        }
      }, 2500);
    }
  },

  toggleHeroMute() {
    const iframe = document.getElementById('hero-trailer-iframe');
    const btn = document.getElementById('hero-mute');
    if (!iframe || !iframe.contentWindow || !btn) return;
    const shouldMute = !this._heroMuted; // we track muted state; toggle flips it
    // If currently muted (_heroMuted true), unmute now
    const action = this._heroMuted ? 'unMute' : 'mute';
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: action, args: [] }),
      '*'
    );
    this._heroMuted = !this._heroMuted;
    btn.classList.toggle('is-muted', this._heroMuted);
    btn.setAttribute('aria-label', this._heroMuted ? 'Activer le son' : 'Couper le son');
    btn.innerHTML = this._heroMuted
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
           <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
           <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
         </svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
           <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
           <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
         </svg>`;
  },

  /* ----------------------------------------
     Content Rows
     ---------------------------------------- */
  renderRows() {
    const container = document.getElementById('rows-container');
    container.innerHTML = '';

    // Continue Watching (filter out >= 90% as finished)
    const cwEntries = Object.entries(this.continueWatching)
      .filter(([, cw]) => !(cw.duration > 0 && (cw.progress / cw.duration) >= 0.9));
    if (cwEntries.length > 0) {
      const cwItems = cwEntries
        .sort((a, b) => {
          const tA = a[1].updatedAt?.seconds || 0;
          const tB = b[1].updatedAt?.seconds || 0;
          return tB - tA;
        })
        .map(([id]) => id);
      this.renderRow(container, 'Reprendre', cwItems, true);
    }

    // Ma Liste
    if (this.myList.length > 0) {
      this.renderRow(container, 'Ma Liste', this.myList);
    }

    // Top 10 de la semaine (best-rated)
    const top10 = this.computeTop10();
    if (top10.length >= 5) {
      this.renderTop10Row(container, 'Top 10 cette semaine', top10);
    }

    // Récemment ajoutés
    const recent = BBM.API.getRecentlyAdded(20).map(i => i.tmdbID);
    this.renderRow(container, 'Récemment ajoutés', recent);

    // Recommandé pour toi (basé sur les notes)
    this.renderRecommendationsRow(container);

    // Bento spotlight — genre aléatoire mis en vedette
    const bentoGenre = this.pickBentoSpotlight();
    if (bentoGenre) {
      this.renderBentoSpotlight(container, bentoGenre.name, bentoGenre.ids);
    }

    // Films
    const movieIDs = BBM.API.getMovies().map(m => m.tmdbID);
    if (movieIDs.length > 0) {
      const shuffled = [...new Set(movieIDs)].sort(() => Math.random() - 0.5);
      this.renderRow(container, 'Films', shuffled);
    }

    // Séries
    const seriesIDs = BBM.API.getSeries().map(s => s.tmdbID);
    if (seriesIDs.length > 0) {
      this.renderRow(container, 'Séries', seriesIDs);
    }

    // Action, Comédie, etc. — via TMDB genres
    const genreRows = this.groupByGenre();
    genreRows.forEach(({ name, ids }) => {
      if (ids.length >= 3) {
        this.renderRow(container, name, ids);
      }
    });
  },

  computeTop10() {
    const items = [];
    this.tmdbCache.forEach((data, tmdbID) => {
      if (!data.poster_path) return;
      const vote = data.vote_average || 0;
      const pop = data.popularity || 0;
      if (vote < 6 || (data.vote_count || 0) < 50) return;
      items.push({ tmdbID, score: vote * 10 + Math.log10(pop + 1) * 3 });
    });
    items.sort((a, b) => b.score - a.score);
    return items.slice(0, 10).map(i => i.tmdbID);
  },

  renderTop10Row(parent, title, tmdbIDs) {
    const row = document.createElement('div');
    row.className = 'row row-top10';
    row.innerHTML = `
      <div class="row-header">
        <h2 class="row-title">
          <span class="top10-badge"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l2.6 7.4h7.8l-6.3 4.6 2.4 7.4L12 16.8 5.5 21.4l2.4-7.4L1.6 9.4h7.8z"/></svg>TOP 10</span>
          ${title}
        </h2>
      </div>
      <div class="row-container">
        <button class="row-btn row-btn-left">‹</button>
        <div class="row-content row-top10-content"></div>
        <button class="row-btn row-btn-right">›</button>
      </div>
    `;
    const content = row.querySelector('.row-content');
    tmdbIDs.forEach((tmdbID, idx) => {
      const tmdb = this.tmdbCache.get(String(tmdbID));
      if (!tmdb) return;
      const wrap = document.createElement('div');
      wrap.className = 'top10-item';
      wrap.innerHTML = `<span class="top10-number">${idx + 1}</span>`;
      const card = this.createCard(String(tmdbID), tmdb, false);
      card.classList.add('top10-card');
      wrap.appendChild(card);
      content.appendChild(wrap);
    });
    const btnLeft = row.querySelector('.row-btn-left');
    const btnRight = row.querySelector('.row-btn-right');
    btnLeft.addEventListener('click', () => content.scrollBy({ left: -content.clientWidth * 0.8, behavior: 'smooth' }));
    btnRight.addEventListener('click', () => content.scrollBy({ left: content.clientWidth * 0.8, behavior: 'smooth' }));
    parent.appendChild(row);
    this.observeLazyImages(row);
  },

  pickBentoSpotlight() {
    const rows = this.groupByGenre();
    if (rows.length === 0) return null;
    const pool = rows.filter(r => r.ids.length >= 6);
    if (pool.length === 0) return null;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    // Keep titles with backdrop + good rating for bento beauty
    const scored = picked.ids
      .map(id => ({ id, data: this.tmdbCache.get(String(id)) }))
      .filter(x => x.data && x.data.backdrop_path && x.data.poster_path)
      .sort((a, b) => (b.data.vote_average || 0) - (a.data.vote_average || 0))
      .slice(0, 6);
    if (scored.length < 6) return null;
    return { name: picked.name, ids: scored.map(s => s.id) };
  },

  renderBentoSpotlight(parent, genreName, tmdbIDs) {
    const section = document.createElement('section');
    section.className = 'bento-spotlight';
    const ids = tmdbIDs.slice(0, 6);
    const items = ids.map(id => ({ id, data: this.tmdbCache.get(String(id)) })).filter(x => x.data);
    if (items.length < 6) return;

    const bigOne = items[0];
    const isMovieBig = !!bigOne.data.title;
    const titleBig = bigOne.data.title || bigOne.data.name;
    const bigBackdrop = BBM.API.getBackdropURL(bigOne.data.backdrop_path, 'w1280');
    const bigLogo = BBM.API.getLogoURL(bigOne.data, 'w300');
    const bigRating = bigOne.data.vote_average ? Math.round(bigOne.data.vote_average * 10) : null;

    section.innerHTML = `
      <div class="bento-header">
        <span class="bento-kicker">Spotlight · ${genreName}</span>
        <h2 class="bento-title">Notre sélection <em>${genreName}</em></h2>
      </div>
      <div class="bento-grid">
        <a class="bento-cell bento-big" data-tmdbid="${bigOne.id}" data-type="${isMovieBig ? 'movie' : 'series'}">
          <img class="bento-img" src="${bigBackdrop}" alt="${titleBig}">
          <div class="bento-gradient"></div>
          <div class="bento-content">
            ${bigLogo ? `<img class="bento-logo" src="${bigLogo}" alt="${titleBig}">` : `<h3 class="bento-cell-title">${titleBig}</h3>`}
            ${bigRating ? `<div class="bento-rating">★ ${bigRating}%</div>` : ''}
            <div class="bento-cta">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="4,2 22,12 4,22"/></svg>
              Regarder
            </div>
          </div>
        </a>
        ${items.slice(1, 6).map(it => {
          const m = !!it.data.title;
          const t = it.data.title || it.data.name;
          const bk = BBM.API.getBackdropURL(it.data.backdrop_path, 'w780');
          const r = it.data.vote_average ? Math.round(it.data.vote_average * 10) : null;
          return `
            <a class="bento-cell bento-small" data-tmdbid="${it.id}" data-type="${m ? 'movie' : 'series'}">
              <img class="bento-img" src="${bk}" alt="${t}">
              <div class="bento-gradient"></div>
              <div class="bento-content">
                <h3 class="bento-cell-title">${t}</h3>
                ${r ? `<div class="bento-rating small">★ ${r}%</div>` : ''}
              </div>
            </a>
          `;
        }).join('')}
      </div>
    `;

    section.querySelectorAll('.bento-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        this.openModal(cell.dataset.tmdbid, cell.dataset.type);
      });
    });

    parent.appendChild(section);
  },

  groupByGenre() {
    const genreMap = new Map();

    this.tmdbCache.forEach((data, tmdbID) => {
      if (data.genres) {
        data.genres.forEach(g => {
          if (!genreMap.has(g.name)) genreMap.set(g.name, []);
          genreMap.get(g.name).push(tmdbID);
        });
      }
    });

    return Array.from(genreMap.entries())
      .map(([name, ids]) => ({ name, ids: [...new Set(ids)] }))
      .sort((a, b) => b.ids.length - a.ids.length)
      .slice(0, 5);
  },

  renderRecommendationsRow(container) {
    if (!this.userRatings || Object.keys(this.userRatings).length < 2) return;

    // Score genres by user ratings (weight = rating value)
    const genreScores = new Map();
    const ratedIDs = new Set(Object.keys(this.userRatings));

    for (const [tmdbID, rating] of Object.entries(this.userRatings)) {
      if (rating < 3) continue; // only consider titles rated 3+
      const data = this.tmdbCache.get(String(tmdbID));
      if (!data || !data.genres) continue;
      data.genres.forEach(g => {
        genreScores.set(g.id, (genreScores.get(g.id) || 0) + rating);
      });
    }

    if (genreScores.size === 0) return;

    // Score every unrated title by summing its genre scores
    const candidates = [];
    this.tmdbCache.forEach((data, id) => {
      if (ratedIDs.has(id)) return; // skip already rated
      if (!data.genres) return;
      let score = 0;
      data.genres.forEach(g => { score += genreScores.get(g.id) || 0; });
      // Bonus for higher TMDB rating
      if (data.vote_average) score += data.vote_average * 0.5;
      if (score > 0) candidates.push({ id, score });
    });

    candidates.sort((a, b) => b.score - a.score);
    const recoIDs = candidates.slice(0, 20).map(c => c.id);

    if (recoIDs.length >= 3) {
      this.renderRow(container, 'Recommandé pour toi', recoIDs);
    }
  },

  renderRow(parent, title, tmdbIDs, isContinueWatching = false) {
    const uniqueIDs = [...new Set(tmdbIDs)];
    const validIDs = uniqueIDs.filter(id => this.tmdbCache.has(String(id)));
    if (validIDs.length === 0) return;

    const row = document.createElement('div');
    row.className = 'row';

    row.innerHTML = `
      <div class="row-header">
        <h2 class="row-title">${title}</h2>
        <span class="row-see-all">Tout voir ›</span>
      </div>
      <div class="row-container">
        <button class="row-btn row-btn-left">‹</button>
        <div class="row-content"></div>
        <button class="row-btn row-btn-right">›</button>
      </div>
    `;

    const content = row.querySelector('.row-content');

    validIDs.forEach(tmdbID => {
      const tmdb = this.tmdbCache.get(String(tmdbID));
      if (!tmdb) return;
      const card = this.createCard(String(tmdbID), tmdb, isContinueWatching);
      content.appendChild(card);
    });

    // Scroll buttons
    const btnLeft = row.querySelector('.row-btn-left');
    const btnRight = row.querySelector('.row-btn-right');

    btnLeft.addEventListener('click', () => {
      content.scrollBy({ left: -content.clientWidth * 0.8, behavior: 'smooth' });
    });

    btnRight.addEventListener('click', () => {
      content.scrollBy({ left: content.clientWidth * 0.8, behavior: 'smooth' });
    });

    parent.appendChild(row);
    this.observeLazyImages(row);
  },

  /* ----------------------------------------
     Title Cards
     ---------------------------------------- */
  createCard(tmdbID, tmdb, isContinueWatching = false) {
    const card = document.createElement('div');
    card.className = 'title-card';
    card.dataset.tmdbid = tmdbID;
    card.dataset.title = tmdb.title || tmdb.name || 'Sans titre';

    const isMovie = !!tmdb.title;
    const title = tmdb.title || tmdb.name || 'Sans titre';
    const posterURL = BBM.API.getPosterURL(tmdb.poster_path);
    const year = (tmdb.release_date || tmdb.first_air_date || '').substring(0, 4);
    const rating = tmdb.vote_average ? Math.round(tmdb.vote_average * 10) : null;
    const genres = (tmdb.genres || []).slice(0, 3);
    const inList = this.myList.includes(String(tmdbID));

    // Watched badge + progress bar
    const cw = this.continueWatching[tmdbID];
    const isWatched = cw && (cw.allWatched || (cw.duration > 0 && (cw.progress / cw.duration) >= 0.9));
    let progressHTML = '';
    if (isContinueWatching && cw && !isWatched) {
      const pct = cw.duration ? Math.min(100, Math.round((cw.progress / cw.duration) * 100)) : 0;
      const remaining = cw.duration - cw.progress;
      const remMin = Math.ceil(remaining / 60);
      const remLabel = remMin >= 60 ? `${Math.floor(remMin / 60)}h${String(remMin % 60).padStart(2, '0')} restantes` : `${remMin} min restantes`;
      progressHTML = `
        <div class="watch-progress-info">${remLabel}</div>
        <div class="watch-progress"><div class="watch-progress-bar" style="width: ${pct}%"></div></div>`;
    }

    const watchedBadge = isWatched && !isContinueWatching ? '<div class="watched-badge">VU</div>' : '';
    const isNew = !isWatched && BBM.API.isNewlyAdded(tmdbID);

    card.innerHTML = `
      <div class="title-card-img">
        ${isNew ? '<div class="new-badge">NOUVEAU</div>' : ''}
        ${watchedBadge}
        ${posterURL ? `<img data-src="${posterURL}" alt="${title}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:0.8rem;padding:10px;text-align:center">${title}</div>`}
        <div class="title-card-overlay">
          <div class="card-buttons">
            <button class="btn-icon accent btn-play-card" title="Lecture">▶</button>
            <button class="btn-icon btn-add-list" title="${inList ? 'Retirer de Ma Liste' : 'Ajouter à Ma Liste'}">${inList ? '✓' : '+'}</button>
            <button class="btn-icon expand btn-expand-card" title="Plus d'infos">▼</button>
          </div>
          <div class="card-name">${title}</div>
          <div class="card-meta">
            ${rating ? `<span class="match">${rating}%</span>` : ''}
            <span class="tag">${isMovie ? 'Film' : 'Série'}</span>
            ${year ? `<span class="year">${year}</span>` : ''}
          </div>
          ${genres.length > 0 ? `<div class="card-genres">${genres.map(g => `<span>${g.name}</span>`).join('')}</div>` : ''}
          ${progressHTML}
        </div>
      </div>
    `;

    // Events
    card.querySelector('.btn-play-card').addEventListener('click', (e) => {
      e.stopPropagation();
      this.playTitle(tmdbID, isMovie ? 'movie' : 'series');
    });

    card.querySelector('.btn-add-list').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMyList(tmdbID, e.currentTarget);
    });

    card.querySelector('.btn-expand-card').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openModal(tmdbID, isMovie ? 'movie' : 'series');
    });

    // Click on card image -> open modal
    card.querySelector('.title-card-img').addEventListener('click', () => {
      this.openModal(tmdbID, isMovie ? 'movie' : 'series');
    });

    // Rich hover panel (desktop + pointer only)
    if (!('ontouchstart' in window) && !document.body.classList.contains('tv-mode')) {
      this.attachHoverPanel(card, tmdbID, tmdb, isMovie, isContinueWatching);
    }

    // Ribbon TOP — titres populaires et bien notés
    if ((tmdb.vote_count || 0) > 1500 && (tmdb.vote_average || 0) >= 7.5) {
      const img = card.querySelector('.title-card-img');
      if (img && !img.querySelector('.ribbon-top') && !img.querySelector('.new-badge')) {
        const r = document.createElement('div');
        r.className = 'ribbon-top';
        r.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" style="margin-right:3px;vertical-align:-1px"><path d="M12 2l2.6 7.4h7.8l-6.3 4.6 2.4 7.4L12 16.8 5.5 21.4l2.4-7.4L1.6 9.4h7.8z"/></svg>TOP`;
        img.appendChild(r);
      }
    }

    return card;
  },

  attachHoverPanel(card, tmdbID, tmdb, isMovie, isContinueWatching = false) {
    let hoverTimer;
    let panel;
    const showPanel = () => {
      if (panel) return;
      const title = tmdb.title || tmdb.name || '';
      const year = (tmdb.release_date || tmdb.first_air_date || '').substring(0, 4);
      const rating = tmdb.vote_average ? Math.round(tmdb.vote_average * 10) : null;
      const runtime = isMovie && tmdb.runtime ? `${Math.floor(tmdb.runtime / 60)}h${String(tmdb.runtime % 60).padStart(2,'0')}` : null;
      const seasons = !isMovie && tmdb.number_of_seasons ? `${tmdb.number_of_seasons} S` : null;
      const genres = (tmdb.genres || []).slice(0, 3).map(g => g.name);
      const backdrop = BBM.API.getBackdropURL(tmdb.backdrop_path, 'w780') || BBM.API.getPosterURL(tmdb.poster_path);
      panel = document.createElement('div');
      panel.className = 'hover-panel';
      const removeBtnHTML = isContinueWatching
        ? `<button class="hp-btn hp-remove" title="Retirer de Reprendre" aria-label="Retirer de Reprendre"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`
        : '';
      panel.innerHTML = `
        <div class="hover-panel-img">
          ${backdrop ? `<img src="${backdrop}" alt="${title}">` : ''}
          <div class="hover-panel-gradient"></div>
        </div>
        <div class="hover-panel-body">
          <div class="hover-panel-actions">
            <button class="hp-btn hp-play"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="4,2 22,12 4,22"/></svg></button>
            <button class="hp-btn hp-list">${this.myList.includes(String(tmdbID)) ? '✓' : '+'}</button>
            <button class="hp-btn hp-info">i</button>
            ${removeBtnHTML}
          </div>
          <div class="hover-panel-title">${title}</div>
          <div class="hover-panel-meta">
            ${rating ? `<span class="hp-rating">${rating}%</span>` : ''}
            ${year ? `<span>${year}</span>` : ''}
            ${runtime ? `<span>${runtime}</span>` : ''}
            ${seasons ? `<span>${seasons}</span>` : ''}
            <span class="hp-hd">HD</span>
          </div>
          ${genres.length ? `<div class="hover-panel-genres">${genres.map(g => `<span>${g}</span>`).join('<i>•</i>')}</div>` : ''}
          ${tmdb.overview ? `<p class="hover-panel-overview">${tmdb.overview}</p>` : ''}
        </div>
      `;
      document.body.appendChild(panel);
      const rect = card.getBoundingClientRect();
      const pw = 340;
      const leftIdeal = rect.left + rect.width / 2 - pw / 2;
      const left = Math.max(16, Math.min(window.innerWidth - pw - 16, leftIdeal));
      panel.style.left = `${left}px`;
      panel.style.top = `${rect.top + window.scrollY - 40}px`;
      requestAnimationFrame(() => panel.classList.add('visible'));
      panel.querySelector('.hp-play').addEventListener('click', (e) => {
        e.stopPropagation();
        this.playTitle(tmdbID, isMovie ? 'movie' : 'series');
      });
      panel.querySelector('.hp-list').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMyList(tmdbID, e.currentTarget);
      });
      panel.querySelector('.hp-info').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openModal(tmdbID, isMovie ? 'movie' : 'series');
      });
      const removeBtn = panel.querySelector('.hp-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await BBM.API.removeContinueWatching(tmdbID);
          delete this.continueWatching[tmdbID];
          card.remove();
          removePanel();
          BBM.Toast.show('Retiré de Reprendre');
        });
      }
      panel.addEventListener('mouseleave', removePanel);
    };
    const removePanel = () => {
      clearTimeout(hoverTimer);
      if (panel) {
        panel.classList.remove('visible');
        const p = panel;
        panel = null;
        setTimeout(() => p.remove(), 250);
      }
    };
    card.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(showPanel, 550);
    });
    card.addEventListener('mouseleave', (e) => {
      clearTimeout(hoverTimer);
      setTimeout(() => {
        if (!panel || !panel.matches(':hover')) removePanel();
      }, 80);
    });
  },

  /* ----------------------------------------
     My List toggle
     ---------------------------------------- */
  async toggleMyList(tmdbID, btn) {
    const idx = this.myList.indexOf(String(tmdbID));
    if (idx >= 0) {
      this.myList.splice(idx, 1);
      await BBM.API.removeFromMyList(tmdbID);
      if (btn) { btn.textContent = '+'; btn.title = 'Ajouter à Ma Liste'; }
      BBM.Toast.show('Retiré de Ma Liste');
    } else {
      this.myList.push(String(tmdbID));
      await BBM.API.addToMyList(tmdbID);
      if (btn) { btn.textContent = '✓'; btn.title = 'Retirer de Ma Liste'; }
      BBM.Toast.show('Ajouté à Ma Liste', 'success');
    }
  },

  /* ----------------------------------------
     Detail Modal
     ---------------------------------------- */
  setupModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  async openModal(tmdbID, type) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');
    const isMovie = type === 'movie';

    const tmdb = this.tmdbCache.get(String(tmdbID));
    if (!tmdb) return;

    const title = tmdb.title || tmdb.name || 'Sans titre';
    const backdropURL = BBM.API.getBackdropURL(tmdb.backdrop_path);
    const year = (tmdb.release_date || tmdb.first_air_date || '').substring(0, 4);
    const rating = tmdb.vote_average ? Math.round(tmdb.vote_average * 10) : null;
    const runtime = isMovie && tmdb.runtime ? `${Math.floor(tmdb.runtime / 60)}h ${tmdb.runtime % 60}min` : null;
    const seasons = !isMovie ? (tmdb.number_of_seasons || 0) : 0;
    const castMembers = tmdb.credits?.cast?.slice(0, 12) || [];
    const genres = (tmdb.genres || []).map(g => g.name).join(', ');
    const director = isMovie
      ? tmdb.credits?.crew?.find(c => c.job === 'Director')?.name || ''
      : '';
    const creators = !isMovie
      ? (tmdb.created_by || []).map(c => c.name).join(', ')
      : '';

    // Trailer YouTube
    const trailer = (tmdb.videos?.results || []).find(v =>
      v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );

    const inList = this.myList.includes(String(tmdbID));
    const cw = this.continueWatching[String(tmdbID)];
    const isWatched = cw && (cw.allWatched || (cw.duration > 0 && (cw.progress / cw.duration) >= 0.9));

    // Get available seasons from our data
    let availableSeasons = [];
    if (!isMovie) {
      const seriesData = BBM.API.getSeriesMap().get(String(tmdbID));
      if (seriesData) {
        const seasonSet = new Set(seriesData.episodes.map(e => e.seasonNumber));
        availableSeasons = Array.from(seasonSet).sort((a, b) => a - b);
      }
    }

    modal.innerHTML = `
      <button class="modal-close" id="modal-close">✕</button>
      <div class="modal-hero">
        ${backdropURL ? `<img src="${backdropURL}" alt="${title}">` : '<div style="width:100%;height:100%;background:#333"></div>'}
        <div class="modal-hero-gradient"></div>
        <div class="modal-hero-info">
          <h1 class="modal-hero-title">${title}</h1>
          <div class="modal-hero-buttons">
            <button class="btn-play" id="modal-play">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><polygon points="4,2 22,12 4,22"/></svg>
              Lecture
            </button>
            <button class="btn-icon" id="modal-list" title="${inList ? 'Retirer de Ma Liste' : 'Ajouter à Ma Liste'}">
              ${inList ? '✓' : '+'}
            </button>
            <button class="btn-icon${isWatched ? ' watched' : ''}" id="modal-mark-watched" title="${isWatched ? 'Retirer des vus' : 'Marquer comme vu'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            ${trailer ? `<button class="btn-trailer" id="modal-trailer" title="Bande-annonce">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>
              Bande-annonce
            </button>` : ''}
            <button class="btn-icon" id="modal-share" title="Partager">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="modal-body">
        <div class="modal-meta">
          ${rating ? `<span class="modal-match">${rating}% Match</span>` : ''}
          ${year ? `<span class="modal-year">${year}</span>` : ''}
          ${runtime ? `<span class="modal-runtime">${runtime}</span>` : ''}
          ${seasons ? `<span class="modal-runtime">${seasons} saison${seasons > 1 ? 's' : ''}</span>` : ''}
          <span class="modal-maturity">${isMovie ? 'Film' : 'Série'}</span>
        </div>
        <div id="modal-star-rating"></div>
        <div class="modal-columns">
          <div class="modal-overview">${tmdb.overview || 'Aucune description disponible.'}</div>
          <div class="modal-details-list">
            ${genres ? `<p>Genres : <span>${genres}</span></p>` : ''}
            ${director ? `<p>Réalisateur : <span>${director}</span></p>` : ''}
            ${creators ? `<p>Créateurs : <span>${creators}</span></p>` : ''}
          </div>
        </div>
        ${castMembers.length > 0 ? `
        <div class="modal-cast">
          <h3 class="modal-cast-title">Casting</h3>
          <div class="modal-cast-scroll">
            ${castMembers.map(c => {
              const profileURL = BBM.API.getProfileURL(c.profile_path);
              return `<div class="modal-cast-card" data-person-id="${c.id}" role="button" tabindex="0">
                <div class="modal-cast-photo">
                  ${profileURL ? `<img data-src="${profileURL}" alt="${c.name}">` : `<div class="modal-cast-placeholder">${c.name.charAt(0)}</div>`}
                </div>
                <div class="modal-cast-name">${c.name}</div>
                <div class="modal-cast-role">${c.character || ''}</div>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}
        ${!isMovie && availableSeasons.length > 0 ? `
          <div class="modal-episodes" id="modal-episodes">
            <div class="modal-episodes-header">
              <h3>Épisodes</h3>
              <div class="season-dropdown" id="season-dropdown">
                <button class="season-dropdown-toggle" id="season-dropdown-toggle" type="button">
                  <span class="season-dropdown-label">Saison ${availableSeasons[0]}</span>
                  <svg class="season-dropdown-arrow" width="12" height="7" viewBox="0 0 12 7" fill="none"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <ul class="season-dropdown-menu" id="season-dropdown-menu">
                  ${availableSeasons.map((s, i) => `<li class="season-dropdown-item${i === 0 ? ' active' : ''}" data-value="${s}">Saison ${s}</li>`).join('')}
                </ul>
              </div>
            </div>
            <div id="episodes-list"></div>
          </div>
        ` : ''}
      </div>
    `;

    // Events
    modal.querySelector('#modal-close').addEventListener('click', () => this.closeModal());

    modal.querySelector('#modal-play').addEventListener('click', () => {
      this.closeModal();
      this.playTitle(tmdbID, type);
    });

    // Trailer
    const trailerBtn = modal.querySelector('#modal-trailer');
    if (trailerBtn) {
      trailerBtn.addEventListener('click', () => {
        this.openTrailer(trailer.key);
      });
    }

    // Share
    modal.querySelector('#modal-share').addEventListener('click', async () => {
      const shareURL = `${location.origin}${location.pathname}?tmdbid=${tmdbID}`;
      const shareData = { title: `${title} — BoomBoomMovie`, url: shareURL };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (e) { /* cancelled */ }
      } else {
        try {
          await navigator.clipboard.writeText(shareURL);
          BBM.Toast.show('Lien copié !', 'success');
        } catch (e) {
          BBM.Toast.show('Impossible de copier le lien', 'error');
        }
      }
    });

    // Cast card clicks → actor filmography
    modal.querySelectorAll('.modal-cast-card[data-person-id]').forEach(card => {
      card.addEventListener('click', () => {
        this.openActorPanel(card.dataset.personId);
      });
    });

    // Lazy-load cast images
    this.observeLazyImages(modal);

    modal.querySelector('#modal-list').addEventListener('click', (e) => {
      this.toggleMyList(tmdbID, e.currentTarget);
    });

    modal.querySelector('#modal-mark-watched').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const currentlyWatched = btn.classList.contains('watched');

      if (currentlyWatched) {
        // Retirer des vus
        await BBM.API.removeContinueWatching(tmdbID);
        delete this.continueWatching[String(tmdbID)];
        btn.classList.remove('watched');
        btn.title = 'Marquer comme vu';
        BBM.Toast.show('Retiré des vus');
        // Re-render episodes to remove watched badges
        if (!isMovie && availableSeasons.length > 0) {
          const activeSeason = modal.querySelector('.season-dropdown-item.active');
          if (activeSeason) this.renderEpisodes(tmdbID, parseInt(activeSeason.dataset.value));
        }
      } else {
        // Marquer comme vu
        let durationSec = 0;
        if (isMovie) {
          durationSec = (tmdb.runtime || 90) * 60;
        } else {
          const seriesData = BBM.API.getSeriesMap().get(String(tmdbID));
          const nbEpisodes = seriesData ? seriesData.episodes.length : (tmdb.number_of_episodes || 1);
          const avgRuntime = tmdb.episode_run_time?.length ? tmdb.episode_run_time[0] : 45;
          durationSec = nbEpisodes * avgRuntime * 60;
        }
        const watchData = {
          progress: durationSec,
          duration: durationSec,
          category: type,
          allWatched: !isMovie
        };
        await BBM.API.saveContinueWatching(tmdbID, watchData);
        this.continueWatching[String(tmdbID)] = watchData;
        btn.classList.add('watched');
        btn.title = 'Retirer des vus';
        BBM.Toast.show('Marqué comme vu ✓', 'success');
        // Re-render episodes to show watched badges
        if (!isMovie && availableSeasons.length > 0) {
          const activeSeason = modal.querySelector('.season-dropdown-item.active');
          if (activeSeason) this.renderEpisodes(tmdbID, parseInt(activeSeason.dataset.value));
        }
      }
    });

    // Episodes - Custom Season Dropdown
    if (!isMovie && availableSeasons.length > 0) {
      const dropdown = modal.querySelector('#season-dropdown');
      const toggle = modal.querySelector('#season-dropdown-toggle');
      const menu = modal.querySelector('#season-dropdown-menu');
      const label = toggle.querySelector('.season-dropdown-label');

      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });

      menu.addEventListener('click', (e) => {
        const item = e.target.closest('.season-dropdown-item');
        if (!item) return;
        const value = parseInt(item.dataset.value);
        label.textContent = item.textContent;
        menu.querySelectorAll('.season-dropdown-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        dropdown.classList.remove('open');
        this.renderEpisodes(tmdbID, value);
      });

      overlay.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('open');
        }
      });

      this.renderEpisodes(tmdbID, availableSeasons[0]);
    }

    // Star Rating
    const starContainer = modal.querySelector('#modal-star-rating');
    if (starContainer) {
      starContainer.appendChild(this.createStarRating(tmdbID, tmdb.vote_average));
    }

    // Show modal
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  async renderEpisodes(tmdbID, seasonNumber) {
    const listEl = document.getElementById('episodes-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="loader" style="margin: 20px auto"></div>';

    // Fetch TMDB season data for episode details
    const seasonData = await BBM.API.getTMDBSeason(tmdbID, seasonNumber);
    const seriesData = BBM.API.getSeriesMap().get(String(tmdbID));
    const episodes = seriesData?.episodes.filter(e => e.seasonNumber === seasonNumber) || [];

    listEl.innerHTML = '';

    // Check episode watch status from continueWatching
    const cw = this.continueWatching[String(tmdbID)];
    const allWatched = cw && (cw.allWatched || (cw.duration > 0 && (cw.progress / cw.duration) >= 0.9 && !cw.seasonNumber));

    episodes.forEach(ep => {
      const tmdbEp = seasonData?.episodes?.find(e => e.episode_number === ep.episodeNumber);
      const epTitle = tmdbEp?.name || `Épisode ${ep.episodeNumber}`;
      const epOverview = tmdbEp?.overview || '';
      const epStill = tmdbEp?.still_path ? BBM.API.getStillURL(tmdbEp.still_path) : null;
      const epRuntime = tmdbEp?.runtime ? `${tmdbEp.runtime} min` : '';

      // Episode watch state
      let epWatchedClass = '';
      let epProgressHTML = '';
      if (allWatched) {
        epWatchedClass = ' episode-watched';
      } else if (cw && cw.seasonNumber === ep.seasonNumber && cw.episodeNumber === ep.episodeNumber) {
        const pct = cw.duration > 0 ? cw.progress / cw.duration : 0;
        if (pct >= 0.9) {
          epWatchedClass = ' episode-watched';
        } else if (cw.progress > 10) {
          epProgressHTML = `<div class="episode-progress"><div class="episode-progress-bar" style="width:${Math.round(pct * 100)}%"></div></div>`;
          epWatchedClass = ' episode-in-progress';
        }
      }

      const item = document.createElement('div');
      item.className = 'episode-item' + epWatchedClass;
      item.innerHTML = `
        <div class="episode-number">${ep.episodeNumber}</div>
        <div class="episode-thumb">
          ${epStill ? `<img src="${epStill}" alt="${epTitle}" loading="lazy">` : '<div style="width:100%;height:100%;background:#333"></div>'}
          <div class="play-overlay">
            <svg viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
          ${epWatchedClass === ' episode-watched' ? '<div class="episode-watched-badge">VU</div>' : ''}
        </div>
        <div class="episode-details">
          <div class="episode-details-header">
            <span class="episode-title">${epTitle}</span>
            <span class="episode-duration">${epRuntime}</span>
          </div>
          <p class="episode-overview">${epOverview}</p>
          ${epProgressHTML}
        </div>
      `;

      item.addEventListener('click', () => {
        this.closeModal();
        this.playEpisode(tmdbID, ep.seasonNumber, ep.episodeNumber, epTitle);
      });

      listEl.appendChild(item);
    });
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.closeTrailer();
  },

  /* ----------------------------------------
     Trailer
     ---------------------------------------- */
  openTrailer(youtubeKey) {
    let overlay = document.getElementById('trailer-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'trailer-overlay';
      overlay.className = 'trailer-overlay';
      overlay.innerHTML = `
        <div class="trailer-wrapper">
          <button class="trailer-close" id="trailer-close">✕</button>
          <iframe id="trailer-iframe" allowfullscreen allow="autoplay; encrypted-media"></iframe>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#trailer-close').addEventListener('click', () => this.closeTrailer());
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeTrailer();
      });
    }
    overlay.querySelector('#trailer-iframe').src = `https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0`;
    overlay.classList.add('active');
  },

  closeTrailer() {
    const overlay = document.getElementById('trailer-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.querySelector('#trailer-iframe').src = '';
    }
  },

  /* ----------------------------------------
     Actor Filmography Panel
     ---------------------------------------- */
  async openActorPanel(personID) {
    const person = await BBM.API.getPersonCredits(personID);
    if (!person) {
      BBM.Toast.show('Impossible de charger la filmographie', 'error');
      return;
    }

    const profileURL = BBM.API.getProfileURL(person.profile_path);
    const credits = (person.combined_credits?.cast || [])
      .filter(c => c.poster_path && (c.media_type === 'movie' || c.media_type === 'tv'))
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

    // Check which titles are available in our catalog
    const allItems = BBM.API._items || [];
    const availableIDs = new Set(allItems.map(i => String(i.tmdbID)));

    let overlay = document.getElementById('actor-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'actor-overlay';
      overlay.className = 'actor-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="actor-panel">
        <button class="modal-close" id="actor-close">&#10005;</button>
        <div class="actor-header">
          <div class="actor-header-photo">
            ${profileURL ? `<img src="${profileURL}" alt="${person.name}">` : `<div class="modal-cast-placeholder">${person.name.charAt(0)}</div>`}
          </div>
          <div class="actor-header-info">
            <h2>${person.name}</h2>
            ${person.birthday ? `<p class="actor-meta">${person.birthday}${person.deathday ? ' — ' + person.deathday : ''}</p>` : ''}
            ${person.place_of_birth ? `<p class="actor-meta">${person.place_of_birth}</p>` : ''}
          </div>
        </div>
        ${person.biography ? `<p class="actor-bio">${person.biography}</p>` : ''}
        <h3 class="actor-section-title">Filmographie <span class="actor-count">${credits.length}</span></h3>
        <div class="actor-filmography">
          ${credits.map(c => {
            const title = c.title || c.name || '';
            const year = (c.release_date || c.first_air_date || '').substring(0, 4);
            const poster = BBM.API.getPosterURL(c.poster_path, 'w185');
            const isAvailable = availableIDs.has(String(c.id));
            const type = c.media_type === 'movie' ? 'movie' : 'series';
            return `<div class="actor-film-card${isAvailable ? ' available' : ''}" data-tmdbid="${c.id}" data-type="${type}" ${isAvailable ? 'role="button" tabindex="0"' : ''}>
              <div class="actor-film-poster">
                ${poster ? `<img data-src="${poster}" alt="${title}">` : '<div style="width:100%;height:100%;background:#333"></div>'}
                ${isAvailable ? '<div class="actor-film-badge">Disponible</div>' : ''}
              </div>
              <div class="actor-film-title">${title}</div>
              <div class="actor-film-year">${year} · ${c.character || (c.media_type === 'movie' ? 'Film' : 'Série')}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    // Events
    overlay.querySelector('#actor-close').addEventListener('click', () => this.closeActorPanel());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeActorPanel();
    });

    // Click on available titles → open modal
    overlay.querySelectorAll('.actor-film-card.available').forEach(card => {
      card.addEventListener('click', () => {
        this.closeActorPanel();
        this.openModal(card.dataset.tmdbid, card.dataset.type);
      });
    });

    this.observeLazyImages(overlay);
    overlay.classList.add('active');
  },

  closeActorPanel() {
    const overlay = document.getElementById('actor-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  /* ----------------------------------------
     Random Pick
     ---------------------------------------- */
  pickRandom() {
    const candidates = [];
    this.tmdbCache.forEach((data, tmdbID) => {
      if (data.poster_path) {
        candidates.push({ tmdbID, data });
      }
    });
    if (candidates.length === 0) return;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const isMovie = !!pick.data.title;
    this.openModal(pick.tmdbID, isMovie ? 'movie' : 'series');
  },

  /* ----------------------------------------
     Play
     ---------------------------------------- */
  playTitle(tmdbID, type) {
    if (type === 'movie') {
      const url = BBM.API.getMovieURL(tmdbID);
      if (url) {
        const tmdb = this.tmdbCache.get(String(tmdbID));
        const title = tmdb?.title || 'Film';
        window.location.href = `watch.html?v=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&tmdbid=${tmdbID}&type=movie`;
      }
    } else {
      // Play first episode or continue where left off
      const cw = this.continueWatching[tmdbID];
      const series = BBM.API.getSeriesMap().get(String(tmdbID));
      if (!series || series.episodes.length === 0) return;

      let episode;
      if (cw && cw.seasonNumber && cw.episodeNumber) {
        episode = series.episodes.find(
          e => e.seasonNumber === cw.seasonNumber && e.episodeNumber === cw.episodeNumber
        );
      }
      if (!episode) episode = series.episodes[0];

      const tmdb = this.tmdbCache.get(String(tmdbID));
      const seriesTitle = tmdb?.name || series.seriesTitle;
      const title = `${seriesTitle} - S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`;

      window.location.href = `watch.html?v=${encodeURIComponent(episode.url)}&title=${encodeURIComponent(title)}&tmdbid=${tmdbID}&type=series&s=${episode.seasonNumber}&e=${episode.episodeNumber}`;
    }
  },

  playEpisode(tmdbID, season, episode, epTitle) {
    const url = BBM.API.getEpisodeURL(tmdbID, season, episode);
    if (!url) return;
    const tmdb = this.tmdbCache.get(String(tmdbID));
    const seriesTitle = tmdb?.name || '';
    const title = `${seriesTitle} - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} - ${epTitle}`;

    window.location.href = `watch.html?v=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&tmdbid=${tmdbID}&type=series&s=${season}&e=${episode}`;
  },

  /* ----------------------------------------
     Star Rating Component
     ---------------------------------------- */
  createStarRating(tmdbID, tmdbRating) {
    const container = document.createElement('div');
    container.className = 'star-rating-section';

    const id = String(tmdbID);
    const userRating = this.userRatings[id] || 0;
    const tmdbStars = tmdbRating ? (tmdbRating / 2).toFixed(1) : null;

    container.innerHTML = `
      <div class="star-rating-row">
        <div class="star-rating-user">
          <span class="star-rating-label">Ta note</span>
          <div class="star-input" data-tmdbid="${tmdbID}">
            ${this._renderStars(userRating, true)}
          </div>
          ${userRating > 0 ? `<span class="star-rating-value">${userRating}/5</span>` : ''}
        </div>
        ${tmdbStars ? `
        <div class="star-rating-tmdb">
          <span class="star-rating-label">Note TMDB</span>
          <div class="star-display">
            ${this._renderStars(parseFloat(tmdbStars), false)}
          </div>
          <span class="star-rating-value">${tmdbStars}/5</span>
        </div>` : ''}
      </div>
    `;

    // Bind star click events
    const starInput = container.querySelector('.star-input');
    if (starInput) {
      starInput.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', async (e) => {
          e.stopPropagation();
          const val = parseFloat(star.dataset.value);
          const currentRating = this.userRatings[id] || 0;

          if (val === currentRating) {
            // Click same star = remove rating
            delete this.userRatings[id];
            await BBM.API.removeRating(id);
            BBM.Toast.show('Note retirée');
          } else {
            this.userRatings[id] = val;
            await BBM.API.setRating(id, val);
            BBM.Toast.show(`Noté ${val}/5 ⭐`, 'success');
          }

          // Re-render stars
          const newSection = this.createStarRating(tmdbID, tmdbRating);
          container.replaceWith(newSection);
        });

        // Hover preview
        star.addEventListener('mouseenter', () => {
          const val = parseFloat(star.dataset.value);
          this._highlightStars(starInput, val);
        });
      });

      starInput.addEventListener('mouseleave', () => {
        const current = this.userRatings[id] || 0;
        this._highlightStars(starInput, current);
      });
    }

    return container;
  },

  _renderStars(rating, interactive) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const halfVal = i - 0.5;
      if (interactive) {
        // Half star
        const halfFill = rating >= halfVal ? 'filled' : '';
        const fullFill = rating >= i ? 'filled' : '';
        html += `<span class="star star-half ${halfFill}" data-value="${halfVal}">
          <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77V2z"/></svg>
        </span>`;
        html += `<span class="star star-full ${fullFill}" data-value="${i}">
          <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </span>`;
      } else {
        // Display only
        const halfFill = rating >= halfVal ? 'filled' : '';
        const fullFill = rating >= i ? 'filled' : '';
        if (rating >= i) {
          html += `<span class="star star-full filled"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>`;
        } else if (rating >= halfVal) {
          html += `<span class="star star-half filled"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77V2z"/></svg></span>`;
        } else {
          html += `<span class="star star-full"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>`;
        }
      }
    }
    return html;
  },

  _highlightStars(container, value) {
    container.querySelectorAll('.star').forEach(star => {
      const v = parseFloat(star.dataset.value);
      star.classList.toggle('filled', v <= value);
    });
  },

  /* ----------------------------------------
     Collections / Sagas
     ---------------------------------------- */
  showCollections() {
    const container = document.getElementById('category-filter');
    const header = container.querySelector('.category-filter-header h1');
    const grid = container.querySelector('.category-grid');

    header.textContent = 'Collections & Sagas';
    grid.innerHTML = '';
    grid.className = 'category-grid collections-grid';

    const collections = BBM.API.getCollectionsFromCache(this.tmdbCache);

    if (collections.length === 0) {
      grid.innerHTML = '<div class="no-results" style="grid-column:1/-1"><p>Aucune collection trouvée</p></div>';
    } else {
      collections.sort((a, b) => a.name.localeCompare(b.name));
      collections.forEach(col => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        const poster = col.poster_path
          ? `${BBM.Config.tmdb.imageBase}/${BBM.Config.posterSize}${col.poster_path}`
          : null;

        card.innerHTML = `
          <div class="collection-card-img">
            ${poster ? `<img src="${poster}" alt="${col.name}" loading="lazy">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#555;font-size:0.8rem;padding:10px;text-align:center">${col.name}</div>`}
          </div>
          <div class="collection-card-info">
            <span class="collection-card-name">${col.name}</span>
            <span class="collection-card-count">${col.movieIds.length} film${col.movieIds.length > 1 ? 's' : ''}</span>
          </div>
        `;

        card.addEventListener('click', () => this.openCollectionDetail(col.id));
        grid.appendChild(card);
      });
    }

    container.classList.add('active');
  },

  async openCollectionDetail(collectionId) {
    const overlay = document.getElementById('collection-overlay');
    const content = document.getElementById('collection-content');
    content.innerHTML = '<div class="loader" style="margin:40px auto"></div>';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const col = await BBM.API.getCollection(collectionId);
    if (!col) {
      content.innerHTML = '<p style="text-align:center;padding:40px;color:var(--bbm-text-muted)">Impossible de charger la collection</p>';
      return;
    }

    const backdropURL = col.backdrop_path ? BBM.API.getBackdropURL(col.backdrop_path) : '';
    const parts = (col.parts || []).sort((a, b) => {
      const dA = a.release_date || '9999';
      const dB = b.release_date || '9999';
      return dA.localeCompare(dB);
    });

    content.innerHTML = `
      ${backdropURL ? `<div class="collection-hero"><img src="${backdropURL}" alt="${col.name}"><div class="collection-hero-gradient"></div></div>` : ''}
      <div class="collection-header">
        <h2>${col.name}</h2>
        ${col.overview ? `<p class="collection-overview">${col.overview}</p>` : ''}
      </div>
      <div class="collection-parts">
        ${parts.map(part => {
          const poster = part.poster_path ? BBM.API.getPosterURL(part.poster_path, 'w200') : '';
          const year = (part.release_date || '').substring(0, 4);
          const rating = part.vote_average ? (part.vote_average / 2).toFixed(1) : '';
          return `
            <div class="collection-part" data-tmdbid="${part.id}">
              <div class="collection-part-poster">
                ${poster ? `<img src="${poster}" alt="${part.title}" loading="lazy">` : '<div style="width:100%;height:100%;background:var(--bbm-bg-card)"></div>'}
              </div>
              <div class="collection-part-info">
                <span class="collection-part-title">${part.title}</span>
                <div class="collection-part-meta">
                  ${year ? `<span>${year}</span>` : ''}
                  ${rating ? `<span>⭐ ${rating}/5</span>` : ''}
                </div>
                ${part.overview ? `<p class="collection-part-overview">${part.overview}</p>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Click part -> open modal
    content.querySelectorAll('.collection-part').forEach(el => {
      el.addEventListener('click', () => {
        const tmdbID = el.dataset.tmdbid;
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        this.openModal(tmdbID, 'movie');
      });
    });

    // Close
    document.getElementById('collection-close').addEventListener('click', () => {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  },

  /* ----------------------------------------
     Request Modal
     ---------------------------------------- */
  setupRequestModal() {
    // Open request modal
    const btnRequest = document.getElementById('btn-request');
    const btnMyRequests = document.getElementById('btn-my-requests');

    if (btnRequest) {
      btnRequest.addEventListener('click', () => {
        document.getElementById('request-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
        document.getElementById('request-search-input').focus();
      });
    }

    if (btnMyRequests) {
      btnMyRequests.addEventListener('click', () => {
        this.showMyRequests();
      });
    }

    // Close request modal
    document.getElementById('request-close')?.addEventListener('click', () => {
      document.getElementById('request-overlay').classList.remove('active');
      document.body.style.overflow = '';
    });
    document.getElementById('request-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'request-overlay') {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // Close my-requests modal
    document.getElementById('my-requests-close')?.addEventListener('click', () => {
      document.getElementById('my-requests-overlay').classList.remove('active');
      document.body.style.overflow = '';
    });
    document.getElementById('my-requests-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'my-requests-overlay') {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // Search
    const searchBtn = document.getElementById('request-search-btn');
    const searchInput = document.getElementById('request-search-input');
    if (searchBtn && searchInput) {
      const doSearch = async () => {
        const q = searchInput.value.trim();
        if (q.length < 2) return;
        const results = document.getElementById('request-results');
        results.innerHTML = '<div class="loader" style="margin:20px auto"></div>';
        const tmdbResults = await BBM.API.searchTMDB(q);
        this.renderRequestResults(tmdbResults);
      };
      searchBtn.addEventListener('click', doSearch);
      searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    }
  },

  renderRequestResults(results) {
    const container = document.getElementById('request-results');
    if (results.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--bbm-text-muted);padding:20px">Aucun résultat trouvé</p>';
      return;
    }

    container.innerHTML = '';
    results.forEach(item => {
      const isMovie = item.media_type === 'movie';
      const title = item.title || item.name || 'Sans titre';
      const year = (item.release_date || item.first_air_date || '').substring(0, 4);
      const poster = item.poster_path ? BBM.API.getPosterURL(item.poster_path, 'w92') : null;

      // Check if already available
      const alreadyAvailable = this.tmdbCache.has(String(item.id));

      const el = document.createElement('div');
      el.className = 'request-result-item';
      el.innerHTML = `
        <div class="request-result-poster">
          ${poster ? `<img src="${poster}" alt="${title}">` : '<div style="width:100%;height:100%;background:var(--bbm-bg-card);border-radius:6px"></div>'}
        </div>
        <div class="request-result-info">
          <span class="request-result-title">${title}</span>
          <span class="request-result-meta">${isMovie ? 'Film' : 'Série'}${year ? ` · ${year}` : ''}</span>
        </div>
        <button class="btn-request-submit" ${alreadyAvailable ? 'disabled' : ''}>
          ${alreadyAvailable ? 'Disponible' : 'Demander'}
        </button>
      `;

      if (!alreadyAvailable) {
        el.querySelector('.btn-request-submit').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = '...';
          try {
            await BBM.API.submitRequest({
              tmdbID: String(item.id),
              title: title,
              posterPath: item.poster_path || '',
              type: isMovie ? 'movie' : 'series',
              requestedBy: BBM.Auth.currentUser.uid,
              requestedByName: BBM.Auth.getDisplayName()
            });
            btn.textContent = '✓ Envoyé';
            btn.classList.add('sent');
            BBM.Toast.show('Demande envoyée !', 'success');
          } catch (err) {
            btn.textContent = 'Erreur';
            btn.disabled = false;
            BBM.Toast.show('Erreur lors de l\'envoi', 'error');
          }
        });
      }

      container.appendChild(el);
    });
  },

  async showMyRequests() {
    const overlay = document.getElementById('my-requests-overlay');
    const list = document.getElementById('my-requests-list');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    list.innerHTML = '<div class="loader" style="margin:30px auto"></div>';

    this._myRequests = await BBM.API.getMyRequests();
    this._myRequestsFilter = 'all';

    // Reset filter buttons
    document.querySelectorAll('#my-requests-filters .genre-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === 'all');
    });

    // Setup filter buttons (once)
    if (!this._myRequestsFiltersReady) {
      this._myRequestsFiltersReady = true;
      document.querySelectorAll('#my-requests-filters .genre-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this._myRequestsFilter = btn.dataset.filter;
          document.querySelectorAll('#my-requests-filters .genre-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._renderMyRequests();
        });
      });
    }

    this._renderMyRequests();
  },

  _renderMyRequests() {
    const list = document.getElementById('my-requests-list');
    const filter = this._myRequestsFilter || 'all';
    const requests = filter === 'all'
      ? this._myRequests
      : this._myRequests.filter(r => r.status === filter);

    if (requests.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--bbm-text-muted);padding:30px">Aucune demande à afficher</p>';
      return;
    }

    list.innerHTML = '';
    requests.forEach(req => {
      const poster = req.posterPath ? BBM.API.getPosterURL(req.posterPath, 'w92') : null;
      const statusMap = {
        pending: { label: 'En attente', cls: 'status-pending' },
        approved: { label: 'Approuvé', cls: 'status-approved' },
        rejected: { label: 'Refusé', cls: 'status-rejected' }
      };
      const st = statusMap[req.status] || statusMap.pending;
      const dateStr = req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('fr-FR') : '';

      const el = document.createElement('div');
      el.className = 'my-request-item';
      el.innerHTML = `
        <div class="request-result-poster">
          ${poster ? `<img src="${poster}" alt="${req.title}">` : '<div style="width:100%;height:100%;background:var(--bbm-bg-card);border-radius:6px"></div>'}
        </div>
        <div class="request-result-info">
          <span class="request-result-title">${req.title}</span>
          <span class="request-result-meta">${req.type === 'movie' ? 'Film' : 'Série'}${dateStr ? ` · ${dateStr}` : ''}</span>
        </div>
        <span class="request-status ${st.cls}">${st.label}</span>
        <button class="btn-delete-request" title="Supprimer cette demande">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      `;

      el.querySelector('.btn-delete-request').addEventListener('click', async () => {
        if (!confirm(`Supprimer la demande "${req.title}" ?`)) return;
        try {
          await BBM.db.collection('requests').doc(req.id).delete();
          this._myRequests = this._myRequests.filter(r => r.id !== req.id);
          this._renderMyRequests();
          BBM.Toast.show('Demande supprimée');
        } catch (e) {
          BBM.Toast.show('Erreur lors de la suppression', 'error');
        }
      });

      list.appendChild(el);
    });
  }
};

/* ============================================
   Toast Notifications
   ============================================ */
BBM.Toast = {
  show(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }
};

/* ============================================
   Init on load
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  BBM.Browse.init();
});
