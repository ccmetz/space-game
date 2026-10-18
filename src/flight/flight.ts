import * as THREE from 'three';
import type { World } from '../worlds/worlds.ts';
import type { FlightControls } from './input.ts';

export function createFlight(ship: THREE.Object3D) {
  let speed = 0;
  let distance = 0;
  let pitch = 0;
  let yaw = 0;
  let roll = 0;
  let bank = 0;
  const forward = new THREE.Vector3();
  const attitude = new THREE.Euler(0, 0, 0, 'YXZ');

  return {
    get speed() {
      return speed;
    },
    get distance() {
      return distance;
    },
    get bank() {
      return bank;
    },
    launch() {
      speed = 32;
    },
    reset(started: boolean) {
      ship.position.set(0, 0, 0);
      ship.quaternion.identity();
      pitch = yaw = roll = bank = 0;
      speed = started ? 32 : 0;
    },
    jump(target: World) {
      ship.position
        .copy(target.position)
        .add(new THREE.Vector3(-target.radius * 1.15, -target.radius * 0.4, target.radius * 3.5));
      ship.quaternion.identity();
      pitch = yaw = roll = 0;
      speed = 32;
    },
    stopAtSurface(world: World, direction: THREE.Vector3) {
      // Push the ship outside solid surfaces and stop it gently instead of ending free flight.
      ship.position.copy(world.position).addScaledVector(direction, world.radius + 12);
      speed = 0;
    },
    update(dt: number, controls: FlightControls) {
      const smoothing = 1 - Math.exp(-4 * dt);
      pitch = THREE.MathUtils.lerp(
        pitch,
        Number(controls.pitchUp) - Number(controls.pitchDown),
        smoothing,
      );
      yaw = THREE.MathUtils.lerp(
        yaw,
        Number(controls.turnLeft) - Number(controls.turnRight),
        smoothing,
      );
      roll = THREE.MathUtils.lerp(
        roll,
        Number(controls.rollLeft) - Number(controls.rollRight),
        smoothing,
      );
      ship.rotateX(pitch * dt * 0.75);
      ship.rotateY(yaw * dt * 0.7);
      ship.rotateZ(roll * dt * 1.2);
      ship.quaternion.normalize();
      bank = THREE.MathUtils.lerp(bank, -yaw * 0.2, smoothing);
      speed = THREE.MathUtils.lerp(
        speed,
        controls.braking ? 0 : controls.boosting ? 180 : 42,
        1 - Math.exp(-(controls.braking ? 3 : 1.4) * dt),
      );
      forward.set(0, 0, -1).applyQuaternion(ship.quaternion);
      ship.position.addScaledVector(forward, speed * dt);
      distance += speed * dt;
    },
    readAttitude() {
      // The starting plane is our reference horizon. Reading the ship's orientation
      // keeps these instruments useful after a turn or roll, rather than just showing key presses.
      forward.set(0, 0, -1).applyQuaternion(ship.quaternion);
      attitude.setFromQuaternion(ship.quaternion, 'YXZ');
      return {
        heading: (THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z)) + 360) % 360,
        pitch: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))),
        bank: THREE.MathUtils.radToDeg(attitude.z),
      };
    },
  };
}

export type Flight = ReturnType<typeof createFlight>;
