import * as THREE from 'three';

const TAU = Math.PI * 2;
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------ *
 * Geometry helpers                                                     *
 * ------------------------------------------------------------------ */

function addMesh(parent, geometry, material, {
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
  sx = 1, sy = 1, sz = 1,
  cast = true, receive = true,
  renderOrder = 0,
} = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.renderOrder = renderOrder;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, w, h, d, material, opts = {}) {
  return addMesh(parent, new THREE.BoxGeometry(w, h, d), material, opts);
}

function addCylinder(parent, rt, rb, height, segments, material, opts = {}) {
  return addMesh(parent, new THREE.CylinderGeometry(rt, rb, height, segments), material, opts);
}

function addCylinderZ(parent, radius, length, segments, material, opts = {}) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, false);
  geometry.rotateX(Math.PI / 2);
  return addMesh(parent, geometry, material, opts);
}

function addCylinderX(parent, radius, length, segments, material, opts = {}) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, false);
  geometry.rotateZ(Math.PI / 2);
  return addMesh(parent, geometry, material, opts);
}

function addTorus(parent, radius, tube, material, opts = {}) {
  return addMesh(parent, new THREE.TorusGeometry(radius, tube, 8, 30), material, opts);
}

function addTube(parent, points, radius, material, {
  tubularSegments = 30,
  radialSegments = 6,
  closed = false,
  cast = true,
  receive = true,
} = {}) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => (Array.isArray(p) ? V(p[0], p[1], p[2]) : p)),
    closed,
    'centripetal',
    0.25
  );
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
  return addMesh(parent, geometry, material, { cast, receive });
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function extrudeRoundedBoxGeometry(w, h, depth, radius = 0.08, bevel = 0.02) {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(w, h, radius), {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createPrismGeometry(profile, width, bevel = 0.02) {
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 2,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedPlateGeometry(width, length, thickness, radius = 0.07) {
  const shape = roundedRectShape(width, length, radius);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.004,
    curveSegments: 8,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addUHandle(parent, center, width, height, radius, material, {
  orientation = 'x', cast = true,
} = {}) {
  const [x, y, z] = center;
  let pts;
  if (orientation === 'x') {
    pts = [
      V(x - width / 2, y, z),
      V(x - width / 2, y + height, z),
      V(x + width / 2, y + height, z),
      V(x + width / 2, y, z),
    ];
  } else {
    pts = [
      V(x, y, z - width / 2),
      V(x, y + height, z - width / 2),
      V(x, y + height, z + width / 2),
      V(x, y, z + width / 2),
    ];
  }
  return addTube(parent, pts, radius, material, {
    tubularSegments: 12,
    radialSegments: 5,
    cast,
  });
}

function createFaceWithHoles(radius, holeRadius, holeCount, thickness) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, TAU, false);
  const holeRing = radius * 0.66;
  for (let i = 0; i < holeCount; i++) {
    const a = (i / holeCount) * TAU;
    const hole = new THREE.Path();
    hole.absarc(Math.cos(a) * holeRing, Math.sin(a) * holeRing, holeRadius, 0, TAU, true);
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.005,
    bevelThickness: 0.003,
    curveSegments: 20,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateY(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function sideQuaternion(side, tilt = 0) {
  // Local +Z points out of the tank side; local +Y is up.
  const normal = V(side * Math.cos(tilt), Math.sin(tilt), 0).normalize();
  const up = V(-side * Math.sin(tilt), Math.cos(tilt), 0).normalize();
  const across = new THREE.Vector3().crossVectors(up, normal).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(across, up, normal)
  );
}

function addSidePlate(parent, {
  side = 1, x = 0, y = 0, z = 0, w = 0.5, h = 0.5, thickness = 0.035, tilt = 0.1, material,
}) {
  const geometry = extrudeRoundedBoxGeometry(w, h, thickness, 0.055, 0.008);
  // The rounded box faces +Z locally. Re-orient so its face is the tank side.
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.quaternion.copy(sideQuaternion(side, tilt));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ *
 * Running gear                                                         *
 * ------------------------------------------------------------------ */

function createTrackCurve() {
  // Centreline of the track loop in (z, y), with 800 mm links.
  const points = [
    [2.85, 1.03],
    [2.15, 1.02],
    [1.1, 1.01],
    [0.0, 1.00],
    [-1.2, 1.01],
    [-2.2, 1.02],
    [-2.82, 1.00],
    [-3.14, 0.91],
    [-3.35, 0.74],
    [-3.38, 0.53],
    [-3.24, 0.31],
    [-2.96, 0.14],
    [-2.52, 0.075],
    [-1.4, 0.06],
    [0.0, 0.055],
    [1.4, 0.06],
    [2.43, 0.075],
    [2.87, 0.14],
    [3.16, 0.31],
    [3.31, 0.52],
    [3.29, 0.74],
    [3.10, 0.94],
    [2.96, 1.01],
  ];
  return new THREE.CatmullRomCurve3(
    points.map(([z, y]) => V(z, y, 0)),
    true,
    'centripetal',
    0.3
  );
}

function buildTrackLinks(curve, side, materials) {
  const group = new THREE.Group();
  const centerX = side * 1.48;
  const length = curve.getLength();
  const count = Math.max(64, Math.round(length / 0.212));
  const padLength = 0.172;
  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  const color = new THREE.Color();

  const padGeo = new THREE.BoxGeometry(0.8, 0.03, padLength);
  const grouserGeo = new THREE.BoxGeometry(0.76, 0.023, 0.044);
  const hornGeo = new THREE.BoxGeometry(0.12, 0.09, 0.05);

  const pinGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.815, 8);
  pinGeo.rotateZ(Math.PI / 2);

  const pads = new THREE.InstancedMesh(padGeo, materials.trackSteel, count);
  const grousers = new THREE.InstancedMesh(grouserGeo, materials.trackShoe, count * 2);
  const horns = new THREE.InstancedMesh(hornGeo, materials.darkSteel, count);
  const pins = new THREE.InstancedMesh(pinGeo, materials.hubSteel, count);
  pads.castShadow = true;
  pads.receiveShadow = true;
  grousers.castShadow = true;
  grousers.receiveShadow = true;
  horns.castShadow = true;
  horns.receiveShadow = true;
  pins.castShadow = false;
  pins.receiveShadow = true;

  const outward = (tangent, point) => {
    let nx = tangent.y;
    let ny = -tangent.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const away = new THREE.Vector2(point.x, point.y - 0.56);
    if (nx * away.x + ny * away.y < 0) {
      nx *= -1;
      ny *= -1;
    }
    return [nx, ny];
  };

  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const point = curve.getPointAt(u);
    tan.copy(curve.getTangentAt(u));
    const [nz, ny] = outward(tan, point);
    yAxis.set(0, ny, nz).normalize();
    zAxis.set(0, tan.y, tan.x).normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    pos.set(centerX, point.y, point.x);
    matrix.makeBasis(xAxis, yAxis, zAxis);

    const setPart = (mesh, index, offsetX, offsetY, offsetZ) => {
      const p = pos.clone()
        .addScaledVector(xAxis, offsetX)
        .addScaledVector(yAxis, offsetY)
        .addScaledVector(zAxis, offsetZ);
      matrix.setPosition(p);
      mesh.setMatrixAt(index, matrix);
      return mesh;
    };

    setPart(pads, i, 0, 0.018, 0);
    const shade = 0.82 + ((i * 29) % 13) / 52;
    color.setRGB(shade, shade, shade);
    pads.setColorAt(i, color);

    setPart(grousers, i * 2, 0, 0.043, -0.048);
    setPart(grousers, i * 2 + 1, 0, 0.043, 0.048);
    color.setRGB(shade * 0.96, shade * 0.96, shade * 0.94);
    grousers.setColorAt(i * 2, color);
    grousers.setColorAt(i * 2 + 1, color);

    setPart(horns, i, 0, -0.052, 0);
    setPart(pins, i, 0, 0.0, -padLength * 0.5);
  }

  for (const mesh of [pads, grousers, horns, pins]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}

function buildWheels(materials) {
  const group = new THREE.Group();
  const specs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      specs.push({
        side,
        x: side * 1.56,
        y: 0.555,
        z: -2.56 + i * 0.64,
        radius: 0.445,
        width: 0.285,
      });
    }
    for (let i = 0; i < 9; i++) {
      specs.push({
        side,
        x: side * 1.31,
        y: 0.555,
        z: -2.88 + i * 0.64,
        radius: 0.43,
        width: 0.255,
      });
    }
  }

  const N = specs.length;
  const cylinderX = new THREE.CylinderGeometry(1, 1, 1, 32);
  cylinderX.rotateZ(Math.PI / 2);
  const outerBandGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
  outerBandGeo.rotateZ(Math.PI / 2);
  const faceGeo = createFaceWithHoles(0.404, 0.052, 8, 0.032);
  const lipGeo = new THREE.TorusGeometry(1, 0.04, 6, 30);
  lipGeo.rotateY(Math.PI / 2);
  const boltGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  boltGeo.rotateZ(Math.PI / 2);

  const faceMesh = new THREE.InstancedMesh(faceGeo, materials.wheelFace, N);
  const bandMesh = new THREE.InstancedMesh(outerBandGeo, materials.wheelRim, N);
  const backingMesh = new THREE.InstancedMesh(cylinderX, materials.wheelDark, N);
  const lipMesh = new THREE.InstancedMesh(lipGeo, materials.hubSteel, N);
  const hubMesh = new THREE.InstancedMesh(cylinderX, materials.hubSteel, N);
  const boltMesh = new THREE.InstancedMesh(boltGeo, materials.brightSteel, N * 8);
  const axleMesh = new THREE.InstancedMesh(cylinderX, materials.darkSteel, N);

  for (const mesh of [faceMesh, bandMesh, backingMesh, lipMesh, hubMesh, axleMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  boltMesh.castShadow = false;
  boltMesh.receiveShadow = true;

  const m = new THREE.Matrix4();
  const qId = new THREE.Quaternion();
  const qFlip = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const color = new THREE.Color();
  let boltIndex = 0;

  specs.forEach((wheel, i) => {
    const { side, x, y, z, radius, width } = wheel;
    const faceX = x + side * (width / 2 + 0.002);
    p.set(x, y, z);

    // Dark outer band of the wheel.
    s.set(width, radius, radius);
    m.compose(p, qId, s);
    bandMesh.setMatrixAt(i, m);

    // Recessed steel centre, seen through the lightening holes.
    s.set(width * 0.92, radius * 0.86, radius * 0.86);
    m.compose(p, qId, s);
    backingMesh.setMatrixAt(i, m);
    color.setRGB(0.72 + ((i * 7) % 5) * 0.035, 0.73 + ((i * 3) % 4) * 0.035, 0.73);
    backingMesh.setColorAt(i, color);

    // Perforated face plate on the outboard side.
    p.set(faceX, y, z);
    m.compose(p, side === 1 ? qId : qFlip, V(1, 1, 1));
    faceMesh.setMatrixAt(i, m);
    color.setRGB(0.92 - ((i * 11) % 7) * 0.018, 0.92 - ((i * 13) % 6) * 0.016, 0.91);
    faceMesh.setColorAt(i, color);

    // Raised rim bead around the face.
    p.set(faceX + side * 0.003, y, z);
    s.set(1, radius * 0.845, radius * 0.845);
    m.compose(p, qId, s);
    lipMesh.setMatrixAt(i, m);
    color.setRGB(0.88, 0.9, 0.89);
    lipMesh.setColorAt(i, color);

    // Hub and eight bolt heads.
    p.set(faceX + side * 0.035, y, z);
    s.set(0.08, radius * 0.19, radius * 0.19);
    m.compose(p, qId, s);
    hubMesh.setMatrixAt(i, m);

    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * TAU + 0.19;
      p.set(
        faceX + side * 0.026,
        y + Math.cos(a) * radius * 0.36,
        z + Math.sin(a) * radius * 0.36
      );
      s.set(0.028, 0.024, 0.024);
      m.compose(p, qId, s);
      boltMesh.setMatrixAt(boltIndex++, m);
    }

    // Coarse final-drive / axle arm into the wheel.
    const innerX = side * 0.98;
    const outerX = x - side * width * 0.15;
    p.set((innerX + outerX) / 2, y, z);
    s.set(Math.abs(outerX - innerX), 0.045, 0.045);
    m.compose(p, qId, s);
    axleMesh.setMatrixAt(i, m);
  });

  for (const mesh of [faceMesh, bandMesh, backingMesh, lipMesh, hubMesh, boltMesh, axleMesh]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}

function createDishedWheelGeometry() {
  // Closed lathe profile in (radius, axial) space. The recessed centre disc
  // and raised outer rim are the familiar Tiger II steel road-wheel dish.
  const profile = [
    [0.001, 0.12], [0.055, 0.118], [0.085, 0.105], [0.115, 0.085],
    [0.17, 0.07], [0.255, 0.052], [0.31, 0.045], [0.345, 0.052],
    [0.375, 0.06], [0.4, 0.052], [0.422, 0.032], [0.44, 0.01],
    [0.45, -0.03], [0.448, -0.07], [0.43, -0.105], [0.39, -0.12],
    [0.13, -0.12], [0.001, -0.12], [0.001, 0.12],
  ].map(([r, a]) => new THREE.Vector2(r, a));
  const geometry = new THREE.LatheGeometry(profile, 40);
  geometry.rotateZ(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function buildWheelsDished(materials) {
  const group = new THREE.Group();
  const specs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      specs.push({
        side,
        x: side * 1.55,
        y: 0.555,
        z: -2.56 + i * 0.64,
      });
    }
    for (let i = 0; i < 9; i++) {
      specs.push({
        side,
        x: side * 1.30,
        y: 0.555,
        z: -2.88 + i * 0.64,
      });
    }
  }

  const N = specs.length;
  const wheelGeo = createDishedWheelGeometry();
  const rimGeo = new THREE.TorusGeometry(1, 0.028, 6, 32);
  rimGeo.rotateY(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
  hubGeo.rotateZ(Math.PI / 2);
  const boltGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  boltGeo.rotateZ(Math.PI / 2);
  const axleGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  axleGeo.rotateZ(Math.PI / 2);
  const dishRingGeo = new THREE.TorusGeometry(1, 0.021, 6, 30);
  dishRingGeo.rotateY(Math.PI / 2);

  const wheelMesh = new THREE.InstancedMesh(wheelGeo, materials.wheelFace, N);
  const rimMesh = new THREE.InstancedMesh(rimGeo, materials.wheelRim, N);
  const dishRingMesh = new THREE.InstancedMesh(dishRingGeo, materials.wheelDark, N);
  const hubMesh = new THREE.InstancedMesh(hubGeo, materials.hubSteel, N);
  const boltMesh = new THREE.InstancedMesh(boltGeo, materials.brightSteel, N * 8);
  const axleMesh = new THREE.InstancedMesh(axleGeo, materials.darkSteel, N);
  for (const mesh of [wheelMesh, rimMesh, dishRingMesh, hubMesh, axleMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  boltMesh.castShadow = false;
  boltMesh.receiveShadow = true;

  const m = new THREE.Matrix4();
  const qId = new THREE.Quaternion();
  const qFlip = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const color = new THREE.Color();
  let boltIndex = 0;

  specs.forEach((wheel, i) => {
    const { side, x, y, z } = wheel;
    const faceX = x + side * 0.12;
    const q = side === 1 ? qId : qFlip;
    p.set(x, y, z);
    m.compose(p, q, V(1, 1, 1));
    wheelMesh.setMatrixAt(i, m);
    const shade = 0.9 + ((i * 17) % 9) * 0.018;
    color.setRGB(shade, shade, shade * 0.98);
    wheelMesh.setColorAt(i, color);

    // Raised rim lip.
    p.set(x + side * 0.07, y, z);
    s.set(1, 0.405, 0.405);
    m.compose(p, qId, s);
    rimMesh.setMatrixAt(i, m);

    // Dark recessed ring around the hub, giving the dish readable depth.
    p.set(faceX + side * 0.003, y, z);
    s.set(1, 0.255, 0.255);
    m.compose(p, qId, s);
    dishRingMesh.setMatrixAt(i, m);

    // Hub cap.
    p.set(faceX + side * 0.02, y, z);
    s.set(0.07, 0.08, 0.08);
    m.compose(p, qId, s);
    hubMesh.setMatrixAt(i, m);

    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * TAU + 0.19;
      p.set(
        faceX + side * 0.005,
        y + Math.cos(a) * 0.19,
        z + Math.sin(a) * 0.19
      );
      s.set(0.026, 0.017, 0.017);
      m.compose(p, qId, s);
      boltMesh.setMatrixAt(boltIndex++, m);
    }

    const innerX = side * 0.97;
    const outerX = x - side * 0.055;
    p.set((innerX + outerX) / 2, y, z);
    s.set(Math.abs(outerX - innerX), 0.042, 0.042);
    m.compose(p, qId, s);
    axleMesh.setMatrixAt(i, m);
  });

  for (const mesh of [wheelMesh, rimMesh, dishRingMesh, hubMesh, boltMesh, axleMesh]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}

function buildSprocket(side, materials) {
  const group = new THREE.Group();
  group.position.set(side * 1.48, 0.675, 2.95);
  const q = side === 1 ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);

  const body = new THREE.CylinderGeometry(0.28, 0.28, 0.17, 28);
  body.rotateZ(Math.PI / 2);
  addMesh(group, body, materials.darkSteel);
  const face = createFaceWithHoles(0.32, 0.045, 6, 0.03);
  const faceMesh = new THREE.Mesh(face, materials.wheelFace);
  faceMesh.position.x = side * 0.091;
  faceMesh.quaternion.copy(q);
  faceMesh.castShadow = true;
  faceMesh.receiveShadow = true;
  group.add(faceMesh);
  addCylinderX(group, 0.105, 0.24, 16, materials.hubSteel, {
    x: side * 0.14,
  });
  addTorus(group, 0.332, 0.022, materials.brightSteel, {
    x: side * 0.095,
    ry: Math.PI / 2,
    cast: false,
  });

  const toothGeo = new THREE.BoxGeometry(0.22, 0.14, 0.1);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    addMesh(group, toothGeo, materials.darkSteel, {
      y: Math.cos(a) * 0.43,
      z: Math.sin(a) * 0.43,
      rx: a,
    });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    addBox(group, 0.07, 0.065, 0.48, materials.steel, {
      x: side * 0.085,
      y: Math.cos(a) * 0.09,
      z: Math.sin(a) * 0.09,
      rx: a,
      cast: false,
    });
  }
  return group;
}

function buildIdler(side, materials) {
  const group = new THREE.Group();
  group.position.set(side * 1.48, 0.625, -3.075);
  const q = side === 1 ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);
  const band = new THREE.CylinderGeometry(0.425, 0.425, 0.18, 30, 1, true);
  band.rotateZ(Math.PI / 2);
  addMesh(group, band, materials.wheelRim);
  const disc = new THREE.CylinderGeometry(0.39, 0.39, 0.15, 30);
  disc.rotateZ(Math.PI / 2);
  addMesh(group, disc, materials.wheelDark);
  const face = new THREE.Mesh(createFaceWithHoles(0.345, 0.052, 6, 0.03), materials.wheelFace);
  face.position.x = side * 0.095;
  face.quaternion.copy(q);
  face.castShadow = true;
  face.receiveShadow = true;
  group.add(face);
  addCylinderX(group, 0.1, 0.24, 16, materials.hubSteel, { x: side * 0.14 });
  addTorus(group, 0.36, 0.022, materials.brightSteel, {
    x: side * 0.1,
    ry: Math.PI / 2,
    cast: false,
  });
  // Tension adjuster on the rear face.
  addBox(group, 0.09, 0.22, 0.09, materials.darkSteel, {
    x: side * 0.13, y: -0.28, z: -0.28, cast: false,
  });
  return group;
}

function buildFenders(materials) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const x = side * 1.49;
    const plate = createRoundedPlateGeometry(0.84, 7.0, 0.032, 0.16);
    addMesh(group, plate, materials.hullSteel, {
      x, y: 1.18, z: -0.04,
      cast: true,
    });

    // Down-turned outer lip.
    addBox(group, 0.12, 0.032, 6.9, materials.hullSteel, {
      x: side * 1.86, y: 1.157, z: -0.04,
      rz: side * -0.3,
      cast: true,
    });

    // Longitudinal stiffening ribs stamped into the fender.
    for (const rx of [1.29, 1.69]) {
      addBox(group, 0.035, 0.012, 6.55, materials.hullSteel, {
        x: side * rx, y: 1.198, z: -0.04,
        cast: false,
      });
    }

    // Section seams across the fender.
    for (const z of [-2.25, -1.05, 0.15, 1.35, 2.55]) {
      addBox(group, 0.8, 0.008, 0.012, materials.darkSteel, {
        x, y: 1.202, z,
        cast: false,
      });
    }

    // Fender brackets tying the plate to the hull.
    for (const z of [-3.15, -2.0, -0.85, 0.35, 1.55, 2.75, 3.25]) {
      addBox(group, 0.44, 0.06, 0.11, materials.darkSteel, {
        x: side * 1.38, y: 1.12, z,
        cast: false,
      });
      addBox(group, 0.055, 0.24, 0.09, materials.darkSteel, {
        x: side * 1.84, y: 1.02, z,
        cast: false,
      });
    }

    // Small end plates closing the fender edges.
    for (const z of [3.43, -3.49]) {
      addBox(group, 0.8, 0.09, 0.025, materials.darkSteel, {
        x, y: 1.155, z,
        cast: false,
      });
    }

    // Rubber mud flaps.
    addBox(group, 0.8, 0.035, 0.32, materials.rubber, {
      x, y: 1.06, z: 3.57, rx: 0.55,
    });
    addBox(group, 0.8, 0.035, 0.3, materials.rubber, {
      x, y: 1.065, z: -3.62, rx: -0.52,
    });

    // Fender edge rivets and inner attachment bolts.
    for (let i = 0; i < 22; i++) {
      addCylinder(group, 0.015, 0.015, 0.016, 8, materials.brightSteel, {
        x: side * 1.895,
        y: 1.19,
        z: -3.3 + i * 0.31,
        cast: false,
      });
    }
    for (let i = 0; i < 11; i++) {
      addCylinder(group, 0.016, 0.016, 0.016, 8, materials.darkSteel, {
        x: side * 1.12,
        y: 1.195,
        z: -3.1 + i * 0.6,
        cast: false,
      });
    }
  }
  return group;
}

/* ------------------------------------------------------------------ *
 * Hull                                                                *
 * ------------------------------------------------------------------ */

function addGlacisDetails(group, materials) {
  // Local frame on the 50-degree upper front plate.
  const tilt = Math.atan2(1.12, 0.98); // normal is ~49 degrees above horizontal
  const g = new THREE.Group();
  g.position.set(0, 1.56 + 0.753 * 0.025, 2.98 + 0.659 * 0.025);
  g.rotation.x = -tilt;
  group.add(g);

  // Driver's armoured visor: cast surround, recessed slit, hinged brow and
  // small fasteners rather than a generic black box.
  addMesh(g, extrudeRoundedBoxGeometry(0.64, 0.26, 0.1, 0.045, 0.012), materials.castSteel, {
    x: 0.46, y: 0.12, z: 0.048,
  });
  addBox(g, 0.52, 0.15, 0.025, materials.darkSteel, {
    x: 0.46, y: 0.12, z: 0.102, cast: false,
  });
  addBox(g, 0.36, 0.032, 0.012, materials.blackSteel, {
    x: 0.46, y: 0.12, z: 0.12, cast: false,
  });
  addBox(g, 0.56, 0.035, 0.12, materials.hullSteel, {
    x: 0.46, y: 0.265, z: 0.1, rx: -0.22,
  });
  for (const x of [0.29, 0.63]) {
    addCylinderX(g, 0.019, 0.075, 8, materials.darkSteel, {
      x, y: 0.255, z: 0.132, cast: false,
    });
  }
  for (const [x, y] of [[0.26, 0.02], [0.66, 0.02], [0.26, 0.22], [0.66, 0.22]]) {
    addCylinderZ(g, 0.018, 0.026, 8, materials.darkSteel, {
      x, y, z: 0.115, cast: false,
    });
  }

  // Bow machine-gun ball in a proper cast mount, with a coaxial sight flap.
  addMesh(g, extrudeRoundedBoxGeometry(0.52, 0.38, 0.07, 0.09, 0.012), materials.castSteel, {
    x: -0.52, y: 0.02, z: 0.036,
  });
  addCylinderZ(g, 0.178, 0.08, 24, materials.darkSteel, {
    x: -0.52, y: 0.02, z: 0.11,
  });
  addTorus(g, 0.18, 0.018, materials.castSteel, {
    x: -0.52, y: 0.02, z: 0.15, cast: false,
  });
  addMesh(g, new THREE.SphereGeometry(0.113, 24, 16), materials.castSteel, {
    x: -0.52, y: 0.02, z: 0.15, sy: 0.92,
  });
  addCylinderZ(g, 0.039, 0.32, 14, materials.gunSteel, {
    x: -0.52, y: 0.02, z: 0.34,
  });
  addCylinderZ(g, 0.027, 0.06, 10, materials.muzzleSteel, {
    x: -0.52, y: 0.02, z: 0.515, cast: false,
  });
  addBox(g, 0.2, 0.07, 0.04, materials.castSteel, {
    x: -0.78, y: 0.12, z: 0.09, cast: false,
  });
  addBox(g, 0.13, 0.028, 0.015, materials.optic, {
    x: -0.78, y: 0.12, z: 0.113, cast: false,
  });
  for (const [x, y] of [[-0.72, -0.13], [-0.32, -0.13], [-0.72, 0.17], [-0.32, 0.17]]) {
    addCylinderZ(g, 0.018, 0.024, 8, materials.darkSteel, {
      x, y, z: 0.082, cast: false,
    });
  }

  // Bosch headlight with a guarded lens and a restrained cable run.
  addBox(g, 0.18, 0.07, 0.11, materials.castSteel, {
    x: 0.93, y: 0.26, z: 0.065,
  });
  addCylinderZ(g, 0.067, 0.17, 20, materials.darkSteel, {
    x: 0.93, y: 0.33, z: 0.15,
  });
  addMesh(g, new THREE.SphereGeometry(0.069, 16, 10), materials.darkSteel, {
    x: 0.93, y: 0.33, z: 0.065,
  });
  addCylinderZ(g, 0.051, 0.018, 18, materials.lensGlass, {
    x: 0.93, y: 0.33, z: 0.245, cast: false,
  });
  addTorus(g, 0.062, 0.01, materials.darkSteel, {
    x: 0.93, y: 0.33, z: 0.255, cast: false,
  });
  addTube(g, [
    [0.86, 0.27, 0.245],
    [0.86, 0.41, 0.23],
    [0.93, 0.44, 0.23],
    [1.0, 0.41, 0.23],
    [1.0, 0.27, 0.245],
  ], 0.008, materials.darkSteel, {
    tubularSegments: 18, radialSegments: 4, cast: false,
  });
  addTube(g, [
    [0.87, 0.24, 0.06],
    [0.74, 0.2, 0.04],
    [0.6, 0.18, 0.03],
    [0.48, 0.17, 0.025],
  ], 0.008, materials.towCable, {
    tubularSegments: 20, radialSegments: 4, cast: false,
  });
  for (const x of [0.7, 0.56]) {
    addBox(g, 0.05, 0.025, 0.035, materials.darkSteel, {
      x, y: 0.185, z: 0.04, cast: false,
    });
  }

  // Side welds and a row of bolts down the lower edge of the glacis.
  for (const side of [-1, 1]) {
    addTube(g, [
      [side * 1.32, -0.43, 0.02],
      [side * 1.34, -0.1, 0.022],
      [side * 1.34, 0.3, 0.022],
      [side * 1.3, 0.52, 0.02],
    ], 0.013, materials.weldSteel, {
      tubularSegments: 18, radialSegments: 4, cast: false,
    });
  }
  for (let i = 0; i < 9; i++) {
    addCylinderZ(g, 0.018, 0.02, 8, materials.darkSteel, {
      x: -1.08 + i * 0.27,
      y: -0.41,
      z: 0.03,
      cast: false,
    });
  }

  // Weld bead along the lower glacis edge.
  addTube(g, [
    [-1.35, -0.44, 0.02],
    [-0.6, -0.45, 0.02],
    [0, -0.45, 0.02],
    [0.6, -0.45, 0.02],
    [1.35, -0.44, 0.02],
  ], 0.012, materials.weldSteel, {
    tubularSegments: 34, radialSegments: 5, cast: false,
  });

  return g;
}

function addLowerFrontDetails(group, materials) {
  // Local frame aligned to the lower nose plate, which points down and forward.
  const g = new THREE.Group();
  const theta = 0.775;
  g.position.set(0, 0.745 - 0.7 * 0.035, 3.33 + 0.713 * 0.035);
  g.rotation.x = theta;
  group.add(g);

  // Central cast towing shoe and two protruding shackles.
  addMesh(g, extrudeRoundedBoxGeometry(0.62, 0.28, 0.08, 0.06, 0.012), materials.castSteel, {
    y: -0.08, z: 0.04,
  });
  for (const x of [-0.31, 0.31]) {
    addBox(g, 0.2, 0.08, 0.12, materials.darkSteel, {
      x, y: -0.2, z: 0.03, cast: false,
    });
    addTube(g, [
      [x - 0.07, -0.23, 0.06],
      [x - 0.07, -0.13, 0.17],
      [x + 0.07, -0.13, 0.17],
      [x + 0.07, -0.23, 0.06],
    ], 0.023, materials.darkSteel, {
      tubularSegments: 14, radialSegments: 6,
    });
  }
  // Raised round transmission inspection cover.
  addCylinderZ(g, 0.18, 0.05, 22, materials.castSteel, {
    y: 0.15, z: 0.04,
  });
  addTorus(g, 0.17, 0.012, materials.weldSteel, {
    y: 0.15, z: 0.075, cast: false,
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    addCylinderZ(g, 0.016, 0.02, 8, materials.darkSteel, {
      x: Math.cos(a) * 0.13,
      y: 0.15 + Math.sin(a) * 0.13,
      z: 0.083,
      cast: false,
    });
  }
  // Side welds and plate bolts.
  for (const side of [-1, 1]) {
    addTube(g, [
      [side * 0.99, -0.34, 0.04],
      [side * 1.02, -0.05, 0.045],
      [side * 1.0, 0.28, 0.04],
    ], 0.01, materials.weldSteel, {
      tubularSegments: 16, radialSegments: 4, cast: false,
    });
  }
  for (let i = 0; i < 7; i++) {
    addCylinderZ(g, 0.018, 0.02, 8, materials.darkSteel, {
      x: -0.72 + i * 0.24,
      y: 0.36,
      z: 0.04,
      cast: false,
    });
  }
}

function addHullRoofDetails(group, materials) {
  const roofY = 2.015;

  // Driver's and radio operator's hatches.
  for (const x of [0.48, -0.48]) {
    const hatch = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 26);
    addMesh(group, hatch, materials.hullSteel, { x, y: roofY, z: 1.77 });
    addTorus(group, 0.28, 0.017, materials.darkSteel, {
      x, y: roofY + 0.025, z: 1.77, rx: Math.PI / 2, cast: false,
    });
    addUHandle(group, [x, roofY + 0.035, 1.77], 0.18, 0.07, 0.015, materials.brightSteel, {
      orientation: 'z', cast: false,
    });
    addBox(group, 0.14, 0.03, 0.06, materials.darkSteel, {
      x: x + 0.17, y: roofY + 0.035, z: 1.72, ry: 0.3, cast: false,
    });
  }

  // Driver's periscope hoods in front of the hatches.
  for (const x of [0.62, 0.34, -0.62]) {
    addBox(group, 0.14, 0.08, 0.17, materials.darkSteel, {
      x, y: roofY + 0.06, z: 2.02,
    });
    addBox(group, 0.08, 0.03, 0.02, materials.optic, {
      x, y: roofY + 0.09, z: 2.11, cast: false,
    });
  }

  // Turret splash ring.
  addCylinder(group, 1.24, 1.29, 0.07, 52, materials.darkSteel, {
    y: 2.035, z: -0.08,
  });
  addTorus(group, 1.245, 0.02, materials.weldSteel, {
    y: 2.07, z: -0.08, rx: Math.PI / 2, cast: false,
  });

  // Roof lifting eyes and handles.
  for (const side of [-1, 1]) {
    addUHandle(group, [side * 1.12, roofY + 0.015, 1.32], 0.28, 0.09, 0.02, materials.darkSteel, {
      orientation: 'z', cast: false,
    });
    addUHandle(group, [side * 1.12, roofY + 0.015, -1.95], 0.26, 0.09, 0.02, materials.darkSteel, {
      orientation: 'z', cast: false,
    });
  }
  addUHandle(group, [0, roofY + 0.01, 2.31], 0.3, 0.075, 0.018, materials.darkSteel, {
    orientation: 'x', cast: false,
  });

  // A pair of small round vents at the front corners.
  for (const side of [-1, 1]) {
    addCylinder(group, 0.115, 0.13, 0.05, 18, materials.darkSteel, {
      x: side * 1.0, y: roofY + 0.03, z: 0.97,
    });
    addTorus(group, 0.115, 0.012, materials.brightSteel, {
      x: side * 1.0, y: roofY + 0.055, z: 0.97, rx: Math.PI / 2, cast: false,
    });
  }

  // Bolt row around the turret race.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    addCylinder(group, 0.023, 0.023, 0.02, 8, materials.brightSteel, {
      x: Math.cos(a) * 1.31,
      y: roofY + 0.055,
      z: -0.08 + Math.sin(a) * 1.31,
      cast: false,
    });
  }
}

