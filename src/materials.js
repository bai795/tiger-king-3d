import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Bare-steel material system. No camouflage, no painted markings:      *
 * rolled hull plate, cast turret fittings, blued gun steel and         *
 * oxidized running gear.                                               *
 * ------------------------------------------------------------------ */

function linearTriplet(hex) {
  const color = new THREE.Color(hex).convertSRGBToLinear();
  return `vec3(${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)})`;
}

const NOISE_GLSL = /* glsl */`
float tkHash13(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float tkNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(tkHash13(i + vec3(0.0, 0.0, 0.0)), tkHash13(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(tkHash13(i + vec3(0.0, 1.0, 0.0)), tkHash13(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(tkHash13(i + vec3(0.0, 0.0, 1.0)), tkHash13(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(tkHash13(i + vec3(0.0, 1.0, 1.0)), tkHash13(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float tkFbm(vec3 p) {
  float total = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    total += tkNoise(p) * amp;
    p = p * 2.03 + vec3(11.7, 5.3, 7.1);
    amp *= 0.5;
  }
  return total / 0.875;
}
`;

/**
 * Procedural steel finish. The color is not a paint layer: it is the
 * base reflectance of the metal, gently modulated by scale, cast/rolled
 * texture, microscopic pitting, oil staining and edge-polish variation.
 */
function createSteelMaterial({
  base = 0x838a8c,
  oxidation = 0x3e4444,
  polish = 0xb5bbbb,
  roughness = 0.5,
  metalness = 0.8,
  cast = false,
  envMapIntensity = 1.05,
  dirt = 0.18,
  key = 'steel',
} = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness,
    envMapIntensity,
    dithering: true,
  });

  const C_BASE = linearTriplet(base);
  const C_OXIDE = linearTriplet(oxidation);
  const C_POLISH = linearTriplet(polish);
  const castFlag = cast ? 1.0 : 0.0;
  const dirtAmount = dirt.toFixed(2);

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vSteelWorld;\nvarying vec3 vSteelNormal;'
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSteelWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vSteelNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSteelWorld;
        varying vec3 vSteelNormal;
        ${NOISE_GLSL}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float steelBroad = tkFbm(vSteelWorld * 1.35 + vec3(2.7, 5.1, 1.3));
        float steelFine = tkNoise(vSteelWorld * 13.0 + vec3(4.0, 2.0, 9.0));
        float steelPit = tkNoise(vSteelWorld * 51.0 + 7.0);
        float steelStreak = tkNoise(vec3(vSteelWorld.x * 4.0, vSteelWorld.y * 0.32, vSteelWorld.z * 4.0));

        vec3 steelCol = ${C_BASE} * (0.83 + steelBroad * 0.20 + steelFine * 0.055);
        float low = 1.0 - smoothstep(0.28, 1.55, vSteelWorld.y);
        float oxide = smoothstep(0.54, 0.82, steelBroad) * (0.22 + low * 0.78);
        steelCol = mix(steelCol, ${C_OXIDE}, oxide * 0.30 * float(${dirtAmount}));
        steelCol = mix(steelCol, ${C_OXIDE}, low * 0.10);

        // Subtle vertical oil/water streaks, stronger low on the hull.
        float streak = smoothstep(0.57, 0.83, steelStreak) * low;
        steelCol *= 1.0 - streak * 0.16;

        // Polished micro-edges and tiny handling marks.
        float polishMask = smoothstep(0.88, 0.975, steelFine) * (0.3 + low * 0.25);
        steelCol = mix(steelCol, ${C_POLISH}, polishMask * 0.17);
        float scratch = smoothstep(0.905, 0.98, tkNoise(vec3(vSteelWorld.x * 34.0, vSteelWorld.y * 2.8, vSteelWorld.z * 34.0)));
        steelCol = mix(steelCol, ${C_POLISH}, scratch * 0.19);

        // Cast surfaces get a very subtle darker, less even reflective tone.
        steelCol *= 1.0 - float(${castFlag}) * 0.035;

        diffuseColor.rgb = steelCol;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float steelRough = tkNoise(vSteelWorld * 5.7 + 3.0);
        float steelRough2 = tkNoise(vSteelWorld * 29.0);
        float castMod = float(${castFlag}) * 0.06;
        roughnessFactor = clamp(
          roughnessFactor + (steelRough - 0.5) * 0.14 + (steelRough2 - 0.5) * 0.035 + castMod,
          0.20,
          0.96
        );`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float steelN1 = tkNoise(vSteelWorld * 27.0 + 1.0);
        float steelN2 = tkNoise(vSteelWorld * 63.0 + 8.0);
        float castBump = float(${castFlag}) * 0.032;
        normal = normalize(normal + vec3((steelN2 - 0.5) * 0.034, (steelN1 - 0.5) * 0.026 + castBump * (steelN2 - 0.5), 0.0));`
      );
  };
  material.customProgramCacheKey = () => `tiger-ii-steel-${key}-v1`;

  return material;
}

function createStandardMetal({
  color = 0x737a7c,
  roughness = 0.5,
  metalness = 0.8,
  envMapIntensity = 1,
  key = 'metal',
} = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    envMapIntensity,
    dithering: true,
  });
}

