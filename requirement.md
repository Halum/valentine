# Technical Specification: Anniversary Surprise Web Experience

## 1. Project Overview
A 3-level interactive web experience designed as a surprise anniversary gift. The site is a single-page application (SPA) built with **Vanilla HTML5, CSS3, and JavaScript**.

## 2. Technical Constraints
* **No Build Step:** No React, Vue, or compilation required. Pure JS/CSS/HTML only.
* **Server:** Custom `server.py` (Python stdlib only) that serves static files + provides API endpoints for the admin panel and analytics logging.
* **Asset Management:**
    * Text, keywords, and matching logic are loaded from a local `data.json` file.
    * Site name and level names are JSON-driven and reflected in browser tab title format: `siteName | levelName`
* **State Management:** Persistence via `localStorage`. User progress (current level, found sparkles, matched pairs, captured words) survives page refresh.
* **Styling:** Responsive, mobile-friendly, romantic aesthetic with CSS variables for consistent theming.
* **Admin Mode:** URL parameters `?admin=true` enables debugging features, `?level=N` jumps to specific level, `?reset=true` clears state.

---

## 3. Level 1: "Mist of Memories" (Discovery)

### Objective
Clear a foggy canvas overlay to discover hidden sparkles.

### Interaction
* Full-screen canvas with a semi-opaque fog layer
* User "wipes" the fog using mouse drag or touch (Canvas `globalCompositeOperation = 'destination-out'`)
* Fog persists across refreshes (canvas state is preserved during resize)

### Mechanics
* **Sparkles:** 6 hidden sparkle locations defined in `data.json` with `xPercent`, `yPercent`, `radius`, `label`, and optional `photo` (filename in `photos/level1/`)
* **Photo Reveal:** When a sparkle with a `photo` field is clicked, the photo pops into view inside the circle (border-radius 50%, object-fit cover) with a scale+opacity transition. The hitbox grows from 60px to 100px on discovery.
* **Discovery:** Sparkles are invisible and non-clickable under fog
* **Fog Detection:** JavaScript continuously checks fog alpha channel around each sparkle position
* **Reveal:** When 40%+ of fog around a sparkle is cleared, it becomes visible with a glowing pulsing pink circle animation
* **Click:** User clicks revealed sparkle → heart animation bursts, sparkle marked as found, progress counter updates
* **Admin Mode:** Sparkles always visible with red outline, clickable regardless of fog

### Exit
Once all sparkles are found, subtitle fades out and "Step into our story" CTA button fades in. Clicking advances to Level 2.

### Files
* `js/level1.js` - Fog canvas logic, wipe events, sparkle hitboxes, fog clearance detection loop
* `css/level1.css` - Fog canvas, sparkle glow animations, heart burst effects, responsive layout

---

## 4. Level 2: "Timeline Match" (Connection)

### Objective
Match 9 dates to their corresponding memories.

### Interaction
* **Left Column (Dates):** 9 tiles showing "Month Year" in a timeline format
* **Right Column (Memories):** 9 tiles showing emoji + short caption
* All tiles start face-down (placeholder state)

### Mechanics
* **Flip & Match:** Click a date tile and a memory tile to flip them
* **Match Logic:** Correct pair → both lock in place, cannot be unflipped
* **Timeline Node:** Matched pairs appear as nodes on a vertical timeline (centered, showing date, emoji, and caption)
* **Mismatch:** Incorrect pair → both flip back after 1 second
* **State Persistence:** Matched pairs remain locked across page refresh

### Exit
Once all 9 pairs are matched, timeline is complete. "Continue our journey" CTA button appears. Clicking advances to Level 3.

### Files
* `js/level2.js` - Flip logic, match validation, timeline node creation, state persistence
* `css/level2.css` - Card flip animations, timeline layout, responsive grid

---

## 5. Level 3: "The Grand Reveal" (The Message)

### Objective
Capture 15 flying keywords to form a heart-shaped word cloud, revealing a gift box.

