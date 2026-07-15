/**
 * The single source of truth mapping Blender mesh names -> portfolio sections.
 * Adding a hotspot = adding an entry here + a screen_* mesh in the scene.
 *
 * Clicking a 'focus' hotspot walks the camera up to the object so it can be
 * read in-world. For each hotspot the camera looks for an empty named
 * view_<name> (e.g. screen_newsstand -> view_newsstand) in the glb to know
 * where to stand; if it's missing, CameraRig computes a fallback viewpoint.
 */
export const HOTSPOTS = {
  screen_billboard: {
    label: 'Case Studies',
    title: 'Shape · Influence · Impact',
    kind: 'focus',
  },
  screen_newsstand: {
    label: 'Press & Features',
    title: 'In the Headlines',
    kind: 'focus',
  },
  screen_shelter: {
    label: 'Ideas in Motion',
    title: 'Projects',
    kind: 'focus',
  },
  screen_payphone: {
    label: 'Contact',
    title: 'Get in Touch',
    kind: 'focus',
  },
  screen_plaque: {
    label: 'Portfolio',
    title: 'About · Résumé · Experience · Skills',
    kind: 'focus',
  },
  screen_cafe: {
    label: 'Get to Know Me',
    title: 'The Café',
    kind: 'cafe', // triggers the walk-inside transition instead of a focus walk
  },
};

/** Meshes inside the café interior scene */
export const CAFE_HOTSPOTS = {
  screen_menu: {
    label: 'Fun Facts',
    title: 'Off the Menu',
    kind: 'focus',
  },
  screen_photos: {
    label: 'Photo Wall',
    title: 'Moments',
    kind: 'focus',
  },
};

// Prepend Vite's base URL so the models resolve both at the dev root ('/')
// and under the GitHub Pages subpath ('/city-of-influence/'). BASE_URL always
// ends in a slash.
const BASE = import.meta.env.BASE_URL;
export const MODELS = {
  city: `${BASE}models/city_scene.glb`, // swap city_scene_dev.glb in during development
  cafe: `${BASE}models/cafe_interior.glb`,
};
