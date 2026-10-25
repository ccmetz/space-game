import * as THREE from 'three';
import {
  type Character,
  suitColors,
  skinTones,
  hairColors,
  hairStyles,
} from '../character/character.ts';
import {
  characterSpeeds,
  createCharacterModel,
  type CharacterAppearance,
} from '../character/model.ts';
import { createRenderer } from '../graphics/renderer.ts';
import { createStore } from '../state.ts';

export const promenade = {
  name: 'Orbital promenade',
  description: 'Habitat ring · Follow the illuminated signs',
};
export const rooms = [
  {
    name: 'Docking bay',
    angle: -Math.PI / 2,
    color: '#edba77',
    description: 'Flight deck · Ships ready for departure',
    code: '01',
  },
  {
    name: 'Control room',
    angle: Math.PI,
    color: '#77d7ec',
    description: 'Navigation · Station operations',
    code: '02',
  },
  {
    name: 'Commons',
    angle: Math.PI / 2,
    color: '#9ac7a2',
    description: 'Mess hall · Meet the crew',
    code: '03',
  },
  {
    name: 'Your quarters',
    angle: 0,
    color: '#bba4e4',
    description: 'Private cabin · A place to call home',
    code: '04',
  },
] as const;
const innerRadius = 26;
const outerRadius = 34;
export const stationSpawn = { x: 0, z: 46 };

// Each room uses the same outward-facing coordinates. This keeps its passage,
// furnishings, walls, and signs aligned wherever it attaches to the ring.
function worldPoint(angle: number, side: number, outward: number) {
  return {
    x: Math.sin(angle) * outward + Math.cos(angle) * side,
    z: Math.cos(angle) * outward - Math.sin(angle) * side,
  };
}
function localPoint(angle: number, x: number, z: number) {
  return {
    side: Math.cos(angle) * x - Math.sin(angle) * z,
    outward: Math.sin(angle) * x + Math.cos(angle) * z,
  };
}
interface Obstacle {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  kind: string;
  angle: number;
}
const furniture: Obstacle[] = [];
function furnish(
  roomIndex: number,
  side: number,
  outward: number,
  width: number,
  depth: number,
  height: number,
  kind: string,
) {
  const angle = rooms[roomIndex].angle;
  furniture.push({ ...worldPoint(angle, side, outward), width, depth, height, kind, angle });
}
furnish(3, 6, 53, 3, 5, 0.65, 'bed'); // Bed
furnish(3, -6, 55, 5, 1.8, 1.1, 'desk'); // Cabin desk
furnish(3, 8, 44, 1.5, 3, 2.6, 'locker'); // Locker
furnish(2, 0, 52, 6, 2.5, 1, 'table'); // Mess table
furnish(2, -8, 46, 2, 4, 2, 'supplies'); // Supplies
furnish(1, 0, 56, 10, 2, 1.2, 'console'); // Control consoles
furnish(1, 5, 47, 3, 3, 1, 'navigation'); // Navigation display
furnish(0, 0, 53, 8, 9, 2, 'ship'); // Parked ship
for (const side of [-2, 2])
  for (const outward of [49.5, 54.5]) furnish(2, side, outward, 1.1, 0.8, 0.6, 'seat');

function insideFloor(x: number, z: number) {
  const radius = Math.hypot(x, z);
  if (radius >= innerRadius && radius <= outerRadius) return true;
  return rooms.some((room) => {
    const { side, outward } = localPoint(room.angle, x, z);
    return (
      (Math.abs(side) <= 3 && outward >= 32 && outward <= 40.2) ||
      (Math.abs(side) <= 11 && outward >= 40 && outward <= 62)
    );
  });
}
export function roomAt(x: number, z: number) {
  return (
    rooms.find((room) => {
      const { side, outward } = localPoint(room.angle, x, z);
      return Math.abs(side) <= 11 && outward >= 40 && outward <= 62;
    }) ?? promenade
  );
}
export function canStand(x: number, z: number) {
  // Check the player's footprint against the union of corridor, passages, and rooms.
  // Checking each area separately would leave invisible barriers at their joins.
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    if (!insideFloor(x + Math.cos(angle) * 0.4, z + Math.sin(angle) * 0.4)) return false;
  }
  return !furniture.some((item) => {
    const local = localPoint(item.angle, x - item.x, z - item.z);
    return (
      Math.abs(local.side) < item.width / 2 + 0.4 && Math.abs(local.outward) < item.depth / 2 + 0.4
    );
  });
}

