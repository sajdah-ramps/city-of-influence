import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Times Square night sky: an inverted gradient sphere rendered behind
 * everything. Reads as NIGHT — near-black indigo overhead, deep indigo down
 * the dome, a narrow dusty-violet band above the horizon and a faint
 * burnt-orange line right at it (city glow remnant, not a sunset). Below the
 * horizon it goes dark — never orange. Ignores fog.
 *
 * NOTE: every smoothstep uses INCREASING edges — decreasing edges are
 * undefined behavior in GLSL and render white/garbage on some GPUs.
 * The output is always a mix() of the four palette colors, so it can never
 * exceed them; the brightest (#40200f, ~0.25) sits far below the 0.75 bloom
 * threshold — if the sky ever glows, the shader output is wrong, not bloom.
 */
const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vWorldPosition;

  const vec3 TOP    = vec3(0.020, 0.020, 0.059); // #05050f near-black indigo
  const vec3 INDIGO = vec3(0.039, 0.039, 0.110); // #0a0a1c deep indigo
  const vec3 VIOLET = vec3(0.118, 0.059, 0.176); // #1e0f2d dusty violet
  const vec3 ORANGE = vec3(0.251, 0.125, 0.059); // #40200f burnt orange

  void main() {
    float y = normalize(vWorldPosition).y; // -1 nadir .. +1 zenith

    // y > 0.25: deep indigo darkening to near-black at the zenith
    vec3 col = mix(INDIGO, TOP, smoothstep(0.25, 0.9, y));

    // 0.05 .. 0.25: blend down into the dusty-violet band
    col = mix(VIOLET, col, smoothstep(0.05, 0.25, y));

    // -0.02 .. 0.05: narrow blend to the burnt-orange horizon line
    col = mix(ORANGE, col, smoothstep(-0.02, 0.05, y));

    // below -0.02: dark, never orange (feathered so there's no hard ring)
    col = mix(TOP, col, smoothstep(-0.05, -0.02, y));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function TwilightSky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    []
  );

  return (
    <mesh renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
