/* ============================================
   BoomBoomMovie — TV / D-pad Navigation Module
   Spatial navigation for Android TV, Fire TV, etc.
   ============================================ */

(function () {
  'use strict';

  /* ---------- Détection TV ---------- */
  const IS_TV = /TV|AFTT|AFT[ABCMS]|MIBOX|Tizen|WebOS|SmartTV|BRAVIA|CrKey|Roku/i.test(navigator.userAgent)
    || (window.matchMedia && window.matchMedia('(pointer: none)').matches)
    || (navigator.maxTouchPoints === 0 && !window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 960);

  /* ---------- Configuration ---------- */
  const FOCUSABLE_SELECTOR = [
    '.title-card',
    '.btn-play',
    '.btn-info',
    '.billboard-buttons button',
    '.nav-links a',
    '.mobile-menu-link',
    '.genre-btn',
    '.modal-close',
    '.modal-hero-buttons button',
    '.modal-cast-card',
    '.modal-season-tab',
    '.modal-episode-item',
    '.ctrl-btn',
    '#btn-center-play',
    '#player-back',
    '.player-center-btn',
    '.next-episode-buttons button',
    'button.btn-primary',
    '#sort-select',
    '.row-see-all',
    '.footer-links a',
    '.request-search-box button',
    '.request-result-item .btn-primary',
    '.my-requests-filters .genre-btn',
    '#search-input',
    'input[type="email"]',
    'input[type="password"]',
    'input[type="text"]',
    'a.dropdown-link',
    '#btn-request',
    '#btn-my-requests',
    '#btn-logout',
    '#btn-random'
  ].join(',');

  let currentFocus = null;
  let tvModeActive = false;

  /* ---------- Helpers géométriques ---------- */
  function getRect(el) {
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      width: r.width,
      height: r.height
    };
  }

  function isVisible(el) {
    if (!el || !el.offsetParent && el.style.position !== 'fixed' && !el.closest('[style*="position: fixed"]')) {
      // Elements inside overlays that are hidden
      const modal = el.closest('.modal-overlay, .request-overlay, .trailer-overlay, .shortcuts-overlay');
      if (modal && !modal.classList.contains('active')) return false;
      // Hidden by display:none
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    // Check parent visibility
    const parent = el.closest('[style*="display: none"], [style*="display:none"]');
    if (parent && parent !== el) return false;
    return true;
  }

  function getFocusables() {
    return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
      if (!isVisible(el)) return false;
      if (el.disabled) return false;
      if (el.closest('.mobile-menu') && !el.closest('.mobile-menu').classList.contains('open')) return false;
      return true;
    });
  }

  /* ---------- Navigation spatiale ---------- */
  function findBest(direction) {
    const focusables = getFocusables();
    if (!currentFocus || focusables.length === 0) return focusables[0] || null;

    const origin = getRect(currentFocus);
    let best = null;
    let bestScore = Infinity;

    // Same row detection for horizontal nav
    const inRow = currentFocus.closest('.row-content, .category-grid, .search-grid, .billboard-buttons, .modal-hero-buttons, .card-buttons, .player-center, .player-controls-row, .genre-filters, .my-requests-filters, .modal-season-tabs, .footer-links, .next-episode-buttons, .nav-links');

    for (const el of focusables) {
      if (el === currentFocus) continue;
      const target = getRect(el);

      // Skip zero-size elements
      if (target.width === 0 || target.height === 0) continue;

      const dx = target.cx - origin.cx;
      const dy = target.cy - origin.cy;

      let valid = false;
      let primaryDist, crossDist;

      switch (direction) {
        case 'left':
          valid = dx < -10;
          primaryDist = Math.abs(dx);
          crossDist = Math.abs(dy);
          break;
        case 'right':
          valid = dx > 10;
          primaryDist = Math.abs(dx);
          crossDist = Math.abs(dy);
          break;
        case 'up':
          valid = dy < -10;
          primaryDist = Math.abs(dy);
          crossDist = Math.abs(dx);
          break;
        case 'down':
          valid = dy > 10;
          primaryDist = Math.abs(dy);
          crossDist = Math.abs(dx);
          break;
      }

      if (!valid) continue;

      // Prefer elements in the same container for horizontal nav
      const sameContainer = inRow && el.closest('.row-content, .category-grid, .search-grid, .billboard-buttons, .modal-hero-buttons, .card-buttons, .player-center, .player-controls-row, .genre-filters, .my-requests-filters, .modal-season-tabs, .footer-links, .next-episode-buttons, .nav-links') === inRow;

      // Score: prioritize elements in the same row/container and minimize cross-axis distance
      let score;
      if (direction === 'left' || direction === 'right') {
        // Horizontal: heavily penalize cross-axis, bonus if same container
        score = primaryDist + crossDist * 5;
        if (sameContainer) score *= 0.1;
      } else {
        // Vertical: same column preference
        score = primaryDist + crossDist * 3;
        if (sameContainer) score *= 0.2;
      }

      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }

    return best;
  }

  /* ---------- Focus management ---------- */
  function setFocus(el, scroll) {
    if (!el) return;

    // Remove old focus
    if (currentFocus) {
      currentFocus.classList.remove('tv-focused');
      currentFocus.blur();
    }

    currentFocus = el;
    el.classList.add('tv-focused');
    el.focus({ preventScroll: true });

    // Scroll into view
    if (scroll !== false) {
      // Check if element is in a horizontal scroll container (row)
      const row = el.closest('.row-content');
      if (row) {
        const rowRect = row.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (elRect.left < rowRect.left) {
          row.scrollBy({ left: elRect.left - rowRect.left - 40, behavior: 'smooth' });
        } else if (elRect.right > rowRect.right) {
          row.scrollBy({ left: elRect.right - rowRect.right + 40, behavior: 'smooth' });
        }
      }

      // Vertical scroll
      const rect = el.getBoundingClientRect();
      const margin = 100;
      if (rect.top < margin) {
        window.scrollBy({ top: rect.top - margin, behavior: 'smooth' });
      } else if (rect.bottom > window.innerHeight - margin) {
        window.scrollBy({ top: rect.bottom - window.innerHeight + margin, behavior: 'smooth' });
      }
    }
  }

  function focusFirst() {
    const focusables = getFocusables();
    // Try to find the first visible card or the billboard play button
    const hero = document.querySelector('.billboard .btn-play');
    if (hero && isVisible(hero)) {
      setFocus(hero);
      return;
    }
    if (focusables.length > 0) {
      setFocus(focusables[0]);
    }
  }

  /* ---------- Actions ---------- */
  function activateFocused() {
    if (!currentFocus) return;

    // If it's a card, open its modal (same as click on card image)
    if (currentFocus.classList.contains('title-card')) {
      const imgEl = currentFocus.querySelector('.title-card-img');
      if (imgEl) imgEl.click();
      return;
    }

    // For links, navigate
    if (currentFocus.tagName === 'A' && currentFocus.href) {
      currentFocus.click();
      return;
    }

    // For selects, open
    if (currentFocus.tagName === 'SELECT') {
      currentFocus.focus();
      // Simulate a mouse click to open the dropdown
      const evt = new MouseEvent('mousedown', { bubbles: true });
      currentFocus.dispatchEvent(evt);
      return;
    }

    // For inputs, focus for typing
    if (currentFocus.tagName === 'INPUT') {
      currentFocus.focus();
      return;
    }

    // For buttons, click
    currentFocus.click();
  }

  function goBack() {
    // Close modals first
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay && modalOverlay.classList.contains('active')) {
      const closeBtn = modalOverlay.querySelector('.modal-close');
      if (closeBtn) closeBtn.click();
      return;
    }

    const requestOverlay = document.getElementById('request-overlay');
    if (requestOverlay && requestOverlay.classList.contains('active')) {
      const closeBtn = requestOverlay.querySelector('.modal-close');
      if (closeBtn) closeBtn.click();
      return;
    }

    const myReqOverlay = document.getElementById('my-requests-overlay');
    if (myReqOverlay && myReqOverlay.classList.contains('active')) {
      const closeBtn = myReqOverlay.querySelector('.modal-close');
      if (closeBtn) closeBtn.click();
      return;
    }

    const collOverlay = document.getElementById('collection-overlay');
    if (collOverlay && collOverlay.classList.contains('active')) {
      const closeBtn = collOverlay.querySelector('.modal-close');
      if (closeBtn) closeBtn.click();
      return;
    }

    // If in category/search view, go home
    if (typeof BBM !== 'undefined' && BBM.Browse && BBM.Browse.currentView !== 'home') {
      BBM.Browse.switchView('home');
      setTimeout(focusFirst, 300);
      return;
    }

    // On player page, go back
    const backBtn = document.getElementById('player-back');
    if (backBtn) {
      backBtn.click();
      return;
    }

    // Otherwise go back in history
    if (window.history.length > 1) {
      window.history.back();
    }
  }

  /* ---------- Keyboard handler ---------- */
  function handleKeyDown(e) {
    // Don't interfere with input fields (unless arrow keys)
    const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT');

    if (isInput && e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Escape') {
      return;
    }

    // On player page, let the player handle its own keys (except Backspace/Escape)
    const isPlayerPage = !!document.querySelector('.player-page');
    if (isPlayerPage && e.key !== 'Backspace' && e.key !== 'Escape') {
      return;
    }

    let direction = null;

    switch (e.key) {
      case 'ArrowLeft':
        direction = 'left';
        break;
      case 'ArrowRight':
        direction = 'right';
        break;
      case 'ArrowUp':
        direction = 'up';
        break;
      case 'ArrowDown':
        direction = 'down';
        break;
      case 'Enter':
        e.preventDefault();
        activateFocused();
        return;
      case 'Backspace':
      case 'Escape':
        // Escape sur input = quitter l'input
        if (isInput) {
          document.activeElement.blur();
          if (currentFocus) setFocus(currentFocus);
          e.preventDefault();
          return;
        }
        e.preventDefault();
        goBack();
        return;
      default:
        return;
    }

    e.preventDefault();

    // If no current focus, set initial focus
    if (!currentFocus || !document.contains(currentFocus) || !isVisible(currentFocus)) {
      focusFirst();
      return;
    }

    const next = findBest(direction);
    if (next) {
      setFocus(next);
    }
  }

  /* ---------- Init ---------- */
  function init() {
    if (!IS_TV) {
      // On desktop, only activate TV mode on first arrow key press
      let activated = false;
      document.addEventListener('keydown', function firstArrow(e) {
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
      // Mouse usage disables TV mode
      document.addEventListener('mousemove', () => {
        if (tvModeActive) {
          tvModeActive = false;
          document.body.classList.remove('tv-mode');
          if (currentFocus) {
            currentFocus.classList.remove('tv-focused');
            currentFocus = null;
          }
        }
      });
      return;
    }

    // TV: activate immediately
    tvModeActive = true;
    document.body.classList.add('tv-mode');
    document.addEventListener('keydown', handleKeyDown);

    // Focus first element once page is loaded
    if (document.readyState === 'complete') {
      setTimeout(focusFirst, 500);
    } else {
      window.addEventListener('load', () => setTimeout(focusFirst, 500));
    }

    // Re-focus after dynamic content changes
    const observer = new MutationObserver(() => {
      if (currentFocus && (!document.contains(currentFocus) || !isVisible(currentFocus))) {
        setTimeout(focusFirst, 100);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Expose for external use
  window.BBM_TV = {
    isTV: IS_TV,
    setFocus: setFocus,
    focusFirst: focusFirst,
    isActive: () => tvModeActive
  };

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
