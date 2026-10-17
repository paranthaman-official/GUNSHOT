// =====================================================================
//  Detailed procedural guns (first-person view models + third-person),
//  gloved hands and soldier player models.
//  Gun space: f = forward (towards muzzle, -Z in three.js), y = up, metres, origin at trigger.
// =====================================================================
import * as THREE from 'three';
import { CLS, CK } from '../config.js';
import { ctex, std, MED, camera, scene, dotTex } from './renderer.js';

// ---------- materials ----------
const roughN = ctex(256, 256, (g, w, h) => { g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12000; i++) { const v = 90 + Math.random() * 90 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2) } for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(60,60,60,.5)'; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + Math.random() * 40 - 20, y + Math.random() * 6); g.stroke() } }, false, true);
roughN.repeat.set(14, 14);
const woodT = ctex(256, 256, (g, w, h) => { g.fillStyle = '#6a4224'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${40 + Math.random() * 40 | 0},${20 + Math.random() * 20 | 0},10,${.2 + Math.random() * .4})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 30 + i) * 4); g.stroke() } }, true, true);
woodT.repeat.set(8, 8);
const M = {
  steel: new THREE.MeshStandardMaterial({ color: '#2b2d31', metalness: .85, roughness: .42, roughnessMap: roughN }),
  dark: new THREE.MeshStandardMaterial({ color: '#141518', metalness: .6, roughness: .5, roughnessMap: roughN }),
  poly: new THREE.MeshStandardMaterial({ color: '#1d1e21', metalness: .05, roughness: .8, roughnessMap: roughN }),
  tan: new THREE.MeshStandardMaterial({ color: '#8c7a58', metalness: .05, roughness: .82, roughnessMap: roughN }),
  od: new THREE.MeshStandardMaterial({ color: '#4b5238', metalness: .05, roughness: .8, roughnessMap: roughN }),
  wood: new THREE.MeshStandardMaterial({ map: woodT, roughness: .5, metalness: 0 }),
  brass: std('#b8923a', .3, .9),
  glass: new THREE.MeshPhysicalMaterial({ color: '#7fa6c8', metalness: .2, roughness: .05, transparent: true, opacity: .22, depthWrite: false }),
  lens: new THREE.MeshStandardMaterial({ color: '#0a1624', metalness: .9, roughness: .08, emissive: '#0d2236', emissiveIntensity: .35 }),
  red: new THREE.MeshBasicMaterial({ color: '#ff2a2a' }),
  glove: new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: .85, roughnessMap: roughN }),
  knuckle: std('#3a3c40', .7),
  sleeve: new THREE.MeshStandardMaterial({ color: '#4a5040', roughness: .95 }),
  cuff: std('#33362e', .95)
};
// ---------- primitive helpers (f = forward) ----------
function ext(par, pts, w, mat, x = 0, bev = .0025) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const d = Math.max(.001, w - bev * 2), g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -d / 2); g.rotateY(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.x = x; par.add(m); return m
}
function cyl(par, rB, rF, f0, f1, y, mat, x = 0, seg = 16, open = false) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rB, rF, f1 - f0, seg, 1, open), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, -(f0 + f1) / 2); par.add(m); return m }
function box(par, w, h, f0, f1, y, mat, x = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, f1 - f0), mat); m.position.set(x, y, -(f0 + f1) / 2); par.add(m); return m }
function ring(par, r, tube, f, y, mat, x = 0) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24), mat); m.position.set(x, y, -f); par.add(m); return m }
function rail(par, f0, f1, y, hi, x = 0, side = 0) { // picatinny rail
  const b = side ? box(par, .006, .02, f0, f1, y, M.dark, x) : box(par, .021, .006, f0, f1, y, M.dark, x);
  if (hi) for (let f = f0 + .004; f < f1 - .004; f += .01) side ? box(par, .004, .022, f, f + .005, y, M.dark, x + Math.sign(x) * .004) : box(par, .023, .005, f, f + .005, y + .005, M.dark, x)
}
function mlok(par, f0, f1, y, r, mat) { // octagonal handguard with slots
  const h = cyl(par, r, r, f0, f1, y, mat, 0, 8); h.rotation.y = Math.PI / 8;
  for (let f = f0 + .02; f < f1 - .03; f += .045) for (const s of [-1, 1]) box(par, .002, .008, f, f + .025, y, M.dark, s * r * .93);
}
function redDot(par, f, y, hi) { // holographic sight
  box(par, .028, .012, f - .03, f + .045, y - .016, M.dark); cyl(par, .018, .018, f - .015, f + .04, y, M.dark, 0, 20, true).material = M.darkDS || (M.darkDS = M.dark.clone(), M.darkDS.side = THREE.DoubleSide, M.darkDS);
  const gl = new THREE.Mesh(new THREE.CircleGeometry(.016, 20), M.glass); gl.position.set(0, y, -(f + .03)); par.add(gl);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.0009, 8, 6), M.red); dot.position.set(0, y, -(f + .03)); par.add(dot);
  if (hi) box(par, .006, .008, f + .0, f + .02, y + .02, M.dark, .0)
}
function scope(par, f0, f1, y, r, bell, hi) {
  cyl(par, r, r, f0 + .06, f1 - .07, y, M.steel, 0, 24); // tube
  cyl(par, r, bell, f1 - .07, f1 - .03, y, M.steel, 0, 24); cyl(par, bell, bell, f1 - .03, f1, y, M.steel, 0, 24); // objective bell
  cyl(par, r * 1.25, r, f0 + .03, f0 + .06, y, M.steel, 0, 24); cyl(par, r * 1.25, r * 1.25, f0, f0 + .03, y, M.dark, 0, 24); // ocular
  const fl = new THREE.Mesh(new THREE.CircleGeometry(bell * .88, 24), M.lens); fl.position.set(0, y, -f1 - .001); fl.rotation.y = Math.PI; par.add(fl);
  const rl = new THREE.Mesh(new THREE.CircleGeometry(r * 1.1, 24), M.lens); rl.position.set(0, y, -f0 + .001); par.add(rl);
  const mid = (f0 + f1) / 2; const t1 = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .022, 14), M.dark); t1.position.set(0, y + r + .008, -mid); par.add(t1);
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .022, 14), M.dark); t2.rotation.z = Math.PI / 2; t2.position.set(r + .008, y, -mid); par.add(t2);
  for (const f of [f0 + .08, f1 - .1]) { ring(par, r + .002, .004, f, y, M.dark); box(par, .016, y - .045, f - .006, f + .006, (y + .045) / 2 - .002, M.dark) }
  if (hi) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; box(par, .003, .003, mid - .003, mid + .003, y + r + .019 + Math.sin(a) * .0, M.steel, Math.cos(a) * .009) }
}

