import { describe, expect, it } from 'vitest';
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

describe('station exploration', () => {
  it('starts in the player’s quarters and connects every room through walkable doors', () => {
    const station = createStation();
    expect(station.getSnapshot().room).toBe('Your quarters');
    expect(roomAt(stationSpawn.x, stationSpawn.z).name).toBe('Your quarters');
    // Walk the floor in half-meter steps to catch sealed doors and isolated rooms.
    const queue = [[stationSpawn.x, stationSpawn.z]];
    const visited = new Set([`${stationSpawn.x},${stationSpawn.z}`]);
    const reachedRooms = new Set<string>();
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
        if (!visited.has(key) && canStand(nx, nz)) {
          visited.add(key);
          queue.push([nx, nz]);
        }
      }
    }
    expect(reachedRooms).toEqual(new Set([...rooms.map((room) => room.name), promenade.name]));
    for (const door of ['0,36', '0,-36', '36,0', '-36,0']) expect(visited.has(door)).toBe(true);
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
