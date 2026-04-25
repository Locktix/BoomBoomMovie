# Fonctionnalités existantes — BoomBoomMovie

Inventaire des fonctionnalités déjà implémentées. Sert de référence pour
éviter de re-proposer ce qui existe.

> Mis à jour le 2026-04-26. À refaire après chaque ajout majeur.

---

## Découverte & Navigation

- **Hero / Billboard** — Carte vedette avec autoplay trailer YouTube, logo TMDB, méta enrichie. `browse.html` + `js/browse.js` (renderHero)
- **Rangées horizontales** — Catégories scrollables (Tendances, Films, Séries, etc.) — `js/browse.js` (renderRows)
- **Vue Films** + filtres (genre, année, type, tri) — `browse.html`
- **Vue Séries** + filtres — `browse.html`
- **Collections** — Collections curées (franchises, thèmes) — `js/api.js` (loadCollections)
- **Recherche complète** par titre / TMDB ID avec filtres + tri — `browse.html` (#search-results)
- **Typeahead** — Suggestions live sous la barre de recherche
- **Ligne « + Demander »** dans le typeahead et l'état "aucun résultat" — `js/browse.js`
- **Bouton aléatoire** ("Surprends-moi") — `#btn-random` dans la nav
- **Timeline MCU** chronologique — `mcu.html` + `js/mcu.js`
- **Top 10** (toggleable) — `home.showTop10`
- **Bento grid éditorial** (toggleable) — `home.showBento`
- **Recommandations** basées sur l'historique (toggleable) — `home.showRecommendations`

## Interaction Contenu

- **Modal de détails** — Synopsis, note, casting, genres, vidéos
- **Notes utilisateur** (1-5 étoiles, persistées Firestore)
- **Ma Liste** (cœur ajout/retrait)
- **Reprendre la lecture** — Auto-resume avec position sauvegardée
- **Historique de visionnage** (Firestore `watchHistory`)

## Player

- **Streaming HLS** via hls.js (Chrome/Firefox) + natif Safari
- **Contrôles personnalisés** desktop (play/pause, seek, volume, +10/-10s)
- **Contrôles natifs** sur mobile
- **Plein écran** (bouton player + F11) avec icône dynamique
- **Mode Ultra-Wide 21:9** — `#btn-ultrawide` (zoom + recadrage)
- **Skip Intro / Outro** — Boutons façon Netflix, marqueurs colorés sur la timeline
- **Panel admin timecodes** — Set/Clear par marqueur, save Firestore
- **Picture-in-Picture** — `#btn-pip`
- **Cast Chromecast / AirPlay**
- **Watch Party** — Lecture synchronisée, code 6 caractères, jusqu'à N participants
- **Navigation épisodes** précédent/suivant pour les séries
- **Overlay "À suivre"** avec countdown 10s à la fin d'un épisode
- **Raccourcis clavier** (Espace, K, ←/→, ↑/↓, F, M, Échap, ?)
- **Boutons skip ±10s mobile** — `#mobile-skip-row`
- **Vitesse de lecture** configurable
- **Pistes audio multilingues**
- **Sous-titres multilingues** + off
- **Loader visuel** avec messages d'état du buffering

## Système de Demandes

- **Modal de demande** avec recherche TMDB intégrée
- **Mes demandes** — Historique perso filtrable (Toutes / En attente / Approuvée / Rejetée)
- **Validation admin** — Approuver / Rejeter / Reset depuis l'admin panel
- **Auto-approbation** quand le contenu est ajouté au catalogue (`checkAndAutoApproveRequests`)
- **Notifications de demandes** approuvées (toast)

## Compte Utilisateur

- **Auth Firebase** email/password
- **Inscription** (email, username, password)
- **Connexion**
- **Réinitialisation mot de passe** par email
- **Profil** (display name, email, date d'inscription) — `settings.html` section Compte
- **Modifier display name**
- **Modifier email** (avec mot de passe)
- **Modifier mot de passe**
- **Avatar** (initiale dans la nav)
- **Suppression du compte**
- **Présence temps réel** ("regarde X actuellement") — heartbeat Firestore

## Stats Personnelles (`stats.html`)

- **Temps total visionné**
- **Nombre de films/séries terminés**
- **Nombre en cours**
- **Top contenus notés**
- **Distribution des notes** (graph)
- **Genres préférés** (chart)
- **Activité récente** (feed)
- **Stats des demandes** (donut par statut)
- **Visionnages en cours** avec barre de progression

## Settings (`settings.html`)

### Lecture
- Auto-play épisode suivant + countdown configurable
- **Skip intro auto** (clé `playback.skipIntro` — toggle UI présent, ⚠️ à vérifier si wired au système de skip markers)
- Vitesse + volume par défaut
- PiP automatique

### Apparence
- **Couleur d'accent** (8 palettes : violet, rouge, ambre, émeraude, rose, bleu, cyan…)
- **Densité** (compact / normal / spacious)
- **Mode haut contraste**

### Performance
- **Potato Mode** (kill switch effets visuels)
- Toggle individuels : grain, hover panel, hero trailer, parallax, orbs, animations
- **Qualité des posters** TMDB

### Home
- Toggles : Top 10, Bento, Recommandations
- Items par rangée (3-8)
- Autoplay hero + délai

### Notifications
- Demandes approuvées
- Nouveau contenu

### TV
- Force TV mode
- Taille du focus ring
- Debug overlay

### Privacy
- Sauvegarder progrès
- Sauvegarder historique
- **Export données JSON**
- **Effacer tous les progrès**
- **Vider cache local**
- **Reset settings**

## Admin (`admin.html`)

- **Dashboard** — Vue d'ensemble (online count, demandes, catalogue)
- **Gestion des demandes** — Filtres + actions
- **Gestion utilisateurs** — Liste + recherche + filtres (En ligne / En train de regarder / Admins)
- **Compteur online temps réel**
- **Activité actuelle** par utilisateur (qui regarde quoi)
- **Stats catalogue** (total, films, séries, épisodes)
- **Récemment ajoutés** (7 derniers jours)
- **Top genres**
- **Top demandes** (non approuvées)
- **Panel système** (version, UA, SW, cache)
- **Rafraîchir catalogue** (invalide TMDB cache)
- **Purger demandes résolues**
- **Export demandes JSON**
- **Vider service worker**
- **Supprimer toutes les demandes** (zone danger)

## Notifications

- **Système toast** (success / error / info)
- **Toast demande approuvée**
- **Toast nouveau contenu**

## TV / Android TV

- **Navigation D-pad** spatiale (`js/tv-nav.js`)
- **Détection auto TV** (User-Agent, taille écran, pointer)
- **Focus rings** taille configurable
- **Debug overlay** focus/nav
- **App Android TV native** (WebView wrapper) — `android-tv/`

## PWA / Offline

- **Service Worker** (`sw.js`) — cache-first images TMDB, stale-while-revalidate assets
- **Web Manifest** — install prompt, icônes, shortcuts
- **Standalone mode** iOS/Android

## Pages annexes

- **Changelog** versionné — `changelog.html` + `js/changelog-data.js`
- **FAQ** — `faq.html`
- **Aide / Support** — `help.html`
- **Downloads** (page stub, à confirmer si fonctionnel) — `downloads.html`
- **Privacy Policy** — `privacy.html`
- **Terms** — `terms.html`

---

## À NE PAS proposer (déjà fait)

Liste rapide des features classiques de streaming **déjà présentes**, pour
éviter les doublons quand on brainstorme :

- ❌ Bouton random / surprends-moi
- ❌ Trailer YouTube en background
- ❌ Notifications in-app (toast + settings)
- ❌ Page stats personnelles complète
- ❌ Dashboard admin avec stats
- ❌ Watch Party
- ❌ Continue watching
- ❌ Ma liste
- ❌ Système de demandes + auto-approbation
- ❌ Skip intro/outro avec panel admin
- ❌ Ultra-wide 21:9
- ❌ Présence temps réel
- ❌ Couleurs d'accent personnalisables
- ❌ Mode TV / D-pad
- ❌ Export de données / RGPD
- ❌ Réinitialisation mot de passe
