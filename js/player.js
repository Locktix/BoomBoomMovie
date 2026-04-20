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
  isMobile: /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)),

  /* ----------------------------------------
     Initialization
     ---------------------------------------- */
  async init() {
    await BBM.Auth.requireAuth();

    const params = new URLSearchParams(window.location.search);
    let videoURL = params.get('v');
    let title = params.get('title') || 'Lecture en cours';
    this.tmdbID = params.get('tmdbid');
    this.type = params.get('type');
    this.season = params.get('s') ? parseInt(params.get('s')) : null;
    this.episode = params.get('e') ? parseInt(params.get('e')) : null;

    // --- Watch Party join mode : fetch video info from the room ---------
    const partyCode = params.get('party');
    if (partyCode) {
      try {
        const partyData = await BBM.API.joinWatchParty(partyCode);
        videoURL = partyData.videoURL || videoURL;
        title = partyData.title || title;
        this.tmdbID = partyData.tmdbID || this.tmdbID;
        this.type = partyData.type || this.type;
        this.season = partyData.season != null ? partyData.season : this.season;
        this.episode = partyData.episode != null ? partyData.episode : this.episode;
        this._partyCode = partyCode.toUpperCase();
        this._partyHostUid = partyData.hostUid;
        this._isPartyHost = BBM.Auth.currentUser?.uid === partyData.hostUid;
      } catch (err) {
        alert('Watch party introuvable : ' + (err.message || 'erreur'));
        window.location.href = 'browse.html';
        return;
      }
    }

    if (!videoURL) {
      window.location.href = 'browse.html';
      return;
    }

    this.video = document.getElementById('player-video');
    this.overlay = document.getElementById('player-overlay');

    // Set title + premium chip/subtitle
    this.setHeaderMeta(title);

    // Load video
    this.video.src = videoURL;

    // Buffer overlay feedback (works for both mobile and desktop paths)
    this.setupBufferOverlay();

    // Cast (Chromecast + AirPlay)
    this.setupCast(videoURL, title);

    // Watch Party — setup host / guest sync
    await this.setupWatchParty(params);

    // Sur mobile/tablette, utiliser le player natif du navigateur
    if (this.isMobile) {
      this.overlay.style.display = 'none';
      // Hide premium decorations so they don't cover the native controls
      document.querySelectorAll('.player-grain, .player-vignette').forEach(el => {
        el.style.display = 'none';
      });
      this.video.setAttribute('controls', '');
      this.video.setAttribute('playsinline', '');
      this.video.setAttribute('webkit-playsinline', '');
      this.setupNativeControls();
      this.setupMobileSkipButtons();
      this.loadProgress();
    } else {
      this.video.setAttribute('playsinline', '');
      this.setupControls();
      this.setupKeyboard();
      this.setupAutoHide();
      this.setupSettings();
      this.loadProgress();
    }

    // Episode navigation (séries uniquement)
    if (this.type === 'series' && this.tmdbID) {
      this.setupEpisodeNav();
    }

    // Autoplay
    this.video.addEventListener('canplay', () => {
      this.video.play().catch(() => {});
    }, { once: true });

    // Loading screen: populate title + wire back button + hide only on canplay.
    // This way the player never flashes with "0:00 / 0:00" before the video is
    // ready to play.
    const loader = document.getElementById('loading-screen');
    const loadingTitle = document.getElementById('watch-loading-title');
    const loadingSubtitle = document.getElementById('watch-loading-subtitle');
    const loadingBack = document.getElementById('watch-loading-back');

    if (this.type === 'series' && this.season != null && this.episode != null) {
      const epCode = `S${String(this.season).padStart(2, '0')}E${String(this.episode).padStart(2, '0')}`;
      const epRegex = /\s[-—]\s*S\d{2}E\d{2}\s*$/i;
      const seriesName = title.replace(epRegex, '').trim();
      if (loadingTitle) loadingTitle.textContent = seriesName || title;
      if (loadingSubtitle) loadingSubtitle.textContent = `Saison ${this.season} · Épisode ${this.episode} · ${epCode}`;
    } else {
      if (loadingTitle) loadingTitle.textContent = title;
      if (loadingSubtitle) loadingSubtitle.textContent = '';
    }

    if (loadingBack) {
      loadingBack.addEventListener('click', () => {
        window.location.href = 'browse.html';
      });
    }

    const hideLoader = () => {
      if (!loader || loader.classList.contains('fade-out')) return;
      loader.classList.add('fade-out');
      setTimeout(() => loader.style.display = 'none', 500);
    };

    // Hide on canplay (video ready) or after a safety timeout (~12s)
    this.video.addEventListener('canplay', hideLoader, { once: true });
    this.video.addEventListener('loadeddata', hideLoader, { once: true });
    setTimeout(hideLoader, 12000);
  },

  /* ----------------------------------------
     Presence — push "currently watching" info
     ---------------------------------------- */
  _pushPresenceWatching() {
    if (!this.video || this.video.paused) return;
    const titleEl = document.getElementById('player-title');
    const title = titleEl?.textContent || 'Lecture en cours';
    BBM.API.updatePresence({
      tmdbID: this.tmdbID || null,
      title,
      type: this.type || 'movie',
      season: this.season != null ? this.season : null,
      episode: this.episode != null ? this.episode : null,
      currentTime: Math.floor(this.video.currentTime || 0),
      duration: Math.floor(this.video.duration || 0)
    }).catch(() => {});
  },

  /* ----------------------------------------
     Watch Party — host & guest sync
     ---------------------------------------- */
  async setupWatchParty(params) {
    const btn = document.getElementById('btn-watch-party');
    const badge = document.getElementById('watch-party-badge');
    const codeDisplay = document.getElementById('watch-party-code-display');
    const countDisplay = document.getElementById('watch-party-count');

    // --- Guest mode: already joined via ?party=CODE in init() -----------
    if (this._partyCode && !this._isPartyHost) {
      if (badge) {
        badge.style.display = '';
        if (codeDisplay) codeDisplay.textContent = this._partyCode;
      }
      if (btn) btn.style.display = 'none'; // guest can't re-create
      this._attachPartyListener();
      return;
    }

    // --- Host continuation mode: host re-opens with ?party=CODE ---------
    if (this._partyCode && this._isPartyHost) {
      if (badge) {
        badge.style.display = '';
        if (codeDisplay) codeDisplay.textContent = this._partyCode;
      }
      this._attachPartyListener();
      this._attachPartyHostBindings();
      return;
    }

    // --- Normal mode: wire "Create party" button ------------------------
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        const code = await BBM.API.createWatchParty({
          tmdbID: this.tmdbID,
          title: document.getElementById('player-title')?.textContent || 'Lecture',
          videoURL: this.video.src,
          type: this.type,
          season: this.season,
          episode: this.episode
        });
        this._partyCode = code;
        this._isPartyHost = true;
        this._showWatchPartyModal(code);
        if (badge) {
          badge.style.display = '';
          if (codeDisplay) codeDisplay.textContent = code;
        }
        this._attachPartyListener();
        this._attachPartyHostBindings();
        // Push current state so late joiners catch up
        this._pushPartyState();
      } catch (err) {
        console.error('Watch party create failed:', err);
        BBM.Toast.show('Impossible de créer la Watch Party', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  },

  _showWatchPartyModal(code) {
    const modal = document.getElementById('wp-modal');
    const codeEl = document.getElementById('wp-code');
    const copyLink = document.getElementById('wp-copy-link');
    const copyCode = document.getElementById('wp-copy-code');
    const endBtn = document.getElementById('wp-end');
    const closeBtn = document.getElementById('wp-close');
    if (!modal || !codeEl) return;

    codeEl.textContent = code;
    modal.style.display = '';
    this.video.pause();

    const shareURL = `${location.origin}${location.pathname.replace(/watch\.html$/, '')}watch.html?party=${code}`;

    const safeClose = () => { modal.style.display = 'none'; this.video.play().catch(() => {}); };
    closeBtn.onclick = safeClose;
    modal.onclick = (e) => { if (e.target === modal) safeClose(); };

    copyLink.onclick = async () => {
      try {
        await navigator.clipboard.writeText(shareURL);
        BBM.Toast.show('Lien copié !', 'success');
      } catch (e) { BBM.Toast.show('Impossible de copier', 'error'); }
    };
    copyCode.onclick = async () => {
      try {
        await navigator.clipboard.writeText(code);
        BBM.Toast.show('Code copié !', 'success');
      } catch (e) { BBM.Toast.show('Impossible de copier', 'error'); }
    };
    endBtn.onclick = async () => {
      if (!confirm('Terminer la Watch Party ? Les invités seront éjectés.')) return;
      await BBM.API.endWatchParty(this._partyCode);
      this._partyCode = null;
      this._isPartyHost = false;
      document.getElementById('watch-party-badge').style.display = 'none';
      safeClose();
      BBM.Toast.show('Watch Party terminée');
    };
  },

  _attachPartyListener() {
    const countDisplay = document.getElementById('watch-party-count');
    this._partyUnsubscribe = BBM.API.listenWatchParty(this._partyCode, (state) => {
      // Update participants count
      if (countDisplay && state.participants) {
        countDisplay.textContent = Object.keys(state.participants).length;
      }
      // If I'm a guest, mirror the host's state
      if (!this._isPartyHost) this._applyPartyState(state);
    });

    window.addEventListener('beforeunload', () => {
      if (this._partyUnsubscribe) this._partyUnsubscribe();
      if (this._partyCode) {
        BBM.API.leaveWatchParty(this._partyCode, BBM.Auth.currentUser?.uid);
      }
    });
  },

  _applyPartyState(state) {
    if (this._isPartyHost) return;
    if (!this.video) return;
    this._ignoreNextPlaybackEvent = true;
    // Sync play/pause
    if (state.isPlaying && this.video.paused) {
      this.video.play().catch(() => {});
    } else if (!state.isPlaying && !this.video.paused) {
      this.video.pause();
    }
    // Sync position if drift > 2s
    if (typeof state.currentTime === 'number') {
      const drift = Math.abs(this.video.currentTime - state.currentTime);
      if (drift > 2) this.video.currentTime = state.currentTime;
    }
    setTimeout(() => { this._ignoreNextPlaybackEvent = false; }, 400);
  },

  _attachPartyHostBindings() {
    if (!this.video) return;
    const push = () => this._pushPartyState();
    this.video.addEventListener('play', push);
    this.video.addEventListener('pause', push);
    this.video.addEventListener('seeked', push);
    // Periodic heartbeat so guests self-correct drift over time
    this._partyHeartbeat = setInterval(push, 8000);
  },

  _pushPartyState() {
    if (!this._isPartyHost || !this._partyCode || this._ignoreNextPlaybackEvent) return;
    BBM.API.updateWatchPartyState(this._partyCode, {
      currentTime: this.video.currentTime || 0,
      isPlaying: !this.video.paused
    });
  },

  /* ----------------------------------------
     Cast — Chromecast + AirPlay
     ---------------------------------------- */
  setupCast(videoURL, title) {
    this._castVideoURL = videoURL;
    this._castTitle = title;

    const castBtn = document.getElementById('btn-cast');
    if (!castBtn) return;

    let castMode = null; // 'chromecast' | 'airplay' | null

    // ---------- AirPlay detection (Safari iOS/macOS) ----------
    const v = this.video;
    const airplayAvailable = typeof v.webkitShowPlaybackTargetPicker === 'function';
    if (airplayAvailable) {
      castMode = 'airplay';
      castBtn.style.display = '';
      // React to device availability changes (AirPlay-capable device on network)
      v.addEventListener('webkitplaybacktargetavailabilitychanged', (e) => {
        castBtn.style.display = (e.availability === 'available') ? '' : 'none';
      });
      castBtn.addEventListener('click', () => {
        try { v.webkitShowPlaybackTargetPicker(); }
        catch (err) { console.warn('AirPlay picker failed:', err); }
      });
    }

    // ---------- Chromecast (overrides AirPlay when both available) ----------
    // The Google Cast Sender SDK is loaded async; onCastApiReady() fires when
    // the framework is ready. That method swaps the click handler.
  },

  onCastApiReady() {
    if (!window.cast || !cast.framework) return;
    const castBtn = document.getElementById('btn-cast');
    const overlay = document.getElementById('cast-active-overlay');
    const deviceLabel = document.getElementById('cast-active-device');
    const stopBtn = document.getElementById('cast-active-stop');
    if (!castBtn) return;

    const ctx = cast.framework.CastContext.getInstance();
    ctx.setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    });

    castBtn.style.display = '';
    // Remove any old click handler by cloning
    const fresh = castBtn.cloneNode(true);
    castBtn.parentNode.replaceChild(fresh, castBtn);

    const launchCast = async () => {
      try {
        await ctx.requestSession();
        this._loadCurrentMediaToCast();
      } catch (err) {
        if (err && err.toString && err.toString().includes('cancel')) return;
        console.warn('Cast session error:', err);
        BBM.Toast.show('Diffusion impossible — vérifie que ton appareil est sur le même Wi-Fi', 'error', 5000);
      }
    };
    fresh.addEventListener('click', launchCast);

    // React to session state changes to show/hide "casting" overlay
    ctx.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      (event) => {
        const state = event.sessionState;
        const session = ctx.getCurrentSession();
        if (state === cast.framework.SessionState.SESSION_STARTED ||
            state === cast.framework.SessionState.SESSION_RESUMED) {
          this.video.pause();
          if (overlay) overlay.style.display = '';
          if (deviceLabel && session) {
            const castDevice = session.getCastDevice();
            deviceLabel.textContent = (castDevice && castDevice.friendlyName) || 'Appareil de diffusion';
          }
          this._loadCurrentMediaToCast();
        } else if (state === cast.framework.SessionState.SESSION_ENDED) {
          if (overlay) overlay.style.display = 'none';
        }
      }
    );

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        const session = ctx.getCurrentSession();
        if (session) session.endSession(true);
      });
    }
  },

  _loadCurrentMediaToCast() {
    if (!window.cast || !cast.framework) return;
    const ctx = cast.framework.CastContext.getInstance();
    const session = ctx.getCurrentSession();
    if (!session || !this._castVideoURL) return;

    const mediaInfo = new chrome.cast.media.MediaInfo(this._castVideoURL, 'video/mp4');
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = this._castTitle || 'Lecture';

    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    // Resume from current local time if video has started
    request.currentTime = this.video.currentTime || 0;
    request.autoplay = true;

    session.loadMedia(request).catch(err => {
      console.warn('Cast load failed:', err);
      BBM.Toast.show('Impossible de lire cette vidéo sur l\'appareil', 'error', 4000);
    });
  },

  /* ----------------------------------------
     Mobile Skip Buttons (±10s) — overlay on top of native player
     ---------------------------------------- */
  setupMobileSkipButtons() {
    const row = document.getElementById('mobile-skip-row');
    const back = document.getElementById('mobile-skip-back');
    const fwd = document.getElementById('mobile-skip-forward');
    if (!row || !back || !fwd) return;

    row.style.display = '';
    const v = this.video;
    back.addEventListener('click', () => {
      v.currentTime = Math.max(0, v.currentTime - 10);
    });
    fwd.addEventListener('click', () => {
      v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
    });
  },

  /* ----------------------------------------
     Buffer Overlay — visual feedback during loading/buffering
     ---------------------------------------- */
  setupBufferOverlay() {
    const overlay = document.getElementById('player-buffer-overlay');
    const text = document.getElementById('player-buffer-text');
    const hint = document.getElementById('player-buffer-hint');
    if (!overlay) return;

    const v = this.video;
    let hintTimer = null;

    const show = (label, reveal) => {
      if (text && label) text.textContent = label;
      if (reveal === false && hint) hint.classList.remove('visible');
      overlay.classList.add('active');
      clearTimeout(hintTimer);
      if (reveal !== false && hint) {
        // Reveal the "première lecture" hint after 3s of waiting
        hintTimer = setTimeout(() => hint.classList.add('visible'), 3000);
      }
    };

    const hide = () => {
      overlay.classList.remove('active');
      clearTimeout(hintTimer);
      if (hint) hint.classList.remove('visible');
    };

    v.addEventListener('loadstart', () => show('Chargement…', true));
    v.addEventListener('waiting', () => show('Mise en mémoire tampon…', false));
    v.addEventListener('seeking', () => show('Recherche…', false));
    v.addEventListener('canplay', hide);
    v.addEventListener('playing', hide);
    v.addEventListener('seeked', hide);

    v.addEventListener('error', () => {
      if (text) text.textContent = 'Erreur de lecture';
      if (hint) {
        hint.textContent = 'Impossible de charger la vidéo. Vérifie ta connexion ou réessaie.';
        hint.classList.add('visible');
      }
      overlay.classList.add('active', 'error');
      clearTimeout(hintTimer);
    });
  },

  /* ----------------------------------------
     Premium Header Meta (chip + subtitle)
     ---------------------------------------- */
  setHeaderMeta(title) {
    const titleEl = document.getElementById('player-title');
    const chip = document.getElementById('player-type-chip');
    const chipText = document.getElementById('player-type-chip-text');
    const subtitle = document.getElementById('player-subtitle');

    if (this.type === 'series' && this.season != null && this.episode != null) {
      // Split "Series Title - S01E01" → series title + S01E01
      const epCode = `S${String(this.season).padStart(2, '0')}E${String(this.episode).padStart(2, '0')}`;
      const epRegex = /\s[-—]\s*S\d{2}E\d{2}\s*$/i;
      const seriesName = title.replace(epRegex, '').trim();
      if (titleEl) titleEl.textContent = seriesName || title;
      if (chip && chipText) {
        chipText.textContent = 'SÉRIE';
        chip.style.display = '';
      }
      if (subtitle) {
        subtitle.textContent = `Saison ${this.season} · Épisode ${this.episode} · ${epCode}`;
        subtitle.style.display = '';
      }
    } else if (this.type === 'movie') {
      if (titleEl) titleEl.textContent = title;
      if (chip && chipText) {
        chipText.textContent = 'FILM';
        chip.style.display = '';
      }
      if (subtitle) subtitle.style.display = 'none';
    } else {
      if (titleEl) titleEl.textContent = title;
      if (chip) chip.style.display = 'none';
      if (subtitle) subtitle.style.display = 'none';
    }
  },

  /* ----------------------------------------
     Native Player — Mobile/Tablet (save/load only)
     ---------------------------------------- */
  setupNativeControls() {
    const v = this.video;

    v.addEventListener('play', () => { this.isPlaying = true; this._pushPresenceWatching(); });
    v.addEventListener('pause', () => { BBM.API.updatePresence(null).catch(() => {}); });
    v.addEventListener('pause', () => {
      this.isPlaying = false;
      if (v.currentTime > 5) this.saveProgress();
    });

    // Save progress periodically
    setInterval(() => {
      if (this.isPlaying && v.currentTime > 5) {
        this.saveProgress();
      }
      // Also refresh presence (watching state) every tick while playing
      if (this.isPlaying) this._pushPresenceWatching();
    }, 10000);

    window.addEventListener('beforeunload', () => {
      if (v.currentTime > 5) this.saveProgress();
      BBM.API.updatePresence(null).catch(() => {});
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

    // Volume — restore from localStorage
    const volumeBtn = document.getElementById('btn-volume');
    const volumeSlider = document.getElementById('volume-slider');

    const savedVolume = localStorage.getItem('bbm_volume');
    const savedMuted = localStorage.getItem('bbm_muted') === 'true';
    if (savedVolume !== null) {
      v.volume = parseFloat(savedVolume);
      volumeSlider.value = v.volume;
    }
    v.muted = savedMuted;
    this.updateVolumeIcon();

    volumeBtn.addEventListener('click', () => {
      v.muted = !v.muted;
      localStorage.setItem('bbm_muted', v.muted);
      this.updateVolumeIcon();
    });

    volumeSlider.addEventListener('input', () => {
      v.volume = parseFloat(volumeSlider.value);
      v.muted = false;
      localStorage.setItem('bbm_volume', v.volume);
      localStorage.setItem('bbm_muted', 'false');
      this.updateVolumeIcon();
    });

    v.addEventListener('volumechange', () => {
      volumeSlider.value = v.muted ? 0 : v.volume;
      this.updateVolumeIcon();
    });

    // Picture-in-Picture
    const pipBtn = document.getElementById('btn-pip');
    if (document.pictureInPictureEnabled) {
      pipBtn.style.display = '';
      pipBtn.addEventListener('click', async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else {
            await v.requestPictureInPicture();
          }
        } catch (e) { /* ignore */ }
      });
    }

    // Fullscreen
    const fsBtn = document.getElementById('btn-fullscreen');
    fsBtn.addEventListener('click', () => this.toggleFullscreen());

    // Toggle the icon depending on fullscreen state
    const updateFsIcon = () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      fsBtn.innerHTML = inFs ? this.icons.fullscreenExit : this.icons.fullscreenEnter;
    };
    document.addEventListener('fullscreenchange', updateFsIcon);
    document.addEventListener('webkitfullscreenchange', updateFsIcon);
    updateFsIcon();

    // Shortcuts overlay
    document.getElementById('btn-shortcuts')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleShortcuts();
    });
    document.getElementById('shortcuts-close')?.addEventListener('click', () => {
      this.toggleShortcuts();
    });
    document.getElementById('shortcuts-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'shortcuts-overlay') this.toggleShortcuts();
    });

    // Progress bar
    const progressBar = document.getElementById('player-progress');
    const progressFilled = document.getElementById('progress-filled');
    const progressThumb = document.getElementById('progress-thumb');
    const progressBuffered = document.getElementById('progress-buffered');
    const timeDisplay = document.getElementById('player-time');

    // Seek state
    let seeking = false;
    let lastVisualPct = 0;

    const updateProgressUI = (pct) => {
      lastVisualPct = pct;
      progressFilled.style.width = pct + '%';
      progressThumb.style.left = pct + '%';
    };

    v.addEventListener('timeupdate', () => {
      // Ne pas écraser la barre pendant un seek ou si les données sont invalides
      if (seeking) return;
      if (!v.duration || isNaN(v.duration) || isNaN(v.currentTime)) return;
      // Ignorer les sauts brusques à 0 pendant le buffering
      if (v.currentTime === 0 && lastVisualPct > 5 && !v.paused) return;
      const pct = (v.currentTime / v.duration) * 100;
      updateProgressUI(pct);
      timeDisplay.textContent = `${this.formatTime(v.currentTime)} / ${this.formatTime(v.duration)}`;
    });

    v.addEventListener('progress', () => {
      if (v.buffered.length > 0 && v.duration && !isNaN(v.duration)) {
        const buffPct = (v.buffered.end(v.buffered.length - 1) / v.duration) * 100;
        progressBuffered.style.width = buffPct + '%';
      }
    });

    // Seek — mise à jour visuelle instantanée, seek vidéo en différé
    let seekRAF = null;

    const seekFromX = (clientX) => {
      const rect = progressBar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      // Mise à jour visuelle immédiate (pas de lag)
      updateProgressUI(pct * 100);
      if (v.duration && !isNaN(v.duration)) {
        timeDisplay.textContent = `${this.formatTime(pct * v.duration)} / ${this.formatTime(v.duration)}`;
        // Throttle le seek réel pour éviter de surcharger le décodeur
        if (seekRAF) cancelAnimationFrame(seekRAF);
        seekRAF = requestAnimationFrame(() => {
          v.currentTime = pct * v.duration;
        });
      }
    };

    progressBar.addEventListener('mousedown', (e) => {
      seeking = true;
      seekFromX(e.clientX);
    });

    document.addEventListener('mousemove', (e) => {
      if (seeking) seekFromX(e.clientX);
    });

    document.addEventListener('mouseup', () => {
      if (seeking) {
        seeking = false;
        seekRAF = null;
      }
    });

    // Touch support for progress bar
    progressBar.addEventListener('touchstart', (e) => {
      seeking = true;
      seekFromX(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });

    progressBar.addEventListener('touchmove', (e) => {
      if (seeking) {
        seekFromX(e.touches[0].clientX);
        e.preventDefault();
      }
    }, { passive: false });

    progressBar.addEventListener('touchend', () => {
      seeking = false;
      seekRAF = null;
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
     Episode Navigation (Prev / Next)
     ---------------------------------------- */
  async setupEpisodeNav() {
    await BBM.API.fetchAllItems();
    const series = BBM.API.getSeriesMap().get(String(this.tmdbID));
    if (!series) return;

    const currentIdx = series.episodes.findIndex(
      e => e.seasonNumber === this.season && e.episodeNumber === this.episode
    );
    if (currentIdx < 0) return;

    const buildURL = (ep) => {
      const title = `${series.seriesTitle} - S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`;
      return `watch.html?v=${encodeURIComponent(ep.url)}&title=${encodeURIComponent(title)}&tmdbid=${this.tmdbID}&type=series&s=${ep.seasonNumber}&e=${ep.episodeNumber}`;
    };

    const goToEpisode = (url) => {
      this.saveProgress();
      window.location.href = url;
    };

    // Previous episode
    if (currentIdx > 0) {
      const prevBtn = document.getElementById('btn-prev-ep');
      const prev = series.episodes[currentIdx - 1];
      prevBtn.style.display = '';
      prevBtn.addEventListener('click', () => goToEpisode(buildURL(prev)));
    }

    // Next episode
    if (currentIdx < series.episodes.length - 1) {
      const nextBtn = document.getElementById('btn-next-ep');
      const next = series.episodes[currentIdx + 1];
      nextBtn.style.display = '';
      nextBtn.addEventListener('click', () => goToEpisode(buildURL(next)));
    }
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
     Settings Panel (Audio / Subtitles)
     ---------------------------------------- */
  setupSettings() {
    const btn = document.getElementById('btn-settings');
    const panel = document.getElementById('settings-panel');
    const v = this.video;

    // Toggle panel
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains('open');
      if (isOpen) {
        panel.classList.remove('open');
      } else {
        this.refreshSettingsPanel();
        panel.classList.add('open');
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target !== btn) {
        panel.classList.remove('open');
      }
    });

    // Detect tracks once video metadata is loaded
    v.addEventListener('loadedmetadata', () => this.refreshSettingsPanel());
  },

  refreshSettingsPanel() {
    const v = this.video;
    const speedSection = document.getElementById('settings-speed');
    const audioSection = document.getElementById('settings-audio');
    const subsSection = document.getElementById('settings-subs');

    // --- Playback Speed ---
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    speedSection.innerHTML = '<div class="settings-section-title">Vitesse</div>';
    speeds.forEach(speed => {
      const label = speed === 1 ? 'Normal' : speed + 'x';
      const item = document.createElement('div');
      item.className = 'settings-item' + (v.playbackRate === speed ? ' active' : '');
      item.innerHTML = `<span class="settings-item-check"></span><span>${label}</span>`;
      item.addEventListener('click', () => {
        v.playbackRate = speed;
        this.refreshSettingsPanel();
      });
      speedSection.appendChild(item);
    });
    let hasAny = false;

    // --- Audio Tracks ---
    const audioTracks = v.audioTracks;
    if (audioTracks && audioTracks.length > 1) {
      hasAny = true;
      audioSection.classList.add('has-tracks');
      audioSection.innerHTML = '<div class="settings-section-title">Audio</div>';
      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        const label = track.label || track.language || `Piste ${i + 1}`;
        const lang = track.language ? ` (${track.language.toUpperCase()})` : '';
        const item = document.createElement('div');
        item.className = 'settings-item' + (track.enabled ? ' active' : '');
        item.innerHTML = `<span class="settings-item-check"></span><span>${label}${lang}</span>`;
        item.addEventListener('click', () => {
          for (let j = 0; j < audioTracks.length; j++) {
            audioTracks[j].enabled = (j === i);
          }
          this.refreshSettingsPanel();
        });
        audioSection.appendChild(item);
      }
    } else {
      audioSection.classList.remove('has-tracks');
      audioSection.innerHTML = '';
    }

    // --- Subtitle / Text Tracks ---
    const textTracks = v.textTracks;
    if (textTracks && textTracks.length > 0) {
      hasAny = true;
      subsSection.classList.add('has-tracks');
      subsSection.innerHTML = '<div class="settings-section-title">Sous-titres</div>';

      // Option "Off"
      const allDisabled = Array.from(textTracks).every(t => t.mode === 'disabled' || t.mode === 'hidden');
      const offItem = document.createElement('div');
      offItem.className = 'settings-item' + (allDisabled ? ' active' : '');
      offItem.innerHTML = '<span class="settings-item-check"></span><span>Désactivés</span>';
      offItem.addEventListener('click', () => {
        for (let j = 0; j < textTracks.length; j++) {
          textTracks[j].mode = 'disabled';
        }
        this.refreshSettingsPanel();
      });
      subsSection.appendChild(offItem);

      for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];
        const label = track.label || track.language || `Piste ${i + 1}`;
        const lang = track.language ? ` (${track.language.toUpperCase()})` : '';
        const item = document.createElement('div');
        item.className = 'settings-item' + (track.mode === 'showing' ? ' active' : '');
        item.innerHTML = `<span class="settings-item-check"></span><span>${label}${lang}</span>`;
        item.addEventListener('click', () => {
          for (let j = 0; j < textTracks.length; j++) {
            textTracks[j].mode = (j === i) ? 'showing' : 'disabled';
          }
          this.refreshSettingsPanel();
        });
        subsSection.appendChild(item);
      }
    } else {
      subsSection.classList.remove('has-tracks');
      subsSection.innerHTML = '';
    }
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
        case '?':
          e.preventDefault();
          this.toggleShortcuts();
          break;
        case 'Escape':
          if (this._shortcutsOpen) {
            this.toggleShortcuts();
          } else if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            this.saveProgress();
            window.location.href = 'browse.html';
          }
          break;
      }
    });
  },

  toggleShortcuts() {
    const overlay = document.getElementById('shortcuts-overlay');
    if (!overlay) return;
    this._shortcutsOpen = !this._shortcutsOpen;
    overlay.classList.toggle('active', this._shortcutsOpen);
    if (this._shortcutsOpen) {
      this._wasPlayingBeforeShortcuts = !this.video.paused;
      if (!this.video.paused) this.video.pause();
    } else if (this._wasPlayingBeforeShortcuts) {
      this.video.play();
    }
  },

  /* ----------------------------------------
     Helpers
     ---------------------------------------- */
  toggleFullscreen() {
    const container = document.querySelector('.player-container');
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (this.video.webkitEnterFullscreen) {
        // Safari iOS fallback (video element only)
        this.video.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
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
    // If >= 90% watched, mark as fully watched (progress = duration)
    if (duration > 0 && (progress / duration) >= 0.9) {
      try {
        await BBM.API.saveContinueWatching(this.tmdbID, {
          progress: duration,
          duration,
          category: this.type,
          seasonNumber: this.season,
          episodeNumber: this.episode
        });
        if (this.type === 'series') {
          await BBM.API.markEpisodeWatched(this.tmdbID, this.season, this.episode);
        }
      } catch (e) {}
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
        // If >= 90%, already watched — start from beginning
        if (pct >= 0.9) return;
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
    // Marquer comme vu (progress = duration)
    if (this.tmdbID && this.video.duration) {
      const duration = Math.floor(this.video.duration);
      try {
        await BBM.API.saveContinueWatching(this.tmdbID, {
          progress: duration,
          duration,
          category: this.type,
          seasonNumber: this.season,
          episodeNumber: this.episode
        });
        if (this.type === 'series') {
          await BBM.API.markEpisodeWatched(this.tmdbID, this.season, this.episode);
        }
      } catch (e) { /* ignore */ }
    }

    // Pour les séries, afficher l'overlay épisode suivant
    if (this.type === 'series' && this.tmdbID) {
      await BBM.API.fetchAllItems();
      const series = BBM.API.getSeriesMap().get(String(this.tmdbID));
      if (series) {
        const currentIdx = series.episodes.findIndex(
          e => e.seasonNumber === this.season && e.episodeNumber === this.episode
        );
        if (currentIdx >= 0 && currentIdx < series.episodes.length - 1) {
          const next = series.episodes[currentIdx + 1];
          const nextTitle = `${series.seriesTitle} — S${String(next.seasonNumber).padStart(2, '0')}E${String(next.episodeNumber).padStart(2, '0')}`;
          const nextURL = `watch.html?v=${encodeURIComponent(next.url)}&title=${encodeURIComponent(nextTitle)}&tmdbid=${this.tmdbID}&type=series&s=${next.seasonNumber}&e=${next.episodeNumber}`;
          this.showNextEpisode(nextTitle, nextURL);
        }
      }
    }
  },

  showNextEpisode(title, url) {
    const overlay = document.getElementById('next-episode-overlay');
    const titleEl = document.getElementById('next-ep-title');
    const countdownEl = document.getElementById('next-ep-countdown');
    const playBtn = document.getElementById('next-ep-play');
    const cancelBtn = document.getElementById('next-ep-cancel');

    titleEl.textContent = title;
    overlay.style.display = '';
    const total = 10;
    let seconds = total;
    countdownEl.textContent = seconds;

    // SVG ring (r=20 → circumference ≈ 125.66)
    const ringFg = document.getElementById('next-ep-ring-fg');
    const CIRC = 2 * Math.PI * 20;
    if (ringFg) {
      ringFg.style.strokeDasharray = CIRC;
      ringFg.style.strokeDashoffset = '0';
    }

    const goNext = () => {
      clearInterval(timer);
      window.location.href = url;
    };

    const timer = setInterval(() => {
      seconds--;
      countdownEl.textContent = seconds;
      if (ringFg) {
        const elapsed = total - seconds;
        ringFg.style.strokeDashoffset = (CIRC * (elapsed / total)).toFixed(2);
      }
      if (seconds <= 0) goNext();
    }, 1000);

    playBtn.addEventListener('click', goNext);

    cancelBtn.addEventListener('click', () => {
      clearInterval(timer);
      overlay.style.display = 'none';
    });
  },

  /* ----------------------------------------
     SVG Icons
     ---------------------------------------- */
  icons: {
    play: '<svg viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="white"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>',
    volumeHigh: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="white"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    volumeLow: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="white"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    volumeMute: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="white"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    fullscreenEnter: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><polyline points="21 3 14 10"/><polyline points="3 21 10 14"/></svg>',
    fullscreenExit: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
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
