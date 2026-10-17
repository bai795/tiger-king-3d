import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { buildEnvironment } from './environment.js';
import { buildTank } from './tank.js';
import { createTankMaterials } from './materials.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const clamp = THREE.MathUtils.clamp;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const canvas = $('#scene');
const loader = $('#loader');
const progressBar = $('#progressBar');
const loadingText = $('#loadingText');
const loadingPct = $('#loadingPct');
const archiveModal = $('#archiveModal');
const toastEl = $('#toast');
const fatalEl = $('#fatal');
const fatalMessage = $('#fatalMessage');

const params = new URLSearchParams(window.location.search);
const SNAP = params.get('snap') === '1';
const STILL = params.get('still') === '1';
const UI_OFF = params.get('ui') === '0';
const FORCED_VIEW = params.get('view');
const FORCED_ANNOTATIONS = params.get('annotations') === '1';
const CUSTOM_CAM = parseVector(params.get('cam'));
const CUSTOM_LOOK = parseVector(params.get('look'));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (UI_OFF) document.body.classList.add('capture-mode');

function parseVector(value) {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? new THREE.Vector3(...parts) : null;
}

const state = {
  ready: false,
  failed: false,
  currentView: 'hero',
  autoRotate: false,
  annotations: FORCED_ANNOTATIONS,
  cameraTween: null,
  interacted: false,
  introPlayed: false,
  lastReadout: 0,
};

let renderer;
let scene;
let camera;
let controls;
let environment;
let tank;
let materials;
let clock;
let hotspotEntries = [];
let toastTimer = 0;
let animationStarted = false;
let inspectionLight;
let inspectionTarget;

const VIEWS = {
  hero: {
    label: '全景',
    mode: '三视角 · 全景',
    target: new THREE.Vector3(0, 1.56, 1.0),
    position: new THREE.Vector3(7.8, 4.8, 11.9),
  },
  front: {
    label: '正前',
    mode: '正面 · 火力轴线',
    target: new THREE.Vector3(0, 1.45, 2.1),
    position: new THREE.Vector3(1.7, 3.0, 15.2),
  },
  profile: {
    label: '侧翼',
    mode: '侧翼 · 行走机构',
    target: new THREE.Vector3(0, 1.55, 0.92),
    position: new THREE.Vector3(13.4, 3.1, 1.3),
  },
  rear: {
    label: '尾后',
    mode: '尾后 · 动力舱',
    target: new THREE.Vector3(0, 1.55, -0.2),
    position: new THREE.Vector3(-7.2, 3.9, -10.4),
  },
  turret: {
    label: '炮塔',
    mode: '近景 · 亨舍尔炮塔',
    target: new THREE.Vector3(0, 2.3, 1.0),
    position: new THREE.Vector3(5.8, 3.65, 8.0),
  },
};

const INTRO = {
  target: new THREE.Vector3(0, 1.2, 1.3),
  position: new THREE.Vector3(11.5, 7.6, 17.6),
};

const HOTSPOTS = [
  {
    id: 'gun',
    title: '8.8 cm KwK 43 L/71',
    note: '71 倍径长身管 · 双室炮口制退器',
    anchor: 'gun',
    normal: new THREE.Vector3(0, 1, 0),
  },
  {
    id: 'armor',
    title: '150 mm 倾斜首上装甲',
    note: '约 50° 倾角 · 等效防护',
    anchor: 'armor',
    normal: new THREE.Vector3(0, 0.76, 0.65),
  },
  {
    id: 'turret',
    title: '亨舍尔炮塔',
    note: '平面炮塔正面 · 180 mm 装甲',
    anchor: 'turret',
    normal: new THREE.Vector3(0.8, 0.3, 0.35),
  },
  {
    id: 'wheels',
    title: '交错式负重轮',
    note: '18 轮/侧 · 800 mm 宽履带',
    anchor: 'wheels',
    normal: new THREE.Vector3(1, 0, 0),
  },
  {
    id: 'engine',
    title: 'Maybach HL 230 P30',
    note: '700 PS · 后置动力舱',
    anchor: 'engine',
    normal: new THREE.Vector3(0.4, 0.8, 0.4),
  },
];