export function createTankMaterials() {
  const hullSteel = createSteelMaterial({
    base: 0x858c8d,
    oxidation: 0x454b4b,
    polish: 0xbec3c2,
    roughness: 0.57,
    metalness: 0.62,
    cast: false,
    envMapIntensity: 0.95,
    dirt: 0.16,
    key: 'hull',
  });

  const turretSteel = createSteelMaterial({
    base: 0x7e8586,
    oxidation: 0x3f4546,
    polish: 0xb7bdbc,
    roughness: 0.6,
    metalness: 0.6,
    cast: false,
    envMapIntensity: 0.9,
    dirt: 0.14,
    key: 'turret',
  });

  const castSteel = createSteelMaterial({
    base: 0x767d7e,
    oxidation: 0x383e3f,
    polish: 0xaeb5b5,
    roughness: 0.65,
    metalness: 0.57,
    cast: true,
    envMapIntensity: 0.82,
    dirt: 0.12,
    key: 'cast',
  });

  const mantleSteel = createSteelMaterial({
    base: 0x707778,
    oxidation: 0x373d3e,
    polish: 0xaeb5b5,
    roughness: 0.67,
    metalness: 0.55,
    cast: true,
    envMapIntensity: 0.8,
    dirt: 0.1,
    key: 'mantlet',
  });

  const weldSteel = new THREE.MeshStandardMaterial({
    color: 0x596061,
    roughness: 0.68,
    metalness: 0.62,
    envMapIntensity: 0.7,
  });

  const brightSteel = createStandardMetal({
    color: 0x757c7c,
    roughness: 0.52,
    metalness: 0.55,
    envMapIntensity: 0.72,
    key: 'bright',
  });

  const darkSteel = createStandardMetal({
    color: 0x3a4041,
    roughness: 0.66,
    metalness: 0.58,
    envMapIntensity: 0.55,
    key: 'dark',
  });

  const blackSteel = createStandardMetal({
    color: 0x1d2122,
    roughness: 0.64,
    metalness: 0.5,
    envMapIntensity: 0.35,
    key: 'black',
  });

  const gunSteel = createStandardMetal({
    color: 0x474d4f,
    roughness: 0.42,
    metalness: 0.8,
    envMapIntensity: 0.9,
    key: 'gun',
  });

  const muzzleSteel = createStandardMetal({
    color: 0x3f4444,
    roughness: 0.64,
    metalness: 0.52,
    envMapIntensity: 0.45,
    key: 'muzzle',
  });

  const heatSteel = createStandardMetal({
    color: 0x4b4740,
    roughness: 0.78,
    metalness: 0.45,
    envMapIntensity: 0.35,
    key: 'heat',
  });

  const trackSteel = createStandardMetal({
    color: 0x333738,
    roughness: 0.8,
    metalness: 0.42,
    envMapIntensity: 0.3,
    key: 'track',
  });

  const trackShoe = createStandardMetal({
    color: 0x3d4241,
    roughness: 0.74,
    metalness: 0.52,
    envMapIntensity: 0.38,
    key: 'track-shoe',
  });

  const wheelFace = createStandardMetal({
    color: 0x575e5f,
    roughness: 0.7,
    metalness: 0.45,
    envMapIntensity: 0.4,
    key: 'wheel-face',
  });

  const wheelRim = createStandardMetal({
    color: 0x3d4243,
    roughness: 0.74,
    metalness: 0.52,
    envMapIntensity: 0.35,
    key: 'wheel-rim',
  });

  const wheelDark = createStandardMetal({
    color: 0x262a2b,
    roughness: 0.82,
    metalness: 0.4,
    envMapIntensity: 0.25,
    key: 'wheel-dark',
  });

  const hubSteel = createStandardMetal({
    color: 0x4d5454,
    roughness: 0.58,
    metalness: 0.6,
    envMapIntensity: 0.6,
    key: 'hub',
  });

  const towCable = createStandardMetal({
    color: 0x444a49,
    roughness: 0.74,
    metalness: 0.52,
    envMapIntensity: 0.4,
    key: 'cable',
  });

  const exhaustSteel = createStandardMetal({
    color: 0x161716,
    roughness: 0.95,
    metalness: 0.28,
    envMapIntensity: 0.08,
    key: 'exhaust',
  });

  const soot = new THREE.MeshStandardMaterial({
    color: 0x111313,
    roughness: 0.92,
    metalness: 0.3,
    envMapIntensity: 0.2,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x1b1e1e,
    roughness: 0.94,
    metalness: 0.04,
  });

  const wood = new THREE.MeshStandardMaterial({
    color: 0x443121,
    roughness: 0.9,
    metalness: 0.02,
  });

  const optic = new THREE.MeshPhysicalMaterial({
    color: 0x111918,
    roughness: 0.08,
    metalness: 0.4,
    envMapIntensity: 1.5,
    transparent: false,
  });

  const lensGlass = new THREE.MeshPhysicalMaterial({
    color: 0x737a6c,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.72,
    envMapIntensity: 1.3,
  });

  const interior = new THREE.MeshStandardMaterial({
    color: 0x171a1a,
    roughness: 0.9,
    metalness: 0.25,
  });

  return {
    hullSteel,
    turretSteel,
    castSteel,
    mantleSteel,
    weldSteel,
    brightSteel,
    darkSteel,
    blackSteel,
    gunSteel,
    muzzleSteel,
    heatSteel,
    trackSteel,
    trackShoe,
    wheelFace,
    wheelRim,
    wheelDark,
    hubSteel,
    towCable,
    exhaustSteel,
    soot,
    rubber,
    wood,
    optic,
    lensGlass,
    interior,
    // Kept as a convenience alias for small fittings.
    steel: darkSteel,
  };
}