export interface StationInteraction {
  id: string;
  label: string;
  x: number;
  z: number;
  dialogue: string;
  board?: boolean;
}
const crew = [
  {
    name: 'Mara · Dockmaster',
    heading: -Math.PI / 2,
    ...worldPoint(rooms[0].angle, -5, 46),
    line: 'Your shuttle is ready. The boarding terminal beside the ship will take you to flight preparation.',
  },
  {
    name: 'Ivo · Navigator',
    heading: Math.PI,
    ...worldPoint(rooms[1].angle, -4, 52),
    line: 'Wayfarer is a home between worlds. Check the navigation table before heading into the unknown.',
  },
  {
    name: 'Ren · Engineer',
    heading: Math.PI / 2,
    ...worldPoint(rooms[2].angle, 5, 46),
    line: 'One continuous loop. Quarters, commons, control, docks. Take either direction; you’ll always find your way back.',
  },
  {
    name: 'Sol · Crew',
    heading: -Math.PI / 2,
    ...worldPoint(rooms[2].angle, -4, 53),
    line: 'Grab something from the dispenser. Watching the stars from the promenade never gets old.',
  },
  {
    name: 'Ada · Surveyor',
    heading: (-3 * Math.PI) / 4,
    ...worldPoint(Math.PI / 4, 0, 28),
    line: 'I’ve been watching that planet all morning. Someday we’ll set foot down there.',
  },
  {
    name: 'Tess · Technician',
    heading: (3 * Math.PI) / 4,
    ...worldPoint(-Math.PI / 4, 0, 32),
    line: 'The observation glass is rated for micrometeorites. You can enjoy the view.',
  },
  {
    name: 'Niko · Flight technician',
    ...worldPoint(rooms[0].angle, 6.5, 56),
    heading: Math.PI,
    line: 'Coolant lines are holding steady. We inspect every shuttle before clearing it for departure.',
  },
  {
    name: 'Lena · Operations',
    ...worldPoint(rooms[1].angle, 3, 54),
    heading: Math.PI,
    line: 'Air, water, power. Keep those three happy and a station starts to feel like a town.',
  },
  {
    name: 'Jules · Botanist',
    ...worldPoint(rooms[2].angle, -4, 50.5),
    heading: Math.PI / 2,
    line: 'Sol keeps asking when the next hydroponics harvest is ready. Another two days, if the grow lights behave.',
  },
  {
    name: 'Oren · Cargo pilot',
    ...worldPoint((-3 * Math.PI) / 4, 0, 28),
    heading: Math.PI / 4,
    line: 'Between deliveries I come here for the quiet. Best view on the whole station.',
  },
];
export const stationInteractions: StationInteraction[] = [
  ...crew.map((npc, index) => ({
    id: `crew-${index}`,
    label: `Talk to ${npc.name}`,
    x: npc.x,
    z: npc.z,
    dialogue: `${npc.name}: ${npc.line}`,
  })),
  {
    id: 'bunk',
    label: 'Rest in your bunk',
    ...worldPoint(0, 3.7, 53),
    dialogue:
      'You take a moment to rest. Your cabin is quiet, and the hum of the station feels like home.',
  },
  {
    id: 'desk',
    label: 'Read your welcome message',
    ...worldPoint(0, -6, 53),
    dialogue:
      'CREW SERVICES: Cabin 04 is yours. Explore the habitat ring, meet the crew, and report to Dock 01 when you’re ready to depart.',
  },
  {
    id: 'navigation',
    label: 'Inspect the star chart',
    ...worldPoint(Math.PI, 2.5, 47),
    dialogue:
      'NAVIGATION: Pelagos and the surrounding worlds await. Your ship’s navigation system can plot a jump after departure.',
  },
  {
    id: 'supplies',
    label: 'Use the refreshment dispenser',
    ...worldPoint(Math.PI / 2, -6, 46),
    dialogue: 'The dispenser serves a warm drink. A small comfort, a long way from home.',
  },
  {
    id: 'shuttle',
    label: 'Board shuttle',
    ...worldPoint(-Math.PI / 2, 5.8, 50),
    dialogue: '',
    board: true,
  },
];
export function interactionAt(x: number, z: number) {
  // A nearby prompt must also be reachable on this side of the wall. Sample the
  // line to the interaction so crew in an adjacent compartment cannot talk through walls.
  return stationInteractions
    .filter((item) => {
      const distance = Math.hypot(item.x - x, item.z - z);
      if (distance > 2.6) return false;
      for (let t = 0; t <= 1; t += 0.1) {
        if (!insideFloor(x + (item.x - x) * t, z + (item.z - z) * t)) return false;
      }
      return true;
    })
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
}

