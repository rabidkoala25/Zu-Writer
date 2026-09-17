# Zu Writer

A text editor that writes in the Zu alphabet from FEZ, with multiple speech boxes and GIF or video export.

## Put it on GitHub Pages

1. Create a new repository on GitHub.
2. Upload everything in this folder (keep the `css`, `js` and `fonts` folders) to the repository root.
3. Go to **Settings → Pages**, set the source to **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

The `.nojekyll` file tells GitHub Pages to serve the files as they are.

## Files

- `index.html` — page structure
- `css/style.css` — styles
- `js/app.js` — layout, rendering, animation and GIF/video export
- `js/save.js` — browser download helper
- `js/vendor/mp4-muxer.js` — MP4 file writer (MIT licence, see `mp4-muxer-LICENSE.txt`)
- `fonts/fez-alphabet.otf` — the FEZ alphabet font

## Animation timing

The default timing follows the Hexahedron's dialogue in the game: 0.25 s before it starts talking, then 0.1 s per character.
Boxes fade in over 0.2 s and out over 0.1 s.

## Video export

Videos are encoded as MP4 with the browser's WebCodecs API (Chrome, Edge, Safari and recent Firefox). Browsers without it record a WebM in real time instead.

To try it locally, run `python3 -m http.server` in this folder and open http://localhost:8000.
