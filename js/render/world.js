// Builds the 3D world for a map from the layout (js/world/layout.js)
import * as THREE from 'three';
import { MAPS, S } from '../config.js';
import { rnd, mulberry } from '../util.js';
import { W, genLayout } from '../world/layout.js';
import { renderer, scene, camera, pmrem, hemi, sun, MED, HIGH, ctex, boxG, std, dotTex } from './renderer.js';
import { groundTex, wallTex, contTex, crateTex, boxTex, sandbagTex, barrierTex, hescoTex, leafTex, foliageTex, winStripTex, rackTex, lockerTex, stripTex, signTex, signMat, SIGNS, SIGNC, MT, wallMat } from './textures.js';

let world = null, envTex = null;
function mk(geo, mat, x = 0, y = 0, z = 0, parent = world, sh = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sh && MED) { m.castShadow = true; m.receiveShadow = true } parent.add(m); return m }
function skyTex(m) { return ctex(16, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, m.sky[0]); gr.addColorStop(.38, m.sky[1]); gr.addColorStop(.5, m.sky[2]); gr.addColorStop(.53, m.fog[0]); gr.addColorStop(1, m.fog[0]); g.fillStyle = gr; g.fillRect(0, 0, w, h) }) }
export function applyExposure() { renderer.toneMappingExposure = (MAPS[W.MAPID] ? MAPS[W.MAPID].expo : 1) * S.bright }

export function buildWorld(id) {
  if (!MAPS[id]) id = 'base'; const m = MAPS[id]; genLayout(id);
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose() }) }
  world = new THREE.Group(); scene.add(world);
  const st = skyTex(m); mk(new THREE.SphereGeometry(600, 32, 16), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, fog: false, depthWrite: false }), 0, 0, 0, world, false);
  const sd = new THREE.Vector3(...m.sun[2]).normalize();
  if (!m.indoor) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(m.sun[0]).multiplyScalar(.9), fog: false, depthWrite: false, transparent: true, opacity: .75 })); s.position.copy(sd).multiplyScalar(500); s.scale.setScalar(id === 'neon' ? 30 : 55); world.add(s) }
  const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide })));
  if (m.indoor) { const b = new THREE.Mesh(new THREE.BoxGeometry(60, 2, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff').multiplyScalar(1.4) })); b.position.y = 40; es.add(b) }
  if (envTex) envTex.dispose(); envTex = pmrem.fromScene(es, .04).texture; scene.environment = envTex;
  scene.fog.color.set(m.fog[0]); scene.fog.density = m.fog[1];
  hemi.color.set(m.hemi[0]); hemi.groundColor.set(m.hemi[1]); hemi.intensity = m.hemi[2];
  sun.color.set(m.sun[0]); sun.intensity = m.sun[1]; sun.position.copy(sd).multiplyScalar(90); sun.castShadow = MED && !m.indoor;
  if (MED) { const c = sun.shadow.camera, E = W.SZ + 8; c.left = -E; c.right = E; c.top = E; c.bottom = -E; c.near = 1; c.far = 260; c.updateProjectionMatrix() }
  applyExposure();
  const { BX, BZ, SZ } = W;
  const gt = groundTex(m.ground).clone(); gt.needsUpdate = true;
  if (m.water) {
    const dw = BX * 2 + 1.2, dd = BZ * 2 + 60; gt.repeat.set(dw / 8, dd / 8); const deck = mk(new THREE.BoxGeometry(dw, 1, dd), new THREE.MeshStandardMaterial({ map: gt, roughness: .75 }), 0, -.5, 0, world, false); deck.receiveShadow = MED;
    const wm = std('#e6e6e6', .7); for (let z = -BZ - 28; z < BZ + 28; z += 4) for (const x of [-3.3, 3.3]) { const p = mk(new THREE.PlaneGeometry(.15, 2), wm, x, .012, z, world, false); p.rotation.x = -Math.PI / 2 }
    const wat = mk(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: '#3a5564', roughness: .18, metalness: .4 }), 0, -16, 0, world, false); wat.rotation.x = -Math.PI / 2
  } else {
    const G2 = m.indoor ? SZ * 2 + 4 : SZ * 2 + 260; gt.repeat.set(G2 / (m.ground === 'carpet' ? 6 : 16), G2 / (m.ground === 'carpet' ? 6 : 16));
    const gm = new THREE.MeshStandardMaterial({ map: gt, roughness: { asphalt: .6, sand: 1, snow: .9, concrete: .85, grass: 1, dirt: 1, tfloor: .75, carpet: 1, epoxy: .35 }[m.ground], metalness: m.ground === 'asphalt' ? .12 : m.ground === 'epoxy' ? .1 : 0, envMapIntensity: .5 });
    const gp = mk(new THREE.PlaneGeometry(G2, G2), gm, 0, 0, 0, world, false); gp.rotation.x = -Math.PI / 2; gp.receiveShadow = MED
  }
  if (id === 'neon') {
    mk(new THREE.BoxGeometry(7.4, .4, .9), MT.dark, 0, 6.2, 0); mk(new THREE.BoxGeometry(6.9, .35, .7), MT.red, 0, 5.8, 0); mk(new THREE.BoxGeometry(6, .3, .4), MT.red, 0, 4.9, 0);
    [[0, 4, 1.5, '#ffb070'], [-14, 3.5, -1, '#c8b0d8'], [14, 3.5, 1, '#a8c8e0'], [0, 3.5, -20, '#d8c0a0'], [0, 3.5, 20, '#c0d0e8']].forEach(([x, y, z, c]) => { const l = new THREE.PointLight(c, 12, 16, 2); l.position.set(x, y, z); world.add(l) })
  }
  for (const b of W.L) buildObj(b, id, m);
  decor(id, m); setFx(m.fx);
}

