import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The in-world chip shown once the camera has walked up to a hotspot:
 * the section label, an "Open" action for the panel, and a back action.
 * Positioned just below the screen's lower edge.
 */
export default function FocusAffordance({ meshName, hotspot, onOpen, onBack }) {
  const scene = useThree((s) => s.scene);

  const position = useMemo(() => {
    const mesh = scene.getObjectByName(meshName);
    if (!mesh) return null;
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const height = box.max.y - box.min.y;
    return [center.x, box.min.y - Math.min(0.18, height * 0.15), center.z];
  }, [scene, meshName]);

  if (!position || !hotspot) return null;

  return (
    <Html position={position} center>
      <div className="focus-chip">
        <span className="focus-chip-label">{hotspot.label}</span>
        <button className="focus-chip-open" onClick={onOpen}>
          Open
        </button>
        <button className="focus-chip-back" onClick={onBack} aria-label="Back to the street">
          ←
        </button>
      </div>
    </Html>
  );
}
