import * as THREE from 'three';
import { hairColors, skinTones, suitColors, type Character } from './character.ts';

export type CharacterAppearance = Pick<Character, 'skin' | 'hair' | 'hairstyle' | 'suit'>;

// Registration and the station build this same model, so the preview shows the
// actual character the player will control, including the silhouette from behind.
export function createCharacterModel(appearance: CharacterAppearance) {
  const skin = skinTones.find((item) => item.id === appearance.skin)?.color ?? skinTones[0].color;
  const hair = hairColors.find((item) => item.id === appearance.hair)?.color ?? hairColors[0].color;
  const suit = suitColors.find((item) => item.id === appearance.suit)?.color ?? suitColors[0].color;
  const group = new THREE.Group();
  const limbs: THREE.Group[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function part(
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = group,
  ) {
    let material = materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      materials.set(color, material);
    }
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function oval(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: string,
    parent: THREE.Object3D = group,
  ) {
    const mesh = part(new THREE.SphereGeometry(1, 20, 16), color, x, y, z, parent);
    mesh.scale.set(width, height, depth);
    return mesh;
  }
  function box(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: string,
    parent: THREE.Object3D = group,
  ) {
    return part(new THREE.BoxGeometry(width, height, depth), color, x, y, z, parent);
  }
  const dark = '#29353c';
  oval(0, 1.23, 0, 0.29, 0.38, 0.17, suit);
  oval(0, 1.26, 0.1, 0.215, 0.3, 0.105, '#23363d');
  box(0, 0.94, 0, 0.49, 0.085, 0.32, '#101e29');
  box(0, 0.94, 0.17, 0.09, 0.07, 0.035, '#81979f');
  box(0, 1.2, 0.211, 0.018, 0.4, 0.02, suit);
  box(0.13, 1.36, 0.206, 0.09, 0.045, 0.025, '#d7f1da');
  box(0, 1.08, 0.2, 0.31, 0.05, 0.03, '#101e29');
  part(new THREE.CylinderGeometry(0.095, 0.11, 0.19, 16), skin, 0, 1.62, 0);
  for (const side of [-1, 1]) {
    const collar = box(side * 0.1, 1.52, 0.12, 0.15, 0.07, 0.11, suit);
    collar.rotation.z = side * -0.5;
    const leg = new THREE.Group();
    leg.position.set(side * 0.135, 0.9, 0);
    group.add(leg);
    limbs.push(leg);
    part(new THREE.CapsuleGeometry(0.105, 0.55, 4, 12), dark, 0, -0.37, 0, leg);
    box(0, -0.81, 0.045, 0.22, 0.17, 0.33, '#17232c', leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.32, 1.48, 0);
    group.add(arm);
    limbs.push(arm);
    arm.rotation.z = side * 0.12;
    part(new THREE.CapsuleGeometry(0.085, 0.41, 4, 12), suit, 0, -0.25, 0, arm);
    oval(0, -0.56, 0, 0.075, 0.11, 0.085, dark, arm);
    oval(side * 0.207, 1.84, 0, 0.047, 0.075, 0.035, skin);
  }
  oval(0, 1.86, 0, 0.195, 0.255, 0.175, skin);
  oval(0, 1.73, 0.02, 0.145, 0.105, 0.13, skin);
  for (const side of [-1, 1]) {
    oval(side * 0.077, 1.87, 0.162, 0.032, 0.018, 0.012, '#e4e5dd');
    oval(side * 0.077, 1.868, 0.173, 0.013, 0.014, 0.006, '#292b30');
    const brow = box(side * 0.079, 1.912, 0.158, 0.065, 0.013, 0.014, hair);
    brow.rotation.z = side * -0.08;
  }
  oval(0, 1.82, 0.174, 0.025, 0.05, 0.036, skin);
  const mouth = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.05, 1.753, 0.15),
    new THREE.Vector3(0, 1.738, 0.17),
    new THREE.Vector3(0.05, 1.753, 0.15),
  );
  part(new THREE.TubeGeometry(mouth, 12, 0.005, 5, false), '#754f43', 0, 0, 0);
  const hairstyle = new THREE.Group();
  group.add(hairstyle);
  function cap(height: number, width: number, depth: number) {
    const mesh = part(
      new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      hair,
      0,
      height,
      -0.005,
      hairstyle,
    );
    mesh.scale.set(width, 2.12 - height, depth);
  }
  // Longer hair sits behind the face and neck so the portrait keeps its depth.
  switch (appearance.hairstyle) {
    case 'bald':
      break;
    case 'shaved':
      cap(1.995, 0.185, 0.16);
      break;
    case 'swept': {
      cap(1.96, 0.208, 0.184);
      const fringe = oval(-0.045, 2.025, 0.105, 0.185, 0.075, 0.105, hair, hairstyle);
      fringe.rotation.z = 0.38;
      oval(-0.18, 1.95, 0.025, 0.04, 0.09, 0.12, hair, hairstyle);
      break;
    }
    case 'bob':
      cap(1.96, 0.225, 0.2);
      oval(0, 1.84, -0.13, 0.22, 0.23, 0.1, hair, hairstyle);
      for (const side of [-1, 1]) oval(side * 0.2, 1.85, 0, 0.06, 0.22, 0.15, hair, hairstyle);
      box(0, 1.97, 0.16, 0.34, 0.1, 0.055, hair, hairstyle);
      break;
    case 'long':
      cap(1.98, 0.22, 0.2);
      oval(0, 1.68, -0.13, 0.235, 0.42, 0.11, hair, hairstyle);
      for (const side of [-1, 1]) {
        oval(side * 0.195, 1.71, -0.005, 0.065, 0.35, 0.12, hair, hairstyle);
        const fringe = oval(side * 0.105, 2.02, 0.12, 0.12, 0.065, 0.08, hair, hairstyle);
        fringe.rotation.z = -side * 0.65;
      }
      break;
    case 'curls':
      for (let row = 0; row < 3; row++) {
        const polar = 0.25 + row * 0.5;
        for (let i = 0; i < 10; i++) {
          const angle = ((i + row * 0.5) / 10) * Math.PI * 2;
          oval(
            Math.cos(angle) * Math.sin(polar) * 0.205,
            1.96 + Math.cos(polar) * 0.15,
            Math.sin(angle) * Math.sin(polar) * 0.18,
            0.065,
            0.065,
            0.065,
            hair,
            hairstyle,
          );
        }
      }
      break;
    case 'bun':
      cap(1.96, 0.205, 0.19);
      oval(0, 2.09, -0.15, 0.11, 0.12, 0.11, hair, hairstyle);
      break;
    case 'mohawk':
      for (let i = 0; i < 6; i++)
        oval(
          0,
          2.07 + Math.sin((i / 5) * Math.PI) * 0.09,
          -0.15 + i * 0.06,
          0.045,
          0.13,
          0.055,
          hair,
          hairstyle,
        );
      break;
    default:
      cap(1.96, 0.205, 0.18);
      for (const side of [-1, 1]) box(side * 0.185, 1.94, 0.01, 0.035, 0.12, 0.13, hair, hairstyle);
  }
  return {
    group,
    limbs,
    hairstyle,
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
