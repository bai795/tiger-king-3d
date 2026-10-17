import * as THREE from 'three';
import {
  createBackgroundTexture,
  createEnvironmentTexture,
  createConcreteTexture,
  createWallTexture,
  createPlatformMarkingsTexture,
  createGlowTexture,
  createDustTexture,
  createSmokeTexture,
  createCrateTexture,
} from './textures.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

function addMesh(parent, geometry, material, {
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
  sx = 1, sy = 1, sz = 1,
  cast = true, receive = true,
} = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, w, h, d, material, opts = {}) {
  return addMesh(parent, new THREE.BoxGeometry(w, h, d), material, opts);
}

function createShaftTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.16, 'rgba(255,255,255,0.28)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function createColumns(parent) {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: 0x171a17,
    roughness: 0.62,
    metalness: 0.64,
    envMapIntensity: 0.45,
  });
  const steelTrim = new THREE.MeshStandardMaterial({
    color: 0x36392f,
    roughness: 0.46,
    metalness: 0.74,
    envMapIntensity: 0.7,
  });
  const led = new THREE.MeshStandardMaterial({
    color: 0x5e4c31,
    emissive: 0xffb96b,
    emissiveIntensity: 2.4,
    roughness: 0.35,
    metalness: 0.35,
  });
  const glowTexture = createGlowTexture();
  const angles = [0, 60, 120, 180, 240, 300];
  const radius = 17.5;

  for (const deg of angles) {
    const a = THREE.MathUtils.degToRad(deg);
    const column = new THREE.Group();
    column.position.set(Math.sin(a) * radius, -0.16, Math.cos(a) * radius);
    column.rotation.y = a;

    addBox(column, 1.4, 0.35, 1.4, steel, { y: 0.18 });
    addBox(column, 1.0, 0.22, 1.0, steelTrim, { y: 0.45 });
    addBox(column, 0.62, 10.4, 0.62, steel, { y: 5.65 });
    addBox(column, 0.94, 0.2, 0.94, steelTrim, { y: 10.8 });
    addBox(column, 0.72, 0.07, 0.3, led, {
      y: 5.65,
      z: -0.32,
      cast: false,
      receive: false,
    });
    addBox(column, 1.45, 0.35, 0.86, steel, { y: 11.0, z: -0.1 });
    addBox(column, 1.15, 0.06, 0.55, led, {
      y: 10.81,
      z: -0.32,
      cast: false,
      receive: false,
    });

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffb76a,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.position.set(0, 11.0, -0.35);
    glow.scale.set(3.1, 2.1, 1);
    column.add(glow);

    // Faint haze shaft under the fixture.
    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 9.5, 24, 1, true),
      new THREE.MeshBasicMaterial({
        map: createShaftTexture(),
        color: 0xffc483,
        transparent: true,
        opacity: 0.04,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    shaft.position.set(0, 6.35, -0.25);
    shaft.renderOrder = -1;
    column.add(shaft);

    group.add(column);
  }
  parent.add(group);
  return group;
}

