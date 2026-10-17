// Particles, bullet tracers, impact decals
import * as THREE from 'three';
import { scene, dotTex, ctex } from './renderer.js';
import { rnd } from '../util.js';
import { W } from '../world/layout.js';

const PMAX = 1200, pPos = new Float32Array(PMAX * 3).fill(-999), pCol = new Float32Array(PMAX * 3), pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX); let pIdx = 0;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .09, map: dotTex, vertexColors: true, transparent: true, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
export function burst(x, y, z, col, n, spd, life) {
  const c = new THREE.Color(col);
  for (let i = 0; i < n; i++) { const k = pIdx++ % PMAX; pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z; const a = Math.random() * 6.283, b = Math.random() * 3.14 - 1.57, v = spd * rnd(.3, 1);
    pVel[k * 3] = Math.cos(a) * Math.cos(b) * v; pVel[k * 3 + 1] = Math.sin(b) * v + spd * .3; pVel[k * 3 + 2] = Math.sin(a) * Math.cos(b) * v; pCol[k * 3] = c.r; pCol[k * 3 + 1] = c.g; pCol[k * 3 + 2] = c.b; pLife[k] = life * rnd(.6, 1) }
  pGeo.attributes.color.needsUpdate = true
}
export function updParticles(dt) { for (let k = 0; k < PMAX; k++) { if (pLife[k] <= 0) continue; pLife[k] -= dt; if (pLife[k] <= 0) { pPos[k * 3 + 1] = -999; continue } pVel[k * 3 + 1] -= 9 * dt; pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt; if (pPos[k * 3 + 1] < .03) { pPos[k * 3 + 1] = .03; pVel[k * 3 + 1] *= -.3 } } pGeo.attributes.position.needsUpdate = true }

const tracers = []; for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); m.visible = false; m.userData.life = 0; scene.add(m); tracers.push(m) }
let trI = 0;
export function tracer(a, b, th, col = '#f2e2b8', op = .35) { const m = tracers[trI++ % tracers.length]; const L = a.distanceTo(b); if (L < .3) return; m.position.copy(a).add(b).multiplyScalar(.5); m.lookAt(b); m.scale.set(th, th, L); m.material.color.set(col); m.material.opacity = op; m.userData.op = op; m.visible = true; m.userData.life = m.userData.max = th > .02 ? .18 : .06 }
export function updTracers(dt) { for (const m of tracers) { if (!m.visible) continue; m.userData.life -= dt; if (m.userData.life <= 0) { m.visible = false; continue } m.material.opacity = m.userData.op * m.userData.life / m.userData.max } }

const decals = [], _v = new THREE.Vector3();
const decMat = new THREE.MeshBasicMaterial({ map: ctex(32, 32, g => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(10,10,10,.95)'); gr.addColorStop(.5, 'rgba(20,20,20,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32) }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
export function addDecal(x, y, z, nx, ny, nz) { let m; if (decals.length < 60) { m = new THREE.Mesh(new THREE.PlaneGeometry(.14, .14), decMat); scene.add(m); decals.push(m) } else { m = decals.shift(); decals.push(m) } m.position.set(x + nx * .01, y + ny * .01, z + nz * .01); _v.set(x + nx, y + ny, z + nz); m.lookAt(_v) }
export function clearDecals() { for (const d of decals) scene.remove(d); decals.length = 0 }
export function hitNormal(x, y, z) {
  if (y < .06) return [0, 1, 0]; let best = null, bd = 1e9;
  for (const b of W.COL) { if (x < b.x0 - .05 || x > b.x1 + .05 || z < b.z0 - .05 || z > b.z1 + .05 || y > b.y1 + .05 || y < b.y0 - .05) continue;
    for (const d of [[Math.abs(x - b.x0), -1, 0, 0], [Math.abs(x - b.x1), 1, 0, 0], [Math.abs(z - b.z0), 0, 0, -1], [Math.abs(z - b.z1), 0, 0, 1], [Math.abs(y - b.y1), 0, 1, 0], [Math.abs(y - b.y0), 0, -1, 0]]) if (d[0] < bd) { bd = d[0]; best = [d[1], d[2], d[3]] } }
  return best || [0, 1, 0]
}
