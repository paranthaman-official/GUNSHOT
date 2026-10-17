// Movement collision, ray casts, hitboxes, concealment
import { PR, STEP, HEAD, HB, HBC, LEAN } from '../config.js';
import { clamp } from '../util.js';
import { W } from './layout.js';

export function floorAt(x, z, y) { let f = 0; for (const b of W.COL) { if (b.y1 > y + STEP) continue; const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1); if ((x - cx) ** 2 + (z - cz) ** 2 < (PR * .85) ** 2 && b.y1 > f) f = b.y1 } return f }
export function ceilAt(x, z, y) { let c = 99; for (const b of W.COL) { if (b.y0 <= y + .5) continue; const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1); if ((x - cx) ** 2 + (z - cz) ** 2 < (PR * .7) ** 2 && b.y0 < c) c = b.y0 } return c }
export function collide(o) {
  const y = o.y || 0;
  for (const b of W.COL) {
    if (b.y1 <= y + STEP || b.y0 >= y + HEAD) continue;
    const cx = clamp(o.x, b.x0, b.x1), cz = clamp(o.z, b.z0, b.z1), dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < PR * PR) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); o.x += dx / d * (PR - d); o.z += dz / d * (PR - d) }
      else { const l = o.x - b.x0, r = b.x1 - o.x, t = o.z - b.z0, bt = b.z1 - o.z, m = Math.min(l, r, t, bt); if (m === l) o.x = b.x0 - PR; else if (m === r) o.x = b.x1 + PR; else if (m === t) o.z = b.z0 - PR; else o.z = b.z1 + PR }
    }
  }
}
export function moveCircle(o, dx, dz) { o.x += dx; collide(o); o.z += dz; collide(o); o.x = clamp(o.x, -W.BX + .6, W.BX - .6); o.z = clamp(o.z, -W.BZ + .6, W.BZ - .6) }
function rayBox(o, d, b) {
  let t0 = 0, t1 = 1e9; const mn = [b.x0, b.y0, b.z0], mx = [b.x1, b.y1, b.z1];
  for (let i = 0; i < 3; i++) { if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return Infinity } else { let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i]; if (a > c) { const s = a; a = c; c = s } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return Infinity } }
  return t0
}
// bullets / sight. bulletsOnly=true ignores railings
export function rayWorld(o, d, max, bullet = false) {
  let t = max;
  if (d[1] < 0) { const tg = -o[1] / d[1], px = o[0] + d[0] * tg, pz = o[2] + d[2] * tg; if (Math.abs(px) <= W.GX && Math.abs(pz) <= W.GZ) t = Math.min(t, tg) }
  for (const b of W.COL) { if (bullet && b.nb) continue; const tt = rayBox(o, d, b); if (tt < t) t = tt }
  return t
}
export function raySphere(o, d, cx, cy, cz, r) { const ox = o[0] - cx, oy = o[1] - cy, oz = o[2] - cz, b = ox * d[0] + oy * d[1] + oz * d[2], c = ox * ox + oy * oy + oz * oz - r * r, h = b * b - c; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1 }
export const dirOf = (yaw, p) => [-Math.sin(yaw) * Math.cos(p), Math.sin(p), -Math.cos(yaw) * Math.cos(p)];
export function losPts(ax, ay, az, bx, by, bz) { const tx = bx - ax, ty = by - ay, tz = bz - az, L = Math.hypot(tx, ty, tz); if (L < .01) return true; return rayWorld([ax, ay, az], [tx / L, ty / L, tz / L], L, true) >= L - .05 }
// hit spheres of a player (handles crouch + lean/peek)
export function hitSpheres(x, y, z, yaw, cr, lean) {
  const rx = Math.cos(yaw), rz = -Math.sin(yaw), L = (lean || 0) * LEAN;
  return (cr ? HBC : HB).map(([hy, r, isH, lf]) => [x + rx * L * lf, y + hy, z + rz * L * lf, r, isH]);
}
// eye position (with lean)
export function eyePos(x, y, z, yaw, eye, lean) { const L = (lean || 0) * LEAN; return [x + Math.cos(yaw) * L, y + eye - Math.abs(L) * .08, z - Math.sin(yaw) * L] }
export function inHide(x, z) { for (const h of W.HIDE) if (x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1) return true; return false }
// concealed = inside a bush/curtain, viewer further than 3.5m, and not shot recently
export function concealed(tx, tz, vx, vz, lastShotMs, now) { return inHide(tx, tz) && Math.hypot(tx - vx, tz - vz) > 3.5 && now - (lastShotMs || 0) > 1500 }
