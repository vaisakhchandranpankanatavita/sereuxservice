import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* A stylized "data orbit" mesh — a glowing wireframe core ringed by tilted torus orbits —
   standing in for the reference dashboard's wavy-sphere illustration. Returns a THREE.Group
   centered at the origin plus an update(delta) that drives its idle animation, so the mesh
   and its motion stay decoupled from how/where the scene around it is set up. */
export function createOrbitMesh({ hue = 0x9be23a } = {}) {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshStandardMaterial({ color: hue, roughness: 0.25, metalness: 0.15, wireframe: true, emissive: hue, emissiveIntensity: 0.35 }),
  );
  group.add(core);

  const glow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.97, 3),
    new THREE.MeshStandardMaterial({ color: hue, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.18, emissive: hue, emissiveIntensity: 0.6 }),
  );
  group.add(glow);

  const rings = [
    { radius: 1.7, tube: 0.012, rot: [Math.PI / 2.3, 0, 0], speed: 0.18 },
    { radius: 2.05, tube: 0.01, rot: [Math.PI / 1.8, Math.PI / 5, 0], speed: -0.13 },
    { radius: 2.35, tube: 0.008, rot: [Math.PI / 2.6, -Math.PI / 4, Math.PI / 6], speed: 0.09 },
  ].map(({ radius, tube, rot, speed }) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 16, 120),
      new THREE.MeshStandardMaterial({ color: hue, roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.65, emissive: hue, emissiveIntensity: 0.25 }),
    );
    ring.rotation.set(...rot);
    ring.userData.speed = speed;
    group.add(ring);
    return ring;
  });

  let t = 0;
  group.userData.update = (delta) => {
    t += delta;
    core.rotation.y += delta * 0.12;
    glow.rotation.y -= delta * 0.08;
    group.position.y = Math.sin(t * 0.6) * 0.06; // gentle float
    for (const ring of rings) ring.rotation.z += delta * ring.userData.speed;
  };

  return group;
}

/* Minimal self-contained preview: camera, lights, a RoomEnvironment for PBR reflections,
   OrbitControls so it can be inspected immediately, and a resize-aware render loop. Renders
   transparent so it drops straight onto a card's own background. */
export default function OrbitOrb({ hue = '#9be23a', style }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.3, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(2, 3, 2);
    scene.add(sun);

    const mesh = createOrbitMesh({ hue: new THREE.Color(hue).getHex() });
    scene.add(mesh);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;

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

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) controls.autoRotate = false;

    const clock = new THREE.Clock();
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const delta = clock.getDelta();
      if (!reducedMotion) mesh.userData.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [hue]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%', ...style }} />;
}