const contColor = v => ['#9a3a2e', '#2f5f96', '#3a7048', '#b07a2a', '#5e4580', '#2a706a', '#a85a2a', '#4a5560'][v % 8];
const faceIn = (x, z) => Math.abs(x) > Math.abs(z) ? (x < 0 ? Math.PI / 2 : -Math.PI / 2) : (z < 0 ? 0 : Math.PI);
function wheels(g, pts, r = .36) { for (const [px, pz] of pts) { const wh = mk(new THREE.CylinderGeometry(r, r, .28, 16), MT.rubber, px, r, pz, g); wh.rotation.x = Math.PI / 2 } }
const bushMats = {};
function bushMat(col) { return bushMats[col] || (bushMats[col] = new THREE.MeshStandardMaterial({ color: col, map: foliageTex(), roughness: 1, flatShading: true })) }

function buildObj(b, id, m) {
  const { k, x, z, w, d, h, v } = b, y0 = b.y0 || 0, hh = h - y0, cy = y0 + hh / 2;
  if (k === 'iw' || k === 'ext' || k === 'metal' || k === 'conc' || k === 'tblock' || k === 'tpillar' || k === 'col') { mk(boxG(w, hh, d, 2), wallMat(k === 'tpillar' || k === 'col' ? 'conc' : k, id), x, cy, z); return }
  if (k === 'ceil') { mk(boxG(w, hh, d, 4), new THREE.MeshStandardMaterial({ map: wallTex(id === 'office' ? 'office' : 'conc'), roughness: .95, color: id === 'office' ? '#e6e6e2' : '#777' }), x, cy, z, world, false); return }
  if (k === 'glass') { mk(new THREE.BoxGeometry(w, hh, d), MT.wglass, x, cy, z, world, false); const t = .05, al = MT.alu; if (w > d) { mk(new THREE.BoxGeometry(w, t, .12), al, x, y0 + .02, z, world, false); mk(new THREE.BoxGeometry(w, t, .12), al, x, h - .02, z, world, false) } else { mk(new THREE.BoxGeometry(.12, t, d), al, x, y0 + .02, z, world, false); mk(new THREE.BoxGeometry(.12, t, d), al, x, h - .02, z, world, false) } return }
  if (k === 'cube') { mk(boxG(w, hh, d, 1), MT.cubeFab, x, cy, z); mk(new THREE.BoxGeometry(w + .02, .04, d + .03), MT.alu, x, h, z, world, false); return }
  if (k === 'roofh') {
    mk(boxG(w, hh, d, 2), wallMat('iw', id), x, cy, z); const rise = 3.4, sh = new THREE.Shape(); sh.moveTo(-d / 2 - .3, 0); sh.lineTo(d / 2 + .3, 0); sh.lineTo(0, rise); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: w + .4, bevelEnabled: false }); geo.translate(0, 0, -(w + .4) / 2); geo.rotateY(Math.PI / 2);
    const t = wallTex('shingle').clone(); t.needsUpdate = true; t.repeat.set(.12, .25); mk(geo, new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), x, h, z); return
  }
  if (k === 'roofm' || k === 'troof') { mk(boxG(w, hh, d, 2), new THREE.MeshStandardMaterial({ map: wallTex('metal'), roughness: .6, metalness: .35, color: '#8a8f86' }), x, cy, z); return }
  if (k === 'hroof') { mk(boxG(w, hh, d, 2), wallMat('metal', id), x, cy, z); const r = d / 2, mat = new THREE.MeshStandardMaterial({ map: wallTex('metal'), roughness: .55, metalness: .35, side: THREE.DoubleSide });
    const arch = mk(new THREE.CylinderGeometry(r, r, w, 32, 1, true, 0, Math.PI), mat, x, h, z); arch.rotation.set(0, 0, Math.PI / 2);
    const cap = new THREE.CircleGeometry(r, 32, 0, Math.PI); for (const s of [-1, 1]) { const c = mk(cap, mat, x + s * w / 2, h, z); c.rotation.y = Math.PI / 2 } return }
  if (k === 'bld') {
    const tk = m.wall, t = wallTex(tk).clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 5)), Math.max(1, Math.round(h / (id === 'neon' ? 5 : 4.5))));
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: id === 'harbor' ? .6 : .9, metalness: id === 'harbor' ? .4 : 0 }); if (id === 'neon') { mat.emissiveMap = t; mat.emissive = new THREE.Color('#fff'); mat.emissiveIntensity = .25 }
    if (id === 'base') { mk(boxG(w, h, d, 2), wallMat('ext', id), x, h / 2, z); mk(new THREE.BoxGeometry(w + .4, .3, d + .4), MT.olive, x, h + .15, z); for (const s of [-1, 1]) mk(new THREE.BoxGeometry(1.2, 1, .05), MT.glass, x + s * w / 4, 2, z + d / 2 + .03, world, false); return }
    mk(new THREE.BoxGeometry(w, h, d), mat, x, h / 2, z);
    if (id === 'dune') mk(new THREE.BoxGeometry(w + .3, .4, d + .3), std('#ad8c62', 1), x, h + .2, z);
    if (id === 'frost') mk(new THREE.BoxGeometry(w + .6, .35, d + .6), MT.white, x, h + .17, z);
    if (id === 'ruins') mk(new THREE.BoxGeometry(w + .4, .35, d + .4), MT.stone, x, h + .17, z);
    if (id === 'neon') { const ry = faceIn(x, z), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g); const off = (Math.abs(ry) % Math.PI < .1 ? d : w) / 2; mk(new THREE.PlaneGeometry(Math.min(w, d) * .7, 1.2), signMat(signTex(SIGNS[v % SIGNS.length], SIGNC[v % 6], false)), 0, 3.6, off + .05, g, false) }
    return
  }
  if (k === 'cont') { const n = Math.round(h / 2.6); for (let i = 0; i < n; i++)mk(new THREE.BoxGeometry(w - .02, 2.58, d - .02), new THREE.MeshStandardMaterial({ map: contTex(contColor(v + i * 3)), roughness: .6, metalness: .4 }), x, 1.3 + i * 2.6, z); return }
  if (k === 'crate') { mk(new THREE.BoxGeometry(w, hh, d), new THREE.MeshStandardMaterial({ map: crateTex(), roughness: .85 }), x, cy, z); return }
  if (k === 'wall') { let mat; if (id === 'dune' || id === 'frost' || id === 'base') mat = new THREE.MeshStandardMaterial({ map: sandbagTex(), roughness: 1 }); else if (id === 'ruins') { const t = wallTex('ruins').clone(); t.needsUpdate = true; t.repeat.set(Math.max(w, d) / 4, h / 4); mat = new THREE.MeshStandardMaterial({ map: t, roughness: .95 }) } else mat = new THREE.MeshStandardMaterial({ map: barrierTex(), roughness: .8 });
    mk(new THREE.BoxGeometry(w, h, d), mat, x, h / 2, z); if (id === 'frost') mk(new THREE.BoxGeometry(w + .1, .12, d + .1), MT.white, x, h + .06, z); return }
  if (k === 'sand') { mk(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: sandbagTex(), roughness: 1 }), x, h / 2, z); return }
  if (k === 'hesco') { mk(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: hescoTex(), roughness: .95 }), x, h / 2, z); return }
  if (k === 'hedge') { mk(boxG(w, h, d, 1.5), new THREE.MeshStandardMaterial({ map: leafTex(), roughness: 1 }), x, h / 2, z); return }
  if (k === 'barrel') { const col = ['#7a2e22', '#2f4e6e', '#5a6040', '#8a6a2a'][v % 4]; mk(new THREE.CylinderGeometry(.38, .38, h, 18), std(col, .55, .4), x, h / 2, z); for (const yy of [.25, .75]) mk(new THREE.CylinderGeometry(.395, .395, .05, 18), MT.dark, x, h * yy, z, world, false); return }
  if (k === 'rock') { const col = { dune: '#a3825a', frost: '#7a838e', ruins: '#7a766a' }[id] || '#666'; const r = mk(new THREE.DodecahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: col, roughness: .95, flatShading: true }), x, h * .42, z); r.scale.set(w * .62, h * .6, d * .62); r.rotation.y = v;
    if (id === 'frost') { const s = mk(new THREE.DodecahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#e2e7ed', roughness: .85, flatShading: true }), x, h * .62, z); s.scale.set(w * .5, h * .3, d * .5); s.rotation.y = v } return }
  if (k === 'tree') { buildTree(id, x, z, v, world); return }
  // ---- hiding spots
  if (k === 'bush') { const mat = bushMat(m.bush || '#4a6030'); const R = mulberry(v + 7); const n = 7;
    for (let i = 0; i < n; i++) { const bx = x + (R() - .5) * w * .7, bz = z + (R() - .5) * d * .7, s = .55 + R() * .35; const b2 = mk(new THREE.IcosahedronGeometry(s, 1), mat, bx, h * .45 + R() * .35, bz); b2.scale.set(1, .85 + R() * .3, 1); b2.rotation.set(R() * 3, R() * 3, R() * 3) }
    if (id === 'frost') mk(new THREE.IcosahedronGeometry(.7, 1), MT.white, x, h - .1, z).scale.set(1.2, .4, 1.2); return }
  if (k === 'plant') { const g = new THREE.Group(); g.position.set(x, y0, z); world.add(g); mk(new THREE.CylinderGeometry(.34, .26, .55, 16), std('#3a3c40', .6, .2), 0, .275, 0, g); const lm = new THREE.MeshStandardMaterial({ color: '#3f6e34', roughness: .8, side: THREE.DoubleSide });
    const R = mulberry(v); for (let i = 0; i < 14; i++) { const lf = mk(new THREE.PlaneGeometry(.22, 1.1), lm, 0, .55, 0, g); lf.rotation.set(.35 + R() * .7, R() * 6.3, 0, 'YXZ'); lf.translateY(.5) }
    mk(new THREE.IcosahedronGeometry(.45, 1), bushMat('#3f6e34'), 0, 1.25, 0, g); return }
  if (k === 'strip') { const g = new THREE.Group(); g.position.set(x, y0, z); world.add(g); const along = w > d, L2 = along ? w : d, wd = along ? d : w;
    const sm = new THREE.MeshStandardMaterial({ map: stripTex(), transparent: true, opacity: .9, roughness: .3, side: THREE.DoubleSide, depthWrite: false });
    for (const off of [-wd / 2 + .05, 0, wd / 2 - .05]) { const bar = mk(new THREE.BoxGeometry(along ? L2 : .05, .06, along ? .05 : L2), MT.steelGrey, along ? 0 : off, h - .03, along ? off : 0, g, false);
      for (let s = -L2 / 2 + .1; s < L2 / 2; s += .2) { const p = mk(new THREE.PlaneGeometry(.19, h - .06), sm, along ? s : off, (h - .06) / 2, along ? off : s, g, false); if (!along) p.rotation.y = Math.PI / 2 } } return }
  // ---- grouped props (rotated to their long axis)
  const g = new THREE.Group(); g.position.set(x, y0, z); world.add(g); const along = d > w; if (along) g.rotation.y = Math.PI / 2; const Wl = along ? d : w, Dl = along ? w : d;
  if (k === 'car') { const col = ['#d8d8dc', '#1e2a3a', '#8a1e24', '#c8a040', '#3a5a98', '#2a2a2a'][v % 6]; const body = new THREE.MeshPhysicalMaterial({ color: col, roughness: .35, metalness: .6, clearcoat: .8, clearcoatRoughness: .15 });
    mk(new THREE.BoxGeometry(3.8, .75, 1.8), body, 0, .6, 0, g); mk(new THREE.BoxGeometry(2.2, .62, 1.66), body, -.3, 1.27, 0, g); mk(new THREE.BoxGeometry(2.24, .46, 1.68), MT.glass, -.3, 1.28, 0, g, false);
    wheels(g, [[1.2, .9], [-1.2, .9], [1.2, -.9], [-1.2, -.9]]); if (id === 'bridge' && v % 3 === 0) g.rotation.y += rnd(-.4, .4) }
  else if (k === 'truck') { const ol = std(id === 'bridge' || id === 'warehouse' ? '#8a8f96' : '#56603e', .7, .15), cvm = std(id === 'bridge' ? '#2e4a6a' : id === 'warehouse' ? '#d8d8d8' : '#6b6a48', .95);
    mk(new THREE.BoxGeometry(1.8, 1.6, 2.3), ol, Wl / 2 - .9, 1.35, 0, g); mk(new THREE.BoxGeometry(.05, .6, 2), MT.glass, Wl / 2 + .01, 1.7, 0, g, false); mk(new THREE.BoxGeometry(Wl - 1.9, .3, Dl), ol, -.95, .85, 0, g);
    mk(new THREE.BoxGeometry(Wl - 2, 1.6, Dl), cvm, -.95, 1.8, 0, g); wheels(g, [[Wl / 2 - 1, Dl / 2], [Wl / 2 - 1, -Dl / 2], [-Wl / 2 + 1, Dl / 2], [-Wl / 2 + 1, -Dl / 2]], .45) }
  else if (k === 'bus') { const t = winStripTex(v % 2 ? '#e8c23a' : '#e6e8ea', v % 2 ? '#2a2a2a' : '#c23a2a'), bm = new THREE.MeshStandardMaterial({ map: t, roughness: .5, metalness: .2 }), pl = std(v % 2 ? '#e8c23a' : '#e6e8ea', .5, .2);
    mk(new THREE.BoxGeometry(Wl, 2.7, Dl), [pl, pl, pl, pl, bm, bm], 0, 1.75, 0, g); wheels(g, [[Wl / 2 - 1.5, Dl / 2], [Wl / 2 - 1.5, -Dl / 2], [-Wl / 2 + 1.8, Dl / 2], [-Wl / 2 + 1.8, -Dl / 2]], .5) }
  else if (k === 'train') { const t = winStripTex('#b8bcc2', '#d8692a'), tm = new THREE.MeshStandardMaterial({ map: t, roughness: .4, metalness: .5 }), pl = std('#a8acb2', .4, .5);
    mk(new THREE.BoxGeometry(Wl, 3, Dl), [pl, pl, pl, pl, tm, tm], 0, 1.8, 0, g); mk(new THREE.BoxGeometry(Wl, .3, Dl - .4), MT.dark, 0, .25, 0, g, false) }
  else if (k === 'table') { mk(new THREE.BoxGeometry(Wl, .06, Dl), id === 'office' ? MT.laminate : MT.wood, 0, hh - .03, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(new THREE.BoxGeometry(.06, hh - .06, .06), id === 'office' ? MT.alu : MT.wood, sx * (Wl / 2 - .08), (hh - .06) / 2, sz * (Dl / 2 - .08), g) }
  else if (k === 'desk') { const f = (b.face || 1) * (along ? -1 : 1); mk(new THREE.BoxGeometry(Wl, .04, Dl), MT.laminate, 0, .74, 0, g); for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(.04, .72, Dl - .05), MT.alu, sx * (Wl / 2 - .03), .36, 0, g);
    for (const sx of [-.6, .6]) { mk(new THREE.BoxGeometry(.56, .34, .03), MT.dark, sx, 1.03, f * Dl * .3, g); mk(new THREE.PlaneGeometry(.52, .3), MT.screen, sx, 1.03, f * Dl * .3 - f * .017, g, false).rotation.y = f > 0 ? Math.PI : 0; mk(new THREE.BoxGeometry(.05, .2, .05), MT.dark, sx, .84, f * Dl * .3, g) }
    mk(new THREE.BoxGeometry(.45, .02, .15), MT.dark, 0, .77, -f * .05, g) }
  else if (k === 'sofa') { const fm = v % 2 ? MT.fabric : MT.fabric2; mk(new THREE.BoxGeometry(Wl, .45, Dl), fm, 0, .25, 0, g); mk(new THREE.BoxGeometry(Wl, .5, .22), fm, 0, .6, -Dl / 2 + .11, g); for (const s of [-1, 1]) mk(new THREE.BoxGeometry(.2, .3, Dl), fm, s * (Wl / 2 - .1), .55, 0, g) }
  else if (k === 'shelf') { mk(new THREE.BoxGeometry(Wl, hh, Dl), MT.wood, 0, hh / 2, 0, g); for (let i = 1; i < 4; i++) mk(new THREE.BoxGeometry(Wl * .9, hh / 5, .04), std(['#7a3a2a', '#2a4a6a', '#c8b080', '#3a5a3a'][(v + i) % 4], .8), 0, i * hh / 4.2, Dl / 2 + .02, g, false) }
  else if (k === 'tvstand') { mk(new THREE.BoxGeometry(Wl, .5, Dl), MT.wood, 0, .25, 0, g); mk(new THREE.BoxGeometry(Wl * .8, .6, .06), MT.dark, 0, .82, 0, g) }
  else if (k === 'counter') { mk(new THREE.BoxGeometry(Wl, hh - .05, Dl), MT.cab, 0, (hh - .05) / 2, 0, g); mk(new THREE.BoxGeometry(Wl + .05, .05, Dl + .05), MT.counterTop, 0, hh - .02, 0, g) }
  else if (k === 'fridge') { mk(new THREE.BoxGeometry(Wl, hh, Dl), std('#e8eaec', .3, .3), 0, hh / 2, 0, g) }
  else if (k === 'bed') { mk(new THREE.BoxGeometry(Wl, .35, Dl), MT.wood, 0, .18, 0, g); mk(new THREE.BoxGeometry(Wl - .1, .2, Dl - .1), MT.sheet, 0, .45, 0, g); mk(new THREE.BoxGeometry(Wl - .08, .08, Dl * .6), std(['#3a5a8a', '#8a3a4a', '#4a6a4a'][v % 3], .95), 0, .58, Dl * .18, g) }
  else if (k === 'bunk') { for (const yy of [.4, 1.3]) { mk(new THREE.BoxGeometry(Wl, .15, Dl), MT.olive, 0, yy, 0, g); mk(new THREE.BoxGeometry(Wl - .1, .12, Dl - .1), std('#6a6a5a', .95), 0, yy + .13, 0, g) } for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(new THREE.BoxGeometry(.05, 1.6, .05), MT.metal, sx * Wl / 2, .8, sz * Dl / 2, g) }
  else if (k === 'locker') { const t = lockerTex().clone(); t.needsUpdate = true; t.repeat.set(Wl / 1.6, 1); const lm = new THREE.MeshStandardMaterial({ map: t, roughness: .6, metalness: .4 }), pl = std('#5c6a5e', .6, .4); mk(new THREE.BoxGeometry(Wl, hh, Dl), [pl, pl, pl, pl, lm, lm], 0, hh / 2, 0, g) }
  else if (k === 'gen') { mk(new THREE.BoxGeometry(Wl, hh * .8, Dl), std('#4a5a3a', .6, .4), 0, hh * .4, 0, g); mk(new THREE.BoxGeometry(Wl * .3, hh * .25, Dl * .7), MT.dark, Wl * .25, hh * .9, 0, g); mk(new THREE.CylinderGeometry(.08, .08, .6, 8), MT.metal, -Wl * .3, hh, 0, g) }
  else if (k === 'srack') { const t = rackTex(), fm = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#fff', emissiveIntensity: .5, roughness: .4, metalness: .5 }), pl = std('#15161a', .4, .6);
    mk(new THREE.BoxGeometry(Wl, hh, Dl), [pl, pl, pl, pl, fm, fm], 0, hh / 2, 0, g) }
  else if (k === 'prack') { const up = MT.blueSteel, bm = MT.orange; const R = mulberry(v + 3);
    for (let s = -Wl / 2; s <= Wl / 2 + .01; s += Wl / 4) for (const sz of [-1, 1]) mk(new THREE.BoxGeometry(.1, hh, .1), up, s, hh / 2, sz * (Dl / 2 - .05), g);
    for (const ly of [.15, 1.75, 3.35]) { for (const sz of [-1, 1]) mk(new THREE.BoxGeometry(Wl, .12, .08), bm, 0, ly + .06, sz * (Dl / 2 - .05), g); mk(new THREE.BoxGeometry(Wl, .04, Dl - .1), MT.steelGrey, 0, ly + .1, 0, g);
      for (let s = -Wl / 2 + 1; s < Wl / 2 - .5; s += 1.75) { if (R() < .15) continue; const bh = .6 + R() * .7; mk(new THREE.BoxGeometry(1.2, .12, Dl - .3), MT.wood, s + .4, ly + .18, 0, g); mk(new THREE.BoxGeometry(1.15, bh, Dl - .35), new THREE.MeshStandardMaterial({ map: boxTex(), roughness: .9 }), s + .4, ly + .24 + bh / 2, 0, g) } } }
  else if (k === 'pallet') { mk(new THREE.BoxGeometry(Wl, .14, Dl), MT.wood, 0, .07, 0, g); mk(new THREE.BoxGeometry(Wl - .05, hh - .14, Dl - .05), new THREE.MeshStandardMaterial({ map: boxTex(), roughness: .9 }), 0, .14 + (hh - .14) / 2, 0, g); mk(new THREE.BoxGeometry(Wl, hh - .14, Dl), new THREE.MeshStandardMaterial({ color: '#dfe6ea', transparent: true, opacity: .25, roughness: .1 }), 0, .14 + (hh - .14) / 2, 0, g, false) }
  else if (k === 'forklift') { mk(new THREE.BoxGeometry(1.7, .9, 1.15), MT.yellow, -.2, .75, 0, g); mk(new THREE.BoxGeometry(.6, .7, 1.1), MT.dark, -.9, .9, 0, g); for (const sz of [-1, 1]) { mk(new THREE.BoxGeometry(.08, 2.1, .08), MT.dark, -.75 + 1.4, 1.05, sz * .45, g); mk(new THREE.BoxGeometry(.06, 2.1, .06), MT.dark, -.75, 1.65, sz * .5, g) }
    mk(new THREE.BoxGeometry(1.4, .06, 1.1), MT.dark, -.1, 2.25, 0, g); mk(new THREE.BoxGeometry(.06, .9, 1), MT.dark, .75, .6, 0, g); for (const sz of [-.3, .3]) mk(new THREE.BoxGeometry(1.1, .05, .12), MT.metal, 1.3, .1, sz, g); wheels(g, [[.4, .55], [.4, -.55], [-.8, .55], [-.8, -.55]], .3) }
  else if (k === 'step') { mk(new THREE.BoxGeometry(Wl, hh, Dl), MT.steelGrey, 0, hh / 2, 0, g); mk(new THREE.BoxGeometry(Wl, .04, Dl), std('#3a3c40', .5, .7), 0, hh - .02, 0, g, false) }
  else if (k === 'plat') { mk(new THREE.BoxGeometry(Wl, hh, Dl), std('#4a4c50', .6, .6), 0, hh / 2, 0, g); mk(new THREE.BoxGeometry(Wl, .02, Dl), std('#5a5c60', .45, .7), 0, hh, 0, g, false) }
  else if (k === 'post') { mk(new THREE.BoxGeometry(Wl, hh, Dl), MT.steelGrey, 0, hh / 2, 0, g) }
  else if (k === 'railp') { for (const yy of [.5, 1]) mk(new THREE.BoxGeometry(Wl, .05, .05), MT.yellow, 0, yy, 0, g, false); for (let s = -Wl / 2; s <= Wl / 2 + .01; s += Math.max(.5, Wl / 4)) mk(new THREE.BoxGeometry(.05, 1, .05), MT.yellow, s, .5, 0, g, false) }
  else if (k === 'rail') { mk(new THREE.BoxGeometry(Wl, .6, Dl), std('#9a9894', .85), 0, .3, 0, g); mk(new THREE.BoxGeometry(Wl, .08, .12), MT.metal, 0, 1.05, 0, g); for (let p = -Wl / 2; p < Wl / 2; p += 2.5) mk(new THREE.BoxGeometry(.08, .5, .08), MT.metal, p, .8, 0, g, false) }
  else if (k === 'vend') { mk(new THREE.BoxGeometry(1.2, 2, .9), std(['#d9d9e0', '#a8302a', '#2a5aa8'][v % 3], .4, .2), 0, 1, 0, g) }
  else if (k === 'torii') { mk(new THREE.CylinderGeometry(.32, .4, 6, 20), MT.red, 0, 3, 0, g) }
  else if (k === 'pillar') { mk(new THREE.CylinderGeometry(.5, .56, hh, 14), MT.stone, 0, hh / 2, 0, g); mk(new THREE.BoxGeometry(1.3, .3, 1.3), MT.stone, 0, hh + .05, 0, g) }
  else if (k === 'tower') { for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mk(new THREE.CylinderGeometry(.12, .15, 6, 8), MT.metal, px, 3, pz, g); mk(new THREE.CylinderGeometry(2, 2, 3, 20), std('#8a939b', .55, .5), 0, 7.5, 0, g) }
  else mk(new THREE.BoxGeometry(Wl, hh, Dl), MT.dark, 0, hh / 2, 0, g);
}
function buildTree(id, x, z, v, parent, sc = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(sc * (.85 + (v % 30) / 100)); g.rotation.y = v; parent.add(g);
  if (id === 'frost') { mk(new THREE.CylinderGeometry(.18, .3, 2.2, 8), MT.bark, 0, 1.1, 0, g); const gm = std('#24402f', .9); for (let i = 0; i < 4; i++) { mk(new THREE.ConeGeometry(2.2 - i * .45, 2.4, 10), gm, 0, 2.2 + i * 1.5, 0, g); mk(new THREE.ConeGeometry(2.0 - i * .45, .8, 10), MT.white, 0, 2.9 + i * 1.5, 0, g, false) } }
  else if (id === 'dune') { const tm = std('#6e533a', 1); let px = 0; for (let i = 0; i < 6; i++) { const s = mk(new THREE.CylinderGeometry(.2, .24, 1.1, 8), tm, px, .55 + i * 1.05, 0, g); px += .08; s.rotation.z = -.08 }
    const lm = new THREE.MeshStandardMaterial({ color: '#3f6a2a', roughness: .85, side: THREE.DoubleSide }); for (let i = 0; i < 8; i++) { const lf = mk(new THREE.PlaneGeometry(.8, 3.2), lm, px, 6.4, 0, g); lf.rotation.set(1.1, i / 8 * 6.28, 0, 'YXZ'); lf.translateY(1.4) } }
  else { mk(new THREE.CylinderGeometry(.25, .4, 4, 8), MT.bark, 0, 2, 0, g); const lm = new THREE.MeshStandardMaterial({ color: ['#3a5e28', '#46682c', '#506a28'][v % 3], roughness: .9, flatShading: true }); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, r = i ? 1.4 : 0; const b = mk(new THREE.IcosahedronGeometry(rnd(1.4, 2), 1), lm, Math.cos(a) * r, rnd(4.4, 6), Math.sin(a) * r, g); b.scale.y = .8 } }
}
function perimeter(h, mat, seg = 8) { const { BX, BZ } = W; for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const isX = sz !== 0, len = isX ? BX * 2 : BZ * 2; for (let s = -len / 2; s < len / 2; s += seg) { const l = Math.min(seg, len / 2 - s) - .05; const x = isX ? s + l / 2 : sx * (BX + .3), z = isX ? sz * (BZ + .3) : s + l / 2; mk(boxG(isX ? l + .6 : .6, h, isX ? .6 : l + .6, 2), mat, x, h / 2, z) } } }
function hills(par, col, R0) { const mm = new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true }); for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283 + rnd(0, .2), r = rnd(R0 + 70, R0 + 150), h = rnd(25, 70); const mt = mk(new THREE.ConeGeometry(rnd(30, 60), h, 7), mm, Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r, par, false); mt.rotation.y = Math.random() * 3 } }
function lights(pts, col, inten, dist, panel) { const lm = new THREE.MeshStandardMaterial({ color: '#fff', emissive: col, emissiveIntensity: .9 }); const n = MED ? pts.length : Math.ceil(pts.length / 2);
  pts.forEach(([x, y, z], i) => { if (i < n || i % 2 === 0) { const l = new THREE.PointLight(col, inten, dist, 1.8); l.position.set(x, y - .3, z); world.add(l) } if (panel) mk(new THREE.BoxGeometry(panel[0], .05, panel[1]), lm, x, y, z, world, false) }) }
