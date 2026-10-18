import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createCharacterModel, type CharacterAppearance } from '../character/model.ts';

export function CharacterPreview({
  appearance,
  name,
}: {
  appearance: CharacterAppearance;
  name: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const { skin, hair, hairstyle, suit } = appearance;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer | undefined;
    const model = createCharacterModel({ skin, hair, hairstyle, suit });
    const events = new AbortController();
    let observer: ResizeObserver | undefined;
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
      model.dispose();
      renderer?.dispose();
      scene.clear();
    };
    try {
      const graphics = new THREE.WebGLRenderer({ canvas: element, antialias: true, alpha: true });
      renderer = graphics;
      graphics.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      graphics.toneMapping = THREE.ACESFilmicToneMapping;
      graphics.toneMappingExposure = 1.15;
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
      camera.position.set(0, 1.25, 4.2);
      camera.lookAt(0, 1.12, 0);
      scene.add(model.group, new THREE.HemisphereLight('#bccfe2', '#455367', 2.1));
      const light = new THREE.DirectionalLight('#ffe7c4', 3.2);
      light.position.set(-3, 4, 5);
      scene.add(light);
      const rim = new THREE.DirectionalLight('#77b8d9', 1.5);
      rim.position.set(3, 2, -3);
      scene.add(rim);
      model.group.rotation.y = -0.18;
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
  }, [skin, hair, hairstyle, suit]);
  return (
    <>
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
