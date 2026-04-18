/* ============================================
   BoomBoomMovie — Changelog Data
   ============================================ */

const BBM_CHANGELOG = {
  currentVersion: '3.0.0',

  versions: [
    {
      version: '3.0.0',
      date: '2026-04-18',
      title: 'Refonte Premium — Violet, Glass & Cinéma',
      type: 'major',
      changes: [
        { type: 'new', text: 'Refonte complète de l\'accueil : palette violet premium, grain cinéma, glassmorphism partout' },
        { type: 'new', text: 'Hero billboard premium avec trailer YouTube en fond, logo TMDB, meta enrichie (note, HD, genres)' },
        { type: 'new', text: 'Row "Top 10" style Netflix avec numéros géants contourés violet' },
        { type: 'new', text: 'Bento spotlight : mise en avant éditoriale grille asymétrique' },
        { type: 'new', text: 'Hover panels enrichis sur les cartes (détails, actions rapides)' },
        { type: 'new', text: 'Typeahead : suggestions instantanées dans la barre de recherche' },
        { type: 'new', text: 'Page landing marketing (index.html) avant login — hero cinématique, features, strip d\'affiches animé' },
        { type: 'new', text: 'Page Paramètres dédiée avec 9 catégories et 30+ options (accent live-swap, mode patate, densité, contraste…)' },
        { type: 'new', text: 'Player premium : grain cinéma, vignettes, chip type FILM/SÉRIE, sous-titre S01E01 auto' },
        { type: 'new', text: 'Player : barre de progression dégradée violet, contrôles en pilule glass floutée' },
        { type: 'new', text: 'Next-Episode card redesignée avec ring SVG animé qui compte à rebours' },
        { type: 'new', text: 'Petit bouton "Marquer vu / Retirer des vus" sur chaque épisode du modal séries' },
        { type: 'new', text: 'Barre de progression de chargement : "124 / 487 titres" en live pendant le batch TMDB' },
        { type: 'improved', text: 'Suivi des épisodes vus individuellement pour les séries (plus seulement le dernier)' },
        { type: 'improved', text: 'Chargement accéléré : concurrency TMDB 6 → 12, cache local 24h → 7 jours' },
        { type: 'improved', text: 'Fusion profile → settings (un seul endroit pour tout régler)' },
        { type: 'improved', text: 'Nettoyage de l\'API secondaire (passage à un worker unique)' },
        { type: 'fix', text: 'Player mobile : grain/vignettes ne couvrent plus le lecteur vidéo natif' },
        { type: 'fix', text: 'Écriture Firestore field-by-field : plus d\'écrasement accidentel de champs frères' }
      ]
    },
    {
      version: '2.9.0',
      date: '2026-04-09',
      title: 'Pages légales & Lazy Loading',
      type: 'minor',
      changes: [
        { type: 'new', text: 'Pages FAQ, Centre d\'aide, Conditions d\'utilisation et Confidentialité' },
        { type: 'new', text: 'Page Changelog avec timeline visuelle' },
        { type: 'new', text: 'Lazy loading des images avec IntersectionObserver — chargement plus rapide' },
        { type: 'improved', text: 'Recherche améliorée : ignore les accents, scoring par pertinence, multi-mots' },
        { type: 'improved', text: 'Admin : actions par délégation d\'événements au lieu de onclick inline' },
        { type: 'fix', text: 'Liens du footer pointent vers les vraies pages' }
      ]
    },
    {
      version: '2.8.0',
      date: '2026-04-09',
      title: 'Tri, Badges & Progression',
      type: 'minor',
      changes: [
        { type: 'new', text: 'Tri dans les catégories : par titre, note, date (A-Z, récent, etc.)' },
        { type: 'new', text: 'Badge "VU" sur les cartes des titres terminés' },
        { type: 'new', text: 'Temps restant affiché dans la row "Reprendre" (ex: 45 min restantes)' },
        { type: 'new', text: 'Indicateur d\'épisodes vus/en cours dans le modal séries' },
        { type: 'fix', text: 'Marquer une série comme vue marque bien tous les épisodes' },
        { type: 'fix', text: 'Retirer le statut "vu" rafraîchit immédiatement les épisodes' }
      ]
    },
    {
      version: '2.7.0',
      date: '2026-04-09',
      title: 'PWA, Accessibilité & Mot de passe oublié',
      type: 'minor',
      changes: [
        { type: 'new', text: 'PWA : site installable sur mobile et desktop avec Service Worker' },
        { type: 'new', text: 'Cache intelligent : assets statiques + images TMDB en cache offline' },
        { type: 'new', text: 'Réinitialisation de mot de passe par email' },
        { type: 'new', text: 'Support reduced-motion pour les utilisateurs sensibles aux animations' },
        { type: 'new', text: 'Focus clavier visible (:focus-visible) sur tous les éléments interactifs' },
        { type: 'improved', text: 'Meta tags Apple mobile web app sur toutes les pages' }
      ]
    },
    {
      version: '2.6.0',
      date: '2026-04-09',
      title: 'Player — Épisodes & Features',
      type: 'minor',
      changes: [
        { type: 'new', text: 'Boutons épisode précédent / suivant dans la barre de contrôles' },
        { type: 'new', text: 'Overlay "Épisode suivant" avec countdown de 10s en fin d\'épisode' },
        { type: 'new', text: 'Picture-in-Picture (PiP) pour regarder en mini-fenêtre' },
        { type: 'new', text: 'Vitesse de lecture (0.5x à 2x) dans le panel Settings' },
        { type: 'new', text: 'Mémorisation du volume entre les sessions (localStorage)' },
        { type: 'new', text: 'Panel Settings avec pistes audio, sous-titres et vitesse' }
      ]
    },
    {
      version: '2.5.0',
      date: '2026-04-09',
      title: 'Player — Optimisations',
      type: 'minor',
      changes: [
        { type: 'fix', text: 'Barre de progression : plus de lag pendant le drag (update visuel instantané)' },
        { type: 'fix', text: 'Barre de progression : ne retombe plus à 0 pendant le buffering' },
        { type: 'fix', text: 'Marquer comme vu fonctionne après avoir terminé un film' },
        { type: 'improved', text: 'Seek throttlé via requestAnimationFrame' },
        { type: 'improved', text: 'Player natif sur tous les mobiles/tablettes (pas seulement iOS)' },
        { type: 'improved', text: 'Fullscreen cross-browser (webkit, Safari desktop/iOS)' },
        { type: 'new', text: 'Support tactile sur la barre de progression (touchstart/move/end)' }
      ]
    },
    {
      version: '2.4.0',
      date: '2026-04-09',
      title: 'Double API & Déduplication',
      type: 'minor',
      changes: [
        { type: 'new', text: 'API secondaire en fallback si l\'API principale est indisponible' },
        { type: 'improved', text: 'Déduplication des items entre les deux APIs' },
        { type: 'improved', text: 'Recherche par ID TMDB dans le catalogue' }
      ]
    },
    {
      version: '2.3.0',
      date: '2026-04-08',
      title: 'UI & Gestion du visionnage',
      type: 'minor',
      changes: [
        { type: 'new', text: 'Bouton "Marquer comme vu" dans les détails d\'un titre' },
        { type: 'new', text: 'Bouton "Retirer de Reprendre" sur les cartes continue watching' },
        { type: 'new', text: 'Dropdown custom pour la sélection de saison (remplace le select natif)' },
        { type: 'improved', text: 'Player iOS utilise les contrôles natifs avec sauvegarde de progression' }
      ]
    },
    {
      version: '2.2.0',
      date: '2026-04-07',
      title: 'Menu mobile',
      type: 'minor',
      changes: [
        { type: 'new', text: 'Menu burger slide-in pour mobile avec toutes les fonctionnalités' },
        { type: 'new', text: 'Avatar et nom d\'utilisateur dans le menu mobile' },
        { type: 'new', text: 'Liens admin, demandes et déconnexion dans le menu mobile' },
        { type: 'improved', text: 'Overlay sombre quand le menu est ouvert' }
      ]
    },
    {
      version: '2.0.0',
      date: '2026-04-07',
      title: 'V2 — Refonte complète',
      type: 'major',
      changes: [
        { type: 'new', text: 'Refonte complète du site avec nouveau design glassmorphism' },
        { type: 'new', text: 'Système d\'authentification Firebase (inscription, connexion)' },
        { type: 'new', text: 'Player vidéo custom avec overlay, raccourcis clavier, progression' },
        { type: 'new', text: 'Système de notation par étoiles (0.5 à 5)' },
        { type: 'new', text: 'Page statistiques avec graphiques (genres, notes, progression)' },
        { type: 'new', text: 'Système de demandes de contenu avec panel admin' },
        { type: 'new', text: 'Collections & Sagas avec vue détaillée' },
        { type: 'new', text: 'Chronologie MCU (ordre chronologique et sortie)' },
        { type: 'new', text: 'Hero billboard aléatoire sur la page d\'accueil' },
        { type: 'improved', text: 'Architecture modulaire (BBM namespace, modules séparés)' }
      ]
    },
    {
      version: '1.3.0',
      date: '2026-03-13',
      title: 'URLs temporaires & Ajouts',
      type: 'minor',
      changes: [
        { type: 'new', text: 'Support des URLs temporaires pour les vidéos' },
        { type: 'new', text: 'Styles pour les contenus expirés/indisponibles' },
        { type: 'new', text: 'Ajout de nouveaux titres au catalogue' }
      ]
    },
    {
      version: '1.2.0',
      date: '2026-03-12',
      title: 'Player & Filtres',
      type: 'minor',
      changes: [
        { type: 'new', text: 'Player vidéo modal intégré' },
        { type: 'new', text: 'Filtres par année et par collection' },
        { type: 'new', text: 'Mode d\'affichage "par année" avec regroupement' },
        { type: 'new', text: 'Toggle entre modes d\'affichage (grille, liste)' },
        { type: 'improved', text: 'Tri des médias par date de sortie' }
      ]
    },
    {
      version: '1.1.0',
      date: '2026-03-12',
      title: 'Images & Navigation',
      type: 'minor',
      changes: [
        { type: 'new', text: 'Lazy loading des images avec placeholder' },
        { type: 'new', text: 'Favicon personnalisé' },
        { type: 'new', text: 'Filtres par collection en chips' },
        { type: 'improved', text: 'Espacement header et cartes' },
        { type: 'improved', text: 'Chargement des posters optimisé' }
      ]
    },
    {
      version: '1.0.0',
      date: '2026-03-12',
      title: 'Lancement initial',
      type: 'major',
      changes: [
        { type: 'new', text: 'Première version de BoomBoomMovie' },
        { type: 'new', text: 'Catalogue de films et séries avec affiches' },
        { type: 'new', text: 'Lecture d\'épisodes avec support URL' },
        { type: 'new', text: 'Interface responsive de base' }
      ]
    }
  ]
};
