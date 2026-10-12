import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing interface element: ${id}`);
  return result as T;
}

const canvas = element<HTMLCanvasElement>('space');
const app = element('app');
const error = element('error');

try {
  startGame();
} catch (cause) {
  error.hidden = false;
  error.textContent = `Unable to start the flight. Please use a browser with WebGL 2 and hardware acceleration enabled. ${String(cause)}`;
  app.hidden = false;
}

function startGame() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060a12');
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 30000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  scene.add(new THREE.HemisphereLight('#bccfe2', '#455367', 2.1));
  const sunlight = new THREE.DirectionalLight('#ffe7c4', 3.2);
  sunlight.position.set(-500, 400, 300);
  scene.add(sunlight);
  const rimLight = new THREE.DirectionalLight('#77b8d9', 1.5);
  rimLight.position.set(100, -20, -100);
  scene.add(rimLight);
  const previewLight = new THREE.DirectionalLight('#e0efff', 3);
  previewLight.position.set(12, 15, 20);
  previewLight.visible = false;
  scene.add(previewLight);

  // A seeded sky stays the same after refresh and keeps the scene easy to reproduce.
  let seed = 74021;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  const starPositions: number[] = [];
  const starColors: number[] = [];
  for (let i = 0; i < 6500; i++) {
    const direction = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    direction.multiplyScalar(11000 + random() * 5000);
    starPositions.push(direction.x, direction.y, direction.z);
    const shade = new THREE.Color().setHSL(0.52 + random() * 0.15, random() * 0.28, 0.35 + random() * 0.65);
    starColors.push(shade.r, shade.g, shade.b);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 11, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(stars);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext('2d');
  if (!glowContext) throw new Error('Canvas graphics are unavailable.');
  const gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  glowContext.fillStyle = gradient;
  glowContext.fillRect(0, 0, 128, 128);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  function glow(color: THREE.ColorRepresentation, size: number, opacity = 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.setScalar(size);
    return sprite;
  }

  // Soft clouds give the sky depth without downloading textures or hiding the stars.
  const nebula = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const cloud = glow(i % 3 === 0 ? '#62659c' : '#24566e', 5000 + random() * 4000, 0.025);
    cloud.position.set(-6500 + random() * 13000, 1600 + random() * 1500, -9500 - random() * 2000);
    nebula.add(cloud);
  }
  scene.add(nebula);
  for (let i = 0; i < 35; i++) {
    const bright = glow(i % 4 === 0 ? '#f5d2b0' : '#d0e8ff', 40 + random() * 65, 0.8);
    bright.position.set((random() - 0.5) * 15000, (random() - 0.5) * 10000, -6500 - random() * 3000);
    stars.add(bright);
  }

  const planetVertex = `
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vPosition = position;
      vNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const planetFragment = `
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform vec3 baseColor;
    uniform vec3 detailColor;
    uniform float kind;
    float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float noise(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    }
    float terrain(vec3 p) { return noise(p)*0.52 + noise(p*2.03)*0.26 + noise(p*4.01)*0.14 + noise(p*8.0)*0.08; }
    void main() {
      vec3 p = normalize(vPosition);
      float land = terrain(p * 5.0);
      vec3 color = mix(baseColor, detailColor, smoothstep(0.44, 0.64, land));
      if (kind < 0.5) {
        float cloud = terrain(p * 9.0 + vec3(7.0));
        color = mix(color, vec3(0.75,0.86,0.83), smoothstep(0.58,0.74,cloud)*0.85);
      } else if (kind > 1.5) {
        float bands = sin(p.y * 65.0 + land * 9.0)*0.5+0.5;
        color = mix(baseColor, detailColor, bands*0.65+land*0.25);
      }
      float light = dot(normalize(vNormal), normalize(vec3(-0.65,0.45,0.55)));
      color *= 0.035 + smoothstep(-0.14,0.95,light)*1.18;
      gl_FragColor = vec4(color,1.0);
    }
  `;

  interface World {
    name: string;
    position: THREE.Vector3;
    radius: number;
    object: THREE.Group;
    discovered: boolean;
  }
  const worlds: World[] = [];
  function planet(name: string, position: THREE.Vector3, radius: number, base: string, detail: string, kind: number) {
    const object = new THREE.Group();
    object.position.copy(position);
    const material = new THREE.ShaderMaterial({ vertexShader: planetVertex, fragmentShader: planetFragment, uniforms: { baseColor: { value: new THREE.Color(base) }, detailColor: { value: new THREE.Color(detail) }, kind: { value: kind } } });
    object.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 80, 64), material));
    // Only the rim glows, so the atmosphere doesn't wash out the planet's surface.
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.025, 64, 48), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      uniforms: { tint: { value: new THREE.Color(kind === 0 ? '#559fae' : '#b9a58e') } },
      vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 tint; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.5); gl_FragColor=vec4(tint,rim*0.36); }`,
    }));
    object.add(atmosphere);
    scene.add(object);
    const world: World = { name, position, radius, object, discovered: false };
    worlds.push(world);
    return world;
  }

  planet('Pelagos', new THREE.Vector3(330, 135, -720), 195, '#17495b', '#739c87', 0);
  planet('Cinder', new THREE.Vector3(1100, -170, -1900), 145, '#8c5137', '#c6a77b', 1);
  const aurelia = planet('Aurelia', new THREE.Vector3(-1250, -180, -2400), 225, '#82725e', '#d4bea1', 2);
  const rings = new THREE.Mesh(new THREE.RingGeometry(280, 445, 160, 8), new THREE.MeshBasicMaterial({ color: '#bdad94', side: THREE.DoubleSide, transparent: true, opacity: 0.45 }));
  rings.rotation.set(1.12, 0.3, -0.25);
  aurelia.object.add(rings);
  const thinRing = new THREE.Mesh(new THREE.RingGeometry(335, 342, 160), new THREE.MeshBasicMaterial({ color: '#12151e', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  thinRing.rotation.copy(rings.rotation);
  // Lift the dark gap just above the main ring so the two surfaces don't flicker.
  thinRing.position.set(0, 0, 0.3).applyEuler(rings.rotation);
  aurelia.object.add(thinRing);

  const sunPosition = new THREE.Vector3(-850, 380, -1900);
  const sun = new THREE.Group();
  sun.position.copy(sunPosition);
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(120, 48, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.1) })));
  sun.add(glow('#ffcc80', 1100, 0.55));
  scene.add(sun);
  worlds.push({ name: 'Solace', position: sunPosition, radius: 120, object: sun, discovered: false });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(31, 32, 24), new THREE.MeshStandardMaterial({ color: '#7b838a', roughness: 1 }));
  moon.position.set(70, 255, -830);
  scene.add(moon);

  const ship = new THREE.Group();
  const model = new THREE.Group();
  ship.add(model);
  scene.add(ship);
  const hull = new THREE.MeshStandardMaterial({ color: '#b9bbb6', metalness: 0.55, roughness: 0.45 });
  const darkHull = new THREE.MeshStandardMaterial({ color: '#34414b', metalness: 0.65, roughness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: '#a75643', metalness: 0.4, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#162c3b', metalness: 0.8, roughness: 0.15 });
  let assembly = new THREE.Group();
  model.add(assembly);
  function box(width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = assembly) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function cylinder(top: number, bottom: number, length: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = assembly) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, length, 12), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  const engineGlows: THREE.Sprite[] = [];
  const flames: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>[] = [];
  const engineMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.45, 2.4) });
  function addEngine(x: number, y: number, z: number, parent = assembly, radius = 0.62) {
    cylinder(radius, radius * 1.1, 3.8, hull, x, y, z, parent);
    cylinder(radius * 0.77, radius * 0.77, 0.3, darkHull, x, y, z + 2, parent);
    cylinder(radius * 0.61, radius * 0.61, 0.12, engineMaterial, x, y, z + 2.2, parent);
    const engineGlow = glow('#ae96ff', 3, 0.8);
    engineGlow.position.set(x, y, z + 2.3);
    parent.add(engineGlow);
    engineGlows.push(engineGlow);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.56, 3, 16), new THREE.MeshBasicMaterial({ color: '#a7b6ff', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.rotation.x = Math.PI / 2;
    flame.position.set(x, y, z + 3.5);
    parent.add(flame);
    flames.push(flame);
  }

  cylinder(0.17, 1, 11, hull, 0, 0, -2);
  box(1.8, 1.25, 4, hull, 0, 0, 2.3);
  const cockpit = box(1.18, 0.7, 2.8, glass, 0, 0.8, -0.1);
  cockpit.rotation.x = -0.13;
  box(0.24, 0.05, 6.5, red, 0, 0.6, -4.3);
  box(1.2, 0.4, 1.1, darkHull, 0, 0.86, 2.8);
  // Four separate wing assemblies form the open X silhouette, with a cannon and engine on each.
  for (const side of [-1, 1]) {
    for (const level of [-1, 1]) {
      const wing = new THREE.Group();
      wing.rotation.z = side * level * 0.28;
      wing.position.set(side * 0.65, level * 0.25, 1.8);
      assembly.add(wing);
      box(5.6, 0.16, 2.1, hull, side * 2.8, 0, 0, wing);
      box(1.1, 0.19, 2.12, red, side * 4.7, 0, 0, wing);
      box(1.3, 0.22, 1.4, darkHull, side * 1.4, 0, 0.2, wing);
      addEngine(side * 1.9, 0, 0.5, wing);
      cylinder(0.09, 0.13, 6.4, hull, side * 5.55, 0, -1.5, wing);
      cylinder(0.06, 0.08, 1.6, darkHull, side * 5.55, 0, -5.1, wing);
    }
  }
  const pathfinder = assembly;

  assembly = new THREE.Group();
  model.add(assembly);
  const deltaShape = new THREE.Shape();
  deltaShape.moveTo(0, 7);
  deltaShape.lineTo(-7, -3);
  deltaShape.lineTo(0, -1.5);
  deltaShape.lineTo(7, -3);
  deltaShape.closePath();
  const deltaWing = new THREE.Mesh(new THREE.ExtrudeGeometry(deltaShape, { depth: 0.3, bevelEnabled: false }), hull);
  deltaWing.rotation.x = -Math.PI / 2;
  deltaWing.position.y = -0.5;
  assembly.add(deltaWing);
  cylinder(0.12, 0.85, 9, hull, 0, 0, -1.8);
  box(1.1, 0.65, 2.8, glass, 0, 0.65, -1.2).rotation.x = -0.18;
  box(0.2, 2, 2.3, red, 0, 1.25, 2.5).rotation.x = -0.25;
  for (const side of [-1, 1]) {
    box(0.6, 0.15, 4.8, red, side * 3.5, -0.1, 0.7).rotation.y = side * 0.5;
    addEngine(side * 2.2, -0.1, 1.7);
    cylinder(0.09, 0.15, 4.5, darkHull, side * 5.7, -0.2, 0.5);
  }
  const arrow = assembly;

  assembly = new THREE.Group();
  model.add(assembly);
  box(3.6, 1.8, 7, hull, 0, 0, 0);
  cylinder(0.6, 1.8, 4, hull, 0, 0, -4.5);
  box(2.1, 0.65, 2.7, glass, 0, 1.2, -2.1).rotation.x = -0.15;
  box(1.8, 0.3, 3, darkHull, 0, 1.1, 1.5);
  box(0.45, 0.1, 4.5, red, 0, 0.98, -1.5);
  for (const side of [-1, 1]) {
    box(3.2, 0.5, 2.7, darkHull, side * 2.8, 0, 1.6);
    box(1.8, 2, 4.7, hull, side * 4.1, 0, 0.7);
    box(1.85, 0.12, 1, red, side * 4.1, 1.05, 0.5);
    box(0.18, 1.7, 2.5, red, side * 4.1, 1.45, 1.7).rotation.x = -0.15;
    addEngine(side * 4.1, 0, 1.6, assembly, 0.95);
  }
  const atlas = assembly;
  const shipTypes = [
    { id: 'pathfinder', name: 'Pathfinder', code: 'SF–01', model: pathfinder },
    { id: 'arrow', name: 'Arrow', code: 'IN–02', model: arrow },
    { id: 'atlas', name: 'Atlas', code: 'EX–03', model: atlas },
  ];
  const paints = [
    { id: 'ivory', name: 'Ivory', hull: '#b9bbb6', accent: '#a75643', engine: '#ae96ff' },
    { id: 'graphite', name: 'Graphite', hull: '#424953', accent: '#d7bd83', engine: '#ffbd77' },
    { id: 'cobalt', name: 'Cobalt', hull: '#315c94', accent: '#96d7e1', engine: '#77dbff' },
    { id: 'crimson', name: 'Crimson', hull: '#a8403c', accent: '#e1d1ad', engine: '#ffad94' },
  ];
  let selectedShip = 0;
  let selectedPaint = 0;
  try {
    selectedShip = Math.max(0, shipTypes.findIndex((item) => item.id === localStorage.getItem('starbound.ship')));
    selectedPaint = Math.max(0, paints.findIndex((item) => item.id === localStorage.getItem('starbound.paint')));
  } catch {
    // Browsers can block storage; choosing a ship still works for this session.
  }
  let confirmedShip = selectedShip;
  let confirmedPaint = selectedPaint;
  let choosingShip = false;
  const selectionPanel = element('ship-selection');
  const intro = element('intro');
  const chooseShipButton = element('choose-ship-button');
  const shipOptions = document.querySelectorAll<HTMLButtonElement>('[data-ship]');
  const paintOptions = document.querySelectorAll<HTMLButtonElement>('[data-paint]');

  // All three models share the paint materials. Keep them built so switching ships
  // changes the preview instantly without creating more graphics resources each time.
  function updateShipSelection() {
    shipTypes.forEach((type, index) => { type.model.visible = index === selectedShip; });
    shipOptions.forEach((button, index) => {
      button.classList.toggle('selected', index === selectedShip);
      button.setAttribute('aria-pressed', String(index === selectedShip));
    });
    paintOptions.forEach((button, index) => {
      button.classList.toggle('selected', index === selectedPaint);
      button.setAttribute('aria-pressed', String(index === selectedPaint));
    });
    const paint = paints[selectedPaint];
    hull.color.set(paint.hull);
    red.color.set(paint.accent);
    engineMaterial.color.set(paint.engine).multiplyScalar(2.2);
    engineGlows.forEach((engine) => engine.material.color.set(paint.engine));
    flames.forEach((flame) => flame.material.color.set(paint.engine));
    element('paint-name').textContent = paint.name;
    element('ship-code').textContent = shipTypes[selectedShip].code;
    element('ship-name').textContent = shipTypes[selectedShip].name.toUpperCase();
    chooseShipButton.setAttribute('aria-label', `Choose ship, current selection: ${shipTypes[selectedShip].name}, ${paint.name}`);
  }
  updateShipSelection();

  const keys = new Set<string>();
  const speedLabel = element('speed');
  const speedMeter = element('speed-meter');
  const boostLabel = element('boost-label');
  const throttleLabel = element('throttle');
  const headingLabel = element('heading');
  const headingTape = element('heading-tape');
  const headingMarks = document.querySelectorAll<HTMLElement>('.heading-mark');
  const pitchLabel = element('pitch');
  const bankLabel = element('bank');
  const attitudeRoll = element('attitude-roll');
  const pitchLadder = element('pitch-ladder');
  const flightState = element('flight-state');
  const distanceLabel = element('distance');
  const discoveredLabel = element('discovered');
  const targetName = element('target-name');
  const targetDistance = element('target-distance');
  const targetStatus = element('target-status');
  const marker = element('target-marker');
  const markerName = element('marker-name');
  const helpPanel = element('controls-panel');
  const pauseOverlay = element('pause-overlay');
  const pauseButton = element<HTMLButtonElement>('pause-button');
  const notice = element('flight-notice');
  const destinationButtons = document.querySelectorAll<HTMLButtonElement>('.destination');
  let selectedTarget = 0;
  let started = false;
  let paused = false;
  let speed = 0;
  let distance = 0;
  let noticeTimeout = 0;
  let pitch = 0;
  let yaw = 0;
  let roll = 0;
  let lastTime = 0;
  let hudElapsed = 0;
  let firstFrameRendered = false;

  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const markerPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const separation = new THREE.Vector3();
  const attitude = new THREE.Euler(0, 0, 0, 'YXZ');

  function notify(message: string) {
    notice.textContent = message;
    notice.classList.add('visible');
    window.clearTimeout(noticeTimeout);
    noticeTimeout = window.setTimeout(() => notice.classList.remove('visible'), 4000);
  }

  function placeCamera(immediate: boolean, dt: number) {
    if (choosingShip) {
      const narrowScreen = innerWidth <= 760;
      camera.position.set(18, narrowScreen ? 11 : 9, narrowScreen ? 29 : 23);
      camera.up.set(0, 1, 0);
      camera.lookAt(narrowScreen ? 0 : -16, narrowScreen ? -9 : 0, 0);
      return;
    }
    desiredCamera.set(0, 7.5, 29).applyQuaternion(ship.quaternion).add(ship.position);
    lookAt.set(0, 3.5, -48).applyQuaternion(ship.quaternion).add(ship.position);
    up.set(0, 1, 0).applyQuaternion(ship.quaternion);
    if (immediate) {
      camera.position.copy(desiredCamera);
      camera.up.copy(up);
    } else {
      camera.position.lerp(desiredCamera, 1 - Math.exp(-5 * dt));
      camera.up.lerp(up, 1 - Math.exp(-4 * dt)).normalize();
    }
    camera.lookAt(lookAt);
  }
  placeCamera(true, 0);

  function closeShipSelection(confirm: boolean) {
    if (confirm) {
      confirmedShip = selectedShip;
      confirmedPaint = selectedPaint;
      try {
        localStorage.setItem('starbound.ship', shipTypes[confirmedShip].id);
        localStorage.setItem('starbound.paint', paints[confirmedPaint].id);
      } catch {
        // Keep the confirmed choice in memory if this browser won't save it.
      }
    } else {
      selectedShip = confirmedShip;
      selectedPaint = confirmedPaint;
      updateShipSelection();
    }
    choosingShip = false;
    worlds.forEach((world) => { world.object.visible = true; });
    moon.visible = true;
    previewLight.visible = false;
    app.classList.remove('choosing-ship');
    selectionPanel.hidden = true;
    intro.hidden = false;
    intro.inert = false;
    model.rotation.set(0, 0, 0);
    placeCamera(true, 0);
    chooseShipButton.focus();
  }

  function launch() {
    if (started) return;
    started = true;
    speed = 32;
    app.classList.add('flying');
    helpPanel.hidden = true;
    element('intro').inert = true;
    element('intro').setAttribute('aria-hidden', 'true');
    notify('Welcome aboard. WASD to steer · Shift to boost · Space to brake.');
  }
  function setPaused(value: boolean) {
    if (!started) return;
    paused = value;
    keys.clear();
    pauseOverlay.hidden = !paused;
    pauseButton.textContent = paused ? '▷' : 'Ⅱ';
    pauseButton.setAttribute('aria-label', paused ? 'Resume flight' : 'Pause flight');
    flightState.textContent = paused ? 'FLIGHT PAUSED' : 'FLIGHT ACTIVE';
  }
  function reset() {
    ship.position.set(0, 0, 0);
    ship.quaternion.identity();
    model.rotation.z = 0;
    pitch = yaw = roll = 0;
    speed = started ? 32 : 0;
    keys.clear();
    placeCamera(true, 0);
    notify('Returned to your starting coordinates.');
  }

  element('launch-button').addEventListener('click', launch);
  chooseShipButton.addEventListener('click', () => {
    if (started) return;
    choosingShip = true;
    // Clear the planets from the preview and light the hull so the ship is the focus.
    worlds.forEach((world) => { world.object.visible = false; });
    moon.visible = false;
    previewLight.visible = true;
    app.classList.add('choosing-ship');
    intro.hidden = true;
    intro.inert = true;
    helpPanel.hidden = true;
    selectionPanel.hidden = false;
    model.rotation.set(0, -0.6, 0);
    placeCamera(true, 0);
    element<HTMLButtonElement>('back-from-ships').focus();
  });
  element('back-from-ships').addEventListener('click', () => closeShipSelection(false));
  element('confirm-ship-button').addEventListener('click', () => closeShipSelection(true));
  shipOptions.forEach((button) => button.addEventListener('click', () => {
    selectedShip = Number(button.dataset.ship);
    updateShipSelection();
  }));
  paintOptions.forEach((button) => button.addEventListener('click', () => {
    selectedPaint = Number(button.dataset.paint);
    updateShipSelection();
  }));
  pauseButton.addEventListener('click', () => setPaused(!paused));
  element('resume-button').addEventListener('click', () => setPaused(false));
  element('help-button').addEventListener('click', () => { helpPanel.hidden = !helpPanel.hidden; });
  element('close-help').addEventListener('click', () => { helpPanel.hidden = true; });
  destinationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedTarget = Number(button.dataset.target);
      destinationButtons.forEach((item, index) => item.classList.toggle('active', index === selectedTarget));
      targetName.textContent = markerName.textContent = worlds[selectedTarget].name.toUpperCase();
    });
  });
  element('jump-button').addEventListener('click', () => {
    launch();
    setPaused(false);
    const target = worlds[selectedTarget];
    ship.position.copy(target.position).add(new THREE.Vector3(-target.radius * 1.15, -target.radius * 0.4, target.radius * 3.5));
    ship.quaternion.identity();
    pitch = yaw = roll = 0;
    speed = 32;
    placeCamera(true, 0);
    notify(`Jump complete. Approaching ${target.name}.`);
  });

  const handledKeys = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyP', 'Escape', 'KeyR']);
  window.addEventListener('keydown', (event) => {
    if (started && handledKeys.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'Escape' && !helpPanel.hidden) { helpPanel.hidden = true; return; }
    if (choosingShip && event.code === 'Escape') { closeShipSelection(false); return; }
    if (choosingShip && handledKeys.has(event.code)) return;
    if (event.code === 'KeyP' || event.code === 'Escape') { setPaused(!paused); return; }
    if (event.key === '?') { helpPanel.hidden = !helpPanel.hidden; return; }
    if (event.code === 'KeyR') { reset(); return; }
    if (started && !paused) keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((button) => {
    const key = button.dataset.key;
    if (!key) return;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (started && !paused) keys.add(key);
    });
    const release = () => keys.delete(key);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    if (choosingShip) placeCamera(true, 0);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    setPaused(true);
    error.hidden = false;
    error.textContent = 'The graphics connection was interrupted. Reload the page to restart your flight.';
  });

  renderer.setAnimationLoop((time) => {
    // Cap elapsed time after a slow frame so the ship cannot jump through a planet.
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    const boosting = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const braking = keys.has('Space');
    if (started && !paused) {
      const smoothing = 1 - Math.exp(-4 * dt);
      pitch = THREE.MathUtils.lerp(pitch, Number(keys.has('KeyW')) - Number(keys.has('KeyS')), smoothing);
      yaw = THREE.MathUtils.lerp(yaw, Number(keys.has('KeyA')) - Number(keys.has('KeyD')), smoothing);
      roll = THREE.MathUtils.lerp(roll, Number(keys.has('KeyQ')) - Number(keys.has('KeyE')), smoothing);
      ship.rotateX(pitch * dt * 0.75);
      ship.rotateY(yaw * dt * 0.7);
      ship.rotateZ(roll * dt * 1.2);
      ship.quaternion.normalize();
      model.rotation.z = THREE.MathUtils.lerp(model.rotation.z, -yaw * 0.2, smoothing);
      speed = THREE.MathUtils.lerp(speed, braking ? 0 : boosting ? 180 : 42, 1 - Math.exp(-(braking ? 3 : 1.4) * dt));
      forward.set(0, 0, -1).applyQuaternion(ship.quaternion);
      ship.position.addScaledVector(forward, speed * dt);
      distance += speed * dt;

      // Push the ship outside solid surfaces and stop it gently instead of ending free flight.
      for (const world of worlds) {
        separation.subVectors(ship.position, world.position);
        const gap = separation.length() - world.radius;
        if (gap < world.radius * 1.4 && !world.discovered) {
          world.discovered = true;
          notify(`${world.name} discovered. A new corner of the universe, just for you.`);
        }
        if (gap < 12) {
          if (separation.lengthSq() < 0.001) separation.set(0, 0, 1);
          ship.position.copy(world.position).add(separation.normalize().multiplyScalar(world.radius + 12));
          speed = 0;
          notify(`${world.name} proximity limit. Turn away to continue exploring.`);
        }
      }
      // The sky follows the pilot; nearby planets stay fixed so flying past them feels real.
      stars.position.copy(ship.position);
      nebula.position.copy(ship.position);
      placeCamera(false, dt);
    }
    if (!paused) {
      if (choosingShip) model.rotation.y += dt * 0.22;
      worlds.slice(0, 3).forEach((world) => { world.object.children[0].rotation.y += dt * 0.015; });
      const enginePower = started ? (braking ? 0.3 : boosting ? 1.8 : 1) : 0.65;
      engineGlows.forEach((engine) => {
        engine.scale.setScalar((2.7 + Math.sin(time * 0.014) * 0.15) * enginePower);
      });
      flames.forEach((flame) => { flame.scale.y = enginePower; });
    }

    const target = worlds[selectedTarget];
    markerPosition.copy(target.position).project(camera);
    camera.getWorldDirection(cameraDirection);
    separation.subVectors(target.position, camera.position);
    const inFront = cameraDirection.dot(separation) > 0;
    marker.hidden = !inFront || Math.abs(markerPosition.x) > 0.93 || Math.abs(markerPosition.y) > 0.75;
    marker.style.left = `${(markerPosition.x * 0.5 + 0.5) * innerWidth}px`;
    marker.style.top = `${(-markerPosition.y * 0.5 + 0.5) * innerHeight}px`;
    hudElapsed += dt;
    if (hudElapsed > 0.1 || !started) {
      hudElapsed = 0;
      // The starting plane is our reference horizon. Reading the ship's orientation
      // keeps these instruments useful after a turn or roll, rather than just showing key presses.
      forward.set(0, 0, -1).applyQuaternion(ship.quaternion);
      attitude.setFromQuaternion(ship.quaternion, 'YXZ');
      const headingDegrees = (THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z)) + 360) % 360;
      const pitchDegrees = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)));
      const bankDegrees = THREE.MathUtils.radToDeg(attitude.z);
      const headingStep = Math.floor(headingDegrees / 15) * 15;
      headingLabel.textContent = `${(Math.round(headingDegrees) % 360).toString().padStart(3, '0')}°`;
      headingTape.style.transform = `translateX(${-67.5 - (headingDegrees - headingStep) * 3}px)`;
      headingMarks.forEach((mark, index) => {
        mark.textContent = ((headingStep + (index - 4) * 15 + 360) % 360).toString().padStart(3, '0');
      });
      pitchLabel.textContent = `${pitchDegrees < -0.5 ? '−' : '+'}${Math.abs(Math.round(pitchDegrees)).toString().padStart(2, '0')}°`;
      bankLabel.textContent = `${Math.abs(bankDegrees) < 0.5 ? '' : bankDegrees > 0 ? 'L ' : 'R '}${Math.abs(Math.round(bankDegrees)).toString().padStart(2, '0')}°`;
      attitudeRoll.style.transform = `rotate(${bankDegrees}deg)`;
      pitchLadder.style.transform = `translateY(${pitchDegrees * 4}px)`;
      const throttle = !started || paused || braking ? 0 : boosting ? 100 : Math.round(42 / 180 * 100);
      throttleLabel.textContent = `${throttle.toString().padStart(2, '0')}%`;
      speedLabel.textContent = Math.round(speed).toString().padStart(2, '0');
      speedMeter.style.width = `${(speed / 180) * 100}%`;
      boostLabel.textContent = paused ? 'PAUSED' : braking ? 'BRAKING' : boosting ? 'BOOST' : 'CRUISE';
      flightState.textContent = !started ? 'SYSTEMS READY' : paused ? 'FLIGHT PAUSED' : boosting ? 'BOOST ENGAGED' : braking ? 'BRAKING' : 'FREE FLIGHT';
      distanceLabel.textContent = distance.toFixed(1);
      discoveredLabel.textContent = worlds.filter((world) => world.discovered).length.toString().padStart(2, '0');
      targetDistance.textContent = `${Math.max(0, ship.position.distanceTo(target.position) - target.radius).toFixed(0)} KM`;
      targetStatus.textContent = target.discovered ? 'DISCOVERED' : 'UNEXPLORED';
    }
    composer.render();
    // Show the interface only after the canvas has its first frame.
    if (!firstFrameRendered) {
      app.hidden = false;
      firstFrameRendered = true;
    }
  });
}
