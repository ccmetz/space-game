import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createRenderer(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060a12');
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 30000);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  scene.add(new THREE.HemisphereLight('#bccfe2', '#455367', 2.1));
  const sunlight = new THREE.DirectionalLight('#ffe7c4', 3.2);
  sunlight.position.set(-500, 400, 300);
  scene.add(sunlight);
  const rimLight = new THREE.DirectionalLight('#77b8d9', 1.5);
  rimLight.position.set(100, -20, -100);
  scene.add(rimLight);
  const previewLight = new THREE.DirectionalLight('#e0efff', 3);
  previewLight.position.set(12, 15, 20);
  previewLight.visible = false;
  scene.add(previewLight);

  return {
    scene,
    camera,
    setPreview(active: boolean) {
      previewLight.visible = active;
    },
    resize() {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.setSize(innerWidth, innerHeight);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(innerWidth, innerHeight);
    },
    setAnimationLoop(callback: (time: number) => void) {
      renderer.setAnimationLoop(callback);
    },
    render() {
      composer.render();
    },
  };
}
