/**
 * Tests UI du Watch Party (player.js) — lobby, chat rendering, réactions,
 * blocage des contrôles invité, application d'état.
 *
 * Stratégie : on charge player.js (qui se contente de définir BBM.Player
 * comme objet, sans déclencher d'init()), puis on construit un DOM
 * minimal avec uniquement les IDs nécessaires à chaque méthode testée.
 * On stub video/HLS/Firebase/etc. au minimum pour ne pas crasher.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { resetBBM, setupStubs, loadFile } from './load-bbm.js';

/** DOM minimal qui couvre les éléments de la lobby + chat + réactions */
function setupWatchPartyDOM() {
  document.body.innerHTML = `
    <div class="player-page">
      <div class="player-container">
        <video id="player-video"></video>
        <div class="player-overlay" id="player-overlay">
          <div class="player-controls">
            <button id="btn-watch-party"></button>
            <button id="btn-wp-chat" style="display:none">
              <span class="chat-unread-dot" id="chat-unread-dot" style="display:none"></span>
            </button>
            <span id="watch-party-count">0</span>
            <span id="watch-party-code-display"></span>
            <span id="player-title">Mon film</span>
          </div>
        </div>
        <div class="watch-party-badge" id="watch-party-badge" style="display:none"></div>

        <!-- Lobby -->
        <div class="wp-lobby" id="wp-lobby" style="display:none">
          <div class="wp-lobby-card">
            <div id="wp-lobby-code">------</div>
            <p class="wp-lobby-subtitle" id="wp-lobby-subtitle">Default subtitle</p>
            <span id="wp-lobby-count">0</span>
            <span id="wp-lobby-plural"></span>
            <span id="wp-lobby-host-name">l'hôte</span>
            <div id="wp-lobby-participants"></div>
            <button id="wp-lobby-start" style="display:none"></button>
            <button id="wp-lobby-copy"></button>
            <button id="wp-lobby-leave"></button>
            <div id="wp-lobby-waiting" style="display:none"></div>
          </div>
        </div>

        <!-- Chat -->
        <aside id="wp-chat" style="display:none">
          <div class="wp-chat-messages" id="wp-chat-messages"></div>
          <form id="wp-chat-form">
            <input id="wp-chat-input" />
            <button type="submit"></button>
          </form>
          <button id="wp-chat-close"></button>
          <div id="wp-chat-reactions">
            <button class="wp-reaction-btn" data-emoji="❤️">❤️</button>
            <button class="wp-reaction-btn" data-emoji="🔥">🔥</button>
          </div>
        </aside>

        <div id="wp-reactions-layer"></div>
      </div>
    </div>
  `;
}

/** Stub minimaliste d'un <video> — propriétés mutables pour les tests */
function fakeVideo() {
  const video = document.getElementById('player-video');
  Object.defineProperty(video, 'paused', {
    get() { return this._paused; },
    set(v) { this._paused = v; },
    configurable: true
  });
  video._paused = true;
  video._duration = 0;
  Object.defineProperty(video, 'duration', {
    get() { return this._duration; },
    set(v) { this._duration = v; },
    configurable: true
  });
  video.play = () => { video._paused = false; return Promise.resolve(); };
  video.pause = () => { video._paused = true; };
  let ct = 0;
  Object.defineProperty(video, 'currentTime', {
    get() { return ct; },
    set(v) { ct = v; },
    configurable: true
  });
  return video;
}

beforeEach(() => {
  resetBBM();
  setupStubs();
  globalThis.Hls = { isSupported: () => false };
  // Charge api.js (pour les helpers utilisés) puis player.js
  loadFile('js/api.js');
  loadFile('js/player.js');
  setupWatchPartyDOM();
  // Branche un fake video element sur BBM.Player
  BBM.Player.video = fakeVideo();
  // Settings stub minimal
  globalThis.BBM.Settings = { get: () => null, set: () => {} };
});