// ---------- gun builders ----------
// returns {g, muzzle:[f,y], sightY, rh:[f,y] right hand (grip), lh:[f,y] support hand}
export function buildGun(k, hi = true) {
  const g = new THREE.Group(); let o;
  if (k === 'ar') {
    ext(g, [[-.075, 0], [.165, 0], [.165, -.012], [.145, -.03], [.07, -.036], [.03, -.036], [0, -.022], [-.075, -.02]], .026, M.steel);           // lower
    box(g, .028, .045, -.075, .17, .0225, M.steel); box(g, .002, .016, .02, .085, .022, M.dark, .0145);                                          // upper + port
    cyl(g, .005, .005, .0, .02, .02, M.steel, .017, 10); box(g, .03, .009, -.105, -.072, .04, M.dark);                                       // forward assist, charging handle
    rail(g, -.07, .165, .048, hi);
    mlok(g, .168, .46, .022, .022, M.tan); rail(g, .17, .46, .046, hi);
    cyl(g, .0095, .0095, .46, .6, .022, M.steel, 0, 14); box(g, .02, .018, .44, .465, .022, M.dark);                                          // barrel + gas block
    cyl(g, .013, .013, .6, .655, .022, M.dark, 0, 12); if (hi) for (let f = .61; f < .65; f += .012) box(g, .028, .004, f, f + .005, .022, M.steel);  // brake
    ext(g, [[.083, -.03], [.135, -.03], [.15, -.11], [.17, -.2], [.118, -.212], [.1, -.12]], .023, M.tan); box(g, .026, .01, .115, .175, -.207, M.poly).rotation.x = .3;  // mag
    ext(g, [[-.005, -.03], [.03, -.03], [.012, -.135], [-.032, -.13]], .027, M.poly);                                                          // grip
    box(g, .004, .004, .0, .072, -.047, M.dark); box(g, .003, .02, .03, .036, -.03, M.dark);                                                    // trigger guard, trigger
    cyl(g, .015, .015, -.32, -.075, .016, M.dark, 0, 14);                                                                                        // buffer tube
    ext(g, [[-.18, .043], [-.33, .045], [-.345, -.055], [-.3, -.062], [-.27, -.012], [-.18, -.002]], .036, M.tan); box(g, .04, .1, -.35, -.34, -.005, M.poly);  // stock + pad
    redDot(g, -.02, .078, hi);
    o = { muzzle: [.66, .022], sightY: .078, rh: [.005, -.075], lh: [.32, -.005] };
  } else if (k === 'smg') {
    box(g, .034, .045, -.12, .24, .02, M.steel); cyl(g, .017, .017, -.12, .24, .042, M.steel, 0, 14);
    cyl(g, .012, .012, .15, .33, .045, M.steel, 0, 12); box(g, .004, .03, .05, .1, .03, M.dark, .018);
    ext(g, [[.12, -.002], [.3, -.002], [.3, .03], [.12, .03]], .044, M.poly); if (hi) for (let f = .14; f < .29; f += .02) box(g, .046, .003, f, f + .006, .028, M.dark);
    cyl(g, .009, .009, .3, .38, .025, M.steel, 0, 12); cyl(g, .012, .012, .36, .38, .025, M.dark, 0, 12);
    ring(g, .013, .003, .31, .072, M.steel); box(g, .004, .03, .305, .315, .055, M.steel); box(g, .003, .01, .305, .312, .072, M.steel);
    cyl(g, .012, .012, -.1, -.08, .072, M.dark, 0, 14); box(g, .01, .025, -.1, -.08, .055, M.dark);
    ext(g, [[.045, -.002], [.08, -.002], [.105, -.12], [.128, -.2], [.093, -.208], [.068, -.12]], .02, M.dark);
    box(g, .03, .032, -.07, .05, -.012, M.poly); ext(g, [[-.04, -.025], [-.005, -.025], [-.02, -.13], [-.06, -.125]], .028, M.poly); box(g, .003, .018, .0, .006, -.035, M.dark);
    for (const s of [-1, 1]) cyl(g, .004, .004, -.33, -.12, .02, M.steel, s * .012, 8); ext(g, [[-.33, .045], [-.345, .045], [-.345, -.055], [-.33, -.055]], .04, M.poly);
    o = { muzzle: [.385, .025], sightY: .072, rh: [-.02, -.07], lh: [.22, -.01] };
  } else if (k === 'shotgun') {
    ext(g, [[-.08, .04], [.16, .04], [.16, -.012], [.07, -.02], [-.08, -.018]], .03, M.steel); box(g, .002, .02, .0, .08, .02, M.dark, .0155);
    cyl(g, .011, .011, .16, .73, .036, M.steel, 0, 16); box(g, .006, .004, .16, .73, .05, M.dark);
    cyl(g, .011, .011, .16, .64, .009, M.steel, 0, 14); cyl(g, .012, .012, .64, .66, .009, M.dark, 0, 14);
    cyl(g, .021, .021, .27, .45, .011, M.wood, 0, 16); if (hi) for (let f = .28; f < .44; f += .022) { const r2 = ring(g, .0205, .0025, f, .011, M.dark); r2.rotation.y = 0 }
    const bead = new THREE.Mesh(new THREE.SphereGeometry(.003, 8, 6), M.brass); bead.position.set(0, .054, -.722); g.add(bead);
    ext(g, [[-.08, .036], [-.2, .03], [-.43, .038], [-.44, -.095], [-.385, -.1], [-.1, -.035], [-.06, -.018]], .038, M.wood); box(g, .04, .13, -.45, -.435, -.03, M.poly);
    box(g, .004, .004, .0, .065, -.03, M.dark); box(g, .003, .02, .025, .031, -.022, M.dark);
    o = { muzzle: [.73, .036], sightY: .054, rh: [-.07, -.05], lh: [.36, -.006] };
  } else if (k === 'sniper') {
    cyl(g, .018, .018, -.13, .12, .02, M.steel, 0, 18);
    const bh = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .06, 8), M.steel); bh.rotation.z = Math.PI / 2.4; bh.position.set(.04, .015, .1); g.add(bh);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(.009, 10, 8), M.dark); kn.position.set(.066, .003, .1); g.add(kn);
    cyl(g, .014, .011, .12, .84, .02, M.steel, 0, 16); if (hi) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(g, .002, .002, .2, .7, .02 + Math.sin(a) * .0125, M.dark, Math.cos(a) * .0125) }
    cyl(g, .017, .017, .84, .9, .02, M.dark, 0, 14); if (hi) for (let f = .85; f < .89; f += .013) box(g, .036, .005, f, f + .006, .02, M.steel);
    ext(g, [[.05, .006], [.47, .006], [.47, -.03], [.06, -.045]], .046, M.od);
    ext(g, [[-.01, -.03], [.035, -.03], [.02, -.13], [-.025, -.128]], .03, M.od);
    ext(g, [[-.11, .012], [-.45, .022], [-.47, -.13], [-.42, -.14], [-.3, -.075], [-.12, -.055]], .04, M.od); box(g, .03, .02, -.33, -.18, .035, M.od); box(g, .044, .14, -.48, -.465, -.05, M.poly);
    box(g, .024, .055, .005, .075, -.04, M.dark); box(g, .004, .004, -.015, .045, -.05, M.dark);
    for (const s of [-1, 1]) cyl(g, .004, .004, .2, .44, -.04, M.dark, s * .012, 8);
    scope(g, -.2, .22, .085, .015, .026, hi);
    o = { muzzle: [.9, .02], sightY: .085, rh: [.0, -.075], lh: [.3, -.035] };
  } else { // dmr
    box(g, .034, .05, -.09, .23, .02, M.tan); ext(g, [[-.07, -.005], [.16, -.005], [.16, -.02], [.06, -.035], [-.07, -.03]], .03, M.poly);
    rail(g, -.085, .45, .05, hi); mlok(g, .23, .45, .022, .023, M.tan);
    cyl(g, .011, .011, .45, .66, .022, M.steel, 0, 14); cyl(g, .014, .014, .66, .71, .022, M.dark, 0, 12); if (hi) for (let f = .665; f < .705; f += .012) box(g, .002, .02, f, f + .005, .022, M.steel, .014);
    ext(g, [[.07, -.032], [.132, -.032], [.137, -.15], [.075, -.15]], .025, M.dark);
    ext(g, [[-.005, -.03], [.03, -.03], [.012, -.135], [-.032, -.13]], .027, M.poly); box(g, .004, .004, .0, .065, -.045, M.dark);
    ext(g, [[-.09, .045], [-.34, .04], [-.36, -.07], [-.31, -.075], [-.25, -.02], [-.09, -.02]], .038, M.tan); box(g, .03, .018, -.3, -.15, .052, M.poly);
    scope(g, -.12, .17, .085, .013, .02, hi);
    o = { muzzle: [.715, .022], sightY: .085, rh: [.005, -.075], lh: [.34, -.008] };
  }
  g.traverse(m => { if (m.isMesh) { m.castShadow = MED; m.receiveShadow = false } });
  return Object.assign({ g }, o);
}

