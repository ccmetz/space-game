import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createFlight } from '../src/flight/flight.ts';
import { createWorlds } from '../src/worlds/worlds.ts';

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

function advance(flight, controls, seconds) {
  for (let frame = 0; frame < seconds * 60; frame++) flight.update(1 / 60, controls);
}

test('flight moves forward, boosts and brakes while tracking distance', () => {
  const ship = new THREE.Group();
  const flight = createFlight(ship);
  flight.launch();
  advance(flight, cruise, 3);
  assert.ok(Math.abs(flight.speed - 42) < 1);
  assert.ok(ship.position.z < -100);
  assert.ok(Math.abs(flight.distance + ship.position.z) < 0.001);

  advance(flight, { ...cruise, boosting: true }, 4);
  assert.ok(flight.speed > 175);
  advance(flight, { ...cruise, boosting: true, braking: true }, 3);
  assert.ok(flight.speed < 0.1);
});

test('steering changes actual attitude and reset clears steering momentum', () => {
  const ship = new THREE.Group();
  const flight = createFlight(ship);
  flight.launch();
  advance(flight, { ...cruise, pitchUp: true, turnLeft: true, rollLeft: true }, 1);
  assert.ok(ship.quaternion.angleTo(new THREE.Quaternion()) > 0.5);
  assert.ok(Math.abs(flight.readAttitude().pitch) > 1);
  assert.ok(Math.abs(flight.readAttitude().bank) > 1);

  const travelled = flight.distance;
  flight.reset(true);
  flight.update(1 / 60, cruise);
  assert.ok(ship.quaternion.angleTo(new THREE.Quaternion()) < 0.000001);
  assert.equal(flight.bank, 0);
  assert.equal(ship.position.x, 0);
  assert.equal(ship.position.y, 0);
  assert.ok(flight.distance > travelled);
  flight.reset(false);
  assert.equal(flight.speed, 0);
});

test('jump places the ship safely near the selected world and restores forward flight', () => {
  const ship = new THREE.Group();
  const flight = createFlight(ship);
  const worlds = createWorlds(() => new THREE.Sprite());
  const target = worlds.getTarget('aurelia');
  advance(flight, { ...cruise, turnLeft: true }, 1);
  flight.jump(target);
  assert.ok(ship.position.distanceTo(target.position) > target.radius + 12);
  assert.ok(ship.position.distanceTo(target.position) < target.radius * 4);
  assert.equal(flight.speed, 32);
  flight.update(1 / 60, cruise);
  assert.ok(ship.quaternion.angleTo(new THREE.Quaternion()) < 0.000001);
});

test('proximity discovers each world once and stops flight outside planet and star surfaces', () => {
  const ship = new THREE.Group();
  const flight = createFlight(ship);
  const worlds = createWorlds(() => new THREE.Sprite());
  const discoveries = [];
  const limits = [];
  const inspect = () =>
    worlds.checkProximity(
      ship.position,
      (world) => {
        discoveries.push(world.id);
      },
      (world, direction) => {
        limits.push(world.id);
        flight.stopAtSurface(world, direction);
      },
    );

  for (const id of ['pelagos', 'solace']) {
    const target = worlds.getTarget(id);
    flight.launch();
    // Exact center exercises the fallback direction as well as ordinary surface contact.
    ship.position.copy(target.position);
    inspect();
    assert.ok(Math.abs(ship.position.distanceTo(target.position) - target.radius - 12) < 0.000001);
    assert.equal(flight.speed, 0);
    inspect();
  }
  assert.deepEqual(discoveries, ['pelagos', 'solace']);
  assert.deepEqual(limits, ['pelagos', 'solace']);
  assert.equal(worlds.discoveredCount, 2);
});