describe('_showLobby / _hideLobby / _revealChatUI', () => {
  test('_showLobby host : start visible, waiting caché, vidéo pausée', () => {
    BBM.Player._partyCode = 'ABC123';
    BBM.Player._showLobby({ isHost: true });
    expect(document.getElementById('wp-lobby').style.display).toBe('');
    expect(document.getElementById('wp-lobby-code').textContent).toBe('ABC123');
    expect(document.getElementById('wp-lobby-start').style.display).toBe('');
    expect(document.getElementById('wp-lobby-waiting').style.display).toBe('none');
    expect(BBM.Player._lobbyVisible).toBe(true);
    expect(BBM.Player.video.paused).toBe(true);
  });

  test('_showLobby guest : start caché, waiting visible', () => {
    BBM.Player._partyCode = 'DEF456';
    BBM.Player._showLobby({ isHost: false });
    expect(document.getElementById('wp-lobby-start').style.display).toBe('none');
    expect(document.getElementById('wp-lobby-waiting').style.display).toBe('');
  });

  test('_hideLobby cache le lobby + révèle chat', () => {
    BBM.Player._partyCode = 'ABC123';
    BBM.Player._showLobby({ isHost: true });
    BBM.Player._hideLobby();
    expect(document.getElementById('wp-lobby').style.display).toBe('none');
    expect(BBM.Player._lobbyVisible).toBe(false);
    expect(document.getElementById('btn-wp-chat').style.display).toBe('');
    expect(document.getElementById('wp-chat').style.display).toBe('');
  });

  test('_hideLobby : pour l\'host, redémarre la lecture', () => {
    BBM.Player._partyCode = 'ABC123';
    BBM.Player._isPartyHost = true;
    BBM.Player._showLobby({ isHost: true });
    BBM.Player.video._paused = true;
    BBM.Player._hideLobby();
    expect(BBM.Player.video.paused).toBe(false);
  });

  test('_hideLobby : pour le guest, ne touche pas à la lecture', () => {
    BBM.Player._partyCode = 'ABC123';
    BBM.Player._isPartyHost = false;
    BBM.Player._showLobby({ isHost: false });
    BBM.Player.video._paused = true;
    BBM.Player._hideLobby();
    expect(BBM.Player.video.paused).toBe(true);
  });

  test('_revealChatUI idempotent', () => {
    BBM.Player._revealChatUI();
    BBM.Player._revealChatUI();
    expect(document.getElementById('btn-wp-chat').style.display).toBe('');
    expect(document.getElementById('wp-chat').style.display).toBe('');
  });
});

describe('_renderLobbyParticipants', () => {
  test('rend la liste avec badge HOST sur l\'hôte', () => {
    const state = {
      hostUid: 'h1',
      hostName: 'Alex',
      participants: {
        h1: { name: 'Alex', joinedAt: {} },
        g1: { name: 'Bob', joinedAt: {} }
      }
    };
    BBM.Player._renderLobbyParticipants(state);
    const list = document.getElementById('wp-lobby-participants');
    expect(list.children.length).toBe(2);
    expect(document.getElementById('wp-lobby-count').textContent).toBe('2');
    expect(document.getElementById('wp-lobby-plural').textContent).toBe('s');
    const hostRow = list.querySelector('.wp-lobby-participant.is-host');
    expect(hostRow).toBeTruthy();
    expect(hostRow.querySelector('.wp-lobby-host-badge')).toBeTruthy();
  });

  test('1 participant : pas de "s"', () => {
    BBM.Player._renderLobbyParticipants({
      hostUid: 'h1', hostName: 'Solo',
      participants: { h1: { name: 'Solo' } }
    });
    expect(document.getElementById('wp-lobby-count').textContent).toBe('1');
    expect(document.getElementById('wp-lobby-plural').textContent).toBe('');
  });

  test('échappe les caractères dangereux dans les noms (pas d\'injection HTML)', () => {
    BBM.Player._renderLobbyParticipants({
      hostUid: 'h1', hostName: 'Alex',
      participants: { h1: { name: '<script>alert(1)</script>' } }
    });
    const list = document.getElementById('wp-lobby-participants');
    // Surtout : pas de <script> exécuté ni de tag injecté
    expect(list.querySelector('script')).toBeNull();
    // Le nom apparaît dans .wp-lobby-name comme texte (pas HTML)
    const nameEl = list.querySelector('.wp-lobby-name');
    expect(nameEl).toBeTruthy();
    expect(nameEl.textContent).toContain('script');
  });

  test('affiche le hostName dans #wp-lobby-host-name', () => {
    BBM.Player._renderLobbyParticipants({
      hostUid: 'h1', hostName: 'Captain',
      participants: { h1: { name: 'Captain' } }
    });
    expect(document.getElementById('wp-lobby-host-name').textContent).toBe('Captain');
  });
});