function createPlatform(parent) {
  const group = new THREE.Group();

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x22251f,
    roughness: 0.52,
    metalness: 0.5,
    envMapIntensity: 0.62,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x30332b,
    roughness: 0.72,
    metalness: 0.24,
    envMapIntensity: 0.42,
  });
  const darkTrim = new THREE.MeshStandardMaterial({
    color: 0x171914,
    roughness: 0.55,
    metalness: 0.65,
  });
  const warmTrim = new THREE.MeshStandardMaterial({
    color: 0x6e5732,
    roughness: 0.42,
    metalness: 0.78,
    emissive: 0x3a2410,
    emissiveIntensity: 0.4,
  });

  // Layered display drum.
  addMesh(group, new THREE.CylinderGeometry(8.65, 8.85, 0.18, 96), darkTrim, {
    y: -0.11,
    receive: true,
  });
  addMesh(group, new THREE.CylinderGeometry(8.25, 8.7, 0.24, 96), baseMat, {
    y: -0.02,
    receive: true,
  });
  addMesh(group, new THREE.CylinderGeometry(8.12, 8.24, 0.07, 96), topMat, {
    y: 0.17,
    receive: true,
  });

  // Rim rings.
  const rim1 = new THREE.TorusGeometry(8.23, 0.035, 8, 128);
  rim1.rotateX(Math.PI / 2);
  addMesh(group, rim1, warmTrim, { y: 0.205, cast: false });
  const rim2 = new THREE.TorusGeometry(8.48, 0.022, 6, 128);
  rim2.rotateX(Math.PI / 2);
  addMesh(group, rim2, darkTrim, { y: 0.09, cast: false });

  // 32 recessed bolts around the rim.
  const boltGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.035, 8);
  const bolts = new THREE.InstancedMesh(boltGeo, darkTrim, 32);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    m.makeRotationY(-a);
    m.setPosition(Math.sin(a) * 8.47, 0.19, Math.cos(a) * 8.47);
    bolts.setMatrixAt(i, m);
  }
  bolts.instanceMatrix.needsUpdate = true;
  bolts.castShadow = false;
  bolts.receiveShadow = true;
  group.add(bolts);

  // Technical markings, printed on the deck.
  const markingTex = createPlatformMarkingsTexture();
  const markingMat = new THREE.MeshBasicMaterial({
    map: markingTex,
    color: 0xd4c29a,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: true,
  });
  const markings = new THREE.Mesh(new THREE.CircleGeometry(8.1, 96), markingMat);
  markings.rotation.x = -Math.PI / 2;
  markings.rotation.z = -0.2;
  markings.position.y = 0.208;
  markings.receiveShadow = false;
  markings.renderOrder = 2;
  group.add(markings);

  // Physical inlay rings and graduations catch the spot lights and give the
  // deck a crafted, instrument-like quality.
  for (const radius of [2.35, 6.86]) {
    const ringGeometry = new THREE.TorusGeometry(radius, 0.013, 6, 160);
    ringGeometry.rotateX(Math.PI / 2);
    addMesh(group, ringGeometry, warmTrim, {
      y: 0.213, cast: false, receive: false,
    });
  }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const major = i % 6 === 0;
    addBox(group, major ? 0.07 : 0.035, 0.006, major ? 0.42 : 0.24, warmTrim, {
      x: Math.sin(a) * 7.18,
      y: 0.214,
      z: Math.cos(a) * 7.18,
      ry: a,
      cast: false,
      receive: false,
    });
  }

  // Small amber deck lights at the cardinal positions.
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x5a4427,
    emissive: 0xffb766,
    emissiveIntensity: 2.8,
    roughness: 0.3,
    metalness: 0.25,
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    addBox(group, 0.24, 0.018, 0.075, ledMat, {
      x: Math.sin(a) * 7.9,
      y: 0.218,
      z: Math.cos(a) * 7.9,
      ry: a,
      cast: false,
      receive: false,
    });
  }

  parent.add(group);
  return group;
}