function addEngineDeck(group, materials) {
  const y = 2.02;
  // Raised rear deck plate.
  addBox(group, 2.58, 0.035, 1.1, materials.hullSteel, {
    y: y + 0.012, z: -2.56,
  });
  addBox(group, 2.58, 0.035, 0.055, materials.darkSteel, {
    y: y + 0.03, z: -1.99, cast: false,
  });

  // Two circular armoured fan covers, with recessed grille rings and slots.
  for (const side of [-1, 1]) {
    const x = side * 0.57;
    addCylinder(group, 0.4, 0.42, 0.055, 28, materials.darkSteel, {
      x, y: y + 0.055, z: -2.27,
    });
    addCylinder(group, 0.37, 0.37, 0.03, 28, materials.castSteel, {
      x, y: y + 0.09, z: -2.27,
    });
    addTorus(group, 0.36, 0.017, materials.darkSteel, {
      x, y: y + 0.108, z: -2.27, rx: Math.PI / 2, cast: false,
    });
    addCylinder(group, 0.2, 0.235, 0.05, 24, materials.castSteel, {
      x, y: y + 0.115, z: -2.27,
    });
    addCylinder(group, 0.07, 0.085, 0.025, 12, materials.darkSteel, {
      x, y: y + 0.15, z: -2.27,
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      addBox(group, 0.022, 0.012, 0.16, materials.blackSteel, {
        x: x + Math.cos(a) * 0.275,
        y: y + 0.11,
        z: -2.27 + Math.sin(a) * 0.275,
        ry: -a,
        cast: false,
      });
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      addCylinder(group, 0.017, 0.017, 0.014, 8, materials.brightSteel, {
        x: x + Math.cos(a) * 0.39,
        y: y + 0.085,
        z: -2.27 + Math.sin(a) * 0.39,
        cast: false,
      });
    }
    // Armoured fan latches and hinge lugs.
    for (const dx of [-0.35, 0.35]) {
      addBox(group, 0.11, 0.04, 0.09, materials.darkSteel, {
        x: x + dx, y: y + 0.12, z: -2.18, cast: false,
      });
      addCylinder(group, 0.026, 0.026, 0.035, 8, materials.hubSteel, {
        x: x + dx, y: y + 0.145, z: -2.18, cast: false,
      });
    }
    addCylinder(group, 0.045, 0.055, 0.035, 10, materials.hubSteel, {
      x, y: y + 0.17, z: -2.27, cast: false,
    });
  }

  // Side radiator intake grilles.
  for (const side of [-1, 1]) {
    const x = side * 1.04;
    addBox(group, 0.3, 0.03, 0.74, materials.darkSteel, {
      x, y: y + 0.042, z: -2.6,
    });
    for (let i = 0; i < 8; i++) {
      addBox(group, 0.2, 0.012, 0.035, materials.brightSteel, {
        x, y: y + 0.068,
        z: -2.9 + i * 0.083,
        cast: false,
      });
    }
    addBox(group, 0.34, 0.03, 0.04, materials.hullSteel, {
      x, y: y + 0.06, z: -2.18, cast: false,
    });
    addBox(group, 0.34, 0.03, 0.04, materials.hullSteel, {
      x, y: y + 0.06, z: -3.02, cast: false,
    });
  }

  // Central rear grille with deep slats.
  addBox(group, 1.22, 0.04, 0.44, materials.darkSteel, {
    y: y + 0.045, z: -2.86,
  });
  for (let i = 0; i < 9; i++) {
    addBox(group, 1.12, 0.025, 0.028, materials.darkSteel, {
      y: y + 0.075,
      z: -3.03 + i * 0.042,
      rx: -0.35,
      cast: false,
    });
  }
  addBox(group, 1.32, 0.05, 0.04, materials.hullSteel, {
    y: y + 0.07, z: -3.06, cast: false,
  });

  // Central engine access hatch and hinges.
  addBox(group, 0.94, 0.035, 0.66, materials.hullSteel, {
    y: y + 0.04, z: -1.73,
  });
  addBox(group, 0.94, 0.018, 0.035, materials.darkSteel, {
    y: y + 0.064, z: -1.52, cast: false,
  });
  for (const side of [-1, 1]) {
    addBox(group, 0.17, 0.035, 0.08, materials.darkSteel, {
      x: side * 0.34, y: y + 0.07, z: -1.43, cast: false,
    });
    addUHandle(group, [side * 0.37, y + 0.06, -1.85], 0.14, 0.05, 0.014, materials.brightSteel, {
      orientation: 'z', cast: false,
    });
  }

  // Filler caps and deck lift eyes.
  for (const side of [-1, 1]) {
    addCylinder(group, 0.1, 0.11, 0.045, 16, materials.darkSteel, {
      x: side * 1.04, y: y + 0.05, z: -1.86,
    });
    addCylinder(group, 0.065, 0.065, 0.05, 12, materials.brightSteel, {
      x: side * 1.04, y: y + 0.08, z: -1.86, cast: false,
    });
    addUHandle(group, [side * 1.05, y + 0.02, -2.94], 0.17, 0.06, 0.015, materials.darkSteel, {
      orientation: 'z', cast: false,
    });
  }

  // Long engine-deck weld seam and bolt line.
  addTube(group, [
    [-1.35, y + 0.02, -2.0],
    [-0.8, y + 0.02, -2.0],
    [0.8, y + 0.02, -2.0],
    [1.35, y + 0.02, -2.0],
  ], 0.011, materials.weldSteel, { tubularSegments: 26, radialSegments: 5, cast: false });
  for (let i = 0; i < 13; i++) {
    addCylinder(group, 0.02, 0.02, 0.018, 8, materials.brightSteel, {
      x: -1.2 + i * 0.2,
      y: y + 0.03,
      z: -2.34,
      cast: false,
    });
  }
}

function addRearDetails(group, materials) {
  const rearZ = -3.58;
  // Rear access hatch, frame and hinges.
  addBox(group, 1.3, 0.66, 0.045, materials.hullSteel, {
    y: 1.31, z: rearZ - 0.02,
  });
  addBox(group, 1.4, 0.05, 0.04, materials.weldSteel, {
    y: 1.66, z: rearZ - 0.04, cast: false,
  });
  for (const x of [-0.52, 0.52]) {
    addBox(group, 0.14, 0.15, 0.055, materials.darkSteel, {
      x, y: 1.61, z: rearZ - 0.05, cast: false,
    });
  }
  addUHandle(group, [0, 1.24, rearZ - 0.055], 0.3, 0.09, 0.017, materials.darkSteel, {
    orientation: 'x', cast: false,
  });

  // Convoy light with a small clear/red lens.
  addBox(group, 0.16, 0.18, 0.08, materials.castSteel, {
    y: 0.83, z: rearZ - 0.06,
  });
  addMesh(group, new THREE.SphereGeometry(0.045, 12, 8), materials.optic, {
    y: 0.84, z: rearZ - 0.11, cast: false,
  });

  // Rear plate weld seams and a regular fastener row.
  for (const side of [-1, 1]) {
    addTube(group, [
      [side * 1.36, 2.0, -3.06],
      [side * 1.4, 1.75, -3.28],
      [side * 1.42, 1.48, -3.5],
    ], 0.012, materials.weldSteel, {
      tubularSegments: 18, radialSegments: 4, cast: false,
    });
  }
  for (const side of [-1, 1]) {
    for (const x of [0.82, 1.12]) {
      for (const y of [0.98, 1.28, 1.56]) {
        addCylinderZ(group, 0.021, 0.022, 8, materials.darkSteel, {
          x: side * x,
          y,
          z: rearZ - 0.025,
          cast: false,
        });
      }
    }
  }
  addBox(group, 0.3, 0.055, 0.06, materials.darkSteel, {
    y: 1.12, z: rearZ - 0.055, cast: false,
  });

  // Two armoured exhaust stacks on the rear plate. Each stack has a cast
  // mounting shoe, a heat shield around its lower half and a flared, sooted tip.
  for (const side of [-1, 1]) {
    const x = side * 0.76;
    addMesh(group, extrudeRoundedBoxGeometry(0.42, 0.3, 0.12, 0.06, 0.012), materials.castSteel, {
      x, y: 1.36, z: rearZ - 0.015,
      rx: -0.12,
    });
    addBox(group, 0.12, 0.16, 0.2, materials.darkSteel, {
      x, y: 1.38, z: rearZ - 0.13, cast: false,
    });
    addCylinder(group, 0.105, 0.125, 0.58, 16, materials.exhaustSteel, {
      x, y: 1.69, z: rearZ - 0.19, rx: -0.08,
    });
    addCylinder(group, 0.152, 0.16, 0.26, 16, materials.exhaustSteel, {
      x, y: 1.51, z: rearZ - 0.16, rx: -0.08,
    });
    addCylinder(group, 0.16, 0.118, 0.15, 16, materials.exhaustSteel, {
      x, y: 2.02, z: rearZ - 0.21, rx: -0.08,
    });
    addCylinder(group, 0.118, 0.118, 0.012, 16, materials.soot, {
      x, y: 2.095, z: rearZ - 0.22, rx: -0.08, cast: false,
    });
    for (const ry of [1.52, 1.76]) {
      addTorus(group, 0.118, 0.011, materials.heatSteel, {
        x, y: ry, z: rearZ - 0.19 + (ry - 1.69) * 0.08,
        rx: Math.PI / 2 - 0.08, cast: false,
      });
    }
    addTorus(group, 0.145, 0.014, materials.heatSteel, {
      x, y: 1.99, z: rearZ - 0.205, rx: Math.PI / 2 - 0.08, cast: false,
    });
    addBox(group, 0.36, 0.04, 0.08, materials.darkSteel, {
      x, y: 1.27, z: rearZ - 0.22, cast: false,
    });
  }

  // Bolted panel and lifting eyes on the upper rear plate.
  addBox(group, 0.72, 0.035, 0.34, materials.hullSteel, {
    y: 1.82, z: -3.29, rx: -0.76,
  });
  for (const x of [-0.24, 0.24]) {
    addUHandle(group, [x, 2.03, -3.17], 0.16, 0.055, 0.013, materials.darkSteel, {
      orientation: 'z', cast: false,
    });
  }
  for (const x of [-1.14, 1.14]) {
    addUHandle(group, [x, 1.68, rearZ - 0.03], 0.16, 0.08, 0.017, materials.darkSteel, {
      orientation: 'z', cast: false,
    });
  }

  // Rear towing shackles.
  for (const side of [-1, 1]) {
    addTube(group, [
      [side * 1.1, 0.63, rearZ - 0.02],
      [side * 1.1, 0.72, rearZ - 0.19],
      [side * 1.23, 0.72, rearZ - 0.27],
      [side * 1.23, 0.6, rearZ - 0.16],
    ], 0.034, materials.darkSteel, { tubularSegments: 14, radialSegments: 6 });
  }

  // Jack block and folded jack on the rear deck.
  addBox(group, 0.72, 0.14, 0.4, materials.wood, {
    y: 2.1, z: -3.26,
  });
  addBox(group, 0.32, 0.1, 0.24, materials.darkSteel, {
    x: -0.18, y: 2.2, z: -3.26,
  });
  addCylinder(group, 0.045, 0.045, 0.26, 10, materials.brightSteel, {
    x: 0.12, y: 2.2, z: -3.26, rz: 0.4, cast: false,
  });
  addBox(group, 0.3, 0.045, 0.07, materials.darkSteel, {
    x: 0.16, y: 2.3, z: -3.2, rz: 0.18, cast: false,
  });
  addUHandle(group, [0, 2.14, -3.42], 0.4, 0.08, 0.018, materials.brightSteel, {
    orientation: 'x', cast: false,
  });

  // Antenna base at the left rear.
  addCylinder(group, 0.08, 0.09, 0.1, 12, materials.darkSteel, {
    x: -1.05, y: 2.06, z: -2.58,
  });
  addTube(group, [
    [-1.05, 2.09, -2.58],
    [-1.02, 2.85, -2.62],
    [-0.98, 3.62, -2.7],
  ], 0.008, materials.darkSteel, { tubularSegments: 16, radialSegments: 4, cast: false });
}

function buildHull(materials) {
  const group = new THREE.Group();
  group.name = 'tiger-ii-hull';

  const upperProfile = [
    [3.60, 1.02],
    [2.48, 2.0],
    [-3.08, 2.0],
    [-3.54, 1.58],
    [-3.54, 1.08],
    [3.32, 1.08],
  ];
  addMesh(group, createPrismGeometry(upperProfile, 2.76, 0.025), materials.hullSteel);

  const lowerProfile = [
    [-3.5, 0.47],
    [3.06, 0.47],
    [3.6, 1.02],
    [3.5, 1.1],
    [-3.54, 1.1],
    [-3.58, 0.66],
  ];
  addMesh(group, createPrismGeometry(lowerProfile, 2.1, 0.02), materials.hullSteel);

  // Belly plate.
  addBox(group, 1.95, 0.06, 3.4, materials.interior, {
    y: 0.46, z: 0.2, cast: false,
  });

  // Side weld seams and plate fasteners.
  for (const side of [-1, 1]) {
    addTube(group, [
      [side * 1.385, 1.08, 3.32],
      [side * 1.39, 1.18, 2.9],
      [side * 1.39, 1.48, 2.48],
      [side * 1.39, 1.84, 2.02],
    ], 0.014, materials.weldSteel, { tubularSegments: 22, radialSegments: 5, cast: false });
    addTube(group, [
      [side * 1.382, 2.0, 2.35],
      [side * 1.382, 2.0, 1.2],
      [side * 1.382, 2.0, -0.1],
      [side * 1.382, 2.0, -1.4],
      [side * 1.382, 2.0, -2.6],
    ], 0.012, materials.weldSteel, { tubularSegments: 26, radialSegments: 5, cast: false });

    // Rows of plate bolts along the upper side.
    for (let i = 0; i < 8; i++) {
      addCylinder(group, 0.024, 0.024, 0.022, 8, materials.brightSteel, {
        x: side * 1.389,
        y: 1.22 + (i % 2) * 0.08,
        z: 1.95 - i * 0.52,
        rz: Math.PI / 2,
        cast: false,
      });
    }
  }

  // Nose weld and front plate edge.
  addTube(group, [
    [-1.33, 1.035, 3.52],
    [-0.7, 1.045, 3.55],
    [0, 1.05, 3.56],
    [0.7, 1.045, 3.55],
    [1.33, 1.035, 3.52],
  ], 0.017, materials.weldSteel, { tubularSegments: 30, radialSegments: 6, cast: false });

  const glacis = addGlacisDetails(group, materials);
  addLowerFrontDetails(group, materials);
  addHullRoofDetails(group, materials);
  addEngineDeck(group, materials);
  addRearDetails(group, materials);

  // Final drive covers on the front sides.
  for (const side of [-1, 1]) {
    addCylinderX(group, 0.29, 0.19, 22, materials.hullSteel, {
      x: side * 1.18, y: 1.11, z: 2.9,
    });
    addCylinderX(group, 0.23, 0.22, 22, materials.darkSteel, {
      x: side * 1.16, y: 1.11, z: 2.9,
      cast: false,
    });
    addTorus(group, 0.25, 0.014, materials.brightSteel, {
      x: side * 1.29, y: 1.11, z: 2.9,
      ry: Math.PI / 2, cast: false,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      addCylinderX(group, 0.021, 0.025, 8, materials.brightSteel, {
        x: side * 1.29,
        y: 1.11 + Math.cos(a) * 0.2,
        z: 2.9 + Math.sin(a) * 0.2,
        cast: false,
      });
    }
  }

  // Front tow shackles and a central towing eye on the lower nose.
  for (const side of [-1, 1]) {
    addBox(group, 0.22, 0.16, 0.05, materials.castSteel, {
      x: side * 0.93, y: 0.85, z: 3.5, rx: -0.7,
    });
    addTube(group, [
      [side * 0.93, 0.6, 3.57],
      [side * 0.93, 0.73, 3.66],
      [side * 1.04, 0.73, 3.69],
      [side * 1.04, 0.6, 3.58],
    ], 0.024, materials.darkSteel, { tubularSegments: 14, radialSegments: 6 });
  }
  addBox(group, 0.24, 0.12, 0.08, materials.castSteel, {
    y: 0.68, z: 3.55,
  });
  addTube(group, [
    [-0.1, 0.55, 3.62],
    [-0.1, 0.65, 3.7],
    [0.1, 0.65, 3.7],
    [0.1, 0.55, 3.62],
  ], 0.022, materials.darkSteel, { tubularSegments: 12, radialSegments: 5 });

  addHullSideTools(group, materials);

  return { group, glacis };
}

function addFrontCable(group, materials) {
  // A short armoured cable running from the headlight across the front plate.
  addTube(group, [
    [0.98, 1.86, 2.7],
    [0.55, 1.78, 2.83],
    [0.1, 1.7, 2.95],
    [-0.3, 1.63, 3.03],
  ], 0.011, materials.towCable, { tubularSegments: 24, radialSegments: 5, cast: false });
  for (const x of [0.55, 0.1, -0.3]) {
    addBox(group, 0.055, 0.035, 0.08, materials.darkSteel, {
      x, y: 1.7 + (0.55 - Math.abs(x)) * 0.08, z: 2.94 + x * 0.06, cast: false,
    });
  }
}

/* ------------------------------------------------------------------ *
 * Hull side furniture                                                 *
 * ------------------------------------------------------------------ */

function addHullSideTools(group, materials) {
  // Long tow cables, stowed close to the inner fender line.
  for (const side of [-1, 1]) {
    const x = side * 1.56;
    const points = [
      [x, 1.198, 2.5],
      [x + side * 0.012, 1.196, 1.85],
      [x, 1.194, 1.1],
      [x, 1.194, 0.3],
      [x + side * 0.008, 1.196, -0.55],
      [x, 1.195, -1.4],
      [x, 1.193, -2.2],
    ];
    addTube(group, points, 0.012, materials.towCable, {
      tubularSegments: 70, radialSegments: 6,
    });
    for (const z of [2.35, 1.55, 0.7, -0.15, -1.0, -1.85]) {
      addBox(group, 0.1, 0.02, 0.04, materials.darkSteel, {
        x: x + side * 0.005, y: 1.193, z, cast: false,
      });
      addUHandle(group, [x, 1.188, z], 0.09, 0.035, 0.007, materials.darkSteel, {
        orientation: 'z', cast: false,
      });
    }
    for (const z of [2.56, -2.26]) {
      addTorus(group, 0.044, 0.012, materials.hubSteel, {
        x, y: 1.196, z, ry: Math.PI / 2, cast: false,
      });
    }
  }

  // Shovel and cleaning rods, left fender.
  const shovel = new THREE.Group();
  shovel.position.set(-1.5, 1.205, 1.12);
  addCylinder(shovel, 0.027, 0.032, 0.78, 8, materials.wood, {
    z: 0.21, rx: Math.PI / 2, cast: false,
  });
  addBox(shovel, 0.19, 0.035, 0.28, materials.darkSteel, {
    z: -0.25, cast: false,
  });
  for (const z of [-0.05, 0.38]) {
    addBox(shovel, 0.28, 0.035, 0.055, materials.darkSteel, {
      y: 0.05, z, cast: false,
    });
  }
  group.add(shovel);

  // Long cleaning rods on the left fender.
  for (const x of [-1.66, -1.53]) {
    addCylinder(group, 0.012, 0.012, 1.25, 7, materials.brightSteel, {
      x, y: 1.235, z: -0.68, rx: Math.PI / 2, cast: false,
    });
  }
  for (const z of [-1.12, -0.7, -0.22]) {
    addBox(group, 0.28, 0.028, 0.045, materials.darkSteel, {
      x: -1.59, y: 1.26, z, cast: false,
    });
  }

  // Axe and crowbar, right fender.
  const axe = new THREE.Group();
  axe.position.set(1.46, 1.22, 0.58);
  addCylinder(axe, 0.024, 0.03, 0.72, 8, materials.wood, {
    z: 0.18, rx: Math.PI / 2, cast: false,
  });
  addBox(axe, 0.06, 0.2, 0.22, materials.darkSteel, {
    x: 0.02, z: -0.22, cast: false,
  });
  group.add(axe);

  addCylinder(group, 0.017, 0.017, 0.8, 7, materials.brightSteel, {
    x: 1.72, y: 1.22, z: 1.05, rx: Math.PI / 2, cast: false,
  });
  addBox(group, 0.15, 0.032, 0.04, materials.darkSteel, {
    x: 1.65, y: 1.22, z: 1.43, cast: false,
  });

  // Sledgehammer on the left rear fender.
  addCylinder(group, 0.021, 0.024, 0.66, 7, materials.wood, {
    x: -1.7, y: 1.22, z: 0.0, rx: Math.PI / 2, cast: false,
  });
  addBox(group, 0.09, 0.1, 0.25, materials.darkSteel, {
    x: -1.7, y: 1.22, z: -0.32, cast: false,
  });

  // Small stowage box and a wooden jack block.
  addBox(group, 0.36, 0.28, 0.55, materials.hullSteel, {
    x: -1.49, y: 1.33, z: 2.1,
  });
  addBox(group, 0.1, 0.03, 0.47, materials.darkSteel, {
    x: -1.66, y: 1.35, z: 2.1, cast: false,
  });
  addBox(group, 0.42, 0.13, 0.34, materials.wood, {
    x: 1.5, y: 1.28, z: -2.1,
  });

  // Spare track link sets on the hull sides, mounted on a welded rail.
  for (const side of [-1, 1]) {
    addBox(group, 0.045, 0.045, 0.84, materials.darkSteel, {
      x: side * 1.405, y: 1.27, z: -1.35, cast: false,
    });
    for (let i = 0; i < 2; i++) {
      const y = 1.35 + i * 0.21;
      addBox(group, 0.06, 0.2, 0.72, materials.trackSteel, {
        x: side * 1.425, y, z: -1.35,
      });
      for (const y2 of [-0.045, 0.045]) {
        addBox(group, 0.055, 0.035, 0.6, materials.trackShoe, {
          x: side * 1.46, y: y + y2, z: -1.35, cast: false,
        });
      }
      addBox(group, 0.08, 0.075, 0.1, materials.darkSteel, {
        x: side * 1.46, y, z: -1.35, cast: false,
      });
      for (const z of [-1.69, -1.01]) {
        addBox(group, 0.065, 0.23, 0.05, materials.darkSteel, {
          x: side * 1.44, y, z, cast: false,
        });
      }
    }
  }

  // Compact C-hooks at the fender ends.
  for (const side of [-1, 1]) {
    for (const z of [-2.9, 2.9]) {
      addTube(group, [
        [side * 1.42, 1.34, z],
        [side * 1.5, 1.44, z],
        [side * 1.56, 1.34, z],
      ], 0.013, materials.darkSteel, {
        tubularSegments: 10, radialSegments: 5, cast: false,
      });
    }
  }
}

/* ------------------------------------------------------------------ *
 * Turret                                                              *
 * ------------------------------------------------------------------ */

function createTurretPlanShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.72, 1.38);
  shape.lineTo(0.72, 1.38);
  shape.quadraticCurveTo(1.04, 1.36, 1.10, 1.02);
  shape.lineTo(1.145, -0.28);
  shape.absellipse(0, -0.28, 1.145, 1.16, 0, -Math.PI, true);
  shape.lineTo(-1.10, 1.02);
  shape.quadraticCurveTo(-1.04, 1.36, -0.72, 1.38);
  return shape;
}

