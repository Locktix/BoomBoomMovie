/* ============================================
   BoomBoomMovie — "What's new" update modal
   Shows once per user per released version.
   Dismissal is persisted in localStorage.
   Requires: js/changelog-data.js to be loaded first.
   ============================================ */

(function () {
  const STORAGE_KEY = 'bbm_last_seen_version';

  function getCurrentVersion() {
    return (window.BBM_CHANGELOG && BBM_CHANGELOG.currentVersion) || null;
  }

  function getLatestEntry() {
    const cl = window.BBM_CHANGELOG;
    return cl && cl.versions && cl.versions[0] ? cl.versions[0] : null;
  }

  function syncFooterVersion(version) {
    // Keep any "vX.Y.Z" link in the footer in sync automatically
    const el = document.getElementById('footer-version');
    if (el && version) el.textContent = `v${version}`;
  }

  function shouldShow(version) {
    if (!version) return false;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      // Don't show on a user's very first visit (no prior version) — they just
      // signed in, no reason to interrupt with "What's new".
      if (!seen) {
        localStorage.setItem(STORAGE_KEY, version);
        return false;
      }
      return seen !== version;
    } catch (e) {
      return false;
    }
  }

  function markSeen(version) {
    try { localStorage.setItem(STORAGE_KEY, version); } catch (e) { /* noop */ }
  }

  // Keep only the most eye-catching highlights (max 5) — no details.
  function summarizeHighlights(entry) {
    if (!entry || !entry.changes) return [];
    // Prefer "new" features, then "improved", then "fix"
    const order = { new: 0, improved: 1, fix: 2 };
    const sorted = [...entry.changes].sort(
      (a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9)
    );
    return sorted.slice(0, 5);
  }

  function iconForType(type) {
    if (type === 'new') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
        <polygon points="12 2 15 9 22 10 17 15 18 22 12 19 6 22 7 15 2 10 9 9 12 2"/>
      </svg>`;
    }
    if (type === 'improved') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
        <polyline points="5 12 10 17 20 7"/>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>`;
  }

  function labelForType(type) {
    return type === 'new' ? 'Nouveau'
      : type === 'improved' ? 'Amélioration'
      : 'Correctif';
  }

  function render(entry) {
    if (document.getElementById('bbm-update-modal')) return; // already rendered

    const highlights = summarizeHighlights(entry);
    const bulletsHTML = highlights.map(c => `
      <li class="bbm-update-item bbm-update-item-${c.type}">
        <span class="bbm-update-item-icon">${iconForType(c.type)}</span>
        <span class="bbm-update-item-type">${labelForType(c.type)}</span>
        <span class="bbm-update-item-text">${escapeHtml(c.text)}</span>
      </li>`).join('');

    const overlay = document.createElement('div');
    overlay.id = 'bbm-update-modal';
    overlay.className = 'bbm-update-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'bbm-update-title');
    overlay.innerHTML = `
      <div class="bbm-update-card">
        <button class="bbm-update-close" aria-label="Fermer">✕</button>
        <div class="bbm-update-head">
          <span class="bbm-update-kicker">VERSION ${escapeHtml(entry.version)}</span>
          <h2 id="bbm-update-title">${escapeHtml(entry.title || 'Nouveautés')}</h2>
          <p class="bbm-update-lead">Voilà les nouveautés qu'on a cuisinées pour toi depuis ta dernière visite.</p>
        </div>
        <ul class="bbm-update-list">${bulletsHTML}</ul>
        <div class="bbm-update-actions">
          <a href="changelog.html" class="bbm-update-learn">En savoir plus</a>
          <button class="bbm-update-ok" type="button">Super, j'ai vu !</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('open');
      markSeen(entry.version);
      // Remove from DOM after the fade-out animation so next navigation is clean
      setTimeout(() => overlay.remove(), 380);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    overlay.querySelector('.bbm-update-close').addEventListener('click', close);
    overlay.querySelector('.bbm-update-ok').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    // "En savoir plus" — mark seen before navigating
    overlay.querySelector('.bbm-update-learn').addEventListener('click', () => markSeen(entry.version));

    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function boot() {
    const version = getCurrentVersion();
    syncFooterVersion(version);
    if (!shouldShow(version)) return;
    const entry = getLatestEntry();
    if (!entry) return;
    // Delay slightly so the page's hero / main content paints first
    setTimeout(() => render(entry), 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