function createContactShadow(parent) {
  const alpha = createGlowTexture(256);
  const geo = new THREE.PlaneGeometry(12.6, 6.2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x100f0b,
    alphaMap: alpha,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadow = new THREE.Mesh(geo, mat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.2, 0.2075, 1.1);
  shadow.renderOrder = 3;
  parent.add(shadow);
  return shadow;
}

function createHallWall(parent) {
  const group = new THREE.Group();
  const wallTexture = createWallTexture();
  // The far wall is a quiet matte backdrop; keeping it unlit by the scene
  // lights preserves its dark, graphic read from every orbit angle.
  const wallMat = new THREE.MeshBasicMaterial({
    map: wallTexture,
    color: 0xffffff,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x282b24,
    roughness: 0.68,
    metalness: 0.48,
    envMapIntensity: 0.32,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x10120f,
    roughness: 0.8,
    metalness: 0.3,
  });
  const led = new THREE.MeshStandardMaterial({
    color: 0x4b3c26,
    emissive: 0xffb766,
    emissiveIntensity: 1.25,
    roughness: 0.34,
    metalness: 0.2,
  });
  const wallRadius = 32.5;
  const wallHeight = 17;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(wallRadius, wallRadius, wallHeight, 96, 1, true),
    wallMat
  );
  wall.position.y = 8.2;
  group.add(wall);

  // A ribbed lower band and a cornice at the top help read the space as a
  // testing hall rather than an endless void.
  const lower = new THREE.Mesh(
    new THREE.CylinderGeometry(wallRadius - 0.08, wallRadius - 0.08, 1.55, 96, 1, true),
    steel
  );
  lower.material = steel.clone();
  lower.material.side = THREE.DoubleSide;
  lower.position.y = 0.58;
  group.add(lower);
  const upper = new THREE.Mesh(
    new THREE.CylinderGeometry(wallRadius - 0.1, wallRadius - 0.1, 0.55, 96, 1, true),
    steel
  );
  upper.material = steel.clone();
  upper.material.side = THREE.DoubleSide;
  upper.position.y = 16.2;
  group.add(upper);

  // Vertical structural ribs.
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.22, 14.7, 0.38), dark);
    rib.position.set(Math.sin(a) * (wallRadius - 0.18), 8.4, Math.cos(a) * (wallRadius - 0.18));
    rib.rotation.y = a;
    rib.castShadow = false;
    rib.receiveShadow = false;
    group.add(rib);
  }

  // Sparse vertical light seams give the far wall scale and depth.
  for (const deg of [24, 76, 148, 206, 284, 338]) {
    const a = THREE.MathUtils.degToRad(deg);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.6, 0.05), led);
    strip.position.set(
      Math.sin(a) * (wallRadius - 0.36),
      5.6,
      Math.cos(a) * (wallRadius - 0.36)
    );
    strip.rotation.y = a;
    strip.castShadow = false;
    strip.receiveShadow = false;
    group.add(strip);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: 0xffb15f,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.position.set(
      Math.sin(a) * (wallRadius - 0.5),
      5.7,
      Math.cos(a) * (wallRadius - 0.5)
    );
    glow.scale.set(2.2, 5.2, 1);
    group.add(glow);
  }

  // Broad wall washers add soft pools of warm light and break up the darkness
  // behind the vehicle from every orbit angle.
  const washTexture = createShaftTexture();
  const washAngles = [18, 82, 162, 218, 278, 338];
  for (const deg of washAngles) {
    const a = THREE.MathUtils.degToRad(deg);
    const washMat = new THREE.MeshBasicMaterial({
      map: washTexture,
      color: 0xe1a660,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 10.2), washMat);
    wash.position.set(
      Math.sin(a) * (wallRadius - 0.55),
      6.1,
      Math.cos(a) * (wallRadius - 0.55)
    );
    wash.rotation.y = a + Math.PI;
    wash.renderOrder = -1;
    group.add(wash);

    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.2), led);
    fixture.position.set(
      Math.sin(a) * (wallRadius - 0.45),
      11.45,
      Math.cos(a) * (wallRadius - 0.45)
    );
    fixture.rotation.y = a;
    group.add(fixture);
  }

  parent.add(group);
  return group;
}

function createLightShaft(parent) {
  const texture = createShaftTexture();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffd1a0,
    transparent: true,
    opacity: 0.05,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(5.4, 12.4, 40, 1, true), material);
  cone.position.set(1.6, 8.1, 4.5);
  cone.renderOrder = -1;
  parent.add(cone);
  return cone;
}

