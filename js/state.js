// Shared mutable runtime state (imported by game, net, ui modules)
import { EYE } from './config.js';

// networking
export const NET = { peer: null, isHost: false, room: null, myId: null, hostConn: null, conns: new Map(), sendTimer: null };

// host-only authoritative game (null on clients)
export const GS = { G: null, nextId: 1, inGame: false, paused: false, LB: null };

// client view of the match (filled from snapshots)
export const R = { players: new Map(), tm: 300, phase: 'lobby', win: '', mode: 'ffa', ts: [0, 0], killer: null, killerId: null, killW: '', aim: 'manual', fire: 'manual' };

// local player prediction
export const me = { x: 0, y: 0, z: 0, vy: 0, vx: 0, vz: 0, yaw: 0, pitch: 0, aimYaw: 0, aimPitch: 0, ground: true, sp: -1, ads: false, crouch: false, sprint: false, sprintT: false,
  slideT: 0, slideCd: 0, bob: 0, recoil: 0, kick: 0, eye: EYE, deathT: 0, zl: 0, breath: 1, swayT: 0, roll: 0, lean: 0, hintUntil: 0 };
