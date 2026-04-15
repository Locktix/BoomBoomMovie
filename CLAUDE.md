# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BoomBoomMovie is a full-stack streaming platform with two primary components:

1. **Web Application** (root directory): A progressive web app (PWA) built with vanilla JavaScript, Firebase Auth, Firestore database, and TMDB API integration. Features include browsing movies/series, video player, user profiles, request system, and admin panel. Supports desktop, mobile, and TV devices with responsive/TV-optimized UI.

2. **Android TV App** (`android-tv/`): A native Android TV application that wraps the web app in a WebView. Uses Android Gradle build system with Leanback library support and D-pad navigation.

**Hosted at**: `https://boomboommovie.live` | **Repository**: `https://github.com/Locktix/BoomBoomMovie`

---

## Architecture Overview

### Web Application Stack

**Frontend**: Vanilla JavaScript modules + vanilla CSS
- **No build step required** — the web app is directly deployable to GitHub Pages (as-is)
- **Module pattern**: Global `BBM` namespace with sub-modules (Auth, API, Browse, Player, etc.)
- **Language**: French UI; JavaScript is ES6+ with async/await

**Backend Services**:
- **Firebase**: Authentication (email/password), Firestore database (users, requests, ratings, watch history)
- **TMDB API**: Movie/TV metadata, images, credits, videos (trailers)
- **Worker APIs**: Two external APIs (configured in `js/config.js`) that aggregate movie/series catalog with streaming URLs
- **Service Worker** (`sw.js`): PWA support with cache-first for images, stale-while-revalidate for static assets

**Key JavaScript Modules** (all in `js/`):
- `config.js` — Firebase + TMDB config, global `BBM` namespace setup
- `auth.js` — Firebase authentication (login, register, password reset, admin checks)
- `api.js` — Data layer: fetch catalog from worker APIs, TMDB metadata, Firestore user data
- `browse.js` — Main UI (home, movies, series, my list, search, collections, history)
- `player.js` — Video player (progress tracking, episode navigation for series)
- `admin.js` — Admin panel for approving/rejecting content requests
- `tv-nav.js` — D-pad spatial navigation for TV/Android TV
- `stats.js` — User statistics (watch time, genres, etc.)
- `mcu.js` — MCU collection and chronological ordering

**Firestore Data Structure** (see `firestore.rules`):

```
users/{uid}
  displayName: string
  email: string
  createdAt: timestamp
  admin: boolean (default false)
  myList: array of tmdbIDs (strings)
  continueWatching: map with tmdbID keys and progress objects
  userRatings: map with tmdbID keys and ratings (0-5)
  lastWatchedAt: map with tmdbID keys and timestamps

requests/{requestId}
  title: string
  tmdbID: number
  type: 'movie' or 'series'
  status: 'pending', 'approved', or 'rejected'
  requestedBy: string (uid)
  requestedByName: string
  posterPath: string
  createdAt: timestamp
```

**Worker API Format** (from `workerAPI` and `workerAPI2`):
Returns an array of objects with: tmdbID, title (movies), seriesTitle (series), category, url (streaming URL), seasonNumber (series), episodeNumber (series), createdAt (optional).

### Android TV App Stack

**Build System**: Gradle (AGP 8.2.0), Android SDK 34, target SDK 34, min SDK 21

**Key Files**:
- `android-tv/build.gradle` — Top-level plugins
- `android-tv/app/build.gradle` — App module config (minimal deps: Leanback + WebKit)
- `android-tv/app/src/main/AndroidManifest.xml` — Declares TV intent filters (LEANBACK_LAUNCHER)
- `android-tv/app/src/main/java/com/boomboom/movie/MainActivity.java` — Single-Activity WebView wrapper
- `android-tv/app/src/main/res/layout/activity_main.xml` — FrameLayout with WebView, fullscreen container, error view

**Behavior**:
- Loads `https://boomboommovie.live/browse.html` into a WebView
- Full-screen, immersive mode (hides system UI)
- Adds `AndroidTV BoomBoomMovie/1.0` to User-Agent string (detected by `tv-nav.js` for special handling)
- Custom back-button handling (go back in history, then exit app)
- Error screen if no network connectivity
- Supports full-screen video playback via custom view callback

---

## Key Architectural Patterns

### 1. Modular JavaScript Architecture

All code uses the `BBM` global namespace with sub-modules (Auth, API, Browse, Player, etc.). Each module is self-contained with public methods. Modules initialize synchronously (config.js) or asynchronously on page load.

### 2. Data Flow

