import { expect, test } from 'vitest';
import * as THREE from 'three';
import { createFlight, type Flight } from './flight.ts';
import type { FlightControls } from './input.ts';
import { createWorlds } from '../worlds/worlds.ts';

const cruise = {
  pitchUp: false,
  pitchDown: false,
  turnLeft: false,
  turnRight: false,
  rollLeft: false,
  rollRight: false,
  boosting: false,
  braking: false,
};

function advance(flight: Flight, controls: FlightControls, seconds: number) {
  for (let frame = 0; frame < seconds * 60; frame++) flight.update(1 / 60, controls);
}

test('flight moves forward, boosts and brakes while tracking distance', () => {
  const ship = new THREE.Group();
  const flight = createFlight(ship);
  flight.launch();
  advance(flight, cruise, 3);
  expect(Math.abs(flight.speed - 42)).toBeLessThan(1);
  expect(ship.position.z).toBeLessThan(-100);
  expect(Math.abs(flight.distance + ship.position.z)).toBeLessThan(0.001);

  advance(flight, { ...cruise, boosting: true }, 4);
  expect(flight.speed).toBeGreaterThan(175);
  advance(flight, { ...cruise, boosting: true, braking: true }, 3);
  expect(flight.speed).toBeLessThan(0.1);
});

test('steering changes actual attitude and reset clears steering momentum', () => {
  const ship = new THREE.Group();
  const flight = createFlight(ship);
  flight.launch();
  advance(flight, { ...cruise, pitchUp: true, turnLeft: true, rollLeft: true }, 1);
  expect(ship.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.5);
  expect(Math.abs(flight.readAttitude().pitch)).toBeGreaterThan(1);
  expect(Math.abs(flight.readAttitude().bank)).toBeGreaterThan(1);

  const travelled = flight.distance;
  flight.reset(true);
  flight.update(1 / 60, cruise);
  expect(ship.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.000001);
  expect(flight.bank).toBe(0);
  expect(ship.position.x).toBe(0);
  expect(ship.position.y).toBe(0);
  expect(flight.distance).toBeGreaterThan(travelled);
  flight.reset(false);
  expect(flight.speed).toBe(0);
});

test('jump places the ship safely near the selected world and restores forward flight', () => {
  const ship = new THREE.Group();
  const flight = createFlight(ship);
  const worlds = createWorlds(() => new THREE.Sprite());
  const target = worlds.getTarget('aurelia');
  advance(flight, { ...cruise, turnLeft: true }, 1);
  flight.jump(target);
  expect(ship.position.distanceTo(target.position)).toBeGreaterThan(target.radius + 12);
  expect(ship.position.distanceTo(target.position)).toBeLessThan(target.radius * 4);
  expect(flight.speed).toBe(32);
  flight.update(1 / 60, cruise);
  expect(ship.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.000001);
});
