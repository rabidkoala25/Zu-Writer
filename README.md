# Zu Writer

A text editor that writes in the Zu alphabet from FEZ. It animates speech boxes (GIF and video export) and turns your text into 3D models (STL, GLB, OBJ).

## Put it on GitHub Pages

1. Create a new repository on GitHub.
2. Upload everything in this folder (keep the `css`, `js` and `fonts` folders) to the repository root.
3. Go to **Settings → Pages**, set the source to **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/<repository-name>/`.

The `.nojekyll` file tells GitHub Pages to serve the files as they are.

The 3D part uses JavaScript modules, which browsers only load over http(s). Opening `index.html` straight from your computer will show the 2D editor but not the 3D preview. To try it locally, run `python3 -m http.server` in this folder and open http://localhost:8000.

## 3D models

- **Sign**: the selected text box on a slab, with glyphs raised or carved in, and an optional speech box frame.
- **Glyphs only**: just the glyph shapes, extruded.
- **Pillar**: a square column with up to four text boxes, one per side, starting at the front and going round to the right.

Models are built from cubes, one cube per half glyph block, so they keep the pixel look. "Size of one block" sets the real-world scale in millimetres.

- **STL** and **OBJ** are shape only and oriented for slicers (Z up).
- **GLB** keeps the surface colours and uses Y up, which Blender and three.js expect.

## Animation timing

The default timing follows the Hexahedron's dialogue in the game: 0.25 s before it starts talking, then 0.1 s per character.
Boxes fade in over 0.2 s and out over 0.1 s.

## Video export

Videos are encoded as MP4 with the browser's WebCodecs API (Chrome, Edge, Safari and recent Firefox). Browsers without it record a WebM in real time instead.

## Files

- `index.html`: page structure
- `css/style.css`: styles
- `js/app.js`: layout, rendering, animation and GIF/video export
- `js/model3d.js`: 3D model builder, preview and exporters
- `js/save.js`: browser download helper
- `js/vendor/mp4-muxer.js`: MP4 file writer (MIT licence)
- `js/vendor/three/`: three.js r160 and the exporters it ships with (MIT licence)
- `fonts/fez-alphabet.otf`: the FEZ alphabet font
