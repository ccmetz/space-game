import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hairColors, skinTones, suitColors, type Character } from './character.ts';

export type CharacterAppearance = Pick<Character, 'skin' | 'hair' | 'hairstyle' | 'suit'>;
export const characterSpeeds = { walk: 2, run: 4.4 } as const;
type Contour = [height: number, width: number, depth: number];

// Registration and the station build this same model, so the preview shows the
// actual character the player will control, including the silhouette from behind.
export function createCharacterModel(appearance: CharacterAppearance) {
  const skinColor =
    skinTones.find((item) => item.id === appearance.skin)?.color ?? skinTones[0].color;
  const hairColor =
    hairColors.find((item) => item.id === appearance.hair)?.color ?? hairColors[0].color;
  const suitColor =
    suitColors.find((item) => item.id === appearance.suit)?.color ?? suitColors[0].color;
  const headContours: Contour[] = [
    [1.768, 0.025, 0.038],
    [1.785, 0.062, 0.073],
    [1.815, 0.09, 0.083],
    [1.86, 0.108, 0.095],
    [1.91, 0.119, 0.104],
    [1.957, 0.117, 0.108],
    [2.01, 0.114, 0.103],
    [2.05, 0.092, 0.085],
    [2.075, 0.045, 0.044],
    [2.082, 0.001, 0.001],
  ];
  const group = new THREE.Group();
  const limbs: THREE.Group[] = [];
  const hairstyle = new THREE.Group();
  group.add(hairstyle);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials: THREE.MeshStandardMaterial[] = [];
  const textures: THREE.Texture[] = [];

  // Small, repeatable surface patterns keep cloth and skin from looking like
  // smooth plastic. Data textures also work in tests without a browser canvas.
  function surface(kind: 'cloth' | 'skin') {
    const size = 64;
    const pixels = new Uint8Array(size * size * 4);
    let seed = 41;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const grain = (seed >>> 24) / 255;
        const value =
          kind === 'cloth'
            ? 110 + 45 * Math.sin((x * Math.PI) / 2) * Math.cos((y * Math.PI) / 2) + grain * 20
            : 110 + grain * 55;
        const offset = (y * size + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
        pixels[offset + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(pixels, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.repeat.set(kind === 'cloth' ? 8 : 5, kind === 'cloth' ? 8 : 5);
    texture.needsUpdate = true;
    textures.push(texture);
    return texture;
  }
  function material(
    color: THREE.ColorRepresentation,
    options: THREE.MeshStandardMaterialParameters = {},
  ) {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...options });
    materials.push(result);
    return result;
  }
  const weave = surface('cloth');
  const pores = surface('skin');
  const skin = material(skinColor, { roughness: 0.48, bumpMap: pores, bumpScale: 0.00045 });
  const faceSkin = material(skinColor, {
    roughness: 0.52,
    bumpMap: pores,
    bumpScale: 0.00045,
    vertexColors: true,
  });
  const skinShade = material(new THREE.Color(skinColor).multiplyScalar(0.68), { roughness: 0.58 });
  const lips = material(new THREE.Color(skinColor).lerp(new THREE.Color('#8b4542'), 0.3), {
    roughness: 0.48,
  });
  const mouth = material(new THREE.Color(skinColor).multiplyScalar(0.3));
  const fabric = material(suitColor, { roughness: 0.89, bumpMap: weave, bumpScale: 0.0014 });
  const panels = material(new THREE.Color(suitColor).multiplyScalar(0.7), { roughness: 0.65 });
  const undersuit = material('#242e35', { roughness: 0.96, bumpMap: weave, bumpScale: 0.001 });
  const rubber = material('#141d24', { roughness: 0.78 });
  const metal = material('#89979e', { metalness: 0.78, roughness: 0.32 });
  const seam = material(new THREE.Color(suitColor).multiplyScalar(0.47));
  const trim = material('#d0c3a1', { roughness: 0.62 });
  const hair = material(hairColor, { roughness: 0.78 });
  const eyeWhite = material('#c9c6b9', { roughness: 0.26 });
  const iris = material('#52655e', { roughness: 0.3 });
  const pupil = material('#0a1013', { roughness: 0.16 });
  const glint = material('#f1f5ee', { roughness: 0.1 });
  const indicator = material('#85d8d7', { emissive: '#4b9698', emissiveIntensity: 0.4 });

  function part(
    geometry: THREE.BufferGeometry,
    finish: THREE.MeshStandardMaterial,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Object3D = group,
  ) {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, finish);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
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
    finish: THREE.MeshStandardMaterial,
    parent: THREE.Object3D = group,
  ) {
    const mesh = part(new THREE.SphereGeometry(1, 24, 16), finish, x, y, z, parent);
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
    finish: THREE.MeshStandardMaterial,
    parent: THREE.Object3D = group,
  ) {
    return part(
      new RoundedBoxGeometry(width, height, depth, 2, Math.min(width, height, depth) * 0.22),
      finish,
      x,
      y,
      z,
      parent,
    );
  }
  function line(
    points: number[][],
    radius: number,
    finish: THREE.MeshStandardMaterial,
    parent: THREE.Object3D = group,
  ) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return part(
      new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), radius, 5, false),
      finish,
      0,
      0,
      0,
      parent,
    );
  }

  // A continuous outline gives the jaw, torso, and limbs their shape without
  // visible balls at every joint. The face is sculpted into this same surface.
  function shaped(
    contours: Contour[],
    finish: THREE.MeshStandardMaterial,
    parent: THREE.Object3D = group,
    face = false,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      contours.map(([y, x, z]) => new THREE.Vector3(x, y, z)),
    );
    const rows = face ? 80 : 32;
    const columns = face ? 96 : 32;
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const bump = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
      Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);
    for (let row = 0; row <= rows; row++) {
      const contour = curve.getPoint(row / rows);
      for (let column = 0; column <= columns; column++) {
        const angle = (column / columns) * Math.PI * 2;
        const x = Math.sin(angle) * Math.max(0.0001, contour.x);
        const y = contour.y;
        let z = Math.cos(angle) * Math.max(0.0001, contour.z);
        if (face && Math.cos(angle) > 0) {
          const front = Math.pow(Math.cos(angle), 4);
          z +=
            front *
            (0.043 * bump(x, y, 0, 1.918, 0.018, 0.052) +
              0.037 * bump(x, y, 0, 1.893, 0.024, 0.018) +
              0.014 * bump(x, y, 0, 1.842, 0.05, 0.025) +
              0.016 * bump(x, y, 0, 1.798, 0.043, 0.022) +
              0.012 * bump(x, y, -0.073, 1.903, 0.036, 0.028) +
              0.012 * bump(x, y, 0.073, 1.903, 0.036, 0.028) -
              0.019 * bump(x, y, -0.051, 1.94, 0.032, 0.02) -
              0.019 * bump(x, y, 0.051, 1.94, 0.032, 0.02));
        }
        positions.push(x, y, z);
        if (face) {
          // Subtle warmth in the cheeks and shadows around the eyes add depth
          // across every skin tone without baking the studio lights into the face.
          const warmth =
            bump(Math.abs(x), y, 0.075, 1.894, 0.032, 0.032) * Math.max(0, Math.cos(angle));
          const socket =
            bump(Math.abs(x), y, 0.05, 1.936, 0.032, 0.02) * Math.max(0, Math.cos(angle));
          colors.push(
            1 - socket * 0.09,
            1 - warmth * 0.085 - socket * 0.12,
            1 - warmth * 0.1 - socket * 0.13,
          );
        }
        uvs.push(column / columns, row / rows);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column;
          indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    if (face) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return part(geometry, finish, 0, 0, 0, parent);
  }

  shaped(
    [
      [0.97, 0.03, 0.03],
      [1.01, 0.17, 0.115],
      [1.11, 0.185, 0.13],
      [1.22, 0.17, 0.115],
      [1.39, 0.205, 0.135],
      [1.54, 0.235, 0.14],
      [1.63, 0.225, 0.11],
      [1.68, 0.11, 0.08],
      [1.69, 0.06, 0.06],
    ],
    fabric,
  );
  shaped(
    [
      [1.65, 0.065, 0.06],
      [1.7, 0.068, 0.062],
      [1.79, 0.062, 0.064],
      [1.81, 0.055, 0.055],
    ],
    skin,
  );
  shaped(
    [
      [1.65, 0.08, 0.075],
      [1.68, 0.083, 0.077],
      [1.72, 0.076, 0.071],
    ],
    undersuit,
  );
  // Suit panels follow the chest, with raised seams and practical hardware.
  for (const side of [-1, 1]) {
    const chest = box(side * 0.105, 1.49, 0.126, 0.164, 0.2, 0.016, fabric);
    chest.rotation.y = side * 0.16;
    line(
      [
        [side * 0.04, 1.64, 0.086],
        [side * 0.19, 1.59, 0.105],
        [side * 0.206, 1.43, 0.096],
        [side * 0.16, 1.28, 0.089],
      ],
      0.004,
      seam,
    );
    line(
      [
        [side * 0.04, 1.61, -0.083],
        [side * 0.16, 1.53, -0.116],
        [side * 0.13, 1.26, -0.092],
      ],
      0.004,
      seam,
    );
    box(side * 0.12, 1.34, 0.114, 0.12, 0.075, 0.028, fabric);
    line(
      [
        [side * 0.064, 1.36, 0.134],
        [side * 0.17, 1.36, 0.13],
      ],
      0.003,
      seam,
    );
    const collar = box(side * 0.105, 1.665, 0.052, 0.065, 0.085, 0.09, panels);
    collar.rotation.z = side * 0.36;
  }
  line(
    [
      [0, 1.18, 0.12],
      [0, 1.4, 0.144],
      [0, 1.59, 0.144],
      [0, 1.69, 0.076],
    ],
    0.007,
    rubber,
  );
  box(0, 1.57, 0.155, 0.015, 0.032, 0.012, metal);
  box(-0.115, 1.53, 0.153, 0.09, 0.037, 0.008, rubber);
  for (let i = 0; i < 3; i++) box(-0.14 + i * 0.024, 1.53, 0.16, 0.015, 0.007, 0.005, trim);
  box(0.105, 1.53, 0.153, 0.064, 0.014, 0.008, indicator);
  shaped(
    [
      [1.09, 0.185, 0.135],
      [1.105, 0.189, 0.139],
      [1.16, 0.177, 0.127],
      [1.17, 0.172, 0.123],
    ],
    rubber,
  );
  box(0, 1.135, 0.143, 0.072, 0.047, 0.022, metal);
  box(0, 1.135, 0.157, 0.043, 0.024, 0.008, rubber);
  box(0.172, 1.095, 0.063, 0.083, 0.13, 0.1, panels);
  box(0, 1.46, -0.144, 0.24, 0.31, 0.075, panels);
  for (let i = 0; i < 4; i++) box(0, 1.39 + i * 0.035, -0.187, 0.14, 0.009, 0.008, rubber);

  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.105, 1.055, 0);
    group.add(leg);
    limbs.push(leg);
    shaped(
      [
        [-0.91, 0.06, 0.068],
        [-0.81, 0.07, 0.078],
        [-0.67, 0.082, 0.092],
        [-0.52, 0.071, 0.081],
        [-0.43, 0.078, 0.084],
        [-0.28, 0.1, 0.102],
        [-0.1, 0.108, 0.11],
        [0.015, 0.087, 0.087],
        [0.05, 0.02, 0.02],
      ],
      undersuit,
      leg,
    );
    oval(0, -0.24, 0.04, 0.091, 0.2, 0.076, fabric, leg);
    box(0, -0.49, 0.074, 0.125, 0.13, 0.046, panels, leg);
    for (let i = 0; i < 3; i++)
      line(
        [
          [-0.054, -0.39 - i * 0.025, 0.067],
          [0, -0.4 - i * 0.025, 0.085],
          [0.054, -0.39 - i * 0.025, 0.067],
        ],
        0.006,
        rubber,
        leg,
      );
    line(
      [
        [side * 0.075, -0.1, 0.065],
        [side * 0.09, -0.27, 0.057],
        [side * 0.056, -0.42, 0.05],
      ],
      0.004,
      seam,
      leg,
    );
    box(side * 0.072, -0.23, 0.02, 0.064, 0.16, 0.13, panels, leg);
    shaped(
      [
        [-1.015, 0.074, 0.094],
        [-0.97, 0.081, 0.1],
        [-0.83, 0.071, 0.077],
        [-0.79, 0.075, 0.079],
      ],
      rubber,
      leg,
    );
    box(0, -0.975, 0.043, 0.174, 0.13, 0.29, rubber, leg);
    box(0, -1.03, 0.042, 0.18, 0.035, 0.3, undersuit, leg);
    box(0, -0.961, 0.138, 0.145, 0.075, 0.09, panels, leg);
    for (let i = 0; i < 3; i++)
      box(0, -0.89 - i * 0.026, 0.102 + i * 0.008, 0.11, 0.014, 0.02, seam, leg);

    const arm = new THREE.Group();
    arm.position.set(side * 0.245, 1.605, 0);
    arm.rotation.z = side * 0.085;
    group.add(arm);
    limbs.push(arm);
    shaped(
      [
        [-0.56, 0.046, 0.049],
        [-0.49, 0.057, 0.06],
        [-0.37, 0.069, 0.07],
        [-0.29, 0.061, 0.066],
        [-0.18, 0.082, 0.082],
        [-0.04, 0.078, 0.079],
        [0.045, 0.052, 0.055],
        [0.066, 0.005, 0.005],
      ],
      fabric,
      arm,
    );
    // A thin sleeve seam follows the shoulder instead of adding a round cap.
    line(
      [
        [side * 0.045, 0.025, 0.048],
        [side * 0.078, -0.035, 0.045],
        [side * 0.067, -0.115, 0.044],
      ],
      0.0025,
      seam,
      arm,
    );
    box(side * 0.075, -0.07, 0.005, 0.015, 0.075, 0.075, trim, arm);
    oval(0, -0.295, -0.032, 0.063, 0.072, 0.057, rubber, arm);
    for (let i = 0; i < 3; i++)
      line(
        [
          [-0.045, -0.26 - i * 0.025, 0.052],
          [0, -0.27 - i * 0.025, 0.067],
          [0.045, -0.26 - i * 0.025, 0.052],
        ],
        0.004,
        seam,
        arm,
      );
    box(0, -0.446, 0.056, 0.083, 0.145, 0.027, panels, arm);
    shaped(
      [
        [-0.565, 0.051, 0.054],
        [-0.55, 0.054, 0.057],
        [-0.52, 0.052, 0.055],
      ],
      rubber,
      arm,
    );
    if (side === -1) {
      box(0, -0.47, 0.076, 0.061, 0.054, 0.016, metal, arm);
      box(0, -0.47, 0.086, 0.045, 0.035, 0.007, indicator, arm);
    }
    oval(0, -0.613, 0, 0.048, 0.069, 0.029, skin, arm);
    // Separate curled fingers and a thumb keep the hands readable in silhouette.
    for (let finger = 0; finger < 4; finger++) {
      const x = -0.033 + finger * 0.021;
      line(
        [
          [x, -0.636, 0.003],
          [x, -0.68 - Math.sin((finger / 3) * Math.PI) * 0.01, 0.013],
          [x, -0.69, 0.032],
        ],
        0.0105,
        skin,
        arm,
      );
    }
    line(
      [
        [-side * 0.037, -0.59, 0.015],
        [-side * 0.059, -0.62, 0.029],
        [-side * 0.052, -0.65, 0.04],
      ],
      0.015,
      skin,
      arm,
    );
  }

  shaped(headContours, faceSkin, group, true);
  for (const side of [-1, 1]) {
    oval(side * 0.119, 1.915, -0.003, 0.025, 0.043, 0.025, skin);
    oval(side * 0.132, 1.917, 0.015, 0.01, 0.026, 0.009, skinShade);
    oval(side * 0.131, 1.905, 0.019, 0.008, 0.016, 0.009, skin);
    oval(side * 0.051, 1.938, 0.089, 0.025, 0.009, 0.009, eyeWhite);
    oval(side * 0.051, 1.938, 0.097, 0.0085, 0.008, 0.0025, iris);
    oval(side * 0.051, 1.938, 0.099, 0.0044, 0.005, 0.0015, pupil);
    oval(side * 0.048, 1.941, 0.101, 0.0018, 0.0018, 0.001, glint);
    line(
      [
        [side * 0.026, 1.936, 0.099],
        [side * 0.047, 1.947, 0.102],
        [side * 0.067, 1.944, 0.091],
        [side * 0.077, 1.937, 0.082],
      ],
      0.0035,
      skin,
    );
    line(
      [
        [side * 0.026, 1.936, 0.099],
        [side * 0.052, 1.93, 0.097],
        [side * 0.077, 1.937, 0.082],
      ],
      0.0025,
      skinShade,
    );
    line(
      [
        [side * 0.028, 1.966, 0.103],
        [side * 0.05, 1.973, 0.1],
        [side * 0.073, 1.969, 0.087],
        [side * 0.085, 1.961, 0.075],
      ],
      0.004,
      hair,
    );
    oval(side * 0.017, 1.887, 0.131, 0.009, 0.006, 0.006, skin);
    oval(side * 0.014, 1.883, 0.137, 0.0045, 0.002, 0.002, skinShade);
  }
  line(
    [
      [-0.036, 1.847, 0.102],
      [-0.014, 1.852, 0.116],
      [0, 1.849, 0.12],
      [0.014, 1.852, 0.116],
      [0.036, 1.847, 0.102],
    ],
    0.004,
    lips,
  );
  line(
    [
      [-0.035, 1.844, 0.104],
      [0, 1.841, 0.122],
      [0.035, 1.844, 0.104],
    ],
    0.005,
    lips,
  );
  line(
    [
      [-0.035, 1.847, 0.106],
      [0, 1.846, 0.123],
      [0.035, 1.847, 0.106],
    ],
    0.0015,
    mouth,
  );

  // Longer hair sits behind the face and neck so the portrait keeps its depth.
  // The hairline rises at the temples; fine ridges follow the crown's growth
  // direction instead of treating each lock as a separate round ball.
  const scalpOutline = new THREE.CatmullRomCurve3(
    headContours.map(([y, x, z]) => new THREE.Vector3(x, y, z)),
  ).getPoints(160);
  function scalpAt(height: number) {
    for (let i = 1; i < scalpOutline.length; i++) {
      if (scalpOutline[i].y >= height) {
        const lower = scalpOutline[i - 1];
        const upper = scalpOutline[i];
        return lower.clone().lerp(upper, (height - lower.y) / (upper.y - lower.y));
      }
    }
    return scalpOutline[scalpOutline.length - 1].clone();
  }
  if (appearance.hairstyle !== 'bald') {
    const style = appearance.hairstyle;
    const closeCut = style === 'shaved' || style === 'mohawk';
    const long = style === 'long' || style === 'bob';
    const scalpMaterial = material(
      closeCut ? new THREE.Color(hairColor).lerp(new THREE.Color(skinColor), 0.22) : hairColor,
      { roughness: closeCut ? 0.96 : 0.78, vertexColors: true, side: THREE.DoubleSide },
    );
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const rows = 64;
    const columns = 192;
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        const angle = (column / columns) * Math.PI * 2;
        const front = Math.max(0, Math.cos(angle));
        const side = Math.abs(Math.sin(angle));
        const t = row / rows;
        const fringe =
          style === 'swept'
            ? 0.012 * Math.sin(angle + 0.6) * front
            : long
              ? -0.018 * side * front + 0.006 * Math.exp(-((side / 0.14) ** 2)) * front
              : 0;
        const hairline =
          1.895 +
          0.108 * THREE.MathUtils.smoothstep(Math.cos(angle), -0.08, 0.8) +
          0.017 * side * (1 - front) +
          fringe;
        const scalpT = long ? Math.min(1, t / 0.65) : t;
        const height = THREE.MathUtils.lerp(2.082, hairline, scalpT);
        const outline = scalpAt(height);
        const crown = Math.sin((scalpT * Math.PI) / 2);
        const strand = Math.sin(angle * 320 + scalpT * (style === 'swept' ? 16 : 3));
        const clump = Math.sin(angle * 37 + scalpT * 9) * Math.sin(angle * 23 - scalpT * 17);
        let thickness = closeCut ? 0.001 : 0.004 + 0.003 * (1 - scalpT);
        if (style === 'swept') thickness += 0.017 * (1 - scalpT) * (0.7 + 0.3 * Math.sin(angle));
        if (style === 'curls')
          thickness += 0.012 + clump * 0.004 + Math.sin(angle * 61 + scalpT * 53) * 0.0015;
        thickness += (closeCut ? 0.00015 : 0.0005) * strand;
        const drape = long ? Math.max(0, (t - 0.65) / 0.35) : 0;
        // Fade the side panels away from the face, then let them hang outside
        // the jaw and collar. No floating tubes or fringe through the forehead.
        const sideFall = THREE.MathUtils.smoothstep(1 - Math.cos(angle), 0.28, 0.75);
        // Longer styles cover the ears, so their side layers need enough room
        // for the ear rim as well as the narrower skull underneath it.
        if (long) thickness += 0.025 * sideFall * THREE.MathUtils.smoothstep(scalpT, 0.55, 0.95);
        const length = style === 'long' ? 0.39 : 0.16;
        const flare = drape * sideFall * (style === 'long' ? 0.032 : 0.012);
        const x = Math.sin(angle) * (outline.x + thickness * crown + flare);
        let y = height + thickness * (1 - scalpT) - drape * sideFall * length;
        const z =
          Math.cos(angle) * (outline.z + thickness * crown + flare * 0.8) -
          drape * sideFall * 0.013;
        y += drape * sideFall * 0.0025 * Math.sin(angle * 31);
        positions.push(x, y, z);
        const shade = 0.88 + strand * 0.035 + clump * 0.035;
        colors.push(shade, shade, shade);
        uvs.push(column / columns, t);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column;
          indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    part(geometry, scalpMaterial, 0, 0, 0, hairstyle);
    if (!closeCut) {
      // Narrow, alpha-cut ribbons add separate strands over the fitted hair
      // mass. Their roots follow the same surface, so changing styles cannot
      // leave a gap between the scalp and the visible hair.
      const size = 128;
      const pixels = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = x / (size - 1);
          const v = y / (size - 1);
          const strands = Math.sin(u * Math.PI * 18 + Math.sin(v * 5) * 0.4);
          const taper = Math.abs(u - 0.5) < 0.5 * Math.pow(1 - v, 0.35);
          const alpha = taper && strands > -0.1 ? 255 : 0;
          const index = (y * size + x) * 4;
          pixels[index] = pixels[index + 1] = pixels[index + 2] = alpha;
          pixels[index + 3] = 255;
        }
      }
      const strandTexture = new THREE.DataTexture(pixels, size, size);
      strandTexture.magFilter = strandTexture.minFilter = THREE.LinearFilter;
      strandTexture.needsUpdate = true;
      textures.push(strandTexture);
      const strands = material(new THREE.Color(hairColor).multiplyScalar(1.18), {
        roughness: 0.8,
        alphaMap: strandTexture,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
      });
      const ribbonPositions: number[] = [];
      const ribbonUvs: number[] = [];
      const ribbonIndices: number[] = [];
      const segments = 32;
      for (let lock = 0; lock < 64; lock++) {
        for (let segment = 0; segment <= segments; segment++) {
          const t = segment / segments;
          const row = Math.min(rows - 1, (0.12 + t * 0.88) * rows);
          const lower = Math.floor(row);
          const mix = row - lower;
          for (const edge of [-1, 1]) {
            const sweep = style === 'swept' ? t * 0.6 : Math.sin(t * 3 + lock) * 0.035;
            const angle = (lock / 64) * Math.PI * 2 + sweep + edge * 0.042 * (1 - t * 0.6);
            const column = ((((angle / (Math.PI * 2)) * columns) % columns) + columns) % columns;
            const left = Math.floor(column);
            const across = column - left;
            const point = new THREE.Vector3();
            for (let axis = 0; axis < 3; axis++) {
              const first = THREE.MathUtils.lerp(
                positions[(lower * (columns + 1) + left) * 3 + axis],
                positions[(lower * (columns + 1) + left + 1) * 3 + axis],
                across,
              );
              const second = THREE.MathUtils.lerp(
                positions[((lower + 1) * (columns + 1) + left) * 3 + axis],
                positions[((lower + 1) * (columns + 1) + left + 1) * 3 + axis],
                across,
              );
              point.setComponent(axis, THREE.MathUtils.lerp(first, second, mix));
            }
            point.x += Math.sin(angle) * 0.0015;
            point.z += Math.cos(angle) * 0.0015;
            point.y += (1 - t) * 0.0015;
            ribbonPositions.push(...point.toArray());
            ribbonUvs.push(edge === -1 ? 0 : 1, t);
          }
          if (segment < segments) {
            const a = lock * (segments + 1) * 2 + segment * 2;
            ribbonIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          }
        }
      }
      const ribbons = new THREE.BufferGeometry();
      ribbons.setAttribute('position', new THREE.Float32BufferAttribute(ribbonPositions, 3));
      ribbons.setAttribute('uv', new THREE.Float32BufferAttribute(ribbonUvs, 2));
      ribbons.setIndex(ribbonIndices);
      ribbons.computeVertexNormals();
      part(ribbons, strands, 0, 0, 0, hairstyle);
    }
    if (style === 'mohawk') {
      // The crest grows from the close-cut scalp instead of resting on a cap.
      const points: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let row = 0; row <= 32; row++) {
        const z = -0.112 + (row / 32) * 0.224;
        const base = 1.952 + 0.13 * Math.sqrt(Math.max(0, 1 - (z / 0.118) ** 2));
        for (let column = 0; column <= 12; column++) {
          const across = column / 6 - 1;
          const height = (1 - across ** 2) * (0.045 + 0.017 * Math.sin((row / 32) * Math.PI));
          points.push(across * 0.025, base + height + Math.sin(row * 1.7) * 0.0015, z);
          uvs.push(column / 12, row / 32);
          if (row < 32 && column < 12) {
            const a = row * 13 + column;
            indices.push(a, a + 13, a + 1, a + 1, a + 13, a + 14);
          }
        }
      }
      const crest = new THREE.BufferGeometry();
      crest.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      crest.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      crest.setIndex(indices);
      crest.computeVertexNormals();
      part(crest, hair, 0, 0, 0, hairstyle);
    }
    if (style === 'bun') {
      const bun = oval(0, 1.995, -0.117, 0.061, 0.056, 0.052, hair, hairstyle);
      const positions = bun.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const ridge = 1 + 0.025 * Math.sin(Math.atan2(y, x) * 32 + z * 6);
        positions.setXYZ(i, x * ridge, y * ridge, z * ridge);
      }
      bun.geometry.computeVertexNormals();
    }
  }

  // Bake static details together per material and moving limb. This preserves
  // the station's shoulder/hip pivots without a draw call for every stitch.
  for (const parent of [group, hairstyle, ...limbs]) {
    const batches = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
    for (const child of parent.children.slice()) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      if (!mesh.isMesh) continue;
      mesh.updateMatrix();
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
      // Rounded boxes arrive without indices, unlike the sculpted surfaces.
      // Give them matching indices so an entire material batch cannot disappear.
      if (!geometry.index) {
        geometry.setIndex(
          Array.from({ length: geometry.getAttribute('position').count }, (_, index) => index),
        );
      }
      const batch = batches.get(mesh.material) ?? [];
      batch.push(geometry);
      batches.set(mesh.material, batch);
      parent.remove(mesh);
    }
    for (const [finish, batch] of batches) {
      const merged = mergeGeometries(batch);
      batch.forEach((geometry) => geometry.dispose());
      if (!merged) throw new Error('Character geometry could not be combined.');
      part(merged, finish, 0, 0, 0, parent);
    }
  }
  // Only the baked geometry is needed after construction.
  const activeGeometries = new Set<THREE.BufferGeometry>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) activeGeometries.add(mesh.geometry);
  });
  for (const geometry of geometries) {
    if (!activeGeometries.has(geometry)) {
      geometry.dispose();
      geometries.delete(geometry);
    }
  }
  const root = new THREE.Group();
  root.add(group);
  const torso = new THREE.Group();
  torso.position.y = 1.055;
  for (const child of group.children.slice()) {
    if (child === limbs[0] || child === limbs[2]) continue;
    child.position.y -= torso.position.y;
    torso.add(child);
  }
  group.add(torso);

  // Skin the existing continuous sleeves and trousers across each joint. The
  // cloth bends with the bones, so elbows and knees never open into visible gaps.
  const joints = limbs.map((limb, index) => {
    const leg = index % 2 === 0;
    const upper = new THREE.Bone();
    const lower = new THREE.Bone();
    const end = new THREE.Bone();
    lower.position.y = leg ? -0.48 : -0.29;
    end.position.y = leg ? -0.43 : -0.27;
    upper.add(lower);
    lower.add(end);
    const meshes = limb.children.slice() as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >[];
    limb.add(upper);
    root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton([upper, lower, end]);
    for (const mesh of meshes) {
      const positions = mesh.geometry.getAttribute('position');
      const weights: number[] = [];
      const indices: number[] = [];
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const y = positions.getY(vertex);
        let lowerWeight =
          1 - THREE.MathUtils.smoothstep(y, lower.position.y - 0.065, lower.position.y + 0.065);
        const endY = lower.position.y + end.position.y;
        const endWeight = 1 - THREE.MathUtils.smoothstep(y, endY - 0.02, endY + 0.035);
        // The knee plate follows the shin as one rigid piece; blending it with
        // the trouser fold would buckle the plate into the fabric underneath.
        if (
          leg &&
          mesh.material === panels &&
          y > -0.56 &&
          y < -0.42 &&
          positions.getZ(vertex) > 0.05
        )
          lowerWeight = 1;
        indices.push(0, 1, 2, 0);
        weights.push(1 - lowerWeight, lowerWeight * (1 - endWeight), lowerWeight * endWeight, 0);
      }
      mesh.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
      mesh.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
      const skinned = new THREE.SkinnedMesh(mesh.geometry, mesh.material);
      skinned.castShadow = skinned.receiveShadow = true;
      // Moving joints can exceed the rest-pose bounds during a run.
      skinned.frustumCulled = false;
      limb.remove(mesh);
      limb.add(skinned);
      root.updateMatrixWorld(true);
      skinned.bind(skeleton);
    }
    return { lower, end, skeleton };
  });
  let phase = 0;
  let motion = 0;
  let running = 0;
  let idleTime = 0;
  let gaitSpeed = 0;
  function animate(delta: number, speed: number) {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const targetSpeed = Math.max(0, speed);
    // Filter contact/collision noise and ease cadence into a new speed.
    gaitSpeed += (targetSpeed - gaitSpeed) * (1 - Math.exp(-dt * 8));
    const velocity = gaitSpeed;
    const blend = 1 - Math.exp(-dt * 12);
    motion += (THREE.MathUtils.smoothstep(targetSpeed, 0.02, 0.35) - motion) * blend;
    running +=
      (THREE.MathUtils.smoothstep(
        velocity,
        characterSpeeds.walk + 0.15,
        characterSpeeds.run - 0.2,
      ) -
        running) *
      blend;
    idleTime += dt;
    const duty = THREE.MathUtils.lerp(0.62, 0.4, running);
    const span = THREE.MathUtils.lerp(0.82, 1.02, running);
    // Advance with actual travel, including wall collisions. During stance a
    // boot moves backwards relative to the hips at the same speed as the player.
    phase = (phase + (velocity * dt) / (span / duty)) % 1;
    const feet = [0, 0.5].map((offset) => {
      const cycle = (phase + offset) % 1;
      const swing = cycle >= duty;
      const t = swing ? (cycle - duty) / (1 - duty) : cycle / duty;
      // Match the stance velocity at both ends of the swing and ease the
      // lift to zero speed at contact, rather than kicking into a sine arc.
      const recovery = t * t * t * (10 + t * (-15 + t * 6));
      const tangent = (1 - duty) / duty;
      const travel = swing ? -0.5 - tangent * t + (1 + tangent) * recovery : 0.5 - t;
      const z = travel * span * motion;
      const lift = swing
        ? Math.sin(t * Math.PI) ** 2 * THREE.MathUtils.lerp(0.07, 0.18, running) * motion
        : 0;
      return { z, lift, swing, t };
    });
    let bob =
      (-0.045 + Math.sin(phase * Math.PI * 4) * THREE.MathUtils.lerp(0.018, 0.035, running)) *
      motion;
    // Lower the hips as the stance leg reaches forward or back. Solving both
    // legs against the floor keeps the boots planted instead of skating in arcs.
    for (const foot of feet) {
      const limit =
        Math.sqrt(Math.max(0, THREE.MathUtils.lerp(0.908, 0.88, motion) ** 2 - foot.z ** 2)) -
        0.91 +
        foot.lift;
      // A smooth minimum blends support between the legs. Keeping a little
      // knee bend also avoids the unstable fully straight configuration.
      const softness = 0.002 + 0.043 * motion;
      bob =
        Math.min(bob, limit) - softness * Math.log1p(Math.exp(-Math.abs(bob - limit) / softness));
    }
    group.position.y = bob;
    torso.rotation.x = running * 0.075 * motion;
    torso.rotation.y = Math.sin(phase * Math.PI * 2) * 0.065 * motion;
    torso.rotation.z = Math.sin(phase * Math.PI * 2) * 0.018 * motion;
    for (let side = 0; side < 2; side++) {
      const leg = limbs[side * 2];
      const arm = limbs[side * 2 + 1];
      const knee = joints[side * 2];
      const elbow = joints[side * 2 + 1];
      const foot = feet[side];
      const down = 0.91 + bob - foot.lift;
      const reach = THREE.MathUtils.clamp(Math.hypot(down, foot.z), 0.06, 0.9099);
      const kneeAngle =
        Math.PI -
        Math.acos(
          THREE.MathUtils.clamp((0.48 ** 2 + 0.43 ** 2 - reach ** 2) / (2 * 0.48 * 0.43), -1, 1),
        );
      const hipAngle =
        Math.atan2(-foot.z, down) -
        Math.acos(
          THREE.MathUtils.clamp((0.48 ** 2 + reach ** 2 - 0.43 ** 2) / (2 * 0.48 * reach), -1, 1),
        );
      leg.rotation.x = hipAngle;
      knee.lower.rotation.x = kneeAngle;
      const toe = foot.swing
        ? -Math.sin(foot.t * Math.PI * 2) * Math.sin(foot.t * Math.PI) ** 2 * 0.2 * motion
        : 0;
      knee.end.rotation.x = -hipAngle - kneeAngle + toe;
      const swing = Math.cos((phase + side * 0.5) * Math.PI * 2);
      arm.rotation.x = swing * THREE.MathUtils.lerp(0.26, 0.6, running) * motion;
      elbow.lower.rotation.x =
        -0.12 - running * 0.95 * motion - (1 - running) * (1 - swing) * 0.09 * motion;
      arm.rotation.z = (side === 0 ? -1 : 1) * (0.055 + running * 0.025);
      arm.rotation.x += Math.sin(idleTime * 1.6 + side) * 0.012 * (1 - motion);
    }
  }

  return {
    group: root,
    animate,
    limbs,
    hairstyle,
    dispose() {
      joints.forEach(({ skeleton }) => skeleton.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((finish) => finish.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
