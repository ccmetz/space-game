import * as THREE from 'three';
import type { Flight } from '../flight/flight.ts';
import type { FlightControls } from '../flight/input.ts';
import type { World } from '../worlds/worlds.ts';
import { element } from './dom.ts';

interface HudFrame {
  dt: number;
  started: boolean;
  paused: boolean;
  controls: FlightControls;
  flight: Flight;
  target: World;
  discoveredCount: number;
}

export function createHud(
  ship: THREE.Object3D,
  camera: THREE.Camera,
  onSelectTarget: (id: string) => void,
  onJump: () => void,
) {
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

  const destinationButtons = document.querySelectorAll<HTMLButtonElement>('.destination');
  const markerPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const separation = new THREE.Vector3();
  let hudElapsed = 0;

  destinationButtons.forEach((button) =>
    button.addEventListener('click', () => {
      if (button.dataset.target) onSelectTarget(button.dataset.target);
    }),
  );
  element('jump-button').addEventListener('click', onJump);

  return {
    setTarget(target: World) {
      destinationButtons.forEach((button) =>
        button.classList.toggle('active', button.dataset.target === target.id),
      );
      targetName.textContent = markerName.textContent = target.name.toUpperCase();
    },
    update({ dt, started, paused, controls, flight, target, discoveredCount }: HudFrame) {
      markerPosition.copy(target.position).project(camera);
      camera.getWorldDirection(cameraDirection);
      separation.subVectors(target.position, camera.position);
      const inFront = cameraDirection.dot(separation) > 0;
      marker.hidden =
        !inFront || Math.abs(markerPosition.x) > 0.93 || Math.abs(markerPosition.y) > 0.75;
      marker.style.left = `${(markerPosition.x * 0.5 + 0.5) * innerWidth}px`;
      marker.style.top = `${(-markerPosition.y * 0.5 + 0.5) * innerHeight}px`;

      hudElapsed += dt;
      if (hudElapsed <= 0.1 && started) return;
      hudElapsed = 0;
      const {
        heading: headingDegrees,
        pitch: pitchDegrees,
        bank: bankDegrees,
      } = flight.readAttitude();
      const { speed, distance } = flight;
      const { boosting, braking } = controls;
      const headingStep = Math.floor(headingDegrees / 15) * 15;
      headingLabel.textContent = `${(Math.round(headingDegrees) % 360).toString().padStart(3, '0')}°`;
      headingTape.style.transform = `translateX(${-67.5 - (headingDegrees - headingStep) * 3}px)`;
      headingMarks.forEach((mark, index) => {
        mark.textContent = ((headingStep + (index - 4) * 15 + 360) % 360)
          .toString()
          .padStart(3, '0');
      });
      pitchLabel.textContent = `${pitchDegrees < -0.5 ? '−' : '+'}${Math.abs(Math.round(pitchDegrees)).toString().padStart(2, '0')}°`;
      bankLabel.textContent = `${Math.abs(bankDegrees) < 0.5 ? '' : bankDegrees > 0 ? 'L ' : 'R '}${Math.abs(Math.round(bankDegrees)).toString().padStart(2, '0')}°`;
      attitudeRoll.style.transform = `rotate(${bankDegrees}deg)`;
      pitchLadder.style.transform = `translateY(${pitchDegrees * 4}px)`;
      const throttle =
        !started || paused || braking ? 0 : boosting ? 100 : Math.round((42 / 180) * 100);
      throttleLabel.textContent = `${throttle.toString().padStart(2, '0')}%`;
      speedLabel.textContent = Math.round(speed).toString().padStart(2, '0');
      speedMeter.style.width = `${(speed / 180) * 100}%`;
      boostLabel.textContent = paused
        ? 'PAUSED'
        : braking
          ? 'BRAKING'
          : boosting
            ? 'BOOST'
            : 'CRUISE';
      flightState.textContent = !started
        ? 'SYSTEMS READY'
        : paused
          ? 'FLIGHT PAUSED'
          : boosting
            ? 'BOOST ENGAGED'
            : braking
              ? 'BRAKING'
              : 'FREE FLIGHT';
      distanceLabel.textContent = distance.toFixed(1);
      discoveredLabel.textContent = discoveredCount.toString().padStart(2, '0');
      targetDistance.textContent = `${Math.max(0, ship.position.distanceTo(target.position) - target.radius).toFixed(0)} KM`;
      targetStatus.textContent = target.discovered ? 'DISCOVERED' : 'UNEXPLORED';
    },
  };
}