function decor(id, m) {
  const far = new THREE.Group(); world.add(far); const { BX, BZ, SZ } = W;
  if (id === 'base') { perimeter(4, new THREE.MeshStandardMaterial({ map: wallTex('conc'), roughness: .95 }), 2.4); hills(far, '#6d7a52', BX); for (let i = 0; i < 50; i++) { const a = Math.random() * 6.283, r = rnd(SZ + 8, SZ + 40); buildTree('ruins', Math.cos(a) * r, Math.sin(a) * r, i * 37, far, 1.2) } }
  else if (id === 'house') { const fence = new THREE.MeshStandardMaterial({ map: ctex(256, 128, (g, w, h) => { g.fillStyle = '#6a4a30'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = `hsl(28,${rnd(30, 40)}%,${rnd(30, 40)}%)`; g.fillRect(x + 2, 0, 28, h); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, 0, 2, h) } }, true, true), roughness: .9 });
    perimeter(2, fence, 4);
    const fl = mk(new THREE.PlaneGeometry(28, 20), new THREE.MeshStandardMaterial({ map: ctex(512, 512, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = `hsl(30,${rnd(35, 45)}%,${rnd(36, 46)}%)`; g.fillRect(0, i * 32, w, 31); g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = (i % 2) * 128; x < w; x += 256)g.fillRect(x, i * 32, 2, 32) } }, true, true), roughness: .6 }), 0, .015, 0, world, false);
    fl.rotation.x = -Math.PI / 2; fl.material.map.repeat.set(5, 4); fl.receiveShadow = MED;
    lights([[-9, 3.15, -5], [5, 3.15, -5], [-6, 3.15, 5], [9, 3.15, 5]], '#ffe2b8', 5, 11, [.5, .5]);
    for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283, r = rnd(SZ + 14, SZ + 30); const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.y = -a; far.add(g);
      mk(new THREE.BoxGeometry(9, 4, 8), std(['#c8c0b0', '#b8c4cc', '#d0c4a8', '#a8b0a0'][i % 4], .9), 0, 2, 0, g, false); const rf = mk(new THREE.ConeGeometry(7, 2.6, 4), std('#4a3c38', .9), 0, 5.3, 0, g, false); rf.rotation.y = Math.PI / 4 }
    hills(far, '#5c7444', SZ + 30) }
  else if (id === 'office') { const H = 3.2; const wt = wallTex('owin').clone(); wt.needsUpdate = true; wt.repeat.set(1, 1);
    perimeter(H, new THREE.MeshStandardMaterial({ map: wt, emissiveMap: wt, emissive: '#ffffff', emissiveIntensity: .55, roughness: .2, metalness: .2 }), 4);
    const pts = []; for (let x = -20; x <= 20; x += 8) for (let z = -15; z <= 15; z += 7.5) pts.push([x, H - .02, z]); lights(pts.filter((_, i) => i % 2 === 0), '#f4f6ff', 7, 13, null);
    const pm = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#f4f6ff', emissiveIntensity: .9 }); for (const [x, y, z] of pts) mk(new THREE.BoxGeometry(1.2, .04, .6), pm, x, y, z, world, false) }
  else if (id === 'warehouse') { const sid = new THREE.MeshStandardMaterial({ map: wallTex('metal'), roughness: .6, metalness: .35, color: '#9aa0a6' }); perimeter(8, sid, 4);
    const rd = std('#7a7e84', .5, .6); for (const z of [-12, 0, 12]) { mk(new THREE.BoxGeometry(.2, 4.5, 5), rd, BX + .05, 2.25, z, world, false); mk(new THREE.BoxGeometry(.25, .3, 5.4), MT.yellow, BX + .02, 4.6, z, world, false) }
    const sky = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#e8f0ff', emissiveIntensity: 1 }); for (let x = -24; x <= 24; x += 12) mk(new THREE.BoxGeometry(5, .05, BZ * 1.6), sky, x, 7.98, 0, world, false);
    for (let x = -30; x <= 30; x += 6) mk(new THREE.BoxGeometry(.25, .4, BZ * 2), MT.steelGrey, x, 7.7, 0, world, false);
    const pts = []; for (let x = -24; x <= 24; x += 12) for (const z of [-12.5, 0, 12.5]) pts.push([x, 7.4, z]); lights(pts, '#fff4e0', 18, 22, [.8, .8]) }
  else if (id === 'bunker') { perimeter(3, wallMat('conc', id), 4); const pts = []; for (const x of [-16, 0, 16]) for (const z of [-16, 0, 16]) pts.push([x, 2.95, z]); lights(pts, '#ffe7c4', 8, 13, [1.2, .25]);
    const pipe = std('#5a4a3a', .5, .6); for (const z of [-7.6, 7.6]) mk(new THREE.CylinderGeometry(.1, .1, BX * 2, 8), pipe, 0, 2.7, z, world, false).rotation.z = Math.PI / 2 }
  else if (id === 'tunnel') { perimeter(4.6, wallMat('tblock', id), 4);
    const rail = std('#5a5a5e', .35, .8), sl = std('#4a3a2a', .95); for (const z of [-.72, .72]) mk(new THREE.BoxGeometry(BX * 2, .12, .08), rail, 0, .06, z, world, false); for (let x = -BX; x < BX; x += .8) mk(new THREE.BoxGeometry(.25, .06, 2.2), sl, x, .03, 0, world, false);
    lights([[-21, 4.55, 0], [-7, 4.55, 0], [7, 4.55, 0], [21, 4.55, 0], [-15.75, 4.55, -15.5], [15.75, 4.55, 15.5], [-15.75, 4.55, 15.5], [15.75, 4.55, -15.5], [0, 4.55, -26], [0, 4.55, 26], [-26, 4.55, 0], [26, 4.55, 0]], '#ffe7c4', 13, 18, [1.6, .3]) }
  else if (id === 'bridge') { const tm = std('#8a3a2a', .6, .4);
    for (const zc of [-24, 24]) { for (const sx of [-1, 1]) { mk(new THREE.BoxGeometry(1.6, 58, 1.6), tm, sx * 11.6, 13, zc, far); mk(new THREE.BoxGeometry(2.6, 30, 4), std('#7a7874', .9), sx * 7, -16, zc, far, false) } for (const yy of [16, 30, 40]) mk(new THREE.BoxGeometry(24, 1.2, 1.2), tm, 0, yy, zc, far) }
    const cm = std('#6a3028', .5, .6); const cable = (x, z0, z1, y0, y1, sag) => { const n = 24; let px = null; for (let i = 0; i <= n; i++) { const t = i / n, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * sag; const p = new THREE.Vector3(x, y, z);
      if (px) { const len = p.distanceTo(px), c = mk(new THREE.CylinderGeometry(.09, .09, len, 6), cm, (p.x + px.x) / 2, (p.y + px.y) / 2, (p.z + px.z) / 2, far, false); c.lookAt(px); c.rotateX(Math.PI / 2) } px = p; if (i % 2 === 0 && y > 1.2) mk(new THREE.CylinderGeometry(.03, .03, y - 1.1, 4), cm, x, (y + 1.1) / 2, z, far, false) } };
    for (const sx of [-1, 1]) { const x = sx * 11.4; cable(x, -24, 24, 41, 41, 32); cable(x, -80, -24, 6, 41, 6); cable(x, 24, 80, 41, 6, 6) }
    hills(far, '#5e6b5a', BZ + 70); for (let i = 0; i < 60; i++) { const a = Math.random() * 6.283, r = rnd(170, 300), h = rnd(20, 70), w = rnd(10, 24); mk(new THREE.BoxGeometry(w, h, w), std(['#8a9098', '#9aa0a6', '#7a8088'][i % 3], .9), Math.cos(a) * r, h / 2 - 16, Math.sin(a) * r, far, false) } }
  else if (id === 'neon' || id === 'harbor') { const R = mulberry(m.seed + 9);
    for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { let s = -SZ - 10; while (s < SZ + 10) { const w = 6 + R() * 8, h = id === 'neon' ? 16 + R() * 30 : 8 + R() * 8, d = 10, isX = sz !== 0, c = s + w / 2;
      const bx = isX ? c : sx * (SZ + d / 2), bz = isX ? sz * (SZ + d / 2) : c, t = wallTex(id).clone(); t.needsUpdate = true; t.repeat.set(Math.round(w / 5) || 1, Math.round(h / 5) || 1);
      const mat = new THREE.MeshStandardMaterial({ map: t, roughness: .85, metalness: id === 'harbor' ? .4 : 0 }); if (id === 'neon') { mat.emissiveMap = t; mat.emissive = new THREE.Color('#fff'); mat.emissiveIntensity = .25 }
      mk(new THREE.BoxGeometry(isX ? w : d, h, isX ? d : w), mat, bx, h / 2, bz, world, false);
      if (id === 'neon' && R() < .7) { const g = new THREE.Group(); g.position.set(isX ? c : sx * SZ, 0, isX ? sz * SZ : c); g.rotation.y = Math.atan2(-sx, -sz); world.add(g); const v = R() * 100 | 0; mk(new THREE.PlaneGeometry(Math.min(w - 1, 4.5), 1.2), signMat(signTex(SIGNS[v % SIGNS.length], SIGNC[v % 6], false)), 0, 3.6, .1, g, false) }
      s += w } }
    if (id === 'harbor') { const wp = mk(new THREE.PlaneGeometry(300, 600), std('#2c4458', .15, .8), SZ + 160, .05, 0, far, false); wp.rotation.x = -Math.PI / 2 } }
  else { const mat = id === 'ruins' ? MT.stone : std(id === 'dune' ? '#ad8c62' : '#8e97a1', .95);
    for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const isX = sz !== 0; mk(new THREE.BoxGeometry(isX ? SZ * 2 + 2 : 1, 1.2, isX ? 1 : SZ * 2 + 2), mat, isX ? 0 : sx * (SZ + .5), .6, isX ? sz * (SZ + .5) : 0) }
    hills(far, { dune: '#b8956a', frost: '#cfd6de', ruins: '#56703f' }[id], SZ);
    if (id === 'frost' || id === 'ruins') for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, r = rnd(SZ + 4, SZ + 30); buildTree(id, Math.cos(a) * r, Math.sin(a) * r, i * 37, far, 1.2) }
    if (id === 'dune') for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283, r = rnd(SZ + 6, SZ + 40); buildTree('dune', Math.cos(a) * r, Math.sin(a) * r, i * 37, far, 1.1) } }
  if (!m.indoor && id !== 'neon') { const cl = ctex(256, 128, g => { for (let i = 0; i < 14; i++) { const x = rnd(50, 206), y = rnd(40, 90), r = rnd(20, 45); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128) } });
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cl, fog: false, transparent: true, opacity: .6, depthWrite: false })); const a = Math.random() * 6.283, r = rnd(200, 420); s.position.set(Math.cos(a) * r, rnd(70, 140), Math.sin(a) * r); s.scale.set(rnd(120, 200), rnd(40, 70), 1); far.add(s) } }
}

