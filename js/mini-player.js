/* ============================================
   BoomBoomMovie — Mini-player flottant persistant
   Affiche un widget en bas-droite quand l'utilisateur navigue ailleurs
   pendant une lecture. Clic = reprise au même timecode.
   ============================================

   ÉTAT V1 — pas de lecture vidéo réelle dans le widget. C'est un
   "raccourci de reprise" : on capture la position au moment où l'user
   quitte la page de lecture (beforeunload + bouton retour) et on
   l'affiche partout ailleurs comme un rappel visuel cliquable.

   La vraie lecture continue dans le mini-widget nécessiterait de
   ré-instancier hls.js sur chaque page et de gérer la transition de
   l'élément <video> à travers les navigations — complexe en multi-page
   classique. À garder pour une v2 si le besoin se fait sentir.
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'bbm_mini_player_state';
  const DISMISSED_KEY = 'bbm_mini_player_dismissed';

  const MiniPlayer = {
    /** Sauvegarde l'état de lecture actuel — appelé par player.js */
    saveState(state) {
      if (!state || !state.videoURL) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          videoURL: state.videoURL,
          title: state.title || '',
          currentTime: Math.floor(state.currentTime || 0),
          duration: state.duration || 0,
          tmdbID: state.tmdbID || null,
          type: state.type || 'movie',
          season: state.season != null ? state.season : null,
          episode: state.episode != null ? state.episode : null,
          posterPath: state.posterPath || null,
          savedAt: Date.now()
        }));
      } catch (e) { /* quota errors → silently ignore */ }
    },

    /** Efface l'état (appelé quand on revient au player) */
    clearState() {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
    },

    getState() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    },

    isDismissed(state) {
      try {
        return sessionStorage.getItem(DISMISSED_KEY) === this._stateSig(state);
      } catch (e) { return false; }
    },

    _stateSig(state) {
      return `${state.videoURL || ''}|${state.currentTime || 0}`;
    },

    /** Construit l'URL pour reprendre la lecture (deep-link avec ?t=) */
    buildResumeURL(state) {
      const params = new URLSearchParams();
      params.set('v', state.videoURL);
      if (state.title) params.set('title', state.title);
      if (state.tmdbID) params.set('tmdbid', state.tmdbID);
      if (state.type) params.set('type', state.type);
      if (state.season != null) params.set('s', state.season);
      if (state.episode != null) params.set('e', state.episode);
      params.set('t', String(state.currentTime || 0));
      return 'watch.html?' + params.toString();
    },

    /** Crée et affiche le widget si un état est présent */
    render() {
      // Ne pas afficher sur la page de lecture elle-même
      if (window.location.pathname.endsWith('/watch.html')
          || window.location.pathname.endsWith('watch.html')) return;

      const state = this.getState();
      if (!state || !state.videoURL) return;
      if (this.isDismissed(state)) return;

      // Évite les doublons
      if (document.getElementById('mini-player')) return;

      const widget = document.createElement('div');
      widget.id = 'mini-player';
      widget.className = 'mini-player';
      widget.setAttribute('role', 'complementary');
      widget.setAttribute('aria-label', 'Reprendre la lecture');

      const posterURL = state.posterPath && window.BBM?.API?.getPosterURL
        ? BBM.API.getPosterURL(state.posterPath, 'w185')
        : null;

      const epLabel = state.type === 'series' && state.season != null && state.episode != null
        ? `S${String(state.season).padStart(2, '0')}E${String(state.episode).padStart(2, '0')}`
        : '';

      const pct = state.duration > 0
        ? Math.max(0, Math.min(100, (state.currentTime / state.duration) * 100))
        : 0;

      widget.innerHTML = `
        <button class="mini-player-close" aria-label="Fermer le mini-lecteur">✕</button>
        <a class="mini-player-link" href="${this.buildResumeURL(state)}">
          <div class="mini-player-poster">
            ${posterURL
              ? `<img src="${posterURL}" alt="" loading="lazy">`
              : '<div class="mini-player-poster-ph"></div>'}
            <div class="mini-player-play">
              <svg viewBox="0 0 24 24" fill="white" width="22" height="22"><polygon points="6,3 21,12 6,21"/></svg>
            </div>
          </div>
          <div class="mini-player-meta">
            <div class="mini-player-kicker">REPRENDRE</div>
            <div class="mini-player-title">${this._escape(state.title || 'Lecture en cours')}</div>
            ${epLabel ? `<div class="mini-player-ep">${epLabel}</div>` : ''}
            <div class="mini-player-progress"><div class="mini-player-progress-fill" style="width:${pct.toFixed(1)}%"></div></div>
          </div>
        </a>
      `;
      document.body.appendChild(widget);
      requestAnimationFrame(() => widget.classList.add('visible'));

      widget.querySelector('.mini-player-close').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { sessionStorage.setItem(DISMISSED_KEY, this._stateSig(state)); } catch (err) {}
        widget.classList.remove('visible');
        setTimeout(() => widget.remove(), 250);
      });
    },

    _escape(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }
  };

  window.BBM = window.BBM || {};
  BBM.MiniPlayer = MiniPlayer;

  // Auto-render au chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MiniPlayer.render());
  } else {
    MiniPlayer.render();
  }
})();
