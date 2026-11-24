# Song Library

A list-first song app for singers: every list is laid out like the event (1st Dance, 2nd Dance, Kumzitz, Chupah, Meal, Hachnosas Sefer Torah, Rock), with sections inside each list and every song one tap away.

Built from Joel's original Song Library — 1,175 songs, 298 with lyrics.

## What it does
- **Board** — swipe left/right between lists, pinch (or the ▥ button) to see all lists side by side, Section menu, ↑ Top button.
- **★ Tonight** — tap a star anywhere to add a song to tonight's event. Reorder, copy as text for WhatsApp, Play all, Start gig.
- **♡ Favorites**, **✓ Known**, key and meter on every row, long-press or ≡ to preview lyrics.
- **Key filter** with neighbouring keys. **Search** across titles, tunes and lyrics.
- **Song page** — big lyrics with VERSE / CHORUS / 2x labels, A−/A+, Previous/Next, Edit (title, tune, key, meter, lyrics, link, list, section, position).
- **Listen** — YouTube and YouTube Music play inside the app with speed and A–B loop. Apple Music and Spotify links play in their own small players.
- **Gig mode** — huge lyrics, one big Next button, screen stays on.
- **Backup** — download a backup file, restore it, or download a spreadsheet (.csv).
- **Two looks** — Look A (linen) and Look B (quiet), in Backup & settings.

Everything is saved on the phone. Sync between phones is planned for a later version.

## Put it online with GitHub Pages
1. On github.com, create a new repository (for example `song-library`). Make it **Public**.
2. Click **Add file → Upload files** and drag in everything in this folder (all 11 files). Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Branch*, pick `main` and `/ (root)`, then **Save**.
4. After a minute the app is live at `https://<your-username>.github.io/song-library/`.

## Put it on the phone
Open the link in Safari (iPhone) or Chrome (Android), then **Share → Add to Home Screen**. It opens full-screen and works without signal once it has loaded once.

## Files
- `index.html`, `style.css`, `app.js` — the app (no build step).
- `song-library.json` — the song list. Changes made in the app are saved on the phone; use Backup to keep a copy.
- `sw.js`, `manifest.webmanifest`, icons — offline support and home-screen icon.
