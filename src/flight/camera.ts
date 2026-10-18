import * as THREE from 'three';

export function createCameraController(camera: THREE.PerspectiveCamera, ship: THREE.Object3D) {
  const up = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  return {
    place(immediate: boolean, dt: number, preview: boolean) {
      if (preview) {
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
    },
  };
}
