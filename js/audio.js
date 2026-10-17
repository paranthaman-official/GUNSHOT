// Synthesised sound effects (no audio files needed)
import { S } from './config.js';
let AC = null, NB = null, master = null;
export function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.connect(AC.destination); NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 } catch (e) { } }
  if (AC) { master.gain.value = S.vol * .8; if (AC.state === 'suspended') AC.resume() } return AC
}
export function setVolume() { if (master) master.gain.value = S.vol * .8 }
export function noise(dur, freq, vol) { const a = ac(); if (!a || vol < .01) return; const s = a.createBufferSource(); s.buffer = NB; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8; const g = a.createGain(), t = a.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur) }
export function tone(f1, f2, dur, vol, type) { const a = ac(); if (!a || vol < .01) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = type || 'square'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur) }
export function sfxShot(k, dist, pw) {
  const v = Math.max(0, 1 - dist / 90); if (v <= 0) return;
  if (k === 'ar') { noise(.11, 1400, .34 * v); tone(150, 55, .09, .14 * v, 'sine') } else if (k === 'smg') { noise(.07, 2300, .26 * v); tone(220, 90, .05, .08 * v, 'sine') }
  else if (k === 'shotgun') { noise(.34, 550, .6 * v); tone(110, 38, .22, .24 * v, 'sine'); if (pw) noise(.4, 300, .3 * v) } else if (k === 'dmr') { noise(.2, 900, .48 * v); tone(200, 50, .18, .18 * v, 'sine') }
  else { noise(.55, 400, .7 * v); tone(240, 40, .45, .24 * v, 'sawtooth') }
}
