import * as THREE from 'three';

/* Procedural stylized bust (head, neck, shoulders, upper chest) from smooth deformed
   spheres. Faces +Z, yawed toward +X for a three-quarter profile. Used by the dashboard
   widget and scripts/export-bust.mjs (GLB). */

const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

function sculptHead() {
  const g = new THREE.SphereGeometry(1, 96, 72);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // base cranium: slightly narrow, taller, deeper at the back
    v.x *= 0.78; v.y *= 1.0; v.z *= v.z < 0 ? 1.0 : 0.92;
    // taper toward the chin (jaw narrower than the cranium)
    const jaw = THREE.MathUtils.smoothstep(-v.y, 0.0, 1.0);
    v.x *= 1 - 0.28 * jaw; v.z *= 1 - 0.1 * jaw;
    const front = v.z > 0 ? 1 : 0;
    // brow ridge, nose, lips, chin, cheeks (gaussian bumps on the face side)
    v.z += front * 0.09 * gauss(v.y - 0.28, 0.1) * gauss(v.x, 0.5);            // brow
    v.z += front * 0.2 * gauss(v.y - 0.02, 0.17) * gauss(v.x, 0.1);            // nose
    v.z += front * 0.05 * gauss(v.y + 0.3, 0.06) * gauss(v.x, 0.2);            // lips
    v.z += front * 0.1 * gauss(v.y + 0.72, 0.12) * gauss(v.x, 0.18);           // chin
    v.z -= front * 0.025 * gauss(v.y - 0.12, 0.1) * gauss(Math.abs(v.x) - 0.32, 0.1); // eye sockets
    v.x += Math.sign(v.x) * front * 0.04 * gauss(v.y + 0.1, 0.25) * gauss(Math.abs(v.x) - 0.5, 0.2); // cheekbones
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createBust({ material } = {}) {
  const mat = material ?? new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.55 });
  const bust = new THREE.Group();
  bust.name = 'human_bust';

  const head = new THREE.Mesh(sculptHead(), mat);
  head.name = 'head';
  head.scale.setScalar(1.12);
  head.position.set(0, 1.5, 0.08);
  bust.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.8, 48, 8), mat);
  neck.name = 'neck';
  neck.position.set(0, 0.5, -0.02);
  bust.add(neck);

  // shoulders + chest: a wide flattened sphere cut off by the framing, plus trapezius slopes
  const chestGeo = new THREE.SphereGeometry(1, 96, 64);
  const cp = chestGeo.attributes.position;
  const t = new THREE.Vector3();
  for (let i = 0; i < cp.count; i++) {
    t.fromBufferAttribute(cp, i);
    t.x = Math.sign(t.x) * Math.pow(Math.abs(t.x), 0.62) * 1.75; t.y = Math.sign(t.y) * Math.pow(Math.abs(t.y), 0.8) * 0.8; t.z *= 0.68;
    t.y -= 0.12 * Math.pow(Math.abs(t.x) / 2.0, 2) * 1.2;           // shoulders droop outward
    t.y += 0.1 * gauss(t.x, 0.35) * (t.y > 0 ? 1 : 0);               // trapezius rises to the neck
    cp.setXYZ(i, t.x, t.y, t.z);
  }
  chestGeo.computeVertexNormals();
  const chest = new THREE.Mesh(chestGeo, mat);
  chest.name = 'chest';
  chest.position.set(0, -0.45, 0);
  bust.add(chest);

  bust.rotation.y = 0.62; // three-quarter, facing slightly right
  return bust;
}

/* Frosted-glass / subsurface-ish skin: charcoal-brown transmissive physical material. */
export function createGlassSkin() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x3b2c27, roughness: 0.42, metalness: 0,
    transmission: 0.55, thickness: 1.2, ior: 1.35,
    attenuationColor: new THREE.Color(0x6b3a22), attenuationDistance: 1.6,
    clearcoat: 0.4, clearcoatRoughness: 0.35,
    sheen: 0.6, sheenColor: new THREE.Color(0xb07a5a), sheenRoughness: 0.5,
    specularIntensity: 0.8,
  });
}