### Interaction
* **Flying Words:** 15 keywords (Adventure, Growth, Laughter, Trust, Joy, Forever, Home, Kindness, Us, Courage, Dreams, Warmth, Promise, Wonder, Together) float around the screen with velocity-based physics, bouncing off viewport edges
* **Visual State:** Words start **blurred** (8px blur on text) while flying
* **Progressive Deblur:** Each click reduces blur incrementally (3 clicks needed: 8px → ~5px → ~2.7px → 0px fully clear)
* **Admin Mode:** Only 1 click needed to capture

### Mechanics
* **Capture:** After 3 clicks (or 1 in admin mode), word flies to its predetermined position in a heart-shaped layout (15 hardcoded viewport-percentage slots forming a heart silhouette)
* **Heart Outline:** SVG heart path split into 15 equal segments
  * Each segment starts invisible
  * When a word is captured, its corresponding segment (nearest to the word's position) reveals with pink glow
  * Segments are position-matched using greedy assignment to avoid gaps/overlaps
* **Release:** Clicking a captured word in the heart releases it back to random flying position, resets blur, hides its outline segment
* **Lock:** Once all 15 words are captured:
  * Heart is complete, all words locked (non-clickable)
  * Words pulse with glow animation
  * Heart outline pulses with enhanced glow

### The Reveal
* **10-second delay** after completion
* Words and heart outline fade out
* **Gift box animation:** Box with lid appears at center, lid rotates open
* **Sparkles:** 5 emoji sparkles (✨💖🌟💕⭐) rise from the box sequentially
* **Message:** "Forever & Always 💕" fades in below the box
* **"Start Over" button** appears at bottom, resets `localStorage` and reloads the page

### Files
* `js/level3.js` - Flying animation (requestAnimationFrame), click tracking, progressive blur, heart position slots, SVG segment creation, position-matching algorithm, gift box reveal sequence
* `css/level3.css` - Floating word pills, blur transitions, heart outline SVG, gift box with lid rotation, sparkle rise animation

---

## 6. Data Structure (`data.json`)

```json
{
  "siteName": "Mist of Memories",
  "level1": {
    "name": "Mist of Memories",
    "title": "Mist of Memories",
    "subtitle": "Wipe away the fog to uncover hidden sparkles",
    "sparkles": [
      { "id": "s1", "xPercent": 0.25, "yPercent": 0.40, "radius": 30, "label": "Our first trip", "photo": "s1.jpg" }
    ],
    "ctaText": "Step into our story"
  },
  "level2": {
    "name": "Timeline Match",
    "title": "Timeline Match",
    "subtitle": "Match each date to its memory",
    "ctaText": "Continue our journey",
    "pairs": [
      { "id": "p1", "date": "Jan 2020", "emoji": "✈️", "caption": "Our first adventure together" }
    ]
  },
  "level3": {
    "name": "The Grand Reveal",
    "title": "The Grand Reveal",
    "subtitle": "Catch the words that define us",
    "keywords": [
      { "id": "w1", "word": "Adventure" }
    ]
  }
}
```

---

## 7. State Management (`localStorage`)

State key: `anniversary_state`

```json
{
  "currentLevel": 1,
  "level1": { "foundSparkles": ["s1", "s2"] },
  "level2": { "matchedPairs": ["p1", "p3"] },
  "level3": { "capturedWords": ["w1", "w5", "w9"] }
}
```

* **Persistence:** All interactions (sparkle discoveries, pair matches, word captures) save immediately to localStorage
* **Restore:** On page load, state is restored (sparkles marked found, pairs locked, words placed in heart)
* **Reset:** "Start Over" button in Level 3 calls `resetState()` → clears localStorage → reloads page

---

## 8. Admin Mode

URL parameters:
* `?admin=true` - Enables admin features across all levels
* `?level=N` - Jump to specific level (1, 2, or 3)
* `?reset=true` - Clear localStorage on load

### Admin Features by Level:

**Level 1:**
* Sparkles always visible with red outline and semi-transparent red background
* Sparkles clickable regardless of fog coverage

**Level 2:**
* Tile backs show pair numbers (1-9) instead of "?" to help identify matches

**Level 3:**
* Click count badges always visible (normally only show after first click)
* Only 1 click needed to capture words instead of 3

---

## 9. File Structure

```
/app
├── index.html
├── admin.html
├── server.py
├── data.json            (gitignored — personal content)
├── data.example.json    (committed — placeholder structure)
├── Dockerfile
├── /css
│   ├── variables.css    (color palette, z-index layers, fonts, transitions)
│   ├── base.css         (global styles, body, level containers)
│   ├── level1.css
│   ├── level2.css
│   └── level3.css
├── /js
│   ├── main.js          (initialization, level routing, document title)
│   ├── state.js         (getState, setState, resetState)
│   ├── admin.js         (isAdmin flag, URL param parsing, overrides)
│   ├── analytics.js     (session tracking, logEvent, fire-and-forget POST)
│   ├── admin-panel.js   (JSON editor, photo manager, log viewer)
│   ├── level1.js
│   ├── level2.js
│   └── level3.js
├── /photos              (gitignored — personal photos)
│   ├── /level1          (s1.jpg … s6.jpg — sparkle photos)
│   └── /level2          (p1.jpg … p9.jpg — timeline pair photos)
└── /logs                (gitignored — analytics data)
    └── analytics.jsonl
```

---

## 9b. Admin Panel (`/admin`)

### Overview
A dedicated admin page (`admin.html`) accessible at `/admin.html`. A lightweight custom Python server (`server.py`) serves static files AND provides API endpoints for saving JSON and managing photos. No npm, no build step, no external Python dependencies — only Python stdlib.

---

### Server: `server.py`

A minimal Python HTTP server (stdlib only: `http.server`, `json`, `os`, `shutil`) that:

* **Serves static files** — drop-in replacement for `python -m http.server`
* **`POST /api/save-json`** — Receives JSON body, validates it's valid JSON, writes to `data.json`
* **`POST /api/upload-photo`** — Receives multipart image upload with level and filename params, saves to `photos/{level}/{filename}`
* **`DELETE /api/delete-photo?level=level2&file=p1.jpg`** — Deletes specified photo file
* **`GET /api/list-photos?level=level2`** — Returns JSON array of filenames in the specified photos directory

**Usage:** `python server.py` (replaces `python -m http.server`)

---

### Feature 1: JSON Editor

**Goal:** Allow the admin to view and edit `data.json` directly from the deployed app without touching a code editor.

**Requirements:**
* On page load, the editor fetches `data.json` and displays it in an editable UI.
* Use a **CDN-hosted JSON editor library** (e.g., [JSONEditor](https://github.com/josdejong/jsoneditor) via CDN) — no npm/build step.
* Editor must support both **tree view** (for non-technical editing) and **code/text view** (raw JSON).
* Validation: prevent saving malformed JSON (client-side check before POST).
* **Save workflow:** Clicking "Save" sends a `POST /api/save-json` request. The server validates and writes `data.json`. Success/error feedback shown via toast.

**Data sections exposed in the editor:**
* `siteName`
* `level1` — title, subtitle, ctaText, sparkles array (id, xPercent, yPercent, radius, label)
* `level2` — title, subtitle, ctaText, pairs array (id, date, emoji, caption, **photo** field — see Feature 2)
* `level3` — title, subtitle, keywords array (id, word)

---

### Feature 2: Photo Manager

**Goal:** Allow the admin to upload, view, replace, and remove photos that are referenced in `data.json` (e.g., photos for Level 2 timeline pairs).

**Photo directory structure:**
```
/photos
├── /level1
│   ├── s1.jpg … s6.jpg  (sparkle photos)
└── /level2
    ├── p1.jpg … p9.jpg  (timeline pair photos)
```

**Requirements:**

**Upload:**
* Admin selects one or more image files via a file picker.
* Images are displayed as previews before confirming.
* On confirm, each image is `POST`ed to `/api/upload-photo` with the target level and filename.
* Server saves the file to `photos/{level}/{filename}`.
* Admin updates the `photo` field in the JSON editor to reference the new file.

**View:**
* Display a grid of all photos currently in the `photos/level2/` directory (fetched via `GET /api/list-photos?level=level2`).
* Each photo card shows: thumbnail (loaded via relative path), file name.
* Cross-reference with `data.json` pairs to show associated pair ID and caption (if mapped).
* If a pair references a photo that doesn't exist, show a "missing" indicator.

**Replace:**
* Each photo card has a "Replace" button — opens a file picker, uploads the new image with the same filename via `/api/upload-photo`, overwriting the old one.

**Remove:**
* Each photo card has a "Remove" button — sends `DELETE /api/delete-photo?level=level2&file=p1.jpg`.
* Also clears the `photo` field from the corresponding pair in the JSON editor (admin should re-save JSON).

**Naming convention:** Photos should be named to match their pair ID (e.g., `p1.jpg`, `p2.jpg`) for easy mapping.

---

### Files (Phase 2)

```
/app
├── admin.html               (Admin panel page)
├── server.py                (Custom Python server — static files + API)
└── /js
    └── admin-panel.js       (JSON editor init, photo manager logic)
/photos
└── /level2/                 (Photos organized by level)
```

**CDN dependencies (loaded in `admin.html` only):**
* JSONEditor: `https://cdnjs.cloudflare.com/ajax/libs/jsoneditor/10.1.0/jsoneditor.min.js`
* JSONEditor CSS: `https://cdnjs.cloudflare.com/ajax/libs/jsoneditor/10.1.0/jsoneditor.min.css`

---

### Phase 2 Constraints
* **Server:** Single-file Python script, stdlib only — no pip install, no frameworks.
* No npm, no build step.
* Admin panel does not need to match the romantic aesthetic of the main app; a clean, functional dark UI is preferred.
* The `admin.html` page must not be linked from the main app in any way.

---

## 9c. Analytics Logging

### Overview
Server-side logging of user interactions, visits, and browser metadata to a local log file. No third-party analytics services — all data stays on disk. The server collects events via a `POST /api/log` endpoint and appends them to `logs/analytics.jsonl` (one JSON object per line).

---

### What Gets Logged

**Automatic (on page load):**
* Timestamp (ISO 8601)
* Client IP address (from request headers, with `X-Forwarded-For` support for proxies)
* User-Agent string (raw + parsed: browser name, version, OS, device type)
* Referrer URL
* Screen resolution, viewport size, color depth
* Language / locale
* Timezone
* Connection type (if available via `navigator.connection`)
* Session ID (random UUID stored in `sessionStorage`, groups events per visit)

**User interactions (sent as events):**
* `page_view` — level shown (level1, level2, level3)
* `level1_sparkle_found` — sparkle ID
* `level1_completed` — all sparkles found
* `level2_pair_matched` — pair ID
* `level2_completed` — all pairs matched
* `level3_word_captured` — word ID
* `level3_completed` — all words captured, reveal triggered
* `level_transition` — from/to level
* `reset` — user clicked "Start Over"

---

### Server: New API Route

**`POST /api/log`**
* Receives JSON body with event data
* Server enriches with IP address and timestamp
* Appends one JSON line to `logs/analytics.jsonl`
* Creates `logs/` directory if missing
* Returns `200 { "ok": true }`
* Never blocks the client — fire-and-forget from browser side

**`GET /api/logs`** (admin only, served from admin panel)
* Returns the last N lines of the log file (default 100, configurable via `?limit=N`)
* Response: JSON array of log entries

---

### Client: `js/analytics.js`

A lightweight module imported by `main.js`:

* **`initAnalytics()`** — generate/retrieve session ID, collect device info, send `page_view` event
* **`logEvent(name, data)`** — fire-and-forget `POST /api/log` with event name + data payload + session metadata
* Non-blocking: uses `navigator.sendBeacon` with `fetch` fallback
* Batching not needed (low event volume)

Level JS files call `logEvent()` at key moments (sparkle found, pair matched, word captured, level completed).

---

### Log Format

File: `logs/analytics.jsonl` (newline-delimited JSON)

```json
{"ts":"2026-02-21T14:30:00Z","ip":"203.0.113.42","session":"a1b2c3","event":"page_view","level":"level1","ua":"Mozilla/5.0...","browser":"Chrome 120","os":"macOS 14","device":"desktop","screen":"1920x1080","viewport":"1440x900","lang":"en-US","tz":"Asia/Dhaka","referrer":"","colorDepth":24}
{"ts":"2026-02-21T14:30:45Z","ip":"203.0.113.42","session":"a1b2c3","event":"level1_sparkle_found","data":{"sparkleId":"s1"}}
```

---

### Admin Panel: Log Viewer Tab

Add a third tab to `admin.html`: **Logs**

* Fetches `GET /api/logs?limit=200`
* Displays a reverse-chronological table: timestamp, IP, event, details, browser, device
* Filter by event type, session ID, or IP
* Auto-refresh toggle (poll every 10s)
* Download full log file button

---

### Files (Phase 3)

```
/app
├── server.py                (Modified — add /api/log and /api/logs routes)
├── admin.html               (Modified — add Logs tab)
├── js/
│   ├── analytics.js         (New — event logging client)
│   ├── admin-panel.js       (Modified — add log viewer)
│   ├── main.js              (Modified — import and init analytics)
│   ├── level1.js            (Modified — add logEvent calls)
│   ├── level2.js            (Modified — add logEvent calls)
│   └── level3.js            (Modified — add logEvent calls)
└── logs/
    └── analytics.jsonl      (Created automatically by server)
```

---

### Phase 3 Constraints
* **No third-party services** — all logging is local, server-side file storage
* **Privacy-conscious** — no fingerprinting beyond standard HTTP headers and JS APIs
* **Non-blocking** — logging must never delay user interactions
* **Append-only** — log file is append-only, no data loss on crash
* **Graceful failure** — if logging fails, the app continues normally

---

## 10. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Level 3 Heart Shape** | Hardcoded 15 viewport-percentage slots | Parametric equations and wordcloud2.js failed to produce recognizable heart. Hardcoded positions work perfectly for exactly 15 words. |
| **Level 3 Blur** | Blur applied to text span only, not pill container | Blurring the entire element blurred the pill background/border, making the page look broken. Text-only blur keeps UI sharp. |
| **Level 3 Outline Segments** | Equal-sized segments, position-matched via greedy nearest-neighbor | Ensures no gaps or overlaps. Segments assigned to nearest words to create visual correspondence. |
| **Level 1 Sparkle Reveal** | Continuous `requestAnimationFrame` loop checking canvas alpha | Real-time fog detection. Sparkles become clickable only when fog is cleared (40%+ threshold). |
| **Flying Animation** | `requestAnimationFrame` with velocity vectors | Smooth 60fps animation, bounce physics, no CSS keyframes needed. |
| **State Persistence** | `localStorage` with structured merge | Progress persists across refresh. Partial state updates merge with defaults. |

---

## 11. Browser Compatibility
* **Target:** Modern browsers (Chrome, Firefox, Safari, Edge) from 2020+
* **Canvas API:** `globalCompositeOperation`, `getImageData`, `requestAnimationFrame`
* **CSS:** CSS Variables, `transform`, `transition`, `animation`, `filter: blur()`, SVG `stroke-dasharray`
* **JS:** ES6 modules, `fetch`, `localStorage`, arrow functions, template literals

---

## 12. Responsive Design
* **Desktop:** Full viewport experience, mouse interactions
* **Mobile:** Touch events, smaller font sizes, tighter layouts
* **Breakpoint:** `@media (max-width: 600px)` for mobile adjustments
* **Level 1:** Canvas and sparkles reposition on window resize
* **Level 3:** Heart slots use viewport percentages, scale proportionally

---

## 13. Implementation Notes for Developer
* **Modularity:** Each level is a separate JS module with `initLevelN(data)` export
* **DRY Principle:** State management, admin mode, and styling are centralized
* **Canvas Optimization:** Level 1 fog state preserved during resize via snapshot
* **Performance:** Level 3 uses single `requestAnimationFrame` loop for all flying words, fog check samples every ~16ms
* **Accessibility:** No ARIA/keyboard nav implemented (designed as a personal gift, not public site)
