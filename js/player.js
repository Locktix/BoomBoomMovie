/* ============================================
   BoomBoomMovie — Video Player
   ============================================ */

BBM.Player = {
  video: null,
  overlay: null,
  hideTimer: null,
  isPlaying: false,
  tmdbID: null,
  type: null,
  season: null,
  episode: null,
  isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),

  /* ----------------------------------------
     Initialization
     ---------------------------------------- */
  async init() {
    await BBM.Auth.requireAuth();

    const params = new URLSearchParams(window.location.search);
    const videoURL = params.get('v');
    const title = params.get('title') || 'Lecture en cours';
    this.tmdbID = params.get('tmdbid');
    this.type = params.get('type');
    this.season = params.get('s') ? parseInt(params.get('s')) : null;
    this.episode = params.get('e') ? parseInt(params.get('e')) : null;

    if (!videoURL) {
      window.location.href = 'browse.html';
      return;
    }

    this.video = document.getElementById('player-video');
    this.overlay = document.getElementById('player-overlay');

    // Set title
    document.getElementById('player-title').textContent = title;

    // Load video
    this.video.src = videoURL;

    // Sur iPhone/iPad, utiliser le player natif
    if (this.isIOS) {
      this.overlay.style.display = 'none';
      this.video.setAttribute('controls', '');
      this.video.setAttribute('playsinline', '');
      this.setupIOSControls();
      this.loadProgress();
    } else {
      this.setupControls();
      this.setupKeyboard();
      this.setupAutoHide();
      this.loadProgress();
    }

    // Autoplay
    this.video.addEventListener('canplay', () => {
      this.video.play().catch(() => {});
    }, { once: true });

    // Remove loading screen
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.style.display = 'none', 500);
    }
  },

  /* ----------------------------------------
     iOS Native Player (save/load only)
     ---------------------------------------- */
  setupIOSControls() {
    const v = this.video;

    v.addEventListener('play', () => { this.isPlaying = true; });
    v.addEventListener('pause', () => {
      this.isPlaying = false;
      if (v.currentTime > 5) this.saveProgress();
    });

    // Save progress periodically
    setInterval(() => {
      if (this.isPlaying && v.currentTime > 5) {
        this.saveProgress();
      }
    }, 10000);

    window.addEventListener('beforeunload', () => {
      if (v.currentTime > 5) this.saveProgress();
    });

    v.addEventListener('ended', () => { this.onVideoEnded(); });

    v.addEventListener('error', () => {
      BBM.Toast.show('Erreur de lecture vidéo', 'error');
    });
  },

  /* ----------------------------------------
     Controls Setup
     ---------------------------------------- */
  setupControls() {
    const v = this.video;

    // Back button
    document.getElementById('player-back').addEventListener('click', () => {
      this.saveProgress();
      window.location.href = 'browse.html';
    });

    // Play/Pause
    const playPauseBtn = document.getElementById('btn-play-pause');
    const playPauseCenter = document.getElementById('btn-center-play');

    const togglePlay = () => {
      if (v.paused) { v.play(); } else { v.pause(); }
    };

    playPauseBtn.addEventListener('click', togglePlay);
    playPauseCenter.addEventListener('click', togglePlay);

    v.addEventListener('play', () => {
      this.isPlaying = true;
      playPauseBtn.innerHTML = this.icons.pause;
      playPauseCenter.innerHTML = this.icons.pause;
    });

    v.addEventListener('pause', () => {
      this.isPlaying = false;
      playPauseBtn.innerHTML = this.icons.play;
      playPauseCenter.innerHTML = this.icons.play;
    });

    // Click on video to toggle play
    v.addEventListener('click', togglePlay);

    // Double click for fullscreen
    v.addEventListener('dblclick', () => this.toggleFullscreen());

    // Rewind / Forward
    document.getElementById('btn-rewind').addEventListener('click', () => {
      v.currentTime = Math.max(0, v.currentTime - 10);
    });

    document.getElementById('btn-forward').addEventListener('click', () => {
      v.currentTime = Math.min(v.duration, v.currentTime + 10);
    });

    // Volume
    const volumeBtn = document.getElementById('btn-volume');
    const volumeSlider = document.getElementById('volume-slider');

    volumeBtn.addEventListener('click', () => {
      v.muted = !v.muted;
      this.updateVolumeIcon();
    });

    volumeSlider.addEventListener('input', () => {
      v.volume = parseFloat(volumeSlider.value);
      v.muted = false;
      this.updateVolumeIcon();
    });

    v.addEventListener('volumechange', () => {
      volumeSlider.value = v.muted ? 0 : v.volume;
      this.updateVolumeIcon();
    });

    // Fullscreen
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // Progress bar
    const progressBar = document.getElementById('player-progress');
    const progressFilled = document.getElementById('progress-filled');
    const progressThumb = document.getElementById('progress-thumb');
    const progressBuffered = document.getElementById('progress-buffered');
    const timeDisplay = document.getElementById('player-time');

    v.addEventListener('timeupdate', () => {
      if (!v.duration) return;
      const pct = (v.currentTime / v.duration) * 100;
      progressFilled.style.width = pct + '%';
      progressThumb.style.left = pct + '%';
      timeDisplay.textContent = `${this.formatTime(v.currentTime)} / ${this.formatTime(v.duration)}`;
    });

    v.addEventListener('progress', () => {
      if (v.buffered.length > 0 && v.duration) {
        const buffPct = (v.buffered.end(v.buffered.length - 1) / v.duration) * 100;
        progressBuffered.style.width = buffPct + '%';
      }
    });

    // Seek
    let seeking = false;

    const seek = (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      v.currentTime = pct * v.duration;
    };

    progressBar.addEventListener('mousedown', (e) => {
      seeking = true;
      seek(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (seeking) seek(e);
    });

    document.addEventListener('mouseup', () => {
      seeking = false;
    });

    // Save progress periodically (every 10s)
    setInterval(() => {
      if (this.isPlaying && v.currentTime > 5) {
        this.saveProgress();
      }
    }, 10000);

    // Save on pause
    v.addEventListener('pause', () => {
      if (v.currentTime > 5) this.saveProgress();
    });

    // Save when leaving page
    window.addEventListener('beforeunload', () => {
      if (v.currentTime > 5) this.saveProgress();
    });

    // Video ended
    v.addEventListener('ended', () => {
      this.onVideoEnded();
    });

    // Error handling
    v.addEventListener('error', () => {
      BBM.Toast.show('Erreur de lecture vidéo', 'error');
    });
  },

  /* ----------------------------------------
     Auto-hide Controls
     ---------------------------------------- */
  setupAutoHide() {
    const show = () => {
      this.overlay.classList.remove('hidden');
      clearTimeout(this.hideTimer);
      if (this.isPlaying) {
        this.hideTimer = setTimeout(() => {
          this.overlay.classList.add('hidden');
        }, 3000);
      }
    };

    document.addEventListener('mousemove', show);
    document.addEventListener('touchstart', show);

    this.video.addEventListener('pause', () => {
      this.overlay.classList.remove('hidden');
      clearTimeout(this.hideTimer);
    });

    this.video.addEventListener('play', () => {
      this.hideTimer = setTimeout(() => {
        this.overlay.classList.add('hidden');
      }, 3000);
    });
  },

  /* ----------------------------------------
     Keyboard Shortcuts
     ---------------------------------------- */
  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (this.video.paused) this.video.play();
          else this.video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.video.currentTime = Math.max(0, this.video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.video.volume = Math.min(1, this.video.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.video.volume = Math.max(0, this.video.volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          this.video.muted = !this.video.muted;
          this.updateVolumeIcon();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            this.saveProgress();
            window.location.href = 'browse.html';
          }
          break;
      }
    });
  },

  /* ----------------------------------------
     Helpers
     ---------------------------------------- */
  toggleFullscreen() {
    const container = document.querySelector('.player-container');
    if (!document.fullscreenElement) {
      container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  },

  updateVolumeIcon() {
    const btn = document.getElementById('btn-volume');
    if (this.video.muted || this.video.volume === 0) {
      btn.innerHTML = this.icons.volumeMute;
    } else if (this.video.volume < 0.5) {
      btn.innerHTML = this.icons.volumeLow;
    } else {
      btn.innerHTML = this.icons.volumeHigh;
    }
  },

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  /* ----------------------------------------
     Progress Save/Load
     ---------------------------------------- */
  async saveProgress() {
    if (!this.tmdbID || !this.video.duration) return;
    const progress = Math.floor(this.video.currentTime);
    const duration = Math.floor(this.video.duration);
    // If >= 90% watched, mark as finished
    if (duration > 0 && (progress / duration) >= 0.9) {
      try { await BBM.API.removeContinueWatching(this.tmdbID); } catch (e) {}
      return;
    }
    try {
      await BBM.API.saveContinueWatching(this.tmdbID, {
        progress,
        duration,
        category: this.type,
        seasonNumber: this.season,
        episodeNumber: this.episode
      });
    } catch (e) {
      console.error('saveProgress error:', e);
    }
  },

  async loadProgress() {
    if (!this.tmdbID) return;
    try {
      const cw = await BBM.API.getContinueWatching();
      const entry = cw[this.tmdbID];
      if (entry && entry.progress > 10) {
        const pct = entry.duration > 0 ? entry.progress / entry.duration : 0;
        // If >= 90%, remove from continue watching (considered finished)
        if (pct >= 0.9) {
          try { await BBM.API.removeContinueWatching(this.tmdbID); } catch (e) {}
          return;
        }
        // Si même épisode/film
        const sameContent = this.type === 'movie' ||
          (entry.seasonNumber === this.season && entry.episodeNumber === this.episode);
        if (sameContent) {
          this.video.currentTime = entry.progress;
        }
      }
    } catch (e) {
      // Ignore
    }
  },

  async onVideoEnded() {
    // Supprimer de "reprendre" si terminé
    if (this.tmdbID) {
      try {
        await BBM.API.removeContinueWatching(this.tmdbID);
      } catch (e) { /* ignore */ }
    }

    // Pour les séries, proposer l'épisode suivant (simple redirect)
    if (this.type === 'series' && this.tmdbID) {
      await BBM.API.fetchAllItems();
      const series = BBM.API.getSeriesMap().get(String(this.tmdbID));
      if (series) {
        const currentIdx = series.episodes.findIndex(
          e => e.seasonNumber === this.season && e.episodeNumber === this.episode
        );
        if (currentIdx >= 0 && currentIdx < series.episodes.length - 1) {
          const next = series.episodes[currentIdx + 1];
          const title = `${series.seriesTitle} - S${String(next.seasonNumber).padStart(2, '0')}E${String(next.episodeNumber).padStart(2, '0')}`;
          setTimeout(() => {
            window.location.href = `watch.html?v=${encodeURIComponent(next.url)}&title=${encodeURIComponent(title)}&tmdbid=${this.tmdbID}&type=series&s=${next.seasonNumber}&e=${next.episodeNumber}`;
          }, 3000);
        }
      }
    }
  },

  /* ----------------------------------------
     SVG Icons
     ---------------------------------------- */
  icons: {
    play: '<svg viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="white"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>',
    volumeHigh: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="white"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    volumeLow: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="white"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    volumeMute: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="white"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
  }
};

/* Toast for player page */
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

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  BBM.Player.init();
});