window.addEventListener('error', (event) => {
  if (!state.ready) showFatal(friendlyError(event.error || event.message));
  console.error('[Tiger II]', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  if (!state.ready) showFatal(friendlyError(event.reason?.message || event.reason));
  console.error('[Tiger II] unhandled rejection', event.reason);
});

function friendlyError(message) {
  if (!message) return '场景初始化失败。请尝试重新载入页面。';
  return String(message).slice(0, 180);
}

function showFatal(message) {
  if (state.failed) return;
  state.failed = true;
  if (fatalMessage) fatalMessage.textContent = message;
  if (loader) loader.hidden = true;
  if (fatalEl) fatalEl.hidden = false;
  document.body.classList.remove('is-loading');
}

function setLoading(text, percent) {
  if (loadingText) loadingText.textContent = text;
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (loadingPct) loadingPct.textContent = String(Math.round(percent)).padStart(2, '0');
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x050806, 1);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.fov = responsiveFov();
  camera.updateProjectionMatrix();

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 4.6;
  controls.maxDistance = 30;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.52;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 0.8;
  controls.autoRotateSpeed = 0.62;
  controls.target.copy(VIEWS.hero.target);

  controls.addEventListener('start', onManualInteraction);

  // A gentle camera-side fill keeps the visible flank legible at every angle
  // without flattening the key light's form-defining shadows.
  inspectionLight = new THREE.DirectionalLight(0xdde6e5, 2.0);
  inspectionLight.castShadow = false;
  inspectionTarget = new THREE.Object3D();
  inspectionLight.target = inspectionTarget;
  scene.add(inspectionLight, inspectionTarget);

  canvas.addEventListener('pointerdown', markInteracted, { passive: true });
  canvas.addEventListener('wheel', markInteracted, { passive: true });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showFatal('WebGL 绘图上下文已丢失，请重新载入页面。');
  });
}

function onManualInteraction() {
  if (state.cameraTween) state.cameraTween = null;
  if (state.autoRotate) {
    state.autoRotate = false;
    controls.autoRotate = false;
    updateAutoUI();
  }
  markInteracted();
  state.currentView = 'free';
  updateViewUI('free');
  setRailMode('自由观察');
}

function markInteracted() {
  if (state.interacted) return;
  state.interacted = true;
  document.body.classList.add('is-interacted');
}

function aspectFactor() {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  if (aspect < 0.62) return 1.7;
  if (aspect < 0.82) return 1.45;
  if (aspect < 1.15) return 1.18;
  return 1;
}

function responsiveFov() {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  if (aspect < 0.62) return 48;
  if (aspect < 0.82) return 40;
  if (aspect < 1.08) return 35;
  return 32;
}

function resolvePose(viewName) {
  const view = VIEWS[viewName] || VIEWS.hero;
  const factor = aspectFactor();
  const target = view.target.clone();
  const position = view.position.clone().sub(target).multiplyScalar(factor).add(target);
  return { position, target };
}

function applyPose(position, target) {
  camera.position.copy(position);
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();
}

function tweenTo(position, target, duration = 1300, easing = easeInOutCubic) {
  state.cameraTween = {
    startTime: performance.now(),
    duration: reducedMotion ? 0 : duration,
    fromPosition: camera.position.clone(),
    toPosition: position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone(),
    easing,
  };
}

function setView(viewName, { instant = false, duration = 1300, mark = true } = {}) {
  const view = VIEWS[viewName] ? viewName : 'hero';
  if (state.autoRotate) {
    state.autoRotate = false;
    controls.autoRotate = false;
    updateAutoUI();
  }
  state.currentView = view;
  state.cameraTween = null;
  const pose = resolvePose(view);
  if (instant || reducedMotion) {
    applyPose(pose.position, pose.target);
  } else {
    tweenTo(pose.position, pose.target, duration);
  }
  updateViewUI(view);
  setRailMode((VIEWS[view].label) + '视角');
  if (mark) markInteracted();
}

