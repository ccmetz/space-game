import type { Flight } from './flight.ts';
import type { FlightControls } from './input.ts';
import type { World } from '../worlds/worlds.ts';
import type { Vector3 } from 'three';

export interface Telemetry {
  speed: number;
  distance: number;
  heading: number;
  pitch: number;
  bank: number;
  boosting: boolean;
  braking: boolean;
  targetDistance: number;
  targetDiscovered: boolean;
  discoveredCount: number;
}

export const initialTelemetry: Telemetry = {
  speed: 0,
  distance: 0,
  heading: 0,
  pitch: 0,
  bank: 0,
  boosting: false,
  braking: false,
  targetDistance: 0,
  targetDiscovered: false,
  discoveredCount: 0,
};

export function readTelemetry(
  flight: Flight,
  controls: FlightControls,
  position: Vector3,
  target: World,
  discoveredCount: number,
): Telemetry {
  return {
    ...flight.readAttitude(),
    speed: flight.speed,
    distance: flight.distance,
    boosting: controls.boosting,
    braking: controls.braking,
    targetDistance: Math.max(0, position.distanceTo(target.position) - target.radius),
    targetDiscovered: target.discovered,
    discoveredCount,
  };
}
