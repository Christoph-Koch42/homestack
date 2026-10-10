# HomeStack

Find anything in the basement and storage rooms, even with no signal.
QR labels on shelves and boxes, an installable phone app that works offline,
and a laptop view for searching and printing labels.

Live at (after setup): https://christoph-koch42.github.io/homestack/

## Core idea

**Tag places and boxes, not items.** Each shelf, board and box gets a QR
label (`P-0042`). Items only need a name, a category and a location.
Scanning a label shows what's inside; searching an item shows where it is:
*Keller › Regal 1 › Brett 2 › Weihnachtsdeko*.

## Status: MVP (release 1)

| # | Use case | Status |
|---|---|---|
| UC1 | Login (email/password; once online, then offline) | done |
| UC2 | Rooms: add, rename, reorder, delete if empty | done |
| UC3 | Register a place by scanning an unused label | done |
| UC4 | Print label sheets (A4 presets or custom grid) | done |
| UC5 | Categories (German defaults seeded on first run) | done |
| UC6 | Search (ignores case and umlauts: ä = ae = a) | done |
| UC7 | Scan a place to see its contents | done |
| UC8 | Batch-add items (type, Enter, next) | done |
| UC9 | Move items and places (confirmation for places, undo for items) | done |
| UC10 | Remove items (with undo) | done |

Release 2: AI box recognition, photos, item labels, warranty/bill link,
CSV export, replace label. Release 3: maintenance, lending, second user.

## Architecture, in plain terms

Same setup as [motorhome-itinerary](../motorhome-itinerary/README.md):
no server of our own.

```
 Phone / laptop browser
   │
   ├── loads the app from ───────► GitHub Pages (static files, HTTPS)
   │                                     ▲ auto-deploy on push to main
   │                               GitHub Actions (build + publish)
   │
   └── reads/writes data via ────► Firebase (Google-managed)
                                     ├── Authentication (email/password)
                                     └── Firestore (database, Zurich)
```

- **Offline:** Firestore keeps a full copy of the data on the device.
  In the basement every read and write goes to that copy; changes are queued
  and sync automatically once the phone has signal again. The header shows
  `OFFLINE · 3 WAITING` until they are sent.
- **The app itself** is cached by a service worker (PWA), including the
  Inter font, so it opens with no connection.
- **Scanning** uses the phone's built-in QR detector (Android Chrome), with
  `jsqr` as a fallback. A torch button appears when the camera supports it;
  a code can always be typed by hand (`42`, `p42` or `P-0042`).
- **Labels** contain only the code (`P-0042` / `I-0042`), no URL. New codes
  are handed out by a counter in the database, so a code is never used twice;
  that step needs a connection (print upstairs).
- **Security:** Firestore rules ([firestore.rules](firestore.rules)) only allow
  the listed email address. That is the real access boundary; the Firebase
  config values in the app are identifiers, not secrets.

### Cost

$0 on the free Spark plan. Free limits apply per Firebase project
(1 GB storage, 50k reads and 20k writes per day). On the Spark plan Firebase
stops at the limit for the day; it never bills.

## Data model (Firestore)

| Collection | Fields |
|---|---|
| `rooms` | name, sortOrder |
| `places` | code (`P-xxxx` or null), name, type (zone/shelf/board/box/other), roomId, parentId, category, keywords[], notes, createdAt, updatedAt |
| `items` | name, category, placeId, roomId, quantity, notes, code, status (active/removed), removedAt, createdAt, updatedAt |
| `categories` | name (id derived from the name) |
| `meta/counters` | nextP, nextI |

- A place with `parentId: null` sits directly in its room. Nested places get
  their room from the top of their chain, so moving a shelf moves everything
  on it with one write.
- Items with `placeId: null` lie loose in the room (`roomId`).
- Removing an item sets `status: removed` (undo possible), it isn't deleted.

## Design

Swiss International Style: white, black, one signal red (`#FF3000`), Inter,
0 radius, thick rules, numbered sections, grid/dot textures instead of
shadows. All tokens live in [src/styles/tokens.css](src/styles/tokens.css);
reusable building blocks in [src/ui/](src/ui/). White only, no dark mode.
Uppercase is used for app labels, never for your data ("Maße" stays "Maße").

## Setup (one time)

### 1. Firebase

1. https://console.firebase.google.com → **Add project** → name `homestack`
   → Google Analytics off → **Create project**.
2. **Build → Authentication → Get started → Sign-in method → Email/Password
   → Enable → Save**.
3. **Authentication → Users → Add user** → your email + a password.
4. **Build → Firestore Database → Create database** → location
   **europe-west6 (Zurich)** → **Start in production mode** → **Create**.
5. **Firestore → Rules** → paste [firestore.rules](firestore.rules) →
   **Publish**.
6. **Project settings (gear) → General → Your apps → Web (`</>`)** → nickname
   `homestack` → **Register app** → copy the `firebaseConfig` values.
7. **Authentication → Settings → Authorized domains → Add domain** →
   `christoph-koch42.github.io`.

### 2. Local

```bash
cp .env.local.example .env.local   # paste the 6 values from step 1.6
npm install
npm run dev          # laptop: http://localhost:5173/homestack/
npm run dev:phone    # phone on the same Wi-Fi: https://<pc-ip>:5173/homestack/
```

`dev:phone` uses a self-signed HTTPS certificate, because phones only allow
the camera on secure pages. Accept the browser warning once.

### 3. GitHub

1. Create the public repo `Christoph-Koch42/homestack` and push this folder
   to `main`.
2. **Settings → Secrets and variables → Actions → New repository secret**:
   one entry each for `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. **Settings → Pages → Source: GitHub Actions**.
4. Every push to `main` builds and deploys
   ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

### 4. Phone

Open the live URL in Chrome on Android, sign in (with signal), then
**⋮ → Add to Home screen / Install app**. From then on it opens offline.

## Printing labels

Menu → **Labels** (on the laptop). Choose Places or Items, how many, the
sheet format and where to start on the sheet. **Reserve & print** takes the
next free codes. Print at **100% / actual size**, A4, no scaling. Print a
test page on plain paper and hold it against your sticker sheet first;
**Advanced** lets you shift the grid if your printer is off by a millimetre.

Tip: polyester/film labels survive a damp basement better than paper.

## Checks

```bash
npm test        # logic: codes, search with umlauts, paths, move protection
npm run lint
npm run build
```