function buildTurretShell(materials) {
  const group = new THREE.Group();
  group.name = 'henschel-turret';
  group.position.set(0, 2.0, -0.08);

  const shape = createTurretPlanShape();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.83,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.038,
    bevelThickness: 0.038,
    curveSegments: 28,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0.83, 0);
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox.min.y;
  const maxY = geometry.boundingBox.max.y;
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) - minY) / (maxY - minY);
    const xScale = 1 - 0.13 * Math.pow(t, 1.15);
    const zScale = 1 - 0.024 * t;
    position.setX(i, position.getX(i) * xScale);
    position.setZ(i, position.getZ(i) * zScale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const topY = geometry.boundingBox.max.y;

  addMesh(group, geometry, materials.turretSteel);

  // Thick roof plate with a visible edge.
  const roofGeometry = new THREE.ExtrudeGeometry(createTurretPlanShape(), {
    depth: 0.035,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.01,
    curveSegments: 26,
  });
  roofGeometry.rotateX(Math.PI / 2);
  roofGeometry.translate(0, topY - 0.02, 0);
  const roofPos = roofGeometry.getAttribute('position');
  for (let i = 0; i < roofPos.count; i++) {
    const t = (roofPos.getY(i) - minY) / (maxY - minY);
    roofPos.setX(i, roofPos.getX(i) * (1 - 0.13 * Math.pow(Math.min(t, 1), 1.15)));
    roofPos.setZ(i, roofPos.getZ(i) * (1 - 0.024 * Math.min(t, 1)));
  }
  roofPos.needsUpdate = true;
  roofGeometry.computeVertexNormals();
  addMesh(group, roofGeometry, materials.turretSteel);

  // Weld bead around the roof and the turret lower perimeter.
  const roofPoints = [];
  for (const p of createTurretPlanShape().getPoints(100)) {
    roofPoints.push(V(p.x * 0.87, topY + 0.013, p.y * 0.976));
  }
  addTube(group, roofPoints, 0.012, materials.weldSteel, {
    tubularSegments: 130, radialSegments: 4, closed: true, cast: false,
  });

  const lowerPoints = [];
  for (const p of createTurretPlanShape().getPoints(100)) {
    lowerPoints.push(V(p.x * 1.004, 0.035, p.y * 1.004));
  }
  addTube(group, lowerPoints, 0.012, materials.weldSteel, {
    tubularSegments: 130, radialSegments: 5, closed: true, cast: false,
  });

  // Shadow gap / turret race ring under the turret.
  addCylinder(group, 1.2, 1.21, 0.055, 44, materials.blackSteel, {
    y: 0.005, cast: false,
  });

  // Bolt row around the turret base.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    addCylinder(group, 0.022, 0.022, 0.018, 8, materials.brightSteel, {
      x: Math.cos(a) * 1.22,
      y: 0.06,
      z: Math.sin(a) * 1.22,
      cast: false,
    });
  }

  return { group, topY, shape };
}

function createMantletShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.32, 0.5);
  s.quadraticCurveTo(-0.53, 0.47, -0.61, 0.26);
  s.quadraticCurveTo(-0.65, 0.06, -0.62, -0.19);
  s.quadraticCurveTo(-0.57, -0.43, -0.34, -0.5);
  s.quadraticCurveTo(0, -0.54, 0.34, -0.5);
  s.quadraticCurveTo(0.57, -0.43, 0.62, -0.19);
  s.quadraticCurveTo(0.65, 0.06, 0.61, 0.26);
  s.quadraticCurveTo(0.53, 0.47, 0.32, 0.5);
  s.quadraticCurveTo(0, 0.54, -0.32, 0.5);
  return s;
}

function createAnnularRingGeometry(inner, outer, thickness) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, TAU, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.004,
    bevelThickness: 0.003,
    curveSegments: 28,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addMantletAndGun(turretGroup, materials) {
  const gunY = 0.47;
  const mantletGeo = new THREE.ExtrudeGeometry(createMantletShape(), {
    depth: 0.27,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.045,
    bevelThickness: 0.035,
    curveSegments: 24,
  });
  mantletGeo.translate(0, 0, -0.135);
  addMesh(turretGroup, mantletGeo, materials.mantleSteel, {
    y: gunY, z: 1.38,
  });

  // Armoured gun collar at the centre of the mantlet.
  addCylinderZ(turretGroup, 0.205, 0.22, 26, materials.mantleSteel, {
    y: gunY, z: 1.57,
  });
  addCylinderZ(turretGroup, 0.18, 0.1, 24, materials.gunSteel, {
    y: gunY, z: 1.68,
  });
  addTorus(turretGroup, 0.172, 0.018, materials.darkSteel, {
    y: gunY, z: 1.735, cast: false,
  });

  // Restrained bolt heads around the mantlet perimeter.
  const boltPositions = [
    [-0.45, 0.27], [0.45, 0.27], [-0.51, -0.23], [0.51, -0.23],
    [-0.25, -0.43], [0.25, -0.43],
  ];
  for (const [x, y] of boltPositions) {
    addCylinderZ(turretGroup, 0.027, 0.034, 8, materials.darkSteel, {
      x, y: gunY + y, z: 1.55, cast: false,
    });
  }

  // Coaxial MG port and barrel on the right side of the gun.
  addCylinderZ(turretGroup, 0.075, 0.07, 14, materials.darkSteel, {
    x: -0.34, y: gunY + 0.22, z: 1.56,
  });
  addCylinderZ(turretGroup, 0.028, 0.26, 10, materials.gunSteel, {
    x: -0.34, y: gunY + 0.22, z: 1.69,
  });
  addCylinderZ(turretGroup, 0.043, 0.055, 10, materials.muzzleSteel, {
    x: -0.34, y: gunY + 0.22, z: 1.83, cast: false,
  });

  // Gunner's sight hood on the upper-left front of the mantlet.
  addBox(turretGroup, 0.19, 0.14, 0.1, materials.castSteel, {
    x: 0.33, y: gunY + 0.29, z: 1.49, rx: -0.16,
  });
  addBox(turretGroup, 0.12, 0.045, 0.02, materials.optic, {
    x: 0.33, y: gunY + 0.3, z: 1.552, rx: -0.16, cast: false,
  });
  addBox(turretGroup, 0.25, 0.02, 0.08, materials.darkSteel, {
    x: 0.33, y: gunY + 0.37, z: 1.48, rx: -0.16, cast: false,
  });

  // Main armament group.
  const gun = new THREE.Group();
  gun.position.set(0, gunY, 1.06);
  turretGroup.add(gun);

  const profile = [
    new THREE.Vector2(0.17, 0.0),
    new THREE.Vector2(0.17, 0.18),
    new THREE.Vector2(0.155, 0.3),
    new THREE.Vector2(0.15, 1.08),
    new THREE.Vector2(0.13, 1.18),
    new THREE.Vector2(0.118, 2.4),
    new THREE.Vector2(0.1, 3.55),
    new THREE.Vector2(0.086, 4.35),
    new THREE.Vector2(0.082, 4.95),
    new THREE.Vector2(0.079, 5.06),
  ];
  const barrel = new THREE.LatheGeometry(profile, 40);
  barrel.rotateX(Math.PI / 2);
  barrel.computeVertexNormals();
  addMesh(gun, barrel, materials.gunSteel);

  // Recoil-sleeve collars.
  addCylinderZ(gun, 0.15, 0.045, 28, materials.gunSteel, { z: 1.12, cast: false });
  addCylinderZ(gun, 0.119, 0.03, 24, materials.darkSteel, { z: 2.42, cast: false });
  addCylinderZ(gun, 0.091, 0.022, 20, materials.darkSteel, { z: 4.36, cast: false });

  // Compact double-baffle muzzle brake: a short turned body with raised
  // baffle rings and dark side ports, not an oversized open cage.
  addCylinderZ(gun, 0.099, 0.1, 20, materials.muzzleSteel, { z: 5.08 });
  addCylinderZ(gun, 0.118, 0.42, 22, materials.muzzleSteel, { z: 5.29 });
  addCylinderZ(gun, 0.134, 0.038, 22, materials.muzzleSteel, { z: 5.185 });
  addCylinderZ(gun, 0.137, 0.042, 22, materials.muzzleSteel, { z: 5.415 });
  addCylinderZ(gun, 0.126, 0.035, 22, materials.muzzleSteel, { z: 5.515 });

  // Recessed side ports of the double-baffle brake.
  for (const side of [-1, 1]) {
    addBox(gun, 0.018, 0.074, 0.17, materials.soot, {
      x: side * 0.112, y: 0, z: 5.30, cast: false,
    });
    addBox(gun, 0.074, 0.018, 0.17, materials.soot, {
      x: 0, y: side * 0.112, z: 5.30, cast: false,
    });
  }
  addCylinderZ(gun, 0.052, 0.025, 18, materials.soot, { z: 5.55, cast: false });
  addCylinderZ(gun, 0.038, 0.018, 16, materials.blackSteel, { z: 5.566, cast: false });

  return { gun, gunY, muzzleTip: V(0, gunY, 1.06 + 5.58) };
}

