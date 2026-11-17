import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createBust, createGlassSkin } from './bustModel.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* Dashboard widget: transparent canvas (sits on the card's own white/gray fade), key light
   front-left, cool rim light behind, warm glow inside the chest, chest-up camera framing,
   slow idle sway, and pointer parallax. */
export default function HumanBust({ style }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.8, 8.6);
    camera.lookAt(0, 0.7, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    const key = new THREE.DirectionalLight(0xfff4ea, 2.4); key.position.set(-3, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfeaff, 2.2); rim.position.set(3.5, 2, -3); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const bust = createBust({ material: createGlassSkin() });
    scene.add(bust);

    // warm inner chest glow: a point light plus a soft additive sprite
    const glowLight = new THREE.PointLight(0xffa24a, 3.2, 3.5, 2); glowLight.position.set(0.1, 0.1, 0.35); bust.add(glowLight);
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const cx = c.getContext('2d');
    const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,170,80,0.95)'); gr.addColorStop(0.4, 'rgba(255,120,50,0.35)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    sprite.scale.set(1.6, 1.6, 1); sprite.position.set(0.1, 0.0, 0.5); bust.add(sprite);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let px = 0, py = 0;
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    addEventListener('pointermove', onMove);

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      if (!reduced) {
        bust.rotation.y = 0.62 + Math.sin(t * 0.4) * 0.12 + THREE.MathUtils.clamp(px, -1, 1) * 0.18;
        bust.rotation.x = THREE.MathUtils.clamp(py, -1, 1) * 0.05;
        sprite.material.opacity = 0.5 + Math.sin(t * 1.6) * 0.08; // slow heartbeat
      }
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      ro.disconnect();
      pmrem.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} style={{ width: '100%', height: '100%', ...style }} />;
}
