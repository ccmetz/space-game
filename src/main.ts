import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';

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
  function box(width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = model) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function cylinder(top: number, bottom: number, length: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = model) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, length, 12), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  cylinder(0.17, 1, 11, hull, 0, 0, -2);
  box(1.8, 1.25, 4, hull, 0, 0, 2.3);
  const cockpit = box(1.18, 0.7, 2.8, glass, 0, 0.8, -0.1);
  cockpit.rotation.x = -0.13;
  box(0.24, 0.05, 6.5, red, 0, 0.6, -4.3);
  box(1.2, 0.4, 1.1, darkHull, 0, 0.86, 2.8);
  const engineGlows: THREE.Sprite[] = [];
  const flames: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>[] = [];
  // Four separate wing assemblies form the open X silhouette, with a cannon and engine on each.
  for (const side of [-1, 1]) {
    for (const level of [-1, 1]) {
      const wing = new THREE.Group();
      wing.rotation.z = side * level * 0.28;
      wing.position.set(side * 0.65, level * 0.25, 1.8);
      model.add(wing);
      box(5.6, 0.16, 2.1, hull, side * 2.8, 0, 0, wing);
      box(1.1, 0.19, 2.12, red, side * 4.7, 0, 0, wing);
      box(1.3, 0.22, 1.4, darkHull, side * 1.4, 0, 0.2, wing);
      cylinder(0.62, 0.68, 3.8, hull, side * 1.9, 0, 0.5, wing);
      cylinder(0.48, 0.48, 0.3, darkHull, side * 1.9, 0, 2.5, wing);
      cylinder(0.09, 0.13, 6.4, hull, side * 5.55, 0, -1.5, wing);
      cylinder(0.06, 0.08, 1.6, darkHull, side * 5.55, 0, -5.1, wing);
      cylinder(0.38, 0.38, 0.12, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.45, 2.4) }), side * 1.9, 0, 2.7, wing);
      const engineGlow = glow('#ae96ff', 3, 0.8);
      engineGlow.position.set(side * 1.9, 0, 2.8);
      wing.add(engineGlow);
      engineGlows.push(engineGlow);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3, 16), new THREE.MeshBasicMaterial({ color: '#a7b6ff', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.rotation.x = Math.PI / 2;
      flame.position.set(side * 1.9, 0, 4);
      wing.add(flame);
      flames.push(flame);
    }
  }

  const keys = new Set<string>();
  const speedLabel = element('speed');
  const speedMeter = element('speed-meter');
  const boostLabel = element('boost-label');
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

  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const markerPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const separation = new THREE.Vector3();

  function notify(message: string) {
    notice.textContent = message;
    notice.classList.add('visible');
    window.clearTimeout(noticeTimeout);
    noticeTimeout = window.setTimeout(() => notice.classList.remove('visible'), 4000);
  }

  function placeCamera(immediate: boolean, dt: number) {
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

  function launch() {
    if (started) return;
    started = true;
    speed = 32;
    app.classList.add('flying');
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
    if (handledKeys.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'Escape' && !helpPanel.hidden) { helpPanel.hidden = true; return; }
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
      speedLabel.textContent = Math.round(speed).toString().padStart(2, '0');
      speedMeter.style.width = `${(speed / 180) * 100}%`;
      boostLabel.textContent = paused ? 'PAUSED' : braking ? 'BRAKING' : boosting ? 'BOOST' : 'CRUISE';
      flightState.textContent = !started ? 'SYSTEMS READY' : paused ? 'FLIGHT PAUSED' : boosting ? 'BOOST ENGAGED' : 'FLIGHT ACTIVE';
      distanceLabel.textContent = distance.toFixed(1);
      discoveredLabel.textContent = worlds.filter((world) => world.discovered).length.toString().padStart(2, '0');
      targetDistance.textContent = `${Math.max(0, ship.position.distanceTo(target.position) - target.radius).toFixed(0)} KM`;
      targetStatus.textContent = target.discovered ? 'DISCOVERED' : 'UNEXPLORED';
    }
    composer.render();
  });
}
