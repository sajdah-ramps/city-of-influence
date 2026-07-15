# City of Influence — Interactive 3D Portfolio

Fresh Vite + React + react-three-fiber project. The 3D street scene replaces the
hero image; illuminated `screen_*` objects are the navigation.

## Setup

```bash
npm install
npm run dev
```

Then open the printed localhost URL.

## Drop in the models

Place the glb exports from Blender into `public/models/`:

- `city_scene.glb` — the street scene (during development, export
  `city_scene_dev.glb` from the blockout and either rename it or update
  `src/config/hotspots.js` → `MODELS.city`)
- `cafe_interior.glb` — the café interior (lazy-loaded on click; the site runs
  fine without it until you click the café)

## The contracts (must match Blender)

- Clickable meshes are named `screen_billboard`, `screen_newsstand`,
  `screen_shelter`, `screen_payphone`, `screen_plaque`, `screen_cafe`
  (city) and `screen_menu`, `screen_photos` (café interior).
- The mesh-name → section mapping lives in `src/config/hotspots.js`.
  Add/rename hotspots there.
- If the glb contains a camera named `cam_main`, the rig adopts its position
  automatically. Otherwise tune the anchor constants at the top of
  `src/scene/CameraRig.jsx` (`CITY_POS`, `CITY_TARGET`, `CAFE_DOOR`,
  `CAFE_POS`, `CAFE_TARGET`). Remember Blender is Z-up, three.js is Y-up:
  Blender `(x, y, z)` → three `(x, z, -y)`.

## Where things live

- `src/App.jsx` — app state: city/café mode, active panel, motion pause, fade
- `src/scene/InteractiveModel.jsx` — glb loading + hover glow + click routing
- `src/scene/CameraRig.jsx` — idle drift, mouse parallax, café fly-through
- `src/ui/Shell.jsx` — header, prompt bar, Pause motion
- `src/ui/SectionPanel.jsx` — content overlays (placeholders — put real
  content in `PanelContent`)
- `src/ui/styles.css` — the light shell around the dark scene

## Tuning notes

- Bloom values live in `App.jsx` (`<Bloom …/>`). Start from the values you
  liked in the pipeline tester.
- Camera drift/parallax amplitudes are the small multipliers in
  `CameraRig.jsx`'s `useFrame`.
- The café transition path is a 3-point Catmull-Rom curve in `CameraRig.jsx`;
  set `CAFE_DOOR` to a point just outside the actual doorway so the camera
  passes through the opening.
- "Pause motion" honors `prefers-reduced-motion` by default.