function buildCupola(materials) {
  const cupola = new THREE.Group();
  cupola.position.set(0.46, 0.84, -0.53);

  // Low cast ring with a tapered cap.
  addCylinder(cupola, 0.31, 0.34, 0.18, 28, materials.castSteel, { y: 0.09 });
  addCylinder(cupola, 0.27, 0.3, 0.04, 28, materials.castSteel, { y: 0.2 });
  addMesh(cupola, new THREE.SphereGeometry(0.23, 20, 10, 0, TAU, 0, Math.PI / 2), materials.castSteel, {
    y: 0.235, sy: 0.26,
  });
  // Round commander's hatch seated on the cupola ring.
  addCylinder(cupola, 0.225, 0.235, 0.03, 26, materials.castSteel, { y: 0.27 });
  addTorus(cupola, 0.23, 0.012, materials.darkSteel, {
    y: 0.288, rx: Math.PI / 2, cast: false,
  });
  addUHandle(cupola, [0.11, 0.3, 0.08], 0.15, 0.055, 0.013, materials.brightSteel, {
    orientation: 'z', cast: false,
  });
  addBox(cupola, 0.11, 0.025, 0.06, materials.darkSteel, {
    x: -0.18, y: 0.295, z: 0.02, cast: false,
  });

  // Vision blocks, each inside a small cast hood.
  for (let i = 0; i < 6; i++) {
    const a = -1.0 + (i / 5) * 2.45;
    const sx = Math.sin(a) * 0.31;
    const sz = Math.cos(a) * 0.31;
    addBox(cupola, 0.16, 0.05, 0.025, materials.optic, {
      x: sx, y: 0.115, z: sz, ry: a, cast: false,
    });
    addBox(cupola, 0.19, 0.03, 0.13, materials.castSteel, {
      x: Math.sin(a) * 0.308,
      y: 0.16,
      z: Math.cos(a) * 0.308,
      ry: a, rx: -0.22, cast: false,
    });
  }
  // Cupola base bolts.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    addCylinder(cupola, 0.019, 0.019, 0.016, 8, materials.brightSteel, {
      x: Math.sin(a) * 0.33, y: 0.21, z: Math.cos(a) * 0.33, cast: false,
    });
  }
  return cupola;
}

function buildAAGun(materials) {
  const g = new THREE.Group();
  g.position.set(0.14, 0.885, -0.78);
  g.rotation.y = -0.28;
  // Low ring mount on the cupola ring.
  addCylinder(g, 0.11, 0.14, 0.07, 16, materials.darkSteel, { y: 0.025 });
  addTorus(g, 0.12, 0.012, materials.brightSteel, {
    y: 0.065, rx: Math.PI / 2, cast: false,
  });
  addCylinder(g, 0.027, 0.04, 0.22, 12, materials.darkSteel, { y: 0.18 });
  addMesh(g, new THREE.SphereGeometry(0.052, 12, 8), materials.darkSteel, { y: 0.3 });
  // MG 34 receiver, barrel jacket, short barrel and skeletal stock.
  addBox(g, 0.075, 0.085, 0.28, materials.gunSteel, {
    x: 0, y: 0.34, z: 0.09, rx: 0.08,
  });
  addCylinderZ(g, 0.038, 0.28, 14, materials.darkSteel, {
    x: 0, y: 0.355, z: 0.36, rx: 0.08,
  });
  addCylinderZ(g, 0.016, 0.34, 10, materials.gunSteel, {
    x: 0, y: 0.38, z: 0.58, rx: 0.08,
  });
  addBox(g, 0.06, 0.055, 0.15, materials.darkSteel, {
    x: 0, y: 0.33, z: -0.12, rx: 0.1, cast: false,
  });
  addBox(g, 0.08, 0.025, 0.16, materials.darkSteel, {
    x: 0, y: 0.3, z: 0.12, cast: false,
  });
  // Bipod folded back alongside the barrel.
  addTube(g, [
    [0.02, 0.3, 0.36],
    [0.11, 0.2, 0.34],
    [0.17, 0.12, 0.3],
  ], 0.01, materials.darkSteel, { tubularSegments: 10, radialSegments: 4, cast: false });
  addTube(g, [
    [-0.02, 0.3, 0.36],
    [-0.11, 0.2, 0.34],
    [-0.17, 0.12, 0.3],
  ], 0.01, materials.darkSteel, { tubularSegments: 10, radialSegments: 4, cast: false });
  return g;
}

function addTurretSideDetails(turretGroup, topY, materials) {
  // Escape hatch on the right side of the turret.
  addSidePlate(turretGroup, {
    side: -1,
    x: -1.045,
    y: 0.37,
    z: -0.62,
    w: 0.62,
    h: 0.54,
    thickness: 0.022,
    tilt: 0.13,
    material: materials.castSteel,
  });
  // Perimeter weld/frame around the escape hatch.
  addTube(turretGroup, [
    [-1.064, 0.11, -0.33],
    [-1.064, 0.11, -0.89],
    [-1.064, 0.37, -0.93],
    [-1.064, 0.63, -0.89],
    [-1.064, 0.63, -0.33],
    [-1.064, 0.37, -0.29],
  ], 0.009, materials.weldSteel, {
    tubularSegments: 32, radialSegments: 4, closed: true, cast: false,
  });
  for (const z of [-0.83, -0.62, -0.41]) {
    addBox(turretGroup, 0.06, 0.085, 0.045, materials.darkSteel, {
      x: -1.068, y: 0.58, z, cast: false,
    });
    addCylinderX(turretGroup, 0.014, 0.08, 8, materials.hubSteel, {
      x: -1.077, y: 0.58, z, cast: false,
    });
  }
  addBox(turretGroup, 0.025, 0.16, 0.045, materials.darkSteel, {
    x: -1.075, y: 0.5, z: -0.91, cast: false,
  });
  addUHandle(turretGroup, [-1.075, 0.2, -0.39], 0.15, 0.055, 0.012, materials.darkSteel, {
    orientation: 'z', cast: false,
  });
  addBox(turretGroup, 0.035, 0.02, 0.62, materials.darkSteel, {
    x: -1.069, y: 0.68, z: -0.62, cast: false,
  });

  // Pistol port on the left side.
  addCylinderX(turretGroup, 0.078, 0.04, 16, materials.castSteel, {
    x: 0.952, y: 0.5, z: -0.76,
    cast: false,
  });
  addCylinderX(turretGroup, 0.042, 0.062, 12, materials.darkSteel, {
    x: 0.972, y: 0.5, z: -0.76,
    cast: false,
  });
  addTorus(turretGroup, 0.082, 0.01, materials.darkSteel, {
    x: 0.972, y: 0.5, z: -0.76,
    ry: Math.PI / 2, cast: false,
  });

  // Spare track links, two per side, each with grousers and guide horn.
  for (const side of [-1, 1]) {
    const x = side * 1.105;
    addBox(turretGroup, 0.075, 0.045, 0.86, materials.darkSteel, {
      x: side * 1.055, y: 0.19, z: -0.06, cast: false,
    });
    for (let i = 0; i < 2; i++) {
      const y = 0.27 + i * 0.24;
      addBox(turretGroup, 0.075, 0.22, 0.74, materials.trackSteel, {
        x, y, z: -0.06,
      });
      for (const dy of [-0.06, 0.06]) {
        addBox(turretGroup, 0.055, 0.035, 0.64, materials.trackShoe, {
          x: side * 1.145, y: y + dy, z: -0.06, cast: false,
        });
      }
      addBox(turretGroup, 0.08, 0.08, 0.12, materials.darkSteel, {
        x: side * 1.15, y, z: -0.06, cast: false,
      });
      for (const z of [-0.39, 0.27]) {
        addBox(turretGroup, 0.085, 0.25, 0.055, materials.darkSteel, {
          x: side * 1.12, y, z, cast: false,
        });
      }
      for (const z of [-0.31, 0.19]) {
        addCylinderX(turretGroup, 0.012, 0.08, 8, materials.hubSteel, {
          x: side * 1.155, y: y - 0.065, z, cast: false,
        });
      }
    }
  }

  // Roof lifting eyes.
  const eyes = [
    [0.8, 0.92], [-0.8, 0.92], [0.76, -1.02], [-0.76, -1.02],
  ];
  for (const [x, z] of eyes) {
    addUHandle(turretGroup, [x, topY + 0.02, z], 0.16, 0.075, 0.018, materials.darkSteel, {
      orientation: 'x', cast: false,
    });
  }

  // Turret rear stowage bin.
  const bin = new THREE.Group();
  bin.position.set(0, 0.43, -1.5);
  addMesh(bin, extrudeRoundedBoxGeometry(1.48, 0.4, 0.42, 0.06, 0.02), materials.turretSteel);
  addBox(bin, 1.52, 0.032, 0.46, materials.darkSteel, { y: 0.215, z: 0, cast: false });
  addMesh(bin, extrudeRoundedBoxGeometry(1.52, 0.06, 0.45, 0.05, 0.012), materials.turretSteel, {
    y: 0.23, z: -0.01,
  });
  addBox(bin, 1.5, 0.012, 0.035, materials.weldSteel, {
    y: 0.205, z: 0.225, cast: false,
  });
  for (const x of [-0.47, 0.47]) {
    addBox(bin, 0.035, 0.42, 0.46, materials.darkSteel, { x, cast: false });
    addBox(bin, 0.11, 0.05, 0.06, materials.hubSteel, {
      x, y: 0.06, z: 0.225, cast: false,
    });
    addBox(bin, 0.07, 0.09, 0.06, materials.darkSteel, {
      x, y: 0.17, z: -0.235, cast: false,
    });
    addBox(bin, 0.15, 0.045, 0.06, materials.darkSteel, {
      x, y: 0.18, z: 0.225, cast: false,
    });
    addCylinderX(bin, 0.018, 0.1, 8, materials.hubSteel, {
      x, y: 0.23, z: 0.2, cast: false,
    });
  }
  for (const x of [-0.38, 0.38]) {
    addBox(bin, 0.05, 0.05, 0.18, materials.darkSteel, {
      x, y: -0.23, z: 0.06, cast: false,
    });
  }
  for (let i = 0; i < 8; i++) {
    addCylinderZ(bin, 0.016, 0.018, 8, materials.brightSteel, {
      x: -0.6 + i * 0.17,
      y: 0.1,
      z: 0.22,
      cast: false,
    });
  }
  turretGroup.add(bin);

  // A short protected antenna socket on the right rear roof.
  addCylinder(turretGroup, 0.065, 0.075, 0.09, 12, materials.darkSteel, {
    x: -0.65, y: topY + 0.03, z: -0.9,
  });
  addTube(turretGroup, [
    [-0.65, topY + 0.06, -0.9],
    [-0.62, topY + 0.62, -0.98],
    [-0.6, topY + 1.18, -1.04],
  ], 0.007, materials.darkSteel, { tubularSegments: 14, radialSegments: 4, cast: false });
}

