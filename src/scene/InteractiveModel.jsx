import React, { useEffect, useMemo, useRef } from 'react';
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
        // glTF export flattens the towers' procedural window emission to
        // flat white; swap in the in-shader window grid instead
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat?.name === 'mat_backdrop_tower') applyTowerWindows(mat);
          // glTF transmission (refractive glass) renders as an opaque white
          // blob inside an EffectComposer; use plain transparency instead.
          if (mat && mat.transmission > 0 && !mat.userData.glassPatched) {
            mat.userData.glassPatched = true;
            mat.transmission = 0;
            mat.transparent = true;
            mat.opacity = 0.24;
            mat.depthWrite = false;
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
