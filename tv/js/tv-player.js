/* ============================================
   BoomBoomMovie TV — Video Player (guest mode)
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
    series: null,
    isSeekingFromBar: false
  };

  async function init() {
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
    setHeaderMeta(title);

    state.video.src = videoURL;

    setupControls();
    setupKeyboard();
    setupBack();
    setupAutoHide();

    // For series: load catalog for prev/next episode navigation
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

    state.video.addEventListener('loadedmetadata', () => updateTotal());

    state.video.addEventListener('canplay', () => {
      state.video.play().catch(() => {});
      BBM.TV.Loading.hide();
    }, { once: true });

    state.video.addEventListener('timeupdate', () => {
      if (!state.isSeekingFromBar) updateProgress();
    });

    state.video.addEventListener('play', () => togglePlayIcon(true));
    state.video.addEventListener('pause', () => togglePlayIcon(false));
    state.video.addEventListener('ended', onEnded);

    requestAnimationFrame(() => {
      document.getElementById('btn-playpause').focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ----------------------------------------
  // Header meta — chip + subtitle
  // ----------------------------------------
  function setHeaderMeta(title) {
    const titleEl = document.getElementById('tv-title');
    const chip = document.getElementById('tv-type-chip');
    const chipText = document.getElementById('tv-type-chip-text');
    const subtitle = document.getElementById('tv-subtitle');

    if (state.type === 'series' && state.season != null && state.episode != null) {
      const epCode = `S${String(state.season).padStart(2, '0')}E${String(state.episode).padStart(2, '0')}`;
      const epRegex = /\s[-—]\s*S\d{2}E\d{2}\s*$/i;
      const seriesName = title.replace(epRegex, '').trim();
      if (titleEl) titleEl.textContent = seriesName || title;
      if (chip && chipText) { chipText.textContent = 'SÉRIE'; chip.style.display = ''; }
      if (subtitle) {
        subtitle.textContent = `Saison ${state.season} · Épisode ${state.episode} · ${epCode}`;
        subtitle.style.display = '';
      }
    } else {
      if (titleEl) titleEl.textContent = title;
      if (chip && chipText) { chipText.textContent = 'FILM'; chip.style.display = ''; }
      if (subtitle) subtitle.style.display = 'none';
    }
  }

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
    bar.addEventListener('click', (e) => {
      const rect = bar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      state.video.currentTime = pct * (state.video.duration || 0);
    });
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

      if (document.activeElement?.id === 'progress-bar') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); seek(-10); showOverlay(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); seek(10); showOverlay(); return; }
      }

      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.key)) {
        showOverlay();
      }
    }, true);
  }

  function setupBack() {
    const back = () => {
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
      el.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    } else {
      el.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    }
  }

  // ----------------------------------------
  // Progress UI (no save/load — guest mode)
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

    const ep = state.series.episodes[target];
    const title = `${state.series.seriesTitle} — S${String(ep.seasonNumber).padStart(2,'0')}E${String(ep.episodeNumber).padStart(2,'0')}`;
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