function addTurretRoofDetails(turretGroup, topY, materials) {
  // Commander's cupola.
  const cupola = buildCupola(materials);
  turretGroup.add(cupola);

  // AA machine gun on the cupola ring.
  const aaGun = buildAAGun(materials);
  aaGun.scale.setScalar(0.82);
  turretGroup.add(aaGun);

  // Loader's hatch on the right rear.
  const loader = new THREE.Group();
  loader.position.set(-0.44, topY + 0.025, -0.35);
  addCylinder(loader, 0.275, 0.29, 0.04, 24, materials.turretSteel);
  addTorus(loader, 0.285, 0.016, materials.darkSteel, {
    y: 0.025, rx: Math.PI / 2, cast: false,
  });
  addUHandle(loader, [0.1, 0.055, 0], 0.18, 0.065, 0.014, materials.brightSteel, {
    orientation: 'z', cast: false,
  });
  addBox(loader, 0.12, 0.035, 0.06, materials.darkSteel, {
    x: -0.2, y: 0.045, z: 0.02, cast: false,
  });
  turretGroup.add(loader);

  // Gunner's sight on the front-left roof.
  addBox(turretGroup, 0.32, 0.13, 0.3, materials.castSteel, {
    x: 0.28, y: topY + 0.055, z: 0.54, rx: -0.12,
  });
  addBox(turretGroup, 0.18, 0.05, 0.02, materials.optic, {
    x: 0.28, y: topY + 0.075, z: 0.70, rx: -0.12, cast: false,
  });
  addBox(turretGroup, 0.35, 0.035, 0.08, materials.darkSteel, {
    x: 0.28, y: topY + 0.135, z: 0.45, rx: -0.12, cast: false,
  });

  // Roof ventilator.
  addCylinder(turretGroup, 0.16, 0.18, 0.055, 22, materials.castSteel, {
    x: -0.02, y: topY + 0.03, z: -0.14,
  });
  addMesh(turretGroup, new THREE.SphereGeometry(0.145, 18, 9, 0, TAU, 0, Math.PI / 2), materials.darkSteel, {
    x: -0.02, y: topY + 0.065, z: -0.14, sy: 0.35,
  });

  // Loader's periscope.
  addBox(turretGroup, 0.15, 0.08, 0.16, materials.darkSteel, {
    x: -0.52, y: topY + 0.055, z: 0.62, cast: false,
  });
  addBox(turretGroup, 0.09, 0.035, 0.02, materials.optic, {
    x: -0.52, y: topY + 0.075, z: 0.705, cast: false,
  });

  // Roof grab rail.
  addUHandle(turretGroup, [0, topY + 0.018, 0.28], 0.3, 0.055, 0.014, materials.darkSteel, {
    orientation: 'x', cast: false,
  });
}

function buildTurret(materials) {
  const { group: turret, topY } = buildTurretShell(materials);
  const { gun, muzzleTip } = addMantletAndGun(turret, materials);
  addTurretRoofDetails(turret, topY, materials);
  addTurretSideDetails(turret, topY, materials);

  // Turret front / side weld seams.
  addTube(turret, [
    [-0.78, 0.06, 1.37],
    [-0.96, 0.2, 1.23],
    [-1.05, 0.58, 1.08],
    [-1.07, 0.82, 1.0],
  ], 0.011, materials.weldSteel, { tubularSegments: 20, radialSegments: 5, cast: false });
  addTube(turret, [
    [0.78, 0.06, 1.37],
    [0.96, 0.2, 1.23],
    [1.05, 0.58, 1.08],
    [1.07, 0.82, 1.0],
  ], 0.011, materials.weldSteel, { tubularSegments: 20, radialSegments: 5, cast: false });

  turret.rotation.y = -0.025;
  return { turretGroup: turret, gun, muzzleTip, topY };
}

/* ------------------------------------------------------------------ *
 * Turret V3 — rebuilt around the supplied four-view / photo references
 * ------------------------------------------------------------------ */

function createTurretPlanShapeV3() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.80, 1.35);
  shape.lineTo(0.80, 1.35);
  shape.quadraticCurveTo(1.03, 1.33, 1.09, 1.07);
  shape.quadraticCurveTo(1.15, 0.75, 1.16, 0.12);
  shape.lineTo(1.17, -0.38);
  shape.quadraticCurveTo(1.17, -0.98, 1.05, -1.16);
  shape.quadraticCurveTo(0.94, -1.32, 0.80, -1.37);
  shape.lineTo(-0.80, -1.37);
  shape.quadraticCurveTo(-0.94, -1.32, -1.05, -1.16);
  shape.quadraticCurveTo(-1.17, -0.98, -1.17, -0.38);
  shape.lineTo(-1.16, 0.12);
  shape.quadraticCurveTo(-1.15, 0.75, -1.09, 1.07);
  shape.quadraticCurveTo(-1.03, 1.33, -0.80, 1.35);
  return shape;
}

function sampleTurretPlanV3(shape) {
  const raw = shape.getSpacedPoints(220);
  const points = [];
  for (const point of raw) {
    if (!points.length || point.distanceTo(points[points.length - 1]) > 1e-5) {
      points.push(point.clone());
    }
  }
  if (points.length > 2 && points[0].distanceTo(points[points.length - 1]) < 1e-5) {
    points.pop();
  }
  return points;
}

function buildTurretLoftV3(planPoints, ringSpecs, capTop = true) {
  const positions = [];
  const indices = [];
  const count = planPoints.length;
  const centerZ = -0.03;

  for (const ring of ringSpecs) {
    for (const point of planPoints) {
      positions.push(point.x * ring.sx, ring.y, point.y * ring.sz);
    }
  }

  const vectorAt = (index) => new THREE.Vector3(
    positions[index * 3],
    positions[index * 3 + 1],
    positions[index * 3 + 2]
  );

  const addOrientedTriangle = (a, b, c) => {
    const pa = vectorAt(a);
    const pb = vectorAt(b);
    const pc = vectorAt(c);
    const normal = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa));
    const centroid = pa.clone().add(pb).add(pc).multiplyScalar(1 / 3);
    const outward = new THREE.Vector3(centroid.x, 0, centroid.z - centerZ);
    if (normal.dot(outward) < 0) indices.push(a, c, b);
    else indices.push(a, b, c);
  };

  for (let r = 0; r < ringSpecs.length - 1; r++) {
    const lower = r * count;
    const upper = (r + 1) * count;
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const a = lower + i;
      const b = lower + next;
      const c = upper + i;
      const d = upper + next;
      addOrientedTriangle(a, b, c);
      addOrientedTriangle(b, d, c);
    }
  }

  const topRing = (ringSpecs.length - 1) * count;
  if (capTop) {
    const centerIndex = positions.length / 3;
    const topRingSpec = ringSpecs[ringSpecs.length - 1];
    positions.push(0, topRingSpec.y, centerZ);
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const a = topRing + i;
      const b = topRing + next;
      const pa = vectorAt(a);
      const pb = vectorAt(b);
      const pc = vectorAt(centerIndex);
      const normal = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa));
      if (normal.y >= 0) indices.push(centerIndex, a, b);
      else indices.push(centerIndex, b, a);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRoundedRectHolePathV3(w, h, radius) {
  const path = new THREE.Path();
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + radius, y);
  path.quadraticCurveTo(x, y, x, y + radius);
  path.lineTo(x, y + h - radius);
  path.quadraticCurveTo(x, y + h, x + radius, y + h);
  path.lineTo(x + w - radius, y + h);
  path.quadraticCurveTo(x + w, y + h, x + w, y + h - radius);
  path.lineTo(x + w, y + radius);
  path.quadraticCurveTo(x + w, y, x + w - radius, y);
  path.lineTo(x + radius, y);
  path.closePath();
  return path;
}