describe('_floatReaction', () => {
  test('crée un élément dans la layer', () => {
    BBM.Player._floatReaction('🔥', 'Alex');
    const layer = document.getElementById('wp-reactions-layer');
    expect(layer.children.length).toBe(1);
    const el = layer.querySelector('.wp-reaction-float');
    expect(el).toBeTruthy();
    expect(el.querySelector('.wp-reaction-emoji').textContent).toBe('🔥');
    expect(el.querySelector('.wp-reaction-author').textContent).toBe('Alex');
  });

  test('échappe les noms d\'envoyeur', () => {
    BBM.Player._floatReaction('❤️', '<img onerror=x>');
    const author = document.querySelector('.wp-reaction-author');
    expect(author.innerHTML).not.toContain('<img');
    expect(author.innerHTML).toContain('&lt;img');
  });

  test('position aléatoire entre 60% et 90%', () => {
    for (let i = 0; i < 10; i++) {
      BBM.Player._floatReaction('🎉', 'X');
    }
    document.querySelectorAll('.wp-reaction-float').forEach(el => {
      const left = parseFloat(el.style.left);
      expect(left).toBeGreaterThanOrEqual(60);
      expect(left).toBeLessThanOrEqual(90);
    });
  });
});

describe('_applyPartyState — sync de lecture chez le guest', () => {
  beforeEach(() => {
    BBM.Player._isPartyHost = false;
    BBM.Player.video._duration = 7200;
  });

  test('host playing → guest play', () => {
    BBM.Player.video._paused = true;
    BBM.Player._applyPartyState({ isPlaying: true, currentTime: 30 });
    expect(BBM.Player.video.paused).toBe(false);
  });

  test('host paused → guest pause', () => {
    BBM.Player.video._paused = false;
    BBM.Player._applyPartyState({ isPlaying: false, currentTime: 30 });
    expect(BBM.Player.video.paused).toBe(true);
  });

  test('drift > 2s : seek le guest', () => {
    BBM.Player.video.currentTime = 10;
    BBM.Player._applyPartyState({ isPlaying: true, currentTime: 50 });
    expect(BBM.Player.video.currentTime).toBe(50);
  });

  test('drift < 2s : pas de seek', () => {
    BBM.Player.video.currentTime = 49;
    BBM.Player._applyPartyState({ isPlaying: true, currentTime: 50 });
    expect(BBM.Player.video.currentTime).toBe(49);
  });

  test('hôte ne s\'applique pas son propre state', () => {
    BBM.Player._isPartyHost = true;
    BBM.Player.video._paused = false;
    BBM.Player._applyPartyState({ isPlaying: false, currentTime: 30 });
    expect(BBM.Player.video.paused).toBe(false); // pas changé
  });

  test('queue le seek si metadata pas chargée', () => {
    BBM.Player.video._duration = NaN;
    BBM.Player._applyPartyState({ isPlaying: true, currentTime: 100 });
    // Le seek est queué, pas appliqué immédiatement
    expect(BBM.Player.video.currentTime).toBe(0);
    expect(BBM.Player._pendingPartySeek).toBe(100);
  });
});

describe('_pushPartyState — host pousse l\'état', () => {
  test('host : push currentTime + isPlaying', () => {
    let pushed;
    BBM.API.updateWatchPartyState = (code, state) => {
      pushed = { code, state };
      return Promise.resolve();
    };
    BBM.Player._isPartyHost = true;
    BBM.Player._partyCode = 'XYZ';
    BBM.Player.video.currentTime = 42;
    BBM.Player.video._paused = false;
    BBM.Player._pushPartyState();
    expect(pushed.code).toBe('XYZ');
    expect(pushed.state.currentTime).toBe(42);
    expect(pushed.state.isPlaying).toBe(true);
  });

  test('guest : ne push pas', () => {
    let pushed = false;
    BBM.API.updateWatchPartyState = () => { pushed = true; return Promise.resolve(); };
    BBM.Player._isPartyHost = false;
    BBM.Player._partyCode = 'XYZ';
    BBM.Player._pushPartyState();
    expect(pushed).toBe(false);
  });

  test('sans party code : ne push pas', () => {
    let pushed = false;
    BBM.API.updateWatchPartyState = () => { pushed = true; return Promise.resolve(); };
    BBM.Player._isPartyHost = true;
    BBM.Player._partyCode = null;
    BBM.Player._pushPartyState();
    expect(pushed).toBe(false);
  });
});

