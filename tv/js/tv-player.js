/* ============================================
   BoomBoomMovie TV — Video Player
   ============================================ */

(() => {
  const state = {
    video: null,
    overlay: null,
    hideTimer: null,
    tmdbID: null,
    type: null,
    season: null,
    episode: null,
    series: null,       // aggregated series data when playing an episode
    isSeekingFromBar: false
  };

  // ----------------------------------------
  // Init
  // ----------------------------------------
  BBM.auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    BBM.Auth.currentUser = user;

    const params = new URLSearchParams(window.location.search);
    const videoURL = params.get('v');
    const title = params.get('title') || 'Lecture';
    state.tmdbID = params.get('tmdbid');
    state.type = params.get('type') || 'movie';
    state.season = params.get('s') ? parseInt(params.get('s')) : null;
    state.episode = params.get('e') ? parseInt(params.get('e')) : null;

    if (!videoURL) {
      window.location.href = 'browse.html';
      return;
    }

    state.video = document.getElementById('tv-video');
    state.overlay = document.getElementById('tv-overlay');
    document.getElementById('tv-title').textContent = title;

    state.video.src = videoURL;

    setupControls();
    setupKeyboard();
    setupBack();
    setupAutoHide();

    // For series: load catalog so we can navigate episodes
    if (state.type === 'series' && state.tmdbID) {
      try {
        await BBM.API.fetchAllItems();
        const map = BBM.API.getSeriesMap();
        state.series = map.get(String(state.tmdbID)) || map.get(state.tmdbID);
        updateEpisodeButtons();
      } catch (e) {
        console.warn('Series load failed', e);
      }
    }

    state.video.addEventListener('loadedmetadata', () => {
      updateTotal();
      loadProgress();
    });

    state.video.addEventListener('canplay', () => {
      state.video.play().catch(() => {});
      BBM.TV.Loading.hide();
    }, { once: true });

    state.video.addEventListener('timeupdate', () => {
      if (!state.isSeekingFromBar) updateProgress();
    });

    state.video.addEventListener('play', () => togglePlayIcon(true));
    state.video.addEventListener('pause', () => togglePlayIcon(false));
    state.video.addEventListener('ended', () => { saveProgress(true); onEnded(); });

    // Periodic progress save
    setInterval(() => {
      if (!state.video.paused && state.video.currentTime > 5) saveProgress();
    }, 10000);

    window.addEventListener('beforeunload', () => {
      if (state.video.currentTime > 5) saveProgress();
    });

    // Focus the play/pause button initially
    requestAnimationFrame(() => {
      document.getElementById('btn-playpause').focus();
    });
  });

  // ----------------------------------------
  // Controls
  // ----------------------------------------
  function setupControls() {
    document.getElementById('btn-playpause').addEventListener('click', togglePlay);
    document.getElementById('btn-rewind').addEventListener('click', () => seek(-10));
    document.getElementById('btn-forward').addEventListener('click', () => seek(10));
    document.getElementById('btn-prev-ep').addEventListener('click', () => gotoEpisode(-1));
    document.getElementById('btn-next-ep').addEventListener('click', () => gotoEpisode(1));

    const bar = document.getElementById('progress-bar');
    // Click on bar jumps — also handle Enter when focused (uses relative position? No — for TV, use left/right while focused)
    bar.addEventListener('click', (e) => {
      const rect = bar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      state.video.currentTime = pct * (state.video.duration || 0);
    });

    // When progress bar is focused, left/right seeks (keyboard hander is in setupKeyboard)
  }

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'MediaPlayPause' || e.key === 'MediaPlay' || e.key === 'MediaPause') {
        e.preventDefault();
        togglePlay();
        showOverlay();
        return;
      }
      if (e.key === 'MediaFastForward') { seek(10); showOverlay(); return; }
      if (e.key === 'MediaRewind') { seek(-10); showOverlay(); return; }

      // When progress bar has focus, LEFT/RIGHT seek instead of nav
      if (document.activeElement?.id === 'progress-bar') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); seek(-10); showOverlay(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); seek(10); showOverlay(); return; }
      }

      // Any D-pad press re-shows overlay
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.key)) {
        showOverlay();
      }
    }, true);
  }

  function setupBack() {
    const back = () => {
      if (state.video.currentTime > 5) saveProgress();
      window.location.href = 'browse.html';
      return true;
    };
    document.getElementById('btn-back').addEventListener('click', back);
    BBM.TV.Nav.pushBack(back);
  }

  function setupAutoHide() {
    showOverlay();
    ['mousemove', 'keydown', 'click'].forEach(ev => {
      document.addEventListener(ev, showOverlay);
    });
  }

  function showOverlay() {
    state.overlay.classList.remove('hidden');
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      if (!state.video.paused) state.overlay.classList.add('hidden');
    }, 4000);
  }

  function togglePlay() {
    if (state.video.paused) state.video.play();
    else state.video.pause();
  }

  function seek(delta) {
    state.video.currentTime = Math.max(0, Math.min(state.video.duration || 0, state.video.currentTime + delta));
  }

  function togglePlayIcon(playing) {
    const el = document.getElementById('icon-play');
    if (!el) return;
    if (playing) {
      // Pause icon
      el.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    } else {
      // Play icon
      el.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    }
  }

  // ----------------------------------------
  // Progress
  // ----------------------------------------
  function updateProgress() {
    const v = state.video;
    const fill = document.getElementById('progress-fill');
    const curLabel = document.getElementById('time-current');
    const pct = v.duration ? (v.currentTime / v.duration) * 100 : 0;
    fill.style.width = pct + '%';
    curLabel.textContent = formatTime(v.currentTime);
  }

  function updateTotal() {
    document.getElementById('time-total').textContent = formatTime(state.video.duration || 0);
  }

  function formatTime(t) {
    if (!isFinite(t)) return '00:00';
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  // ----------------------------------------
  // Save / load progress
  // ----------------------------------------
  function saveProgress(finished = false) {
    if (!state.tmdbID) return;
    const v = state.video;
    if (!v.duration) return;

    if (finished || (v.currentTime / v.duration) > 0.95) {
      // Treat as watched — remove from continue watching
      BBM.API.removeContinueWatching(state.tmdbID).catch(() => {});
      return;
    }

    BBM.API.saveContinueWatching(state.tmdbID, {
      progress: v.currentTime,
      duration: v.duration,
      category: state.type,
      season: state.season,
      episode: state.episode
    }).catch(() => {});
  }

  async function loadProgress() {
    if (!state.tmdbID) return;
    try {
      const cw = await BBM.API.getContinueWatching();
      const saved = cw[String(state.tmdbID)];
      if (!saved) return;

      // Only restore if same episode (for series)
      if (state.type === 'series') {
        if (saved.season !== state.season || saved.episode !== state.episode) return;
      }
      if (saved.progress > 10 && saved.progress < (state.video.duration - 30)) {
        state.video.currentTime = saved.progress;
      }
    } catch (e) {}
  }

  // ----------------------------------------
  // Episode navigation (series)
  // ----------------------------------------
  function updateEpisodeButtons() {
    if (!state.series) return;
    const idx = currentEpisodeIndex();
    if (idx < 0) return;

    const prev = document.getElementById('btn-prev-ep');
    const next = document.getElementById('btn-next-ep');

    if (idx > 0) prev.style.display = 'flex';
    if (idx < state.series.episodes.length - 1) next.style.display = 'flex';
  }

  function currentEpisodeIndex() {
    if (!state.series) return -1;
    return state.series.episodes.findIndex(e =>
      e.seasonNumber === state.season && e.episodeNumber === state.episode
    );
  }

  function gotoEpisode(delta) {
    if (!state.series) return;
    const idx = currentEpisodeIndex();
    const target = idx + delta;
    if (target < 0 || target >= state.series.episodes.length) return;

    if (state.video.currentTime > 5) saveProgress();

    const ep = state.series.episodes[target];
    const title = `${state.series.seriesTitle} — S${ep.seasonNumber}·E${ep.episodeNumber}`;
    const params = new URLSearchParams({
      v: ep.url,
      title,
      tmdbid: state.tmdbID,
      type: 'series',
      s: ep.seasonNumber,
      e: ep.episodeNumber
    });
    window.location.href = `watch.html?${params.toString()}`;
  }

  function onEnded() {
    if (state.type === 'series' && state.series) {
      const idx = currentEpisodeIndex();
      if (idx >= 0 && idx < state.series.episodes.length - 1) {
        gotoEpisode(1);
        return;
      }
    }
    window.location.href = 'browse.html';
  }
})();