function createRoundedFrameGeometryV3(outerW, outerH, innerW, innerH, cornerR, innerR, depth) {
  const shape = roundedRectShape(outerW, outerH, cornerR);
  shape.holes.push(addRoundedRectHolePathV3(innerW, innerH, innerR));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.008,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function buildTurretShellV3(materials) {
  const group = new THREE.Group();
  group.name = 'henschel-turret-v3';

  const shape = createTurretPlanShapeV3();
  const planPoints = sampleTurretPlanV3(shape);

  const bodyRings = [
    { y: 0.000, sx: 1.006, sz: 1.004 },
    { y: 0.070, sx: 1.003, sz: 1.002 },
    { y: 0.150, sx: 0.998, sz: 1.000 },
    { y: 0.260, sx: 0.990, sz: 0.999 },
    { y: 0.370, sx: 0.978, sz: 0.997 },
    { y: 0.470, sx: 0.962, sz: 0.995 },
    { y: 0.570, sx: 0.940, sz: 0.992 },
    { y: 0.655, sx: 0.916, sz: 0.989 },
    { y: 0.720, sx: 0.892, sz: 0.986 },
    { y: 0.765, sx: 0.868, sz: 0.983 },
    { y: 0.795, sx: 0.838, sz: 0.980 },
  ];
  const rimRings = [
    { y: 0.795, sx: 0.838, sz: 0.980 },
    { y: 0.815, sx: 0.808, sz: 0.978 },
  ];

  const bodyGeometry = buildTurretLoftV3(planPoints, bodyRings, true);
  const body = addMesh(group, bodyGeometry, materials.turretSteel);
  body.name = 'turret-body-loft';

  const rimGeometry = buildTurretLoftV3(planPoints, rimRings, true);
  const rim = addMesh(group, rimGeometry, materials.turretSteel);
  rim.name = 'turret-roof-rim';

  // Dark shadow gap and race under the turret.
  addCylinder(group, 1.18, 1.18, 0.035, 48, materials.blackSteel, {
    y: -0.012, cast: false,
  });

  // Weld bead around the base and the roof rim.
  const baseWeldPoints = planPoints.map((p) => V(p.x * 1.003, 0.012, p.y * 1.003));
  addTube(group, baseWeldPoints, 0.009, materials.weldSteel, {
    tubularSegments: 140, radialSegments: 4, closed: true, cast: false,
  });
  const roofWeldPoints = planPoints.map((p) => V(p.x * 0.809, 0.818, p.y * 0.978));
  addTube(group, roofWeldPoints, 0.007, materials.weldSteel, {
    tubularSegments: 140, radialSegments: 4, closed: true, cast: false,
  });

  // Ring of small fasteners at the turret base.
  for (let i = 0; i < 26; i++) {
    const p = planPoints[Math.floor((i / 26) * planPoints.length)];
    addCylinder(group, 0.018, 0.018, 0.018, 8, materials.hubSteel, {
      x: p.x * 1.012,
      y: 0.022,
      z: p.y * 1.012,
      cast: false,
    });
  }

  // A handful of welded lifting eyes / fastener pads on the roof edge.
  for (let i = 0; i < 12; i++) {
    const p = planPoints[Math.floor(((i + 0.5) / 12) * planPoints.length)];
    addCylinder(group, 0.014, 0.014, 0.014, 8, materials.darkSteel, {
      x: p.x * 0.76,
      y: 0.821,
      z: p.y * 0.975,
      cast: false,
    });
  }

  return { group, topY: 0.815, planPoints, shape };
}

function createMantletShapeV3() {
  const s = new THREE.Shape();
  s.moveTo(-0.26, 0.33);
  s.quadraticCurveTo(-0.43, 0.33, -0.51, 0.25);
  s.quadraticCurveTo(-0.57, 0.14, -0.56, 0.00);
  s.quadraticCurveTo(-0.55, -0.16, -0.47, -0.25);
  s.quadraticCurveTo(-0.39, -0.32, -0.25, -0.34);
  s.quadraticCurveTo(0, -0.365, 0.25, -0.34);
  s.quadraticCurveTo(0.39, -0.32, 0.47, -0.25);
  s.quadraticCurveTo(0.55, -0.16, 0.56, 0.00);
  s.quadraticCurveTo(0.57, 0.14, 0.51, 0.25);
  s.quadraticCurveTo(0.43, 0.33, 0.26, 0.33);
  s.quadraticCurveTo(0, 0.35, -0.26, 0.33);
  return s;
}

function buildMantletAndGunV3(turretGroup, materials) {
  const gunY = 0.42;

  // Tapered cast mantlet: wide at the turret face, narrower at the front.
  // This avoids the flat "appliqué shield" silhouette of the earlier build.
  const mantletGeo = new THREE.ExtrudeGeometry(createMantletShapeV3(), {
    depth: 0.30,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.032,
    curveSegments: 28,
  });
  mantletGeo.translate(0, 0, -0.15);
  mantletGeo.computeBoundingBox();
  const mantletMinZ = mantletGeo.boundingBox.min.z;
  const mantletMaxZ = mantletGeo.boundingBox.max.z;
  const mPos = mantletGeo.getAttribute('position');
  for (let i = 0; i < mPos.count; i++) {
    const t = (mPos.getZ(i) - mantletMinZ) / (mantletMaxZ - mantletMinZ);
    const sx = 1.11 - 0.11 * t;
    const sy = 1.075 - 0.075 * t;
    mPos.setX(i, mPos.getX(i) * sx);
    mPos.setY(i, mPos.getY(i) * sy);
  }
  mPos.needsUpdate = true;
  mantletGeo.computeVertexNormals();
  addMesh(turretGroup, mantletGeo, materials.mantleSteel, {
    y: gunY, z: 1.375,
  });

  // A raised cast ridge traces the face of the mantlet.
  const mantletRidge = createMantletShapeV3().getSpacedPoints(84)
    .map((p) => V(p.x * 0.93, gunY + p.y * 0.93, 1.535));
  addTube(turretGroup, mantletRidge, 0.013, materials.mantleSteel, {
    tubularSegments: 90, radialSegments: 5, closed: true, cast: false,
  });

  // Weld bead where the cast mantlet base meets the turret front.
  const mantletBaseWeld = createMantletShapeV3().getSpacedPoints(84)
    .map((p) => V(p.x * 1.065, gunY + p.y * 1.065, 1.34));
  addTube(turretGroup, mantletBaseWeld, 0.01, materials.weldSteel, {
    tubularSegments: 90, radialSegments: 4, closed: true, cast: false,
  });

  // Bolted cheek straps on the front plate, just outside the mantlet.
  for (const side of [-1, 1]) {
    addMesh(turretGroup, extrudeRoundedBoxGeometry(0.09, 0.44, 0.035, 0.018, 0.004), materials.turretSteel, {
      x: side * 0.675, y: 0.42, z: 1.345, cast: true,
    });
    for (const y of [0.24, 0.42, 0.6]) {
      addCylinderZ(turretGroup, 0.017, 0.022, 8, materials.hubSteel, {
        x: side * 0.675, y, z: 1.37, cast: false,
      });
    }
  }

  // Raised central cast boss around the gun opening.
  addMesh(turretGroup, extrudeRoundedBoxGeometry(0.52, 0.42, 0.075, 0.09, 0.01), materials.mantleSteel, {
    y: gunY, z: 1.51,
  });

  // Slight raised brow band across the top of the mantlet.
  addBox(turretGroup, 0.78, 0.03, 0.075, materials.mantleSteel, {
    y: gunY + 0.31, z: 1.45, rx: -0.08,
  });

  // Main gun collar: nested cast rings and a blued transition ring.
  addCylinderZ(turretGroup, 0.192, 0.11, 28, materials.mantleSteel, {
    y: gunY, z: 1.48,
  });
  addCylinderZ(turretGroup, 0.215, 0.05, 28, materials.castSteel, {
    y: gunY, z: 1.55,
  });
  addCylinderZ(turretGroup, 0.155, 0.11, 24, materials.gunSteel, {
    y: gunY, z: 1.62,
  });
  addTorus(turretGroup, 0.157, 0.013, materials.darkSteel, {
    y: gunY, z: 1.675, cast: false,
  });
  // Dark blued gun boot at the collar/barrel junction.
  addCylinderZ(turretGroup, 0.164, 0.075, 24, materials.darkSteel, {
    y: gunY, z: 1.735, cast: false,
  });
  addTorus(turretGroup, 0.165, 0.009, materials.blackSteel, {
    y: gunY, z: 1.77, cast: false,
  });

  // Restrained mantlet bolts, kept near the cast border.
  const boltPositions = [
    [-0.44, 0.19], [0.44, 0.19],
    [-0.39, -0.17], [0.39, -0.17],
    [-0.19, -0.28], [0.19, -0.28],
  ];
  for (const [x, y] of boltPositions) {
    addCylinderZ(turretGroup, 0.016, 0.019, 8, materials.hubSteel, {
      x, y: gunY + y, z: 1.535, cast: false,
    });
  }
  for (const [x, y] of [[-0.57, 0.16], [0.57, 0.16], [-0.53, -0.18], [0.53, -0.18]]) {
    addCylinderZ(turretGroup, 0.015, 0.018, 8, materials.darkSteel, {
      x, y: gunY + y, z: 1.405, cast: false,
    });
  }

  // Coaxial machine-gun port and barrel.
  addCylinderZ(turretGroup, 0.07, 0.06, 16, materials.darkSteel, {
    x: -0.325, y: gunY + 0.145, z: 1.53,
  });
  addCylinderZ(turretGroup, 0.026, 0.27, 10, materials.gunSteel, {
    x: -0.325, y: gunY + 0.145, z: 1.66,
  });
  addCylinderZ(turretGroup, 0.036, 0.045, 10, materials.muzzleSteel, {
    x: -0.325, y: gunY + 0.145, z: 1.805, cast: false,
  });

  // Gunner's sight aperture and armoured brow.
  addMesh(turretGroup, extrudeRoundedBoxGeometry(0.23, 0.15, 0.08, 0.03, 0.006), materials.castSteel, {
    x: 0.33, y: gunY + 0.15, z: 1.525, rx: -0.1,
  });
  addBox(turretGroup, 0.15, 0.048, 0.018, materials.optic, {
    x: 0.33, y: gunY + 0.15, z: 1.575, rx: -0.1, cast: false,
  });
  addBox(turretGroup, 0.3, 0.022, 0.1, materials.darkSteel, {
    x: 0.33, y: gunY + 0.235, z: 1.51, rx: -0.1, cast: false,
  });

  // Small lifting lugs on the top edge of the mantlet.
  for (const side of [-1, 1]) {
    addUHandle(turretGroup, [side * 0.28, gunY + 0.35, 1.4], 0.11, 0.05, 0.011, materials.darkSteel, {
      orientation: 'x', cast: false,
    });
  }

  // A welded splash guard above the mantlet opening.
  addBox(turretGroup, 0.95, 0.025, 0.09, materials.turretSteel, {
    y: 0.805, z: 1.38, rx: -0.12,
  });

  // Main armament group. The recoil sleeve is partially buried in the collar.
  const gun = new THREE.Group();
  gun.position.set(0, gunY, 1.04);
  turretGroup.add(gun);

  const profile = [
    new THREE.Vector2(0.18, 0.0),
    new THREE.Vector2(0.18, 0.18),
    new THREE.Vector2(0.166, 0.36),
    new THREE.Vector2(0.158, 1.04),
    new THREE.Vector2(0.136, 1.12),
    new THREE.Vector2(0.132, 1.25),
    new THREE.Vector2(0.121, 2.35),
    new THREE.Vector2(0.105, 3.45),
    new THREE.Vector2(0.089, 4.35),
    new THREE.Vector2(0.083, 4.92),
    new THREE.Vector2(0.079, 5.03),
  ];
  const barrel = new THREE.LatheGeometry(profile, 44);
  barrel.rotateX(Math.PI / 2);
  barrel.computeVertexNormals();
  addMesh(gun, barrel, materials.gunSteel);

  // Reinforcing collars at the recoil-sleeve step and the thinner tube.
  addCylinderZ(gun, 0.158, 0.055, 28, materials.gunSteel, { z: 1.10, cast: false });
  addCylinderZ(gun, 0.122, 0.032, 24, materials.darkSteel, { z: 2.36, cast: false });
  addCylinderZ(gun, 0.09, 0.024, 20, materials.darkSteel, { z: 4.37, cast: false });

  // Compact double-baffle muzzle brake: turned body, raised baffles, dark ports.
  addCylinderZ(gun, 0.09, 0.08, 20, materials.muzzleSteel, { z: 5.04 });
  addCylinderZ(gun, 0.108, 0.32, 22, materials.muzzleSteel, { z: 5.23 });
  addCylinderZ(gun, 0.122, 0.032, 22, materials.muzzleSteel, { z: 5.14 });
  addCylinderZ(gun, 0.124, 0.036, 22, materials.muzzleSteel, { z: 5.34 });
  addCylinderZ(gun, 0.113, 0.03, 22, materials.muzzleSteel, { z: 5.42 });
  for (const side of [-1, 1]) {
    addBox(gun, 0.016, 0.056, 0.12, materials.soot, {
      x: side * 0.102, y: 0, z: 5.23, cast: false,
    });
    addBox(gun, 0.056, 0.016, 0.12, materials.soot, {
      x: 0, y: side * 0.102, z: 5.23, cast: false,
    });
  }
  addCylinderZ(gun, 0.044, 0.022, 18, materials.soot, { z: 5.45, cast: false });
  addCylinderZ(gun, 0.033, 0.014, 16, materials.blackSteel, { z: 5.462, cast: false });

  // Two vertical weld beads tying the mantlet surround into the turret face.
  for (const side of [-1, 1]) {
    addTube(turretGroup, [
      [side * 0.64, 0.09, 1.355],
      [side * 0.65, 0.38, 1.35],
      [side * 0.63, 0.71, 1.34],
    ], 0.007, materials.weldSteel, {
      tubularSegments: 22, radialSegments: 4, cast: false,
    });
  }

  return { gun, gunY, muzzleTip: V(0, gunY, 1.04 + 5.48) };
}

function buildCupolaV3(materials, topY) {
  const cupola = new THREE.Group();
  cupola.position.set(0.40, topY, -0.48);

  // Low cast base ring and drum.
  addCylinder(cupola, 0.33, 0.37, 0.075, 30, materials.castSteel, { y: 0.0375 });
  addCylinder(cupola, 0.30, 0.325, 0.12, 30, materials.castSteel, { y: 0.135 });
  addCylinder(cupola, 0.275, 0.292, 0.032, 28, materials.castSteel, { y: 0.207 });
  addCylinder(cupola, 0.252, 0.27, 0.025, 26, materials.castSteel, { y: 0.235 });
  addCylinder(cupola, 0.225, 0.235, 0.028, 26, materials.castSteel, { y: 0.257 });
  addTorus(cupola, 0.226, 0.011, materials.darkSteel, {
    y: 0.273, rx: Math.PI / 2, cast: false,
  });
  addUHandle(cupola, [0.1, 0.283, 0.06], 0.13, 0.05, 0.011, materials.brightSteel, {
    orientation: 'z', cast: false,
  });
  addBox(cupola, 0.1, 0.025, 0.055, materials.darkSteel, {
    x: -0.17, y: 0.278, z: 0.02, cast: false,
  });
  addCylinder(cupola, 0.028, 0.028, 0.035, 8, materials.hubSteel, {
    x: -0.19, y: 0.29, z: -0.02, cast: false,
  });

  // Clean lower ring and flush vision slits. The blocks are only a few
  // millimetres deep, so they cannot turn the cupola silhouette into a crown.
  addCylinder(cupola, 0.287, 0.298, 0.026, 30, materials.castSteel, { y: 0.148 });
  for (let i = 0; i < 6; i++) {
    const a = -1.05 + (i / 5) * 2.35;
    addBox(cupola, 0.13, 0.032, 0.008, materials.optic, {
      x: Math.sin(a) * 0.302, y: 0.122, z: Math.cos(a) * 0.302,
      ry: a, cast: false,
    });
    addBox(cupola, 0.15, 0.012, 0.018, materials.darkSteel, {
      x: Math.sin(a) * 0.3, y: 0.148, z: Math.cos(a) * 0.3,
      ry: a, cast: false,
    });
  }
  // Two clean periscope heads at the front of the cupola.
  for (const x of [-0.09, 0.13]) {
    addBox(cupola, 0.075, 0.045, 0.1, materials.darkSteel, {
      x, y: 0.18, z: 0.27, cast: false,
    });
    addBox(cupola, 0.055, 0.018, 0.012, materials.optic, {
      x, y: 0.185, z: 0.325, cast: false,
    });
  }
  // AA machine-gun ring rail around the cupola.
  addTorus(cupola, 0.40, 0.012, materials.darkSteel, {
    y: 0.045, rx: Math.PI / 2, cast: false,
  });
  // Base bolts.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    addCylinder(cupola, 0.016, 0.016, 0.014, 8, materials.hubSteel, {
      x: Math.sin(a) * 0.355, y: 0.085, z: Math.cos(a) * 0.355, cast: false,
    });
  }
  return cupola;
}

function buildAAGunV3(materials, topY) {
  const g = new THREE.Group();
  g.position.set(0.14, topY + 0.018, -0.73);
  g.rotation.y = -0.16;

  // Pintle, cradle, and a short arm tying the mount to the cupola rail.
  addCylinder(g, 0.12, 0.145, 0.045, 18, materials.darkSteel, { y: 0.0225 });
  addTorus(g, 0.14, 0.01, materials.hubSteel, {
    y: 0.048, rx: Math.PI / 2, cast: false,
  });
  addTube(g, [
    [0, 0.02, 0],
    [0.15, 0.02, 0.11],
    [0.27, 0.025, 0.22],
  ], 0.017, materials.darkSteel, {
    tubularSegments: 12, radialSegments: 5, cast: false,
  });
  addBox(g, 0.1, 0.04, 0.08, materials.darkSteel, {
    x: 0.27, y: 0.02, z: 0.22, cast: false,
  });
  addCylinder(g, 0.035, 0.045, 0.16, 12, materials.darkSteel, { y: 0.125 });
  addMesh(g, new THREE.SphereGeometry(0.055, 12, 8), materials.darkSteel, { y: 0.215 });
  addBox(g, 0.13, 0.05, 0.12, materials.darkSteel, {
    y: 0.24, z: 0.02, cast: false,
  });

  // Machine-gun receiver, barrel jacket, thin barrel and muzzle.
  addBox(g, 0.085, 0.095, 0.31, materials.gunSteel, {
    y: 0.29, z: 0.075, rx: 0.04,
  });
  addBox(g, 0.055, 0.032, 0.16, materials.darkSteel, {
    y: 0.342, z: 0.06, cast: false,
  });
  addCylinderZ(g, 0.036, 0.26, 16, materials.darkSteel, {
    y: 0.305, z: 0.33, rx: 0.04,
  });
  addCylinderZ(g, 0.014, 0.34, 10, materials.gunSteel, {
    y: 0.32, z: 0.53, rx: 0.04,
  });
  addCylinderZ(g, 0.024, 0.045, 10, materials.muzzleSteel, {
    y: 0.323, z: 0.70, rx: 0.04, cast: false,
  });
  addBox(g, 0.06, 0.035, 0.08, materials.darkSteel, {
    y: 0.36, z: 0.39, cast: false,
  });

  // Dark wooden buttstock, pistol grip and trigger guard.
  addBox(g, 0.055, 0.065, 0.2, materials.wood, {
    y: 0.26, z: -0.2, rx: 0.07,
  });
  addBox(g, 0.048, 0.08, 0.055, materials.darkSteel, {
    y: 0.225, z: -0.1, rx: 0.18, cast: false,
  });
  addTorus(g, 0.032, 0.007, materials.darkSteel, {
    x: 0, y: 0.225, z: -0.06, rx: 0.3, cast: false,
  });

  // Ammunition box and a short belt.
  addBox(g, 0.12, 0.075, 0.11, materials.darkSteel, {
    x: 0.135, y: 0.19, z: 0.18, cast: false,
  });
  addBox(g, 0.06, 0.02, 0.08, materials.darkSteel, {
    x: 0.085, y: 0.245, z: 0.14, cast: false,
  });
  addTube(g, [
    [0.08, 0.225, 0.16],
    [0.05, 0.24, 0.12],
    [0.02, 0.265, 0.1],
  ], 0.012, materials.darkSteel, {
    tubularSegments: 8, radialSegments: 4, cast: false,
  });

  // Folded bipod under the barrel.
  for (const side of [-1, 1]) {
    addTube(g, [
      [side * 0.02, 0.25, 0.38],
      [side * 0.1, 0.16, 0.32],
      [side * 0.14, 0.08, 0.27],
    ], 0.008, materials.darkSteel, {
      tubularSegments: 10, radialSegments: 4, cast: false,
    });
  }
  return g;
}

