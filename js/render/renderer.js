// three.js renderer, scene, camera, lights + texture helpers
import * as THREE from 'three';
import { S } from '../config.js';
import { rnd, isTouch } from '../util.js';

export const Q = S.q, HIGH = Q === 'high', MED = Q !== 'low';
export const cv = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: MED && !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, HIGH ? 1.75 : MED ? 1.25 : (isTouch ? .9 : 1)));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = MED; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
export const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#000', .02);
export const camera = new THREE.PerspectiveCamera(S.fov, innerWidth / innerHeight, .03, 900); scene.add(camera);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix() });
export const pmrem = new THREE.PMREMGenerator(renderer);
export const hemi = new THREE.HemisphereLight('#fff', '#444', 1); scene.add(hemi);
export const sun = new THREE.DirectionalLight('#fff', 2); scene.add(sun); scene.add(sun.target);
if (MED) { sun.castShadow = true; sun.shadow.mapSize.set(HIGH ? 4096 : 2048, HIGH ? 4096 : 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; sun.shadow.radius = 3 }

export function ctex(w, h, draw, srgb = true, rep = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MED ? 8 : 2; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t }
export function speckle(g, w, h, n, cols, sz = 2) { for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.random() * cols.length | 0]; g.globalAlpha = rnd(.2, .7); g.fillRect(Math.random() * w, Math.random() * h, sz * rnd(.5, 1.5), sz * rnd(.5, 1.5)) } g.globalAlpha = 1 }
export function blotch(g, w, h, n, col, rmin, rmax) { for (let i = 0; i < n; i++) { const x = Math.random() * w, y = Math.random() * h, r = rnd(rmin, rmax); for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2) } } }
// box with world-scaled UVs (s metres per texture tile)
export function boxG(w, h, d, s = 2) { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++)for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s) } return g }
export const std = (c, r = .8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
export const dotTex = ctex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64) });
