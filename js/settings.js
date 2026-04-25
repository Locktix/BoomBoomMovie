/* ============================================
   BoomBoomMovie — Settings Module
   Client-side preferences (localStorage) + optional Firestore sync
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'bbm_settings_v1';

  // Accent color palettes: [rgb, rgbDeep, hover]
  const ACCENT_PALETTES = {
    violet:  { rgb: '139, 92, 246',  deep: '109, 40, 217',  hover: '#A78BFA', label: 'Violet' },
    red:     { rgb: '229, 9, 20',    deep: '184, 29, 36',   hover: '#F45B6B', label: 'Rouge' },
    amber:   { rgb: '212, 168, 67',  deep: '166, 127, 40',  hover: '#E4BC5A', label: 'Ambre' },
    emerald: { rgb: '16, 185, 129',  deep: '4, 120, 87',    hover: '#34D399', label: 'Émeraude' },
    pink:    { rgb: '236, 72, 153',  deep: '190, 24, 93',   hover: '#F472B6', label: 'Rose' },
    blue:    { rgb: '59, 130, 246',  deep: '29, 78, 216',   hover: '#60A5FA', label: 'Bleu' },
    cyan:    { rgb: '6, 182, 212',   deep: '14, 116, 144',  hover: '#22D3EE', label: 'Cyan' }
  };

  const DEFAULTS = Object.freeze({
    // Playback
    'playback.autoplayNext': true,
    'playback.autoplayCountdown': 10,
    'playback.skipIntro': false,
    'playback.defaultSpeed': 1,
    'playback.defaultVolume': 100,
    'playback.pipAuto': false,

    // Appearance
    'appearance.accent': 'violet',
    'appearance.density': 'normal',
    'appearance.highContrast': false,

    // Performance
    'performance.potatoMode': false,
    'performance.grain': true,
    'performance.heroTrailer': true,
    'performance.hoverPanel': true,
    'performance.parallax': true,
    'performance.orbs': true,
    'performance.animations': true,
    'performance.posterQuality': 'normal',

    // Home
    'home.autoplayHero': true,
    'home.heroTrailerDelay': 2.5,
    'home.showTop10': true,
    'home.showBento': true,
    'home.showRecommendations': true,
    'home.itemsPerRow': 6,

    // Notifications
    'notifications.requestApproved': true,
    'notifications.newContent': true,
    'notifications.browserPush': false,

    // TV
    'tv.forceTvMode': false,
    'tv.focusRingSize': 'normal',
    'tv.debugOverlay': false,

    // Privacy
    'privacy.saveProgress': true,
    'privacy.saveHistory': true
  });

  function loadRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) { return {}; }
  }

  function saveRaw(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  const state = Object.assign({}, DEFAULTS, loadRaw());
  const listeners = new Set();

  const Settings = {
    DEFAULTS,
    ACCENT_PALETTES,

    get(key) {
      return state[key];
    },

    set(key, value) {
      if (state[key] === value) return;
      state[key] = value;
      saveRaw(state);
      this.apply();
      listeners.forEach(fn => { try { fn(key, value); } catch (e) { console.error(e); } });
    },

    reset() {
      Object.keys(state).forEach(k => delete state[k]);
      Object.assign(state, DEFAULTS);
      saveRaw(state);
      this.apply();
      listeners.forEach(fn => { try { fn(null, null); } catch (e) {} });
    },

    all() {
      return Object.assign({}, state);
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Apply visual settings to DOM */
    apply() {
      const root = document.documentElement;
      const body = document.body;
      if (!body) return;

      // Accent
      const palette = ACCENT_PALETTES[state['appearance.accent']] || ACCENT_PALETTES.violet;
      root.style.setProperty('--bbm-accent-rgb', palette.rgb);
      root.style.setProperty('--bbm-accent-deep-rgb', palette.deep);
      root.style.setProperty('--bbm-accent-hover', palette.hover);

      // Density
      body.classList.remove('bbm-density-compact', 'bbm-density-normal', 'bbm-density-spacious');
      body.classList.add('bbm-density-' + (state['appearance.density'] || 'normal'));

      // High contrast
      body.classList.toggle('bbm-high-contrast', !!state['appearance.highContrast']);

      // Performance toggles — individual classes so CSS can target each
      const perfKeys = {
        'performance.potatoMode': 'bbm-potato',
        'performance.grain': 'bbm-no-grain',
        'performance.hoverPanel': 'bbm-no-hover-panel',
        'performance.heroTrailer': 'bbm-no-hero-trailer',
        'performance.parallax': 'bbm-no-parallax',
        'performance.orbs': 'bbm-no-orbs',
        'performance.animations': 'bbm-no-animations'
      };
      // potatoMode adds its own class; the others are inverted (*-no-* when disabled)
      body.classList.toggle('bbm-potato', !!state['performance.potatoMode']);
      body.classList.toggle('bbm-no-grain', !state['performance.grain']);
      body.classList.toggle('bbm-no-hover-panel', !state['performance.hoverPanel']);
      body.classList.toggle('bbm-no-hero-trailer', !state['performance.heroTrailer']);
      body.classList.toggle('bbm-no-parallax', !state['performance.parallax']);
      body.classList.toggle('bbm-no-orbs', !state['performance.orbs']);
      body.classList.toggle('bbm-no-animations', !state['performance.animations']);

      // Home hide toggles
      body.classList.toggle('bbm-hide-top10', !state['home.showTop10']);
      body.classList.toggle('bbm-hide-bento', !state['home.showBento']);
      body.classList.toggle('bbm-hide-reco', !state['home.showRecommendations']);

      // Items per row — CSS var
      root.style.setProperty('--bbm-items-per-row', String(state['home.itemsPerRow'] || 6));

      // TV focus ring size
      const ring = state['tv.focusRingSize'];
      root.style.setProperty('--bbm-focus-ring', ring === 'small' ? '2px' : ring === 'large' ? '5px' : '3px');

      // Force TV mode
      if (state['tv.forceTvMode']) body.classList.add('tv-mode');
    },

    /** Poster quality returns a TMDB size token */
    posterSize() {
      const q = state['performance.posterQuality'];
      if (q === 'low') return 'w185';
      if (q === 'high') return 'w780';
      return 'w500';
    }
  };

  // Expose
  window.BBM = window.BBM || {};
  BBM.Settings = Settings;

  // Auto-apply as early as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Settings.apply());
  } else {
    Settings.apply();
  }
})();
