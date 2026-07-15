import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { applyTowerWindows } from './towerWindows.js';

/**
 * Loads a glb and makes every mesh whose name starts with "screen_" interactive:
 * hover -> emissive boost + pointer cursor + label callback
 * click -> onHotspotClick(meshName)
 *
 * Relies on the naming contract established in Blender.
 */
const DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

// Ground materials whose baked emissive islands came out white — force flat
// dark asphalt instead of trusting the (broken) bake for these.
const DARK_ENV = new Set(['mat_road_wet', 'mat_sidewalk_wet']);

export default function InteractiveModel({
  url,
  hotspots,
  onHotspotClick,
  onHover,
  interactive = true,
}) {
  const { scene } = useGLTF(url, DRACO_PATH);
  const hoveredRef = useRef(null);
  const baseIntensity = useRef(new Map());

  // Collect screens + remember their authored emissive intensity once
  const screens = useMemo(() => {
    const found = [];
    scene.traverse((o) => {
      if (o.isLight) {
        // Blender glTF punctual lights export with huge intensities that blow
        // out the frame; the app's own ambient light + emissives do the work.
        o.intensity = 0;
        o.visible = false;
      }
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (!mat) continue;

          // The towers' window pattern is procedural in Blender; the export
          // flattens it, so we substitute an in-shader window grid.
          if (mat.name === 'mat_backdrop_tower') {
            applyTowerWindows(mat);
            continue;
          }

          // glTF transmission (refractive glass) renders as an opaque white
          // blob inside an EffectComposer; use plain transparency instead.
          if (mat.transmission > 0 && !mat.userData.glassPatched) {
            mat.userData.glassPatched = true;
            mat.transmission = 0;
            mat.transparent = true;
            mat.opacity = 0.24;
            mat.depthWrite = false;
            mat.needsUpdate = true;
          }

          // The scene's look is baked into emissive textures. A few UV islands
          // baked to solid white (visible as white blocks in the atlas), so
          // large flat ground surfaces sample white. Those should just be dark
          // wet asphalt — override with a flat dark emissive, drop the map.
          if (DARK_ENV.has(mat.name) && !mat.userData.darkened) {
            mat.userData.darkened = true;
            mat.emissiveMap = null;
            mat.emissive?.setRGB(0.02, 0.022, 0.028);
            mat.emissiveIntensity = 1;
            mat.needsUpdate = true;
            continue;
          }

          // Otherwise trust the bake: make sure the emissive map renders sRGB
          // with a clean white multiplier.
          if (mat.emissiveMap && !mat.userData.emisNormalized) {
            mat.userData.emisNormalized = true;
            mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            mat.emissive?.setRGB(1, 1, 1);
            mat.emissiveIntensity = mat.emissiveIntensity || 1;
            mat.needsUpdate = true;
          }
        }
      }
      if (o.isMesh && o.name.startsWith('screen_')) {
        found.push(o.name);
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && !baseIntensity.current.has(o.uuid)) {
          if (m.emissiveIntensity !== undefined && m.emissiveIntensity <= 1) {
            m.emissiveIntensity = 1.6; // lift flat exports over the bloom threshold
          }
          baseIntensity.current.set(o.uuid, m.emissiveIntensity ?? 1);
        }
      }
    });
    return found;
  }, [scene]);

  useEffect(() => {
    if (screens.length === 0) {
      console.warn(`[InteractiveModel] no screen_* meshes found in ${url}`);
    }
  }, [screens, url]);

  const setHover = (mesh) => {
    const prev = hoveredRef.current;
    if (prev === mesh) return;
    if (prev) {
      const m = Array.isArray(prev.material) ? prev.material[0] : prev.material;
      if (m) m.emissiveIntensity = baseIntensity.current.get(prev.uuid) ?? 1;
    }
    hoveredRef.current = mesh;
    if (mesh) {
      const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (m) m.emissiveIntensity = (baseIntensity.current.get(mesh.uuid) ?? 1) * 2.2;
      document.body.style.cursor = 'pointer';
      onHover?.(hotspots[mesh.name]?.label ?? mesh.name);
    } else {
      document.body.style.cursor = '';
      onHover?.(null);
    }
  };

  // Clear hover state when unmounting or when interactivity is disabled
  useEffect(() => {
    if (!interactive) setHover(null);
    return () => {
      document.body.style.cursor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  return (
    <primitive
      object={scene}
      onPointerMove={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        const hit = e.intersections.find((i) => i.object.name.startsWith('screen_'));
        setHover(hit ? hit.object : null);
      }}
      onPointerOut={() => interactive && setHover(null)}
      onClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        const hit = e.intersections.find((i) => i.object.name.startsWith('screen_'));
        if (hit && hotspots[hit.object.name]) onHotspotClick?.(hit.object.name);
      }}
    />
  );
}
