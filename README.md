# Mist of Memories

A 3-level interactive anniversary web experience. No build step, no dependencies — pure HTML/CSS/JS with a lightweight Python server.

## Levels

1. **Mist of Memories** — Wipe fog to reveal hidden sparkles
2. **Timeline Match** — Match dates to memories
3. **The Grand Reveal** — Catch flying words to complete a heart

## Tech Stack

- Vanilla HTML5 / CSS3 / ES6 modules
- Python 3 stdlib (`http.server`) — no pip installs
- `localStorage` for state persistence
- `data.json` for all content (text, levels, pairs)

## Run

```bash
python server.py          # serves on http://localhost:8000
python server.py 3000     # custom port
```

Visit `http://localhost:8000` for the app, `http://localhost:8000/admin.html` for the admin panel.

## Admin Panel

- **JSON Editor** — edit `data.json` in-browser, save with `Ctrl+S`
- **Photo Manager** — upload/replace/remove photos for Level 2 pairs
- Photos stored in `photos/level2/` (named `p1.jpg`, `p2.jpg`, etc.)

URL debug params: `?admin=true` · `?level=2` · `?reset=true`

## Docker

The Dockerfile provides a minimal Python 3 Alpine image — no app code is baked in. You mount your local directory at runtime:

```bash
docker build -t mist-of-memories .

docker run -d \
  --name mist-of-memories \
  -v $(pwd):/app \
  -p 8000:8000 \
  mist-of-memories
```

This means you clone the repo, set up your `data.json` and `photos/`, then run. The container just provides the Python runtime.

## Deploy (bare metal)

For a server with Python 3 installed, no Docker needed:

```bash
scp -r app/ user@host:/var/www/app
ssh user@host "cd /var/www/app && nohup python server.py 8000 > server.log 2>&1 &"
```

## Setup after cloning

```bash
cp data.example.json data.json   # edit with your content
# place photos in photos/level1/ and photos/level2/
```

## File Structure

```
app/
├── index.html
├── admin.html
├── server.py
├── Dockerfile
├── data.example.json        # committed — template structure
├── data.json                # gitignored — your personal content
├── css/
├── js/
├── photos/
│   ├── level1/              # sparkle photos (s1.jpg … s6.jpg)
│   └── level2/              # timeline photos (p1.jpg … p9.jpg)
└── logs/                    # analytics (gitignored)
```