// ---------- gloved hands ----------
function limb(par, a, b, r1, r2, mat) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B); const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, L, 12), mat); m.position.copy(A).add(B).multiplyScalar(.5); m.lookAt(B); m.rotateX(Math.PI / 2); par.add(m); return m }
function finger(par, x, y, z, len, rx, ry) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(.0085, len, 4, 8), M.glove); f.position.set(x, y, z); f.rotation.set(rx, ry, Math.PI / 2); par.add(f) }
function rightHand(par, f, y) { // wraps the pistol grip
  const h = new THREE.Group(); h.position.set(0, y, -f); h.rotation.x = -.25; par.add(h);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(.03, .085, .075), M.glove); palm.position.set(.026, 0, .012); h.add(palm);
  for (let i = 0; i < 4; i++) finger(h, -.004, .028 - i * .021, -.026, .032, 0, 0);
  const kn = new THREE.Mesh(new THREE.BoxGeometry(.012, .08, .02), M.knuckle); kn.position.set(-.024, .0, -.022); h.add(kn);
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(.009, .04, 4, 8), M.glove); th.position.set(-.02, .05, -.005); th.rotation.set(.9, 0, .3); h.add(th);
  limb(h, [.03, -.01, .05], [.08, -.12, .32], .026, .034, M.glove).material = M.cuff; limb(h, [.07, -.1, .28], [.14, -.24, .6], .034, .042, M.sleeve);
}
function leftHand(par, f, y) { // under the handguard
  const h = new THREE.Group(); h.position.set(0, y, -f); par.add(h);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(.075, .028, .085), M.glove); palm.position.set(-.008, -.03, 0); h.add(palm);
  for (let i = 0; i < 4; i++) finger(h, -.03, -.008, -.03 + i * .02, .035, 0, Math.PI / 2 * 0);
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(.009, .04, 4, 8), M.glove); th.position.set(.026, -.005, .01); th.rotation.set(Math.PI / 2, 0, 0); h.add(th);
  limb(h, [-.01, -.045, .03], [-.09, -.14, .26], .026, .032, M.cuff); limb(h, [-.08, -.13, .22], [-.2, -.3, .55], .034, .042, M.sleeve);
}