function createGround(parent) {
  const concrete = createConcreteTexture();
  concrete.repeat.set(60, 60);
  const mat = new THREE.MeshStandardMaterial({
    map: concrete,
    color: 0x858a7e,
    roughness: 0.92,
    metalness: 0.06,
    envMapIntensity: 0.2,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  parent.add(floor);

  // A huge, nearly invisible light pool around the display.
  const glow = createGlowTexture();
  const poolMat = new THREE.MeshBasicMaterial({
    map: glow,
    color: 0xa57b46,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -0.19;
  pool.renderOrder = -1;
  parent.add(pool);
  return floor;
}

function createCrate(parent) {
  const crateTexture = createCrateTexture();
  const woodMat = new THREE.MeshStandardMaterial({
    map: crateTexture,
    roughness: 0.82,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x2b2b25,
    roughness: 0.62,
    metalness: 0.55,
  });

  const group = new THREE.Group();
  group.position.set(-5.15, 0.21, 3.25);
  group.rotation.y = 0.32;

  const box = addBox(group, 0.92, 0.62, 0.68, woodMat, { y: 0.31 });
  // Metal corner straps.
  for (const x of [-0.42, 0.42]) {
    addBox(group, 0.045, 0.64, 0.7, trimMat, { x, y: 0.31, cast: false });
  }
  addBox(group, 0.98, 0.035, 0.73, trimMat, { y: 0.63, cast: false });
  // Rope handle.
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x6c6048, roughness: 0.95 });
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.015, 6, 18),
    ropeMat
  );
  rope.position.set(0.15, 0.66, 0.28);
  rope.rotation.x = Math.PI / 2;
  group.add(rope);

  parent.add(group);
  return group;
}

function createShellCasings(parent) {
  const brass = new THREE.MeshStandardMaterial({
    color: 0x9d7736,
    roughness: 0.32,
    metalness: 0.92,
    envMapIntensity: 1.25,
  });
  const soot = new THREE.MeshStandardMaterial({
    color: 0x1b1712,
    roughness: 0.85,
    metalness: 0.3,
  });

  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.077, 0.0),
    new THREE.Vector2(0.082, 0.045),
    new THREE.Vector2(0.071, 0.06),
    new THREE.Vector2(0.067, 0.55),
    new THREE.Vector2(0.061, 0.64),
    new THREE.Vector2(0.048, 0.7),
    new THREE.Vector2(0.045, 0.755),
    new THREE.Vector2(0.052, 0.77),
  ];
  const shellGeo = new THREE.LatheGeometry(profile, 20);
  // Empty case mouth.
  const mouthGeo = new THREE.CircleGeometry(0.043, 20);
  const group = new THREE.Group();
  group.position.set(4.65, 0.21, 2.75);

  const getGeo = (geo) => geo.clone();

  const c1 = addMesh(group, getGeo(shellGeo), brass, {
    x: -0.05, y: 0, z: 0.05, rz: 0.08, ry: 0.4,
  });
  const mouth1 = new THREE.Mesh(mouthGeo, soot);
  mouth1.rotation.x = -Math.PI / 2;
  mouth1.position.set(-0.02, 0.774, 0.08);
  mouth1.rotation.z = 0.08;
  group.add(mouth1);

  addMesh(group, getGeo(shellGeo), brass, {
    x: 0.62, y: 0.095, z: -0.16,
    rz: Math.PI / 2,
    ry: -0.8,
    cast: true,
  });
  addMesh(group, getGeo(shellGeo), brass, {
    x: 0.95, y: 0.075, z: -0.28,
    rz: Math.PI / 2 + 0.12,
    ry: 0.6,
    cast: true,
  });

  // A dark empty case lying apart.
  addMesh(group, getGeo(shellGeo), brass, {
    x: -0.55, y: 0.075, z: 0.35,
    rz: Math.PI / 2 - 0.18,
    ry: 1.1,
    cast: true,
  });

  parent.add(group);
  return group;
}

