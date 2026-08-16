# Seat Signal — website

Static site for the seat-occupancy demo. No build step — open `index.html` directly, or serve the folder with any static server.

```
cd site
python3 -m http.server 5500
# then open http://localhost:5500
```

## Files

- `index.html` — main dashboard: entrance traffic light + seat grid
- `heatmap.html` — busyness view across library zones
- `data.js` — the single data source both pages read from (seat list, zone list, mock feed)
- `app.js` / `heatmap.js` — rendering for each page
- `style.css` — design tokens (colors/type) and layout

## Connecting the real hardware

Right now `data.js` runs `SOURCE_MODE = "mock"`, which fakes button presses every few seconds so the UI works standalone.

Once Ethan/Jidam's backend is up:

1. Set `SOURCE_MODE = "live"` in `data.js`
2. Point `LIVE_ENDPOINT` at whatever the backend serves, expected shape:
   ```json
   [{ "id": "A1", "name": "Seat A1", "status": "free", "updatedAt": 1732000000000 }]
   ```
   `status` is one of `free` / `taken` / `finishing` / `na`.
3. If the backend pushes updates instead of being polled, set `LIVE_SOCKET` and it'll pick up `{id, status, updatedAt}` messages.

Seat count is driven entirely by the `SEATS` array in `data.js` — add/remove seats there, no HTML changes needed.

## Mobile app (PWA)

The site is a Progressive Web App — no separate app codebase needed. `manifest.json` + `service-worker.js` + `pwa.js` make it installable on a phone:

- **iPhone (Safari):** open the site → Share → "Add to Home Screen"
- **Android (Chrome):** open the site → menu → "Install app" (or a banner offers this automatically)

Once installed it opens full-screen from the home screen icon, and the service worker caches the app shell so it still opens (showing the last-synced data) without a connection.

**Note:** service workers require HTTPS (or `localhost`) — `file://` won't register one. Serve the folder locally (`python3 -m http.server`) or deploy it (e.g. GitHub Pages) to test the install prompt.
