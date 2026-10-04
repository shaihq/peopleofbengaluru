import { at, audioCtx, duckMusic, env, mtof, noiseSource, out, playSample, ready, type Bus } from './engine'

// The game's sonic vocabulary (sounddesign.md §8, §9, §12, §22).
// Every UI sound and stinger is built from ONE key (D major) and ONE motif,
// so the whole game sounds like it came from the same studio.

export const MOTIF = [74, 78, 81, 86] // D5 F#5 A5 D6 — "da-da-da-DAA"

type Dest = AudioNode

function dest(bus: Bus | Dest): Dest {
  return typeof bus === 'string' ? out(bus) : bus
}

/** Warm pluck: triangle + soft octave, filter closes as it decays. */
function pluck(midi: number, t: number, gain: number, to: Dest, decay = 0.35) {
  const c = audioCtx()!
  const f = mtof(midi)
  const g = c.createGain()
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(f * 8, t)
  lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + decay)
  const a = c.createOscillator()
  a.type = 'triangle'
  a.frequency.value = f
  const b = c.createOscillator()
  b.type = 'sine'
  b.frequency.value = f * 2
  const bg = c.createGain()
  bg.gain.value = 0.3
  a.connect(lp)
  b.connect(bg).connect(lp)
  lp.connect(g).connect(to)
  env(g.gain, t, gain, 0.004, decay)
  a.start(t)
  b.start(t)
  a.stop(t + decay + 0.05)
  b.stop(t + decay + 0.05)
}

/** Soft FM bell — the "discovery" voice. */
function bell(midi: number, t: number, gain: number, to: Dest, decay = 1.1) {
  const c = audioCtx()!
  const f = mtof(midi)
  const car = c.createOscillator()
  car.frequency.value = f
  const mod = c.createOscillator()
  mod.frequency.value = f * 3.5
  const mg = c.createGain()
  mg.gain.setValueAtTime(f * 1.6, t)
  mg.gain.exponentialRampToValueAtTime(f * 0.05, t + decay)
  mod.connect(mg).connect(car.frequency)
  const g = c.createGain()
  car.connect(g).connect(to)
  env(g.gain, t, gain, 0.005, decay)
  car.start(t)
  mod.start(t)
  car.stop(t + decay + 0.05)
  mod.stop(t + decay + 0.05)
}

function tick(t: number, freq: number, gain: number, to: Dest, len = 0.03) {
  const c = audioCtx()!
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + len)
  const g = c.createGain()
  o.connect(g).connect(to)
  env(g.gain, t, gain, 0.002, len)
  o.start(t)
  o.stop(t + len + 0.02)
}

function thump(t: number, gain: number, to: Dest, from = 170, toF = 50, len = 0.18) {
  const c = audioCtx()!
  const o = c.createOscillator()
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(toF, t + len)
  const g = c.createGain()
  o.connect(g).connect(to)
  env(g.gain, t, gain, 0.003, len)
  o.start(t)
  o.stop(t + len + 0.02)
}

function whoosh(t: number, len: number, up: boolean, gain: number, to: Dest, lo = 300, hi = 3500) {
  const c = audioCtx()!
  const s = noiseSource('pink', false)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.4
  bp.frequency.setValueAtTime(up ? lo : hi, t)
  bp.frequency.exponentialRampToValueAtTime(up ? hi : lo, t + len)
  const g = c.createGain()
  s.connect(bp).connect(g).connect(to)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gain, t + len * 0.55)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  s.start(t)
  s.stop(t + len + 0.05)
}

function shimmer(t: number, gain: number, to: Dest) {
  ;[98, 93, 102].forEach((m, i) => bell(m, t + i * 0.05, gain * (1 - i * 0.25), to, 0.6))
}

// ---------------------------------------------------------------------------
// Public vocabulary
// ---------------------------------------------------------------------------

let lastHover = 0
let lastType = 0
const now = () => audioCtx()!.currentTime