function createDust(parent) {
  const group = new THREE.Group();
  const count = 360;
  const positions = new Float32Array(count * 3);
  const seeds = [];
  const rnd = (() => {
    let a = 1234567;
    return () => {
      a = (a * 16807) % 2147483647;
      return (a - 1) / 2147483646;
    };
  })();

  for (let i = 0; i < count; i++) {
    const radius = 3 + rnd() * 11;
    const angle = rnd() * Math.PI * 2;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const y = 0.3 + rnd() * 7.5;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds.push({
      y,
      speed: 0.02 + rnd() * 0.09,
      phase: rnd() * Math.PI * 2,
      drift: 0.15 + rnd() * 0.55,
      x,
      z,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustTexture = createDustTexture();
  const material = new THREE.PointsMaterial({
    map: dustTexture,
    color: 0xe0cba4,
    size: 0.03,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 4;
  group.add(points);
  parent.add(group);

  return {
    group,
    update(elapsed) {
      const arr = geometry.getAttribute('position').array;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        let y = s.y + elapsed * s.speed;
        y = 0.3 + ((y - 0.3) % 7.8);
        arr[i * 3 + 1] = y;
        arr[i * 3] = s.x + Math.sin(elapsed * 0.09 * s.drift + s.phase) * 0.45;
        arr[i * 3 + 2] = s.z + Math.cos(elapsed * 0.07 * s.drift + s.phase) * 0.45;
      }
      geometry.getAttribute('position').needsUpdate = true;
    },
  };
}

function createHaze(parent) {
  const tex = createSmokeTexture();
  const group = new THREE.Group();
  const sprites = [];
  const defs = [
    [5.5, 1.0, 4.2, 23, 10, 0.035],
    [-7.0, 1.4, -3.5, 28, 11, 0.025],
    [1.5, 1.8, -8.0, 32, 12, 0.022],
    [-2.0, 0.8, 7.5, 20, 8, 0.025],
  ];
  for (const [x, y, z, sx, sy, opacity] of defs) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0x8d826b,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(sx, sy, 1);
    sprite.userData.baseX = x;
    sprite.userData.phase = Math.random() * Math.PI * 2;
    group.add(sprite);
    sprites.push(sprite);
  }
  parent.add(group);
  return {
    update(elapsed) {
      sprites.forEach((sprite, i) => {
        sprite.position.x = sprite.userData.baseX + Math.sin(elapsed * 0.025 + sprite.userData.phase) * (2 + i);
        sprite.material.opacity += 0;
      });
    },
  };
}

function createProps(parent) {
  const group = new THREE.Group();
  group.add(createCrate(group));
  group.add(createShellCasings(group));
  parent.add(group);

  // A pair of low work lamps just outside the display.
  const glowTexture = createGlowTexture();
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x222520,
    roughness: 0.6,
    metalness: 0.56,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x8c6e3f,
    emissive: 0xffb56a,
    emissiveIntensity: 3.0,
    roughness: 0.22,
    metalness: 0.25,
  });
  for (const [x, z, ry] of [[-9.7, -3.6, 0.7], [9.2, -5.1, -0.6]]) {
    const lamp = new THREE.Group();
    lamp.position.set(x, -0.18, z);
    lamp.rotation.y = ry;
    addBox(lamp, 0.34, 0.06, 0.34, standMat, { y: 0.03 });
    addMesh(lamp, new THREE.CylinderGeometry(0.055, 0.075, 2.0, 10), standMat, {
      y: 1.03,
    });
    addBox(lamp, 0.4, 0.28, 0.22, standMat, {
      y: 2.0,
      rx: -0.3,
    });
    addBox(lamp, 0.32, 0.16, 0.02, lensMat, {
      y: 2.02,
      z: 0.13,
      rx: -0.3,
      cast: false,
      receive: false,
    });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffb36b,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.position.set(0, 2.02, 0.18);
    glow.scale.set(1.8, 1.8, 1);
    lamp.add(glow);
    const light = new THREE.PointLight(0xffb578, 12, 10, 2);
    light.position.set(0, 1.9, 0.3);
    lamp.add(light);
    group.add(lamp);
  }
}

export function buildEnvironment(scene, renderer) {
  const root = new THREE.Group();
  root.name = 'display-hall';

  const background = createBackgroundTexture();
  const environment = createEnvironmentTexture();
  scene.background = background;
  scene.environment = environment;
  scene.environmentIntensity = 1.0;
  scene.fog = new THREE.FogExp2(0x090c09, 0.029);

  createGround(root);
  createHallWall(root);
  const platform = createPlatform(root);
  createContactShadow(root);
  createColumns(root);
  createLightShaft(root);
  createProps(root);
  const dust = createDust(root);
  const haze = createHaze(root);

  // Lighting rig: a lower, neutral key models the raw steel without blowing
  // out the upper surfaces, while cool fills read the sides and the running
  // gear in the dark hall.
  const hemi = new THREE.HemisphereLight(0xa9b5b7, 0x0a0c09, 1.0);
  const ambient = new THREE.AmbientLight(0x515955, 0.25);

  const key = new THREE.DirectionalLight(0xfff7ec, 2.1);
  key.position.set(7.0, 8.2, 8.5);
  key.target.position.set(0, 1.0, 0.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.00018;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 3;

  const rim = new THREE.DirectionalLight(0xa7cbd9, 2.3);
  rim.position.set(-9, 6, -9);
  rim.target.position.set(0, 1.6, -0.5);

  const fill = new THREE.DirectionalLight(0xb7c9ce, 1.35);
  fill.position.set(-6, 4.5, 10);
  fill.target.position.set(0, 1.2, 1.5);

  const overhead = new THREE.SpotLight(0xfff2df, 900, 40, 0.58, 0.95, 2);
  overhead.position.set(1.5, 15, 5);
  overhead.target.position.set(0, 0.3, 0.8);
  overhead.castShadow = false;

  const frontSpot = new THREE.SpotLight(0xffe6c9, 300, 32, 0.52, 0.95, 2);
  frontSpot.position.set(9.5, 6.5, 14.0);
  frontSpot.target.position.set(-0.4, 1.3, 1.5);
  frontSpot.castShadow = false;

  const backSpot = new THREE.SpotLight(0xffe2c4, 560, 30, 0.62, 0.9, 2);
  backSpot.position.set(-7.5, 4.7, -9.5);
  backSpot.target.position.set(0.4, 1.1, -1.4);
  backSpot.castShadow = false;

  const frontFill = new THREE.SpotLight(0xc3d3d8, 620, 30, 0.55, 1.0, 2);
  frontFill.position.set(-3.0, 4.2, 15.5);
  frontFill.target.position.set(0, 1.1, 2.2);
  frontFill.castShadow = false;

  // A soft warm bounce off the deck brings back the underside details.
  const deckBounce = new THREE.PointLight(0xffd9b0, 28, 7, 2);
  deckBounce.position.set(0, 0.55, 4.0);

  const frontBounce = new THREE.PointLight(0xc3d3d3, 32, 9, 2);
  frontBounce.position.set(0.2, 1.3, 9.5);

  scene.add(hemi, ambient, key, key.target, rim, rim.target, fill, fill.target,
    overhead, overhead.target, frontSpot, frontSpot.target, backSpot, backSpot.target,
    frontFill, frontFill.target, deckBounce, frontBounce);
  scene.add(root);

  const update = (elapsed, dt) => {
    dust.update(elapsed);
    haze.update(elapsed);
    // Barely perceptible lamp instability makes the hall feel inhabited.
    const flicker = Math.sin(elapsed * 2.1) * 0.012 + Math.sin(elapsed * 5.7 + 1.3) * 0.005;
    overhead.intensity = 900 * (1 + flicker);
    frontSpot.intensity = 300 * (1 + Math.sin(elapsed * 1.4 + 0.7) * 0.02);
    backSpot.intensity = 560 * (1 + Math.sin(elapsed * 0.9 + 2.1) * 0.018);
    frontFill.intensity = 620 * (1 + Math.sin(elapsed * 1.1 + 2.8) * 0.012);
  };

  return {
    root,
    platformTop: 0.21,
    update,
    lights: { hemi, ambient, key, rim, fill, overhead, frontSpot, backSpot, frontFill, deckBounce },
    dust,
  };
}

