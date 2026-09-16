# Zu Writer

A text editor that writes in the Zu alphabet from FEZ.

## Put it on GitHub Pages

1. Create a new repository on GitHub.
2. Upload everything in this folder (keep the `css`, `js` and `fonts` folders) to the repository root.
3. Go to **Settings → Pages**, set the source to **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

The `.nojekyll` file tells GitHub Pages to serve the files as they are.

## Files

- `index.html` — page structure
- `css/style.css` — styles
- `js/app.js` — layout, rendering and controls
- `fonts/fez-alphabet.otf` — the FEZ alphabet font

To try it locally, run `python3 -m http.server` in this folder and open http://localhost:8000.
