/* ============================================
   BoomBoomMovie — TV / D-pad Navigation Module v2
   Complete spatial navigation for Android TV
   ============================================ */

(function () {
  'use strict';

  /* ---------- Détection TV ---------- */
  const IS_TV = /TV|AFTT|AFT[ABCMS]|MIBOX|Tizen|WebOS|SmartTV|BRAVIA|CrKey|Roku/i.test(navigator.userAgent)
    || (window.matchMedia && window.matchMedia('(pointer: none)').matches)
    || (navigator.maxTouchPoints === 0 && !window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 960);

  /* ---------- Focusable selectors ---------- */
  const FOCUSABLE_SELECTOR = [
    /* Browse cards */
    '.title-card',
    /* Billboard */
    '.billboard-buttons .btn-play',
    '.billboard-buttons .btn-info',
    /* Navbar */
    '.nav-links a',
    /* Category / genre filters */
    '.genre-btn',
    '#sort-select',
    /* Modal detail */
    '.modal-close',
    '.modal-hero-buttons .btn-play',
    '.modal-hero-buttons .btn-icon',
    '.modal-hero-buttons .btn-trailer',
    '.season-dropdown-toggle',
    '.season-dropdown-item',
    '.episode-item',
    '.modal-cast-card',
    /* Star rating */
    '.star-rating-row .star-btn',
    /* Actor panel */
    '.actor-panel .modal-close',
    '.actor-film-card',
    /* Request modal */
    '#btn-request',
    '#btn-my-requests',
    '.request-search-box input',
    '.request-search-box button',
    '.request-result-item .btn-primary',
    '.my-requests-filters .genre-btn',
    /* Collection modal */
    '.collection-detail-modal .modal-close',
    '.collection-detail-modal .title-card',
    /* Player */
    '.ctrl-btn',
    '#btn-center-play',
    '#player-back',
    '.player-center-btn',
    '.next-episode-buttons button',
    /* Login */
    'input[type="email"]',
    'input[type="password"]',
    'input[type="text"]',
    'button.btn-primary',
    '.login-toggle a',
    /* Footer */
    '.footer-links a',
    /* General fallbacks */
    '#btn-logout',
    '#search-input'
  ].join(',');

  /* ---------- State ---------- */
  let currentFocus = null;
  let tvModeActive = false;
  let lastFocusBeforeModal = null; // remember focus when modal opens
  let lastColumnX = null; // remember X position for vertical row-to-row jumps

  /* ---------- Geometry helpers ---------- */
  function getRect(el) {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
             cx: r.left + r.width / 2, cy: r.top + r.height / 2,
             width: r.width, height: r.height };
  }

  function isVisible(el) {
    if (!el) return false;
    // Zero size
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    // Computed style checks
    var s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    // Walk up to check parent hidden (overlay, mobile menu, etc.)
    var node = el.parentElement;
    while (node && node !== document.body) {
      var ps = window.getComputedStyle(node);
      if (ps.display === 'none' || ps.visibility === 'hidden') return false;
      // Overlay not active => children are not visible
      if ((node.classList.contains('modal-overlay') || node.classList.contains('request-overlay') ||
           node.classList.contains('trailer-overlay') || node.classList.contains('shortcuts-overlay') ||
           node.id === 'collection-overlay' || node.id === 'my-requests-overlay' || node.id === 'actor-panel-overlay') &&
          !node.classList.contains('active')) return false;
      // Season dropdown menu not open
      if (node.classList.contains('season-dropdown-menu') && !node.classList.contains('open') && ps.display !== 'block') return false;
      // Mobile menu not open
      if (node.classList.contains('mobile-menu') && !node.classList.contains('open')) return false;
      node = node.parentElement;
    }
    return true;
  }

  /* Returns current scope: if a modal overlay is active, only return elements inside it */
  function getActiveScope() {
    var overlays = document.querySelectorAll('.modal-overlay.active, #request-overlay.active, #my-requests-overlay.active, #collection-overlay.active, #actor-panel-overlay.active');
    for (var i = 0; i < overlays.length; i++) {
      if (overlays[i].offsetWidth > 0) return overlays[i];
    }
    return document.body;
  }

  function getFocusables() {
    var scope = getActiveScope();
    return Array.from(scope.querySelectorAll(FOCUSABLE_SELECTOR)).filter(function (el) {
      if (!isVisible(el)) return false;
      if (el.disabled) return false;
      return true;
    });
  }

  /* ---------- Container grouping for navigation ---------- */
  // Containers where left/right movement should stay within
  var H_CONTAINERS = '.row-content, .category-grid, .search-grid, .billboard-buttons, .modal-hero-buttons, .genre-filters, .my-requests-filters, .footer-links, .next-episode-buttons, .nav-links, .star-rating-row, .actor-filmography, .request-results';
  // Containers where up/down movement should stay within (vertical lists)
  var V_CONTAINERS = '.modal-episodes-list, .season-dropdown-menu, .request-results-list';

  function getContainer(el, selectors) {
    return el.closest(selectors);
  }

  /* ---------- Spatial navigation algorithm ---------- */
  function findBest(direction) {
    var focusables = getFocusables();
    if (!currentFocus || focusables.length === 0) return focusables[0] || null;

    var origin = getRect(currentFocus);
    var isH = (direction === 'left' || direction === 'right');
    var isV = !isH;

    // Get same-axis container for the current element
    var containerSel = isH ? H_CONTAINERS : V_CONTAINERS;
    var myContainer = getContainer(currentFocus, containerSel);
    // For vertical moves, also detect the row container for column memory
    var myRow = currentFocus.closest('.row-content, .category-grid, .search-grid');

    var best = null;
    var bestScore = Infinity;

    // Use column memory for vertical navigation across rows
    var refX = lastColumnX != null ? lastColumnX : origin.cx;

    for (var i = 0; i < focusables.length; i++) {
      var el = focusables[i];
      if (el === currentFocus) continue;
      var target = getRect(el);
      if (target.width === 0 || target.height === 0) continue;

      var dx = target.cx - origin.cx;
      var dy = target.cy - origin.cy;

      // Direction filter — using edge-to-edge for tighter checks
      var valid = false;
      switch (direction) {
        case 'left':  valid = target.cx < origin.cx - 5; break;
        case 'right': valid = target.cx > origin.cx + 5; break;
        case 'up':    valid = target.cy < origin.cy - 5; break;
        case 'down':  valid = target.cy > origin.cy + 5; break;
      }
      if (!valid) continue;

      var sameContainer = myContainer && getContainer(el, containerSel) === myContainer;
      var elRow = el.closest('.row-content, .category-grid, .search-grid');

      var score;
      if (isH) {
        // Horizontal movement: strongly prefer same container
        var crossDist = Math.abs(dy);
        var priDist = Math.abs(dx);
        if (sameContainer) {
          // Inside same container: minimal cross penalty
          score = priDist + crossDist * 8;
          score *= 0.05; // huge bonus
        } else if (crossDist < 40) {
          // Very aligned elements not in a container
          score = priDist + crossDist * 4;
        } else {
          score = priDist + crossDist * 10;
        }
      } else {
        // Vertical movement: prefer same column position, nearest row
        if (sameContainer) {
          // Inside a vertical list (episodes, seasons)
          score = Math.abs(dy) * 1 + Math.abs(dx) * 0.5;
          score *= 0.1;
        } else {
          // Across rows — use column memory to land on same-ish card
          var columnDist = Math.abs(target.cx - refX);
          var rowDist = Math.abs(dy);

          // If moving to a different row, prefer the closest row first
          if (myRow && elRow && elRow !== myRow) {
            score = rowDist * 1 + columnDist * 0.3;
          } else {
            score = rowDist * 1 + columnDist * 2;
          }
        }
      }

      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }

    // Update column memory for row-to-row vertical navigation
    if (isH && best) {
      var bestRect = getRect(best);
      lastColumnX = bestRect.cx;
    }
    // Reset column memory when moving vertically to a new row
    if (isV && best) {
      var bRow = best.closest('.row-content, .category-grid, .search-grid');
      if (bRow && bRow !== myRow) {
        // keep lastColumnX as-is to persist the column across multiple rows
      } else if (!bRow) {
        lastColumnX = null; // leaving rows entirely
      }
    }

    return best;
  }

  /* ---------- Focus management ---------- */
  function setFocus(el, options) {
    if (!el) return;
    options = options || {};

    // Remove old focus
    if (currentFocus && currentFocus !== el) {
      currentFocus.classList.remove('tv-focused');
      currentFocus.blur();
    }

    currentFocus = el;
    el.classList.add('tv-focused');
    el.focus({ preventScroll: true });

    if (options.noScroll) return;

    // --- Horizontal scroll in row ---
    var row = el.closest('.row-content');
    if (row) {
      var rowRect = row.getBoundingClientRect();
      var elRect = el.getBoundingClientRect();
      var pad = 60;
      if (elRect.left < rowRect.left + pad) {
        row.scrollBy({ left: elRect.left - rowRect.left - pad, behavior: 'smooth' });
      } else if (elRect.right > rowRect.right - pad) {
        row.scrollBy({ left: elRect.right - rowRect.right + pad, behavior: 'smooth' });
      }
    }

    // --- Scroll inside modal ---
    var modal = el.closest('.modal');
    if (modal && modal.scrollHeight > modal.clientHeight) {
      var mRect = modal.getBoundingClientRect();
      var eRect = el.getBoundingClientRect();
      var mPad = 60;
      if (eRect.top < mRect.top + mPad) {
        modal.scrollBy({ top: eRect.top - mRect.top - mPad, behavior: 'smooth' });
      } else if (eRect.bottom > mRect.bottom - mPad) {
        modal.scrollBy({ top: eRect.bottom - mRect.bottom + mPad, behavior: 'smooth' });
      }
    }

    // --- Scroll inside actor panel ---
    var actorPanel = el.closest('.actor-panel');
    if (actorPanel && actorPanel.scrollHeight > actorPanel.clientHeight) {
      var apRect = actorPanel.getBoundingClientRect();
      var aeRect = el.getBoundingClientRect();
      if (aeRect.top < apRect.top + 40) {
        actorPanel.scrollBy({ top: aeRect.top - apRect.top - 40, behavior: 'smooth' });
      } else if (aeRect.bottom > apRect.bottom - 40) {
        actorPanel.scrollBy({ top: aeRect.bottom - apRect.bottom + 40, behavior: 'smooth' });
      }
    }

    // --- Page vertical scroll ---
    var rect = el.getBoundingClientRect();
    var margin = 90;
    if (rect.top < margin) {
      window.scrollBy({ top: rect.top - margin, behavior: 'smooth' });
    } else if (rect.bottom > window.innerHeight - margin) {
      window.scrollBy({ top: rect.bottom - window.innerHeight + margin, behavior: 'smooth' });
    }
  }

  function focusFirst() {
    var focusables = getFocusables();
    if (focusables.length === 0) return;

    // If modal is active, focus first modal button
    var scope = getActiveScope();
    if (scope !== document.body) {
      var firstBtn = scope.querySelector('.modal-hero-buttons .btn-play, .btn-play, .btn-primary, .modal-close');
      if (firstBtn && isVisible(firstBtn)) { setFocus(firstBtn); return; }
      setFocus(focusables[0]);
      return;
    }

    // Billboard play button
    var hero = document.querySelector('.billboard-buttons .btn-play');
    if (hero && isVisible(hero)) { setFocus(hero); return; }

    // First focusable
    setFocus(focusables[0]);
  }

  /* ---------- Modal open/close observers ---------- */
  function watchModals() {
    var overlayIds = ['modal-overlay', 'request-overlay', 'my-requests-overlay', 'collection-overlay', 'actor-panel-overlay'];
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type !== 'attributes' || m.attributeName !== 'class') return;
        var target = m.target;
        if (!overlayIds.some(function (id) { return target.id === id; }) && !target.classList.contains('modal-overlay')) return;

        if (target.classList.contains('active')) {
          // Modal just opened — save focus and move into modal
          lastFocusBeforeModal = currentFocus;
          setTimeout(function () { focusFirst(); }, 120);
        } else {
          // Modal just closed — restore focus
          if (lastFocusBeforeModal && document.contains(lastFocusBeforeModal) && isVisible(lastFocusBeforeModal)) {
            setFocus(lastFocusBeforeModal);
          } else {
            setTimeout(function () { focusFirst(); }, 120);
          }
          lastFocusBeforeModal = null;
        }
      });
    });

    overlayIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    // Also observe any .modal-overlay not matched by ID
    document.querySelectorAll('.modal-overlay').forEach(function (el) {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ---------- Actions ---------- */
  function activateFocused() {
    if (!currentFocus) return;

    // Card → open modal (click on the card image area)
    if (currentFocus.classList.contains('title-card')) {
      var imgEl = currentFocus.querySelector('.title-card-img');
      if (imgEl) { imgEl.click(); return; }
      currentFocus.click();
      return;
    }

    // Episode item → click to play
    if (currentFocus.classList.contains('episode-item')) {
      currentFocus.click();
      return;
    }

    // Actor film card → click
    if (currentFocus.classList.contains('actor-film-card')) {
      currentFocus.click();
      return;
    }

    // Season dropdown item
    if (currentFocus.classList.contains('season-dropdown-item')) {
      currentFocus.click();
      return;
    }

    // Link
    if (currentFocus.tagName === 'A' && currentFocus.href) {
      currentFocus.click();
      return;
    }

    // Select
    if (currentFocus.tagName === 'SELECT') {
      currentFocus.focus();
      var evt = new MouseEvent('mousedown', { bubbles: true });
      currentFocus.dispatchEvent(evt);
      return;
    }

    // Input → focus for typing
    if (currentFocus.tagName === 'INPUT' || currentFocus.tagName === 'TEXTAREA') {
      currentFocus.focus();
      return;
    }

    // Buttons / everything else
    currentFocus.click();
  }

  function goBack() {
    // Close overlays in priority order
    var overlays = ['actor-panel-overlay', 'collection-overlay', 'my-requests-overlay', 'request-overlay', 'modal-overlay'];
    for (var i = 0; i < overlays.length; i++) {
      var ov = document.getElementById(overlays[i]);
      if (ov && ov.classList.contains('active')) {
        var closeBtn = ov.querySelector('.modal-close, .actor-panel-close');
        if (closeBtn) { closeBtn.click(); return; }
        // Fallback: click overlay background
        ov.click();
        return;
      }
    }

    // Also check trailer overlay
    var trailer = document.querySelector('.trailer-overlay.active');
    if (trailer) {
      var tClose = trailer.querySelector('.modal-close, .trailer-close');
      if (tClose) { tClose.click(); return; }
    }

    // Season dropdown open → close it
    var openDropdown = document.querySelector('.season-dropdown-menu.open, .season-dropdown-menu[style*="display: block"]');
    if (openDropdown) {
      var toggle = openDropdown.previousElementSibling;
      if (toggle) { toggle.click(); return; }
    }

    // If in non-home view, go home
    if (typeof BBM !== 'undefined' && BBM.Browse && BBM.Browse.currentView && BBM.Browse.currentView !== 'home') {
      BBM.Browse.switchView('home');
      lastColumnX = null;
      setTimeout(focusFirst, 300);
      return;
    }

    // Player page → back
    var backBtn = document.getElementById('player-back');
    if (backBtn) { backBtn.click(); return; }

    // History back
    if (window.history.length > 1) {
      window.history.back();
    }
  }

  /* ---------- Keyboard handler ---------- */
  function handleKeyDown(e) {
    var ae = document.activeElement;
    var isInput = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
    var isSelect = ae && ae.tagName === 'SELECT';

    // Let input fields handle most keys except escape/arrows for leaving
    if (isInput) {
      if (e.key === 'Escape') {
        e.preventDefault();
        ae.blur();
        if (currentFocus) setFocus(currentFocus);
        return;
      }
      // ArrowDown on search input → jump to first result or first card
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        ae.blur();
        var next = findBest('down');
        if (next) setFocus(next);
        else focusFirst();
        return;
      }
      // Let everything else go to the input natively
      return;
    }

    if (isSelect) {
      if (e.key === 'Escape') { e.preventDefault(); ae.blur(); if (currentFocus) setFocus(currentFocus); return; }
      return; // let native select handle arrows
    }

    // Player page — let player handle its own shortcuts
    var isPlayerPage = !!document.querySelector('.player-page');
    if (isPlayerPage && e.key !== 'Backspace' && e.key !== 'Escape') {
      return;
    }

    var direction = null;
    switch (e.key) {
      case 'ArrowLeft':  direction = 'left'; break;
      case 'ArrowRight': direction = 'right'; break;
      case 'ArrowUp':    direction = 'up'; break;
      case 'ArrowDown':  direction = 'down'; break;
      case 'Enter':
        e.preventDefault();
        activateFocused();
        return;
      case 'Backspace': case 'Escape':
        e.preventDefault();
        goBack();
        return;
      default: return;
    }

    e.preventDefault();

    // If no valid focus, init
    if (!currentFocus || !document.contains(currentFocus) || !isVisible(currentFocus)) {
      focusFirst();
      return;
    }

    var nextEl = findBest(direction);
    if (nextEl) {
      setFocus(nextEl);
    }
  }

  /* ---------- Init ---------- */
  function init() {
    if (!IS_TV) {
      // Desktop: activate on first arrow key
      var activated = false;
      document.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          if (!activated) {
            activated = true;
            tvModeActive = true;
            document.body.classList.add('tv-mode');
            focusFirst();
          }
          handleKeyDown(e);
        } else if (activated) {
          handleKeyDown(e);
        }
      });
      document.addEventListener('mousemove', function () {
        if (tvModeActive) {
          tvModeActive = false;
          document.body.classList.remove('tv-mode');
          if (currentFocus) { currentFocus.classList.remove('tv-focused'); currentFocus = null; }
          lastColumnX = null;
        }
      });
      return;
    }

    // TV: activate immediately
    tvModeActive = true;
    document.body.classList.add('tv-mode');
    document.addEventListener('keydown', handleKeyDown);

    // Focus first element once loaded
    var startFocus = function () { setTimeout(focusFirst, 400); };
    if (document.readyState === 'complete') { startFocus(); }
    else { window.addEventListener('load', startFocus); }

    // Watch for modal open/close
    var setupModals = function () { setTimeout(watchModals, 200); };
    if (document.readyState === 'complete') { setupModals(); }
    else { window.addEventListener('load', setupModals); }

    // Re-focus if current element disappears
    var observer = new MutationObserver(function () {
      if (currentFocus && (!document.contains(currentFocus) || !isVisible(currentFocus))) {
        setTimeout(focusFirst, 80);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Expose API
  window.BBM_TV = {
    isTV: IS_TV,
    setFocus: setFocus,
    focusFirst: focusFirst,
    isActive: function () { return tvModeActive; }
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