// ---------------- weather particles ----------------
let fxObj = null, fxPos = null, fxN = 0, fxPh = null, fxKind = 'none';
function setFx(kind) {
  fxKind = kind; if (fxObj) { scene.remove(fxObj); fxObj.geometry.dispose(); fxObj = null } if (kind === 'none') return;
  fxN = Math.round({ rain: 1200, snow: 1000, dust: 300, leaves: 250 }[kind] * (HIGH ? 1 : MED ? .6 : .35)); fxPh = new Float32Array(fxN);
  if (kind === 'rain') { fxPos = new Float32Array(fxN * 6); for (let i = 0; i < fxN; i++) { const x = rnd(-35, 35), y = rnd(0, 25), z = rnd(-35, 35); fxPos.set([x, y, z, x + .04, y + .6, z], i * 6) }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(fxPos, 3)); fxObj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#8894aa', transparent: true, opacity: .18 })) }
  else { fxPos = new Float32Array(fxN * 3); for (let i = 0; i < fxN; i++) { fxPos.set([rnd(-35, 35), rnd(0, 20), rnd(-35, 35)], i * 3); fxPh[i] = Math.random() * 6.28 }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(fxPos, 3));
    fxObj = new THREE.Points(g, new THREE.PointsMaterial({ color: { snow: '#f0f3f6', dust: '#e6d8bc', leaves: '#b89a50' }[kind], size: { snow: .1, dust: .05, leaves: .12 }[kind], map: dotTex, transparent: true, depthWrite: false, opacity: kind === 'dust' ? .35 : .75 })) }
  fxObj.frustumCulled = false; scene.add(fxObj)
}
export function updFx(dt, t) {
  if (!fxObj) return; const cx = camera.position.x, cz = camera.position.z;
  if (fxKind === 'rain') { for (let i = 0; i < fxN; i++) { const o = i * 6; fxPos[o + 1] -= 28 * dt; fxPos[o + 4] -= 28 * dt; if (fxPos[o + 1] < 0) { const x = cx + rnd(-30, 30), z = cz + rnd(-30, 30), y = rnd(18, 25); fxPos.set([x, y, z, x + .04, y + .6, z], o) } } }
  else { const fall = { snow: 1.1, dust: .05, leaves: .7 }[fxKind]; for (let i = 0; i < fxN; i++) { const o = i * 3; fxPos[o + 1] -= fall * dt * (fxKind === 'dust' ? Math.sin(t + fxPh[i]) : 1); fxPos[o] += (Math.sin(t * .6 + fxPh[i]) * .6 + .3) * dt; fxPos[o + 2] += Math.cos(t * .5 + fxPh[i]) * .4 * dt;
    if (fxPos[o + 1] < 0 || fxPos[o + 1] > 20 || Math.abs(fxPos[o] - cx) > 35 || Math.abs(fxPos[o + 2] - cz) > 35) { fxPos[o] = cx + rnd(-34, 34); fxPos[o + 1] = fxKind === 'dust' ? rnd(.2, 6) : rnd(10, 20); fxPos[o + 2] = cz + rnd(-34, 34) } } }
  fxObj.geometry.attributes.position.needsUpdate = true
}