function addTurretSideDoorV3(turretGroup, side, materials, {
  z = -0.52, y = 0.38, x = 1.14, width = 0.64, height = 0.50,
} = {}) {
  const mount = new THREE.Group();
  mount.position.set(side * x, y, z);
  mount.quaternion.copy(sideQuaternion(side, 0.12));
  turretGroup.add(mount);

  // Dark recessed backing, welded surround, then a proud cast door.
  addMesh(mount, extrudeRoundedBoxGeometry(width + 0.085, height + 0.085, 0.018, 0.045, 0.005), materials.darkSteel, {
    z: 0.002,
  });
  addMesh(mount, extrudeRoundedBoxGeometry(width + 0.07, height + 0.07, 0.026, 0.05, 0.006), materials.turretSteel, {
    z: 0.012,
  });
  addMesh(mount, extrudeRoundedBoxGeometry(width, height, 0.03, 0.055, 0.007), materials.castSteel, {
    z: 0.036,
  });
  addMesh(mount, extrudeRoundedBoxGeometry(width * 0.72, height * 0.58, 0.012, 0.025, 0.004), materials.castSteel, {
    z: 0.057,
  });
  addTube(mount, (() => {
    const points = roundedRectShape(width + 0.012, height + 0.012, 0.055).getPoints(48);
    return points.map((p) => V(p.x, p.y, 0.055));
  })(), 0.0045, materials.darkSteel, {
    tubularSegments: 48, radialSegments: 4, closed: true, cast: false,
  });
  // Heavy hinges along the forward edge.
  for (const yOff of [-height * 0.3, height * 0.3]) {
    addBox(mount, 0.085, 0.115, 0.06, materials.darkSteel, {
      x: -width / 2 - 0.025, y: yOff, z: 0.06, cast: false,
    });
    addCylinder(mount, 0.02, 0.02, 0.13, 10, materials.hubSteel, {
      x: -width / 2 - 0.025, y: yOff, z: 0.085, cast: false,
    });
  }
  // Rear latch and a horizontal locking bar.
  addBox(mount, 0.07, 0.16, 0.055, materials.darkSteel, {
    x: width / 2 + 0.005, y: 0, z: 0.06, cast: false,
  });
  addBox(mount, 0.26, 0.03, 0.02, materials.darkSteel, {
    x: width * 0.16, y: -height * 0.14, z: 0.065, cast: false,
  });
  addUHandle(mount, [width * 0.23, -height * 0.14, 0.07], 0.11, 0.045, 0.01, materials.hubSteel, {
    orientation: 'x', cast: false,
  });
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      addCylinderZ(mount, 0.014, 0.016, 8, materials.darkSteel, {
        x: sx * (width / 2 - 0.06), y: sy * (height / 2 - 0.06), z: 0.06, cast: false,
      });
    }
  }
  return mount;
}

function buildSpareTrackSetV3(materials, side, {
  z = 0.38, y = 0.30, x = 1.13, count = 3, yaw = null, compact = false,
} = {}) {
  const group = new THREE.Group();
  group.position.set(side * x, y, z);
  if (yaw === null) group.quaternion.copy(sideQuaternion(side, 0.12));
  else group.rotation.y = yaw;
  const linkHeight = compact ? 0.10 : 0.13;
  const linkSpacing = compact ? 0.13 : 0.18;
  const linkOffset = compact ? 0.035 : 0.042;
  const endHeight = compact ? 0.11 : 0.14;
  const bracketY = ((count - 1) / 2) * linkSpacing + 0.065;

  // Short stand-off brackets at top and bottom.
  for (const ty of [-bracketY, bracketY]) {
    addBox(group, 0.36, 0.026, 0.055, materials.darkSteel, {
      y: ty, z: 0.03, cast: false,
    });
    for (const sx of [-1, 1]) {
      addBox(group, 0.04, 0.06, 0.05, materials.darkSteel, {
        x: sx * 0.15, y: ty, z: 0.012, cast: false,
      });
    }
  }

  const plateGeo = extrudeRoundedBoxGeometry(0.55, linkHeight, 0.045, 0.018, 0.005);
  for (let i = 0; i < count; i++) {
    const yOff = (i - (count - 1) / 2) * linkSpacing;
    const xJitter = (i % 2 === 0 ? -0.02 : 0.02);
    addMesh(group, plateGeo, materials.trackSteel, {
      x: xJitter, y: yOff, z: 0.06,
    });
    // Two shallow track-shoe cleats, with a real air gap between links.
    for (const gy of [-linkOffset, linkOffset]) {
      addBox(group, 0.48, 0.02, 0.022, materials.darkSteel, {
        x: xJitter, y: yOff + gy, z: 0.086, cast: false,
      });
    }
    for (const sx of [-1, 1]) {
      addBox(group, 0.034, endHeight, 0.05, materials.darkSteel, {
        x: xJitter + sx * 0.28, y: yOff, z: 0.07, cast: false,
      });
      addCylinderX(group, 0.014, 0.06, 8, materials.darkSteel, {
        x: xJitter + sx * 0.325, y: yOff, z: 0.08, cast: false,
      });
      addCylinderX(group, 0.01, 0.018, 8, materials.darkSteel, {
        x: xJitter + sx * 0.21, y: yOff, z: 0.09, cast: false,
      });
    }
  }
  return group;
}

function addTurretSideDetailsV3(turretGroup, topY, materials) {
  // The right side carries the rectangular escape hatch. The visible left
  // side carries two stacked spare-track sets, matching the reference vehicle.
  addTurretSideDoorV3(turretGroup, -1, materials, {
    z: -0.58, y: 0.34, x: 1.14, width: 0.54, height: 0.44,
  });
  // Two compact spare-track groups wrapped around each front corner, as in
  // the reference black-studio view. Keeping them off the flat side wall
  // avoids the previous "louver panel" look.
  for (const side of [-1, 1]) {
    const yaw = side * Math.PI * 0.25;
    for (const yy of [0.255, 0.61]) {
      turretGroup.add(buildSpareTrackSetV3(materials, side, {
        x: 0.95, y: yy, z: 0.93, count: 3, yaw, compact: true,
      }));
    }
  }

  for (const side of [-1, 1]) {
    // A smaller round pistol port forward of the hatch/track sets.
    addCylinderX(turretGroup, 0.066, 0.045, 16, materials.castSteel, {
      x: side * 1.115, y: 0.47, z: -0.06, cast: false,
    });
    addCylinderX(turretGroup, 0.032, 0.052, 12, materials.darkSteel, {
      x: side * 1.13, y: 0.47, z: -0.06, cast: false,
    });
    addTorus(turretGroup, 0.067, 0.007, materials.darkSteel, {
      x: side * 1.12, y: 0.47, z: -0.06, ry: Math.PI / 2, cast: false,
    });

    // Small lifting eye at the rear shoulder.
    addUHandle(turretGroup, [side * 1.02, topY - 0.05, -1.06], 0.15, 0.08, 0.014, materials.darkSteel, {
      orientation: 'z', cast: false,
    });
  }

  // Vertical weld seams near the front and rear corners of the side armour.
  for (const side of [-1, 1]) {
    addTube(turretGroup, [
      [side * 0.99, 0.08, 1.07],
      [side * 1.02, 0.34, 1.05],
      [side * 0.99, 0.63, 1.02],
      [side * 0.94, 0.77, 0.98],
    ], 0.012, materials.weldSteel, {
      tubularSegments: 22, radialSegments: 4, cast: false,
    });
    addTube(turretGroup, [
      [side * 1.03, 0.08, -1.20],
      [side * 1.06, 0.34, -1.20],
      [side * 1.02, 0.63, -1.17],
      [side * 0.96, 0.77, -1.12],
    ], 0.01, materials.weldSteel, {
      tubularSegments: 22, radialSegments: 4, cast: false,
    });
  }

  // Rear stowage bin, supported off the turret rear plate.
  const bin = new THREE.Group();
  bin.position.set(0, 0.30, -1.50);
  addMesh(bin, extrudeRoundedBoxGeometry(1.60, 0.42, 0.44, 0.08, 0.018), materials.turretSteel);
  addMesh(bin, extrudeRoundedBoxGeometry(1.62, 0.06, 0.46, 0.06, 0.012), materials.turretSteel, {
    y: 0.24,
  });
  addBox(bin, 1.60, 0.012, 0.04, materials.weldSteel, {
    y: 0.21, z: 0.225, cast: false,
  });
  addUHandle(bin, [0, 0.268, 0], 0.32, 0.05, 0.012, materials.darkSteel, {
    orientation: 'x', cast: false,
  });
  for (const x of [-0.48, 0.48]) {
    addBox(bin, 0.035, 0.43, 0.45, materials.darkSteel, { x, cast: false });
    // Latch hardware on the rear face, where it can actually be seen.
    addBox(bin, 0.12, 0.05, 0.055, materials.hubSteel, {
      x, y: 0.11, z: -0.245, cast: false,
    });
    addBox(bin, 0.11, 0.045, 0.06, materials.darkSteel, {
      x, y: 0.205, z: -0.245, cast: false,
    });
    addCylinderX(bin, 0.017, 0.09, 8, materials.hubSteel, {
      x, y: 0.235, z: 0.205, cast: false,
    });
    addUHandle(bin, [x, 0.07, -0.265], 0.1, 0.04, 0.008, materials.darkSteel, {
      orientation: 'x', cast: false,
    });
  }
  // Central lock and two visible lower support brackets.
  addBox(bin, 0.15, 0.07, 0.08, materials.castSteel, {
    y: 0.22, z: -0.25, cast: false,
  });
  for (const x of [-0.4, 0.4]) {
    addBox(bin, 0.055, 0.055, 0.3, materials.darkSteel, {
      x, y: -0.25, z: 0.25, cast: false,
    });
    addBox(bin, 0.1, 0.12, 0.08, materials.darkSteel, {
      x, y: -0.30, z: 0.36, cast: false,
    });
  }
  turretGroup.add(bin);

  // Short protected antenna base and rod at the right rear.
  addCylinder(turretGroup, 0.065, 0.078, 0.09, 12, materials.darkSteel, {
    x: -0.67, y: topY + 0.03, z: -0.92,
  });
  addTube(turretGroup, [
    [-0.67, topY + 0.06, -0.92],
    [-0.64, topY + 0.62, -1.0],
    [-0.62, topY + 1.16, -1.06],
  ], 0.007, materials.darkSteel, {
    tubularSegments: 14, radialSegments: 4, cast: false,
  });
}

function addTurretRoofDetailsV3(turretGroup, topY, materials) {
  const cupola = buildCupolaV3(materials, topY);
  turretGroup.add(cupola);
  turretGroup.add(buildAAGunV3(materials, topY));

  // Loader's hatch on the right rear roof.
  const loader = new THREE.Group();
  loader.position.set(-0.42, topY + 0.02, -0.30);
  addCylinder(loader, 0.285, 0.31, 0.045, 26, materials.castSteel);
  addCylinder(loader, 0.255, 0.27, 0.028, 26, materials.castSteel, { y: 0.04 });
  addTorus(loader, 0.26, 0.012, materials.darkSteel, {
    y: 0.058, rx: Math.PI / 2, cast: false,
  });
  addMesh(loader, new THREE.SphereGeometry(0.22, 20, 9, 0, TAU, 0, Math.PI / 2), materials.castSteel, {
    y: 0.065, sy: 0.13,
  });
  addUHandle(loader, [0.09, 0.08, 0], 0.14, 0.05, 0.011, materials.brightSteel, {
    orientation: 'z', cast: false,
  });
  addBox(loader, 0.11, 0.03, 0.055, materials.darkSteel, {
    x: -0.19, y: 0.07, z: 0.02, cast: false,
  });
  addBox(loader, 0.11, 0.035, 0.07, materials.darkSteel, {
    x: -0.27, y: 0.035, z: 0.0, cast: false,
  });
  turretGroup.add(loader);

  // Gunner's roof sight.
  addMesh(turretGroup, extrudeRoundedBoxGeometry(0.33, 0.14, 0.3, 0.04, 0.008), materials.castSteel, {
    x: 0.31, y: topY + 0.075, z: 0.53, rx: -0.12,
  });
  addBox(turretGroup, 0.19, 0.05, 0.02, materials.optic, {
    x: 0.31, y: topY + 0.09, z: 0.69, rx: -0.12, cast: false,
  });
  addBox(turretGroup, 0.37, 0.026, 0.08, materials.darkSteel, {
    x: 0.31, y: topY + 0.15, z: 0.44, rx: -0.12, cast: false,
  });

  // Low ventilator dome.
  addCylinder(turretGroup, 0.16, 0.18, 0.045, 22, materials.castSteel, {
    x: -0.02, y: topY + 0.035, z: -0.12,
  });
  addMesh(turretGroup, new THREE.SphereGeometry(0.14, 20, 10, 0, TAU, 0, Math.PI / 2), materials.darkSteel, {
    x: -0.02, y: topY + 0.065, z: -0.12, sy: 0.30,
  });
  addTorus(turretGroup, 0.14, 0.008, materials.darkSteel, {
    x: -0.02, y: topY + 0.07, z: -0.12, rx: Math.PI / 2, cast: false,
  });

  // Lifting eyes and small grab handles.
  const eyes = [
    [0.77, 0.86], [-0.77, 0.86], [0.74, -1.02], [-0.74, -1.02],
  ];
  for (const [x, z] of eyes) {
    addUHandle(turretGroup, [x, topY + 0.018, z], 0.15, 0.065, 0.014, materials.darkSteel, {
      orientation: 'x', cast: false,
    });
  }
  addUHandle(turretGroup, [0, topY + 0.02, 0.24], 0.27, 0.05, 0.012, materials.darkSteel, {
    orientation: 'x', cast: false,
  });

  // Rain gutter over the loader hatch.
  addBox(turretGroup, 0.56, 0.022, 0.05, materials.darkSteel, {
    x: -0.42, y: topY + 0.09, z: 0.02, cast: false,
  });
}

function buildTurretV3(materials) {
  const turret = new THREE.Group();
  turret.position.set(0, 2.0, -0.08);
  turret.name = 'henschel-turret';

  const shell = buildTurretShellV3(materials);
  turret.add(shell.group);
  const { gun, muzzleTip } = buildMantletAndGunV3(turret, materials);
  addTurretRoofDetailsV3(turret, shell.topY, materials);
  addTurretSideDetailsV3(turret, shell.topY, materials);

  turret.rotation.y = -0.015;
  return { turretGroup: turret, gun, muzzleTip, topY: shell.topY };
}

/* ------------------------------------------------------------------ *
 * Assembly                                                            *
 * ------------------------------------------------------------------ */

export function buildTank(materials) {
  const root = new THREE.Group();
  root.name = 'Tiger II bare steel';
  const tank = new THREE.Group();
  tank.name = 'Pz.Kpfw. VI Ausf. B / Henschel turret';
  root.add(tank);

  const { group: hull } = buildHull(materials);
  tank.add(hull);

  const wheelGroup = buildWheelsDished(materials);
  tank.add(wheelGroup);
  tank.add(buildSprocket(1, materials));
  tank.add(buildSprocket(-1, materials));
  tank.add(buildIdler(1, materials));
  tank.add(buildIdler(-1, materials));

  const trackCurve = createTrackCurve();
  tank.add(buildTrackLinks(trackCurve, 1, materials));
  tank.add(buildTrackLinks(trackCurve, -1, materials));
  tank.add(buildFenders(materials));

  const { turretGroup, gun, muzzleTip, topY } = buildTurretV3(materials);
  tank.add(turretGroup);

  // Make every solid part cast and receive shadows, except deliberate tiny
  // internal blocks and optic inserts.
  tank.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = obj.castShadow !== false;
      obj.receiveShadow = true;
    }
  });

  const annotations = {
    gun: V(0.05, 2.49, 5.05),
    turret: V(0.78, 2.58, 0.25),
    armor: V(0.62, 1.62, 2.9),
    wheels: V(1.6, 0.56, -1.28),
    engine: V(-0.55, 2.1, -2.55),
  };

  return {
    root,
    tank,
    turretGroup,
    gun,
    muzzleTip,
    turretTop: topY,
    annotations,
  };
}