export function createStation(onBoard: () => void = () => {}) {
  const store = createStore({
    room: 'Your quarters',
    paused: false,
    ready: false,
    error: '',
    nearby: '',
    dialogue: '',
    canBoard: false,
    x: stationSpawn.x,
    z: stationSpawn.z,
    heading: Math.PI,
  });
  const keys = new Set<string>();
  let interact = () => {};
  let turn = (_x: number, _y: number) => {};
  function pause(paused: boolean) {
    keys.clear();
    store.update({ paused });
  }
  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    press: (key: string) => {
      if (!store.getSnapshot().paused) keys.add(key);
    },
    release: (key: string) => {
      keys.delete(key);
    },
    look: (x: number, y: number) => turn(x, y),
    togglePause: () => pause(!store.getSnapshot().paused),
    interact: () => interact(),
    start(canvas: HTMLCanvasElement, character: Readonly<Character>) {
      store.update({
        room: 'Your quarters',
        paused: false,
        ready: false,
        error: '',
        nearby: '',
        dialogue: '',
        canBoard: false,
        x: stationSpawn.x,
        z: stationSpawn.z,
        heading: Math.PI,
      });
      keys.clear();
      const events = new AbortController();
      const textures: THREE.Texture[] = [];
      const disposeCharacters: (() => void)[] = [];
      let graphics: ReturnType<typeof createRenderer> | undefined;
      const cleanup = () => {
        events.abort();
        keys.clear();
        interact = () => {};
        turn = () => {};
        textures.forEach((texture) => texture.dispose());
        disposeCharacters.forEach((dispose) => dispose());
        graphics?.dispose();
      };
      try {
        const renderer = createRenderer(canvas);
        graphics = renderer;
        renderer.scene.background = new THREE.Color('#030912');
        renderer.scene.fog = new THREE.Fog('#0a1725', 45, 150);
        renderer.camera.fov = 67;
        renderer.camera.near = 0.08;
        renderer.camera.updateProjectionMatrix();
        const cameraBlockers: THREE.Object3D[] = [];
        type Finish = 'deck' | 'panel' | 'alloy' | 'fabric' | 'display';
        const surfaceMaps = new Map<
          Finish,
          {
            map: THREE.DataTexture;
            bumpMap: THREE.DataTexture;
            roughnessMap: THREE.DataTexture;
          }
        >();
        // Build small, seamless material tiles once. The same seams, fasteners, and
        // scuffs affect color, surface depth, and how the light catches each panel.
        for (const finish of ['deck', 'panel', 'alloy', 'fabric'] as const) {
          const size = 256;
          const color = new Uint8Array(size * size * 4);
          const height = new Uint8Array(color.length);
          const roughness = new Uint8Array(color.length);
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const index = (y * size + x) * 4;
              const grain = (Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
              const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
              const bolt = Math.hypot(
                Math.min(Math.abs(x - 13), Math.abs(x - 243)),
                Math.min(Math.abs(y - 13), Math.abs(y - 243)),
              );
              let shade = 224 + grain * 9;
              let depth = 130 + grain * 4;
              let matte = 180 + grain * 15;
              if (finish === 'deck' || finish === 'panel') {
                if (edge < 3) {
                  shade = 65;
                  depth = 70;
                  matte = 230;
                } else if (edge < 6) {
                  shade = 180;
                  depth = 115;
                }
                if (bolt < 3.5) {
                  shade = bolt < 2 ? 100 : 205;
                  depth = bolt < 2 ? 95 : 155;
                  matte = 125;
                }
                // Raised tread stays away from panel edges; fine scratches break
                // up the broad highlights without making the whole floor noisy.
                if (finish === 'deck' && edge > 24 && (x + y) % 32 < 3) {
                  shade -= 24;
                  depth += 18;
                }
                if (y % 73 === 18 && x > 45 && x < 95) {
                  shade += 12;
                  matte -= 40;
                }
              } else if (finish === 'alloy') {
                shade += Math.sin(y * 2.4) * 9;
                matte = 115 + grain * 20;
              } else {
                const weave = (x % 4 < 2 ? 1 : -1) * (y % 4 < 2 ? 1 : -1);
                shade += weave * 12;
                depth += weave * 15;
                matte = 240;
              }
              for (let channel = 0; channel < 3; channel++) {
                color[index + channel] = shade;
                height[index + channel] = depth;
                roughness[index + channel] = matte;
              }
              color[index + 3] = height[index + 3] = roughness[index + 3] = 255;
            }
          }
          const makeMap = (pixels: Uint8Array, colored = false) => {
            const texture = new THREE.DataTexture(pixels, size, size);
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.generateMipmaps = true;
            texture.anisotropy = 4;
            if (colored) texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            textures.push(texture);
            return texture;
          };
          surfaceMaps.set(finish, {
            map: makeMap(color, true),
            bumpMap: makeMap(height),
            roughnessMap: makeMap(roughness),
          });
        }
        const materialCache = new Map<string, THREE.MeshStandardMaterial>();
        const material = (color: string, glow: boolean, finish: Finish = 'panel') => {
          if (finish === 'display') return displayMaterial;
          const key = `${color}-${glow}-${finish}`;
          let result = materialCache.get(key);
          if (!result) {
            result = new THREE.MeshStandardMaterial({
              color,
              ...(!glow ? surfaceMaps.get(finish) : {}),
              bumpScale: finish === 'deck' ? 0.025 : 0.012,
              roughness: finish === 'fabric' ? 1 : 0.85,
              metalness: finish === 'fabric' ? 0 : finish === 'alloy' ? 0.65 : 0.35,
              emissive: glow ? color : '#000000',
              emissiveIntensity: glow ? 1.2 : 0,
              side: THREE.DoubleSide,
            });
            materialCache.set(key, result);
          }
          return result;
        };
        const displayMaterial = new THREE.MeshStandardMaterial({
          color: '#b7d8dc',
          emissive: '#88bcc5',
          emissiveIntensity: 0.45,
          roughness: 0.3,
          metalness: 0.1,
        });
        const displayCanvas = document.createElement('canvas');
        displayCanvas.width = 1024;
        displayCanvas.height = 512;
        const displayContext = displayCanvas.getContext('2d');
        if (displayContext) {
          const ctx = displayContext;
          ctx.fillStyle = '#0b1820';
          ctx.fillRect(0, 0, 1024, 512);
          ctx.fillStyle = '#8dbbc4';
          ctx.font = '24px monospace';
          ctx.fillText('WAYFARER / SYSTEM MONITOR', 36, 48);
          ctx.fillStyle = '#42616b';
          ctx.fillRect(36, 68, 952, 2);
          for (let row = 0; row < 3; row++) {
            const y = 125 + row * 120;
            ctx.fillStyle = '#76919a';
            ctx.font = '20px monospace';
            ctx.fillText(['LIFE SUPPORT', 'POWER GRID', 'DOCK TELEMETRY'][row], 36, y);
            ctx.fillStyle = '#b4d5cf';
            ctx.font = '30px monospace';
            ctx.fillText(['101.3 kPa', '98.4 %', 'LINK ACTIVE'][row], 36, y + 44);
            ctx.strokeStyle = '#67a9ad';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 330; x < 980; x += 4) {
              const wave = Math.sin(x * 0.025 + row * 2) * Math.sin(x * 0.006) * 22;
              if (x === 330) ctx.moveTo(x, y + 20 + wave);
              else ctx.lineTo(x, y + 20 + wave);
            }
            ctx.stroke();
            ctx.fillStyle = '#27414c';
            ctx.fillRect(330, y + 57, 650, 1);
          }
          const texture = new THREE.CanvasTexture(displayCanvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          textures.push(texture);
          displayMaterial.map = displayMaterial.emissiveMap = texture;
        }
        const box = (
          x: number,
          y: number,
          z: number,
          w: number,
          h: number,
          d: number,
          color: string,
          glow = false,
          angle = 0,
          solid = false,
          finish: Finish = 'panel',
        ) => {
          const geometry = new THREE.BoxGeometry(w, h, d);
          const uv = geometry.getAttribute('uv');
          const tileSize = finish === 'fabric' ? 0.5 : finish === 'alloy' ? 1 : 2;
          const faces = [
            [d, h],
            [d, h],
            [w, d],
            [w, d],
            [w, h],
            [w, h],
          ];
          // Box faces have different sizes. Scale each face separately so a two
          // meter plate stays two meters wide on a wall, floor, or long corridor.
          for (let face = 0; finish !== 'display' && face < faces.length; face++) {
            const [width, height] = faces[face];
            for (let vertex = face * 4; vertex < face * 4 + 4; vertex++) {
              uv.setXY(
                vertex,
                (uv.getX(vertex) * width) / tileSize,
                (uv.getY(vertex) * height) / tileSize,
              );
            }
          }
          const mesh = new THREE.Mesh(geometry, material(color, glow, finish));
          mesh.position.set(x, y, z);
          mesh.rotation.y = angle;
          renderer.scene.add(mesh);
          if (solid) cameraBlockers.push(mesh);
          return mesh;
        };
        const radialBox = (
          angle: number,
          side: number,
          outward: number,
          y: number,
          w: number,
          h: number,
          d: number,
          color: string,
          glow = false,
          solid = false,
          finish: Finish = 'panel',
        ) => {
          const p = worldPoint(angle, side, outward);
          return box(p.x, y, p.z, w, h, d, color, glow, angle, solid, finish);
        };
        const sign = (
          text: string,
          x: number,
          y: number,
          z: number,
          angle: number,
          color = '#a9e8f3',
          width = 4,
        ) => {
          const surface = document.createElement('canvas');
          surface.width = 1024;
          surface.height = 160;
          const ctx = surface.getContext('2d');
          if (!ctx) return;
          ctx.fillStyle = '#0c1e2d';
          ctx.fillRect(0, 0, 1024, 160);
          ctx.fillStyle = color;
          ctx.fillRect(0, 150, 1024, 6);
          ctx.font = '500 50px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 512, 80, 970);
          const texture = new THREE.CanvasTexture(surface);
          texture.colorSpace = THREE.SRGBColorSpace;
          textures.push(texture);
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width, width / 6.4),
            new THREE.MeshBasicMaterial({ map: texture }),
          );
          mesh.position.set(x, y, z);
          mesh.rotation.y = angle;
          renderer.scene.add(mesh);
        };
        const ring = (radius: number, tube: number, y: number, color: string) => {
          const mesh = new THREE.Mesh(
            new THREE.TorusGeometry(radius, tube, 6, 160),
            material(color, true),
          );
          mesh.rotation.x = Math.PI / 2;
          mesh.position.y = y;
          renderer.scene.add(mesh);
        };
        const deck = new THREE.RingGeometry(innerRadius, outerRadius, 192);
        const deckPositions = deck.getAttribute('position');
        const deckUV = deck.getAttribute('uv');
        // Project deck tiles onto the ring instead of stretching one tile around it.
        for (let vertex = 0; vertex < deckPositions.count; vertex++) {
          deckUV.setXY(vertex, deckPositions.getX(vertex) / 2, deckPositions.getY(vertex) / 2);
        }
        const floor = new THREE.Mesh(deck, material('#65737a', false, 'deck'));
        floor.rotation.x = -Math.PI / 2;
        renderer.scene.add(floor);
        // Floor lanes lead to the doors; low walls keep the cutaway view readable.
        // The new enclosed promenade keeps those lanes, with full-height glass above its low inner wall.
        ring(27, 0.035, 0.025, '#73c9de');
        ring(33, 0.035, 0.025, '#73c9de');
        const glass = new THREE.MeshStandardMaterial({
          color: '#36566d',
          transparent: true,
          opacity: 0.22,
          metalness: 0.45,
          roughness: 0.15,
          side: THREE.DoubleSide,
        });
        const count = 128;
        for (let i = 0; i < count; i++) {
          const angle = ((i + 0.5) / count) * Math.PI * 2;
          const doorway = rooms.some(
            (room) =>
              Math.abs(Math.sin(angle - room.angle) * outerRadius) < 3.1 &&
              Math.cos(angle - room.angle) > 0,
          );
          const segment = (Math.PI * 2) / count;
          radialBox(angle, 0, 26, 0.55, 26 * segment + 0.08, 1.1, 0.18, '#354b5c', false, true);
          const window = radialBox(
            angle,
            0,
            26,
            2.35,
            26 * segment + 0.08,
            2.5,
            0.12,
            '#354b5c',
            false,
            true,
          );
          window.material = glass;
          if (!doorway)
            radialBox(
              angle,
              0,
              34,
              1.8,
              34 * segment + 0.1,
              3.6,
              0.25,
              i % 4 === 0 ? '#79858a' : '#5f7079',
              false,
              true,
            );
          // Sloping ceiling panels form the tube's arch, with ribs marking its curve.
          for (const side of [-1, 1]) {
            const roof = radialBox(
              angle,
              0,
              30 + side * 3,
              4.2,
              34 * segment + 0.1,
              0.18,
              2.35,
              '#46535b',
              false,
              true,
            );
            roof.rotateX((side * Math.PI) / 5);
          }
          radialBox(angle, 0, 30, 4.9, 34 * segment + 0.1, 0.2, 4.1, '#1b2c3a', false, true);
          if (i % 8 === 0) {
            for (const radius of [26.2, 33.8])
              if (!(doorway && radius > 30))
                radialBox(angle, 0, radius, 1.8, 0.18, 3.6, 0.22, '#607789');
            radialBox(angle, 0, 30, 4.75, 0.14, 0.06, 3.8, '#d0e9ec', true);
            radialBox(angle, 0, 30, 0.012, 0.06, 0.02, 8, '#566b7a');
          }
        }
        ring(26.1, 0.045, 1.1, '#7ec2d4');
        rooms.forEach((room) => {
          const a = room.angle;
          radialBox(a, 0, 36.8, -0.15, 6, 0.3, 7.2, '#65737a', false, false, 'deck');
          radialBox(a, 0, 51, -0.15, 22, 0.3, 22, '#65737a', false, false, 'deck');
          radialBox(a, 0, 36.8, 4.5, 6.2, 0.25, 7.2, '#46535b', false, true);
          radialBox(a, 0, 51, 5.8, 22.2, 0.3, 22.2, '#414e57', false, true);
          // Leave a wide doorway in each shared wall. The same rectangles build the walls
          // and block movement, so the openings you see are the openings you can walk through.
          for (const side of [-1, 1]) {
            radialBox(a, side * 3.1, 36.8, 2.2, 0.2, 4.4, 6.4, '#435b6c', false, true);
            radialBox(a, side * 7, 40, 2.9, 8, 5.8, 0.25, '#78868c', false, true);
            radialBox(a, side * 11, 51, 2.9, 0.25, 5.8, 22, '#64747d', false, true);
            radialBox(a, side * 2.9, 35, 2.1, 0.12, 4.2, 0.15, room.color, true);
            radialBox(a, side * 9.5, 51, 0.025, 0.05, 0.03, 20, room.color, true);
            for (const r of [44, 50, 57])
              radialBox(a, side * 10.8, r, 2.4, 0.12, 3.5, 0.5, '#61768a');
            radialBox(a, side * 10.78, 54, 1.35, 0.12, 1.1, 2.4, '#25323a');
            for (let slat = 0; slat < 7; slat++)
              radialBox(
                a,
                side * 10.68,
                54,
                0.92 + slat * 0.14,
                0.12,
                0.045,
                2.15,
                '#7a8587',
                false,
                false,
                'alloy',
              );
            radialBox(a, side * 8, 51, 5.42, 0.12, 0.14, 21, '#87918d', false, false, 'alloy');
            radialBox(a, side * 10.8, 51, 0.18, 0.16, 0.32, 21.8, '#35434c');
          }
          radialBox(a, 0, 62, 2.9, 22, 5.8, 0.25, '#78868c', false, true);
          radialBox(a, 0, 40, 5.1, 6, 1.4, 0.25, '#78868c', false, true);
          radialBox(a, 0, 35, 4.25, 6, 0.12, 0.15, room.color, true);
          for (const outward of [44, 51, 58])
            radialBox(a, 0, outward, 5.6, 12, 0.08, 0.3, '#c3e3ec', true);
          const lightPosition = worldPoint(a, 0, 51);
          const roomLight = new THREE.PointLight('#e5eeeb', 18, 18, 2);
          roomLight.position.set(lightPosition.x, 4.8, lightPosition.z);
          renderer.scene.add(roomLight);
          const entrance = worldPoint(a, 0, 34.3);
          sign(
            `${room.code} / ${room.name.toUpperCase()}`,
            entrance.x,
            3.6,
            entrance.z,
            a + Math.PI,
            room.color,
            5.4,
          );
          const back = worldPoint(a, 0, 61.7);
          sign(
            `WAYFARER / ${room.name.toUpperCase()}`,
            back.x,
            3.8,
            back.z,
            a + Math.PI,
            room.color,
            9,
          );
          const exit = worldPoint(a, 0, 40.2);
          sign('← ORBITAL PROMENADE →', exit.x, 4.8, exit.z, a, '#a9e8f3', 5.5);
        });
        furniture.forEach((item) => {
          const a = item.angle;
          const center = localPoint(a, item.x, item.z);
          const prop = (
            side: number,
            outward: number,
            y: number,
            w: number,
            h: number,
            d: number,
            color: string,
            glow = false,
            finish: Finish = 'alloy',
          ) =>
            radialBox(
              a,
              center.side + side,
              center.outward + outward,
              y,
              w,
              h,
              d,
              color,
              glow,
              false,
              finish,
            );
          if (item.kind === 'ship') {
            // A parked shuttle sits inside its collision footprint, leaving a path around it.
            box(item.x, 1.4, item.z, 3, 2, 8, '#aebdc8', false, a, true);
            prop(0, 0, 1.2, 7.8, 0.35, 4, '#607e98');
            prop(0, -1, 2.5, 2.2, 0.7, 3, '#4b98b4');
            for (const side of [-1, 1]) {
              prop(side * 1.8, 2.8, 1.5, 1, 1, 2, '#526a80');
              prop(side * 1.8, 3.85, 1.5, 0.7, 0.7, 0.1, '#6ee3fa', true);
              prop(side * 2.5, 0, 0.4, 0.25, 0.8, 3, '#354559');
            }
          } else {
            box(
              item.x,
              item.height / 2,
              item.z,
              item.width,
              item.height,
              item.depth,
              item.kind === 'bed' ? '#7c779b' : '#496071',
              false,
              a,
              true,
              item.kind === 'bed' || item.kind === 'seat' ? 'fabric' : 'alloy',
            );
            if (item.kind === 'bed') {
              prop(0, 0, 0.8, 2.8, 0.3, 4.8, '#bab6c9', false, 'fabric');
              prop(0, -0.6, 0.97, 2.85, 0.06, 3.3, '#6c8791', false, 'fabric');
              prop(0, 1.5, 1, 2.3, 0.2, 1, '#d9d7de', false, 'fabric');
            }
            if (['desk', 'console', 'navigation'].includes(item.kind)) {
              prop(0, 0, item.height + 0.05, item.width * 0.9, 0.1, item.depth * 0.85, '#263741');
              prop(
                0,
                0,
                item.height + 0.11,
                item.width * 0.72,
                0.025,
                item.depth * 0.6,
                '#b7d8dc',
                false,
                'display',
              );
              if (item.kind === 'console')
                for (const side of [-3, 0, 3]) {
                  const housing = prop(side, 0.55, 1.9, 2.4, 1.2, 0.22, '#283942');
                  housing.rotateX(-0.3);
                  const screen = prop(
                    side,
                    0.41,
                    1.9,
                    2.15,
                    0.95,
                    0.025,
                    '#b7d8dc',
                    false,
                    'display',
                  );
                  screen.rotateX(-0.3);
                }
            }
            if (item.kind === 'table' || item.kind === 'seat') {
              prop(
                0,
                0,
                item.height + 0.03,
                item.width * 0.95,
                0.08,
                item.depth * 0.95,
                item.kind === 'seat' ? '#87978b' : '#a49e89',
                false,
                item.kind === 'seat' ? 'fabric' : 'alloy',
              );
            }
            if (item.kind === 'locker') {
              for (const offset of [-0.65, 0.65])
                prop(offset, -1.51, 1.3, 0.045, 2.35, 0.025, '#283942');
              prop(0.35, -1.54, 1.4, 0.08, 0.45, 0.08, '#b6bdb8');
            }
            if (item.kind === 'supplies') prop(0, -2.02, 1.25, 1.5, 1, 0.04, '#a6d59a', true);
            if (item.kind === 'locker')
              for (const offset of [-0.8, 0, 0.8])
                prop(-0.77, offset, 1.7, 0.04, 0.4, 0.12, '#9be7e3', true);
          }
        });
        const boarding = worldPoint(-Math.PI / 2, 6.8, 50);
        box(boarding.x, 0.7, boarding.z, 0.5, 1.4, 0.5, '#4d6c80');
        box(boarding.x, 1.5, boarding.z, 0.8, 0.25, 0.8, '#7bdddc', true);

        const stars = new Float32Array(1800);
        for (let i = 0; i < stars.length; i += 3) {
          const angle = i * 2.39996;
          const y = Math.sin(i * 12.9898) * 140;
          stars[i] = Math.sin(angle) * 180;
          stars[i + 1] = y;
          stars[i + 2] = Math.cos(angle) * 180;
        }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
        renderer.scene.add(
          new THREE.Points(
            starGeometry,
            new THREE.PointsMaterial({ color: '#c6e1ff', size: 0.35, fog: false }),
          ),
        );
        const planet = new THREE.Mesh(
          new THREE.SphereGeometry(18, 40, 24),
          new THREE.MeshStandardMaterial({ color: '#467d9a', roughness: 0.85, fog: false }),
        );
        planet.position.set(-65, 28, -85);
        renderer.scene.add(planet);
        const core = new THREE.Mesh(
          new THREE.CylinderGeometry(5, 5, 20, 32),
          material('#1e3d52', false),
        );
        core.position.y = -6;
        renderer.scene.add(core);
        for (const y of [-10, -2, 3]) ring(5.2, 0.1, y, '#67c3de');

        const person = (x: number, z: number, appearance: CharacterAppearance) => {
          const model = createCharacterModel(appearance);
          const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.48, 24),
            new THREE.MeshBasicMaterial({
              color: '#07111c',
              transparent: true,
              opacity: 0.35,
              depthWrite: false,
            }),
          );
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.y = 0.018;
          model.group.add(shadow);
          // Characters own their fabric/skin textures as well as their meshes.
          // Remove them before the scene cleanup so each resource is freed once.
          disposeCharacters.push(() => {
            model.group.removeFromParent();
            model.dispose();
            shadow.geometry.dispose();
            shadow.material.dispose();
          });
          model.group.position.set(x, 0, z);
          renderer.scene.add(model.group);
          return model;
        };
        const player = person(stationSpawn.x, stationSpawn.z, character);
        player.group.rotation.y = Math.PI;
        const models = crew.map((npc, index) => {
          const model = person(npc.x, npc.z, {
            skin: skinTones[index % skinTones.length].id,
            hair: hairColors[index % hairColors.length].id,
            hairstyle: hairStyles[(index * 2) % hairStyles.length].id,
            suit: suitColors[index % suitColors.length].id,
          });
          // Crew stay focused on their workstation, companion, or the view.
          // Offset their idle poses so the whole station doesn't breathe in sync.
          model.group.rotation.y = npc.heading;
          for (let frame = 0; frame < index * 7; frame++) model.animate(0.05, 0);
          return model;
        });
        crew.forEach((npc) =>
          sign(npc.name, npc.x, 2.65, npc.z, Math.atan2(-npc.x, -npc.z), '#d0e2ea', 2.6),
        );
        const marker = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 0.56, 32),
          new THREE.MeshBasicMaterial({ color: '#bdeef3', side: THREE.DoubleSide }),
        );
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.035;
        marker.visible = false;
        renderer.scene.add(marker);
        let nearest: StationInteraction | undefined;
        interact = () => {
          if (store.getSnapshot().paused || !nearest) return;
          if (nearest.board) onBoard();
          else store.update({ dialogue: nearest.dialogue });
        };
        let yaw = Math.PI;
        let pitch = 0.2;
        turn = (x, y) => {
          if (store.getSnapshot().paused) return;
          yaw -= x * 0.006;
          pitch = THREE.MathUtils.clamp(pitch + y * 0.004, -0.2, 0.65);
        };
        const options = { signal: events.signal };
        let drag: { id: number; x: number; y: number } | undefined;
        canvas.addEventListener(
          'pointerdown',
          (event) => {
            if (store.getSnapshot().paused) return;
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
            canvas.setPointerCapture(event.pointerId);
          },
          options,
        );
        canvas.addEventListener(
          'pointermove',
          (event) => {
            if (!drag || event.pointerId !== drag.id) return;
            turn(event.clientX - drag.x, event.clientY - drag.y);
            drag.x = event.clientX;
            drag.y = event.clientY;
          },
          options,
        );
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
          canvas.addEventListener(
            name,
            () => {
              drag = undefined;
            },
            options,
          );
        canvas.addEventListener('contextmenu', (event) => event.preventDefault(), options);
        const movement = new Set([
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowLeft',
          'ArrowDown',
          'ArrowRight',
          'ShiftLeft',
          'ShiftRight',
          'KeyQ',
          'KeyR',
        ]);
        window.addEventListener(
          'keydown',
          (event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, select, textarea')) return;
            if (movement.has(event.code)) {
              event.preventDefault();
              if (!store.getSnapshot().paused) keys.add(event.code);
            }
            if (!event.repeat && event.code === 'KeyE') interact();
            if (!event.repeat && (event.code === 'Escape' || event.code === 'KeyP'))
              pause(!store.getSnapshot().paused);
          },
          options,
        );
        window.addEventListener('keyup', (event) => keys.delete(event.code), options);
        window.addEventListener(
          'blur',
          () => {
            drag = undefined;
            pause(true);
          },
          options,
        );
        document.addEventListener(
          'visibilitychange',
          () => {
            if (document.hidden) pause(true);
          },
          options,
        );
        window.addEventListener('resize', renderer.resize, options);
        canvas.addEventListener(
          'webglcontextlost',
          (event) => {
            event.preventDefault();
            pause(true);
            store.update({ error: 'Graphics interrupted. Reload to return to the station.' });
          },
          options,
        );
        renderer.scene.updateMatrixWorld(true);
        let previous = 0;
        let publishElapsed = 0;
        const lookAt = new THREE.Vector3();
        const desiredCamera = new THREE.Vector3();
        const cameraDirection = new THREE.Vector3();
        const ray = new THREE.Raycaster();
        renderer.setAnimationLoop((time) => {
          const dt = previous ? Math.min((time - previous) / 1000, 0.05) : 0;
          previous = time;
          if (!store.getSnapshot().paused) {
            yaw +=
              (Number(keys.has('KeyQ') || keys.has('ArrowLeft')) -
                Number(keys.has('KeyR') || keys.has('ArrowRight'))) *
              dt *
              1.7;
            const forward =
              Number(keys.has('KeyW') || keys.has('ArrowUp')) -
              Number(keys.has('KeyS') || keys.has('ArrowDown'));
            const side = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
            const length = Math.hypot(forward, side) || 1;
            const x = (Math.sin(yaw) * forward - Math.cos(yaw) * side) / length;
            const z = (Math.cos(yaw) * forward + Math.sin(yaw) * side) / length;
            const distance =
              dt *
              (keys.has('ShiftLeft') || keys.has('ShiftRight')
                ? characterSpeeds.run
                : characterSpeeds.walk);
            const position = player.group.position;
            const previousX = position.x;
            const previousZ = position.z;
            const clear = (px: number, pz: number) =>
              canStand(px, pz) && !crew.some((npc) => Math.hypot(px - npc.x, pz - npc.z) < 0.8);
            // Resolve each axis separately so walking into a wall slides along it.
            // Small steps also prevent running through narrow objects after a slow frame.
            const steps = Math.max(1, Math.ceil(distance / 0.12));
            for (let i = 0; i < steps; i++) {
              if (clear(position.x + (x * distance) / steps, position.z)) {
                position.x += (x * distance) / steps;
              }
              if (clear(position.x, position.z + (z * distance) / steps)) {
                position.z += (z * distance) / steps;
              }
            }
            if (forward || side) {
              const target = Math.atan2(x, z);
              player.group.rotation.y +=
                Math.atan2(
                  Math.sin(target - player.group.rotation.y),
                  Math.cos(target - player.group.rotation.y),
                ) * Math.min(1, dt * 12);
            }
            const traveled = Math.hypot(position.x - previousX, position.z - previousZ);
            player.animate(dt, dt > 0 ? traveled / dt : 0);
            models.forEach((model) => model.animate(dt, 0));
          }
          const position = player.group.position;
          const nextInteraction = interactionAt(position.x, position.z);
          if (nearest?.id !== nextInteraction?.id) store.update({ dialogue: '' });
          nearest = nextInteraction;
          marker.visible = nearest != null;
          if (nearest) marker.position.set(nearest.x, 0.035, nearest.z);
          publishElapsed += dt;
          if (publishElapsed > 0.1 || !store.getSnapshot().ready) {
            publishElapsed = 0;
            store.update({
              room: roomAt(position.x, position.z).name,
              nearby: nearest?.label ?? '',
              canBoard: nearest?.board ?? false,
              x: position.x,
              z: position.z,
              heading: yaw,
            });
          }
          lookAt.set(position.x, 1.5, position.z);
          desiredCamera.set(
            position.x - Math.sin(yaw) * Math.cos(pitch) * 4.8,
            1.5 + Math.sin(pitch) * 4.8,
            position.z - Math.cos(yaw) * Math.cos(pitch) * 4.8,
          );
          // Pull the camera in before it reaches a wall, ceiling, or furnishing.
          // The extra clearance keeps the near plane from peeking outside the station.
          cameraDirection.subVectors(desiredCamera, lookAt).normalize();
          ray.set(lookAt, cameraDirection);
          ray.far = 5.1;
          const hit = ray.intersectObjects(cameraBlockers, false)[0];
          if (hit && hit.distance < 5.1)
            desiredCamera
              .copy(lookAt)
              .addScaledVector(cameraDirection, Math.max(0.25, hit.distance - 0.3));
          renderer.camera.position.copy(desiredCamera);
          renderer.camera.lookAt(lookAt);
          player.group.visible = renderer.camera.position.distanceTo(lookAt) > 0.65;
          renderer.render();
          store.update({ ready: true });
        });
      } catch (error) {
        cleanup();
        store.update({
          ready: true,
          error: `Unable to open the station. WebGL 2 is required. ${String(error)}`,
        });
      }
      return cleanup;
    },
  };
}