function setCameraDirect(position, target) {
  state.cameraTween = null;
  applyPose(position, target);
  state.currentView = 'free';
  updateViewUI('free');
  setRailMode('自由观察');
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function updateViewUI(viewName) {
  $$('.view-btn').forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function setRailMode(text) {
  const el = $('#railMode');
  if (el) el.textContent = text;
}

function updateAutoUI() {
  const btn = $('#autoBtn');
  if (!btn) return;
  btn.setAttribute('aria-pressed', state.autoRotate ? 'true' : 'false');
  btn.classList.toggle('is-on', state.autoRotate);
}

function toggleAutoRotate() {
  if (!state.ready) return;
  if (state.cameraTween) state.cameraTween = null;
  state.autoRotate = !state.autoRotate;
  controls.autoRotate = state.autoRotate;
  updateAutoUI();
  if (state.autoRotate) {
    state.currentView = 'free';
    updateViewUI('free');
    setRailMode('自动环绕');
  } else {
    setRailMode('自由观察');
  }
  markInteracted();
}

function toggleAnnotations(force) {
  state.annotations = typeof force === 'boolean' ? force : !state.annotations;
  document.body.classList.toggle('annotations-on', state.annotations);
  const btn = $('#annotBtn');
  if (btn) btn.setAttribute('aria-pressed', state.annotations ? 'true' : 'false');
  if (state.annotations) {
    hotspotEntries.forEach((entry) => {
      entry.el.style.opacity = '';
    });
    showToast('结构标注已开启');
  } else {
    showToast('结构标注已关闭');
  }
}

function buildHotspots() {
  const root = $('#hotspots');
  if (!root) return;
  root.innerHTML = '';
  hotspotEntries = HOTSPOTS.map((item, index) => {
    const el = document.createElement('div');
    el.className = 'hotspot';
    el.dataset.hotspot = item.id;
    el.innerHTML = `
      <span class="hotspot-dot" aria-hidden="true"></span>
      <span class="hotspot-line" aria-hidden="true"></span>
      <span class="hotspot-label">
        <span class="hotspot-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="hotspot-copy">
          <strong>${item.title}</strong>
          <small>${item.note}</small>
        </span>
      </span>
    `;
    root.appendChild(el);
    return {
      ...item,
      el,
      anchorWorld: tank.annotations[item.anchor].clone().add(tank.root.position),
    };
  });
  document.body.classList.toggle('annotations-on', state.annotations);
  const btn = $('#annotBtn');
  if (btn) btn.setAttribute('aria-pressed', state.annotations ? 'true' : 'false');
}

function updateHotspots() {
  if (!state.annotations || !hotspotEntries.length) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const projected = new THREE.Vector3();
  const cameraDir = new THREE.Vector3();
  camera.getWorldDirection(cameraDir);
  camera.updateMatrixWorld();

  for (const entry of hotspotEntries) {
    projected.copy(entry.anchorWorld).project(camera);
    const inFront = projected.z > -1 && projected.z < 1;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const towardCamera = new THREE.Vector3().subVectors(camera.position, entry.anchorWorld);
    const facing = entry.normal.dot(towardCamera) > 0.35;
    const onScreen = x > 54 && x < width - 54 && y > 120 && y < height - 122;
    const visible = inFront && facing && onScreen;
    if (visible) {
      entry.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      const flipThreshold = width < 700 ? width * 0.54 : width * 0.61;
      entry.el.classList.toggle('is-flipped', x > flipThreshold);
    }
    entry.el.classList.toggle('is-visible', visible);
  }
}

function updateReadout(now) {
  if (now - state.lastReadout < 100) return;
  state.lastReadout = now;
  const direction = camera.position.clone().sub(controls.target);
  const distance = direction.length();
  const azimuth = (THREE.MathUtils.radToDeg(Math.atan2(direction.x, direction.z)) + 360) % 360;
  const elevation = THREE.MathUtils.radToDeg(Math.asin(clamp(direction.y / Math.max(distance, 0.001), -1, 1)));
  const azEl = $('#readAz');
  const elEl = $('#readEl');
  const distEl = $('#readDist');
  if (azEl) azEl.textContent = `${String(Math.round(azimuth)).padStart(3, '0')}°`;
  if (elEl) elEl.textContent = `${elevation >= 0 ? '+' : '−'}${String(Math.abs(Math.round(elevation))).padStart(2, '0')}°`;
  if (distEl) distEl.textContent = `${distance.toFixed(1)} m`;
}

function animateCamera() {
  const tween = state.cameraTween;
  if (!tween) {
    controls.update();
    return;
  }
  const elapsed = performance.now() - tween.startTime;
  const raw = tween.duration <= 0 ? 1 : clamp(elapsed / tween.duration, 0, 1);
  const eased = tween.easing(raw);
  camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
  controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
  camera.lookAt(controls.target);
  if (raw >= 1) {
    state.cameraTween = null;
    controls.update();
  }
}

function animate(timestamp) {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (state.ready) {
    animateCamera();
    if (!STILL && !reducedMotion) environment.update(elapsed, dt);
    if (inspectionLight && inspectionTarget) {
      inspectionLight.position.copy(camera.position);
      inspectionTarget.position.copy(controls.target);
      inspectionTarget.updateMatrixWorld();
    }
    updateReadout(performance.now());
    updateHotspots();
  }

  renderer.render(scene, camera);
}

function resize() {
  if (!renderer || !camera) return;
  const width = window.innerWidth;
  const height = Math.max(window.innerHeight, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = responsiveFov();
  camera.updateProjectionMatrix();
}

function setupUI() {
  $$('.view-btn').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  $('#autoBtn')?.addEventListener('click', toggleAutoRotate);
  $('#annotBtn')?.addEventListener('click', () => toggleAnnotations());
  $('#resetBtn')?.addEventListener('click', () => setView('hero'));
  $('#brand')?.addEventListener('click', (event) => {
    event.preventDefault();
    setView('hero');
  });
  $('#archiveBtn')?.addEventListener('click', openArchive);
  $('#infoBtn')?.addEventListener('click', openArchive);
  $('#shotBtn')?.addEventListener('click', saveScreenshot);
  $('#fullscreenBtn')?.addEventListener('click', toggleFullscreen);
  $('#retryBtn')?.addEventListener('click', () => window.location.reload());
  $$('[data-close-modal]').forEach((el) => el.addEventListener('click', closeArchive));

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const key = event.key.toLowerCase();
    if (archiveModal && !archiveModal.hidden) {
      if (key === 'escape') closeArchive();
      return;
    }
    if (key === '1') setView('hero');
    else if (key === '2') setView('front');
    else if (key === '3') setView('profile');
    else if (key === '4') setView('rear');
    else if (key === '5') setView('turret');
    else if (key === 'r') setView('hero');
    else if (key === 'a') toggleAutoRotate();
    else if (key === 'n') toggleAnnotations();
    else if (key === 'i') openArchive();
    else if (key === 'f') toggleFullscreen();
    else if (key === 'escape') closeArchive();
    else if (key === ' ' && event.target === document.body) {
      event.preventDefault();
      toggleAutoRotate();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const button = $('#fullscreenBtn');
    if (!button) return;
    const full = Boolean(document.fullscreenElement);
    button.setAttribute('aria-label', full ? '退出全屏' : '进入全屏');
    button.setAttribute('title', full ? '退出全屏 (F)' : '全屏 (F)');
  });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      resize();
      if (state.ready && state.currentView !== 'free' && !state.autoRotate) {
        setView(state.currentView, { instant: true });
      }
    }, 180);
  });
}