1. **Page Load** (browse.html) calls `Browse.init()` which:
   - Calls `Auth.requireAuth()` — Ensure logged in
   - Calls `API.fetchAllItems()` — Fetch catalog from worker APIs (with deduplication & caching)
   - Calls `API.batchFetchTMDB()` — Parallel fetch TMDB metadata (concurrency limit = 6)
   - Loads user data from Firestore (myList, continueWatching, ratings)

2. **Rendering** via `Browse.renderHero()` and `Browse.renderRows()`
3. **User Interaction** — Modals, search, navigation
4. **TV Navigation** (tv-nav.js) — D-pad moves focus using spatial algorithm

### 3. Caching Strategy

- **Memory cache**: `BBM.API._cache` (TMDB metadata, search index)
- **localStorage**: TMDB data with 24h TTL (cacheTTL in config)
- **Service Worker**: Cache-first for TMDB images (LRU, 500 max), stale-while-revalidate for static assets
- **Firestore**: Real-time sync for user data

### 4. TV Mode Detection & Navigation

- **Detection** (tv-nav.js): Checks User-Agent, pointer capability, screen size
- **Spatial Navigation**: Custom algorithm finds best adjacent focusable element (left/right/up/down)
- **Container Grouping**: Horizontal containers keep nav within row; vertical containers keep within list
- **Focus State**: Global `currentFocus` variable; visual feedback via CSS class `.focused`

### 5. Video Playback

- **Player Page** (watch.html): URL params: videoURL, title, tmdbID, type, season, episode
- **Desktop/TV**: Custom HTML5 player with progress tracking, speed, quality, PiP, audio/subtitle settings
- **Mobile**: Native browser controls
- **Progress Tracking**: Saved to Firestore after 5 seconds; auto-loaded on revisit

### 6. Request System

- Users request movies/series (modal searches TMDB, submits to Firestore)
- Admin approves/rejects; auto-approval if content available
- Notifications sent to requester when approved/available

---

## Development Workflow

### Web Application

**No build step** — Files run directly; changes are immediately testable.

**Local Testing**:
```bash
python -m http.server 8000
# Navigate to http://localhost:8000/
```

**Firebase Setup**:
1. Go to Firebase Console (https://console.firebase.google.com/)
2. Create project `boomboommovie`
3. Enable Authentication > Email/Password
4. Create Firestore database
5. Copy API keys into `js/config.js`

**TMDB API**: Sign up at TMDB, update `BBM.Config.tmdb.apiKey` in `js/config.js`

**Deployment**:
- GitHub Pages: Push to main branch (auto-deploys)
- Files to deploy: Root + /css, /js (not android-tv/)

### Android TV App

**Build**:
```bash
cd android-tv
./gradlew build                 # Debug APK
./gradlew assembleRelease       # Release APK (requires signing)
```

**Debug**:
```bash
./gradlew connectedAndroidTest
adb logcat
```

**Config**:
- `MainActivity.java`: Hard-coded URL is `https://boomboommovie.live/browse.html`
- User-Agent appended with `AndroidTV BoomBoomMovie/1.0` (detected by tv-nav.js)
- `local.properties`: Auto-generated SDK path (not tracked)

---

## Common Tasks

**Add a New Page**:
1. Create HTML in root
2. Include Firebase + `js/config.js`, `js/auth.js`
3. Call `BBM.Auth.requireAuth()` for protected pages
4. Load data via `BBM.API.*`
5. Style with `css/style.css`
6. Add nav link in browse.html
7. For D-pad: add elements to FOCUSABLE_SELECTOR in tv-nav.js

**Add Firestore Field**:
1. Define field in `users/{uid}`
2. Update `firestore.rules` if needed
3. Create getter/setter in `BBM.API`
4. Call from appropriate module

**Debug TV Navigation**:
- Emulator: Arrow keys simulate D-pad
- Real Device: Physical remote
- Check console for tv-nav.js logs

**Update Service Worker**:
1. Modify `sw.js`
2. Bump CACHE_NAME version (forces refresh on clients)
3. Users update on next visit

**Add TMDB Metadata Fetch**:
- Single item: `BBM.API.getTMDBData(tmdbID, type)` (auto-cached)
- Bulk: `BBM.API.batchFetchTMDB(items, concurrency)` (respects limits)

---

## Important Notes

- **No Build Tool**: Intentionally simple; direct deployment to GitHub Pages.
- **Language**: French UI throughout — all user-facing strings are in French.
- **API Rate Limiting**: TMDB limits ~40 requests/10s; `batchFetchTMDB` respects this via concurrency control (default 6).
- **Worker API Fallback**: App tries `workerAPI` first, falls back to `workerAPI2` if unavailable.
- **Service Worker versioning**: Bump `CACHE_NAME` in `sw.js` (currently `bbm-v4`) to force cache refresh on clients.