// ---------- first-person view models ----------
export const vmRoot = new THREE.Group(); camera.add(vmRoot);
export const VM = {};
for (const k of CK) {
  const G = buildGun(k, true), g = new THREE.Group(); g.add(G.g);
  rightHand(G.g, G.rh[0], G.rh[1]); leftHand(G.g, G.lh[0], G.lh[1]);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: '#ffe0b0', transparent: true, opacity: .6, depthWrite: false })); fl.position.set(0, G.muzzle[1], -G.muzzle[0] - .02); fl.scale.set(.12, .12, 1); fl.visible = false; G.g.add(fl);
  G.g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false } });
  g.userData = { flash: fl, sightY: G.sightY }; g.visible = false; vmRoot.add(g); VM[k] = g;
}
export const flashLight = new THREE.PointLight('#ffd8a0', 0, 6, 2); camera.add(flashLight); flashLight.position.set(.2, -.1, -.8);
vmRoot.position.set(.17, -.19, -.3);

// ---------- third-person soldier ----------
const mPants = std('#3b3f36', .9), mShirt = std('#4a4f44', .88), mVest = std('#2c302a', .8), mHelm = std('#3a3e36', .7), mSkin = std('#b98a6c', .75), mBoot = std('#1d1b18', .85), mLens = std('#101215', .15, .6);
function mk(geo, mat, x, y, z, par, sh = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sh && MED) { m.castShadow = true; m.receiveShadow = true } par.add(m); return m }
export function makePlayer(col) {
  const g = new THREE.Group(), band = std(col, .6); scene.add(g); const body = new THREE.Group(); g.add(body);
  const legs = []; for (const s of [-1, 1]) { const lg = new THREE.Group(); lg.position.set(s * .13, .9, 0); body.add(lg); mk(new THREE.CapsuleGeometry(.11, .6, 4, 8), mPants, 0, -.42, 0, lg); mk(new THREE.BoxGeometry(.2, .13, .34), mBoot, 0, -.84, -.04, lg); mk(new THREE.BoxGeometry(.16, .14, .1), mPants, 0, -.4, -.1, lg); legs.push(lg) }
  const torso = new THREE.Group(); torso.position.y = .9; body.add(torso);
  mk(new THREE.CapsuleGeometry(.24, .38, 4, 10), mShirt, 0, .3, 0, torso); mk(new THREE.BoxGeometry(.5, .48, .34), mVest, 0, .34, 0, torso);
  for (const px of [-.13, 0, .13]) mk(new THREE.BoxGeometry(.11, .14, .06), mVest, px, .22, -.2, torso); mk(new THREE.BoxGeometry(.38, .42, .16), mVest, 0, .36, .24, torso);
  const head = new THREE.Group(); head.position.set(0, .72, 0); torso.add(head);
  mk(new THREE.CylinderGeometry(.06, .07, .1, 8), mSkin, 0, -.1, 0, head); mk(new THREE.SphereGeometry(.13, 16, 12), mSkin, 0, .04, 0, head).scale.set(1, 1.15, 1.05);
  mk(new THREE.SphereGeometry(.165, 18, 10, 0, 6.283, 0, 1.6), mHelm, 0, .08, .01, head); mk(new THREE.BoxGeometry(.2, .06, .06), mLens, 0, .06, -.12, head, false);
  const arms = new THREE.Group(); arms.position.set(0, .5, 0); torso.add(arms);
  for (const s of [-1, 1]) mk(new THREE.CapsuleGeometry(.075, .3, 4, 8), mShirt, s * .24, -.06, -.12, arms).rotation.x = Math.PI / 2.4;
  mk(new THREE.BoxGeometry(.1, .05, .12), band, -.27, 0, -.02, arms, false); mk(new THREE.BoxGeometry(.1, .05, .12), band, .27, 0, -.02, arms, false);
  const gunSlot = new THREE.Group(); gunSlot.position.set(.06, -.12, -.3); arms.add(gunSlot);
  const shield = mk(new THREE.SphereGeometry(1.05, 20, 12), new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: .06, depthWrite: false }), 0, 1, 0, g, false);
  const aura = mk(new THREE.SphereGeometry(1.1, 20, 12), new THREE.MeshBasicMaterial({ color: '#ffb23f', transparent: true, opacity: .07, depthWrite: false }), 0, 1, 0, g, false); aura.visible = false;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: true })); tag.scale.set(2, .5, 1); tag.position.y = 2.2; tag.renderOrder = 5; g.add(tag);
  g.userData = { body, torso, head, arms, gunSlot, gun: null, gunK: '', muzzle: new THREE.Object3D(), shield, aura, tag, legs, tagK: '', walk: 0, band };
  return g
}
const tpCache = {};
export function setPlayerGun(m, k) {
  const U = m.userData; if (U.gunK === k) return; U.gunK = k; if (U.gun) U.gunSlot.remove(U.gun);
  const G = buildGun(k, false); U.gun = G.g; U.gunSlot.add(G.g); U.muzzle.position.set(0, G.muzzle[1], -G.muzzle[0]); G.g.add(U.muzzle);
}
export function setTag(g, name, col, hp, ctexFn) {
  const k = name + col + Math.round(hp / 10); if (g.userData.tagK === k) return; g.userData.tagK = k; const old = g.userData.tag.material.map; if (old) old.dispose();
  g.userData.tag.material.map = ctexFn(256, 64, (c, w) => { c.font = '700 28px "Space Grotesk",sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.45)'; const tw = Math.max(110, c.measureText(name).width + 24); c.beginPath(); c.roundRect(w / 2 - tw / 2, 4, tw, 40, 10); c.fill();
    c.fillStyle = col; c.fillText(name, w / 2, 33); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(w / 2 - 50, 50, 100, 6); c.fillStyle = hp > 60 ? '#9fd356' : hp > 30 ? '#e8c14a' : '#e05a5a'; c.fillRect(w / 2 - 50, 50, hp, 6) });
  g.userData.tag.material.needsUpdate = true
}