function openArchive() {
  if (!archiveModal) return;
  if (state.autoRotate) {
    state.autoRotate = false;
    controls.autoRotate = false;
    updateAutoUI();
  }
  if (state.cameraTween) state.cameraTween = null;
  archiveModal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => {
    $('.modal-close')?.focus({ preventScroll: true });
  }, 20);
}

function closeArchive() {
  if (!archiveModal || archiveModal.hidden) return;
  archiveModal.hidden = true;
  document.body.classList.remove('modal-open');
  $('#archiveBtn')?.focus({ preventScroll: true });
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  } catch (error) {
    showToast('当前浏览器不允许全屏显示');
  }
}

function saveScreenshot() {
  if (!state.ready) return;
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('画面保存失败');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tiger-II-${state.currentView || 'free'}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast('画面已保存');
  }, 'image/png');
}

function showToast(message) {
  if (!toastEl) return;
  window.clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove('is-visible');
  }, 2200);
}

function applyInitialCamera() {
  const factor = aspectFactor();
  const viewName = VIEWS[FORCED_VIEW] ? FORCED_VIEW : 'hero';
  const pose = resolvePose(viewName);
  const wantsIntro = !SNAP && !reducedMotion && !CUSTOM_CAM && !CUSTOM_LOOK && !params.get('view');
  if (CUSTOM_CAM) {
    const target = CUSTOM_LOOK || VIEWS.hero.target;
    setCameraDirect(CUSTOM_CAM, target);
    return { intro: false, viewName: 'free' };
  }
  if (wantsIntro) {
    const target = INTRO.target.clone();
    const introPosition = INTRO.position.clone().sub(target).multiplyScalar(factor).add(target);
    applyPose(introPosition, target);
    state.currentView = viewName;
    updateViewUI(viewName);
    setRailMode('开场视角');
    return { intro: true, viewName };
  }
  applyPose(pose.position, pose.target);
  state.currentView = viewName;
  updateViewUI(viewName);
  setRailMode(VIEWS[viewName].label + '视角');
  return { intro: false, viewName };
}

