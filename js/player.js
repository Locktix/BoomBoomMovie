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

    // Load video — détecte HLS et bascule sur hls.js si le navigateur n'a
    // pas de support natif (Chrome/Firefox/Edge)
    this._attachVideoSource(videoURL);

    // Cleanup hls.js on page unload + save mini-player state for resume.
    // Stash the closure refs so other handlers (back button, etc.) can
    // trigger a save without rebuilding the args.
    this._currentVideoURL = videoURL;
    this._currentTitle = title;
    window.addEventListener('beforeunload', () => {
      if (this._hls) { try { this._hls.destroy(); } catch (e) {} }
      this._saveMiniPlayerState(this._currentVideoURL, this._currentTitle);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this._saveMiniPlayerState(this._currentVideoURL, this._currentTitle);
      }
    });

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

    // Skip intro / outro markers (load + wire up admin panel if admin)
    this.setupSkipMarkers();

    // Mini-player came back? Clear the saved state since we're now on the
    // full player page again
    BBM.MiniPlayer?.clearState();

    // Warm up the TMDB cache for this item so the mini-player has the
    // poster_path ready when the user navigates away
    if (this.tmdbID && BBM.API?.getTMDBData) {
      const tmdbType = this.type === 'series' ? 'tv' : 'movie';
      BBM.API.getTMDBData(this.tmdbID, tmdbType).then(data => {
        if (data?.poster_path) this._cachedPosterPath = data.poster_path;
      }).catch(() => {});
    }

    // Honor a deep-link ?t=SECONDS to seek on first canplay (used by the
    // mini-player widget to resume exactly where we left off)
    const resumeAt = parseInt(params.get('t') || '0', 10);
    if (resumeAt > 0) {
      const seekOnce = () => {
        try { this.video.currentTime = resumeAt; } catch (e) {}
      };
      this.video.addEventListener('loadedmetadata', seekOnce, { once: true });
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
    if (!this.video) return;
    const titleEl = document.getElementById('player-title');
    const title = titleEl?.textContent || 'Lecture en cours';
    BBM.API.updatePresence({
      tmdbID: this.tmdbID || null,
      title,
      type: this.type || 'movie',
      season: this.season != null ? this.season : null,
      episode: this.episode != null ? this.episode : null,
      currentTime: Math.floor(this.video.currentTime || 0),
      paused: !!this.video.paused,
      duration: Math.floor(this.video.duration || 0)
    }).catch(() => {});
  },

  /** Persiste le titre courant comme "dernier vu" (1× par session de
   *  lecture, déclenché au-delà de 30s de visionnage). */
  _recordLastWatched() {
    if (!this.tmdbID) return;
    const titleEl = document.getElementById('player-title');
    BBM.API.recordLastWatched({
      tmdbID: this.tmdbID,
      title: titleEl?.textContent || '',
      type: this.type || 'movie',
      season: this.season,
      episode: this.episode,
      posterPath: this._cachedPosterPath || null
    }).catch(() => {});
  },

  /* ----------------------------------------
     Source loader — natif vs hls.js
     ----------------------------------------
     Safari/iOS supporte HLS nativement (canPlayType
     'application/vnd.apple.mpegurl'). Pour les autres navigateurs, on
     utilise hls.js (chargé via CDN dans watch.html). Pour les sources
     non-HLS (mp4 etc.) on garde l'attribution directe `video.src`.
  */
  _attachVideoSource(url) {
    // Détruit toute instance hls.js précédente (changement d'épisode,
    // join party, etc.)
    if (this._hls) {
      try { this._hls.destroy(); } catch (e) {}
      this._hls = null;
    }

    const isHls = BBM.API && typeof BBM.API.isHlsUrl === 'function'
      ? BBM.API.isHlsUrl(url)
      : /\.m3u8(\?|$)/i.test(url || '');

    if (!isHls) {
      this.video.src = url;
      return;
    }

    // Support natif (Safari, iOS)
    if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.src = url;
      return;
    }

    // hls.js
    if (window.Hls && window.Hls.isSupported()) {
      this._hls = new window.Hls({
        // Tuning raisonnable pour streaming long-form
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true
      });
      this._hls.loadSource(url);
      this._hls.attachMedia(this.video);
      this._hls.on(window.Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case window.Hls.ErrorTypes.NETWORK_ERROR:
            try { this._hls.startLoad(); } catch (e) {}
            break;
          case window.Hls.ErrorTypes.MEDIA_ERROR:
            try { this._hls.recoverMediaError(); } catch (e) {}
            break;
          default:
            try { this._hls.destroy(); } catch (e) {}
            this._hls = null;
            BBM.Toast?.show?.('Erreur de lecture du flux HLS', 'error');
        }
      });
      return;
    }

    // Fallback ultime — laisse le navigateur tenter
    this.video.src = url;
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
      // Reveal chat UI in case the party is already started — the
      // listener will hide the lobby right after it fires the first
      // snapshot, so the guest can use the chat immediately.
      this._revealChatUI();
      this._showLobby({ isHost: false });
      this._attachPartyListener();
      this._attachPartyChat();
      this._attachPartyReactions();
      return;
    }

    // --- Host continuation mode: host re-opens with ?party=CODE ---------
    if (this._partyCode && this._isPartyHost) {
      if (badge) {
        badge.style.display = '';
        if (codeDisplay) codeDisplay.textContent = this._partyCode;
      }
      // Hide the "create party" button — host is already in one, clicking
      // it would create a new party and orphan the existing one
      if (btn) btn.style.display = 'none';
      // Reveal the chat button + panel right away. If the party is still
      // in lobby mode (started=false), the listener will show the lobby
      // overlay over the player and the user can click Démarrer.
      this._revealChatUI();
      this._attachPartyListener();
      this._attachPartyHostBindings();
      this._attachPartyChat();
      this._attachPartyReactions();
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
        if (badge) {
          badge.style.display = '';
          if (codeDisplay) codeDisplay.textContent = code;
        }
        // Hide the create button now that we're in a party — prevents an
        // accidental click that would create a second one
        btn.style.display = 'none';
        this._showLobby({ isHost: true });
        this.video.pause();
        this._attachPartyListener();
        this._attachPartyHostBindings();
        this._attachPartyChat();
        this._attachPartyReactions();
      } catch (err) {
        console.error('Watch party create failed:', err);
        BBM.Toast.show('Impossible de créer la Watch Party', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  },

  /* --- Lobby ------------------------------------------------------ */

  _showLobby({ isHost }) {
    const lobby = document.getElementById('wp-lobby');
    if (!lobby) return;
    lobby.style.display = '';
    document.getElementById('wp-lobby-code').textContent = this._partyCode || '------';
    document.getElementById('wp-lobby-start').style.display = isHost ? '' : 'none';
    document.getElementById('wp-lobby-waiting').style.display = isHost ? 'none' : '';
    if (this.video) this.video.pause();
    this._lobbyVisible = true;
    this._lobbyOpenedAt = Date.now();

    // Inactivity hint for the host — show after 5 min if still in lobby
    // alone, in case they forgot the tab is open
    if (isHost && !this._lobbyHostHintTimer) {
      this._lobbyHostHintTimer = setTimeout(() => {
        if (!this._lobbyVisible) return;
        const subtitle = document.getElementById('wp-lobby-subtitle');
        if (subtitle) {
          subtitle.textContent = '👋 Toujours en attente ? Démarre quand tu veux ou ferme la fenêtre pour annuler.';
          subtitle.style.color = 'var(--bbm-accent)';
        }
      }, 5 * 60 * 1000);
    }

    // Copy share link
    const copyBtn = document.getElementById('wp-lobby-copy');
    if (copyBtn && !copyBtn._wired) {
      copyBtn._wired = true;
      copyBtn.addEventListener('click', async () => {
        const shareURL = `${location.origin}${location.pathname.replace(/watch\.html$/, '')}watch.html?party=${this._partyCode}`;
        try {
          await navigator.clipboard.writeText(shareURL);
          BBM.Toast.show('Lien copié !', 'success');
        } catch (e) { BBM.Toast.show('Impossible de copier', 'error'); }
      });
    }

    // Start button (host only)
    const startBtn = document.getElementById('wp-lobby-start');
    if (startBtn && !startBtn._wired) {
      startBtn._wired = true;
      startBtn.addEventListener('click', async () => {
        startBtn.disabled = true;
        await BBM.API.startWatchParty(this._partyCode);
        // The party listener will hide the lobby once started=true echoes back
      });
    }

    // Leave button
    const leaveBtn = document.getElementById('wp-lobby-leave');
    if (leaveBtn && !leaveBtn._wired) {
      leaveBtn._wired = true;
      leaveBtn.addEventListener('click', async () => {
        if (this._isPartyHost) {
          if (!confirm('Terminer la Watch Party ? Les invités seront éjectés.')) return;
          await BBM.API.endWatchParty(this._partyCode);
        } else {
          await BBM.API.leaveWatchParty(this._partyCode, BBM.Auth.currentUser?.uid);
        }
        window.location.href = 'browse.html';
      });
    }
  },

  _hideLobby() {
    const lobby = document.getElementById('wp-lobby');
    if (lobby) lobby.style.display = 'none';
    this._lobbyVisible = false;
    if (this._lobbyHostHintTimer) {
      clearTimeout(this._lobbyHostHintTimer);
      this._lobbyHostHintTimer = null;
    }
    this._revealChatUI();
    // For host, start playback
    if (this._isPartyHost && this.video?.paused) {
      this.video.play().catch(() => {});
    }
  },

  /** Show the chat button in the controls and the chat panel container.
   *  Idempotent — safe to call multiple times. Used both when the lobby
   *  ends and when an existing party is re-opened (host or guest). */
  _revealChatUI() {
    const chatBtn = document.getElementById('btn-wp-chat');
    if (chatBtn) chatBtn.style.display = '';
    // The chat panel uses display:none in HTML so it doesn't take
    // hit-test space pre-party. Switching to '' lets the .open class
    // drive the slide-in animation via transform.
    const chat = document.getElementById('wp-chat');
    if (chat) chat.style.display = '';
  },

  _renderLobbyParticipants(state) {
    const list = document.getElementById('wp-lobby-participants');
    const countEl = document.getElementById('wp-lobby-count');
    const pluralEl = document.getElementById('wp-lobby-plural');
    const hostNameEl = document.getElementById('wp-lobby-host-name');
    if (!list) return;
    const parts = state.participants || {};
    const entries = Object.entries(parts);
    if (countEl) countEl.textContent = String(entries.length);
    if (pluralEl) pluralEl.textContent = entries.length > 1 ? 's' : '';
    if (hostNameEl) hostNameEl.textContent = state.hostName || 'l\'hôte';
    list.innerHTML = entries.map(([uid, p]) => {
      const isHost = uid === state.hostUid;
      const initial = (p.name || '?').charAt(0).toUpperCase();
      const safeName = String(p.name || 'Anon').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `
        <div class="wp-lobby-participant${isHost ? ' is-host' : ''}">
          <div class="wp-lobby-avatar">${initial}</div>
          <div class="wp-lobby-name">${safeName}</div>
          ${isHost ? '<div class="wp-lobby-host-badge">HOST</div>' : ''}
        </div>
      `;
    }).join('');
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
      // Party was deleted (host ended it or admin purged it). Tell the
      // user and redirect — no point staying on a dead session.
      if (state === null) {
        if (this._partyEnded) return; // already handled
        this._partyEnded = true;
        if (this._partyUnsubscribe) { this._partyUnsubscribe(); this._partyUnsubscribe = null; }
        if (this._chatUnsubscribe) { this._chatUnsubscribe(); this._chatUnsubscribe = null; }
        if (this._reactionsUnsubscribe) { this._reactionsUnsubscribe(); this._reactionsUnsubscribe = null; }
        BBM.Toast?.show('La Watch Party a été terminée par l\'hôte', 'info', 4000);
        // Small delay so the toast is visible before redirect
        setTimeout(() => { window.location.href = 'browse.html'; }, 1200);
        return;
      }
      // Update participants count
      if (countDisplay && state.participants) {
        countDisplay.textContent = Object.keys(state.participants).length;
      }
      // Re-render lobby roster
      if (this._lobbyVisible) this._renderLobbyParticipants(state);
      // Handle lobby → playback transition
      if (state.started === true && this._lobbyVisible) {
        this._hideLobby();
      }
      // If I'm a guest, mirror the host's state (only after start)
      if (!this._isPartyHost && state.started === true) {
        this._applyPartyState(state);
      }
    });

    window.addEventListener('beforeunload', () => {
      if (this._partyUnsubscribe) this._partyUnsubscribe();
      if (this._chatUnsubscribe) this._chatUnsubscribe();
      if (this._reactionsUnsubscribe) this._reactionsUnsubscribe();
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
    // Sync position if drift > 2s. Queue the seek if metadata isn't ready
    // yet — setting currentTime before loadedmetadata is a no-op on most
    // browsers and would leave the guest stuck at 0:00 indefinitely.
    if (typeof state.currentTime === 'number') {
      const target = state.currentTime;
      const dur = this.video.duration;
      if (!dur || isNaN(dur)) {
        // Metadata not loaded yet — replace any pending queued seek and
        // wait for loadedmetadata to apply
        this._pendingPartySeek = target;
        if (!this._partySeekListenerAttached) {
          this._partySeekListenerAttached = true;
          this.video.addEventListener('loadedmetadata', () => {
            if (this._pendingPartySeek != null) {
              try { this.video.currentTime = this._pendingPartySeek; } catch (e) {}
              this._pendingPartySeek = null;
            }
          }, { once: true });
        }
      } else {
        const drift = Math.abs(this.video.currentTime - target);
        if (drift > 2) this.video.currentTime = target;
      }
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

  /* --- Watch Party — Chat ----------------------------------------- */

  _attachPartyChat() {
    const btn = document.getElementById('btn-wp-chat');
    const chat = document.getElementById('wp-chat');
    const closeBtn = document.getElementById('wp-chat-close');
    const form = document.getElementById('wp-chat-form');
    const input = document.getElementById('wp-chat-input');
    const messagesEl = document.getElementById('wp-chat-messages');
    const unreadDot = document.getElementById('chat-unread-dot');
    if (!chat || !form || !input || !messagesEl) return;

    let lastMsgCount = 0;
    let chatOpen = false;

    const renderMessages = (msgs) => {
      const myUid = BBM.Auth.currentUser?.uid;
      const wasNearBottom = messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 50;
      messagesEl.innerHTML = msgs.map(m => {
        const safeText = String(m.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        // System message — join/leave events, no bubble, centered italic
        if (m.system) {
          return `<div class="wp-chat-msg-system">${safeText}</div>`;
        }
        const isMine = m.senderUid === myUid;
        const safeName = String(m.senderName || 'Anon').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return `
          <div class="wp-chat-msg${isMine ? ' is-mine' : ''}">
            ${isMine ? '' : `<div class="wp-chat-msg-author">${safeName}</div>`}
            <div class="wp-chat-msg-bubble">${safeText}</div>
          </div>
        `;
      }).join('');
      if (wasNearBottom || chatOpen) messagesEl.scrollTop = messagesEl.scrollHeight;
      // Unread badge — only when chat is closed AND there are new messages
      if (!chatOpen && msgs.length > lastMsgCount && unreadDot) {
        unreadDot.style.display = '';
      }
      lastMsgCount = msgs.length;
    };

    this._chatUnsubscribe = BBM.API.listenChatMessages(this._partyCode, renderMessages);

    const container = document.querySelector('.player-container');
    btn?.addEventListener('click', () => {
      chatOpen = !chatOpen;
      chat.classList.toggle('open', chatOpen);
      container?.classList.toggle('with-chat', chatOpen);
      if (chatOpen) {
        input.focus();
        if (unreadDot) unreadDot.style.display = 'none';
      }
    });
    closeBtn?.addEventListener('click', () => {
      chatOpen = false;
      chat.classList.remove('open');
      container?.classList.remove('with-chat');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value;
      input.value = '';
      if (!text.trim()) return;
      try {
        await BBM.API.sendChatMessage(this._partyCode, text);
      } catch (err) {
        BBM.Toast.show('Message non envoyé', 'error');
      }
    });
  },

  /* --- Watch Party — Reactions ------------------------------------ */

  _attachPartyReactions() {
    const layer = document.getElementById('wp-reactions-layer');
    const reactionsBar = document.getElementById('wp-chat-reactions');
    if (!layer) return;

    reactionsBar?.querySelectorAll('.wp-reaction-btn').forEach(b => {
      b.addEventListener('click', () => {
        const emoji = b.dataset.emoji;
        BBM.API.sendReaction(this._partyCode, emoji);
        // Quick visual feedback — bump the button briefly
        b.classList.add('pulsed');
        setTimeout(() => b.classList.remove('pulsed'), 250);
      });
    });

    this._reactionsUnsubscribe = BBM.API.listenReactions(this._partyCode, (reaction) => {
      this._floatReaction(reaction.emoji, reaction.senderName);
    });
  },

  _floatReaction(emoji, senderName) {
    const layer = document.getElementById('wp-reactions-layer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'wp-reaction-float';
    el.innerHTML = `
      <div class="wp-reaction-emoji">${emoji}</div>
      ${senderName ? `<div class="wp-reaction-author">${String(senderName).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>` : ''}
    `;
    // Random horizontal start within 60-90% of width
    el.style.left = (60 + Math.random() * 30) + '%';
    el.style.animationDelay = (Math.random() * 0.2) + 's';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
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
    // Sur pause, on garde watching (avec paused:true) pour que l'admin
    // voit toujours ce qu'il regarde — un "pause de 1s pour boire" ne
    // doit pas faire disparaître l'user de la liste "Regarde"
    v.addEventListener('pause', () => {
      this.isPlaying = false;
      this._pushPresenceWatching();
      if (v.currentTime > 5) this.saveProgress();
    });

    // Heartbeat continu : refresh la présence toutes les 20s tant que
    // le player est ouvert (peu importe play/pause)
    setInterval(() => {
      if (this.isPlaying && v.currentTime > 5) {
        this.saveProgress();
        // Enregistre comme "dernier vu" après 30s de visionnage
        if (v.currentTime > 30 && !this._lastWatchedRecorded) {
          this._lastWatchedRecorded = true;
          this._recordLastWatched();
        }
      }
      this._pushPresenceWatching();
    }, 20000);

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

    // Back button — explicit leave BEFORE navigating. The async write
    // queued in beforeunload isn't reliable (Firestore SDK keeps writes
    // in memory only by default, and the page is destroyed before
    // flush), so we await the leave here so the system message +
    // participant removal actually reach the server.
    document.getElementById('player-back').addEventListener('click', async (e) => {
      e.preventDefault();
      this.saveProgress();
      this._saveMiniPlayerState(this._currentVideoURL, this._currentTitle);
      if (this._partyCode) {
        try {
          await BBM.API.leaveWatchParty(this._partyCode, BBM.Auth.currentUser?.uid);
        } catch (err) { /* navigate anyway */ }
      }
      window.location.href = 'browse.html';
    });

    // Play/Pause
    const playPauseBtn = document.getElementById('btn-play-pause');
    const playPauseCenter = document.getElementById('btn-center-play');

    /** Returns true if the current user is a guest in a watch party.
        Guests aren't allowed to control playback — only the host is. */
    const isPartyGuest = () => !!this._partyCode && !this._isPartyHost;

    const togglePlay = () => {
      if (isPartyGuest()) {
        BBM.Toast?.show('Seul l\'hôte peut contrôler la lecture', 'info', 1800);
        return;
      }
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

    // Rewind / Forward (also blocked for guests — would desync them)
    document.getElementById('btn-rewind').addEventListener('click', () => {
      if (isPartyGuest()) {
        BBM.Toast?.show('Seul l\'hôte peut contrôler la lecture', 'info', 1800);
        return;
      }
      v.currentTime = Math.max(0, v.currentTime - 10);
    });

    document.getElementById('btn-forward').addEventListener('click', () => {
      if (isPartyGuest()) {
        BBM.Toast?.show('Seul l\'hôte peut contrôler la lecture', 'info', 1800);
        return;
      }
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

    // Ultra-wide 21:9 toggle
    const uwBtn = document.getElementById('btn-ultrawide');
    if (uwBtn) {
      uwBtn.addEventListener('click', () => {
        const container = document.querySelector('.player-container');
        const video = document.getElementById('player-video');
        const active = container.classList.toggle('ultrawide-mode');
        uwBtn.classList.toggle('active', active);
        uwBtn.title = active ? 'Mode normal' : 'Mode Ultra-Wide 21:9';
        if (video) {
          if (active) {
            video.style.setProperty('width', '131.25%', 'important');
            video.style.setProperty('height', '131.25%', 'important');
            video.style.setProperty('left', '-15.625%', 'important');
            video.style.setProperty('top', '-15.625%', 'important');
          } else {
            video.style.removeProperty('width');
            video.style.removeProperty('height');
            video.style.removeProperty('left');
            video.style.removeProperty('top');
          }
        }
      });
    }

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
      // Block seek for guests in a watch party — only the host can seek
      if (this._partyCode && !this._isPartyHost) {
        BBM.Toast?.show('Seul l\'hôte peut contrôler la lecture', 'info', 1800);
        return;
      }
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
      if (this._partyCode && !this._isPartyHost) {
        BBM.Toast?.show('Seul l\'hôte peut contrôler la lecture', 'info', 1800);
        return;
      }
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

    // Save progress + push presence heartbeat (every 20s, peu importe
    // play/pause — l'admin doit voir l'user comme actif tant que le
    // player est ouvert)
    setInterval(() => {
      if (this.isPlaying && v.currentTime > 5) {
        this.saveProgress();
        if (v.currentTime > 30 && !this._lastWatchedRecorded) {
          this._lastWatchedRecorded = true;
          this._recordLastWatched();
        }
      }
      this._pushPresenceWatching();
    }, 20000);

    // Save + push presence on pause (gardé visible côté admin avec paused:true)
    v.addEventListener('pause', () => {
      if (v.currentTime > 5) this.saveProgress();
      this._pushPresenceWatching();
    });
    v.addEventListener('play', () => this._pushPresenceWatching());

    // Save when leaving page
    window.addEventListener('beforeunload', () => {
      if (v.currentTime > 5) this.saveProgress();
      BBM.API.updatePresence(null).catch(() => {});
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
      // Ignore shortcuts when typing in any text field (chat input, search,
      // etc.) — otherwise space/k/?/f trigger play, shortcuts overlay, etc.
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select'
          || e.target?.isContentEditable) return;
      // Guests in a watch party can't control playback — only the host can.
      // Allow only "F" (fullscreen), "M" (mute), "?" (shortcuts) which are
      // local-only and don't affect playback state.
      const isPartyGuest = !!this._partyCode && !this._isPartyHost;
      const allowedForGuest = ['f', 'F', 'm', 'M', '?', 'Escape'];
      if (isPartyGuest && !allowedForGuest.includes(e.key)) {
        const blocking = [' ', 'k', 'K', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'j', 'J', 'l', 'L'];
        if (blocking.includes(e.key)) {
          e.preventDefault();
          BBM.Toast?.show('Seul l\'hôte peut contrôler la lecture', 'info', 1800);
        }
        return;
      }
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

  /** Snapshot the current playback state into the mini-player widget so
      the user can resume after navigating away. */
  _saveMiniPlayerState(videoURL, title) {
    if (!BBM.MiniPlayer || !this.video) return;
    const t = this.video.currentTime || 0;
    const dur = this.video.duration || 0;
    if (t < 5) { BBM.MiniPlayer.clearState(); return; } // not worth restoring barely-started videos
    // Don't suggest "Reprendre" on a video that's essentially finished —
    // the user has watched it, the mini-player would just be confusing.
    if (dur > 0 && t / dur > 0.95) { BBM.MiniPlayer.clearState(); return; }
    let posterPath = this._cachedPosterPath || null;
    if (!posterPath) {
      try {
        const cacheKey = `tmdb_${this.type === 'series' ? 'tv' : 'movie'}_${this.tmdbID}`;
        const tmdb = BBM.API?._cache?.[cacheKey]
          || (localStorage.getItem(cacheKey) ? JSON.parse(localStorage.getItem(cacheKey)) : null);
        posterPath = tmdb?.poster_path || null;
      } catch (e) {}
    }
    BBM.MiniPlayer.saveState({
      videoURL,
      title: (document.getElementById('player-title')?.textContent || title || '').trim(),
      currentTime: t,
      duration: this.video.duration || 0,
      tmdbID: this.tmdbID,
      type: this.type,
      season: this.season,
      episode: this.episode,
      posterPath
    });
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

  /* ----------------------------------------
     Skip Intro / Outro
     ---------------------------------------- */
  async setupSkipMarkers() {
    if (!this.tmdbID) return;

    this._skipMarkers = { recapStart: null, recapEnd: null, introStart: null, introEnd: null, outroStart: null, outroEnd: null, postCreditsAt: null };

    const recapBtn = document.getElementById('skip-btn-recap');
    const introBtn = document.getElementById('skip-btn-intro');
    const outroBtn = document.getElementById('skip-btn-outro');
    const outroBtnLabel = outroBtn?.querySelector('.skip-btn-label');

    // Load stored markers
    try {
      const data = await BBM.API.getSkipMarkers(this.tmdbID, this.type, this.season, this.episode);
      if (data) {
        ['recapStart', 'recapEnd', 'introStart', 'introEnd', 'outroStart', 'outroEnd', 'postCreditsAt'].forEach(k => {
          if (data[k] != null && !isNaN(data[k])) this._skipMarkers[k] = Number(data[k]);
        });
      }
    } catch (e) { /* ignore — markers simply won't appear */ }

    this._renderSkipMarkers();
    this._refreshOutroBtnLabel();

    // Skip buttons — click handlers
    recapBtn?.addEventListener('click', () => {
      const end = this._skipMarkers.recapEnd;
      if (end != null && this.video) {
        this.video.currentTime = end + 0.1;
      }
    });
    introBtn?.addEventListener('click', () => {
      const end = this._skipMarkers.introEnd;
      if (end != null && this.video) {
        this.video.currentTime = end + 0.1;
      }
    });
    outroBtn?.addEventListener('click', () => {
      // If a post-credits scene is registered, skip to it instead of past
      // the entire outro — preserves the scene for the user.
      const target = this._skipMarkers.postCreditsAt != null
        ? this._skipMarkers.postCreditsAt
        : this._skipMarkers.outroEnd;
      if (target != null && this.video) {
        this.video.currentTime = target + 0.1;
      }
    });

    // Watch currentTime to show/hide skip buttons (and auto-skip intro if enabled)
    const tick = () => {
      if (!this.video || !this._skipMarkers) return;
      const t = this.video.currentTime;
      const m = this._skipMarkers;
      const inRecap = m.recapStart != null && m.recapEnd != null
        && t >= m.recapStart && t < m.recapEnd;
      const inIntro = m.introStart != null && m.introEnd != null
        && t >= m.introStart && t < m.introEnd;
      const inOutro = m.outroStart != null && m.outroEnd != null
        && t >= m.outroStart && t < m.outroEnd;
      if (recapBtn) recapBtn.style.display = inRecap ? '' : 'none';
      if (introBtn) introBtn.style.display = inIntro ? '' : 'none';
      if (outroBtn) outroBtn.style.display = inOutro ? '' : 'none';
      // Auto-skip intro if user opted in via settings (only once per session,
      // so a manual seek back into the intro doesn't get auto-skipped again)
      const autoSkip = window.BBM?.Settings?.get?.('playback.skipIntro');
      if (autoSkip && inIntro && !this._autoSkippedIntro) {
        this._autoSkippedIntro = true;
        this.video.currentTime = m.introEnd + 0.1;
      }
    };
    this.video.addEventListener('timeupdate', tick);
    this.video.addEventListener('seeked', tick);

    // Re-render markers when duration becomes known
    this.video.addEventListener('loadedmetadata', () => this._renderSkipMarkers());
    this.video.addEventListener('durationchange', () => this._renderSkipMarkers());

    // Admin panel — only if user is admin
    try {
      const isAdmin = await BBM.Auth.isAdmin();
      if (isAdmin) this._setupSkipAdminPanel();
    } catch (e) { /* not admin, ignore */ }
  },

  _renderSkipMarkers() {
    const recapMark = document.getElementById('skip-marker-recap');
    const introMark = document.getElementById('skip-marker-intro');
    const outroMark = document.getElementById('skip-marker-outro');
    const postMark = document.getElementById('skip-marker-postcredits');
    const duration = this.video?.duration;
    if (!duration || isNaN(duration)) {
      if (recapMark) recapMark.style.display = 'none';
      if (introMark) introMark.style.display = 'none';
      if (outroMark) outroMark.style.display = 'none';
      if (postMark) postMark.style.display = 'none';
      return;
    }
    const m = this._skipMarkers || {};
    const placeRange = (el, start, end) => {
      if (!el) return;
      if (start == null || end == null || end <= start) { el.style.display = 'none'; return; }
      const left = Math.max(0, Math.min(100, (start / duration) * 100));
      const right = Math.max(0, Math.min(100, (end / duration) * 100));
      el.style.left = left + '%';
      el.style.width = Math.max(0, right - left) + '%';
      el.style.display = '';
    };
    const placePoint = (el, t) => {
      if (!el) return;
      if (t == null || isNaN(t) || t < 0 || t > duration) { el.style.display = 'none'; return; }
      el.style.left = ((t / duration) * 100) + '%';
      el.style.display = '';
    };
    placeRange(recapMark, m.recapStart, m.recapEnd);
    placeRange(introMark, m.introStart, m.introEnd);
    placeRange(outroMark, m.outroStart, m.outroEnd);
    placePoint(postMark, m.postCreditsAt);
  },

  _refreshOutroBtnLabel() {
    const outroBtn = document.getElementById('skip-btn-outro');
    if (!outroBtn) return;
    const labelEl = outroBtn.querySelector('.skip-btn-label');
    if (!labelEl) return;
    const hasPost = this._skipMarkers?.postCreditsAt != null;
    labelEl.textContent = hasPost ? 'Aller au post-générique' : 'Passer l\'outro';
  },

  _setupSkipAdminPanel() {
    const btn = document.getElementById('btn-skip-admin');
    const panel = document.getElementById('skip-admin-panel');
    const closeBtn = document.getElementById('skip-admin-close');
    const saveBtn = document.getElementById('skip-admin-save');
    const statusEl = document.getElementById('skip-admin-status');
    if (!btn || !panel) return;

    btn.style.display = '';

    const refreshDisplay = () => {
      const m = this._skipMarkers || {};
      const fmt = (v) => (v != null && !isNaN(v)) ? this.formatTime(v) : '—';
      const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setText('skip-admin-recap-start-time', fmt(m.recapStart));
      setText('skip-admin-recap-end-time', fmt(m.recapEnd));
      setText('skip-admin-intro-start-time', fmt(m.introStart));
      setText('skip-admin-intro-end-time', fmt(m.introEnd));
      setText('skip-admin-outro-start-time', fmt(m.outroStart));
      setText('skip-admin-outro-end-time', fmt(m.outroEnd));
      setText('skip-admin-postcredits-time', fmt(m.postCreditsAt));
    };
    refreshDisplay();

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const visible = panel.style.display !== 'none';
      panel.style.display = visible ? 'none' : '';
      if (!visible) refreshDisplay();
    });
    closeBtn?.addEventListener('click', () => { panel.style.display = 'none'; });

    // Set buttons — capture current time
    panel.querySelectorAll('[data-set]').forEach(b => {
      b.addEventListener('click', () => {
        const key = b.dataset.set;
        this._skipMarkers[key] = this.video.currentTime;
        refreshDisplay();
        this._renderSkipMarkers();
        this._refreshOutroBtnLabel();
        if (statusEl) statusEl.textContent = 'Modifié (non sauvegardé)';
      });
    });
    // Clear buttons
    panel.querySelectorAll('[data-clear]').forEach(b => {
      b.addEventListener('click', () => {
        const key = b.dataset.clear;
        this._skipMarkers[key] = null;
        refreshDisplay();
        this._renderSkipMarkers();
        this._refreshOutroBtnLabel();
        if (statusEl) statusEl.textContent = 'Modifié (non sauvegardé)';
      });
    });
    // Save
    saveBtn?.addEventListener('click', async () => {
      saveBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Sauvegarde…';
      try {
        await BBM.API.setSkipMarkers(this.tmdbID, this.type, this.season, this.episode, this._skipMarkers);
        if (statusEl) statusEl.textContent = 'Sauvegardé ✓';
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Erreur : ' + (err.message || err);
      } finally {
        saveBtn.disabled = false;
      }
    });
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
