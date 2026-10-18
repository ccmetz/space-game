import * as THREE from 'three';

const planetVertex = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    vPosition = position;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const planetFragment = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform vec3 baseColor;
  uniform vec3 detailColor;
  uniform float kind;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  float terrain(vec3 p) { return noise(p)*0.52 + noise(p*2.03)*0.26 + noise(p*4.01)*0.14 + noise(p*8.0)*0.08; }
  void main() {
    vec3 p = normalize(vPosition);
    float land = terrain(p * 5.0);
    vec3 color = mix(baseColor, detailColor, smoothstep(0.44, 0.64, land));
    if (kind < 0.5) {
      float cloud = terrain(p * 9.0 + vec3(7.0));
      color = mix(color, vec3(0.75,0.86,0.83), smoothstep(0.58,0.74,cloud)*0.85);
    } else if (kind > 1.5) {
      float bands = sin(p.y * 65.0 + land * 9.0)*0.5+0.5;
      color = mix(baseColor, detailColor, bands*0.65+land*0.25);
    }
    float light = dot(normalize(vNormal), normalize(vec3(-0.65,0.45,0.55)));
    color *= 0.035 + smoothstep(-0.14,0.95,light)*1.18;
    gl_FragColor = vec4(color,1.0);
  }
`;

export function createPlanet(
  position: THREE.Vector3,
  radius: number,
  base: string,
  detail: string,
  kind: number,
) {
  const object = new THREE.Group();
  object.position.copy(position);
  const material = new THREE.ShaderMaterial({
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
    uniforms: {
      baseColor: { value: new THREE.Color(base) },
      detailColor: { value: new THREE.Color(detail) },
      kind: { value: kind },
    },
  });
  const surface = new THREE.Mesh(new THREE.SphereGeometry(radius, 80, 64), material);
  object.add(surface);
  // Only the rim glows, so the atmosphere doesn't wash out the planet's surface.
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.025, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: { tint: { value: new THREE.Color(kind === 0 ? '#559fae' : '#b9a58e') } },
      vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 tint; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.5); gl_FragColor=vec4(tint,rim*0.36); }`,
    }),
  );
  object.add(atmosphere);
  if (kind === 2) {
    const rings = new THREE.Mesh(
      new THREE.RingGeometry(280, 445, 160, 8),
      new THREE.MeshBasicMaterial({
        color: '#bdad94',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      }),
    );
    rings.rotation.set(1.12, 0.3, -0.25);
    object.add(rings);
    const thinRing = new THREE.Mesh(
      new THREE.RingGeometry(335, 342, 160),
      new THREE.MeshBasicMaterial({
        color: '#12151e',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    thinRing.rotation.copy(rings.rotation);
    // Lift the dark gap just above the main ring so the two surfaces don't flicker.
    thinRing.position.set(0, 0, 0.3).applyEuler(rings.rotation);
    object.add(thinRing);
  }
  return {
    object,
    update(dt: number) {
      surface.rotation.y += dt * 0.015;
    },
  };
}
