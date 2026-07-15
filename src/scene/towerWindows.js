/**
 * The Blender file gives the city towers their lit-window pattern through a
 * procedural emission node tree — which glTF cannot export. The exporter
 * collapses it to a flat white emissiveFactor, so every tower renders as a
 * glowing white slab (the "white void" bug).
 *
 * This patches mat_backdrop_tower with a world-space procedural window grid
 * injected into the standard material shader: facades get sparse warm/cool
 * lit windows, roofs stay dark. World-space so it needs no UVs (the towers
 * export with POSITION+NORMAL only).
 *
 * The real fix upstream is baking the emission to a texture in Blender; this
 * keeps the export usable as-is.
 */
export function applyTowerWindows(material) {
  if (material.userData.windowsPatched) return;
  material.userData.windowsPatched = true;

  // kill the exporter's flat white emissive — windows are added in-shader
  material.emissive.setRGB(0, 0, 0);
  material.emissiveIntensity = 1;

  // The export wrote metalness 0.9 / roughness 0.2 (irrelevant in Blender's
  // node setup, but honored here). With no environment map, that shiny metal
  // catches the key light as big white specular blobs that slide across the
  // facades as the camera moves. Facades should be matte — kill the specular.
  material.metalness = 0;
  material.roughness = 1;

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWinPos;
        varying vec3 vWinNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWinPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWinNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWinPos;
        varying vec3 vWinNormal;
        float winHash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 an = abs(vWinNormal);
          if (an.y < 0.6) { // facades only — roofs stay dark
            bool xFace = an.x > an.z;
            vec2 uvw = xFace ? vWinPos.zy : vWinPos.xy;
            vec2 cell = vec2(1.6, 2.2); // window pitch in meters
            vec2 id = floor(uvw / cell);
            vec2 f = fract(uvw / cell);
            // seed differs per facade plane so parallel walls don't repeat
            float plane = xFace ? vWinPos.x : vWinPos.z;
            vec2 seed = id + floor(plane * 4.0) * 0.13;
            // the pane occupies part of the cell; the rest is dark wall
            float pane = step(0.18, f.x) * step(f.x, 0.62) *
                         step(0.25, f.y) * step(f.y, 0.72);
            float lit = step(0.72, winHash(seed)); // ~28% of windows lit
            vec3 winCol = mix(
              vec3(1.0, 0.72, 0.42),  // warm interior
              vec3(0.65, 0.78, 1.0),  // cool fluorescent
              step(0.65, winHash(seed + 3.7))
            );
            float bright = 0.7 + 0.6 * winHash(seed + 9.1);
            totalEmissiveRadiance += winCol * pane * lit * bright * 1.4;
          }
        }`
      );
  };
  material.needsUpdate = true;
}
