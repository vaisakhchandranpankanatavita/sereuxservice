import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createBust, createGlassSkin } from './src/bustModel.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((r) => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64'); this.onloadend?.(); }); }
};
const scene = new THREE.Scene();
const bust = createBust({ material: createGlassSkin() });
scene.add(bust);
new GLTFExporter().parse(scene, (glb) => {
  mkdirSync('exports', { recursive: true });
  writeFileSync('exports/human_bust.glb', Buffer.from(glb));
  console.log('wrote exports/human_bust.glb', glb.byteLength, 'bytes');
}, (e) => { console.error(e); process.exit(1); }, { binary: true });
