/* ============================================
   BoomBoomMovie TV — Core (D-pad nav + modal)
   ============================================ */

BBM.TV = BBM.TV || {};

/* ----------------------------------------
   Spatial D-pad navigation
   ---------------------------------------- */

BBM.TV.Nav = {
  _active: true,
  _backHandlers: [],
  _lastKey: null,
  _lastKeyAt: 0,

  init() {
    document.addEventListener('keydown', (e) => this.handleKey(e));
    // Ensure focus is always on something useful
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.focusFirst());
    } else {
      this.focusFirst();
    }
  },

  /** Focus the first focusable element on the page */
  focusFirst() {
    const el = document.querySelector('.tv-focusable:not([disabled])');
    if (el) el.focus();
  },

  /** Push a back handler. Called on Escape/Backspace/GoBack. Return true to consume. */
  pushBack(handler) {
    this._backHandlers.push(handler);
  },

  popBack(handler) {
    const i = this._backHandlers.lastIndexOf(handler);
    if (i >= 0) this._backHandlers.splice(i, 1);
  },

  handleKey(e) {
    if (!this._active) return;

    const key = e.key;

    // Dedupe : sur certaines Android TV / projecteurs (ex. Toptro), la WebView
    // auto-traduit les D-pad en KeyboardEvent ET notre pont natif en injecte un
    // synthétique — d'où 2 events par appui. On ignore le doublon à < 50 ms.
    const now = Date.now();
    if (this._lastKey === key && (now - this._lastKeyAt) < 50) {
      e.preventDefault();
      return;
    }
    this._lastKey = key;
    this._lastKeyAt = now;

    const active = document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      // Let inputs handle horizontal caret movement themselves
      if (isInput && (key === 'ArrowLeft' || key === 'ArrowRight')) return;
      e.preventDefault();
      this.move(key);
      return;
    }

    if (key === 'Enter') {
      if (isInput && active.form) {
        // Let form submit naturally
        return;
      }
      // Si rien de focalisable n'a le focus (ex : page qui vient de charger,
      // focus sur <body>), on place le focus sur le 1er élément au lieu de rien
      // faire — évite l'impression que « OK ne marche pas ».
      if (!active || active === document.body || !active.classList?.contains('tv-focusable')) {
        e.preventDefault();
        this.focusFirst();
        return;
      }
      if (active.click) {
        e.preventDefault();
        active.click();
      }
      return;
    }

    if (key === 'Escape' || key === 'Backspace' || key === 'GoBack' || key === 'BrowserBack') {
      if (isInput && key === 'Backspace') return; // Normal text editing
      const handler = this._backHandlers[this._backHandlers.length - 1];
      if (handler) {
        e.preventDefault();
        const consumed = handler();
        if (consumed !== false) return;
      }
    }
  },

  move(direction) {
    const from = document.activeElement;
    if (!from || from === document.body) {
      this.focusFirst();
      return;
    }

    const next = this.findBest(from, direction);
    if (next) {
      next.focus();
      // Scroll into view — horizontal for rows, block for vertical
      const scrollOpts = (direction === 'ArrowLeft' || direction === 'ArrowRight')
        ? { behavior: 'smooth', block: 'nearest', inline: 'center' }
        : { behavior: 'smooth', block: 'center', inline: 'nearest' };
      next.scrollIntoView(scrollOpts);
    }
  },

  findBest(from, direction) {
    // Scope: if a modal is open, only navigate within it
    const modal = document.querySelector('.tv-modal.open');
    const scope = modal || document;

    const all = Array.from(scope.querySelectorAll('.tv-focusable'));
    const fromRect = from.getBoundingClientRect();
    const fx = fromRect.left + fromRect.width / 2;
    const fy = fromRect.top + fromRect.height / 2;

    let best = null;
    let bestScore = Infinity;

    for (const el of all) {
      if (el === from) continue;
      if (el.disabled) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;

      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = ex - fx;
      const dy = ey - fy;

      let primary = 0, secondary = 0, valid = false;

      if (direction === 'ArrowRight') {
        valid = r.left > fromRect.right - 4;
        primary = dx; secondary = Math.abs(dy);
      } else if (direction === 'ArrowLeft') {
        valid = r.right < fromRect.left + 4;
        primary = -dx; secondary = Math.abs(dy);
      } else if (direction === 'ArrowDown') {
        valid = r.top > fromRect.bottom - 4;
        primary = dy; secondary = Math.abs(dx);
      } else if (direction === 'ArrowUp') {
        valid = r.bottom < fromRect.top + 4;
        primary = -dy; secondary = Math.abs(dx);
      }

      if (!valid) continue;

      // Weight perpendicular distance heavier so we stay in the same "lane"
      const score = primary + secondary * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }

    return best;
  }
};

/* ----------------------------------------
   Modal manager (details overlay)
   ---------------------------------------- */

BBM.TV.Modal = {
  el: null,
  _previousFocus: null,
  _backHandler: null,

  ensure() {
    if (this.el) return this.el;
    const m = document.createElement('div');
    m.className = 'tv-modal';
    m.id = 'tv-modal';
    m.innerHTML = `
      <div class="tv-modal-box">
        <div class="tv-modal-backdrop" id="tv-modal-backdrop"></div>
        <div class="tv-modal-body" id="tv-modal-body"></div>
      </div>
    `;
    document.body.appendChild(m);
    this.el = m;
    return m;
  },

  open({ backdrop, body }) {
    const m = this.ensure();
    document.getElementById('tv-modal-backdrop').style.backgroundImage =
      backdrop ? `url(${backdrop})` : 'linear-gradient(135deg, #2a2a2a, #1a1a1a)';
    document.getElementById('tv-modal-body').innerHTML = body;

    this._previousFocus = document.activeElement;
    m.classList.add('open');

    // Focus first focusable in modal
    requestAnimationFrame(() => {
      const first = m.querySelector('.tv-focusable');
      if (first) first.focus();
    });

    this._backHandler = () => { this.close(); return true; };
    BBM.TV.Nav.pushBack(this._backHandler);
  },

  close() {
    if (!this.el) return;
    this.el.classList.remove('open');
    if (this._backHandler) {
      BBM.TV.Nav.popBack(this._backHandler);
      this._backHandler = null;
    }
    if (this._previousFocus && this._previousFocus.focus) {
      this._previousFocus.focus();
    }
  }
};

/* ----------------------------------------
   Loading helper
   ---------------------------------------- */

BBM.TV.Loading = {
  show(text = 'Chargement') {
    let el = document.getElementById('tv-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tv-loading';
      el.className = 'tv-loading';
      el.innerHTML = `<div class="tv-spinner"></div><div class="tv-loading-text">${text}</div>`;
      document.body.appendChild(el);
    } else {
      el.classList.remove('hidden');
    }
  },
  hide() {
    const el = document.getElementById('tv-loading');
    if (el) el.classList.add('hidden');
  }
};

/* ----------------------------------------
   Auto init
   ---------------------------------------- */
BBM.TV.Nav.init();
