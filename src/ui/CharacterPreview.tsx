import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  characterSpeeds,
  createCharacterModel,
  type CharacterAppearance,
} from '../character/model.ts';

export function CharacterPreview({
  appearance,
  name,
}: {
  appearance: CharacterAppearance;
  name: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [motion, setMotion] = useState<'pose' | 'walk' | 'run'>('pose');
  const rotation = useRef(-0.18);
  const { skin, hair, hairstyle, suit } = appearance;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer | undefined;
    const model = createCharacterModel({ skin, hair, hairstyle, suit });
    const events = new AbortController();
    let observer: ResizeObserver | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let floor: THREE.Mesh<THREE.CircleGeometry, THREE.ShadowMaterial> | undefined;
    let shadow: THREE.DirectionalLightShadow | undefined;
    const scene = new THREE.Scene();
    let disposed = false;
    const reportError = (failed: boolean) =>
      queueMicrotask(() => {
        if (!disposed) setError(failed);
      });
    const cleanup = () => {
      disposed = true;
      events.abort();
      observer?.disconnect();
      renderer?.setAnimationLoop(null);
      model.dispose();
      environment?.dispose();
      floor?.geometry.dispose();
      floor?.material.dispose();
      shadow?.dispose();
      renderer?.dispose();
      scene.clear();
    };
    try {
      const graphics = new THREE.WebGLRenderer({ canvas: element, antialias: true, alpha: true });
      renderer = graphics;
      graphics.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      graphics.toneMapping = THREE.ACESFilmicToneMapping;
      graphics.toneMappingExposure = 1;
      graphics.shadowMap.enabled = true;
      graphics.shadowMap.type = THREE.PCFSoftShadowMap;
      const studio = new RoomEnvironment();
      const generator = new THREE.PMREMGenerator(graphics);
      environment = generator.fromScene(studio, 0.04);
      studio.dispose();
      generator.dispose();
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.45;
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
      camera.position.set(0, portrait ? 1.92 : 1.2, portrait ? 1.05 : 3.8);
      camera.lookAt(0, portrait ? 1.86 : 1.08, 0);
      scene.add(model.group, new THREE.HemisphereLight('#c5d9ef', '#35404b', 0.7));
      const light = new THREE.DirectionalLight('#ffe9d5', 2.6);
      light.position.set(-3, 4, 5);
      light.castShadow = true;
      shadow = light.shadow;
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.camera.left = light.shadow.camera.bottom = -1.4;
      light.shadow.camera.right = light.shadow.camera.top = 1.4;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 12;
      light.shadow.normalBias = 0.008;
      light.shadow.bias = -0.0001;
      light.target.position.set(0, 1.1, 0);
      scene.add(light.target);
      scene.add(light);
      const rim = new THREE.DirectionalLight('#77b8d9', 1.5);
      rim.position.set(3, 2, -3);
      scene.add(rim);
      floor = new THREE.Mesh(
        new THREE.CircleGeometry(1.4, 64),
        new THREE.ShadowMaterial({ opacity: 0.22 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      model.group.rotation.y = rotation.current;
      const draw = () => graphics.render(scene, camera);
      const resize = () => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return;
        graphics.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        draw();
      };
      observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      if (motion !== 'pose') {
        let previous = 0;
        graphics.setAnimationLoop((time) => {
          const delta = previous ? (time - previous) / 1000 : 0;
          previous = time;
          model.animate(delta, characterSpeeds[motion]);
          draw();
        });
      }
      let drag: { id: number; x: number } | undefined;
      element.addEventListener(
        'pointerdown',
        (event) => {
          drag = { id: event.pointerId, x: event.clientX };
          element.setPointerCapture(event.pointerId);
        },
        { signal: events.signal },
      );
      element.addEventListener(
        'pointermove',
        (event) => {
          if (!drag || drag.id !== event.pointerId) return;
          model.group.rotation.y += (event.clientX - drag.x) * 0.012;
          rotation.current = model.group.rotation.y;
          drag.x = event.clientX;
          draw();
        },
        { signal: events.signal },
      );
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        element.addEventListener(
          event,
          () => {
            drag = undefined;
          },
          { signal: events.signal },
        );
      element.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          model.group.rotation.y += event.key === 'ArrowLeft' ? -0.2 : 0.2;
          rotation.current = model.group.rotation.y;
          draw();
        },
        { signal: events.signal },
      );
      element.addEventListener(
        'webglcontextlost',
        (event) => {
          event.preventDefault();
          setError(true);
        },
        { signal: events.signal },
      );
      reportError(false);
    } catch {
      reportError(true);
    }
    return cleanup;
  }, [skin, hair, hairstyle, suit, portrait, motion]);
  return (
    <>
      <div className="character-preview-views" role="group" aria-label="Preview framing">
        <button type="button" aria-pressed={!portrait} onClick={() => setPortrait(false)}>
          Full body
        </button>
        <button type="button" aria-pressed={portrait} onClick={() => setPortrait(true)}>
          Portrait
        </button>
      </div>
      <div className="character-preview-views" role="group" aria-label="Motion preview">
        {(['pose', 'walk', 'run'] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            aria-pressed={motion === mode}
            onClick={() => {
              setMotion(mode);
              if (mode !== 'pose') setPortrait(false);
            }}
          >
            {mode === 'pose' ? 'Still' : mode === 'walk' ? 'Walk' : 'Run'}
          </button>
        ))}
      </div>
      <canvas
        ref={canvas}
        className="character-model-preview"
        tabIndex={0}
        role="img"
        aria-label={`${name || 'Your character'}, ${hairstyle} hair. Drag or use left and right arrow keys to rotate the in-game model.`}
      />
      {error ? (
        <p role="alert">
          Unable to display the 3D preview. Reload with WebGL enabled to preview your character.
        </p>
      ) : (
        <p className="field-hint">Your in-game character · Drag or use ← / → to rotate</p>
      )}
    </>
  );
}