describe('_refreshOutroBtnLabel', () => {
  beforeEach(() => {
    document.body.innerHTML += `
      <button id="skip-btn-outro"><span class="skip-btn-label">X</span></button>
    `;
  });

  test('label "Passer l\'outro" si pas de postCreditsAt', () => {
    BBM.Player._skipMarkers = { postCreditsAt: null };
    BBM.Player._refreshOutroBtnLabel();
    expect(document.querySelector('#skip-btn-outro .skip-btn-label').textContent)
      .toBe('Passer l\'outro');
  });

  test('label "Aller au post-générique" si postCreditsAt défini', () => {
    BBM.Player._skipMarkers = { postCreditsAt: 7200 };
    BBM.Player._refreshOutroBtnLabel();
    expect(document.querySelector('#skip-btn-outro .skip-btn-label').textContent)
      .toBe('Aller au post-générique');
  });
});

describe('_renderSkipMarkers', () => {
  beforeEach(() => {
    document.body.innerHTML += `
      <div id="skip-marker-recap" style="display:none"></div>
      <div id="skip-marker-intro" style="display:none"></div>
      <div id="skip-marker-outro" style="display:none"></div>
      <div id="skip-marker-postcredits" style="display:none"></div>
    `;
    BBM.Player.video._duration = 7200;
  });

  test('cache tous les marqueurs si pas de duration', () => {
    BBM.Player.video._duration = NaN;
    BBM.Player._skipMarkers = { introStart: 0, introEnd: 60 };
    BBM.Player._renderSkipMarkers();
    expect(document.getElementById('skip-marker-intro').style.display).toBe('none');
  });

  test('place le marqueur intro selon le ratio', () => {
    BBM.Player._skipMarkers = { introStart: 0, introEnd: 720 };
    BBM.Player._renderSkipMarkers();
    const m = document.getElementById('skip-marker-intro');
    expect(m.style.display).toBe('');
    expect(m.style.left).toBe('0%');
    expect(m.style.width).toBe('10%'); // 720 / 7200 = 0.1
  });

  test('cache le marqueur si start >= end', () => {
    BBM.Player._skipMarkers = { introStart: 60, introEnd: 30 };
    BBM.Player._renderSkipMarkers();
    expect(document.getElementById('skip-marker-intro').style.display).toBe('none');
  });

  test('place le point post-credits', () => {
    BBM.Player._skipMarkers = { postCreditsAt: 3600 };
    BBM.Player._renderSkipMarkers();
    const m = document.getElementById('skip-marker-postcredits');
    expect(m.style.display).toBe('');
    expect(m.style.left).toBe('50%'); // 3600 / 7200
  });
});

describe('formatTime', () => {
  test('NaN → 0:00', () => {
    expect(BBM.Player.formatTime(NaN)).toBe('0:00');
  });
  test('< 1 min', () => {
    expect(BBM.Player.formatTime(45)).toBe('0:45');
  });
  test('< 1 h', () => {
    expect(BBM.Player.formatTime(125)).toBe('2:05');
  });
  test('> 1 h', () => {
    expect(BBM.Player.formatTime(3725)).toBe('1:02:05');
  });
  test('> 10 h', () => {
    expect(BBM.Player.formatTime(36000)).toBe('10:00:00');
  });
  test('arrondi à l\'entier inférieur', () => {
    expect(BBM.Player.formatTime(45.9)).toBe('0:45');
  });
});

describe('_saveMiniPlayerState — guards', () => {
  beforeEach(() => {
    sessionStorage.clear();
    BBM.Player.tmdbID = '42';
    BBM.Player.type = 'movie';
    BBM.Player.season = null;
    BBM.Player.episode = null;
  });

  test('skip si currentTime < 5s', () => {
    BBM.Player.video.currentTime = 2;
    BBM.Player.video._duration = 7200;
    BBM.Player._saveMiniPlayerState('https://x.mp4', 'Test');
    expect(sessionStorage.getItem('bbm_mini_player_state')).toBeNull();
  });

  test('skip si vidéo > 95% terminée', () => {
    BBM.Player.video.currentTime = 7000;
    BBM.Player.video._duration = 7200;
    BBM.Player._saveMiniPlayerState('https://x.mp4', 'Test');
    expect(sessionStorage.getItem('bbm_mini_player_state')).toBeNull();
  });

  test('sauvegarde si entre 5s et 95%', () => {
    // Charger mini-player.js pour avoir BBM.MiniPlayer dispo
    loadFile('js/mini-player.js');
    BBM.Player.video.currentTime = 100;
    BBM.Player.video._duration = 7200;
    BBM.Player._saveMiniPlayerState('https://x.mp4', 'Test');
    expect(sessionStorage.getItem('bbm_mini_player_state')).toBeTruthy();
  });
});