export const sfx = {
  /** Menu hover — tiny, rate-limited (§21 no excessive clicks). */
  hover() {
    if (!ready()) return
    const t = now()
    if (t - lastHover < 0.05) return
    lastHover = t
    tick(t, 2600, 0.05, dest('ui'), 0.022)
  },
  /** Select / confirm. */
  select() {
    if (!ready()) return
    const t = now()
    pluck(MOTIF[2], t, 0.16, dest('ui'), 0.22)
    tick(t, 3200, 0.04, dest('ui'), 0.012)
  },
  /** Physical press-down. */
  press() {
    if (!ready()) return
    thump(now(), 0.12, dest('ui'), 220, 90, 0.07)
  },
  /** Back / close — the motif in reverse. */
  back() {
    if (!ready()) return
    const t = now()
    pluck(MOTIF[2], t, 0.12, dest('ui'), 0.18)
    pluck(MOTIF[0], t + 0.07, 0.12, dest('ui'), 0.24)
  },
  typing() {
    if (!ready()) return
    const t = now()
    if (t - lastType < 0.03) return
    lastType = t
    tick(t, 1800 + Math.random() * 500, 0.035, dest('ui'), 0.018)
  },
  error() {
    if (!ready()) return
    const t = now()
    pluck(62, t, 0.16, dest('ui'), 0.16)
    pluck(61, t + 0.09, 0.16, dest('ui'), 0.22)
  },
  /** Creator step: pitch climbs with each step. */
  step(i: number) {
    if (!ready()) return
    const scale = [74, 76, 78, 81, 83, 86]
    const t = now()
    pluck(scale[Math.min(i, scale.length - 1)], t, 0.16, dest('ui'), 0.3)
    whoosh(t, 0.22, true, 0.05, dest('ui'), 800, 4000)
  },

  /** Someone interesting nearby (§7–8). Spatial: it comes from them. */
  discovery(x: number, y: number, z: number) {
    if (!ready()) return
    const to = at(x, y + 1.6, z, 'sfx', 6)
    const t = now()
    bell(MOTIF[2], t, 0.22, to, 0.9)
    bell(MOTIF[3], t + 0.11, 0.26, to, 1.3)
  },
  /** [E] VIEW PROFILE prompt appears. */
  prompt() {
    if (!ready()) return
    pluck(MOTIF[1], now(), 0.09, dest('ui'), 0.3)
  },
  /** Profile opens: impact + tonal + UI movement (§10). */
  profileOpen() {
    if (!ready()) return
    const t = now()
    thump(t, 0.32, dest('ui'))
    whoosh(t, 0.28, true, 0.08, dest('ui'))
    pluck(MOTIF[0], t + 0.02, 0.14, dest('ui'), 0.6)
    pluck(MOTIF[2], t + 0.02, 0.12, dest('ui'), 0.6)
    bell(MOTIF[3], t + 0.04, 0.1, dest('ui'), 0.9)
  },
  profileClose() {
    if (!ready()) return
    const t = now()
    whoosh(t, 0.22, false, 0.06, dest('ui'))
    pluck(MOTIF[2], t, 0.09, dest('ui'), 0.2)
    pluck(MOTIF[0], t + 0.06, 0.09, dest('ui'), 0.3)
  },
  /** Outbound link (portfolio, LinkedIn, X). */
  link() {
    if (!ready()) return
    const t = now()
    whoosh(t, 0.3, true, 0.07, dest('ui'), 600, 6000)
    pluck(MOTIF[3], t + 0.05, 0.1, dest('ui'), 0.4)
  },
  /** Finder opens: a subtle scan (§11). */
  scanOpen() {
    if (!ready()) return
    const t = now()
    const c = audioCtx()!
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(500, t)
    o.frequency.exponentialRampToValueAtTime(1700, t + 0.28)
    const g = c.createGain()
    o.connect(g).connect(dest('ui'))
    env(g.gain, t, 0.06, 0.03, 0.3)
    o.start(t)
    o.stop(t + 0.36)
    whoosh(t, 0.3, true, 0.05, dest('ui'), 1200, 6000)
  },
  scanClose() {
    if (!ready()) return
    whoosh(now(), 0.22, false, 0.05, dest('ui'), 1200, 5000)
  },
  /** Results updated. */
  results(n: number) {
    if (!ready()) return
    const t = now()
    if (n === 0) return pluck(66, t, 0.07, dest('ui'), 0.25)
    pluck(MOTIF[1], t, 0.07, dest('ui'), 0.18)
    pluck(MOTIF[2], t + 0.05, 0.07, dest('ui'), 0.25)
  },
  /** Locate: sonar ping that launches the fly-over. */
  locate() {
    if (!ready()) return
    const t = now()
    bell(MOTIF[3], t, 0.2, dest('ui'), 1.4)
    whoosh(t + 0.1, 1.8, true, 0.07, dest('sfx'), 200, 2400)
  },
  /** Directional pulse from the person you're tracking. */
  pulse(x: number, y: number, z: number, near: number) {
    if (!ready()) return
    const to = at(x, y + 1.5, z, 'sfx', 5)
    const t = now()
    tick(t, 1500 + near * 500, 0.28, to, 0.09)
    tick(t + 0.09, 2250 + near * 500, 0.14, to, 0.07)
  },
  /** Found them — the motif, fully stated. */
  found() {
    if (!ready()) return
    const t = now()
    duckMusic(0.3, 1.2)
    MOTIF.forEach((m, i) => bell(m, t + i * 0.085, 0.16 + i * 0.03, dest('ui'), 1.2))
    shimmer(t + 0.34, 0.05, dest('ui'))
  },
  /** GO LIVE — the biggest moment in the game. */
  goLive() {
    if (!ready()) return
    const t = now()
    duckMusic(0.15, 2.4)
    thump(t, 0.4, dest('ui'), 120, 40, 0.5)
    whoosh(t, 0.6, true, 0.09, dest('ui'), 200, 5000)
    ;[62, 69, 74, 78, 81, 86].forEach((m, i) => pluck(m, t + 0.05 + i * 0.06, 0.13, dest('ui'), 1.6))
    MOTIF.forEach((m, i) => bell(m + 12, t + 0.45 + i * 0.1, 0.09, dest('ui'), 1.6))
    shimmer(t + 0.9, 0.06, dest('ui'))
  },
  toast(tone: 'good' | 'info' | 'bad') {
    if (!ready()) return
    if (tone === 'bad') return sfx.error()
    const t = now()
    pluck(tone === 'good' ? MOTIF[2] : MOTIF[1], t, 0.11, dest('ui'), 0.25)
    pluck(tone === 'good' ? MOTIF[3] : MOTIF[2], t + 0.07, 0.11, dest('ui'), 0.4)
  },
  pauseOpen() {
    if (!ready()) return
    const t = now()
    whoosh(t, 0.35, false, 0.07, dest('ui'), 300, 3000)
    thump(t, 0.12, dest('ui'), 140, 60, 0.2)
  },
  pauseClose() {
    if (!ready()) return
    whoosh(now(), 0.3, true, 0.06, dest('ui'), 300, 3000)
  },
  /** Entering a landmark area — a quiet two-note "you are here". */
  landmark() {
    if (!ready()) return
    const t = now()
    pluck(MOTIF[0], t, 0.05, dest('ui'), 0.5)
    pluck(MOTIF[1], t + 0.12, 0.05, dest('ui'), 0.6)
  },
  /** Standing in the portal: "where to?" */
  portalOpen() {
    if (!ready()) return
    const t = now()
    whoosh(t, 0.5, true, 0.08, dest('ui'), 300, 5000)
    bell(MOTIF[1], t + 0.05, 0.14, dest('ui'), 1.2)
    bell(MOTIF[3], t + 0.13, 0.12, dest('ui'), 1.4)
  },
  /** Travel: a long rising warp as the panels close in. */
  warp() {
    if (!ready()) return
    const t = now()
    duckMusic(0.2, 2.2)
    whoosh(t, 1.4, true, 0.12, dest('ui'), 120, 7000)
    thump(t + 0.55, 0.3, dest('ui'), 90, 35, 0.6)
    const c = audioCtx()!
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(880, t + 1.1)
    const g = c.createGain()
    o.connect(g).connect(dest('ui'))
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.06, t + 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
    o.start(t)
    o.stop(t + 1.25)
  },
  /** Arrival title card — the motif, a little brighter. */
  arrive() {
    if (!ready()) return
    const t = now()
    MOTIF.forEach((m, i) => bell(m, t + i * 0.09, 0.14 + i * 0.02, dest('ui'), 1.3))
    shimmer(t + 0.4, 0.05, dest('ui'))
  },
  /** Character accents. */
  servo(x: number, y: number, z: number) {
    if (!ready()) return
    const c = audioCtx()!
    const t = now()
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(380, t)
    o.frequency.linearRampToValueAtTime(620, t + 0.12)
    const lp = c.createBiquadFilter()
    lp.type = 'bandpass'
    lp.frequency.value = 900
    lp.Q.value = 4
    const g = c.createGain()
    o.connect(lp).connect(g).connect(at(x, y + 1, z, 'sfx', 2))
    env(g.gain, t, 0.05, 0.02, 0.14)
    o.start(t)
    o.stop(t + 0.2)
  },
  sample: playSample,
}
