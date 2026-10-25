import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canStand,
  createStation,
  interactionAt,
  promenade,
  roomAt,
  rooms,
  stationInteractions,
  stationSpawn,
} from './station.ts';
import { createGame } from '../game.ts';
import { createCharacter } from '../character/character.ts';
import { createRenderer } from '../graphics/renderer.ts';

const runtime = vi.hoisted(() => ({ frame: (_time: number) => {} }));
vi.mock('../graphics/renderer.ts', () => ({
  createRenderer: vi.fn<typeof createRenderer>(() => ({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    setAnimationLoop: (frame: (time: number) => void) => {
      runtime.frame = frame;
    },
    setPreview: () => {},
    render: () => {},
    resize: () => {},
    dispose: () => {},
  })),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('station exploration', () => {
  it('lets the player walk past crew without making them turn to follow', () => {
    vi.stubGlobal('window', { addEventListener: () => {} });
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => null }),
      addEventListener: () => {},
    });
    const canvas = { addEventListener: () => {} } as unknown as HTMLCanvasElement;
    const station = createStation();
    const character = createCharacter(() => ({ getItem: () => null, setItem: () => {} }));
    const cleanup = station.start(canvas, character.getSnapshot());
    try {
      expect(station.getSnapshot().error).toBe('');
      const scene: THREE.Scene = vi.mocked(createRenderer).mock.results[0].value.scene;
      const crewModels = stationInteractions
        .filter((item) => item.id.startsWith('crew'))
        .map((npc) =>
          scene.children.find(
            (child) =>
              child.type === 'Group' && child.position.x === npc.x && child.position.z === npc.z,
          ),
        );
      expect(crewModels.every((model) => model != null)).toBe(true);
      runtime.frame(1000);
      const headings = crewModels.map((model) => model!.rotation.y);
      station.press('KeyW');
      for (let frame = 1; frame <= 120; frame++) runtime.frame(1000 + frame * 50);
      expect(station.getSnapshot().z).toBeLessThan(stationSpawn.z - 5);
      crewModels.forEach((model, index) => expect(model!.rotation.y).toBe(headings[index]));
    } finally {
      cleanup();
    }
  });

  it('starts in the player’s quarters and connects every room through walkable doors', () => {
    const station = createStation();
    expect(station.getSnapshot().room).toBe('Your quarters');
    expect(roomAt(stationSpawn.x, stationSpawn.z).name).toBe('Your quarters');
    // Walk the floor in half-meter steps to catch sealed doors and isolated rooms.
    const queue = [[stationSpawn.x, stationSpawn.z]];
    const visited = new Set([`${stationSpawn.x},${stationSpawn.z}`]);
    const reachedRooms = new Set<string>();
    const crew = stationInteractions.filter((item) => item.id.startsWith('crew'));
    for (let index = 0; index < queue.length; index++) {
      const [x, z] = queue[index];
      reachedRooms.add(roomAt(x, z).name);
      for (const [dx, dz] of [
        [0.5, 0],
        [-0.5, 0],
        [0, 0.5],
        [0, -0.5],
      ]) {
        const nx = x + dx;
        const nz = z + dz;
        const key = `${nx},${nz}`;
        if (
          !visited.has(key) &&
          canStand(nx, nz) &&
          crew.every((npc) => Math.hypot(nx - npc.x, nz - npc.z) >= 0.8)
        ) {
          visited.add(key);
          queue.push([nx, nz]);
        }
      }
    }
    expect(reachedRooms).toEqual(new Set([...rooms.map((room) => room.name), promenade.name]));
    for (const door of ['0,36', '0,-36', '36,0', '-36,0']) expect(visited.has(door)).toBe(true);
    // The extra crew must leave the routes open and remain approachable for a chat.
    for (const npc of crew) {
      expect(canStand(npc.x, npc.z)).toBe(true);
      expect(queue.some(([x, z]) => interactionAt(x, z)?.id === npc.id)).toBe(true);
    }
  });

  it('blocks the hull, interior walls, and furniture while leaving doorways open', () => {
    for (const [x, z] of [
      [0, 0],
      [0, 25.8],
      [20, 35],
      [11, 50],
      [0, 62],
      [6, 53],
      [-53, 0],
    ]) {
      expect(canStand(x, z)).toBe(false);
    }
    expect(canStand(0, 36)).toBe(true);
    expect(canStand(0, 40)).toBe(true);
    for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
      expect(canStand(Math.sin(angle) * 30, Math.cos(angle) * 30)).toBe(true);
    }
  });

  it('makes room interactions reachable and only offers nearby actions', () => {
    expect(interactionAt(stationSpawn.x, stationSpawn.z)).toBeUndefined();
    for (const item of stationInteractions.filter((item) => !item.id.startsWith('crew'))) {
      expect(canStand(item.x, item.z)).toBe(true);
      expect(interactionAt(item.x, item.z)?.id).toBe(item.id);
    }
    expect(interactionAt(-50, 5.8)?.board).toBe(true);
    expect(interactionAt(0, 30)?.board).not.toBe(true);
  });

  it('enters the station before flight and prevents boarding from the cabin', () => {
    const game = createGame();
    expect(game.location.getSnapshot().scene).toBe('station');
    game.boardShip();
    expect(game.location.getSnapshot().scene).toBe('station');
  });
});