function startIntro() {
  if (state.introPlayed) return;
  state.introPlayed = true;
  const pose = resolvePose('hero');
  tweenTo(pose.position, pose.target, 3100, easeOutCubic);
  state.currentView = 'hero';
  updateViewUI('hero');
  setRailMode('全景视角');
}

function hideLoader() {
  document.body.classList.add('is-ready');
  document.body.classList.remove('is-loading');
  loader?.setAttribute('aria-hidden', 'true');
  if (SNAP || UI_OFF) {
    if (loader) loader.hidden = true;
  } else {
    window.setTimeout(() => {
      if (loader) loader.hidden = true;
    }, 1100);
  }
}

function startAnimation() {
  if (animationStarted) return;
  animationStarted = true;
  clock = new THREE.Clock();
  renderer.setAnimationLoop(animate);
}

async function boot() {
  const startedAt = performance.now();
  try {
    if (!window.WebGL2RenderingContext) {
      throw new Error('当前浏览器不支持 WebGL 2。');
    }

    setLoading('初始化渲染环境', 6);
    await nextFrame();
    initRenderer();

    setLoading('生成车体与亨舍尔炮塔', 20);
    await nextFrame();
    materials = createTankMaterials();

    setLoading('布置夜间展陈灯光', 38);
    await nextFrame();
    environment = buildEnvironment(scene, renderer);

    setLoading('装配交错负重轮与履带', 56);
    await nextFrame();
    tank = buildTank(materials);
    tank.root.position.y = environment.platformTop;
    scene.add(tank.root);

    setLoading('处理裸钢表面与焊缝', 72);
    await nextFrame();
    buildHotspots();
    setupUI();

    const initial = applyInitialCamera();
    resize();

    setLoading('编译装甲材质与阴影', 88);
    await nextFrame();
    await nextFrame();
    renderer.render(scene, camera);

    setLoading('校准观察系统', 96);
    await nextFrame();
    renderer.render(scene, camera);

    setLoading('准备就绪', 100);
    const minimum = SNAP ? 0 : 900;
    const remaining = Math.max(0, minimum - (performance.now() - startedAt));
    if (remaining > 0) await wait(remaining);

    state.ready = true;
    hideLoader();
    startAnimation();

    if (initial.intro) {
      window.setTimeout(() => {
        if (state.ready && !state.interacted) startIntro();
      }, 260);
    }

    window.__TIGER_II__ = {
      ready: true,
      scene,
      camera,
      controls,
      renderer,
      tank,
      environment,
      setView: (name, instant = true) => setView(name, { instant }),
      get state() { return { ...state }; },
    };
    window.dispatchEvent(new CustomEvent('tiger-ready'));

    if (state.annotations) {
      // Hotspot positions are populated on the next animation frame.
      document.body.classList.add('annotations-on');
    }
  } catch (error) {
    console.error(error);
    showFatal(friendlyError(error?.message));
  }
}

boot();
