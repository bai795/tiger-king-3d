import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Small deterministic PRNG so every reload produces the same vehicle. *
 * ------------------------------------------------------------------ */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function finishTexture(canvas, { srgb = true, repeat = null, anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

/* ------------------------------------------------------------------ *
 * Equirectangular hall backdrop.                                      *
 * ------------------------------------------------------------------ */
export function createBackgroundTexture() {
  const w = 2048;
  const h = 1024;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(48);

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#020403');
  base.addColorStop(0.28, '#070b09');
  base.addColorStop(0.48, '#131712');
  base.addColorStop(0.55, '#0d110e');
  base.addColorStop(0.68, '#080a08');
  base.addColorStop(1, '#030403');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Warm pools of overhead light bleeding into the haze.
  ctx.globalCompositeOperation = 'lighter';
  const glows = [
    [0.17, 0.47, 0.22, 'rgba(148, 108, 57, 0.20)'],
    [0.44, 0.50, 0.30, 'rgba(104, 112, 87, 0.13)'],
    [0.71, 0.45, 0.20, 'rgba(155, 104, 50, 0.16)'],
    [0.90, 0.53, 0.18, 'rgba(78, 97, 78, 0.12)'],
  ];
  for (const [x, y, r, color] of glows) {
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Hazy horizon.
  const haze = ctx.createLinearGradient(0, h * 0.46, 0, h * 0.64);
  haze.addColorStop(0, 'rgba(70, 66, 50, 0)');
  haze.addColorStop(0.48, 'rgba(92, 82, 60, 0.10)');
  haze.addColorStop(1, 'rgba(30, 31, 25, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.4, w, h * 0.3);

  // Faint distant structure / vertical light strips.
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) {
    const x = ((i + 0.35) / 18) * w;
    const alpha = 0.025 + rnd() * 0.04;
    ctx.strokeStyle = `rgba(178, 163, 126, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, h * (0.18 + rnd() * 0.06));
    ctx.lineTo(x + (rnd() - 0.5) * 6, h * (0.45 + rnd() * 0.12));
    ctx.stroke();
  }

  // Suspended dust / bokeh.
  for (let i = 0; i < 220; i++) {
    const x = rnd() * w;
    const y = h * (0.18 + rnd() * 0.48);
    const r = 1 + rnd() * 4.5;
    ctx.fillStyle = `rgba(225, 202, 158, ${0.03 + rnd() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft film grain.
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.012})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Blend the horizontal seam before it reaches the texture edge.
  const edgeFade = ctx.createLinearGradient(0, 0, w, 0);
  edgeFade.addColorStop(0, 'rgba(3,4,3,0.75)');
  edgeFade.addColorStop(0.035, 'rgba(3,4,3,0)');
  edgeFade.addColorStop(0.965, 'rgba(3,4,3,0)');
  edgeFade.addColorStop(1, 'rgba(3,4,3,0.75)');
  ctx.fillStyle = edgeFade;
  ctx.fillRect(0, 0, w, h);

  const texture = finishTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/* ------------------------------------------------------------------ *
 * Studio environment map. Gives the armour, brass and tracks a         *
 * believable set of reflections without any external HDRI.             *
 * ------------------------------------------------------------------ */
export function createEnvironmentTexture() {
  const w = 1024;
  const h = 512;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#090b09');
  base.addColorStop(0.45, '#161712');
  base.addColorStop(0.54, '#080a08');
  base.addColorStop(1, '#020302');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'lighter';
  const soft = (x, y, rx, ry, stops, rotation = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [p, c] of stops) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  };

  // Large overhead softboxes.
  soft(w * 0.33, h * 0.18, w * 0.34, h * 0.18, [
    [0, 'rgba(255, 249, 238, 0.95)'],
    [0.18, 'rgba(242, 246, 242, 0.42)'],
    [1, 'rgba(230, 238, 238, 0)'],
  ]);
  soft(w * 0.74, h * 0.28, w * 0.18, h * 0.12, [
    [0, 'rgba(200, 222, 230, 0.65)'],
    [0.35, 'rgba(146, 173, 182, 0.22)'],
    [1, 'rgba(80, 100, 110, 0)'],
  ]);
  soft(w * 0.08, h * 0.47, w * 0.12, h * 0.08, [
    [0, 'rgba(214, 198, 174, 0.30)'],
    [1, 'rgba(150, 140, 120, 0)'],
  ]);
  soft(w * 0.56, h * 0.50, w * 0.09, h * 0.05, [
    [0, 'rgba(166, 188, 179, 0.23)'],
    [1, 'rgba(90, 120, 110, 0)'],
  ]);

  // Broad, low horizon panels. Vertical armour has no upward-facing surface
  // to catch the key, so these large soft sources are what make the raw steel
  // sides read as metal rather than flat grey.
  soft(w * 0.14, h * 0.47, w * 0.2, h * 0.12, [
    [0, 'rgba(236, 239, 233, 0.58)'],
    [0.35, 'rgba(180, 190, 187, 0.22)'],
    [1, 'rgba(120, 130, 126, 0)'],
  ]);
  soft(w * 0.5, h * 0.52, w * 0.25, h * 0.11, [
    [0, 'rgba(206, 218, 220, 0.5)'],
    [0.4, 'rgba(140, 158, 162, 0.18)'],
    [1, 'rgba(80, 95, 100, 0)'],
  ]);
  soft(w * 0.86, h * 0.45, w * 0.2, h * 0.11, [
    [0, 'rgba(226, 228, 219, 0.55)'],
    [0.42, 'rgba(164, 174, 168, 0.18)'],
    [1, 'rgba(100, 110, 104, 0)'],
  ]);

  // A few hard-ish highlight strips for metal glints.
  const strip = ctx.createLinearGradient(0, h * 0.34, 0, h * 0.36);
  strip.addColorStop(0, 'rgba(255, 240, 210, 0)');
  strip.addColorStop(0.5, 'rgba(255, 249, 238, 0.32)');
  strip.addColorStop(1, 'rgba(255, 240, 210, 0)');
  ctx.fillStyle = strip;
  ctx.fillRect(0, h * 0.335, w, h * 0.03);

  const texture = finishTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/* ------------------------------------------------------------------ *
 * Dark ribbed steel panels for the surrounding hall wall.             *
 * ------------------------------------------------------------------ */
export function createWallTexture() {
  const w = 2048;
  const h = 1024;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(902);

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#151a14');
  base.addColorStop(0.35, '#232920');
  base.addColorStop(0.72, '#1a1f19');
  base.addColorStop(1, '#10140f');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Vertical panel bays with slightly varied tonal fields.
  const bay = w / 8;
  for (let i = 0; i < 8; i++) {
    const x = i * bay;
    ctx.fillStyle = i % 2 ? 'rgba(160, 159, 130, 0.022)' : 'rgba(0, 0, 0, 0.035)';
    ctx.fillRect(x, 0, bay, h);
    ctx.fillStyle = 'rgba(4, 6, 4, 0.5)';
    ctx.fillRect(x, 0, 5, h);
    ctx.fillStyle = 'rgba(184, 177, 145, 0.035)';
    ctx.fillRect(x + 6, 0, 1, h);
  }

  // Horizontal beams / panel seams.
  for (const y of [0.11, 0.38, 0.68, 0.94]) {
    ctx.fillStyle = 'rgba(3, 5, 3, 0.56)';
    ctx.fillRect(0, y * h, w, 5);
    ctx.fillStyle = 'rgba(178, 170, 140, 0.045)';
    ctx.fillRect(0, y * h + 6, w, 1);
  }

  // Rivet rows.
  for (let bayIndex = 0; bayIndex < 8; bayIndex++) {
    for (let y = 30; y < h; y += 67) {
      const x = bayIndex * bay + 17;
      ctx.fillStyle = 'rgba(2, 4, 2, 0.38)';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(193, 184, 151, 0.07)';
      ctx.beginPath();
      ctx.arc(x - 0.7, y - 0.7, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Large industrial stains and water streaks.
  for (let i = 0; i < 34; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 20 + rnd() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(3, 5, 3, ${0.04 + rnd() * 0.13})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 90; i++) {
    const x = rnd() * w;
    const y = rnd() * h * 0.75;
    const len = 20 + rnd() * 210;
    const grad = ctx.createLinearGradient(0, y, 0, y + len);
    grad.addColorStop(0, `rgba(73, 65, 45, ${0.015 + rnd() * 0.045})`);
    grad.addColorStop(1, 'rgba(73, 65, 45, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, 1 + rnd() * 4, len);
  }

  // Sparse lighter chipped edges.
  for (let i = 0; i < 80; i++) {
    ctx.strokeStyle = `rgba(184, 177, 150, ${0.02 + rnd() * 0.08})`;
    ctx.lineWidth = 0.7 + rnd() * 1.2;
    ctx.beginPath();
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + rnd() * 45, y + (rnd() - 0.5) * 4);
    ctx.stroke();
  }

  // Subtle grain.
  for (let i = 0; i < 7000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.012})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1, 1);
  }

  const texture = finishTexture(canvas, { repeat: [4, 1], anisotropy: 8 });
  return texture;
}

/* ------------------------------------------------------------------ *
 * Concrete for the surrounding hall floor.                            *
 * ------------------------------------------------------------------ */
export function createConcreteTexture() {
  const s = 1024;
  const canvas = makeCanvas(s, s);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(101);

  ctx.fillStyle = '#30322c';
  ctx.fillRect(0, 0, s, s);

  // Broad tonal patches.
  for (let i = 0; i < 90; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const r = 30 + rnd() * 190;
    const dark = rnd() > 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, dark ? 'rgba(15,17,14,0.12)' : 'rgba(124,118,97,0.055)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Aggregate speckle.
  for (let i = 0; i < 14000; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.55
      ? `rgba(176,170,144,${0.025 + rnd() * 0.11})`
      : `rgba(8,10,8,${0.04 + rnd() * 0.15})`;
    const r = 0.4 + rnd() * 1.6;
    ctx.fillRect(rnd() * s, rnd() * s, r, r);
  }

  // Hairline cracks.
  ctx.strokeStyle = 'rgba(10,11,9,0.34)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 16; i++) {
    let x = rnd() * s;
    let y = rnd() * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let angle = rnd() * Math.PI * 2;
    for (let j = 0; j < 9; j++) {
      angle += (rnd() - 0.5) * 0.9;
      x += Math.cos(angle) * (8 + rnd() * 28);
      y += Math.sin(angle) * (8 + rnd() * 28);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Smeared oil / water marks.
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.translate(rnd() * s, rnd() * s);
    ctx.rotate(rnd() * Math.PI);
    ctx.scale(1 + rnd() * 2.4, 0.2 + rnd() * 0.7);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 40 + rnd() * 45);
    g.addColorStop(0, 'rgba(7,9,8,0.16)');
    g.addColorStop(0.7, 'rgba(16,19,16,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return finishTexture(canvas, { repeat: [9, 9], anisotropy: 16 });
}

/* ------------------------------------------------------------------ *
 * Worn technical markings printed on the display platform.            *
 * ------------------------------------------------------------------ */
export function createPlatformMarkingsTexture() {
  const s = 2048;
  const canvas = makeCanvas(s, s);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(327);
  const cx = s / 2;
  const cy = s / 2;
  const scale = s / 16; // platform is 16 m across

  ctx.clearRect(0, 0, s, s);

  const ring = (radius, width, alpha) => {
    ctx.strokeStyle = `rgba(206, 195, 164, ${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  };

  ring(7.55, 3, 0.34);
  ring(7.28, 1.2, 0.2);
  ring(5.2, 1.4, 0.16);
  ring(2.4, 1, 0.12);

  // Graduated arc and ticks.
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const major = i % 6 === 0;
    const r0 = 6.95;
    const r1 = major ? 7.22 : 7.1;
    ctx.strokeStyle = `rgba(211, 198, 163, ${major ? 0.34 : 0.16})`;
    ctx.lineWidth = major ? 2.4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0 * scale, Math.sin(a) * r0 * scale);
    ctx.lineTo(Math.cos(a) * r1 * scale, Math.sin(a) * r1 * scale);
    ctx.stroke();
  }
  ctx.restore();

  // Crosshair and corner brackets.
  ctx.strokeStyle = 'rgba(201, 191, 162, 0.18)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([8, 13]);
  ctx.beginPath();
  ctx.moveTo(cx - 7.35 * scale, cy);
  ctx.lineTo(cx + 7.35 * scale, cy);
  ctx.moveTo(cx, cy - 7.35 * scale);
  ctx.lineTo(cx, cy + 7.35 * scale);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arc text.
  const arcText = (text, radius, startAngle, size, alpha, spacing = 1.08) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = `rgba(218, 208, 181, ${alpha})`;
    ctx.font = `600 ${size}px "Bahnschrift", "Arial Narrow", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = [...text];
    const widths = chars.map((c) => ctx.measureText(c).width * spacing);
    const total = widths.reduce((a, b) => a + b, 0);
    let angle = startAngle - (total / radius) / 2;
    for (let i = 0; i < chars.length; i++) {
      const step = widths[i] / radius;
      angle += step / 2;
      ctx.save();
      ctx.rotate(angle);
      ctx.translate(0, -radius);
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
      angle += step / 2;
    }
    ctx.restore();
  };

  arcText('PANZERKAMPFWAGEN VI AUSF. B 路 Sd.Kfz. 182', 6.62, -Math.PI / 2, 46, 0.38, 1.06);
  arcText('SCHWERER PANZER 路 1944', 7.75, -Math.PI / 2, 31, 0.22, 1.12);

  // Rectangular data plates, subtly scuffed.
  const plate = (x, y, w, h, label, value) => {
    ctx.save();
    ctx.translate(x * scale, y * scale);
    ctx.strokeStyle = 'rgba(204, 194, 165, 0.24)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-w * scale * 0.5, -h * scale * 0.5, w * scale, h * scale);
    ctx.fillStyle = 'rgba(215, 204, 173, 0.26)';
    ctx.textAlign = 'center';
    ctx.font = '500 28px "Bahnschrift", "Arial Narrow", sans-serif';
    ctx.fillText(label, 0, -6);
    ctx.font = '700 42px "Bahnschrift", "Arial Narrow", sans-serif';
    ctx.fillText(value, 0, 38);
    ctx.restore();
  };
  plate(-4.3, 3.0, 2.3, 1.1, 'COMBAT MASS', '69.8 t');
  plate(4.3, 3.0, 2.3, 1.1, 'MAIN ARMAMENT', '8.8 cm');

  // Weather the print away in irregular patches.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2400; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const r = 0.4 + rnd() * 4.5;
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 50; i++) {
    ctx.save();
    ctx.translate(rnd() * s, rnd() * s);
    ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.5})`;
    ctx.fillRect(0, 0, 20 + rnd() * 120, 1 + rnd() * 2.5);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';

  return finishTexture(canvas, { anisotropy: 16 });
}

/* ------------------------------------------------------------------ *
 * Historical decals. No political symbols: generic tactical numbering  *
 * and Balkenkreuz identification marks only.                          *
 * ------------------------------------------------------------------ */
export function createTurretNumberTexture(number = '332') {
  const w = 512;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(332);

  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 196px "Bahnschrift Condensed", "Bahnschrift", "Arial Narrow", Impact, sans-serif';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(235, 228, 207, 0.94)';
  ctx.lineWidth = 12;
  ctx.strokeText(number, w / 2, h / 2 + 8);

  // Chipped paint inside the stencil outline.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 190; i++) {
    const x = w * (0.2 + rnd() * 0.6);
    const y = h * (0.2 + rnd() * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + rnd() * 3.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.6})`;
    ctx.fill();
  }
  for (let i = 0; i < 10; i++) {
    ctx.save();
    ctx.translate(w * (0.15 + rnd() * 0.7), h * (0.2 + rnd() * 0.6));
    ctx.rotate(rnd() * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 10 + rnd() * 50, 1 + rnd() * 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  return finishTexture(canvas, { anisotropy: 16 });
}

export function createBalkenkreuzTexture() {
  const s = 256;
  const canvas = makeCanvas(s, s);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(96);

  ctx.clearRect(0, 0, s, s);
  const drawCross = (arm, thickness, style) => {
    ctx.fillStyle = style;
    ctx.fillRect(s / 2 - thickness / 2, s / 2 - arm / 2, thickness, arm);
    ctx.fillRect(s / 2 - arm / 2, s / 2 - thickness / 2, arm, thickness);
  };
  drawCross(s * 0.82, s * 0.3, 'rgba(234, 227, 207, 0.92)');
  drawCross(s * 0.72, s * 0.2, 'rgba(20, 23, 20, 0.94)');

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.12 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rnd() * s, rnd() * s, 0.5 + rnd() * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return finishTexture(canvas, { anisotropy: 8 });
}

export function createStencilTexture(text, {
  width = 1024,
  height = 256,
  font = '600 92px "Bahnschrift", "Arial Narrow", sans-serif',
  color = 'rgba(224, 216, 194, 0.8)',
  wear = 0.18,
} = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(741);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 4);

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < width * height * wear * 0.006; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.45})`;
    ctx.beginPath();
    ctx.arc(rnd() * width, rnd() * height, 0.4 + rnd() * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return finishTexture(canvas, { anisotropy: 8 });
}

/* ------------------------------------------------------------------ *
 * Utility sprites.                                                    *
 * ------------------------------------------------------------------ */
export function createGlowTexture(size = 256) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.78)');
  g.addColorStop(0.44, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finishTexture(canvas, { srgb: false });
}

export function createDustTexture(size = 128) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finishTexture(canvas, { srgb: false });
}

export function createSmokeTexture(size = 512) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(199);
  ctx.clearRect(0, 0, size, size);

  // Layered soft blobs make a less perfectly circular cloud.
  for (let i = 0; i < 22; i++) {
    const x = size / 2 + (rnd() - 0.5) * size * 0.36;
    const y = size / 2 + (rnd() - 0.5) * size * 0.34;
    const r = size * (0.1 + rnd() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.05 + rnd() * 0.07})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, 'rgba(255,255,255,0.35)');
  fade.addColorStop(0.6, 'rgba(255,255,255,0.16)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  return finishTexture(canvas, { srgb: false });
}

/* ------------------------------------------------------------------ *
 * Canvas texture to make a painted wood crate for the display base.   *
 * ------------------------------------------------------------------ */
export function createCrateTexture() {
  const s = 512;
  const canvas = makeCanvas(s, s);
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(221);
  ctx.fillStyle = '#5a4b35';
  ctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 9; i++) {
    const y = (i / 9) * s;
    ctx.fillStyle = i % 2 ? 'rgba(25,19,12,0.14)' : 'rgba(203,178,129,0.06)';
    ctx.fillRect(0, y, s, s / 9);
    ctx.strokeStyle = 'rgba(20,15,10,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y + (rnd() - 0.5) * 5);
    ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(38, 27, 17, ${0.04 + rnd() * 0.13})`;
    ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath();
    const y = rnd() * s;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(s * 0.3, y + rnd() * 12, s * 0.7, y - rnd() * 12, s, y + rnd() * 5);
    ctx.stroke();
  }

  // Diagonal braces.
  ctx.strokeStyle = 'rgba(35,28,19,0.38)';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.lineTo(s - 10, s - 10);
  ctx.moveTo(s - 10, 10);
  ctx.lineTo(10, s - 10);
  ctx.stroke();

  // Stencil.
  ctx.fillStyle = 'rgba(216, 207, 181, 0.5)';
  ctx.font = '700 54px "Bahnschrift", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('8,8 cm', s / 2, s / 2 - 12);
  ctx.font = '600 34px "Bahnschrift", "Arial Narrow", sans-serif';
  ctx.fillText('KWK 43', s / 2, s / 2 + 34);
  return finishTexture(canvas, { anisotropy: 8 });
}

