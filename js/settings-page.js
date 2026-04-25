/* ============================================
   BoomBoomMovie — Settings Page Controller
   ============================================ */

(function () {
  'use strict';

  /* ----------------------------------------
     Toast helper
     ---------------------------------------- */
  function toast(msg, type) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'success');
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
  }

  /* ----------------------------------------
     Field descriptors — single source of truth for all settings UIs
     ---------------------------------------- */
  const SECTIONS = {
    playback: [
      { key: 'playback.autoplayNext', type: 'toggle', label: 'Lire automatiquement l\'épisode suivant', hint: 'Enchaîne les épisodes sans intervention' },
      { key: 'playback.autoplayCountdown', type: 'slider', label: 'Délai avant l\'épisode suivant', hint: 'Nombre de secondes affichées avant le skip auto', min: 3, max: 30, step: 1, suffix: ' s' },
      { key: 'playback.skipIntro', type: 'toggle', label: 'Passer le générique automatiquement', hint: 'Saute le générique de début si détecté' },
      { key: 'playback.defaultSpeed', type: 'select', label: 'Vitesse de lecture par défaut', options: [
        { value: 0.75, label: '0,75×' }, { value: 1, label: '1× (normal)' }, { value: 1.25, label: '1,25×' }, { value: 1.5, label: '1,5×' }, { value: 2, label: '2×' }
      ]},
      { key: 'playback.defaultVolume', type: 'slider', label: 'Volume par défaut', min: 0, max: 100, step: 5, suffix: ' %' },
      { key: 'playback.pipAuto', type: 'toggle', label: 'Picture-in-Picture automatique', hint: 'Ouvre une mini-fenêtre quand tu changes d\'onglet' }
    ],
    appearance: [
      { key: 'appearance.density', type: 'select', label: 'Densité d\'affichage', hint: 'Espacement entre les éléments', options: [
        { value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normale' }, { value: 'spacious', label: 'Spacieuse' }
      ]},
      { key: 'appearance.highContrast', type: 'toggle', label: 'Contraste élevé', hint: 'Améliore la lisibilité (accessibilité)' }
    ],
    performance: [
      { key: 'performance.heroTrailer', type: 'toggle', label: 'Trailer auto sur la bannière', hint: 'Lance le trailer YouTube après 2,5 s sur le hero', disabledBy: 'performance.potatoMode' },
      { key: 'performance.grain', type: 'toggle', label: 'Grain cinéma', hint: 'Texture SVG subtile pour l\'ambiance', disabledBy: 'performance.potatoMode' },
      { key: 'performance.hoverPanel', type: 'toggle', label: 'Panneau détaillé au survol', hint: 'Apparait après 550 ms sur les posters', disabledBy: 'performance.potatoMode' },
      { key: 'performance.parallax', type: 'toggle', label: 'Effet parallax sur le hero', disabledBy: 'performance.potatoMode' },
      { key: 'performance.orbs', type: 'toggle', label: 'Orbs d\'ambiance en arrière-plan', disabledBy: 'performance.potatoMode' },
      { key: 'performance.animations', type: 'toggle', label: 'Animations générales', hint: 'Transitions, fade, pulse...', disabledBy: 'performance.potatoMode' },
      { key: 'performance.posterQuality', type: 'select', label: 'Qualité des affiches', hint: 'Basse = plus rapide, plus économe en données', options: [
        { value: 'low', label: 'Basse (w185)' }, { value: 'normal', label: 'Normale (w500)' }, { value: 'high', label: 'Haute (w780)' }
      ]}
    ],
    home: [
      { key: 'home.autoplayHero', type: 'toggle', label: 'Tirer un hero différent à chaque visite', hint: 'Sinon, le dernier hero affiché est conservé' },
      { key: 'home.heroTrailerDelay', type: 'slider', label: 'Délai avant le trailer du hero', min: 0, max: 10, step: 0.5, suffix: ' s' },
      { key: 'home.showTop10', type: 'toggle', label: 'Afficher la rangée Top 10' },
      { key: 'home.showBento', type: 'toggle', label: 'Afficher la section Spotlight (bento)' },
      { key: 'home.showRecommendations', type: 'toggle', label: 'Afficher « Recommandé pour toi »' },
      { key: 'home.itemsPerRow', type: 'select', label: 'Items visibles par rangée', options: [
        { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 6, label: '6 (normal)' }, { value: 7, label: '7' }, { value: 8, label: '8' }
      ]}
    ],
    notifications: [
      { key: 'notifications.requestApproved', type: 'toggle', label: 'Mes demandes ont été approuvées', hint: 'Toast affiché au retour sur le site' },
      { key: 'notifications.newContent', type: 'toggle', label: 'Nouveau contenu correspondant à Ma Liste' },
      { key: 'notifications.browserPush', type: 'toggle', label: 'Notifications navigateur', hint: 'Recevoir les alertes dans le centre de notifications de l\'OS quand l\'onglet n\'est pas au premier plan' }
    ],
    tv: [
      { key: 'tv.forceTvMode', type: 'toggle', label: 'Forcer le mode TV', hint: 'Active la navigation D-pad même sur PC' },
      { key: 'tv.focusRingSize', type: 'select', label: 'Taille du ring de focus', options: [
        { value: 'small', label: 'Petit' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Grand' }
      ]},
      { key: 'tv.debugOverlay', type: 'toggle', label: 'Overlay de debug', hint: 'Affiche l\'élément actuellement focus (utile pour le dev)' }
    ],
    privacy: [
      { key: 'privacy.saveProgress', type: 'toggle', label: 'Sauvegarder la progression de visionnage' },
      { key: 'privacy.saveHistory', type: 'toggle', label: 'Conserver l\'historique' }
    ]
  };

  /* ----------------------------------------
     Field renderers
     ---------------------------------------- */
  function renderField(desc) {
    const wrap = document.createElement('div');
    wrap.className = 'settings-row';
    wrap.dataset.key = desc.key;

    const label = document.createElement('div');
    label.className = 'settings-row-label';
    label.innerHTML = `<span class="settings-row-title">${desc.label}</span>${desc.hint ? `<span class="settings-row-hint">${desc.hint}</span>` : ''}`;
    wrap.appendChild(label);

    const control = document.createElement('div');
    control.className = 'settings-row-control';

    if (desc.type === 'toggle') {
      const lbl = document.createElement('label');
      lbl.className = 'toggle-switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.setting = desc.key;
      input.checked = !!BBM.Settings.get(desc.key);
      const slider = document.createElement('span');
      slider.className = 'toggle-slider';
      lbl.appendChild(input); lbl.appendChild(slider);
      control.appendChild(lbl);
    }
    else if (desc.type === 'select') {
      const sel = document.createElement('select');
      sel.className = 'settings-select';
      sel.dataset.setting = desc.key;
      desc.options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sel.appendChild(opt);
      });
      sel.value = String(BBM.Settings.get(desc.key));
      control.appendChild(sel);
    }
    else if (desc.type === 'slider') {
      const sl = document.createElement('div');
      sl.className = 'settings-slider';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = desc.min; input.max = desc.max; input.step = desc.step;
      input.value = BBM.Settings.get(desc.key);
      input.dataset.setting = desc.key;
      const out = document.createElement('span');
      out.className = 'settings-slider-value';
      out.textContent = input.value + (desc.suffix || '');
      input.addEventListener('input', () => { out.textContent = input.value + (desc.suffix || ''); });
      sl.appendChild(input); sl.appendChild(out);
      control.appendChild(sl);
    }

    wrap.appendChild(control);
    return wrap;
  }

  function buildSections() {
    Object.entries(SECTIONS).forEach(([id, fields]) => {
      const section = document.querySelector(`.settings-section[data-section="${id}"] .settings-list`);
      if (!section) return;
      fields.forEach(f => section.appendChild(renderField(f)));
    });
    applyDisabledState();
  }

  /* ----------------------------------------
     Accent picker (custom — color swatches)
     ---------------------------------------- */
  function buildAccentPicker() {
    const host = document.getElementById('accent-picker');
    if (!host) return;
    const palettes = BBM.Settings.ACCENT_PALETTES;
    const current = BBM.Settings.get('appearance.accent');
    Object.entries(palettes).forEach(([key, p]) => {
      const swatch = document.createElement('button');
      swatch.className = 'accent-swatch';
      swatch.dataset.accent = key;
      swatch.setAttribute('aria-label', p.label);
      swatch.style.setProperty('--swatch-color', `rgb(${p.rgb})`);
      swatch.style.setProperty('--swatch-deep', `rgb(${p.deep})`);
      swatch.innerHTML = `
        <span class="accent-swatch-disc"></span>
        <span class="accent-swatch-label">${p.label}</span>
        <span class="accent-swatch-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
      `;
      if (key === current) swatch.classList.add('selected');
      swatch.addEventListener('click', () => {
        BBM.Settings.set('appearance.accent', key);
        host.querySelectorAll('.accent-swatch').forEach(s => s.classList.toggle('selected', s.dataset.accent === key));
      });
      host.appendChild(swatch);
    });
  }

  /* ----------------------------------------
     Disabled-by logic
     ---------------------------------------- */
  function applyDisabledState() {
    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      const field = findDesc(key);
      if (!field || !field.disabledBy) return;
      const disabled = !!BBM.Settings.get(field.disabledBy);
      el.disabled = disabled;
      el.closest('.settings-row')?.classList.toggle('disabled', disabled);
    });
  }
  function findDesc(key) {
    for (const arr of Object.values(SECTIONS)) {
      const f = arr.find(x => x.key === key);
      if (f) return f;
    }
    return null;
  }

  /* ----------------------------------------
     Sidebar navigation
     ---------------------------------------- */
  function setupNav() {
    const items = document.querySelectorAll('.settings-nav-item');
    const sections = document.querySelectorAll('.settings-section');
    function show(id) {
      items.forEach(i => i.classList.toggle('active', i.dataset.section === id));
      sections.forEach(s => s.classList.toggle('active', s.dataset.section === id));
      if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    }
    items.forEach(i => i.addEventListener('click', () => show(i.dataset.section)));
    // Respect initial hash
    const initial = (location.hash || '').replace('#', '');
    if (initial && document.querySelector(`.settings-nav-item[data-section="${initial}"]`)) {
      show(initial);
    }
  }

  /* ----------------------------------------
     Global input listener — bind all [data-setting]
     ---------------------------------------- */
  function bindInputs() {
    document.addEventListener('change', (e) => {
      const el = e.target;
      if (!el.dataset || !el.dataset.setting) return;
      const key = el.dataset.setting;
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'range') val = Number(el.value);
      else if (el.tagName === 'SELECT') {
        const raw = el.value;
        const num = Number(raw);
        val = (!isNaN(num) && raw.trim() !== '' && /^-?\d+(\.\d+)?$/.test(raw)) ? num : raw;
      } else {
        val = el.value;
      }
      BBM.Settings.set(key, val);
      applyDisabledState();

      // Special handling: when enabling browser push, request OS permission
      if (key === 'notifications.browserPush' && val === true) {
        BBM.Notify?.requestPermission().then(result => {
          if (result === 'granted') {
            BBM.Toast?.show('Notifications navigateur activées', 'success');
          } else if (result === 'denied') {
            BBM.Toast?.show('Permission refusée par le navigateur', 'error');
            BBM.Settings.set('notifications.browserPush', false);
            el.checked = false;
          } else if (result === 'unsupported') {
            BBM.Toast?.show('Notifications non supportées sur ce navigateur', 'error');
            BBM.Settings.set('notifications.browserPush', false);
            el.checked = false;
          }
        });
      }
    });
  }

  /* ----------------------------------------
     Account section (ported from profile.html)
     ---------------------------------------- */
  function bindAccount(user) {
    const avatar = document.getElementById('nav-avatar');
    const heroAvatar = document.getElementById('account-avatar');
    const nameEl = document.getElementById('account-name');
    const emailEl = document.getElementById('account-email');
    const sinceEl = document.getElementById('account-since');

    const initials = BBM.Auth.getInitials();
    const displayName = BBM.Auth.getDisplayName();
    if (avatar) avatar.textContent = initials;
    if (heroAvatar) heroAvatar.textContent = initials;
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = user.email || '';
    document.getElementById('input-display-name').value = user.displayName || '';

    (async () => {
      try {
        const doc = await BBM.db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().createdAt) {
          const d = doc.data().createdAt.toDate();
          sinceEl.textContent = 'Membre depuis ' + d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        }
      } catch (e) {}
    })();

    // Update display name
    document.getElementById('form-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newName = document.getElementById('input-display-name').value.trim();
      if (!newName) { toast('Le nom ne peut pas être vide', 'error'); return; }
      try {
        await user.updateProfile({ displayName: newName });
        await BBM.db.collection('users').doc(user.uid).update({ displayName: newName });
        nameEl.textContent = newName;
        heroAvatar.textContent = newName.charAt(0).toUpperCase();
        if (avatar) avatar.textContent = newName.charAt(0).toUpperCase();
        toast('Nom mis à jour');
      } catch (err) {
        toast((BBM.Auth.translateError && BBM.Auth.translateError(err.code)) || err.message, 'error');
      }
    });

    // Update email
    document.getElementById('form-email').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newEmail = document.getElementById('input-new-email').value.trim();
      const pw = document.getElementById('input-email-password').value;
      if (!newEmail || !pw) return;
      try {
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, pw);
        await user.reauthenticateWithCredential(cred);
        await user.updateEmail(newEmail);
        await BBM.db.collection('users').doc(user.uid).update({ email: newEmail });
        emailEl.textContent = newEmail;
        document.getElementById('input-email-password').value = '';
        toast('Email mis à jour');
      } catch (err) {
        toast((BBM.Auth.translateError && BBM.Auth.translateError(err.code)) || err.message, 'error');
      }
    });

    // Update password
    document.getElementById('form-password').addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = document.getElementById('input-current-password').value;
      const next = document.getElementById('input-new-password').value;
      if (!current || !next) return;
      if (next.length < 6) { toast('Minimum 6 caractères', 'error'); return; }
      try {
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, current);
        await user.reauthenticateWithCredential(cred);
        await user.updatePassword(next);
        document.getElementById('input-current-password').value = '';
        document.getElementById('input-new-password').value = '';
        toast('Mot de passe modifié');
      } catch (err) {
        toast((BBM.Auth.translateError && BBM.Auth.translateError(err.code)) || err.message, 'error');
      }
    });

    // Delete account
    document.getElementById('btn-delete-account').addEventListener('click', async () => {
      if (!confirm('Es-tu sûr de vouloir supprimer ton compte ? Cette action est irréversible.')) return;
      if (!confirm('Dernière chance. Toutes tes données seront supprimées définitivement.')) return;
      try {
        await BBM.db.collection('users').doc(user.uid).delete();
        await user.delete();
        window.location.href = 'index.html';
      } catch (err) {
        if (err.code === 'auth/requires-recent-login') toast('Reconnecte-toi avant de supprimer ton compte', 'error');
        else toast(err.message, 'error');
      }
    });
  }

  /* ----------------------------------------
     Privacy actions
     ---------------------------------------- */
  function bindPrivacyActions(user) {
    document.getElementById('btn-export-data').addEventListener('click', async () => {
      try {
        const doc = await BBM.db.collection('users').doc(user.uid).get();
        const payload = {
          exportedAt: new Date().toISOString(),
          email: user.email,
          displayName: user.displayName,
          uid: user.uid,
          data: doc.exists ? doc.data() : null,
          settings: BBM.Settings.all()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boomboommovie-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Export téléchargé');
      } catch (err) {
        toast('Erreur pendant l\'export', 'error');
      }
    });

    document.getElementById('btn-clear-progress').addEventListener('click', async () => {
      if (!confirm('Effacer toute ta progression (continueWatching, lastWatchedAt) ?')) return;
      try {
        await BBM.db.collection('users').doc(user.uid).update({
          continueWatching: {},
          lastWatchedAt: {}
        });
        toast('Progression effacée');
      } catch (err) { toast(err.message, 'error'); }
    });

    document.getElementById('btn-clear-cache').addEventListener('click', async () => {
      if (!confirm('Vider le cache local (images, métadonnées TMDB) ?')) return;
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('tmdb_')) localStorage.removeItem(k);
        });
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        }
        toast('Cache vidé — rechargement...');
        setTimeout(() => location.reload(), 800);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ----------------------------------------
     Reset button
     ---------------------------------------- */
  function bindReset() {
    document.getElementById('btn-reset-settings').addEventListener('click', () => {
      if (!confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) return;
      BBM.Settings.reset();
      location.reload();
    });
  }

  /* ----------------------------------------
     Init
     ---------------------------------------- */
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    BBM.Auth.currentUser = user;

    buildSections();
    buildAccentPicker();
    setupNav();
    bindInputs();
    bindAccount(user);
    bindPrivacyActions(user);
    bindReset();

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('settings-page').style.display = 'flex';
  });
})();
